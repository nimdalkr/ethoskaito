export function toEthosXUsernameUserkey(username: string) {
  const normalized = username.trim().replace(/^@+/, "").toLowerCase();
  return `service:x.com:username:${normalized}`;
}

export function pickCanonicalEthosUserkey(input: {
  userkeys?: string[] | null;
  username?: string | null;
  id?: string | number | null;
}) {
  const primaryUserkey = Array.isArray(input.userkeys) ? input.userkeys.find((value) => typeof value === "string" && value.length > 0) : null;
  if (primaryUserkey) {
    return primaryUserkey;
  }

  if (input.username) {
    return toEthosXUsernameUserkey(input.username);
  }

  return String(input.id ?? "");
}
