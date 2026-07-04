import { Module } from "@nestjs/common";
import { PermissionGuard } from "../common/guards/permission.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { RbacService } from "./rbac.service";

@Module({
  imports: [PrismaModule],
  providers: [RbacService, PermissionGuard],
  exports: [RbacService, PermissionGuard],
})
export class RbacModule {}
