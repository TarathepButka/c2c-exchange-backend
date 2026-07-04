import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { PrismaClient } from "@prisma/client";
import type { Response } from "supertest";
import request from "supertest";
import { fixtureIds } from "./fixtures/ids.fixture";
import { createE2eApp } from "./helpers/app";
import { bearer, fixturePassword, login } from "./helpers/auth";
import { expectNoPasswordHash } from "./helpers/assertions";
import { createE2ePrisma, resetAndSeedBase } from "./helpers/db";

const email = {
  buyer: "buyer.e2e@example.com",
  suspended: "suspended.e2e@example.com",
};

describe("Auth API (e2e)", () => {
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

  it("registers a trader and returns a safe user plus JWT", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "new.trader.e2e@example.com",
        password: "StrongPass123",
        displayName: "New Trader",
      })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: "new.trader.e2e@example.com",
      displayName: "New Trader",
    });
    expectNoPasswordHash(response.body);

    await request(app.getHttpServer())
      .get("/api/v1/assets")
      .set("Authorization", bearer(response.body.accessToken))
      .expect(200);
  });

  it("rejects duplicate registration and invalid DTO payloads", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: email.buyer, password: "password123", displayName: "Dup" })
      .expect(409);

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "bad-email",
        password: "short",
        displayName: "A",
        unexpected: true,
      })
      .expect(400);
  });

  it("logs in seeded users and rejects bad credentials", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: email.buyer, password: fixturePassword })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expectNoPasswordHash(response.body);

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: email.buyer, password: "wrong-password" })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "missing.e2e@example.com", password: fixturePassword })
      .expect(401);
  });

  it("revokes a token on logout", async () => {
    const token = await login(app, email.buyer);

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", bearer(token))
      .expect(201)
      .expect((response: Response) => {
        const { body } = response;
        expect(body).toEqual({ revoked: true });
      });

    await request(app.getHttpServer())
      .get("/api/v1/assets")
      .set("Authorization", bearer(token))
      .expect(401);
  });

  it("rejects JWTs missing revocation metadata", async () => {
    const jwt = new JwtService({
      secret: process.env.JWT_SECRET ?? "e2e-test-secret",
    });
    const token = jwt.sign({
      sub: fixtureIds.users.buyer,
      email: email.buyer,
    });

    await request(app.getHttpServer())
      .get("/api/v1/assets")
      .set("Authorization", bearer(token))
      .expect(401);
  });
  it("rejects protected routes without a usable active-user token", async () => {
    await request(app.getHttpServer()).get("/api/v1/assets").expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/assets")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    const suspendedToken = await login(app, email.suspended);
    await request(app.getHttpServer())
      .get("/api/v1/assets")
      .set("Authorization", bearer(suspendedToken))
      .expect(401);
  });

  it("rate limits repeated login attempts", async () => {
    let sawRateLimit = false;

    for (let index = 0; index < 8; index += 1) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: "rate-limit.e2e@example.com",
          password: fixturePassword,
        });

      expect([401, 429]).toContain(response.status);
      if (response.status === 429) {
        sawRateLimit = true;
        break;
      }
    }

    expect(sawRateLimit).toBe(true);
  });
});
