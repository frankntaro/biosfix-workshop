import { Router } from "express";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(authMiddleware);
r.use(requireRole("ADMIN", "RECEPTION", "TECHNICIAN"));

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  return x;
}

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

r.get("/summary", async (req, res) => {
  const now = new Date();
  const day0 = startOfDay(now);
  const week0 = startOfWeek(now);
  const month0 = startOfMonth(now);

  const techId = req.user.role === "TECHNICIAN" ? req.user.sub : null;
  const jobScope = techId ? { assignedTechnicianId: techId } : {};
  /** Cancelled jobs stay in DB but are hidden from dashboard lists and counts. */
  const activeJob = { status: { not: "CANCELLED" } };
  const paymentScope = techId ? { job: { assignedTechnicianId: techId } } : {};

  const recentJobsInclude = {
    customer: { select: { name: true, phone: true } },
    device: { select: { brand: true, model: true, serialNumber: true } },
    ...(techId ? {} : { assignedTechnician: { select: { id: true, name: true } } }),
  };
  const recentJobsTake = techId ? 10 : 25;

  const [
    jobsToday,
    pending,
    completed,
    inRepair,
    paymentsToday,
    paymentsWeek,
    paymentsMonth,
    recentJobs,
    techRows,
    todayIntakes,
  ] = await Promise.all([
    prisma.job.count({
      where: {
        ...jobScope,
        ...activeJob,
        createdAt: { gte: day0 },
      },
    }),
    prisma.job.count({ where: { ...jobScope, status: "PENDING" } }),
    prisma.job.count({ where: { ...jobScope, status: "COMPLETE" } }),
    prisma.job.count({ where: { ...jobScope, status: "IN_PROGRESS" } }),
    prisma.payment.aggregate({
      where: { recordedAt: { gte: day0 }, ...paymentScope },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { recordedAt: { gte: week0 }, ...paymentScope },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { recordedAt: { gte: month0 }, ...paymentScope },
      _sum: { amount: true },
    }),
    prisma.job.findMany({
      where: { ...jobScope, ...activeJob },
      orderBy: { updatedAt: "desc" },
      take: recentJobsTake,
      include: recentJobsInclude,
    }),
    techId
      ? Promise.resolve([])
      : prisma.job.groupBy({
          by: ["assignedTechnicianId"],
          where: { assignedTechnicianId: { not: null }, ...activeJob },
          _count: { id: true },
        }),
    techId
      ? Promise.resolve([])
      : prisma.job.findMany({
          where: { createdAt: { gte: day0 }, ...activeJob },
          orderBy: { createdAt: "desc" },
          take: 25,
          include: {
            customer: { select: { name: true, phone: true } },
            device: { select: { brand: true, model: true, serialNumber: true } },
            assignedTechnician: { select: { name: true } },
          },
        }),
  ]);

  let technicianPerformance;
  if (techId) {
    const mine = await prisma.job.count({ where: { assignedTechnicianId: techId } });
    technicianPerformance = [{ technicianId: techId, name: req.user.name || "You", jobsAssigned: mine }];
  } else {
    const techIds = techRows.map((t) => t.assignedTechnicianId).filter(Boolean);
    const users = await prisma.user.findMany({
      where: { id: { in: techIds } },
      select: { id: true, name: true },
    });
    const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));
    technicianPerformance = techRows.map((t) => ({
      technicianId: t.assignedTechnicianId,
      name: nameById[t.assignedTechnicianId] || "Unknown",
      jobsAssigned: t._count.id,
    }));
  }

  let activities;
  if (techId) {
    const myJobs = await prisma.job.findMany({
      where: { assignedTechnicianId: techId },
      select: { id: true },
    });
    const myJobIds = myJobs.map((j) => j.id);
    if (myJobIds.length === 0) {
      activities = await prisma.activityLog.findMany({
        where: { userId: techId },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { user: { select: { name: true } } },
      });
    } else {
      activities = await prisma.activityLog.findMany({
        where: {
          OR: [{ entityType: "Job", entityId: { in: myJobIds } }, { userId: techId }],
        },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { user: { select: { name: true } } },
      });
    }
  } else {
    activities = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { name: true } } },
    });
  }

  res.json({
    scopedToTechnician: !!techId,
    totalJobsToday: jobsToday,
    pendingJobs: pending,
    completedJobs: completed,
    devicesUnderRepair: inRepair,
    revenueToday: Number(paymentsToday._sum.amount || 0),
    revenueWeek: Number(paymentsWeek._sum.amount || 0),
    revenueMonth: Number(paymentsMonth._sum.amount || 0),
    technicianPerformance,
    recentJobs,
    todayIntakes: techId ? [] : todayIntakes,
    recentActivities: activities.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      user: a.user?.name,
      createdAt: a.createdAt,
    })),
  });
});

export default r;
