import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { PERMISSIONS } from "../rbac/permissions.constants";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOneProfile(id);
  }

  @Post(":id/kyc-verifications")
  @RequirePermissions(PERMISSIONS.USERS_KYC_VERIFY)
  verifyKyc(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.verifyKyc(id);
  }
}
