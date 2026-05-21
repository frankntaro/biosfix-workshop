import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { nextJobNumber } from "../services/jobNumber.js";
import {
  sendCustomerStatusSms,
  sendJobReceivedSms,
  sendSms,
  smsTemplates,
} from "../services/sms.js";
import { renderJobInvoicePdf } from "../services/invoicePdf.js";
import { customerIdentityKeys } from "../lib/customerIdentity.js";
import { paginatedResult, parsePageQuery } from "../lib/pagination.js";

const r = Router();
r.use(authMiddleware);

async function logActivity(userId, action, entityType, entityId, metadata) {
  await prisma.activityLog.create({
    data: { userId, action, entityType, entityId, metadata: metadata || undefined },
  });
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Technicians only see jobs assigned to them. */
function assignedTechWhere(req) {
  return req.user.role === "TECHNICIAN" ? { assignedTechnicianId: req.user.sub } : {};
}

const JOB_LIST_STATUSES = [
  "PENDING",
  "DIAGNOSING",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "COMPLETE",
  "DELIVERED",
  "CANCELLED",
];

function jobListFilterClauses(req) {
  const clauses = [];
  const scope = assignedTechWhere(req);
  if (Object.keys(scope).length) clauses.push(scope);
  const status = req.query.status;
  if (status && JOB_LIST_STATUSES.includes(status)) {
    clauses.push({ status });
  } else if (req.query.includeCancelled !== "1" && req.query.includeCancelled !== "true") {
    clauses.push({ status: { not: "CANCELLED" } });
  }
  return clauses;
}

function jobListWhere(req) {
  const clauses = jobListFilterClauses(req);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

async function assertJobReadable(req, job) {
  if (!job) return null;
  if (req.user.role === "TECHNICIAN" && job.assignedTechnicianId !== req.user.sub) {
    return { error: "Forbidden", status: 403 };
  }
  return null;
}

/** In-app alert for the assigned technician (reception/admin assignment or new job with assignee). */
async function notifyTechnicianAssigned(job, technicianId, assignerName) {
  if (!technicianId) return;
  const tech = await prisma.user.findFirst({
    where: { id: technicianId, role: "TECHNICIAN", active: true },
    select: { id: true },
  });
  if (!tech) return;

  const brand = job.device?.brand?.trim() || "—";
  const model = job.device?.model?.trim() || "—";
  const customer = job.customer?.name?.trim() || "Customer";
  const problem = (job.problemDescription || "").trim().slice(0, 120);
  const who = assignerName?.trim() || "Reception";
  const body = [
    `${who} assigned this repair to you.`,
    `Brand: ${brand} · Model: ${model}`,
    `Customer: ${customer}`,
    problem ? `Problem: ${problem}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await prisma.notification.create({
    data: {
      userId: technicianId,
      jobId: job.id,
      kind: "JOB_ASSIGNED",
      title: `Assigned: ${job.jobNumber}`,
      body,
    },
  });
}

r.get("/search", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    const pq = parsePageQuery(req.query);
    return res.json(paginatedResult({ items: [], total: 0, page: pq.page, pageSize: pq.pageSize }));
  }
  const qClause = {
    OR: [
      { jobNumber: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
    ],
  };
  const clauses = [...jobListFilterClauses(req), qClause];
  const where = clauses.length === 1 ? clauses[0] : { AND: clauses };
  const pq = parsePageQuery(req.query);
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip: pq.skip,
      take: pq.take,
      orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        device: true,
        assignedTechnician: { select: { id: true, name: true } },
      },
    }),
    prisma.job.count({ where }),
  ]);
  res.json(paginatedResult({ items: jobs, total, page: pq.page, pageSize: pq.pageSize }));
});

r.get("/", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const where = jobListWhere(req);
  const pq = parsePageQuery(req.query);
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: pq.skip,
      take: pq.take,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        device: true,
        assignedTechnician: { select: { id: true, name: true } },
        payments: true,
      },
    }),
    prisma.job.count({ where }),
  ]);
  res.json(paginatedResult({ items: jobs, total, page: pq.page, pageSize: pq.pageSize }));
});

r.get("/:id/invoice", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        device: true,
        payments: { orderBy: { recordedAt: "asc" } },
      },
    });
    if (!job) return res.status(404).json({ error: "Not found" });
    const denied = await assertJobReadable(req, job);
    if (denied) return res.status(denied.status).json({ error: denied.error });

    const safeName = `${job.jobNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);

    await logActivity(req.user.sub, "job.invoice_pdf", "Job", job.id, {});

    renderJobInvoicePdf(job, res);
  } catch (e) {
    next(e);
  }
});

r.get("/:id", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      device: true,
      assignedTechnician: { select: { id: true, name: true, email: true } },
      repairs: { orderBy: { createdAt: "desc" }, include: { technician: { select: { name: true } } } },
      payments: { orderBy: { recordedAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
      smsLogs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!job) return res.status(404).json({ error: "Not found" });
  const denied = await assertJobReadable(req, job);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  res.json(job);
});

/** Create job: either customerId + device, or nested customer + device */
r.post("/", requireRole("ADMIN", "RECEPTION"), async (req, res) => {
  const body = req.body || {};
  let customerId = body.customerId;
  const { problemDescription, assignedTechnicianId, laborCost, partsCost } = body;
  const deviceIn = body.device || {};
  if (!problemDescription) return res.status(400).json({ error: "problemDescription required" });

  if (customerId) {
    const exists = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!exists) return res.status(400).json({ error: "customerId not found" });
  }

  if (!customerId && body.customer) {
    const c = body.customer;
    if (!c.name || !c.phone) return res.status(400).json({ error: "customer.name and customer.phone required for new customer" });
    const nameT = String(c.name).trim();
    const phoneT = String(c.phone).trim();
    const { phoneKey, nameKey } = customerIdentityKeys(nameT, phoneT);
    if (!phoneKey) return res.status(400).json({ error: "customer.phone must include digits" });

    let customerIdResolved;
    try {
      customerIdResolved = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.customer.findFirst({
            where: { phoneKey, nameKey },
          });
          if (existing) return existing.id;
          const created = await tx.customer.create({
            data: {
              name: nameT,
              phone: phoneT,
              phoneKey,
              nameKey,
              email: c.email?.trim() || null,
              address: c.address?.trim() || null,
              notes: c.notes?.trim() || null,
            },
          });
          return created.id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        }
      );
    } catch (e) {
      if (e?.code === "P2034") {
        const existing = await prisma.customer.findFirst({ where: { phoneKey, nameKey } });
        if (existing) customerIdResolved = existing.id;
        else throw e;
      } else {
        throw e;
      }
    }
    customerId = customerIdResolved;
  }
  if (!customerId) return res.status(400).json({ error: "customerId or customer object required" });
  if (!deviceIn.brand || !deviceIn.model) return res.status(400).json({ error: "device.brand and device.model required" });

  const jobNumber = await nextJobNumber();
  const device = await prisma.device.create({
    data: {
      customerId,
      brand: deviceIn.brand,
      model: deviceIn.model,
      serialNumber: deviceIn.serialNumber || null,
      conditionNotes: deviceIn.conditionNotes || null,
    },
  });

  const canSetQuote = req.user.role === "ADMIN";
  const job = await prisma.job.create({
    data: {
      jobNumber,
      customerId,
      deviceId: device.id,
      problemDescription,
      assignedTechnicianId: assignedTechnicianId || null,
      laborCost: canSetQuote ? num(laborCost, 0) : 0,
      partsCost: canSetQuote ? num(partsCost, 0) : 0,
      status: "PENDING",
      repairs: {
        create: {
          fromStatus: null,
          toStatus: "PENDING",
          technicianId: req.user.sub,
          notes: "Job opened",
        },
      },
    },
    include: { customer: true, device: true },
  });

  await logActivity(req.user.sub, "job.create", "Job", job.id, { jobNumber });

  await sendJobReceivedSms(job);

  if (job.assignedTechnicianId && job.assignedTechnicianId !== req.user.sub) {
    await notifyTechnicianAssigned(job, job.assignedTechnicianId, req.user.name);
  }

  res.status(201).json(job);
});

r.patch("/:id", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const { laborCost, partsCost, assignedTechnicianId, problemDescription } = req.body || {};
  const existing = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const denied = await assertJobReadable(req, existing);
  if (denied) return res.status(denied.status).json({ error: denied.error });

  const role = req.user.role;
  const data = {};
  if (role === "ADMIN") {
    if (laborCost !== undefined) data.laborCost = num(laborCost, 0);
    if (partsCost !== undefined) data.partsCost = num(partsCost, 0);
    if (assignedTechnicianId !== undefined) data.assignedTechnicianId = assignedTechnicianId;
    if (problemDescription !== undefined) data.problemDescription = problemDescription;
  } else if (role === "RECEPTION") {
    if (assignedTechnicianId !== undefined) data.assignedTechnicianId = assignedTechnicianId;
    if (problemDescription !== undefined) data.problemDescription = problemDescription;
  } else if (role === "TECHNICIAN") {
    if (existing.assignedTechnicianId !== req.user.sub) {
      return res.status(403).json({ error: "Not assigned to this job" });
    }
    if (laborCost !== undefined) data.laborCost = num(laborCost, 0);
    if (partsCost !== undefined) data.partsCost = num(partsCost, 0);
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No allowed fields to update" });
  }
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data,
      include: { customer: true, device: true },
    });
    if (assignedTechnicianId !== undefined) {
      const newTechId = assignedTechnicianId || null;
      const prevTechId = existing.assignedTechnicianId;
      if (newTechId && newTechId !== prevTechId && newTechId !== req.user.sub) {
        await notifyTechnicianAssigned(job, newTechId, req.user.name);
      }
    }
    await logActivity(req.user.sub, "job.update", "Job", job.id, {});
    res.json(job);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

r.patch("/:id/status", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const { status, notes, collectedByName, collectedByPhone, collectionSignature } = req.body || {};
  const allowed = [
    "PENDING",
    "DIAGNOSING",
    "IN_PROGRESS",
    "WAITING_PARTS",
    "COMPLETE",
    "DELIVERED",
    "CANCELLED",
  ];
  if (!status || !allowed.includes(status)) return res.status(400).json({ error: "invalid status" });

  const existing = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: { customer: true, device: true },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "TECHNICIAN" && existing.assignedTechnicianId !== req.user.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const isTech = req.user.role === "TECHNICIAN";
  const isDesk = req.user.role === "ADMIN" || req.user.role === "RECEPTION";

  if (isTech) {
    const techAllowed = ["DIAGNOSING", "IN_PROGRESS", "WAITING_PARTS", "COMPLETE"];
    if (!techAllowed.includes(status)) {
      return res.status(403).json({ error: "Technicians can only set Diagnosing, In progress, Waiting parts, or Complete" });
    }
    if (["COMPLETE", "DELIVERED", "CANCELLED"].includes(existing.status)) {
      return res.status(400).json({ error: "This job is closed for workshop updates; ask reception for pickup or cancellation" });
    }
  }

  if (status === "DELIVERED") {
    if (!isDesk) return res.status(403).json({ error: "Only reception or admin can record customer pickup" });
    if (existing.status !== "COMPLETE") {
      return res.status(400).json({ error: "Repair must be Complete before recording delivery" });
    }
    const cn = String(collectedByName || "").trim();
    const cp = String(collectedByPhone || "").trim();
    if (!cn || !cp) return res.status(400).json({ error: "collectedByName and collectedByPhone required (who took the device)" });
    const sig = String(collectionSignature || "").trim();
    if (sig.length > 12000) return res.status(400).json({ error: "collectionSignature too long" });
  }

  if (status === "CANCELLED" && !isDesk) {
    return res.status(403).json({ error: "Only reception or admin can cancel a repair" });
  }

  if (status === "CANCELLED" && existing.status === "DELIVERED") {
    return res.status(400).json({ error: "Cannot cancel a job that is already delivered" });
  }

  if (status === "PENDING" && isTech) {
    return res.status(403).json({ error: "Technicians cannot set status back to Pending" });
  }

  const updates = { status };
  if (status === "COMPLETE") updates.completedAt = new Date();
  if (status === "DELIVERED") {
    updates.deliveredAt = new Date();
    updates.collectedByName = String(collectedByName || "").trim();
    updates.collectedByPhone = String(collectedByPhone || "").trim();
    const sig = String(collectionSignature || "").trim();
    updates.collectionSignature = sig.length ? sig.slice(0, 12000) : null;
  }
  if (status !== "DELIVERED" && existing.status === "DELIVERED" && isDesk) {
    updates.collectedByName = null;
    updates.collectedByPhone = null;
    updates.deliveredAt = null;
    updates.collectionSignature = null;
  }

  const job = await prisma.$transaction(async (tx) => {
    const j = await tx.job.update({
      where: { id: req.params.id },
      data: updates,
      include: { customer: true, device: true, assignedTechnician: { select: { id: true, name: true } } },
    });
    await tx.repair.create({
      data: {
        jobId: j.id,
        fromStatus: existing.status,
        toStatus: status,
        notes: notes || null,
        technicianId: req.user.sub,
      },
    });
    return j;
  });

  await logActivity(req.user.sub, "job.status", "Job", job.id, { from: existing.status, to: status });

  if (status === "DELIVERED") {
    const collectorLine = `${job.collectedByName} · ${job.collectedByPhone}`;
    const deliveryBody = `Device collected by ${collectorLine}. Customer on file: ${job.customer.name} (${job.customer.phone}).`;
    const recipientIds = new Set();
    if (job.assignedTechnicianId) recipientIds.add(job.assignedTechnicianId);
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { id: true },
    });
    for (const a of admins) recipientIds.add(a.id);
    if (recipientIds.size > 0) {
      await prisma.notification.createMany({
        data: [...recipientIds].map((userId) => ({
          userId,
          jobId: job.id,
          kind: "JOB_DELIVERED",
          title: `Delivered: ${job.jobNumber}`,
          body: deliveryBody,
        })),
      });
    }
    await logActivity(req.user.sub, "job.delivered", "Job", job.id, {
      technicianId: job.assignedTechnicianId,
      collectedByName: job.collectedByName,
      collectedByPhone: job.collectedByPhone,
    });
  }

  await sendCustomerStatusSms(job, existing.status, status);

  res.json(job);
});

r.post("/:id/reminder", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: { customer: true, device: true },
  });
  if (!job) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "TECHNICIAN" && job.assignedTechnicianId !== req.user.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const templates = smsTemplates({
    deviceLabel: `${job.device.brand} ${job.device.model}`.trim(),
    jobNumber: job.jobNumber,
  });
  await sendSms({
    to: job.customer.phone,
    message: templates.COLLECTION_REMINDER,
    jobId: job.id,
    customerId: job.customer.id,
    category: "COLLECTION_REMINDER",
  });
  res.json({ ok: true });
});

export default r;
