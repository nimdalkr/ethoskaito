type WorkerLeaseSnapshot = {
  expiresAt?: Date | string | null;
};

function toDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function isWorkerLeaseActive(lease?: WorkerLeaseSnapshot | null, now = new Date()) {
  const expiresAt = toDate(lease?.expiresAt);
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() > now.getTime();
}
