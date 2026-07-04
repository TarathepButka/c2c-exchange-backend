import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { PrismaClient } from "@prisma/client";
import type ms from "ms";
import { randomUUID } from "crypto";
import request from "supertest";

export const fixturePassword = "password123";

export function bearer(accessToken: string) {
  return `Bearer ${accessToken}`;
}

export async function login(
  app: INestApplication,
  email: string,
  password = fixturePassword,
) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(201);

  return response.body.accessToken as string;
}

export async function issueTokenForUser(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? "e2e-test-secret",
    signOptions: {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? "1d") as ms.StringValue,
    },
  });

  return jwt.sign({
    sub: user.id,
    email: user.email,
    jti: randomUUID(),
  });
}
