import { Injectable, NotFoundException } from "@nestjs/common";
import { KycStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UserResponseDto } from "./dto/user-response.dto";

const userResponseSelect = {
  id: true,
  email: true,
  displayName: true,
  kycStatus: true,
  status: true,
  userRoles: {
    select: {
      role: {
        select: {
          code: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type UserWithRoles = Prisma.UserGetPayload<{
  select: typeof userResponseSelect;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userResponseSelect,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.toUserResponse(user);
  }

  async verifyKyc(userId: string): Promise<UserResponseDto> {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new NotFoundException("User not found");
    }

    const verifiedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: KycStatus.VERIFIED },
      select: userResponseSelect,
    });

    return this.toUserResponse(verifiedUser);
  }

  private toUserResponse(user: UserWithRoles): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      kycStatus: user.kycStatus,
      status: user.status,
      roles: user.userRoles.map((userRole) => ({
        code: userRole.role.code,
      })),
    };
  }
}
