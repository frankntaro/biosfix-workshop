import { PrismaClient } from "./generated/client/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@biosfix.com" },
    update: {},
    create: {
      email: "admin@biosfix.com",
      passwordHash: hash,
      name: "System Admin",
      role: "ADMIN",
    },
  });
  const recHash = await bcrypt.hash("reception123", 10);
  await prisma.user.upsert({
    where: { email: "reception@biosfix.com" },
    update: {},
    create: {
      email: "reception@biosfix.com",
      passwordHash: recHash,
      name: "Front Desk",
      role: "RECEPTION",
    },
  });
  const techHash = await bcrypt.hash("tech123", 10);
  await prisma.user.upsert({
    where: { email: "tech@biosfix.com" },
    update: {},
    create: {
      email: "tech@biosfix.com",
      passwordHash: techHash,
      name: "Lead Technician",
      role: "TECHNICIAN",
    },
  });
  console.log("Seed OK: admin@biosfix.com / admin123, reception@biosfix.com / reception123, tech@biosfix.com / tech123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
