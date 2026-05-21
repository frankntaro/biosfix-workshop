import { prisma } from "../db.js";

export async function nextJobNumber() {
  const last = await prisma.job.findFirst({
    orderBy: { createdAt: "desc" },
    select: { jobNumber: true },
  });
  let n = 1;
  if (last?.jobNumber) {
    const digits = last.jobNumber.replace(/\D/g, "");
    if (digits) n = parseInt(digits, 10) + 1;
  }
  return `BF${String(n).padStart(3, "0")}`;
}
