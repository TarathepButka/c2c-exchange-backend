import { KycStatus, PrismaClient, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { ids } from "./seed-data";

const passwordHash = bcrypt.hashSync("password123", 10);

export async function seedUsers(prisma: PrismaClient) {
  const users = [
    {
      id: ids.users.buyer,
      email: "buyer@example.com",
      displayName: "Demo Buyer",
      roleId: ids.roles.trader,
    },
    {
      id: ids.users.seller,
      email: "seller@example.com",
      displayName: "Demo Seller",
      roleId: ids.roles.trader,
    },
    {
      id: ids.users.support,
      email: "support@example.com",
      displayName: "Demo Support",
      roleId: ids.roles.support,
    },
    {
      id: ids.users.admin,
      email: "admin@example.com",
      displayName: "Demo Admin",
      roleId: ids.roles.admin,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash,
        displayName: user.displayName,
        kycStatus: KycStatus.VERIFIED,
        status: UserStatus.ACTIVE,
      },
      create: {
        id: user.id,
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        kycStatus: KycStatus.VERIFIED,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: user.roleId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: user.roleId,
      },
    });
  }
}
