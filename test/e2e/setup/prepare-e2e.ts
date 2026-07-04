import "./setup-env";
import { execFileSync, spawnSync } from "child_process";
import { join } from "path";

function tryCreateDockerDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  const user = decodeURIComponent(parsed.username || "postgres");
  const host = parsed.hostname.toLowerCase();

  if (!databaseName.toLowerCase().includes("e2e")) {
    throw new Error(`Refusing to create non-e2e database: ${databaseName}`);
  }

  if (host !== "localhost" && host !== "127.0.0.1") {
    return;
  }

  const result = spawnSync(
    "docker",
    ["exec", "c2c-exchange-postgres", "createdb", "-U", user, databaseName],
    { stdio: "pipe" },
  );

  const stderr = result.stderr?.toString() ?? "";
  if (result.status !== 0 && !stderr.includes("already exists")) {
    process.stderr.write(stderr);
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

tryCreateDockerDatabase(databaseUrl);

const prismaCli = join(
  process.cwd(),
  "node_modules",
  "prisma",
  "build",
  "index.js",
);
execFileSync(process.execPath, [prismaCli, "migrate", "reset", "--force"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});
