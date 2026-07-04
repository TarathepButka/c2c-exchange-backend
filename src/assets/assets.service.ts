import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CryptoAssetResponseDto,
  FiatCurrencyResponseDto,
  WithdrawalNetworkResponseDto,
} from "./dto/assets-response.dto";

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  listCryptoAssets(): Promise<CryptoAssetResponseDto[]> {
    return this.prisma.cryptoAsset.findMany({
      where: { isActive: true },
      orderBy: { symbol: "asc" },
    });
  }

  listFiatCurrencies(): Promise<FiatCurrencyResponseDto[]> {
    return this.prisma.fiatCurrency.findMany({
      orderBy: { code: "asc" },
    });
  }

  async listWithdrawalNetworks(
    symbol: string,
  ): Promise<WithdrawalNetworkResponseDto[]> {
    const asset = await this.prisma.cryptoAsset.findUnique({
      where: { symbol: symbol.toUpperCase() },
      include: {
        withdrawalNetworks: {
          where: { isActive: true },
          orderBy: { network: "asc" },
        },
      },
    });

    if (!asset || !asset.isActive) {
      throw new NotFoundException("Crypto asset not found or inactive");
    }

    return asset.withdrawalNetworks;
  }
}
