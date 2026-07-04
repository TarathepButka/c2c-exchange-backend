import { BadRequestException } from "@nestjs/common";
import { WalletsService } from "../../src/wallets/wallets.service";

describe("WalletsService", () => {
  const service = new WalletsService({} as any);

  it("rejects internal transfer to the same user before touching persistence", async () => {
    await expect(
      service.createInternalTransfer("user-1", {
        assetSymbol: "BTC",
        receiverUserId: "user-1",
        amount: "0.01",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects withdrawal with a non-positive amount before touching persistence", async () => {
    await expect(
      service.createExternalWithdrawal("user-1", {
        assetSymbol: "USDT",
        network: "TRX",
        amount: "0",
        destinationAddress: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
