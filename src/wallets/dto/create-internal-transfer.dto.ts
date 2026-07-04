import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID, Matches } from "class-validator";

const decimalStringPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class CreateInternalTransferDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  @IsNotEmpty()
  assetSymbol: string;

  @ApiProperty({ example: "40000000-0000-4000-8000-000000000002" })
  @IsUUID()
  receiverUserId: string;

  @ApiProperty({ example: "0.01", description: "Decimal string" })
  @IsString()
  @Matches(decimalStringPattern, {
    message: "amount must be a valid decimal string",
  })
  amount: string;
}
