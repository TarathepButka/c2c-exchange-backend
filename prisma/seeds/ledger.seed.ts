import {
  LedgerBalanceType,
  LedgerEntryDirection,
  LedgerTransactionType,
  PrismaClient,
  TransferStatus,
  WithdrawalStatus,
} from "@prisma/client";
import { ids } from "./seed-data";
import { d } from "./seed-utils";

export async function seedLedgerAndMovements(prisma: PrismaClient) {
  await upsertInternalTransfer(prisma);
  await upsertExternalWithdrawal(prisma);

  const account = async (userId: string, assetId: string) =>
    prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: {
          userId,
          assetId,
        },
      },
    });

  const sellerBtc = await account(ids.users.seller, ids.assets.BTC);
  const buyerBtc = await account(ids.users.buyer, ids.assets.BTC);
  const sellerEth = await account(ids.users.seller, ids.assets.ETH);
  const buyerXrp = await account(ids.users.buyer, ids.assets.XRP);
  const sellerXrp = await account(ids.users.seller, ids.assets.XRP);
  const sellerDoge = await account(ids.users.seller, ids.assets.DOGE);
  const sellerUsdt = await account(ids.users.seller, ids.assets.USDT);
  const buyerUsdt = await account(ids.users.buyer, ids.assets.USDT);

  await upsertLedgerTransaction(
    prisma,
    "a0000000-0000-0000-0000-000000000001",
    {
      type: LedgerTransactionType.SEED,
      referenceType: "seed",
      entries: [
        [
          sellerBtc.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "1.5",
          "1.5",
        ],
        [
          sellerEth.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "10",
          "10",
        ],
        [
          sellerXrp.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "5000",
          "5000",
        ],
        [
          sellerDoge.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "20000",
          "20000",
        ],
        [
          sellerUsdt.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "5000",
          "5000",
        ],
        [
          buyerBtc.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "0.02",
          "0.02",
        ],
        [
          buyerXrp.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "100",
          "100",
        ],
        [
          buyerUsdt.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "1000",
          "1000",
        ],
      ],
    },
  );

  await upsertLedgerTransaction(
    prisma,
    "a0000000-0000-0000-0000-000000000002",
    {
      type: LedgerTransactionType.ESCROW_LOCK,
      referenceType: "p2p_ad",
      referenceId: ids.ads.sellBtcThb,
      entries: [
        [
          sellerBtc.id,
          LedgerEntryDirection.DEBIT,
          LedgerBalanceType.AVAILABLE,
          "0.5",
          "1.0",
        ],
        [
          sellerBtc.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.LOCKED,
          "0.5",
          "0.5",
        ],
      ],
    },
  );

  await upsertLedgerTransaction(
    prisma,
    "a0000000-0000-0000-0000-000000000003",
    {
      type: LedgerTransactionType.ESCROW_RELEASE,
      referenceType: "p2p_trade",
      referenceId: ids.trades.completedBtc,
      entries: [
        [
          sellerBtc.id,
          LedgerEntryDirection.DEBIT,
          LedgerBalanceType.LOCKED,
          "0.01",
          "0.49",
        ],
        [
          buyerBtc.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "0.01",
          "0.03",
        ],
      ],
    },
  );

  await upsertLedgerTransaction(
    prisma,
    "a0000000-0000-0000-0000-000000000004",
    {
      type: LedgerTransactionType.ESCROW_LOCK,
      referenceType: "p2p_ad",
      referenceId: ids.ads.sellDogeThb,
      entries: [
        [
          sellerDoge.id,
          LedgerEntryDirection.DEBIT,
          LedgerBalanceType.AVAILABLE,
          "1000",
          "19000",
        ],
        [
          sellerDoge.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.LOCKED,
          "1000",
          "1000",
        ],
      ],
    },
  );

  await upsertLedgerTransaction(
    prisma,
    "a0000000-0000-0000-0000-000000000005",
    {
      type: LedgerTransactionType.ESCROW_LOCK,
      referenceType: "p2p_trade",
      referenceId: ids.trades.pendingEth,
      entries: [
        [
          sellerEth.id,
          LedgerEntryDirection.DEBIT,
          LedgerBalanceType.AVAILABLE,
          "0.5",
          "9.5",
        ],
        [
          sellerEth.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.LOCKED,
          "0.5",
          "0.5",
        ],
      ],
    },
  );

  await upsertLedgerTransaction(
    prisma,
    "a0000000-0000-0000-0000-000000000006",
    {
      type: LedgerTransactionType.INTERNAL_TRANSFER,
      referenceType: "internal_transfer",
      referenceId: ids.transfers.buyerXrpToSeller,
      entries: [
        [
          buyerXrp.id,
          LedgerEntryDirection.DEBIT,
          LedgerBalanceType.AVAILABLE,
          "10",
          "90",
        ],
        [
          sellerXrp.id,
          LedgerEntryDirection.CREDIT,
          LedgerBalanceType.AVAILABLE,
          "10",
          "5010",
        ],
      ],
    },
  );

  await upsertLedgerTransaction(
    prisma,
    "a0000000-0000-0000-0000-000000000007",
    {
      type: LedgerTransactionType.EXTERNAL_WITHDRAWAL,
      referenceType: "external_withdrawal",
      referenceId: ids.withdrawals.sellerEth,
      entries: [
        [
          sellerEth.id,
          LedgerEntryDirection.DEBIT,
          LedgerBalanceType.AVAILABLE,
          "0.252",
          "9.248",
        ],
      ],
    },
  );

  await prisma.internalTransfer.update({
    where: { id: ids.transfers.buyerXrpToSeller },
    data: { ledgerTransactionId: "a0000000-0000-0000-0000-000000000006" },
  });
  await prisma.externalWithdrawal.update({
    where: { id: ids.withdrawals.sellerEth },
    data: { ledgerTransactionId: "a0000000-0000-0000-0000-000000000007" },
  });
}

async function upsertInternalTransfer(prisma: PrismaClient) {
  await prisma.internalTransfer.upsert({
    where: { id: ids.transfers.buyerXrpToSeller },
    update: {
      senderUserId: ids.users.buyer,
      receiverUserId: ids.users.seller,
      assetId: ids.assets.XRP,
      amount: d(10),
      status: TransferStatus.COMPLETED,
      ledgerTransactionId: null,
    },
    create: {
      id: ids.transfers.buyerXrpToSeller,
      senderUserId: ids.users.buyer,
      receiverUserId: ids.users.seller,
      assetId: ids.assets.XRP,
      amount: d(10),
      status: TransferStatus.COMPLETED,
    },
  });
}

async function upsertExternalWithdrawal(prisma: PrismaClient) {
  const completedAt = new Date("2026-07-03T10:00:00.000Z");

  await prisma.externalWithdrawal.upsert({
    where: { id: ids.withdrawals.sellerEth },
    update: {
      userId: ids.users.seller,
      assetId: ids.assets.ETH,
      amount: d("0.25"),
      network: "ETH",
      networkFee: d("0.002"),
      destinationAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      addressTag: null,
      withdrawOrderId: "seed-seller-eth-001",
      txHash: "0xseededwithdrawalhash",
      failureReason: null,
      completedAt,
      status: WithdrawalStatus.COMPLETED,
      ledgerTransactionId: null,
    },
    create: {
      id: ids.withdrawals.sellerEth,
      userId: ids.users.seller,
      assetId: ids.assets.ETH,
      amount: d("0.25"),
      network: "ETH",
      networkFee: d("0.002"),
      destinationAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      addressTag: null,
      withdrawOrderId: "seed-seller-eth-001",
      txHash: "0xseededwithdrawalhash",
      failureReason: null,
      completedAt,
      status: WithdrawalStatus.COMPLETED,
    },
  });
}

async function upsertLedgerTransaction(
  prisma: PrismaClient,
  id: string,
  input: {
    type: LedgerTransactionType;
    referenceType: string;
    referenceId?: string;
    entries: Array<
      [string, LedgerEntryDirection, LedgerBalanceType, string, string]
    >;
  },
) {
  await prisma.ledgerTransaction.upsert({
    where: { id },
    update: {
      type: input.type,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
    create: {
      id,
      type: input.type,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
  });

  for (const [index, entry] of input.entries.entries()) {
    const [cryptoAccountId, direction, balanceType, amount, balanceAfter] =
      entry;
    const entryId = `b0000000-0000-0000-0000-${id.slice(-11)}${index + 1}`;
    await prisma.ledgerEntry.upsert({
      where: { id: entryId },
      update: {
        ledgerTransactionId: id,
        cryptoAccountId,
        direction,
        balanceType,
        amount: d(amount),
        balanceAfter: d(balanceAfter),
      },
      create: {
        id: entryId,
        ledgerTransactionId: id,
        cryptoAccountId,
        direction,
        balanceType,
        amount: d(amount),
        balanceAfter: d(balanceAfter),
      },
    });
  }
}
