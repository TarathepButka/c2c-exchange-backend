import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthenticatedUser } from "../types/authenticated-user";
import { RbacService } from "../../rbac/rbac.service";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    if (!request.user?.id) {
      throw new UnauthorizedException("Authenticated user is required");
    }

    const permissions = await this.rbacService.getUserPermissionCodes(
      request.user.id,
    );
    request.user.permissions = permissions;

    const hasEveryPermission = requiredPermissions.every((permission) =>
      permissions.includes(permission),
    );

    if (!hasEveryPermission) {
      throw new ForbiddenException("Missing required permission");
    }

    return true;
  }
}
