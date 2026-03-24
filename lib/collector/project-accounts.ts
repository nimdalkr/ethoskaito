import { prisma } from "@/lib/db";

export function normalizeXUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function isOfficialProjectUsername(value: string, officialProjectUsernames: Set<string>) {
  return officialProjectUsernames.has(normalizeXUsername(value));
}

export async function getOfficialProjectUsernameSet() {
  const projects = await prisma.project.findMany({
    where: {
      username: {
        not: null
      }
    },
    select: {
      username: true
    }
  });

  return new Set(projects.map((project) => normalizeXUsername(project.username!)).filter(Boolean));
}
