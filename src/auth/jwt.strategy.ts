import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { UserStatus } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import { getJwtSecret } from "./jwt-config";

type JwtPayload = {
  sub: string;
  email: string;
  jti?: string;
  exp?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.jti || !payload.exp) {
      throw new UnauthorizedException("Token is missing revocation metadata");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    const revokedToken = await this.prisma.revokedToken.findUnique({
      where: { jti: payload.jti },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User is inactive or no longer exists");
    }

    if (revokedToken) {
      throw new UnauthorizedException("Token has been revoked");
    }

    return {
      id: user.id,
      email: user.email,
      jti: payload.jti,
      tokenExpiresAt: new Date(payload.exp * 1000),
    };
  }
}
