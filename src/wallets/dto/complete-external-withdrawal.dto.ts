import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CompleteExternalWithdrawalDto {
  @ApiProperty({ example: "0xmockedbroadcasttxhash" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  txHash: string;
}
