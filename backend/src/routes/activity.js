import { Router } from "express";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { paginatedResult, parsePageQuery } from "../lib/pagination.js";

const r = Router();
r.use(authMiddleware);
r.use(requireRole("ADMIN"));

r.get("/", async (req, res) => {
  const pq = parsePageQuery(req.query);
  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: pq.skip,
      take: pq.take,
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    prisma.activityLog.count(),
  ]);
  const items = rows.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    metadata: a.metadata,
    createdAt: a.createdAt,
    user: a.user ? { name: a.user.name, email: a.user.email, role: a.user.role } : null,
  }));
  res.json(paginatedResult({ items, total, page: pq.page, pageSize: pq.pageSize }));
});

export default r;
