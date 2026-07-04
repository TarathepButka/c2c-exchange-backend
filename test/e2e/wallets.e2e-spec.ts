import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { fixtureIds } from "./fixtures/ids.fixture";
import { createE2eApp } from "./helpers/app";
import { bearer, issueTokenForUser } from "./helpers/auth";
import { asNumber, expectNoPasswordHash } from "./helpers/assertions";
import { createE2ePrisma, resetAndSeedBase } from "./helpers/db";

const validTrxAddress = "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE";
const validEthAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

describe("Wallets API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let buyerToken: string;
  let sellerToken: string;
  let supportToken: string;

  beforeAll(async () => {
    prisma = createE2ePrisma();
    app = await createE2eApp();
  });

  beforeEach(async () => {
    await resetAndSeedBase(prisma);
    buyerToken = await issueTokenForUser(prisma, fixtureIds.users.buyer);
    sellerToken = await issueTokenForUser(prisma, fixtureIds.users.seller);
    supportToken = await issueTokenForUser(prisma, fixtureIds.users.support);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("lists current wallets and ledger entries without leaking sensitive fields", async () => {
    const wallets = await request(app.getHttpServer())
      .get("/api/v1/wallets/me")
      .set("Authorization", bearer(buyerToken))
      .expect(200);

    expect(wallets.body).toHaveLength(4);
    expect(
      wallets.body.find((item: any) => item.asset.symbol === "BTC"),
    ).toMatchObject({
      userId: fixtureIds.users.buyer,
    });
    expect(
      wallets.body.find((item: any) => item.asset.symbol === "USDT"),
    ).toMatchObject({
      userId: fixtureIds.users.buyer,
      availableBalance: "1000",
    });
    expectNoPasswordHash(wallets.body);

    const ledger = await request(app.getHttpServer())
      .get("/api/v1/wallets/me/ledger?page=1&pageSize=10")
      .set("Authorization", bearer(buyerToken))
      .expect(200);
    expect(Array.isArray(ledger.body)).toBe(true);
  });

  it("creates an internal transfer and records debit/credit ledger entries", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/wallets/internal-transfers")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "BTC",
        receiverUserId: fixtureIds.users.seller,
        amount: "0.01",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      senderUserId: fixtureIds.users.buyer,
      receiverUserId: fixtureIds.users.seller,
      status: "COMPLETED",
    });
    expect(response.body.ledgerTransaction.entries).toHaveLength(2);

    const buyerBtc = await prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: {
          userId: fixtureIds.users.buyer,
          assetId: fixtureIds.assets.BTC,
        },
      },
    });
    const sellerBtc = await prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: {
          userId: fixtureIds.users.seller,
          assetId: fixtureIds.assets.BTC,
        },
      },
    });

    expect(buyerBtc.availableBalance.toString()).toBe("0.09");
    expect(sellerBtc.availableBalance.toString()).toBe("2.01");
  });

  it("rejects invalid internal transfers", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/wallets/internal-transfers")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "BTC",
        receiverUserId: fixtureIds.users.buyer,
        amount: "0.01",
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/internal-transfers")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "BTC",
        receiverUserId: "not-a-uuid",
        amount: "0.01",
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/internal-transfers")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "BTC",
        receiverUserId: "e4000000-0000-4000-8000-999999999999",
        amount: "0.01",
      })
      .expect(404);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/internal-transfers")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "NOPE",
        receiverUserId: fixtureIds.users.seller,
        amount: "0.01",
      })
      .expect(404);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/internal-transfers")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "BTC",
        receiverUserId: fixtureIds.users.seller,
        amount: "10",
      })
      .expect(400);
  });

  it("creates external withdrawals with configured fees and idempotency", async () => {
    const payload = {
      assetSymbol: "USDT",
      network: "TRX",
      amount: "100",
      destinationAddress: validTrxAddress,
      withdrawOrderId: "buyer-usdt-trx-001",
    };

    const pending = await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send(payload)
      .expect(201);

    expect(pending.body).toMatchObject({
      status: "PENDING",
      assetId: fixtureIds.assets.USDT,
      network: "TRX",
      amount: "100",
      networkFee: "1",
      destinationAddress: validTrxAddress,
      withdrawOrderId: "buyer-usdt-trx-001",
    });
    expect(pending.body.ledgerTransaction.entries).toHaveLength(1);
    expect(pending.body.ledgerTransaction.entries[0].amount).toBe("101");

    const duplicate = await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send(payload)
      .expect(201);
    expect(duplicate.body.id).toBe(pending.body.id);

    const buyerUsdt = await prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: {
          userId: fixtureIds.users.buyer,
          assetId: fixtureIds.assets.USDT,
        },
      },
    });
    expect(buyerUsdt.availableBalance.toString()).toBe("899");

    const list = await request(app.getHttpServer())
      .get("/api/v1/wallets/external-withdrawals/me")
      .set("Authorization", bearer(buyerToken))
      .expect(200);
    expect(list.body.map((item: { id: string }) => item.id)).toContain(
      pending.body.id,
    );

    await request(app.getHttpServer())
      .post(
        `/api/v1/wallets/external-withdrawals/${pending.body.id}/completions`,
      )
      .set("Authorization", bearer(buyerToken))
      .send({ txHash: "0xtradercannotcomplete" })
      .expect(403);

    const completed = await request(app.getHttpServer())
      .post(
        `/api/v1/wallets/external-withdrawals/${pending.body.id}/completions`,
      )
      .set("Authorization", bearer(supportToken))
      .send({ txHash: "0xe2ecompletedtxhash" })
      .expect(201);

    expect(completed.body.status).toBe("COMPLETED");
    expect(completed.body.txHash).toBe("0xe2ecompletedtxhash");
    expect(completed.body.completedAt).toBeTruthy();
  });

  it("fails pending external withdrawals and refunds amount plus fee", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "USDT",
        network: "TRX",
        amount: "50",
        destinationAddress: validTrxAddress,
      })
      .expect(201);

    let buyerUsdt = await prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: {
          userId: fixtureIds.users.buyer,
          assetId: fixtureIds.assets.USDT,
        },
      },
    });
    expect(buyerUsdt.availableBalance.toString()).toBe("949");

    const failed = await request(app.getHttpServer())
      .post(`/api/v1/wallets/external-withdrawals/${created.body.id}/failures`)
      .set("Authorization", bearer(supportToken))
      .send({ failureReason: "Simulated hot-wallet rejection" })
      .expect(201);

    expect(failed.body.status).toBe("FAILED");
    expect(failed.body.failureReason).toBe("Simulated hot-wallet rejection");

    buyerUsdt = await prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: {
          userId: fixtureIds.users.buyer,
          assetId: fixtureIds.assets.USDT,
        },
      },
    });
    expect(buyerUsdt.availableBalance.toString()).toBe("1000");

    const refundEntries = await prisma.ledgerEntry.findMany({
      where: {
        ledgerTransaction: {
          type: "EXTERNAL_WITHDRAWAL_REFUND",
          referenceType: "external_withdrawal",
          referenceId: created.body.id,
        },
      },
    });
    expect(refundEntries).toHaveLength(1);
    expect(refundEntries[0].amount.toString()).toBe("51");
  });

  it("creates completed ETH withdrawals through the support completion endpoint", async () => {
    const pending = await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(sellerToken))
      .send({
        assetSymbol: "ETH",
        network: "ETH",
        amount: "0.25",
        destinationAddress: validEthAddress,
      })
      .expect(201);

    expect(pending.body.status).toBe("PENDING");
    expect(pending.body.networkFee).toBe("0.002");

    const completed = await request(app.getHttpServer())
      .post(
        `/api/v1/wallets/external-withdrawals/${pending.body.id}/completions`,
      )
      .set("Authorization", bearer(supportToken))
      .send({ txHash: "0xe2etxhash" })
      .expect(201);

    expect(completed.body.status).toBe("COMPLETED");

    const sellerEth = await prisma.cryptoAccount.findUniqueOrThrow({
      where: {
        userId_assetId: {
          userId: fixtureIds.users.seller,
          assetId: fixtureIds.assets.ETH,
        },
      },
    });
    expect(asNumber(sellerEth.availableBalance.toString())).toBeCloseTo(4.748);
  });

  it("rejects invalid external withdrawal requests", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "USDT",
        network: "TRX",
        amount: "0",
        destinationAddress: validTrxAddress,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "USDT",
        network: "NOPE",
        amount: "100",
        destinationAddress: validTrxAddress,
      })
      .expect(404);

    await prisma.withdrawalNetwork.update({
      where: {
        assetId_network: {
          assetId: fixtureIds.assets.USDT,
          network: "BSC",
        },
      },
      data: { isActive: false },
    });

    await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "USDT",
        network: "BSC",
        amount: "100",
        destinationAddress: validEthAddress,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "USDT",
        network: "TRX",
        amount: "1",
        destinationAddress: validTrxAddress,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "USDT",
        network: "TRX",
        amount: "100",
        destinationAddress: "0xnot-a-tron-address",
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({ assetSymbol: "USDT", network: "TRX", amount: "100" })
      .expect(400);

    await prisma.withdrawalNetwork.update({
      where: {
        assetId_network: {
          assetId: fixtureIds.assets.USDT,
          network: "TRX",
        },
      },
      data: { requiresTag: true },
    });

    await request(app.getHttpServer())
      .post("/api/v1/wallets/external-withdrawals")
      .set("Authorization", bearer(buyerToken))
      .send({
        assetSymbol: "USDT",
        network: "TRX",
        amount: "100",
        destinationAddress: validTrxAddress,
      })
      .expect(400);
  });
});
