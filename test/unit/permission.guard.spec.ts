import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionGuard } from "../../src/common/guards/permission.guard";
import { PERMISSIONS } from "../../src/rbac/permissions.constants";
import { RbacService } from "../../src/rbac/rbac.service";

function mockContext(user?: { id: string; email: string }) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe("PermissionGuard", () => {
  it("allows a user with every required permission", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.P2P_AD_CREATE]),
    } as unknown as Reflector;
    const rbac = {
      getUserPermissionCodes: jest
        .fn()
        .mockResolvedValue([PERMISSIONS.P2P_AD_CREATE]),
    } as unknown as RbacService;

    const guard = new PermissionGuard(reflector, rbac);

    await expect(
      guard.canActivate(mockContext({ id: "user-1", email: "a@example.com" })),
    ).resolves.toBe(true);
  });

  it("rejects a user without the required permission", async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([PERMISSIONS.P2P_DISPUTE_RESOLVE]),
    } as unknown as Reflector;
    const rbac = {
      getUserPermissionCodes: jest
        .fn()
        .mockResolvedValue([PERMISSIONS.P2P_TRADE_READ]),
    } as unknown as RbacService;

    const guard = new PermissionGuard(reflector, rbac);

    await expect(
      guard.canActivate(mockContext({ id: "user-1", email: "a@example.com" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects when permission metadata exists but no user is authenticated", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.WALLET_READ]),
    } as unknown as Reflector;
    const rbac = {
      getUserPermissionCodes: jest.fn(),
    } as unknown as RbacService;

    const guard = new PermissionGuard(reflector, rbac);

    await expect(guard.canActivate(mockContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
