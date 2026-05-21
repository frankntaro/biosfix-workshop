import { PrismaClient } from "./generated/client/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@biosfix.local" },
    update: {},
    create: {
      email: "admin@biosfix.local",
      passwordHash: hash,
      name: "System Admin",
      role: "ADMIN",
    },
  });
  const recHash = await bcrypt.hash("reception123", 10);
  await prisma.user.upsert({
    where: { email: "reception@biosfix.local" },
    update: {},
    create: {
      email: "reception@biosfix.local",
      passwordHash: recHash,
      name: "Front Desk",
      role: "RECEPTION",
    },
  });
  const techHash = await bcrypt.hash("tech123", 10);
  await prisma.user.upsert({
    where: { email: "tech@biosfix.local" },
    update: {},
    create: {
      email: "tech@biosfix.local",
      passwordHash: techHash,
      name: "Lead Technician",
      role: "TECHNICIAN",
    },
  });
  console.log("Seed OK: admin@biosfix.local / admin123, reception@biosfix.local / reception123, tech@biosfix.local / tech123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
