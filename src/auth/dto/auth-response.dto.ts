import { Prisma } from "@prisma/client";

export type SafeUserResponseDto = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    displayName: true;
    kycStatus: true;
    status: true;
  };
}>;

export type AuthResponseDto = {
  user: SafeUserResponseDto;
  accessToken: string;
};

export type LogoutResponseDto = {
  revoked: boolean;
};
