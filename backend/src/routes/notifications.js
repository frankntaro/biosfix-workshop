import { Router } from "express";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const r = Router();
r.use(authMiddleware);

r.get("/", async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { job: { select: { id: true, jobNumber: true } } },
  });
  const unread = await prisma.notification.count({
    where: { userId: req.user.sub, readAt: null },
  });
  res.json({ items, unread });
});

r.patch("/:id/read", async (req, res) => {
  const n = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.sub },
  });
  if (!n) return res.status(404).json({ error: "Not found" });
  await prisma.notification.update({
    where: { id: n.id },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

r.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.sub, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

export default r;
