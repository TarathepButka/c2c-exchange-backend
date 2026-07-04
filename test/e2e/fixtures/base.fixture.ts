import {
  KycStatus,
  PaymentMethodType,
  Prisma,
  PrismaClient,
  UserStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PERMISSIONS } from "../../../src/rbac/permissions.constants";
import { fixtureIds, permissionIds } from "./ids.fixture";

const d = (value: string | number) => new Prisma.Decimal(value);
const passwordHash = bcrypt.hashSync("password123", 10);

export async function seedBaseFixture(prisma: PrismaClient) {
  await seedRbac(prisma);
  await seedAssetsAndFiat(prisma);
  await seedUsers(prisma);
  await seedAccounts(prisma);
  await seedPaymentMethods(prisma);
}

async function seedRbac(prisma: PrismaClient) {
  await prisma.permission.createMany({
    data: Object.values(PERMISSIONS).map((code) => ({
      id: permissionIds[code],
      code,
      description: `Allows ${code}`,
    })),
  });

  await prisma.role.createMany({
    data: [
      { id: fixtureIds.roles.admin, code: "admin", name: "Administrator" },
      { id: fixtureIds.roles.trader, code: "trader", name: "Trader" },
      { id: fixtureIds.roles.support, code: "support", name: "Support" },
    ],
  });

  const traderPermissions = [
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.WALLET_READ,
    PERMISSIONS.WALLET_TRANSFER_CREATE,
    PERMISSIONS.WALLET_WITHDRAW_CREATE,
    PERMISSIONS.P2P_AD_CREATE,
    PERMISSIONS.P2P_AD_READ,
    PERMISSIONS.P2P_AD_CANCEL,
    PERMISSIONS.P2P_TRADE_CREATE,
    PERMISSIONS.P2P_TRADE_READ,
    PERMISSIONS.P2P_TRADE_PAY,
    PERMISSIONS.P2P_TRADE_RELEASE,
    PERMISSIONS.P2P_TRADE_CANCEL,
    PERMISSIONS.P2P_TRADE_DISPUTE,
  ];
  const supportPermissions = [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.WALLET_READ,
    PERMISSIONS.WALLET_WITHDRAW_MANAGE,
    PERMISSIONS.P2P_AD_READ,
    PERMISSIONS.P2P_TRADE_READ,
    PERMISSIONS.P2P_TRADE_RELEASE,
    PERMISSIONS.P2P_TRADE_CANCEL,
    PERMISSIONS.P2P_DISPUTE_RESOLVE,
  ];

  await prisma.rolePermission.createMany({
    data: [
      ...Object.values(PERMISSIONS).map((code) => ({
        roleId: fixtureIds.roles.admin,
        permissionId: permissionIds[code],
      })),
      ...traderPermissions.map((code) => ({
        roleId: fixtureIds.roles.trader,
        permissionId: permissionIds[code],
      })),
      ...supportPermissions.map((code) => ({
        roleId: fixtureIds.roles.support,
        permissionId: permissionIds[code],
      })),
    ],
  });
}

async function seedAssetsAndFiat(prisma: PrismaClient) {
  await prisma.cryptoAsset.createMany({
    data: [
      {
        id: fixtureIds.assets.BTC,
        symbol: "BTC",
        name: "Bitcoin",
        precision: 8,
        isActive: true,
      },
      {
        id: fixtureIds.assets.ETH,
        symbol: "ETH",
        name: "Ethereum",
        precision: 8,
        isActive: true,
      },
      {
        id: fixtureIds.assets.DOGE,
        symbol: "DOGE",
        name: "Dogecoin",
        precision: 8,
        isActive: true,
      },
      {
        id: fixtureIds.assets.USDT,
        symbol: "USDT",
        name: "Tether USD",
        precision: 6,
        isActive: true,
      },
    ],
  });

  await prisma.withdrawalNetwork.createMany({
    data: [
      withdrawalNetwork(
        fixtureIds.withdrawalNetworks.btcBtc,
        fixtureIds.assets.BTC,
        "BTC",
        "Bitcoin",
        "0.0005",
        "0.001",
        "10",
        "^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$",
      ),
      withdrawalNetwork(
        fixtureIds.withdrawalNetworks.ethEth,
        fixtureIds.assets.ETH,
        "ETH",
        "Ethereum (ERC20)",
        "0.002",
        "0.01",
        "100",
        "^0x[a-fA-F0-9]{40}$",
      ),
      withdrawalNetwork(
        fixtureIds.withdrawalNetworks.dogeDoge,
        fixtureIds.assets.DOGE,
        "DOGE",
        "Dogecoin",
        "5",
        "50",
        "1000000",
        "^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$",
      ),
      withdrawalNetwork(
        fixtureIds.withdrawalNetworks.usdtTrx,
        fixtureIds.assets.USDT,
        "TRX",
        "TRON (TRC20)",
        "1",
        "10",
        "100000",
        "^T[1-9A-HJ-NP-Za-km-z]{33}$",
      ),
      withdrawalNetwork(
        fixtureIds.withdrawalNetworks.usdtEth,
        fixtureIds.assets.USDT,
        "ETH",
        "Ethereum (ERC20)",
        "10",
        "50",
        "100000",
        "^0x[a-fA-F0-9]{40}$",
      ),
      withdrawalNetwork(
        fixtureIds.withdrawalNetworks.usdtBsc,
        fixtureIds.assets.USDT,
        "BSC",
        "BNB Smart Chain (BEP20)",
        "0.5",
        "10",
        "100000",
        "^0x[a-fA-F0-9]{40}$",
      ),
    ],
  });

  await prisma.fiatCurrency.createMany({
    data: [
      { id: fixtureIds.fiat.THB, code: "THB", name: "Thai Baht", precision: 2 },
      { id: fixtureIds.fiat.USD, code: "USD", name: "US Dollar", precision: 2 },
    ],
  });
}

async function seedUsers(prisma: PrismaClient) {
  await prisma.user.createMany({
    data: [
      user(fixtureIds.users.buyer, "buyer.e2e@example.com", "E2E Buyer"),
      user(fixtureIds.users.seller, "seller.e2e@example.com", "E2E Seller"),
      user(fixtureIds.users.support, "support.e2e@example.com", "E2E Support"),
      user(fixtureIds.users.admin, "admin.e2e@example.com", "E2E Admin"),
      user(fixtureIds.users.limited, "limited.e2e@example.com", "E2E Limited"),
      user(
        fixtureIds.users.suspended,
        "suspended.e2e@example.com",
        "E2E Suspended",
        UserStatus.SUSPENDED,
      ),
    ],
  });

  await prisma.userRole.createMany({
    data: [
      { userId: fixtureIds.users.buyer, roleId: fixtureIds.roles.trader },
      { userId: fixtureIds.users.seller, roleId: fixtureIds.roles.trader },
      { userId: fixtureIds.users.support, roleId: fixtureIds.roles.support },
      { userId: fixtureIds.users.admin, roleId: fixtureIds.roles.admin },
      { userId: fixtureIds.users.suspended, roleId: fixtureIds.roles.trader },
    ],
  });
}

function withdrawalNetwork(
  id: string,
  assetId: string,
  network: string,
  name: string,
  withdrawFee: string,
  withdrawMin: string,
  withdrawMax: string,
  addressRegex: string,
  requiresTag = false,
) {
  return {
    id,
    assetId,
    network,
    name,
    withdrawFee: d(withdrawFee),
    withdrawMin: d(withdrawMin),
    withdrawMax: d(withdrawMax),
    addressRegex,
    requiresTag,
    isActive: true,
  };
}

function user(
  id: string,
  email: string,
  displayName: string,
  status: UserStatus = UserStatus.ACTIVE,
) {
  return {
    id,
    email,
    passwordHash,
    displayName,
    kycStatus: KycStatus.VERIFIED,
    status,
  };
}

async function seedAccounts(prisma: PrismaClient) {
  const users = Object.values(fixtureIds.users);
  const assets = Object.values(fixtureIds.assets);
  const balances = new Map<string, [string, string]>([
    [`${fixtureIds.users.seller}:${fixtureIds.assets.BTC}`, ["2", "0"]],
    [`${fixtureIds.users.seller}:${fixtureIds.assets.ETH}`, ["5", "0"]],
    [`${fixtureIds.users.seller}:${fixtureIds.assets.DOGE}`, ["10000", "0"]],
    [`${fixtureIds.users.seller}:${fixtureIds.assets.USDT}`, ["5000", "0"]],
    [`${fixtureIds.users.buyer}:${fixtureIds.assets.BTC}`, ["0.1", "0"]],
    [`${fixtureIds.users.buyer}:${fixtureIds.assets.ETH}`, ["1", "0"]],
    [`${fixtureIds.users.buyer}:${fixtureIds.assets.DOGE}`, ["1000", "0"]],
    [`${fixtureIds.users.buyer}:${fixtureIds.assets.USDT}`, ["1000", "0"]],
  ]);

  await prisma.cryptoAccount.createMany({
    data: users.flatMap((userId) =>
      assets.map((assetId) => {
        const [availableBalance, lockedBalance] = balances.get(
          `${userId}:${assetId}`,
        ) ?? ["0", "0"];
        return {
          userId,
          assetId,
          availableBalance: d(availableBalance),
          lockedBalance: d(lockedBalance),
        };
      }),
    ),
  });
}

async function seedPaymentMethods(prisma: PrismaClient) {
  await prisma.paymentMethod.createMany({
    data: [
      {
        id: fixtureIds.paymentMethods.sellerThbBank,
        userId: fixtureIds.users.seller,
        fiatCurrencyId: fixtureIds.fiat.THB,
        type: PaymentMethodType.BANK_ACCOUNT,
        providerName: "Kasikorn Bank",
        accountName: "E2E Seller",
        accountNumber: "111-2-33333-4",
        isActive: true,
      },
      {
        id: fixtureIds.paymentMethods.buyerUsdBank,
        userId: fixtureIds.users.buyer,
        fiatCurrencyId: fixtureIds.fiat.USD,
        type: PaymentMethodType.BANK_ACCOUNT,
        providerName: "Wise USD",
        accountName: "E2E Buyer",
        accountNumber: "WISE-E2E-BUYER",
        isActive: true,
      },
      {
        id: fixtureIds.paymentMethods.sellerUsdBank,
        userId: fixtureIds.users.seller,
        fiatCurrencyId: fixtureIds.fiat.USD,
        type: PaymentMethodType.BANK_ACCOUNT,
        providerName: "Wise USD",
        accountName: "E2E Seller",
        accountNumber: "WISE-E2E-SELLER",
        isActive: true,
      },
    ],
  });
}
