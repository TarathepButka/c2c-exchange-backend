import { Prisma } from "@prisma/client";

export type UserRoleResponseDto = {
  code: string;
};

export type UserResponseDto = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    displayName: true;
    kycStatus: true;
    status: true;
  };
}> & {
  roles: UserRoleResponseDto[];
};
