import { Prisma } from "@prisma/client";

export const publicUserSelect = {
  id: true,
  displayName: true,
  kycStatus: true,
  status: true,
} satisfies Prisma.UserSelect;

export const tradeUserSelect = {
  ...publicUserSelect,
  email: true,
} satisfies Prisma.UserSelect;

export const publicPaymentMethodSelect = {
  id: true,
  type: true,
  providerName: true,
  fiatCurrency: {
    select: {
      id: true,
      code: true,
      name: true,
      precision: true,
    },
  },
} satisfies Prisma.PaymentMethodSelect;

export const tradePaymentMethodSelect = {
  ...publicPaymentMethodSelect,
  accountName: true,
  accountNumber: true,
} satisfies Prisma.PaymentMethodSelect;
