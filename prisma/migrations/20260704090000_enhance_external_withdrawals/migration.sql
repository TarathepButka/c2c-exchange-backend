ALTER TYPE "LedgerTransactionType" ADD VALUE 'EXTERNAL_WITHDRAWAL_REFUND';

CREATE TABLE "withdrawal_networks" (
  "id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "network" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "withdraw_fee" DECIMAL(36, 18) NOT NULL,
  "withdraw_min" DECIMAL(36, 18) NOT NULL,
  "withdraw_max" DECIMAL(36, 18) NOT NULL,
  "address_regex" TEXT NOT NULL,
  "requires_tag" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "withdrawal_networks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "external_withdrawals" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'ETH';
ALTER TABLE "external_withdrawals" ALTER COLUMN "network" DROP DEFAULT;
ALTER TABLE "external_withdrawals" ADD COLUMN "address_tag" TEXT;
ALTER TABLE "external_withdrawals" ADD COLUMN "withdraw_order_id" TEXT;
ALTER TABLE "external_withdrawals" ADD COLUMN "failure_reason" TEXT;
ALTER TABLE "external_withdrawals" ADD COLUMN "completed_at" TIMESTAMP(3);

UPDATE "external_withdrawals"
SET "completed_at" = "updated_at"
WHERE "status" = 'COMPLETED' AND "completed_at" IS NULL;

CREATE UNIQUE INDEX "withdrawal_networks_asset_id_network_key" ON "withdrawal_networks" ("asset_id", "network");
CREATE INDEX "withdrawal_networks_asset_id_is_active_idx" ON "withdrawal_networks" ("asset_id", "is_active");
CREATE UNIQUE INDEX "external_withdrawals_user_id_withdraw_order_id_key" ON "external_withdrawals" ("user_id", "withdraw_order_id");
CREATE INDEX "external_withdrawals_user_id_created_at_idx" ON "external_withdrawals" ("user_id", "created_at");
CREATE INDEX "external_withdrawals_asset_id_network_status_idx" ON "external_withdrawals" ("asset_id", "network", "status");

ALTER TABLE "withdrawal_networks" ADD CONSTRAINT "withdrawal_networks_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "crypto_assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE;