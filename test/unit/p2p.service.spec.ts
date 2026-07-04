import { BadRequestException } from "@nestjs/common";
import { P2PAdSide } from "@prisma/client";
import { P2PService } from "../../src/p2p/p2p.service";

describe("P2PService", () => {
  const service = new P2PService({} as any);

  it("rejects an ad whose min fiat amount exceeds max fiat amount", async () => {
    await expect(
      service.createAd("user-1", {
        assetSymbol: "BTC",
        fiatCode: "THB",
        side: P2PAdSide.SELL,
        price: "2500000",
        totalCryptoAmount: "0.1",
        minFiatAmount: "50000",
        maxFiatAmount: "10000",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an ad whose max fiat amount exceeds total ad value", async () => {
    await expect(
      service.createAd("user-1", {
        assetSymbol: "BTC",
        fiatCode: "THB",
        side: P2PAdSide.SELL,
        price: "100",
        totalCryptoAmount: "1",
        minFiatAmount: "10",
        maxFiatAmount: "1000",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
