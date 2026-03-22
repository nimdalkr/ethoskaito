import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { name?: string; message?: string };
  const message = candidate.message ?? "";

  return (
    candidate.name === "PrismaClientInitializationError" ||
    candidate.name === "PrismaClientKnownRequestError" ||
    message.includes("DATABASE_URL") ||
    message.includes("Can't reach database server") ||
    message.includes("Environment variable not found")
  );
}
