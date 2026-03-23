import { prisma } from "@/lib/db";

export async function acquireWorkerLease(input: {
  workerType: string;
  holderId: string;
  leaseSeconds: number;
}) {
  const expiresAt = new Date(Date.now() + input.leaseSeconds * 1000);

  try {
    await prisma.workerLease.create({
      data: {
        workerType: input.workerType,
        holderId: input.holderId,
        expiresAt
      }
    });

    return true;
  } catch {
    const claimed = await prisma.workerLease.updateMany({
      where: {
        workerType: input.workerType,
        OR: [{ holderId: input.holderId }, { expiresAt: { lt: new Date() } }]
      },
      data: {
        holderId: input.holderId,
        heartbeatAt: new Date(),
        expiresAt
      }
    });

    return claimed.count > 0;
  }
}

export async function renewWorkerLease(input: {
  workerType: string;
  holderId: string;
  leaseSeconds: number;
}) {
  const expiresAt = new Date(Date.now() + input.leaseSeconds * 1000);
  const renewed = await prisma.workerLease.updateMany({
    where: {
      workerType: input.workerType,
      holderId: input.holderId,
      expiresAt: {
        gt: new Date()
      }
    },
    data: {
      heartbeatAt: new Date(),
      expiresAt
    }
  });

  return renewed.count > 0;
}

export async function releaseWorkerLease(input: {
  workerType: string;
  holderId: string;
}) {
  await prisma.workerLease.deleteMany({
    where: {
      workerType: input.workerType,
      holderId: input.holderId
    }
  });
}
