import { Router } from "express";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { endExclusiveUtc, parseDayParam } from "../lib/dateRange.js";
import { renderReportsSummaryPdf } from "../services/reportsPdf.js";

const r = Router();
r.use(authMiddleware);
r.use(requireRole("ADMIN", "RECEPTION"));

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cols) {
  return cols.map(csvCell).join(",") + "\r\n";
}

function rangeOrDefault(fromStr, toStr) {
  const toD = parseDayParam(toStr) || new Date();
  let fromD = parseDayParam(fromStr);
  if (!fromD) {
    fromD = new Date(toD);
    fromD.setUTCDate(fromD.getUTCDate() - 30);
  }
  if (fromD > toD) [fromD, toD] = [toD, fromD];
  const fromUtc = new Date(Date.UTC(fromD.getUTCFullYear(), fromD.getUTCMonth(), fromD.getUTCDate()));
  const toUtc = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth(), toD.getUTCDate()));
  const rangeEnd = endExclusiveUtc(toUtc);
  return { fromUtc, toUtc, rangeEnd };
}

r.get("/summary", async (req, res) => {
  const { fromUtc, toUtc, rangeEnd } = rangeOrDefault(req.query.from, req.query.to);
  const gte = fromUtc;
  const lt = rangeEnd;

  const [paymentsAgg, paymentRows, jobsInPeriod, statusGroups, completedJobs, paymentsWithJob] = await Promise.all([
    prisma.payment.aggregate({
      where: { recordedAt: { gte, lt } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.count({ where: { recordedAt: { gte, lt } } }),
    prisma.job.count({ where: { createdAt: { gte, lt } } }),
    prisma.job.groupBy({
      by: ["status"],
      where: { createdAt: { gte, lt } },
      _count: { id: true },
    }),
    prisma.job.count({
      where: { completedAt: { gte, lt } },
    }),
    prisma.payment.findMany({
      where: { recordedAt: { gte, lt } },
      select: {
        amount: true,
        job: { select: { assignedTechnicianId: true } },
      },
    }),
  ]);

  const jobsByStatus = Object.fromEntries(statusGroups.map((s) => [s.status, s._count.id]));

  const techTotals = new Map();
  for (const p of paymentsWithJob) {
    const tid = p.job?.assignedTechnicianId || "_unassigned";
    const cur = techTotals.get(tid) || { amount: 0, count: 0 };
    cur.amount += Number(p.amount);
    cur.count += 1;
    techTotals.set(tid, cur);
  }
  const techIds = [...techTotals.keys()].filter((k) => k !== "_unassigned");
  const users = await prisma.user.findMany({
    where: { id: { in: techIds } },
    select: { id: true, name: true },
  });
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const technicianRevenue = [...techTotals.entries()]
    .map(([id, v]) => ({
      technicianId: id === "_unassigned" ? null : id,
      name: id === "_unassigned" ? "Unassigned" : nameById[id] || "Unknown",
      amount: v.amount,
      count: v.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  res.json({
    from: fromUtc.toISOString().slice(0, 10),
    to: toUtc.toISOString().slice(0, 10),
    paymentsTotal: Number(paymentsAgg._sum.amount || 0),
    paymentCount: paymentRows,
    jobsCreated: jobsInPeriod,
    jobsByStatus,
    completedInRange: completedJobs,
    technicianRevenue,
  });
});

r.get("/export/jobs.csv", async (req, res) => {
  const { fromUtc, toUtc, rangeEnd } = rangeOrDefault(req.query.from, req.query.to);
  const jobs = await prisma.job.findMany({
    where: { createdAt: { gte: fromUtc, lt: rangeEnd } },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      device: { select: { brand: true, model: true, serialNumber: true, conditionNotes: true } },
      assignedTechnician: { select: { name: true } },
    },
  });
  const header = [
    "jobNumber",
    "status",
    "createdAt",
    "completedAt",
    "deliveredAt",
    "customerName",
    "customerPhone",
    "deviceBrand",
    "deviceModel",
    "serialNumber",
    "conditionNotes",
    "technician",
    "laborCost",
    "partsCost",
  ];
  let body = csvRow(header);
  for (const j of jobs) {
    body += csvRow([
      j.jobNumber,
      j.status,
      j.createdAt?.toISOString(),
      j.completedAt?.toISOString() || "",
      j.deliveredAt?.toISOString() || "",
      j.customer?.name,
      j.customer?.phone,
      j.device?.brand,
      j.device?.model,
      j.device?.serialNumber,
      j.device?.conditionNotes,
      j.assignedTechnician?.name || "",
      j.laborCost,
      j.partsCost,
    ]);
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="biosfix-jobs-${fromUtc.toISOString().slice(0, 10)}_to_${toUtc.toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + body);
});

r.get("/export/payments.csv", async (req, res) => {
  const { fromUtc, toUtc, rangeEnd } = rangeOrDefault(req.query.from, req.query.to);
  const rows = await prisma.payment.findMany({
    where: { recordedAt: { gte: fromUtc, lt: rangeEnd } },
    orderBy: { recordedAt: "desc" },
    include: {
      job: { select: { jobNumber: true, assignedTechnicianId: true } },
      recordedBy: { select: { name: true } },
    },
  });
  const techIds = [...new Set(rows.map((r) => r.job?.assignedTechnicianId).filter(Boolean))];
  const users = await prisma.user.findMany({ where: { id: { in: techIds } }, select: { id: true, name: true } });
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const header = ["recordedAt", "jobNumber", "amount", "method", "notes", "recordedBy", "assignedTechnician"];
  let body = csvRow(header);
  for (const p of rows) {
    body += csvRow([
      p.recordedAt?.toISOString(),
      p.job?.jobNumber,
      p.amount,
      p.method,
      p.notes,
      p.recordedBy?.name || "",
      p.job?.assignedTechnicianId ? nameById[p.job.assignedTechnicianId] || "" : "",
    ]);
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="biosfix-payments-${fromUtc.toISOString().slice(0, 10)}_to_${toUtc.toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + body);
});

r.get("/export/customers.csv", async (req, res) => {
  const { fromUtc, toUtc, rangeEnd } = rangeOrDefault(req.query.from, req.query.to);
  const customers = await prisma.customer.findMany({
    where: { createdAt: { gte: fromUtc, lt: rangeEnd } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { jobs: true } } },
  });
  const header = ["createdAt", "name", "phone", "email", "address", "notes", "jobsCount"];
  let body = csvRow(header);
  for (const c of customers) {
    body += csvRow([
      c.createdAt?.toISOString(),
      c.name,
      c.phone,
      c.email,
      c.address,
      c.notes,
      c._count?.jobs,
    ]);
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="biosfix-customers-${fromUtc.toISOString().slice(0, 10)}_to_${toUtc.toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + body);
});

r.get("/export/summary.pdf", async (req, res, next) => {
  try {
    const { fromUtc, toUtc, rangeEnd } = rangeOrDefault(req.query.from, req.query.to);
    const gte = fromUtc;
    const lt = rangeEnd;

    const [paymentsAgg, paymentCount, jobsInPeriod, statusGroups, completedJobs, paymentsWithJob] = await Promise.all([
      prisma.payment.aggregate({
        where: { recordedAt: { gte, lt } },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { recordedAt: { gte, lt } } }),
      prisma.job.count({ where: { createdAt: { gte, lt } } }),
      prisma.job.groupBy({
        by: ["status"],
        where: { createdAt: { gte, lt } },
        _count: { id: true },
      }),
      prisma.job.count({
        where: { completedAt: { gte, lt } },
      }),
      prisma.payment.findMany({
        where: { recordedAt: { gte, lt } },
        select: { amount: true, job: { select: { assignedTechnicianId: true } } },
      }),
    ]);

    const jobsByStatus = Object.fromEntries(statusGroups.map((s) => [s.status, s._count.id]));
    const techTotals = new Map();
    for (const p of paymentsWithJob) {
      const tid = p.job?.assignedTechnicianId || "_unassigned";
      const cur = techTotals.get(tid) || { amount: 0, count: 0 };
      cur.amount += Number(p.amount);
      cur.count += 1;
      techTotals.set(tid, cur);
    }
    const techIds = [...techTotals.keys()].filter((k) => k !== "_unassigned");
    const users = await prisma.user.findMany({
      where: { id: { in: techIds } },
      select: { id: true, name: true },
    });
    const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));
    const technicianRevenue = [...techTotals.entries()]
      .map(([id, v]) => ({
        name: id === "_unassigned" ? "Unassigned" : nameById[id] || "Unknown",
        amount: v.amount,
        count: v.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="biosfix-summary-${fromUtc.toISOString().slice(0, 10)}_to_${toUtc.toISOString().slice(0, 10)}.pdf"`,
    );

    renderReportsSummaryPdf(
      {
        fromLabel: fromUtc.toISOString().slice(0, 10),
        toLabel: toUtc.toISOString().slice(0, 10),
        paymentsTotal: Number(paymentsAgg._sum.amount || 0),
        paymentCount,
        jobsCreated: jobsInPeriod,
        jobsByStatus,
        completedInRange: completedJobs,
        technicianRevenue,
      },
      res,
    );
  } catch (e) {
    next(e);
  }
});

export default r;
