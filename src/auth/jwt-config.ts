import { ConfigService } from "@nestjs/config";
import type ms from "ms";

export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>("JWT_SECRET");
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

export function getJwtExpiresIn(config: ConfigService): ms.StringValue {
  return config.get<string>("JWT_EXPIRES_IN") as ms.StringValue;
}
