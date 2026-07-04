import { Prisma } from "@prisma/client";
import { publicUserSelect } from "../../common/prisma/safe-user.select";

export type WalletResponseDto = Prisma.CryptoAccountGetPayload<{
  include: {
    asset: true;
  };
}>;

export type WalletLedgerEntryResponseDto = Prisma.LedgerEntryGetPayload<{
  include: {
    ledgerTransaction: true;
    cryptoAccount: {
      include: {
        asset: true;
      };
    };
  };
}>;

export type InternalTransferResponseDto = Prisma.InternalTransferGetPayload<{
  include: {
    sender: { select: typeof publicUserSelect };
    receiver: { select: typeof publicUserSelect };
    asset: true;
    ledgerTransaction: {
      include: {
        entries: true;
      };
    };
  };
}>;

export type ExternalWithdrawalResponseDto =
  Prisma.ExternalWithdrawalGetPayload<{
    include: {
      asset: true;
      ledgerTransaction: {
        include: {
          entries: true;
        };
      };
    };
  }>;
