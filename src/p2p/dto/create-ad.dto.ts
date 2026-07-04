import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { P2PAdSide } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";

const decimalStringPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class CreateAdDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  @IsNotEmpty()
  assetSymbol: string;

  @ApiProperty({ example: "THB" })
  @IsString()
  @IsNotEmpty()
  fiatCode: string;

  @ApiProperty({ enum: P2PAdSide, example: P2PAdSide.SELL })
  @IsEnum(P2PAdSide)
  side: P2PAdSide;

  @ApiProperty({ example: "2500000", description: "Decimal string" })
  @IsString()
  @Matches(decimalStringPattern, {
    message: "price must be a valid decimal string",
  })
  price: string;

  @ApiProperty({ example: "0.25", description: "Decimal string" })
  @IsString()
  @Matches(decimalStringPattern, {
    message: "totalCryptoAmount must be a valid decimal string",
  })
  totalCryptoAmount: string;

  @ApiProperty({ example: "1000", description: "Decimal string" })
  @IsString()
  @Matches(decimalStringPattern, {
    message: "minFiatAmount must be a valid decimal string",
  })
  minFiatAmount: string;

  @ApiProperty({ example: "50000", description: "Decimal string" })
  @IsString()
  @Matches(decimalStringPattern, {
    message: "maxFiatAmount must be a valid decimal string",
  })
  maxFiatAmount: string;

  @ApiPropertyOptional({
    example: "50000000-0000-4000-8000-000000000001",
  })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;
}
