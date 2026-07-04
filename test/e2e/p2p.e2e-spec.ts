import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { Response } from "supertest";
import request from "supertest";
import { fixtureIds } from "./fixtures/ids.fixture";
import {
  seedActiveBuyAdFixture,
  seedActiveSellAdFixture,
  seedPaidTradeFixture,
  seedPendingTradeFixture,
} from "./fixtures/p2p.fixture";
import { createE2eApp } from "./helpers/app";
import { bearer, issueTokenForUser } from "./helpers/auth";
import { expectNoPasswordHash } from "./helpers/assertions";
import { createE2ePrisma, resetAndSeedBase } from "./helpers/db";

type AdBody = {
  id: string;
  side: string;
  status: string;
  remainingCryptoAmount: string;
  asset: { symbol: string };
  fiatCurrency: { code: string };
};

describe("P2P API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let buyerToken: string;
  let sellerToken: string;
  let supportToken: string;
  let adminToken: string;

  beforeAll(async () => {
    prisma = createE2ePrisma();
    app = await createE2eApp();
  });

  beforeEach(async () => {
    await resetAndSeedBase(prisma);
    buyerToken = await issueTokenForUser(prisma, fixtureIds.users.buyer);
    sellerToken = await issueTokenForUser(prisma, fixtureIds.users.seller);
    supportToken = await issueTokenForUser(prisma, fixtureIds.users.support);
    adminToken = await issueTokenForUser(prisma, fixtureIds.users.admin);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("lists active ads with filters and pagination validation", async () => {
    await seedActiveSellAdFixture(prisma);
    await seedActiveBuyAdFixture(prisma);

    const response = await request(app.getHttpServer())
      .get(
        "/api/v1/p2p/ads?assetSymbol=BTC&fiatCode=THB&side=SELL&page=1&pageSize=10",
      )
      .set("Authorization", bearer(buyerToken))
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: fixtureIds.ads.sellBtcThb,
      side: "SELL",
      status: "ACTIVE",
      asset: { symbol: "BTC" },
      fiatCurrency: { code: "THB" },
    });
    expectNoPasswordHash(response.body);

    await request(app.getHttpServer())
      .get("/api/v1/p2p/ads?assetSymbol=")
      .set("Authorization", bearer(buyerToken))
      .expect(400);
  });

  it("creates a sell ad and locks seller crypto in escrow", async () => {
    const before = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({
        assetSymbol: "BTC",
        fiatCode: "THB",
        side: "SELL",
        price: "1000000",
        totalCryptoAmount: "0.25",
        minFiatAmount: "1000",
        maxFiatAmount: "250000",
        paymentMethodId: fixtureIds.paymentMethods.sellerThbBank,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      side: "SELL",
      status: "ACTIVE",
      remainingCryptoAmount: "0.25",
    });
    expectNoPasswordHash(response.body);

    const after = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );
    expect(
      after.availableBalance.minus(before.availableBalance).toString(),
    ).toBe("-0.25");
    expect(after.lockedBalance.minus(before.lockedBalance).toString()).toBe(
      "0.25",
    );

    const ledgerCount = await prisma.ledgerEntry.count({
      where: {
        ledgerTransaction: {
          referenceType: "p2p_ad",
          referenceId: response.body.id,
        },
      },
    });
    expect(ledgerCount).toBe(2);
  });

  it("rejects invalid ad creation payloads and business rules", async () => {
    const basePayload = {
      assetSymbol: "BTC",
      fiatCode: "THB",
      side: "SELL",
      price: "1000000",
      totalCryptoAmount: "0.25",
      minFiatAmount: "1000",
      maxFiatAmount: "250000",
      paymentMethodId: fixtureIds.paymentMethods.sellerThbBank,
    };

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({ ...basePayload, unexpected: true })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({ ...basePayload, totalCryptoAmount: "0" })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({
        ...basePayload,
        minFiatAmount: "300000",
        maxFiatAmount: "250000",
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({
        ...basePayload,
        paymentMethodId: fixtureIds.paymentMethods.buyerUsdBank,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({
        ...basePayload,
        paymentMethodId: fixtureIds.paymentMethods.sellerUsdBank,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({ ...basePayload, assetSymbol: "NOPE" })
      .expect(404);

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({
        ...basePayload,
        totalCryptoAmount: "100",
        maxFiatAmount: "100000000",
      })
      .expect(400);
  });

  it("creates trades from active ads and rejects invalid trade attempts", async () => {
    await seedActiveSellAdFixture(prisma);

    const trade = await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/trades`)
      .set("Authorization", bearer(buyerToken))
      .send({ cryptoAmount: "0.1" })
      .expect(201);

    expect(trade.body).toMatchObject({
      buyerUserId: fixtureIds.users.buyer,
      sellerUserId: fixtureIds.users.seller,
      status: "PENDING_PAYMENT",
      cryptoAmount: "0.1",
      fiatAmount: "100000",
    });

    const ad = (await prisma.p2PAd.findUniqueOrThrow({
      where: { id: fixtureIds.ads.sellBtcThb },
    })) as unknown as AdBody;
    expect(ad.remainingCryptoAmount.toString()).toBe("0.4");

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/trades`)
      .set("Authorization", bearer(sellerToken))
      .send({ cryptoAmount: "0.1" })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/trades`)
      .set("Authorization", bearer(buyerToken))
      .send({ cryptoAmount: "0.0001" })
      .expect(400);

    await prisma.p2PAd.update({
      where: { id: fixtureIds.ads.sellBtcThb },
      data: { status: "CANCELLED" },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/trades`)
      .set("Authorization", bearer(buyerToken))
      .send({ cryptoAmount: "0.1" })
      .expect(404);
  });

  it("submits fiat payment and releases escrow with balance and ledger invariants", async () => {
    await seedPendingTradeFixture(prisma);

    const paid = await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.pendingBtc}/payments`)
      .set("Authorization", bearer(buyerToken))
      .send({ proofUrl: "https://example.test/proofs/payment.jpg" })
      .expect(201);

    expect(paid.body.status).toBe("PAID");
    expect(paid.body.fiatPayments).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.pendingBtc}/payments`)
      .set("Authorization", bearer(buyerToken))
      .send({ proofUrl: "https://example.test/proofs/payment-2.jpg" })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.pendingBtc}/releases`)
      .set("Authorization", bearer(buyerToken))
      .expect(403);

    const buyerBefore = await getAccount(
      fixtureIds.users.buyer,
      fixtureIds.assets.BTC,
    );
    const sellerBefore = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );

    const released = await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.pendingBtc}/releases`)
      .set("Authorization", bearer(sellerToken))
      .expect(201);

    expect(released.body.status).toBe("RELEASED");
    expect(released.body.fiatPayments[0].status).toBe("ACCEPTED");

    const buyerAfter = await getAccount(
      fixtureIds.users.buyer,
      fixtureIds.assets.BTC,
    );
    const sellerAfter = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );
    expect(
      buyerAfter.availableBalance
        .minus(buyerBefore.availableBalance)
        .toString(),
    ).toBe("0.1");
    expect(
      sellerAfter.lockedBalance.minus(sellerBefore.lockedBalance).toString(),
    ).toBe("-0.1");

    const ledgerEntries = await prisma.ledgerEntry.count({
      where: {
        ledgerTransaction: {
          type: "ESCROW_RELEASE",
          referenceType: "p2p_trade",
          referenceId: fixtureIds.trades.pendingBtc,
        },
      },
    });
    expect(ledgerEntries).toBe(2);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.pendingBtc}/releases`)
      .set("Authorization", bearer(sellerToken))
      .expect(403);
  });

  it("cancels pending trades and restores ad capacity", async () => {
    await seedPendingTradeFixture(prisma);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.pendingBtc}/cancellations`)
      .set("Authorization", bearer(buyerToken))
      .expect(201)
      .expect((response: Response) => {
        const { body } = response;
        expect(body.status).toBe("CANCELLED");
      });

    const ad = await prisma.p2PAd.findUniqueOrThrow({
      where: { id: fixtureIds.ads.sellBtcThb },
    });
    expect(ad.remainingCryptoAmount.toString()).toBe("0.5");
    expect(ad.status).toBe("ACTIVE");
  });

  it("rejects paid-trade cancellation and resolves disputes by support refund", async () => {
    await seedPaidTradeFixture(prisma);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.paidBtc}/cancellations`)
      .set("Authorization", bearer(buyerToken))
      .expect(400);

    const disputed = await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.paidBtc}/disputes`)
      .set("Authorization", bearer(buyerToken))
      .expect(201);
    expect(disputed.body.status).toBe("DISPUTED");

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.paidBtc}/cancellations`)
      .set("Authorization", bearer(sellerToken))
      .expect(403);

    const sellerBefore = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );
    const refunded = await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${fixtureIds.trades.paidBtc}/cancellations`)
      .set("Authorization", bearer(supportToken))
      .expect(201);

    expect(refunded.body.status).toBe("CANCELLED");
    expect(refunded.body.fiatPayments[0].status).toBe("REJECTED");

    const sellerAfter = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );
    expect(
      sellerAfter.lockedBalance.minus(sellerBefore.lockedBalance).toString(),
    ).toBe("-0.1");
    expect(
      sellerAfter.availableBalance
        .minus(sellerBefore.availableBalance)
        .toString(),
    ).toBe("0.1");
  });

  it("protects trade details from nonparticipants and allows support access", async () => {
    await seedPaidTradeFixture(prisma);

    const outsider = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "outsider.e2e@example.com",
        password: "StrongPass123",
        displayName: "Outsider",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/p2p/trades/${fixtureIds.trades.paidBtc}`)
      .set("Authorization", bearer(outsider.body.accessToken))
      .expect(403);

    const supportView = await request(app.getHttpServer())
      .get(`/api/v1/p2p/trades/${fixtureIds.trades.paidBtc}`)
      .set("Authorization", bearer(supportToken))
      .expect(200);
    expect(supportView.body.id).toBe(fixtureIds.trades.paidBtc);
    expectNoPasswordHash(supportView.body);
  });

  it("cancels a sell ad directly and refunds remaining escrow", async () => {
    await seedActiveSellAdFixture(prisma);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/cancellations`)
      .set("Authorization", bearer(buyerToken))
      .expect(403);

    const sellerBefore = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/cancellations`)
      .set("Authorization", bearer(sellerToken))
      .expect(201);

    expect(cancelled.body.status).toBe("CANCELLED");
    expect(cancelled.body.remainingCryptoAmount).toBe("0");

    const sellerAfter = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.BTC,
    );
    expect(
      sellerAfter.availableBalance
        .minus(sellerBefore.availableBalance)
        .toString(),
    ).toBe("0.5");
    expect(
      sellerAfter.lockedBalance.minus(sellerBefore.lockedBalance).toString(),
    ).toBe("-0.5");

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/trades`)
      .set("Authorization", bearer(buyerToken))
      .send({ cryptoAmount: "0.1" })
      .expect(404);
  });

  it("lets admin cancel another maker ad through dispute-resolver permission", async () => {
    await seedActiveSellAdFixture(prisma);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/cancellations`)
      .set("Authorization", bearer(adminToken))
      .expect(201)
      .expect((response: Response) => {
        expect(response.body.status).toBe("CANCELLED");
      });
  });

  it("handles BUY-ad trade escrow, fiat payment, and release", async () => {
    await seedActiveBuyAdFixture(prisma);

    const sellerBeforeTrade = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.ETH,
    );
    const trade = await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.buyEthUsd}/trades`)
      .set("Authorization", bearer(sellerToken))
      .send({ cryptoAmount: "0.5" })
      .expect(201);

    expect(trade.body).toMatchObject({
      buyerUserId: fixtureIds.users.buyer,
      sellerUserId: fixtureIds.users.seller,
      status: "PENDING_PAYMENT",
      cryptoAmount: "0.5",
      fiatAmount: "1500",
    });

    const sellerAfterTrade = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.ETH,
    );
    expect(
      sellerAfterTrade.availableBalance
        .minus(sellerBeforeTrade.availableBalance)
        .toString(),
    ).toBe("-0.5");
    expect(
      sellerAfterTrade.lockedBalance
        .minus(sellerBeforeTrade.lockedBalance)
        .toString(),
    ).toBe("0.5");

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${trade.body.id}/payments`)
      .set("Authorization", bearer(sellerToken))
      .send({ proofUrl: "https://example.test/proofs/wrong-party.jpg" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${trade.body.id}/payments`)
      .set("Authorization", bearer(buyerToken))
      .send({
        proofUrl: "https://example.test/proofs/buy-ad-wrong-currency.jpg",
        paymentMethodId: fixtureIds.paymentMethods.sellerThbBank,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${trade.body.id}/payments`)
      .set("Authorization", bearer(buyerToken))
      .send({
        proofUrl: "https://example.test/proofs/buy-ad-payment.jpg",
        paymentMethodId: fixtureIds.paymentMethods.sellerUsdBank,
      })
      .expect(201)
      .expect((response: Response) => {
        expect(response.body.status).toBe("PAID");
      });

    const buyerBeforeRelease = await getAccount(
      fixtureIds.users.buyer,
      fixtureIds.assets.ETH,
    );
    const sellerBeforeRelease = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.ETH,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${trade.body.id}/releases`)
      .set("Authorization", bearer(sellerToken))
      .expect(201)
      .expect((response: Response) => {
        expect(response.body.status).toBe("RELEASED");
        expect(response.body.fiatPayments[0].status).toBe("ACCEPTED");
      });

    const buyerAfterRelease = await getAccount(
      fixtureIds.users.buyer,
      fixtureIds.assets.ETH,
    );
    const sellerAfterRelease = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.ETH,
    );
    expect(
      buyerAfterRelease.availableBalance
        .minus(buyerBeforeRelease.availableBalance)
        .toString(),
    ).toBe("0.5");
    expect(
      sellerAfterRelease.lockedBalance
        .minus(sellerBeforeRelease.lockedBalance)
        .toString(),
    ).toBe("-0.5");
  });

  it("cancels pending BUY-ad trades and unlocks seller escrow", async () => {
    await seedActiveBuyAdFixture(prisma);

    const trade = await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.buyEthUsd}/trades`)
      .set("Authorization", bearer(sellerToken))
      .send({ cryptoAmount: "0.25" })
      .expect(201);

    const sellerBeforeCancel = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.ETH,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/trades/${trade.body.id}/cancellations`)
      .set("Authorization", bearer(sellerToken))
      .expect(201)
      .expect((response: Response) => {
        expect(response.body.status).toBe("CANCELLED");
      });

    const sellerAfterCancel = await getAccount(
      fixtureIds.users.seller,
      fixtureIds.assets.ETH,
    );
    expect(
      sellerAfterCancel.availableBalance
        .minus(sellerBeforeCancel.availableBalance)
        .toString(),
    ).toBe("0.25");
    expect(
      sellerAfterCancel.lockedBalance
        .minus(sellerBeforeCancel.lockedBalance)
        .toString(),
    ).toBe("-0.25");

    const ad = await prisma.p2PAd.findUniqueOrThrow({
      where: { id: fixtureIds.ads.buyEthUsd },
    });
    expect(ad.remainingCryptoAmount.toString()).toBe("1");
    expect(ad.status).toBe("ACTIVE");
  });

  it("fills an ad when a trade consumes the full remaining amount", async () => {
    await seedActiveSellAdFixture(prisma);

    const trade = await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/trades`)
      .set("Authorization", bearer(buyerToken))
      .send({ cryptoAmount: "0.5" })
      .expect(201);

    expect(trade.body.status).toBe("PENDING_PAYMENT");

    const ad = await prisma.p2PAd.findUniqueOrThrow({
      where: { id: fixtureIds.ads.sellBtcThb },
    });
    expect(ad.remainingCryptoAmount.toString()).toBe("0");
    expect(ad.status).toBe("FILLED");

    await request(app.getHttpServer())
      .post(`/api/v1/p2p/ads/${fixtureIds.ads.sellBtcThb}/trades`)
      .set("Authorization", bearer(buyerToken))
      .send({ cryptoAmount: "0.1" })
      .expect(404);
  });

  it("rejects inactive assets and inactive payment methods", async () => {
    await prisma.cryptoAsset.update({
      where: { id: fixtureIds.assets.DOGE },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({
        assetSymbol: "DOGE",
        fiatCode: "THB",
        side: "SELL",
        price: "3.5",
        totalCryptoAmount: "100",
        minFiatAmount: "100",
        maxFiatAmount: "350",
        paymentMethodId: fixtureIds.paymentMethods.sellerThbBank,
      })
      .expect(404);

    await prisma.paymentMethod.update({
      where: { id: fixtureIds.paymentMethods.sellerThbBank },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .post("/api/v1/p2p/ads")
      .set("Authorization", bearer(sellerToken))
      .send({
        assetSymbol: "BTC",
        fiatCode: "THB",
        side: "SELL",
        price: "1000000",
        totalCryptoAmount: "0.1",
        minFiatAmount: "1000",
        maxFiatAmount: "100000",
        paymentMethodId: fixtureIds.paymentMethods.sellerThbBank,
      })
      .expect(404);
  });
  async function getAccount(userId: string, assetId: string) {
    return prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: { userId, assetId },
      },
    });
  }
});
