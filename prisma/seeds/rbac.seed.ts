import { PrismaClient } from "@prisma/client";
import {
  PERMISSIONS,
  PermissionCode,
} from "../../src/rbac/permissions.constants";
import { ids } from "./seed-data";

const permissionSeedIds = {
  [PERMISSIONS.USERS_READ]: "11000000-0000-0000-0000-000000000001",
  [PERMISSIONS.ASSETS_READ]: "11000000-0000-0000-0000-000000000002",
  [PERMISSIONS.WALLET_READ]: "11000000-0000-0000-0000-000000000003",
  [PERMISSIONS.WALLET_TRANSFER_CREATE]: "11000000-0000-0000-0000-000000000004",
  [PERMISSIONS.WALLET_WITHDRAW_CREATE]: "11000000-0000-0000-0000-000000000005",
  [PERMISSIONS.P2P_AD_CREATE]: "11000000-0000-0000-0000-000000000006",
  [PERMISSIONS.P2P_AD_READ]: "11000000-0000-0000-0000-000000000007",
  [PERMISSIONS.P2P_AD_CANCEL]: "11000000-0000-0000-0000-000000000008",
  [PERMISSIONS.P2P_TRADE_CREATE]: "11000000-0000-0000-0000-000000000009",
  [PERMISSIONS.P2P_TRADE_READ]: "11000000-0000-0000-0000-000000000010",
  [PERMISSIONS.P2P_TRADE_PAY]: "11000000-0000-0000-0000-000000000011",
  [PERMISSIONS.P2P_TRADE_RELEASE]: "11000000-0000-0000-0000-000000000012",
  [PERMISSIONS.P2P_TRADE_CANCEL]: "11000000-0000-0000-0000-000000000013",
  [PERMISSIONS.P2P_TRADE_DISPUTE]: "11000000-0000-0000-0000-000000000014",
  [PERMISSIONS.P2P_DISPUTE_RESOLVE]: "11000000-0000-0000-0000-000000000015",
  [PERMISSIONS.USERS_KYC_VERIFY]: "11000000-0000-0000-0000-000000000016",
  [PERMISSIONS.WALLET_WITHDRAW_MANAGE]: "11000000-0000-0000-0000-000000000017",
} satisfies Record<PermissionCode, string>;

export async function seedRolesAndPermissions(prisma: PrismaClient) {
  const permissionRecords = Object.values(PERMISSIONS).map((code) => ({
    id: permissionSeedIds[code],
    code,
    description: `Allows ${code}`,
  }));

  for (const permission of permissionRecords) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  const roles = [
    { id: ids.roles.admin, code: "admin", name: "Administrator" },
    { id: ids.roles.trader, code: "trader", name: "Trader" },
    { id: ids.roles.support, code: "support", name: "Support" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

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

  await grantRolePermissions(prisma, ids.roles.trader, traderPermissions);
  await grantRolePermissions(prisma, ids.roles.support, supportPermissions);
  await grantRolePermissions(
    prisma,
    ids.roles.admin,
    Object.values(PERMISSIONS),
  );
}

async function grantRolePermissions(
  prisma: PrismaClient,
  roleId: string,
  permissionCodes: string[],
) {
  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionCodes } },
  });

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId,
        permissionId: permission.id,
      },
    });
  }
}
