import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createPrismaClientOptions } from "../src/prisma/prisma-client-options";
import { seedAccounts } from "./seeds/accounts.seed";
import { seedAssetsAndFiat } from "./seeds/assets.seed";
import { seedLedgerAndMovements } from "./seeds/ledger.seed";
import { seedAdsTradesAndPayments } from "./seeds/p2p.seed";
import { seedPaymentMethods } from "./seeds/payment-methods.seed";
import { seedRolesAndPermissions } from "./seeds/rbac.seed";
import { seedUsers } from "./seeds/users.seed";

const prisma = new PrismaClient(createPrismaClientOptions());

async function main() {
  await seedRolesAndPermissions(prisma);
  await seedAssetsAndFiat(prisma);
  await seedUsers(prisma);
  await seedPaymentMethods(prisma);
  await seedAccounts(prisma);
  await seedAdsTradesAndPayments(prisma);
  await seedLedgerAndMovements(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed. Demo password for all users: password123");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
