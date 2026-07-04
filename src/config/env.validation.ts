import { plainToInstance, Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from "class-validator";

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return {
    ...config,
    PORT: validatedConfig.PORT,
    CORS_ORIGINS: parseCorsOrigins(validatedConfig.CORS_ORIGINS),
  };
}

function parseCorsOrigins(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
