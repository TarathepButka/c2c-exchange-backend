import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class FailExternalWithdrawalDto {
  @ApiProperty({ example: "Rejected by simulated hot-wallet processor" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  failureReason: string;
}
