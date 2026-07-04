import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FiatPaymentStatus,
  LedgerBalanceType,
  LedgerEntryDirection,
  LedgerTransactionType,
  P2PAdSide,
  P2PAdStatus,
  P2PTradeStatus,
  Prisma,
} from "@prisma/client";
import { getPagination } from "../common/dto/pagination-query.dto";
import {
  publicPaymentMethodSelect,
  publicUserSelect,
  tradePaymentMethodSelect,
  tradeUserSelect,
} from "../common/prisma/safe-user.select";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { PrismaService } from "../prisma/prisma.service";
import { PERMISSIONS } from "../rbac/permissions.constants";
import { CreateAdDto } from "./dto/create-ad.dto";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { ListAdsQuery } from "./dto/list-ads.query";
import {
  P2PAdResponseDto,
  P2PAdResponseInclude,
  P2PTradeResponseDto,
  P2PTradeResponseInclude,
} from "./dto/p2p-response.dto";
import { SubmitFiatPaymentDto } from "./dto/submit-fiat-payment.dto";

type Tx = Prisma.TransactionClient;

type TradeEscrowInput = {
  id: string;
  buyerUserId: string;
  sellerUserId: string;
  cryptoAmount: Prisma.Decimal;
  ad: {
    assetId: string;
  };
};

@Injectable()
export class P2PService {
  constructor(private readonly prisma: PrismaService) {}

  async createAd(userId: string, dto: CreateAdDto): Promise<P2PAdResponseDto> {
    const price = this.toPositiveDecimal(dto.price, "price");
    const totalCryptoAmount = this.toPositiveDecimal(
      dto.totalCryptoAmount,
      "totalCryptoAmount",
    );
    const minFiatAmount = this.toPositiveDecimal(
      dto.minFiatAmount,
      "minFiatAmount",
    );
    const maxFiatAmount = this.toPositiveDecimal(
      dto.maxFiatAmount,
      "maxFiatAmount",
    );

    if (minFiatAmount.gt(maxFiatAmount)) {
      throw new BadRequestException(
        "minFiatAmount cannot exceed maxFiatAmount",
      );
    }

    if (maxFiatAmount.gt(totalCryptoAmount.mul(price))) {
      throw new BadRequestException(
        "maxFiatAmount cannot exceed total ad value",
      );
    }

    const adId = await this.prisma.$transaction(
      async (tx) => {
        const { asset, fiatCurrency } = await this.findAssetAndFiat(
          tx,
          dto.assetSymbol,
          dto.fiatCode,
        );

        if (dto.paymentMethodId) {
          await this.ensurePaymentMethod(
            tx,
            dto.paymentMethodId,
            userId,
            fiatCurrency.id,
          );
        }

        const ad = await tx.p2PAd.create({
          data: {
            makerUserId: userId,
            assetId: asset.id,
            fiatCurrencyId: fiatCurrency.id,
            paymentMethodId: dto.paymentMethodId,
            side: dto.side,
            price,
            totalCryptoAmount,
            remainingCryptoAmount: totalCryptoAmount,
            minFiatAmount,
            maxFiatAmount,
          },
        });

        if (dto.side === P2PAdSide.SELL) {
          await this.lockSellerCrypto(tx, {
            sellerUserId: userId,
            assetId: asset.id,
            amount: totalCryptoAmount,
            transactionType: LedgerTransactionType.ESCROW_LOCK,
            referenceType: "p2p_ad",
            referenceId: ad.id,
          });
        }

        return ad.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findAdResponse(adId);
  }
  listAds(query: ListAdsQuery): Promise<P2PAdResponseDto[]> {
    const pagination = getPagination(query);

    return this.prisma.p2PAd.findMany({
      where: {
        status: P2PAdStatus.ACTIVE,
        side: query.side,
        asset: query.assetSymbol
          ? { symbol: query.assetSymbol.toUpperCase() }
          : undefined,
        fiatCurrency: query.fiatCode
          ? { code: query.fiatCode.toUpperCase() }
          : undefined,
      },
      include: this.adInclude(),
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  async cancelAd(
    currentUser: AuthenticatedUser,
    adId: string,
  ): Promise<P2PAdResponseDto> {
    const cancelledAdId = await this.prisma.$transaction(
      async (tx) => {
        const ad = await tx.p2PAd.findUnique({
          where: { id: adId },
        });

        if (!ad) {
          throw new NotFoundException("P2P ad not found");
        }

        if (
          ad.makerUserId !== currentUser.id &&
          !this.canResolveDispute(currentUser)
        ) {
          throw new ForbiddenException("Only maker can cancel this ad");
        }

        if (ad.status === P2PAdStatus.CANCELLED) {
          return ad.id;
        }

        if (ad.side === P2PAdSide.SELL && ad.remainingCryptoAmount.gt(0)) {
          await this.unlockSellerCrypto(tx, {
            sellerUserId: ad.makerUserId,
            assetId: ad.assetId,
            amount: ad.remainingCryptoAmount,
            transactionType: LedgerTransactionType.ESCROW_REFUND,
            referenceType: "p2p_ad",
            referenceId: ad.id,
          });
        }

        const cancelledAd = await tx.p2PAd.update({
          where: { id: ad.id },
          data: {
            status: P2PAdStatus.CANCELLED,
            remainingCryptoAmount: new Prisma.Decimal(0),
          },
        });

        return cancelledAd.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findAdResponse(cancelledAdId);
  }
  async createTrade(
    takerUserId: string,
    adId: string,
    dto: CreateTradeDto,
  ): Promise<P2PTradeResponseDto> {
    const cryptoAmount = this.toPositiveDecimal(
      dto.cryptoAmount,
      "cryptoAmount",
    );

    const tradeId = await this.prisma.$transaction(
      async (tx) => {
        const ad = await tx.p2PAd.findUnique({
          where: { id: adId },
        });

        if (!ad || ad.status !== P2PAdStatus.ACTIVE) {
          throw new NotFoundException("Active P2P ad not found");
        }

        if (ad.makerUserId === takerUserId) {
          throw new BadRequestException("Maker cannot take the same ad");
        }

        if (ad.remainingCryptoAmount.lt(cryptoAmount)) {
          throw new BadRequestException(
            "Ad does not have enough remaining size",
          );
        }

        const fiatAmount = cryptoAmount.mul(ad.price);
        if (
          fiatAmount.lt(ad.minFiatAmount) ||
          fiatAmount.gt(ad.maxFiatAmount)
        ) {
          throw new BadRequestException(
            "Trade fiat amount is outside ad min/max limits",
          );
        }

        const buyerUserId =
          ad.side === P2PAdSide.SELL ? takerUserId : ad.makerUserId;
        const sellerUserId =
          ad.side === P2PAdSide.SELL ? ad.makerUserId : takerUserId;

        const remainingAfter = ad.remainingCryptoAmount.minus(cryptoAmount);
        const updateAd = await tx.p2PAd.updateMany({
          where: {
            id: ad.id,
            status: P2PAdStatus.ACTIVE,
            remainingCryptoAmount: { gte: cryptoAmount },
          },
          data: {
            remainingCryptoAmount: { decrement: cryptoAmount },
            status: remainingAfter.eq(0)
              ? P2PAdStatus.FILLED
              : P2PAdStatus.ACTIVE,
          },
        });

        if (updateAd.count !== 1) {
          throw new BadRequestException("Ad was changed by another trade");
        }

        const trade = await tx.p2PTrade.create({
          data: {
            adId: ad.id,
            buyerUserId,
            sellerUserId,
            cryptoAmount,
            fiatAmount,
            price: ad.price,
          },
        });

        if (ad.side === P2PAdSide.BUY) {
          await this.lockSellerCrypto(tx, {
            sellerUserId,
            assetId: ad.assetId,
            amount: cryptoAmount,
            transactionType: LedgerTransactionType.ESCROW_LOCK,
            referenceType: "p2p_trade",
            referenceId: trade.id,
          });
        }

        return trade.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findTradeResponse(tradeId);
  }
  async getTrade(
    currentUser: AuthenticatedUser,
    tradeId: string,
  ): Promise<P2PTradeResponseDto> {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: this.tradeInclude(),
    });
    if (!trade) {
      throw new NotFoundException("P2P trade not found");
    }

    if (
      !this.canAccessTrade(currentUser, trade.buyerUserId, trade.sellerUserId)
    ) {
      throw new ForbiddenException("Cannot access this trade");
    }

    return trade;
  }

  async submitPayment(
    currentUser: AuthenticatedUser,
    tradeId: string,
    dto: SubmitFiatPaymentDto,
  ): Promise<P2PTradeResponseDto> {
    const paidTradeId = await this.prisma.$transaction(
      async (tx) => {
        const trade = await tx.p2PTrade.findUnique({
          where: { id: tradeId },
        });

        if (!trade) {
          throw new NotFoundException("P2P trade not found");
        }

        if (trade.buyerUserId !== currentUser.id) {
          throw new ForbiddenException("Only buyer can submit fiat payment");
        }

        if (trade.status !== P2PTradeStatus.PENDING_PAYMENT) {
          throw new BadRequestException("Trade is not waiting for payment");
        }

        const ad = await tx.p2PAd.findUniqueOrThrow({
          where: { id: trade.adId },
          select: {
            fiatCurrencyId: true,
            paymentMethodId: true,
          },
        });

        const paymentMethodId = dto.paymentMethodId ?? ad.paymentMethodId;
        if (paymentMethodId) {
          await this.ensurePaymentMethod(
            tx,
            paymentMethodId,
            trade.sellerUserId,
            ad.fiatCurrencyId,
          );
        }

        const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

        const transition = await tx.p2PTrade.updateMany({
          where: {
            id: trade.id,
            status: P2PTradeStatus.PENDING_PAYMENT,
          },
          data: {
            status: P2PTradeStatus.PAID,
            paidAt,
          },
        });

        if (transition.count !== 1) {
          throw new BadRequestException("Trade is not waiting for payment");
        }

        await tx.fiatPayment.create({
          data: {
            tradeId: trade.id,
            paymentMethodId,
            amount: trade.fiatAmount,
            proofUrl: dto.proofUrl,
            paidAt,
          },
        });

        return trade.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findTradeResponse(paidTradeId);
  }
  async releaseTrade(
    currentUser: AuthenticatedUser,
    tradeId: string,
  ): Promise<P2PTradeResponseDto> {
    const releasedTradeId = await this.prisma.$transaction(
      async (tx) => {
        const trade = await tx.p2PTrade.findUnique({
          where: { id: tradeId },
        });

        if (!trade) {
          throw new NotFoundException("P2P trade not found");
        }

        const resolver = this.canResolveDispute(currentUser);
        const sellerRelease =
          trade.sellerUserId === currentUser.id &&
          trade.status === P2PTradeStatus.PAID;
        const supportRelease =
          resolver &&
          (trade.status === P2PTradeStatus.PAID ||
            trade.status === P2PTradeStatus.DISPUTED);

        if (!sellerRelease && !supportRelease) {
          throw new ForbiddenException("Cannot release this trade");
        }

        const ad = await tx.p2PAd.findUniqueOrThrow({
          where: { id: trade.adId },
          select: { assetId: true },
        });

        await this.releaseLockedCryptoToBuyer(tx, {
          ...trade,
          ad,
        });

        await tx.fiatPayment.updateMany({
          where: { tradeId: trade.id },
          data: { status: FiatPaymentStatus.ACCEPTED },
        });

        const releasedTrade = await tx.p2PTrade.update({
          where: { id: trade.id },
          data: {
            status: P2PTradeStatus.RELEASED,
            releasedAt: new Date(),
          },
        });

        return releasedTrade.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findTradeResponse(releasedTradeId);
  }
  async cancelTrade(
    currentUser: AuthenticatedUser,
    tradeId: string,
  ): Promise<P2PTradeResponseDto> {
    const cancelledTradeId = await this.prisma.$transaction(
      async (tx) => {
        const trade = await tx.p2PTrade.findUnique({
          where: { id: tradeId },
        });

        if (!trade) {
          throw new NotFoundException("P2P trade not found");
        }

        const ad = await tx.p2PAd.findUniqueOrThrow({
          where: { id: trade.adId },
          select: {
            assetId: true,
            side: true,
            status: true,
          },
        });

        if (trade.status === P2PTradeStatus.PENDING_PAYMENT) {
          if (
            !this.canAccessTrade(
              currentUser,
              trade.buyerUserId,
              trade.sellerUserId,
            )
          ) {
            throw new ForbiddenException("Cannot cancel this trade");
          }

          const canReturnToAd = ad.status !== P2PAdStatus.CANCELLED;
          if (canReturnToAd) {
            await tx.p2PAd.update({
              where: { id: trade.adId },
              data: {
                remainingCryptoAmount: { increment: trade.cryptoAmount },
                status: P2PAdStatus.ACTIVE,
              },
            });
          }

          const shouldUnlockSeller =
            ad.side === P2PAdSide.BUY || !canReturnToAd;
          if (shouldUnlockSeller) {
            await this.unlockSellerCrypto(tx, {
              sellerUserId: trade.sellerUserId,
              assetId: ad.assetId,
              amount: trade.cryptoAmount,
              transactionType: LedgerTransactionType.ESCROW_REFUND,
              referenceType: "p2p_trade",
              referenceId: trade.id,
            });
          }
        } else if (trade.status === P2PTradeStatus.DISPUTED) {
          if (!this.canResolveDispute(currentUser)) {
            throw new ForbiddenException(
              "Only support/admin can refund dispute",
            );
          }

          await this.unlockSellerCrypto(tx, {
            sellerUserId: trade.sellerUserId,
            assetId: ad.assetId,
            amount: trade.cryptoAmount,
            transactionType: LedgerTransactionType.ESCROW_REFUND,
            referenceType: "p2p_trade",
            referenceId: trade.id,
          });

          await tx.fiatPayment.updateMany({
            where: { tradeId: trade.id },
            data: { status: FiatPaymentStatus.REJECTED },
          });
        } else {
          throw new BadRequestException("Trade cannot be cancelled");
        }

        const cancelledTrade = await tx.p2PTrade.update({
          where: { id: trade.id },
          data: {
            status: P2PTradeStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });

        return cancelledTrade.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findTradeResponse(cancelledTradeId);
  }
  async disputeTrade(
    currentUser: AuthenticatedUser,
    tradeId: string,
  ): Promise<P2PTradeResponseDto> {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException("P2P trade not found");
    }

    if (
      !this.canAccessTrade(currentUser, trade.buyerUserId, trade.sellerUserId)
    ) {
      throw new ForbiddenException("Cannot dispute this trade");
    }

    if (trade.status !== P2PTradeStatus.PAID) {
      throw new BadRequestException("Only paid trades can be disputed");
    }

    const disputedTrade = await this.prisma.p2PTrade.update({
      where: { id: trade.id },
      data: {
        status: P2PTradeStatus.DISPUTED,
        disputedAt: new Date(),
      },
    });

    return this.findTradeResponse(disputedTrade.id);
  }
  private findAdResponse(adId: string): Promise<P2PAdResponseDto> {
    return this.prisma.p2PAd.findUniqueOrThrow({
      where: { id: adId },
      include: this.adInclude(),
    });
  }

  private findTradeResponse(tradeId: string): Promise<P2PTradeResponseDto> {
    return this.prisma.p2PTrade.findUniqueOrThrow({
      where: { id: tradeId },
      include: this.tradeInclude(),
    });
  }
  private async releaseLockedCryptoToBuyer(tx: Tx, trade: TradeEscrowInput) {
    const sellerAccount = await this.findAccount(
      tx,
      trade.sellerUserId,
      trade.ad.assetId,
    );

    const debitLocked = await tx.cryptoAccount.updateMany({
      where: {
        id: sellerAccount.id,
        lockedBalance: { gte: trade.cryptoAmount },
      },
      data: {
        lockedBalance: { decrement: trade.cryptoAmount },
      },
    });

    if (debitLocked.count !== 1) {
      throw new BadRequestException("Seller escrow balance is insufficient");
    }

    const buyerAccount = await tx.cryptoAccount.upsert({
      where: {
        userId_assetId: {
          userId: trade.buyerUserId,
          assetId: trade.ad.assetId,
        },
      },
      update: {
        availableBalance: { increment: trade.cryptoAmount },
      },
      create: {
        userId: trade.buyerUserId,
        assetId: trade.ad.assetId,
        availableBalance: trade.cryptoAmount,
        lockedBalance: new Prisma.Decimal(0),
      },
    });

    const sellerAfter = await tx.cryptoAccount.findUniqueOrThrow({
      where: { id: sellerAccount.id },
    });
    const buyerAfter = await tx.cryptoAccount.findUniqueOrThrow({
      where: { id: buyerAccount.id },
    });

    const ledgerTransaction = await tx.ledgerTransaction.create({
      data: {
        type: LedgerTransactionType.ESCROW_RELEASE,
        referenceType: "p2p_trade",
        referenceId: trade.id,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: ledgerTransaction.id,
        cryptoAccountId: sellerAfter.id,
        direction: LedgerEntryDirection.DEBIT,
        balanceType: LedgerBalanceType.LOCKED,
        amount: trade.cryptoAmount,
        balanceAfter: sellerAfter.lockedBalance,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: ledgerTransaction.id,
        cryptoAccountId: buyerAfter.id,
        direction: LedgerEntryDirection.CREDIT,
        balanceType: LedgerBalanceType.AVAILABLE,
        amount: trade.cryptoAmount,
        balanceAfter: buyerAfter.availableBalance,
      },
    });
  }

  private async lockSellerCrypto(
    tx: Tx,
    input: {
      sellerUserId: string;
      assetId: string;
      amount: Prisma.Decimal;
      transactionType: LedgerTransactionType;
      referenceType: string;
      referenceId: string;
    },
  ) {
    const account = await this.findAccount(
      tx,
      input.sellerUserId,
      input.assetId,
    );
    const result = await tx.cryptoAccount.updateMany({
      where: {
        id: account.id,
        availableBalance: { gte: input.amount },
      },
      data: {
        availableBalance: { decrement: input.amount },
        lockedBalance: { increment: input.amount },
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException(
        "Insufficient available balance for escrow",
      );
    }

    const accountAfter = await tx.cryptoAccount.findUniqueOrThrow({
      where: { id: account.id },
    });

    const ledgerTransaction = await tx.ledgerTransaction.create({
      data: {
        type: input.transactionType,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: ledgerTransaction.id,
        cryptoAccountId: account.id,
        direction: LedgerEntryDirection.DEBIT,
        balanceType: LedgerBalanceType.AVAILABLE,
        amount: input.amount,
        balanceAfter: accountAfter.availableBalance,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: ledgerTransaction.id,
        cryptoAccountId: account.id,
        direction: LedgerEntryDirection.CREDIT,
        balanceType: LedgerBalanceType.LOCKED,
        amount: input.amount,
        balanceAfter: accountAfter.lockedBalance,
      },
    });
  }

  private async unlockSellerCrypto(
    tx: Tx,
    input: {
      sellerUserId: string;
      assetId: string;
      amount: Prisma.Decimal;
      transactionType: LedgerTransactionType;
      referenceType: string;
      referenceId: string;
    },
  ) {
    const account = await this.findAccount(
      tx,
      input.sellerUserId,
      input.assetId,
    );
    const result = await tx.cryptoAccount.updateMany({
      where: {
        id: account.id,
        lockedBalance: { gte: input.amount },
      },
      data: {
        lockedBalance: { decrement: input.amount },
        availableBalance: { increment: input.amount },
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException("Escrow balance is insufficient");
    }

    const accountAfter = await tx.cryptoAccount.findUniqueOrThrow({
      where: { id: account.id },
    });

    const ledgerTransaction = await tx.ledgerTransaction.create({
      data: {
        type: input.transactionType,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: ledgerTransaction.id,
        cryptoAccountId: account.id,
        direction: LedgerEntryDirection.DEBIT,
        balanceType: LedgerBalanceType.LOCKED,
        amount: input.amount,
        balanceAfter: accountAfter.lockedBalance,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        ledgerTransactionId: ledgerTransaction.id,
        cryptoAccountId: account.id,
        direction: LedgerEntryDirection.CREDIT,
        balanceType: LedgerBalanceType.AVAILABLE,
        amount: input.amount,
        balanceAfter: accountAfter.availableBalance,
      },
    });
  }

  private async findAssetAndFiat(
    tx: Tx,
    assetSymbol: string,
    fiatCode: string,
  ) {
    const asset = await tx.cryptoAsset.findUnique({
      where: { symbol: assetSymbol.toUpperCase() },
    });
    const fiatCurrency = await tx.fiatCurrency.findUnique({
      where: { code: fiatCode.toUpperCase() },
    });

    if (!asset || !asset.isActive) {
      throw new NotFoundException("Crypto asset not found or inactive");
    }

    if (!fiatCurrency) {
      throw new NotFoundException("Fiat currency not found");
    }

    return { asset, fiatCurrency };
  }

  private async findAccount(tx: Tx, userId: string, assetId: string) {
    const account = await tx.cryptoAccount.findUnique({
      where: {
        userId_assetId: {
          userId,
          assetId,
        },
      },
    });

    if (!account) {
      throw new NotFoundException("Crypto account not found");
    }

    return account;
  }

  private async ensurePaymentMethod(
    tx: Tx,
    paymentMethodId: string,
    userId: string,
    fiatCurrencyId: string,
  ) {
    const paymentMethod = await tx.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId,
        fiatCurrencyId,
        isActive: true,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException("Payment method not found or inactive");
    }

    return paymentMethod;
  }

  private toPositiveDecimal(value: string, fieldName: string): Prisma.Decimal {
    try {
      const decimal = new Prisma.Decimal(value);
      if (decimal.lte(0)) {
        throw new Error("non-positive");
      }
      return decimal;
    } catch {
      throw new BadRequestException(`${fieldName} must be a positive decimal`);
    }
  }

  private canAccessTrade(
    currentUser: AuthenticatedUser,
    buyerUserId: string,
    sellerUserId: string,
  ): boolean {
    return (
      currentUser.id === buyerUserId ||
      currentUser.id === sellerUserId ||
      this.canResolveDispute(currentUser)
    );
  }

  private canResolveDispute(currentUser: AuthenticatedUser): boolean {
    return (
      currentUser.permissions?.includes(PERMISSIONS.P2P_DISPUTE_RESOLVE) ??
      false
    );
  }

  private adInclude(): P2PAdResponseInclude {
    return {
      maker: { select: publicUserSelect },
      asset: true,
      fiatCurrency: true,
      paymentMethod: { select: publicPaymentMethodSelect },
    } satisfies Prisma.P2PAdInclude;
  }

  private tradeInclude(): P2PTradeResponseInclude {
    return {
      ad: {
        include: {
          asset: true,
          fiatCurrency: true,
          paymentMethod: { select: tradePaymentMethodSelect },
        },
      },
      buyer: { select: tradeUserSelect },
      seller: { select: tradeUserSelect },
      fiatPayments: {
        include: {
          paymentMethod: { select: tradePaymentMethodSelect },
        },
      },
    } satisfies Prisma.P2PTradeInclude;
  }
}
