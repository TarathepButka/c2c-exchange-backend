import {
  FiatPaymentStatus,
  LedgerBalanceType,
  LedgerEntryDirection,
  LedgerTransactionType,
  P2PAdSide,
  P2PAdStatus,
  P2PTradeStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { fixtureIds } from "./ids.fixture";

const d = (value: string | number) => new Prisma.Decimal(value);

export async function seedActiveSellAdFixture(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    const account = await tx.cryptoAccount.update({
      where: {
        userId_assetId: {
          userId: fixtureIds.users.seller,
          assetId: fixtureIds.assets.BTC,
        },
      },
      data: {
        availableBalance: { decrement: d("0.5") },
        lockedBalance: { increment: d("0.5") },
      },
    });

    await tx.p2PAd.create({
      data: {
        id: fixtureIds.ads.sellBtcThb,
        makerUserId: fixtureIds.users.seller,
        assetId: fixtureIds.assets.BTC,
        fiatCurrencyId: fixtureIds.fiat.THB,
        paymentMethodId: fixtureIds.paymentMethods.sellerThbBank,
        side: P2PAdSide.SELL,
        price: d(1000000),
        totalCryptoAmount: d("0.5"),
        remainingCryptoAmount: d("0.5"),
        minFiatAmount: d(1000),
        maxFiatAmount: d(500000),
        status: P2PAdStatus.ACTIVE,
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        id: fixtureIds.ledgers.sellAdLock,
        type: LedgerTransactionType.ESCROW_LOCK,
        referenceType: "p2p_ad",
        referenceId: fixtureIds.ads.sellBtcThb,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: fixtureIds.ledgers.sellAdLock,
        cryptoAccountId: account.id,
        direction: LedgerEntryDirection.DEBIT,
        balanceType: LedgerBalanceType.AVAILABLE,
        amount: d("0.5"),
        balanceAfter: d("1.5"),
      },
    });
    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: fixtureIds.ledgers.sellAdLock,
        cryptoAccountId: account.id,
        direction: LedgerEntryDirection.CREDIT,
        balanceType: LedgerBalanceType.LOCKED,
        amount: d("0.5"),
        balanceAfter: d("0.5"),
      },
    });
  });
}

export async function seedActiveBuyAdFixture(prisma: PrismaClient) {
  await prisma.p2PAd.create({
    data: {
      id: fixtureIds.ads.buyEthUsd,
      makerUserId: fixtureIds.users.buyer,
      assetId: fixtureIds.assets.ETH,
      fiatCurrencyId: fixtureIds.fiat.USD,
      paymentMethodId: fixtureIds.paymentMethods.buyerUsdBank,
      side: P2PAdSide.BUY,
      price: d(3000),
      totalCryptoAmount: d("1"),
      remainingCryptoAmount: d("1"),
      minFiatAmount: d(100),
      maxFiatAmount: d(3000),
      status: P2PAdStatus.ACTIVE,
    },
  });
}

export async function seedPendingTradeFixture(prisma: PrismaClient) {
  await seedActiveSellAdFixture(prisma);
  await prisma.$transaction(async (tx) => {
    await tx.p2PAd.update({
      where: { id: fixtureIds.ads.sellBtcThb },
      data: { remainingCryptoAmount: { decrement: d("0.1") } },
    });

    await tx.p2PTrade.create({
      data: {
        id: fixtureIds.trades.pendingBtc,
        adId: fixtureIds.ads.sellBtcThb,
        buyerUserId: fixtureIds.users.buyer,
        sellerUserId: fixtureIds.users.seller,
        cryptoAmount: d("0.1"),
        fiatAmount: d(100000),
        price: d(1000000),
        status: P2PTradeStatus.PENDING_PAYMENT,
      },
    });
  });
}

export async function seedPaidTradeFixture(prisma: PrismaClient) {
  await seedActiveSellAdFixture(prisma);
  await prisma.$transaction(async (tx) => {
    await tx.p2PAd.update({
      where: { id: fixtureIds.ads.sellBtcThb },
      data: { remainingCryptoAmount: { decrement: d("0.1") } },
    });

    await tx.p2PTrade.create({
      data: {
        id: fixtureIds.trades.paidBtc,
        adId: fixtureIds.ads.sellBtcThb,
        buyerUserId: fixtureIds.users.buyer,
        sellerUserId: fixtureIds.users.seller,
        cryptoAmount: d("0.1"),
        fiatAmount: d(100000),
        price: d(1000000),
        status: P2PTradeStatus.PAID,
        paidAt: new Date("2026-07-04T00:00:00.000Z"),
      },
    });

    await tx.fiatPayment.create({
      data: {
        id: fixtureIds.fiatPayments.paidBtc,
        tradeId: fixtureIds.trades.paidBtc,
        paymentMethodId: fixtureIds.paymentMethods.sellerThbBank,
        amount: d(100000),
        proofUrl: "https://example.test/proofs/paid-btc.jpg",
        status: FiatPaymentStatus.SUBMITTED,
        paidAt: new Date("2026-07-04T00:00:00.000Z"),
      },
    });
  });
}

export async function seedDisputedTradeFixture(prisma: PrismaClient) {
  await seedPaidTradeFixture(prisma);
  await prisma.p2PTrade.update({
    where: { id: fixtureIds.trades.paidBtc },
    data: {
      id: fixtureIds.trades.disputedBtc,
      status: P2PTradeStatus.DISPUTED,
      disputedAt: new Date("2026-07-04T00:15:00.000Z"),
    },
  });
  await prisma.fiatPayment.update({
    where: { id: fixtureIds.fiatPayments.paidBtc },
    data: {
      id: fixtureIds.fiatPayments.disputedBtc,
      tradeId: fixtureIds.trades.disputedBtc,
    },
  });
}
