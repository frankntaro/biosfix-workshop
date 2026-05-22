import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { customerIdentityKeys } from "../lib/customerIdentity.js";
import { paginatedResult, parsePageQuery } from "../lib/pagination.js";
import { bindCuidParams, clampSearchQuery, sanitizeText, validateEmail } from "../lib/validate.js";

const r = Router();
r.use(authMiddleware);
bindCuidParams(r, "id");

r.get("/", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const q = clampSearchQuery(req.query.q);
  const qWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : null;
  const techScope =
    req.user.role === "TECHNICIAN" ? { jobs: { some: { assignedTechnicianId: req.user.sub } } } : null;
  const clauses = [...(qWhere ? [qWhere] : []), ...(techScope ? [techScope] : [])];
  const where = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { AND: clauses };
  const pq = parsePageQuery(req.query);
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: pq.skip,
      take: pq.take,
      include: { _count: { select: { jobs: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  res.json(paginatedResult({ items: customers, total, page: pq.page, pageSize: pq.pageSize }));
});

r.post("/", requireRole("ADMIN", "RECEPTION"), async (req, res) => {
  const { name, phone, email, address, notes } = req.body || {};
  const nameT = sanitizeText(name, 120);
  const phoneT = sanitizeText(phone, 40);
  if (!nameT || !phoneT) return res.status(400).json({ error: "name and phone required" });
  const emailNorm = email != null && String(email).trim() ? validateEmail(email) : null;
  if (email != null && String(email).trim() && !emailNorm) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const { phoneKey, nameKey } = customerIdentityKeys(nameT, phoneT);
  if (!phoneKey) return res.status(400).json({ error: "phone must include digits" });

  const duplicatePayload = {
    error: "A customer with this name and phone number is already registered.",
  };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.customer.findFirst({
          where: { phoneKey, nameKey },
        });
        if (existing) return { type: "duplicate", customer: existing };
        const customer = await tx.customer.create({
          data: {
            name: nameT,
            phone: phoneT,
            phoneKey,
            nameKey,
            email: emailNorm,
            address: address != null ? sanitizeText(address, 300) || null : null,
            notes: notes != null ? sanitizeText(notes, 2000) || null : null,
          },
        });
        return { type: "created", customer };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      }
    );

    if (result.type === "duplicate") {
      return res.status(409).json({ ...duplicatePayload, customer: result.customer });
    }
    return res.status(201).json(result.customer);
  } catch (e) {
    if (e?.code === "P2034") {
      const existing = await prisma.customer.findFirst({ where: { phoneKey, nameKey } });
      if (existing) return res.status(409).json({ ...duplicatePayload, customer: existing });
    }
    throw e;
  }
});

r.get("/:id", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { devices: true, jobs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!customer) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "TECHNICIAN") {
    const ok = customer.jobs?.some((j) => j.assignedTechnicianId === req.user.sub);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
  }
  res.json(customer);
});

r.patch("/:id", requireRole("ADMIN", "RECEPTION", "TECHNICIAN"), async (req, res) => {
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (req.user.role === "TECHNICIAN") {
    const linked = await prisma.job.count({
      where: { customerId: req.params.id, assignedTechnicianId: req.user.sub },
    });
    if (!linked) return res.status(403).json({ error: "Forbidden" });
  }

  const { name, phone, email, address, notes } = req.body || {};
  if (name !== undefined && !sanitizeText(name, 120)) return res.status(400).json({ error: "name cannot be empty" });
  if (phone !== undefined && !sanitizeText(phone, 40)) return res.status(400).json({ error: "phone cannot be empty" });

  const nextName = name !== undefined ? sanitizeText(name, 120) : existing.name;
  const nextPhone = phone !== undefined ? sanitizeText(phone, 40) : existing.phone;
  const { phoneKey, nameKey } = customerIdentityKeys(nextName, nextPhone);
  if (!phoneKey) return res.status(400).json({ error: "phone must include digits" });

  const clash = await prisma.customer.findFirst({
    where: { phoneKey, nameKey, NOT: { id: req.params.id } },
  });
  if (clash) {
    return res.status(409).json({
      error: "Another customer already uses this name and phone number.",
      customer: clash,
    });
  }

  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: nextName }),
        ...(phone !== undefined && { phone: nextPhone }),
        phoneKey,
        nameKey,
        ...(email !== undefined && {
          email:
            email === null || email === ""
              ? null
              : (() => {
                  const e = validateEmail(email);
                  if (!e) throw Object.assign(new Error("Invalid email"), { code: "VALIDATION" });
                  return e;
                })(),
        }),
        ...(address !== undefined && {
          address: address === null || address === "" ? null : sanitizeText(address, 300) || null,
        }),
        ...(notes !== undefined && {
          notes: notes === null || notes === "" ? null : sanitizeText(notes, 2000) || null,
        }),
      },
    });
    res.json(customer);
  } catch (e) {
    if (e?.code === "VALIDATION") return res.status(400).json({ error: "Invalid email" });
    res.status(404).json({ error: "Not found" });
  }
});

export default r;
