import { Prisma } from "@prisma/client";

export const d = (value: string | number) => new Prisma.Decimal(value);
