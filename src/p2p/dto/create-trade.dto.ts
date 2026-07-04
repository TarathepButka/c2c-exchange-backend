import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

const decimalStringPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class CreateTradeDto {
  @ApiProperty({ example: "0.01", description: "Decimal string" })
  @IsString()
  @Matches(decimalStringPattern, {
    message: "cryptoAmount must be a valid decimal string",
  })
  cryptoAmount: string;
}
