import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import {
  AuthResponseDto,
  LogoutResponseDto,
  SafeUserResponseDto,
} from "./dto/auth-response.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const traderRole = await tx.role.findUnique({
        where: { code: "trader" },
      });

      if (!traderRole) {
        throw new ConflictException("Default trader role has not been seeded");
      }

      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
          userRoles: {
            create: {
              roleId: traderRole.id,
            },
          },
        },
      });

      const assets = await tx.cryptoAsset.findMany({
        where: { isActive: true },
      });

      if (assets.length > 0) {
        await tx.cryptoAccount.createMany({
          data: assets.map((asset) => ({
            userId: createdUser.id,
            assetId: asset.id,
            availableBalance: new Prisma.Decimal(0),
            lockedBalance: new Prisma.Decimal(0),
          })),
          skipDuplicates: true,
        });
      }

      return createdUser;
    });

    return {
      user: this.toSafeUser(user),
      accessToken: await this.signToken(user.id, user.email),
    };
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return {
      user: this.toSafeUser(user),
      accessToken: await this.signToken(user.id, user.email),
    };
  }

  async logout(user: AuthenticatedUser): Promise<LogoutResponseDto> {
    if (!user.jti || !user.tokenExpiresAt) {
      throw new UnauthorizedException("Token cannot be revoked");
    }

    await this.prisma.revokedToken.upsert({
      where: { jti: user.jti },
      update: {
        expiresAt: user.tokenExpiresAt,
      },
      create: {
        jti: user.jti,
        userId: user.id,
        expiresAt: user.tokenExpiresAt,
      },
    });

    return { revoked: true };
  }

  private async signToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      email,
      jti: randomUUID(),
    });
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    displayName: string;
    kycStatus: SafeUserResponseDto["kycStatus"];
    status: SafeUserResponseDto["status"];
  }): SafeUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      kycStatus: user.kycStatus,
      status: user.status,
    };
  }
}
