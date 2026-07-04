import { ApiPropertyOptional } from "@nestjs/swagger";
import { P2PAdSide } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListAdsQuery extends PaginationQueryDto {
  @ApiPropertyOptional({ example: "BTC" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  assetSymbol?: string;

  @ApiPropertyOptional({ example: "THB" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fiatCode?: string;

  @ApiPropertyOptional({ enum: P2PAdSide })
  @IsOptional()
  @IsEnum(P2PAdSide)
  side?: P2PAdSide;
}
