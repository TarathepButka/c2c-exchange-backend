import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

const decimalStringPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class CreateExternalWithdrawalDto {
  @ApiProperty({ example: "USDT" })
  @IsString()
  @IsNotEmpty()
  assetSymbol: string;

  @ApiProperty({ example: "TRX", description: "Withdrawal network code" })
  @IsString()
  @IsNotEmpty()
  network: string;

  @ApiProperty({ example: "100", description: "Decimal string" })
  @IsString()
  @Matches(decimalStringPattern, {
    message: "amount must be a valid decimal string",
  })
  amount: string;

  @ApiProperty({ example: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" })
  @IsString()
  @IsNotEmpty()
  destinationAddress: string;

  @ApiPropertyOptional({
    example: "123456",
    description: "Optional tag or memo required by some networks",
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  addressTag?: string;

  @ApiPropertyOptional({
    example: "withdraw-20260704-0001",
    description: "Client idempotency key for retry-safe withdrawals",
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  withdrawOrderId?: string;
}
