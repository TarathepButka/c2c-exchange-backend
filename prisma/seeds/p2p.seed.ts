import {
  FiatPaymentStatus,
  P2PAdSide,
  P2PAdStatus,
  P2PTradeStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { ids } from "./seed-data";
import { d } from "./seed-utils";

export async function seedAdsTradesAndPayments(prisma: PrismaClient) {
  await prisma.p2PAd.upsert({
    where: { id: ids.ads.sellBtcThb },
    update: {
      makerUserId: ids.users.seller,
      assetId: ids.assets.BTC,
      fiatCurrencyId: ids.fiat.THB,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      side: P2PAdSide.SELL,
      price: d(2500000),
      totalCryptoAmount: d("0.5"),
      remainingCryptoAmount: d("0.39"),
      minFiatAmount: d(1000),
      maxFiatAmount: d(150000),
      status: P2PAdStatus.ACTIVE,
    },
    create: {
      id: ids.ads.sellBtcThb,
      makerUserId: ids.users.seller,
      assetId: ids.assets.BTC,
      fiatCurrencyId: ids.fiat.THB,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      side: P2PAdSide.SELL,
      price: d(2500000),
      totalCryptoAmount: d("0.5"),
      remainingCryptoAmount: d("0.39"),
      minFiatAmount: d(1000),
      maxFiatAmount: d(150000),
      status: P2PAdStatus.ACTIVE,
    },
  });

  await prisma.p2PAd.upsert({
    where: { id: ids.ads.buyEthUsd },
    update: {
      makerUserId: ids.users.buyer,
      assetId: ids.assets.ETH,
      fiatCurrencyId: ids.fiat.USD,
      paymentMethodId: ids.paymentMethods.buyerUsdBank,
      side: P2PAdSide.BUY,
      price: d(3000),
      totalCryptoAmount: d(2),
      remainingCryptoAmount: d("1.5"),
      minFiatAmount: d(100),
      maxFiatAmount: d(6000),
      status: P2PAdStatus.ACTIVE,
    },
    create: {
      id: ids.ads.buyEthUsd,
      makerUserId: ids.users.buyer,
      assetId: ids.assets.ETH,
      fiatCurrencyId: ids.fiat.USD,
      paymentMethodId: ids.paymentMethods.buyerUsdBank,
      side: P2PAdSide.BUY,
      price: d(3000),
      totalCryptoAmount: d(2),
      remainingCryptoAmount: d("1.5"),
      minFiatAmount: d(100),
      maxFiatAmount: d(6000),
      status: P2PAdStatus.ACTIVE,
    },
  });

  await prisma.p2PAd.upsert({
    where: { id: ids.ads.sellDogeThb },
    update: {
      makerUserId: ids.users.seller,
      assetId: ids.assets.DOGE,
      fiatCurrencyId: ids.fiat.THB,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      side: P2PAdSide.SELL,
      price: d("3.5"),
      totalCryptoAmount: d(1000),
      remainingCryptoAmount: d(1000),
      minFiatAmount: d(100),
      maxFiatAmount: d(3500),
      status: P2PAdStatus.ACTIVE,
    },
    create: {
      id: ids.ads.sellDogeThb,
      makerUserId: ids.users.seller,
      assetId: ids.assets.DOGE,
      fiatCurrencyId: ids.fiat.THB,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      side: P2PAdSide.SELL,
      price: d("3.5"),
      totalCryptoAmount: d(1000),
      remainingCryptoAmount: d(1000),
      minFiatAmount: d(100),
      maxFiatAmount: d(3500),
      status: P2PAdStatus.ACTIVE,
    },
  });

  const paidAt = new Date("2026-07-03T08:00:00.000Z");
  await upsertTrade(prisma, ids.trades.completedBtc, {
    adId: ids.ads.sellBtcThb,
    buyerUserId: ids.users.buyer,
    sellerUserId: ids.users.seller,
    cryptoAmount: d("0.01"),
    fiatAmount: d(25000),
    price: d(2500000),
    status: P2PTradeStatus.RELEASED,
    paidAt,
    releasedAt: new Date("2026-07-03T08:15:00.000Z"),
  });

  await upsertTrade(prisma, ids.trades.pendingBtc, {
    adId: ids.ads.sellBtcThb,
    buyerUserId: ids.users.buyer,
    sellerUserId: ids.users.seller,
    cryptoAmount: d("0.05"),
    fiatAmount: d(125000),
    price: d(2500000),
    status: P2PTradeStatus.PENDING_PAYMENT,
  });

  await upsertTrade(prisma, ids.trades.disputedBtc, {
    adId: ids.ads.sellBtcThb,
    buyerUserId: ids.users.buyer,
    sellerUserId: ids.users.seller,
    cryptoAmount: d("0.05"),
    fiatAmount: d(125000),
    price: d(2500000),
    status: P2PTradeStatus.DISPUTED,
    paidAt: new Date("2026-07-03T09:00:00.000Z"),
    disputedAt: new Date("2026-07-03T09:30:00.000Z"),
  });

  await upsertTrade(prisma, ids.trades.pendingEth, {
    adId: ids.ads.buyEthUsd,
    buyerUserId: ids.users.buyer,
    sellerUserId: ids.users.seller,
    cryptoAmount: d("0.5"),
    fiatAmount: d(1500),
    price: d(3000),
    status: P2PTradeStatus.PENDING_PAYMENT,
  });

  await prisma.fiatPayment.upsert({
    where: { id: ids.fiatPayments.completedBtc },
    update: {
      tradeId: ids.trades.completedBtc,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      amount: d(25000),
      proofUrl: "https://example.com/proofs/completed-btc.jpg",
      status: FiatPaymentStatus.ACCEPTED,
      paidAt,
    },
    create: {
      id: ids.fiatPayments.completedBtc,
      tradeId: ids.trades.completedBtc,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      amount: d(25000),
      proofUrl: "https://example.com/proofs/completed-btc.jpg",
      status: FiatPaymentStatus.ACCEPTED,
      paidAt,
    },
  });

  await prisma.fiatPayment.upsert({
    where: { id: ids.fiatPayments.disputedBtc },
    update: {
      tradeId: ids.trades.disputedBtc,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      amount: d(125000),
      proofUrl: "https://example.com/proofs/disputed-btc.jpg",
      status: FiatPaymentStatus.SUBMITTED,
      paidAt: new Date("2026-07-03T09:00:00.000Z"),
    },
    create: {
      id: ids.fiatPayments.disputedBtc,
      tradeId: ids.trades.disputedBtc,
      paymentMethodId: ids.paymentMethods.sellerThbBank,
      amount: d(125000),
      proofUrl: "https://example.com/proofs/disputed-btc.jpg",
      status: FiatPaymentStatus.SUBMITTED,
      paidAt: new Date("2026-07-03T09:00:00.000Z"),
    },
  });
}

async function upsertTrade(
  prisma: PrismaClient,
  id: string,
  data: {
    adId: string;
    buyerUserId: string;
    sellerUserId: string;
    cryptoAmount: Prisma.Decimal;
    fiatAmount: Prisma.Decimal;
    price: Prisma.Decimal;
    status: P2PTradeStatus;
    paidAt?: Date;
    releasedAt?: Date;
    disputedAt?: Date;
  },
) {
  await prisma.p2PTrade.upsert({
    where: { id },
    update: {
      ...data,
      paidAt: data.paidAt ?? null,
      releasedAt: data.releasedAt ?? null,
      disputedAt: data.disputedAt ?? null,
      cancelledAt: null,
    },
    create: {
      id,
      ...data,
      paidAt: data.paidAt ?? null,
      releasedAt: data.releasedAt ?? null,
      disputedAt: data.disputedAt ?? null,
    },
  });
}
