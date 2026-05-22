import { Router } from "express";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { bindCuidParams, isCuid, sanitizeText } from "../lib/validate.js";

const r = Router();
r.use(authMiddleware);
bindCuidParams(r, "jobId");

function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

r.post("/", requireRole("ADMIN", "RECEPTION"), async (req, res) => {
  const { jobId, amount, method, notes } = req.body || {};
  const a = num(amount);
  if (!isCuid(jobId) || a == null || a < 0) return res.status(400).json({ error: "jobId and valid amount required" });
  const methodT = sanitizeText(method, 40);
  if (!methodT) return res.status(400).json({ error: "method required" });
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const payment = await prisma.payment.create({
    data: {
      jobId,
      amount: a,
      method: methodT,
      notes: notes != null ? sanitizeText(notes, 500) || null : null,
      recordedById: req.user.sub,
    },
  });
  await prisma.activityLog.create({
    data: {
      userId: req.user.sub,
      action: "payment.create",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { jobId, amount: a },
    },
  });
  res.status(201).json(payment);
});

r.get("/by-job/:jobId", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId }, select: { id: true, assignedTechnicianId: true } });
  if (!job) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "TECHNICIAN" && job.assignedTechnicianId !== req.user.sub) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const payments = await prisma.payment.findMany({
    where: { jobId: req.params.jobId },
    orderBy: { recordedAt: "desc" },
    include: { recordedBy: { select: { name: true } } },
  });
  res.json(payments);
});

export default r;
