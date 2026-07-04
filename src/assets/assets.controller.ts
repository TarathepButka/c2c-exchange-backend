import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { PERMISSIONS } from "../rbac/permissions.constants";
import { AssetsService } from "./assets.service";
import {
  CryptoAssetResponseDto,
  FiatCurrencyResponseDto,
  WithdrawalNetworkResponseDto,
} from "./dto/assets-response.dto";

@ApiTags("assets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get("assets")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  listCryptoAssets(): Promise<CryptoAssetResponseDto[]> {
    return this.assetsService.listCryptoAssets();
  }

  @Get("assets/:symbol/withdraw-networks")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  listWithdrawalNetworks(
    @Param("symbol") symbol: string,
  ): Promise<WithdrawalNetworkResponseDto[]> {
    return this.assetsService.listWithdrawalNetworks(symbol);
  }

  @Get("fiat-currencies")
  @RequirePermissions(PERMISSIONS.ASSETS_READ)
  listFiatCurrencies(): Promise<FiatCurrencyResponseDto[]> {
    return this.assetsService.listFiatCurrencies();
  }
}
