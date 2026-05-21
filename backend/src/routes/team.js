import { Router } from "express";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(authMiddleware);
r.use(requireRole("ADMIN", "RECEPTION"));

r.get("/technicians", async (_req, res) => {
  const techs = await prisma.user.findMany({
    where: { role: "TECHNICIAN", active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json(techs);
});

export default r;
