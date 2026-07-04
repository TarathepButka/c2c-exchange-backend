# C2C Exchange Backend API

A NestJS + Prisma + PostgreSQL backend API for a peer-to-peer (P2P/C2C) cryptocurrency exchange platform. It features an escrow system, dynamic Role-Based Access Control (RBAC), and an auditable double-entry ledger database schema for crypto balance movements.

---

## 1. Project Title & Description

**C2C Exchange Backend API** — A peer-to-peer cryptocurrency exchange backend designed like Binance C2C. It allows users to advertise buy/sell offers, trade securely using an escrow contract mechanism, upload off-platform fiat payment receipts, and manage digital asset balances with audit logs and dispute resolution flows.

---

## 2. Tech Stack

- **Framework Core**: Node.js + NestJS (v11) + TypeScript
- **Database & ORM**: PostgreSQL + Prisma ORM
- **Authentication**: Passport.js + JWT Authentication + Hashed Passwords (bcryptjs)
- **Security & Performance**: Helmet + CORS Config + API Rate Limiting (nestjs/throttler)
- **Validation**: class-validator + class-transformer
- **API Documentation**: OpenAPI Specification (Swagger UI)

---

## 3. Features

*   **Authentication & User Security**
    *   Secure user registration and login issuing JWT tokens.
    *   Dynamic Role-Based Access Control (RBAC) where roles and permissions are dynamically resolved from the database.
    *   Admin-governed KYC (Know Your Customer) status verification system.
*   **Wallet & Double-Entry Ledger**
    *   Multi-cryptocurrency support (BTC, ETH, XRP, DOGE, USDT).
    *   Double-entry bookkeeping ledger ensuring transaction integrity and preventing double-spending.
    *   Internal wallet-to-wallet transfers (instant, feeless).
    *   External withdrawals with blockchain network fee calculations and admin approval/rejection workflows.
*   **P2P/C2C Trading System (Escrow Flow)**
    *   **Ad Maker**: Post buying or selling ads with customized prices, total volumes, transaction limits, and fiat payment methods.
    *   **Escrow Lock**: When a trade begins, the seller's assets are instantly locked into an escrow account.
    *   **Payment Proof**: Buyers upload fiat transfer receipts as proof of payment.
    *   **Escrow Release**: Sellers verify receipt of funds outside the platform and authorize the release of escrowed crypto to the buyer.
    *   **Dispute Resolution**: Buyers/Sellers can raise disputes. Support admins can manually resolve disputes by releasing the assets to the buyer or refunding them back to the seller.

---

## 4. Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18.0.0 or later, v20/v22 LTS recommended)
- **npm** or **pnpm** (Package manager)
- **Docker** and **Docker Compose** (For running the PostgreSQL container)

---

## 5. Installation / Getting Started

Get the repository up and running locally by running the following commands:

```bash
# 1. Clone the repository
git clone https://github.com/TarathepButka/c2c-exchange-backend.git

cd c2c-exchange-backend

# 2. Install all dependencies
npm install

# 3. Copy the environment variables template
cp .env.example .env

# Windows PowerShell alternative:
# Copy-Item .env.example .env
```

---

## 6. Environment Variables

Configure application settings in the `.env` file using these key variables:

| Variable Name | Description | Default / Example Value |
| :--- | :--- | :--- |
| **POSTGRES_DB** | Name of the PostgreSQL database | `c2c_exchange` |
| **POSTGRES_USER** | Username of the PostgreSQL administrator | `postgres` |
| **POSTGRES_PASSWORD** | Password of the PostgreSQL administrator | `postgres` |
| **POSTGRES_PORT** | Exposed port of the database container | `15432` |
| **DATABASE_URL** | Database connection URL used by Prisma | `postgresql://postgres:postgres@localhost:15432/c2c_exchange?schema=public` |
| **JWT_SECRET** | Secret key used to sign and verify JWT authentication tokens | `change-me-in-production` |
| **JWT_EXPIRES_IN** | Expiry duration of the JWT authorization token | `1d` |
| **PORT** | Port on which the NestJS application server runs | `3000` |
| **CORS_ORIGINS** | Comma-separated list of origins allowed to interact with the API | `http://localhost:3000,http://localhost:5173` |

---

## 7. Database Setup

Spin up the database container, run migrations, and seed initial test data:

```bash
# 1. Start PostgreSQL in background using Docker
docker compose up -d

# 2. Apply migrations to construct the database schema
npm run db:migrate

# 3. Generate Prisma Client from the schema
npm run db:generate

# 4. Seed initial assets, roles, permissions, and test accounts
npm run seed
```

---

## 8. Running the App

Run scripts for compilation and local execution:

```bash
# Start the NestJS application in watch mode (Development)
npm run start:dev

# Compile TypeScript code to production JavaScript (Output to dist/ folder)
npm run build

# Start the compiled application in production mode
npm run start
```

---

## 9. API Documentation

Interactive API Swagger documentation is generated automatically:
*   **Swagger Documentation URL**: [http://localhost:3000/docs](http://localhost:3000/docs)

### Primary Route Modules
*   **`/api/v1/auth` (Authentication)**: Register users (`/register`) and login (`/login`)
*   **`/api/v1/users` (User Management)**: Retrieve profile data and verify KYC status (`/:id/kyc-verifications`)
*   **`/api/v1/assets` (Crypto Assets)**: List supported tokens and check withdrawal networks
*   **`/api/v1/fiat-currencies` (Fiat Currencies)**: Retrieve currencies allowed for trading payments
*   **`/api/v1/wallets` (Wallets & Ledger)**: Check balances, ledger history, perform internal transfers, and request external withdrawals
*   **`/api/v1/p2p` (P2P Exchange)**: Create and list ads, place trade orders, upload payment proof, release escrow, and raise disputes

---

## 10. Postman Collection

The repository includes a local Postman collection and environment for exercising the seeded API flows:

*   **Collection**: `postman/c2c-exchange.postman_collection.json`
*   **Environment**: `postman/c2c-exchange.local.postman_environment.json`
*   **Base URL**: `http://localhost:3000/api/v1`

Recommended setup:

```bash
docker compose up -d
npm run db:migrate
npm run db:generate
npm run seed
npm run start:dev
```

Seeded demo users:

| Role | Email | Password |
| :--- | :--- | :--- |
| Buyer | `buyer@example.com` | `password123` |
| Seller | `seller@example.com` | `password123` |
| Support | `support@example.com` | `password123` |
| Admin | `admin@example.com` | `password123` |

The collection is stateful because trade, wallet, and withdrawal requests mutate balances and statuses. Reset and reseed the local database before a clean full rerun.

---

## 11. Project Structure

The project code is divided cleanly into modules, adhering to NestJS best practices:

```text
c2c-exchange-backend/
├── postman/                # Local Postman collection and environment
├── prisma/                 # Prisma schema, migrations, and seed scripts
│   ├── migrations/         # SQL migration history
│   ├── schema.prisma       # Database schema definitions
│   └── seed.ts             # Database seeding entry point
├── src/                    # NestJS application source
│   ├── assets/             # Crypto assets, withdraw networks, and fiat currencies
│   ├── auth/               # Registration, login, logout, JWT strategy
│   ├── common/             # Guards, decorators, DTOs, middleware, shared Prisma selects
│   ├── config/             # Environment validation and parsing
│   ├── p2p/                # Ads, trades, escrow, fiat payment proof, disputes
│   ├── prisma/             # Prisma service and module
│   ├── rbac/               # Permission constants, module, and database-backed RBAC checks
│   ├── users/              # Safe user profiles and KYC verification
│   ├── wallets/            # Wallet balances, ledger, transfers, withdrawals
│   ├── app.module.ts       # Root application module
│   └── main.ts             # HTTP bootstrap, CORS, Helmet, validation, Swagger
├── test/                   # Automated tests
│   ├── e2e/                # End-to-end API tests and fixtures
│   └── unit/               # Unit tests
├── .env.example            # Local environment template
├── docker-compose.yml      # PostgreSQL service for local development
├── package.json            # npm scripts and dependencies
└── tsconfig.json           # TypeScript compiler configuration
```

### Entity-Relationship Diagram (ER Diagram)

This ERD mirrors `prisma/schema.prisma`. Fields marked `"nullable"` correspond to optional Prisma fields (`?`); composite indexes and unique constraints remain authoritative in the Prisma schema.

```mermaid
erDiagram
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : assigned
  roles ||--o{ role_permissions : grants
  permissions ||--o{ role_permissions : included
  users ||--o{ revoked_tokens : revokes

  users ||--o{ crypto_accounts : owns
  crypto_assets ||--o{ crypto_accounts : asset
  crypto_assets ||--o{ withdrawal_networks : supports
  crypto_accounts ||--o{ ledger_entries : records
  ledger_transactions ||--o{ ledger_entries : contains
  ledger_transactions |o--o| internal_transfers : links
  ledger_transactions |o--o| external_withdrawals : links

  fiat_currencies ||--o{ payment_methods : supports
  users ||--o{ payment_methods : owns

  users ||--o{ p2p_ads : creates
  crypto_assets ||--o{ p2p_ads : trades
  fiat_currencies ||--o{ p2p_ads : priced_by
  payment_methods |o--o{ p2p_ads : receives_fiat

  p2p_ads ||--o{ p2p_trades : matched
  users ||--o{ p2p_trades : buyer
  users ||--o{ p2p_trades : seller
  p2p_trades ||--o{ fiat_payments : records
  payment_methods |o--o{ fiat_payments : paid_to

  users ||--o{ internal_transfers : sends
  users ||--o{ internal_transfers : receives
  crypto_assets ||--o{ internal_transfers : asset

  users ||--o{ external_withdrawals : requests
  crypto_assets ||--o{ external_withdrawals : asset

  users {
    uuid id PK
    string email UK
    string password_hash
    string display_name
    enum kyc_status
    enum status
    datetime created_at
    datetime updated_at
  }

  revoked_tokens {
    uuid id PK
    string jti UK
    uuid user_id FK
    datetime expires_at
    datetime revoked_at
  }

  roles {
    uuid id PK
    string code UK
    string name
    datetime created_at
  }

  permissions {
    uuid id PK
    string code UK
    string description
  }

  user_roles {
    uuid user_id PK, FK
    uuid role_id PK, FK
  }

  role_permissions {
    uuid role_id PK, FK
    uuid permission_id PK, FK
  }

  crypto_assets {
    uuid id PK
    string symbol UK
    string name
    int precision
    boolean is_active
  }

  withdrawal_networks {
    uuid id PK
    uuid asset_id FK
    string network "unique with asset_id"
    string name
    decimal withdraw_fee
    decimal withdraw_min
    decimal withdraw_max
    string address_regex
    boolean requires_tag
    boolean is_active
    datetime created_at
    datetime updated_at
  }

  fiat_currencies {
    uuid id PK
    string code UK
    string name
    int precision
  }

  crypto_accounts {
    uuid id PK
    uuid user_id FK "unique with asset_id"
    uuid asset_id FK "unique with user_id"
    decimal available_balance
    decimal locked_balance
    datetime created_at
    datetime updated_at
  }

  ledger_transactions {
    uuid id PK
    enum type
    string reference_type "nullable"
    uuid reference_id "nullable"
    datetime created_at
  }

  ledger_entries {
    uuid id PK
    uuid ledger_transaction_id FK
    uuid crypto_account_id FK
    enum direction
    enum balance_type
    decimal amount
    decimal balance_after
    datetime created_at
  }

  payment_methods {
    uuid id PK
    uuid user_id FK
    uuid fiat_currency_id FK
    enum type
    string provider_name
    string account_name
    string account_number
    boolean is_active
    datetime created_at
  }

  p2p_ads {
    uuid id PK
    uuid maker_user_id FK
    uuid asset_id FK
    uuid fiat_currency_id FK
    uuid payment_method_id FK "nullable"
    enum side
    decimal price
    decimal total_crypto_amount
    decimal remaining_crypto_amount
    decimal min_fiat_amount
    decimal max_fiat_amount
    enum status
    datetime created_at
    datetime updated_at
  }

  p2p_trades {
    uuid id PK
    uuid ad_id FK
    uuid buyer_user_id FK
    uuid seller_user_id FK
    decimal crypto_amount
    decimal fiat_amount
    decimal price
    enum status
    datetime paid_at "nullable"
    datetime released_at "nullable"
    datetime cancelled_at "nullable"
    datetime disputed_at "nullable"
    datetime created_at
    datetime updated_at
  }

  fiat_payments {
    uuid id PK
    uuid trade_id FK
    uuid payment_method_id FK "nullable"
    decimal amount
    string proof_url
    enum status
    datetime paid_at
    datetime created_at
  }

  internal_transfers {
    uuid id PK
    uuid sender_user_id FK
    uuid receiver_user_id FK
    uuid asset_id FK
    decimal amount
    enum status
    uuid ledger_transaction_id FK, UK "nullable"
    datetime created_at
  }

  external_withdrawals {
    uuid id PK
    uuid user_id FK
    uuid asset_id FK
    decimal amount
    string network
    decimal network_fee
    string destination_address
    string address_tag "nullable"
    string withdraw_order_id "nullable; unique with user_id"
    string tx_hash "nullable"
    string failure_reason "nullable"
    datetime completed_at "nullable"
    enum status
    uuid ledger_transaction_id FK, UK "nullable"
    datetime created_at
    datetime updated_at
  }
```
---

## 12. Testing

Maintain stability of the project with our test suite:

```bash
# Execute unit testing suites
npm run test:unit

# Re-prepare test database and execute End-to-End integration tests
npm run test:e2e

# Run test runner in watch mode
npm run test:watch
```

---

## 13. Scripts

The package runner includes predefined helper script entries in `package.json`:

| Script Command | Detailed Action Description |
| :--- | :--- |
| `npm run build` | Compiles TypeScript files into plain JavaScript output inside the `dist` directory |
| `npm run start` | Executes the production-ready compiled code |
| `npm run start:dev` | Spins up local dev server with auto-refresh (watch mode) |
| `npm run lint` | Checks code formatting and styling rules using ESLint |
| `npm run test` | Standard test suite trigger for local development (unit checks) |
| `npm run test:unit` | Executes only Unit Tests targeting utility structures and features |
| `npm run test:e2e:prepare` | Recreates and migrations clean database context for testing environments |
| `npm run test:e2e` | Runs preparation and executes E2E integration scenarios consecutively |
| `npm run test:watch` | Keeps the Jest test suite listening for changes in source modules |
| `npm run seed` | Seeds default asset networks, roles, and accounts into database tables; run `npm run db:generate` first on a fresh clone |
| `npm run db:generate` | Refreshes database client interface class hooks based on latest schema definitions |
| `npm run db:migrate` | Synchronizes database state schema and maps history states via Prisma Migrator |
| `npm run db:studio` | Launches web interface server showing database table rows inside browser |

---

