import { PrismaClient } from "@prisma/client";
import { createPrismaClientOptions } from "../../../src/prisma/prisma-client-options";
import { seedBaseFixture } from "../fixtures/base.fixture";

export function createE2ePrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for e2e tests");
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const schemaName = (parsed.searchParams.get("schema") ?? "").toLowerCase();
  if (!databaseName.includes("e2e") && !schemaName.includes("e2e")) {
    throw new Error(`Refusing to reset non-e2e database: ${databaseName}`);
  }

  return new PrismaClient(createPrismaClientOptions(databaseUrl));
}

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "revoked_tokens",
      "role_permissions",
      "user_roles",
      "fiat_payments",
      "p2p_trades",
      "p2p_ads",
      "payment_methods",
      "ledger_entries",
      "ledger_transactions",
      "internal_transfers",
      "external_withdrawals",
      "crypto_accounts",
      "withdrawal_networks",
      "crypto_assets",
      "fiat_currencies",
      "permissions",
      "roles",
      "users"
    RESTART IDENTITY CASCADE
  `);
}

export async function resetAndSeedBase(prisma: PrismaClient) {
  await resetDatabase(prisma);
  await seedBaseFixture(prisma);
}
