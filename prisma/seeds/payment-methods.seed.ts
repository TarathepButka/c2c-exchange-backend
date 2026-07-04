import { PaymentMethodType, PrismaClient } from "@prisma/client";
import { ids } from "./seed-data";

export async function seedPaymentMethods(prisma: PrismaClient) {
  const methods = [
    {
      id: ids.paymentMethods.sellerThbBank,
      userId: ids.users.seller,
      fiatCurrencyId: ids.fiat.THB,
      type: PaymentMethodType.BANK_ACCOUNT,
      providerName: "Kasikorn Bank",
      accountName: "Demo Seller",
      accountNumber: "123-4-56789-0",
    },
    {
      id: ids.paymentMethods.sellerUsdBank,
      userId: ids.users.seller,
      fiatCurrencyId: ids.fiat.USD,
      type: PaymentMethodType.BANK_ACCOUNT,
      providerName: "Wise USD",
      accountName: "Demo Seller",
      accountNumber: "WISE-USD-SELLER",
    },
    {
      id: ids.paymentMethods.buyerUsdBank,
      userId: ids.users.buyer,
      fiatCurrencyId: ids.fiat.USD,
      type: PaymentMethodType.BANK_ACCOUNT,
      providerName: "Wise USD",
      accountName: "Demo Buyer",
      accountNumber: "WISE-USD-BUYER",
    },
  ];

  for (const method of methods) {
    await prisma.paymentMethod.upsert({
      where: { id: method.id },
      update: {
        ...method,
        isActive: true,
      },
      create: {
        ...method,
        isActive: true,
      },
    });
  }
}
