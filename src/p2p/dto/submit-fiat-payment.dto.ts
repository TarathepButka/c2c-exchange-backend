import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class SubmitFiatPaymentDto {
  @ApiProperty({ example: "https://example.com/proofs/payment-001.jpg" })
  @IsString()
  @IsNotEmpty()
  proofUrl: string;

  @ApiPropertyOptional({
    example: "50000000-0000-4000-8000-000000000001",
  })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ example: "2026-07-03T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
