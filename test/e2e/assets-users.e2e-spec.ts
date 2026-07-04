import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { fixtureIds } from "./fixtures/ids.fixture";
import { createE2eApp } from "./helpers/app";
import { bearer, issueTokenForUser } from "./helpers/auth";
import { expectNoPasswordHash } from "./helpers/assertions";
import { createE2ePrisma, resetAndSeedBase } from "./helpers/db";

describe("Assets and Users API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createE2ePrisma();
    app = await createE2eApp();
  });

  beforeEach(async () => {
    await resetAndSeedBase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("requires auth and lists assets/fiat currencies for permitted users", async () => {
    await request(app.getHttpServer()).get("/api/v1/assets").expect(401);

    const token = await issueTokenForUser(prisma, fixtureIds.users.buyer);
    const assets = await request(app.getHttpServer())
      .get("/api/v1/assets")
      .set("Authorization", bearer(token))
      .expect(200);
    expect(
      assets.body.map((asset: { symbol: string }) => asset.symbol),
    ).toEqual(["BTC", "DOGE", "ETH", "USDT"]);
    expectNoPasswordHash(assets.body);

    const networks = await request(app.getHttpServer())
      .get("/api/v1/assets/USDT/withdraw-networks")
      .set("Authorization", bearer(token))
      .expect(200);
    expect(
      networks.body.map((item: { network: string }) => item.network),
    ).toEqual(["BSC", "ETH", "TRX"]);
    expect(
      networks.body.find((item: { network: string }) => item.network === "TRX"),
    ).toMatchObject({
      withdrawFee: "1",
      withdrawMin: "10",
      requiresTag: false,
    });

    await request(app.getHttpServer())
      .get("/api/v1/assets/NOPE/withdraw-networks")
      .set("Authorization", bearer(token))
      .expect(404);

    const fiat = await request(app.getHttpServer())
      .get("/api/v1/fiat-currencies")
      .set("Authorization", bearer(token))
      .expect(200);
    expect(fiat.body.map((item: { code: string }) => item.code)).toEqual([
      "THB",
      "USD",
    ]);
  });

  it("enforces user-read permissions and returns safe profile payloads", async () => {
    const traderToken = await issueTokenForUser(prisma, fixtureIds.users.buyer);
    const supportToken = await issueTokenForUser(
      prisma,
      fixtureIds.users.support,
    );
    const limitedToken = await issueTokenForUser(
      prisma,
      fixtureIds.users.limited,
    );

    await request(app.getHttpServer())
      .get(`/api/v1/users/${fixtureIds.users.buyer}`)
      .set("Authorization", bearer(traderToken))
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/assets")
      .set("Authorization", bearer(limitedToken))
      .expect(403);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/${fixtureIds.users.buyer}`)
      .set("Authorization", bearer(supportToken))
      .expect(200);

    expect(response.body).toMatchObject({
      id: fixtureIds.users.buyer,
      email: "buyer.e2e@example.com",
      displayName: "E2E Buyer",
      roles: [{ code: "trader" }],
    });
    expect(response.body.cryptoAccounts).toBeUndefined();
    expect(response.body.paymentMethods).toBeUndefined();
    expect(response.body.roles[0].permissions).toBeUndefined();
    expectNoPasswordHash(response.body);
  });

  it("allows admin to read safe user profiles", async () => {
    const adminToken = await issueTokenForUser(prisma, fixtureIds.users.admin);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/${fixtureIds.users.admin}`)
      .set("Authorization", bearer(adminToken))
      .expect(200);

    expect(response.body).toMatchObject({
      id: fixtureIds.users.admin,
      email: "admin.e2e@example.com",
      roles: [{ code: "admin" }],
    });
    expect(response.body.cryptoAccounts).toBeUndefined();
    expect(response.body.paymentMethods).toBeUndefined();
    expectNoPasswordHash(response.body);
  });

  it("allows only admin to verify user KYC", async () => {
    const supportToken = await issueTokenForUser(
      prisma,
      fixtureIds.users.support,
    );
    const adminToken = await issueTokenForUser(prisma, fixtureIds.users.admin);

    const registered = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "pending-kyc.e2e@example.com",
        password: "StrongPass123",
        displayName: "Pending KYC",
      })
      .expect(201);
    expect(registered.body.user.kycStatus).toBe("PENDING");

    await request(app.getHttpServer())
      .post("/api/v1/users/" + registered.body.user.id + "/kyc-verifications")
      .set("Authorization", bearer(supportToken))
      .expect(403);

    const verified = await request(app.getHttpServer())
      .post("/api/v1/users/" + registered.body.user.id + "/kyc-verifications")
      .set("Authorization", bearer(adminToken))
      .expect(201);

    expect(verified.body).toMatchObject({
      id: registered.body.user.id,
      email: "pending-kyc.e2e@example.com",
      kycStatus: "VERIFIED",
      roles: [{ code: "trader" }],
    });
    expectNoPasswordHash(verified.body);
  });
  it("returns 404 for missing users and 400 for invalid params/query validation", async () => {
    const supportToken = await issueTokenForUser(
      prisma,
      fixtureIds.users.support,
    );
    const traderToken = await issueTokenForUser(prisma, fixtureIds.users.buyer);

    await request(app.getHttpServer())
      .get("/api/v1/users/not-a-uuid")
      .set("Authorization", bearer(supportToken))
      .expect(400);

    await request(app.getHttpServer())
      .get("/api/v1/users/e4000000-0000-4000-8000-999999999999")
      .set("Authorization", bearer(supportToken))
      .expect(404);

    await request(app.getHttpServer())
      .get("/api/v1/p2p/ads?page=abc")
      .set("Authorization", bearer(traderToken))
      .expect(400);

    await request(app.getHttpServer())
      .get("/api/v1/p2p/ads?pageSize=101")
      .set("Authorization", bearer(traderToken))
      .expect(400);

    await request(app.getHttpServer())
      .get("/api/v1/p2p/ads?side=INVALID")
      .set("Authorization", bearer(traderToken))
      .expect(400);
  });
});
