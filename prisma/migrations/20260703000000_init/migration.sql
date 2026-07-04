CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TYPE "PaymentMethodType" AS ENUM ('BANK_ACCOUNT', 'E_WALLET');

CREATE TYPE "P2PAdSide" AS ENUM ('BUY', 'SELL');

CREATE TYPE "P2PAdStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'FILLED');

CREATE TYPE "P2PTradeStatus" AS ENUM (
  'PENDING_PAYMENT',
  'PAID',
  'RELEASED',
  'CANCELLED',
  'DISPUTED'
);

CREATE TYPE "FiatPaymentStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

CREATE TYPE "LedgerTransactionType" AS ENUM (
  'SEED',
  'ESCROW_LOCK',
  'ESCROW_RELEASE',
  'ESCROW_REFUND',
  'INTERNAL_TRANSFER',
  'EXTERNAL_WITHDRAWAL'
);

CREATE TYPE "LedgerEntryDirection" AS ENUM ('DEBIT', 'CREDIT');

CREATE TYPE "LedgerBalanceType" AS ENUM ('AVAILABLE', 'LOCKED');

CREATE TYPE "TransferStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE
  "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
  );

CREATE TABLE
  "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
  );

CREATE TABLE
  "crypto_assets" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "precision" INTEGER NOT NULL DEFAULT 8,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "crypto_assets_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "fiat_currencies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "precision" INTEGER NOT NULL DEFAULT 2,
    CONSTRAINT "fiat_currencies_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "crypto_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "available_balance" DECIMAL(36, 18) NOT NULL DEFAULT 0,
    "locked_balance" DECIMAL(36, 18) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crypto_accounts_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "ledger_transactions" (
    "id" UUID NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "reference_type" TEXT,
    "reference_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "ledger_entries" (
    "id" UUID NOT NULL,
    "ledger_transaction_id" UUID NOT NULL,
    "crypto_account_id" UUID NOT NULL,
    "direction" "LedgerEntryDirection" NOT NULL,
    "balance_type" "LedgerBalanceType" NOT NULL,
    "amount" DECIMAL(36, 18) NOT NULL,
    "balance_after" DECIMAL(36, 18) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "payment_methods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fiat_currency_id" UUID NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "provider_name" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "p2p_ads" (
    "id" UUID NOT NULL,
    "maker_user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "fiat_currency_id" UUID NOT NULL,
    "payment_method_id" UUID,
    "side" "P2PAdSide" NOT NULL,
    "price" DECIMAL(36, 18) NOT NULL,
    "total_crypto_amount" DECIMAL(36, 18) NOT NULL,
    "remaining_crypto_amount" DECIMAL(36, 18) NOT NULL,
    "min_fiat_amount" DECIMAL(36, 18) NOT NULL,
    "max_fiat_amount" DECIMAL(36, 18) NOT NULL,
    "status" "P2PAdStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "p2p_ads_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "p2p_trades" (
    "id" UUID NOT NULL,
    "ad_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "crypto_amount" DECIMAL(36, 18) NOT NULL,
    "fiat_amount" DECIMAL(36, 18) NOT NULL,
    "price" DECIMAL(36, 18) NOT NULL,
    "status" "P2PTradeStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paid_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "disputed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "p2p_trades_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "fiat_payments" (
    "id" UUID NOT NULL,
    "trade_id" UUID NOT NULL,
    "payment_method_id" UUID,
    "amount" DECIMAL(36, 18) NOT NULL,
    "proof_url" TEXT NOT NULL,
    "status" "FiatPaymentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiat_payments_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "internal_transfers" (
    "id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "receiver_user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "amount" DECIMAL(36, 18) NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "ledger_transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_transfers_pkey" PRIMARY KEY ("id")
  );

CREATE TABLE
  "external_withdrawals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "amount" DECIMAL(36, 18) NOT NULL,
    "network_fee" DECIMAL(36, 18) NOT NULL,
    "destination_address" TEXT NOT NULL,
    "tx_hash" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "ledger_transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_withdrawals_pkey" PRIMARY KEY ("id")
  );

CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");

CREATE UNIQUE INDEX "roles_code_key" ON "roles" ("code");

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions" ("code");

CREATE UNIQUE INDEX "crypto_assets_symbol_key" ON "crypto_assets" ("symbol");

CREATE UNIQUE INDEX "fiat_currencies_code_key" ON "fiat_currencies" ("code");

CREATE UNIQUE INDEX "crypto_accounts_user_id_asset_id_key" ON "crypto_accounts" ("user_id", "asset_id");

CREATE INDEX "ledger_entries_crypto_account_id_created_at_idx" ON "ledger_entries" ("crypto_account_id", "created_at");

CREATE INDEX "p2p_ads_asset_id_fiat_currency_id_side_status_idx" ON "p2p_ads" ("asset_id", "fiat_currency_id", "side", "status");

CREATE INDEX "p2p_trades_buyer_user_id_seller_user_id_status_idx" ON "p2p_trades" ("buyer_user_id", "seller_user_id", "status");

CREATE UNIQUE INDEX "internal_transfers_ledger_transaction_id_key" ON "internal_transfers" ("ledger_transaction_id");

CREATE UNIQUE INDEX "external_withdrawals_ledger_transaction_id_key" ON "external_withdrawals" ("ledger_transaction_id");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crypto_accounts" ADD CONSTRAINT "crypto_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crypto_accounts" ADD CONSTRAINT "crypto_accounts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "crypto_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "ledger_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_crypto_account_id_fkey" FOREIGN KEY ("crypto_account_id") REFERENCES "crypto_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_fiat_currency_id_fkey" FOREIGN KEY ("fiat_currency_id") REFERENCES "fiat_currencies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "p2p_ads" ADD CONSTRAINT "p2p_ads_maker_user_id_fkey" FOREIGN KEY ("maker_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "p2p_ads" ADD CONSTRAINT "p2p_ads_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "crypto_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "p2p_ads" ADD CONSTRAINT "p2p_ads_fiat_currency_id_fkey" FOREIGN KEY ("fiat_currency_id") REFERENCES "fiat_currencies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "p2p_ads" ADD CONSTRAINT "p2p_ads_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "p2p_ads" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fiat_payments" ADD CONSTRAINT "fiat_payments_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "p2p_trades" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiat_payments" ADD CONSTRAINT "fiat_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_receiver_user_id_fkey" FOREIGN KEY ("receiver_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "crypto_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "ledger_transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "external_withdrawals" ADD CONSTRAINT "external_withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "external_withdrawals" ADD CONSTRAINT "external_withdrawals_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "crypto_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "external_withdrawals" ADD CONSTRAINT "external_withdrawals_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "ledger_transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE;