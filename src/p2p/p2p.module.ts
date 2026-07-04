import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { P2PController } from "./p2p.controller";
import { P2PService } from "./p2p.service";

@Module({
  imports: [RbacModule],
  controllers: [P2PController],
  providers: [P2PService],
  exports: [P2PService],
})
export class P2PModule {}
