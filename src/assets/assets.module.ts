import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  imports: [RbacModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
