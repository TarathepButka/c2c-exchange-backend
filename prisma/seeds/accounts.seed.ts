import { PrismaClient } from "@prisma/client";
import { ids } from "./seed-data";
import { d } from "./seed-utils";

export async function seedAccounts(prisma: PrismaClient) {
  const zeroUsers = [ids.users.support, ids.users.admin];
  const balances = [
    [ids.users.seller, ids.assets.BTC, "1.0", "0.49"],
    [ids.users.seller, ids.assets.ETH, "9.248", "0.5"],
    [ids.users.seller, ids.assets.XRP, "5010", "0"],
    [ids.users.seller, ids.assets.DOGE, "19000", "1000"],
    [ids.users.seller, ids.assets.USDT, "5000", "0"],
    [ids.users.buyer, ids.assets.BTC, "0.03", "0"],
    [ids.users.buyer, ids.assets.ETH, "1", "0"],
    [ids.users.buyer, ids.assets.XRP, "90", "0"],
    [ids.users.buyer, ids.assets.DOGE, "1000", "0"],
    [ids.users.buyer, ids.assets.USDT, "1000", "0"],
  ];

  for (const [userId, assetId, availableBalance, lockedBalance] of balances) {
    await prisma.cryptoAccount.upsert({
      where: {
        userId_assetId: {
          userId,
          assetId,
        },
      },
      update: {
        availableBalance: d(availableBalance),
        lockedBalance: d(lockedBalance),
      },
      create: {
        userId,
        assetId,
        availableBalance: d(availableBalance),
        lockedBalance: d(lockedBalance),
      },
    });
  }

  for (const userId of zeroUsers) {
    for (const assetId of Object.values(ids.assets)) {
      await prisma.cryptoAccount.upsert({
        where: {
          userId_assetId: {
            userId,
            assetId,
          },
        },
        update: {
          availableBalance: d(0),
          lockedBalance: d(0),
        },
        create: {
          userId,
          assetId,
          availableBalance: d(0),
          lockedBalance: d(0),
        },
      });
    }
  }
}
