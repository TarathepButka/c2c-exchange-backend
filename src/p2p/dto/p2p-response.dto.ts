import { Prisma } from "@prisma/client";
import {
  publicPaymentMethodSelect,
  publicUserSelect,
  tradePaymentMethodSelect,
  tradeUserSelect,
} from "../../common/prisma/safe-user.select";

export type P2PAdResponseInclude = {
  maker: { select: typeof publicUserSelect };
  asset: true;
  fiatCurrency: true;
  paymentMethod: { select: typeof publicPaymentMethodSelect };
};

export type P2PAdResponseDto = Prisma.P2PAdGetPayload<{
  include: P2PAdResponseInclude;
}>;

export type P2PTradeResponseInclude = {
  ad: {
    include: {
      asset: true;
      fiatCurrency: true;
      paymentMethod: { select: typeof tradePaymentMethodSelect };
    };
  };
  buyer: { select: typeof tradeUserSelect };
  seller: { select: typeof tradeUserSelect };
  fiatPayments: {
    include: {
      paymentMethod: { select: typeof tradePaymentMethodSelect };
    };
  };
};

export type P2PTradeResponseDto = Prisma.P2PTradeGetPayload<{
  include: P2PTradeResponseInclude;
}>;
