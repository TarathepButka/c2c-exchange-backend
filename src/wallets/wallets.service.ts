import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LedgerBalanceType,
  LedgerEntryDirection,
  LedgerTransactionType,
  Prisma,
  TransferStatus,
  WithdrawalStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { getPagination } from "../common/dto/pagination-query.dto";
import { publicUserSelect } from "../common/prisma/safe-user.select";
import { PrismaService } from "../prisma/prisma.service";
import { CompleteExternalWithdrawalDto } from "./dto/complete-external-withdrawal.dto";
import { CreateExternalWithdrawalDto } from "./dto/create-external-withdrawal.dto";
import { CreateInternalTransferDto } from "./dto/create-internal-transfer.dto";
import { FailExternalWithdrawalDto } from "./dto/fail-external-withdrawal.dto";
import { ListLedgerQueryDto } from "./dto/list-ledger-query.dto";
import {
  ExternalWithdrawalResponseDto,
  InternalTransferResponseDto,
  WalletLedgerEntryResponseDto,
  WalletResponseDto,
} from "./dto/wallets-response.dto";

const internalTransferInclude = {
  sender: { select: publicUserSelect },
  receiver: { select: publicUserSelect },
  asset: true,
  ledgerTransaction: {
    include: {
      entries: true,
    },
  },
} satisfies Prisma.InternalTransferInclude;

const externalWithdrawalInclude = {
  asset: true,
  ledgerTransaction: {
    include: {
      entries: true,
    },
  },
} satisfies Prisma.ExternalWithdrawalInclude;

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  getMyWallets(userId: string): Promise<WalletResponseDto[]> {
    return this.prisma.cryptoAccount.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: {
        asset: {
          symbol: "asc",
        },
      },
    });
  }

  getMyLedger(
    userId: string,
    query: ListLedgerQueryDto,
  ): Promise<WalletLedgerEntryResponseDto[]> {
    const pagination = getPagination(query);

    return this.prisma.ledgerEntry.findMany({
      where: {
        cryptoAccount: {
          userId,
        },
      },
      include: {
        ledgerTransaction: true,
        cryptoAccount: {
          include: {
            asset: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  getMyExternalWithdrawals(
    userId: string,
  ): Promise<ExternalWithdrawalResponseDto[]> {
    return this.prisma.externalWithdrawal.findMany({
      where: { userId },
      include: externalWithdrawalInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async createInternalTransfer(
    senderUserId: string,
    dto: CreateInternalTransferDto,
  ): Promise<InternalTransferResponseDto> {
    if (senderUserId === dto.receiverUserId) {
      throw new BadRequestException("Cannot transfer to the same user");
    }

    const amount = this.toPositiveDecimal(dto.amount, "amount");

    const transferId = await this.prisma.$transaction(
      async (tx) => {
        const asset = await this.findActiveAsset(tx, dto.assetSymbol);
        const senderAccount = await this.findAccount(
          tx,
          senderUserId,
          asset.id,
        );
        await this.ensureUserExists(tx, dto.receiverUserId);

        const debitResult = await tx.cryptoAccount.updateMany({
          where: {
            id: senderAccount.id,
            availableBalance: { gte: amount },
          },
          data: {
            availableBalance: { decrement: amount },
          },
        });

        if (debitResult.count !== 1) {
          throw new BadRequestException("Insufficient available balance");
        }

        const receiverAccount = await tx.cryptoAccount.upsert({
          where: {
            userId_assetId: {
              userId: dto.receiverUserId,
              assetId: asset.id,
            },
          },
          update: {
            availableBalance: { increment: amount },
          },
          create: {
            userId: dto.receiverUserId,
            assetId: asset.id,
            availableBalance: amount,
            lockedBalance: new Prisma.Decimal(0),
          },
        });

        const senderAfter = await tx.cryptoAccount.findUniqueOrThrow({
          where: { id: senderAccount.id },
        });
        const receiverAfter = await tx.cryptoAccount.findUniqueOrThrow({
          where: { id: receiverAccount.id },
        });

        const ledgerTransaction = await tx.ledgerTransaction.create({
          data: {
            type: LedgerTransactionType.INTERNAL_TRANSFER,
            referenceType: "internal_transfer",
          },
        });

        await tx.ledgerEntry.create({
          data: {
            ledgerTransactionId: ledgerTransaction.id,
            cryptoAccountId: senderAfter.id,
            direction: LedgerEntryDirection.DEBIT,
            balanceType: LedgerBalanceType.AVAILABLE,
            amount,
            balanceAfter: senderAfter.availableBalance,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            ledgerTransactionId: ledgerTransaction.id,
            cryptoAccountId: receiverAfter.id,
            direction: LedgerEntryDirection.CREDIT,
            balanceType: LedgerBalanceType.AVAILABLE,
            amount,
            balanceAfter: receiverAfter.availableBalance,
          },
        });

        const transfer = await tx.internalTransfer.create({
          data: {
            senderUserId,
            receiverUserId: dto.receiverUserId,
            assetId: asset.id,
            amount,
            status: TransferStatus.COMPLETED,
            ledgerTransactionId: ledgerTransaction.id,
          },
        });

        return transfer.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findInternalTransferResponse(transferId);
  }
  async createExternalWithdrawal(
    userId: string,
    dto: CreateExternalWithdrawalDto,
  ): Promise<ExternalWithdrawalResponseDto> {
    const amount = this.toPositiveDecimal(dto.amount, "amount");
    const networkCode = dto.network.toUpperCase();

    const withdrawalId = await this.prisma.$transaction(
      async (tx) => {
        if (dto.withdrawOrderId) {
          const existingWithdrawal = await tx.externalWithdrawal.findFirst({
            where: {
              userId,
              withdrawOrderId: dto.withdrawOrderId,
            },
            select: { id: true },
          });

          if (existingWithdrawal) {
            return existingWithdrawal.id;
          }
        }

        const asset = await this.findActiveAsset(tx, dto.assetSymbol);
        const withdrawalNetwork = await this.findWithdrawalNetwork(
          tx,
          asset.id,
          networkCode,
        );

        this.validateWithdrawalAmount(amount, withdrawalNetwork);
        this.validateWithdrawalAddress(dto, withdrawalNetwork);

        const networkFee = withdrawalNetwork.withdrawFee;
        const totalDebit = amount.plus(networkFee);
        const account = await this.findAccount(tx, userId, asset.id);

        const debitResult = await tx.cryptoAccount.updateMany({
          where: {
            id: account.id,
            availableBalance: { gte: totalDebit },
          },
          data: {
            availableBalance: { decrement: totalDebit },
          },
        });

        if (debitResult.count !== 1) {
          throw new BadRequestException(
            "Insufficient available balance for amount plus network fee",
          );
        }

        const accountAfter = await tx.cryptoAccount.findUniqueOrThrow({
          where: { id: account.id },
        });
        const newWithdrawalId = randomUUID();

        const ledgerTransaction = await tx.ledgerTransaction.create({
          data: {
            type: LedgerTransactionType.EXTERNAL_WITHDRAWAL,
            referenceType: "external_withdrawal",
            referenceId: newWithdrawalId,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            ledgerTransactionId: ledgerTransaction.id,
            cryptoAccountId: accountAfter.id,
            direction: LedgerEntryDirection.DEBIT,
            balanceType: LedgerBalanceType.AVAILABLE,
            amount: totalDebit,
            balanceAfter: accountAfter.availableBalance,
          },
        });

        const withdrawal = await tx.externalWithdrawal.create({
          data: {
            id: newWithdrawalId,
            userId,
            assetId: asset.id,
            amount,
            network: networkCode,
            networkFee,
            destinationAddress: dto.destinationAddress,
            addressTag: dto.addressTag,
            withdrawOrderId: dto.withdrawOrderId,
            status: WithdrawalStatus.PENDING,
            ledgerTransactionId: ledgerTransaction.id,
          },
        });

        return withdrawal.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findExternalWithdrawalResponse(withdrawalId);
  }
  async completeExternalWithdrawal(
    id: string,
    dto: CompleteExternalWithdrawalDto,
  ): Promise<ExternalWithdrawalResponseDto> {
    const withdrawalId = await this.prisma.$transaction(async (tx) => {
      const withdrawal = await this.findExternalWithdrawal(tx, id);
      this.ensureWithdrawalCanBeSettled(withdrawal.status);

      const completedWithdrawal = await tx.externalWithdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.COMPLETED,
          txHash: dto.txHash,
          failureReason: null,
          completedAt: new Date(),
        },
      });

      return completedWithdrawal.id;
    });

    return this.findExternalWithdrawalResponse(withdrawalId);
  }
  async failExternalWithdrawal(
    id: string,
    dto: FailExternalWithdrawalDto,
  ): Promise<ExternalWithdrawalResponseDto> {
    const withdrawalId = await this.prisma.$transaction(
      async (tx) => {
        const withdrawal = await this.findExternalWithdrawal(tx, id);
        this.ensureWithdrawalCanBeSettled(withdrawal.status);

        const totalRefund = withdrawal.amount.plus(withdrawal.networkFee);
        const account = await this.findAccount(
          tx,
          withdrawal.userId,
          withdrawal.assetId,
        );

        await tx.cryptoAccount.update({
          where: { id: account.id },
          data: {
            availableBalance: { increment: totalRefund },
          },
        });

        const accountAfter = await tx.cryptoAccount.findUniqueOrThrow({
          where: { id: account.id },
        });

        const refundLedgerTransaction = await tx.ledgerTransaction.create({
          data: {
            type: LedgerTransactionType.EXTERNAL_WITHDRAWAL_REFUND,
            referenceType: "external_withdrawal",
            referenceId: withdrawal.id,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            ledgerTransactionId: refundLedgerTransaction.id,
            cryptoAccountId: accountAfter.id,
            direction: LedgerEntryDirection.CREDIT,
            balanceType: LedgerBalanceType.AVAILABLE,
            amount: totalRefund,
            balanceAfter: accountAfter.availableBalance,
          },
        });

        const failedWithdrawal = await tx.externalWithdrawal.update({
          where: { id },
          data: {
            status: WithdrawalStatus.FAILED,
            failureReason: dto.failureReason,
            txHash: null,
            completedAt: null,
          },
        });

        return failedWithdrawal.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.findExternalWithdrawalResponse(withdrawalId);
  }
  private findInternalTransferResponse(
    transferId: string,
  ): Promise<InternalTransferResponseDto> {
    return this.prisma.internalTransfer.findUniqueOrThrow({
      where: { id: transferId },
      include: internalTransferInclude,
    });
  }

  private findExternalWithdrawalResponse(
    withdrawalId: string,
  ): Promise<ExternalWithdrawalResponseDto> {
    return this.prisma.externalWithdrawal.findUniqueOrThrow({
      where: { id: withdrawalId },
      include: externalWithdrawalInclude,
    });
  }
  private toPositiveDecimal(value: string, fieldName: string): Prisma.Decimal {
    try {
      const decimal = new Prisma.Decimal(value);
      if (decimal.lte(0)) {
        throw new Error("non-positive");
      }
      return decimal;
    } catch {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }
  }

  private async ensureUserExists(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Receiver user not found");
    }
  }

  private async findActiveAsset(tx: Prisma.TransactionClient, symbol: string) {
    const asset = await tx.cryptoAsset.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!asset || !asset.isActive) {
      throw new NotFoundException("Crypto asset not found or inactive");
    }
    return asset;
  }

  private async findWithdrawalNetwork(
    tx: Prisma.TransactionClient,
    assetId: string,
    network: string,
  ) {
    const withdrawalNetwork = await tx.withdrawalNetwork.findUnique({
      where: {
        assetId_network: {
          assetId,
          network,
        },
      },
    });

    if (!withdrawalNetwork || !withdrawalNetwork.isActive) {
      throw new NotFoundException("Withdrawal network not found or inactive");
    }

    return withdrawalNetwork;
  }

  private async findExternalWithdrawal(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const withdrawal = await tx.externalWithdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException("External withdrawal not found");
    }

    return withdrawal;
  }

  private async findAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    assetId: string,
  ) {
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

  private validateWithdrawalAmount(
    amount: Prisma.Decimal,
    withdrawalNetwork: {
      withdrawMin: Prisma.Decimal;
      withdrawMax: Prisma.Decimal;
    },
  ) {
    if (amount.lt(withdrawalNetwork.withdrawMin)) {
      throw new BadRequestException(
        "Amount is below network withdrawal minimum",
      );
    }

    if (amount.gt(withdrawalNetwork.withdrawMax)) {
      throw new BadRequestException(
        "Amount exceeds network withdrawal maximum",
      );
    }
  }

  private validateWithdrawalAddress(
    dto: CreateExternalWithdrawalDto,
    withdrawalNetwork: {
      addressRegex: string;
      requiresTag: boolean;
    },
  ) {
    if (withdrawalNetwork.requiresTag && !dto.addressTag) {
      throw new BadRequestException("Address tag is required for this network");
    }

    const addressRegex = new RegExp(withdrawalNetwork.addressRegex);
    if (!addressRegex.test(dto.destinationAddress)) {
      throw new BadRequestException(
        "Destination address is invalid for network",
      );
    }
  }

  private ensureWithdrawalCanBeSettled(status: WithdrawalStatus) {
    if (
      status !== WithdrawalStatus.PENDING &&
      status !== WithdrawalStatus.PROCESSING
    ) {
      throw new BadRequestException("Withdrawal is not pending or processing");
    }
  }
}
