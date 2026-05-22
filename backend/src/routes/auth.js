import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signToken } from "../lib/jwt.js";
import { authMiddleware } from "../middleware/auth.js";
import { loginRateLimit } from "../middleware/security.js";
import { sanitizeText, validateEmail, validatePassword } from "../lib/validate.js";

const r = Router();

r.post("/login", loginRateLimit, async (req, res) => {
  const emailNorm = validateEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!emailNorm || !password) return res.status(400).json({ error: "email and password required" });
  const user = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (!user || !user.active) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

r.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

r.patch("/me", authMiddleware, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body || {};
  const userId = req.user.sub;
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || !existing.active) return res.status(404).json({ error: "Not found" });

  const data = {};
  if (name !== undefined) {
    const nameT = sanitizeText(name, 120);
    if (!nameT) return res.status(400).json({ error: "Invalid name" });
    data.name = nameT;
  }
  if (email !== undefined) {
    const emailNorm = validateEmail(email);
    if (!emailNorm) return res.status(400).json({ error: "Invalid email" });
    data.email = emailNorm;
  }
  if (newPassword !== undefined && newPassword !== "") {
    if (!currentPassword) return res.status(400).json({ error: "currentPassword required to change password" });
    const ok = await bcrypt.compare(currentPassword, existing.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password incorrect" });
    const pw = validatePassword(newPassword, 8);
    if (!pw) return res.status(400).json({ error: "New password must be at least 8 characters" });
    data.passwordHash = await bcrypt.hash(pw, 10);
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ error: "No changes" });

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    const token = signToken({ sub: user.id, role: user.role, email: user.email, name: user.name });
    res.json({ user, token });
  } catch (e) {
    if (e?.code === "P2002") return res.status(400).json({ error: "Email already in use" });
    res.status(400).json({ error: "Could not update (email may already be in use)" });
  }
});

export default r;
