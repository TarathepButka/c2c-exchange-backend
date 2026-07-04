import "dotenv/config";

function resolveE2eDatabaseUrl() {
  const explicitUrl = process.env.E2E_DATABASE_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "DATABASE_URL or E2E_DATABASE_URL is required for e2e tests",
    );
  }

  const parsed = new URL(baseUrl);
  parsed.pathname = "/c2c_exchange_e2e";
  return parsed.toString();
}

function assertE2eDatabaseUrl(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const schemaName = (parsed.searchParams.get("schema") ?? "").toLowerCase();

  if (!databaseName.includes("e2e") && !schemaName.includes("e2e")) {
    throw new Error(
      `Refusing to run e2e reset against non-e2e database: ${databaseName || "(empty)"}`,
    );
  }
}

const databaseUrl = resolveE2eDatabaseUrl();
assertE2eDatabaseUrl(databaseUrl);

process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "e2e-test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1d";
process.env.PORT = process.env.PORT ?? "0";
