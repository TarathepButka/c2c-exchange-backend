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
import { CreateAdDto } from "./dto/create-ad.dto";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { ListAdsQuery } from "./dto/list-ads.query";
import { P2PAdResponseDto, P2PTradeResponseDto } from "./dto/p2p-response.dto";
import { SubmitFiatPaymentDto } from "./dto/submit-fiat-payment.dto";
import { P2PService } from "./p2p.service";

@ApiTags("p2p")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("p2p")
export class P2PController {
  constructor(private readonly p2pService: P2PService) {}

  @Post("ads")
  @RequirePermissions(PERMISSIONS.P2P_AD_CREATE)
  createAd(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdDto,
  ): Promise<P2PAdResponseDto> {
    return this.p2pService.createAd(user.id, dto);
  }

  @Get("ads")
  @RequirePermissions(PERMISSIONS.P2P_AD_READ)
  listAds(@Query() query: ListAdsQuery): Promise<P2PAdResponseDto[]> {
    return this.p2pService.listAds(query);
  }

  @Post("ads/:id/cancellations")
  @RequirePermissions(PERMISSIONS.P2P_AD_CANCEL)
  cancelAd(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<P2PAdResponseDto> {
    return this.p2pService.cancelAd(user, id);
  }

  @Post("ads/:id/trades")
  @RequirePermissions(PERMISSIONS.P2P_TRADE_CREATE)
  createTrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateTradeDto,
  ): Promise<P2PTradeResponseDto> {
    return this.p2pService.createTrade(user.id, id, dto);
  }

  @Get("trades/:id")
  @RequirePermissions(PERMISSIONS.P2P_TRADE_READ)
  getTrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<P2PTradeResponseDto> {
    return this.p2pService.getTrade(user, id);
  }

  @Post("trades/:id/payments")
  @RequirePermissions(PERMISSIONS.P2P_TRADE_PAY)
  submitPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SubmitFiatPaymentDto,
  ): Promise<P2PTradeResponseDto> {
    return this.p2pService.submitPayment(user, id, dto);
  }

  @Post("trades/:id/releases")
  @RequirePermissions(PERMISSIONS.P2P_TRADE_RELEASE)
  releaseTrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<P2PTradeResponseDto> {
    return this.p2pService.releaseTrade(user, id);
  }

  @Post("trades/:id/cancellations")
  @RequirePermissions(PERMISSIONS.P2P_TRADE_CANCEL)
  cancelTrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<P2PTradeResponseDto> {
    return this.p2pService.cancelTrade(user, id);
  }

  @Post("trades/:id/disputes")
  @RequirePermissions(PERMISSIONS.P2P_TRADE_DISPUTE)
  disputeTrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<P2PTradeResponseDto> {
    return this.p2pService.disputeTrade(user, id);
  }
}
