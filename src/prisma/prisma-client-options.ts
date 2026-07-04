import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "@prisma/client";

export function getDatabaseUrl(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return databaseUrl;
}

export function createPrismaClientOptions(
  databaseUrl = getDatabaseUrl(),
): Prisma.PrismaClientOptions {
  return {
    adapter: new PrismaPg({
      connectionString: databaseUrl,
    }),
  };
}
