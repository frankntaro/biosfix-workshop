import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { paginatedResult, parsePageQuery } from "../lib/pagination.js";
import { bindCuidParams, sanitizeText, validateEmail, validatePassword } from "../lib/validate.js";

const r = Router();
r.use(authMiddleware);
r.use(requireRole("ADMIN"));
bindCuidParams(r, "id");

r.get("/", async (req, res) => {
  const pq = parsePageQuery(req.query);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: pq.skip,
      take: pq.take,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    }),
    prisma.user.count(),
  ]);
  res.json(paginatedResult({ items: users, total, page: pq.page, pageSize: pq.pageSize }));
});

const CREATABLE_ROLES = new Set(["RECEPTION", "TECHNICIAN"]);

r.post("/", async (req, res) => {
  const { email, password, name, role } = req.body || {};
  const emailT = validateEmail(email);
  const nameT = sanitizeText(name, 120);
  const passwordT = validatePassword(password, 8);
  if (!emailT || !passwordT || !nameT || !role) {
    return res.status(400).json({ error: "name, email, password (8+ chars) and role are required" });
  }
  if (!CREATABLE_ROLES.has(role)) {
    return res.status(400).json({ error: "Role must be RECEPTION or TECHNICIAN" });
  }
  const passwordHash = await bcrypt.hash(passwordT, 10);
  try {
    const user = await prisma.user.create({
      data: { email: emailT, passwordHash, name: nameT, role },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ error: "Email already in use" });
    res.status(400).json({ error: "Could not create user" });
  }
});

r.patch("/:id", async (req, res) => {
  const { name, email, role, active, password } = req.body || {};
  const data = {};
  if (name !== undefined) {
    const nameT = sanitizeText(name, 120);
    if (!nameT) return res.status(400).json({ error: "Invalid name" });
    data.name = nameT;
  }
  if (email !== undefined) {
    const emailT = validateEmail(email);
    if (!emailT) return res.status(400).json({ error: "Invalid email" });
    data.email = emailT;
  }
  if (role !== undefined) {
    if (!CREATABLE_ROLES.has(role)) return res.status(400).json({ error: "Role must be RECEPTION or TECHNICIAN" });
    data.role = role;
  }
  if (active !== undefined) data.active = Boolean(active);
  if (password !== undefined && password !== "") {
    const pw = validatePassword(password, 8);
    if (!pw) return res.status(400).json({ error: "Password must be at least 8 characters" });
    data.passwordHash = await bcrypt.hash(pw, 10);
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "No changes" });
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    res.json(user);
  } catch (e) {
    if (e?.code === "P2002") return res.status(400).json({ error: "Email already in use" });
    res.status(404).json({ error: "Not found" });
  }
});

export default r;
