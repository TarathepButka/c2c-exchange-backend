import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { PERMISSIONS } from "../rbac/permissions.constants";
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
import { WalletsService } from "./wallets.service";

@ApiTags("wallets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("wallets")
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get("me")
  @RequirePermissions(PERMISSIONS.WALLET_READ)
  getMyWallets(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WalletResponseDto[]> {
    return this.walletsService.getMyWallets(user.id);
  }

  @Get("me/ledger")
  @RequirePermissions(PERMISSIONS.WALLET_READ)
  getMyLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLedgerQueryDto,
  ): Promise<WalletLedgerEntryResponseDto[]> {
    return this.walletsService.getMyLedger(user.id, query);
  }

  @Post("internal-transfers")
  @RequirePermissions(PERMISSIONS.WALLET_TRANSFER_CREATE)
  createInternalTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInternalTransferDto,
  ): Promise<InternalTransferResponseDto> {
    return this.walletsService.createInternalTransfer(user.id, dto);
  }

  @Get("external-withdrawals/me")
  @RequirePermissions(PERMISSIONS.WALLET_READ)
  getMyExternalWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExternalWithdrawalResponseDto[]> {
    return this.walletsService.getMyExternalWithdrawals(user.id);
  }

  @Post("external-withdrawals")
  @RequirePermissions(PERMISSIONS.WALLET_WITHDRAW_CREATE)
  createExternalWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExternalWithdrawalDto,
  ): Promise<ExternalWithdrawalResponseDto> {
    return this.walletsService.createExternalWithdrawal(user.id, dto);
  }

  @Post("external-withdrawals/:id/completions")
  @RequirePermissions(PERMISSIONS.WALLET_WITHDRAW_MANAGE)
  completeExternalWithdrawal(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CompleteExternalWithdrawalDto,
  ): Promise<ExternalWithdrawalResponseDto> {
    return this.walletsService.completeExternalWithdrawal(id, dto);
  }

  @Post("external-withdrawals/:id/failures")
  @RequirePermissions(PERMISSIONS.WALLET_WITHDRAW_MANAGE)
  failExternalWithdrawal(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: FailExternalWithdrawalDto,
  ): Promise<ExternalWithdrawalResponseDto> {
    return this.walletsService.failExternalWithdrawal(id, dto);
  }
}
