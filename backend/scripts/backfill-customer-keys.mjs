/**
 * One-shot: fill phoneKey / nameKey for existing Customer rows (after first `prisma db push`
 * with the new columns). Run from backend folder: `npm run db:customer-keys`
 */
import "dotenv/config";
import { PrismaClient } from "../prisma/generated/client/index.js";
import { customerIdentityKeys } from "../src/lib/customerIdentity.js";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.customer.findMany({ orderBy: { createdAt: "asc" } });
  const seen = new Map();
  let n = 0;
  for (const row of rows) {
    let { phoneKey, nameKey } = customerIdentityKeys(row.name, row.phone);
    if (!phoneKey) {
      console.warn(`Skip ${row.id}: phone has no digits`);
      continue;
    }
    const k = `${phoneKey}\t${nameKey}`;
    if (seen.has(k)) {
      nameKey = `${nameKey}_${row.id}`;
    } else {
      seen.set(k, row.id);
    }
    await prisma.customer.update({
      where: { id: row.id },
      data: { phoneKey, nameKey },
    });
    n += 1;
  }
  console.log(`Backfill complete: ${n} customer(s) updated.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
