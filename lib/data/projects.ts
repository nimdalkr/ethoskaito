import { prisma } from "@/lib/db";
import { normalizeToken } from "@/lib/utils";
import { ethosClient } from "@/lib/providers/ethos";

function buildProjectAliases(project: any) {
  const candidates = new Set<string>();
  const displayName = project?.user?.displayName ?? "";
  const username = project?.user?.username ?? "";
  const description = project?.description ?? "";

  if (displayName) candidates.add(displayName);
  if (username) candidates.add(username);

  const shortTickerMatches = description.match(/\$[A-Za-z0-9]{2,10}/g) ?? [];
  for (const match of shortTickerMatches) {
    candidates.add(match.replace("$", ""));
  }

  return [...candidates]
    .map((alias) => alias.trim())
    .filter(Boolean)
    .map((alias) => ({ alias, normalizedAlias: normalizeToken(alias) }))
    .filter((alias) => alias.normalizedAlias.length >= 3);
}

export async function syncProjectCatalog() {
  const projects = await ethosClient.getProjects();

  for (const rawProject of projects) {
    const aliases = buildProjectAliases(rawProject);
    const record = await prisma.project.upsert({
      where: { projectId: Number(rawProject.id) },
      update: {
        userkey: String(rawProject.userkey ?? ""),
        name: rawProject?.user?.displayName ?? rawProject?.user?.username ?? `Project ${rawProject.id}`,
        username: rawProject?.user?.username ?? null,
        description: rawProject?.description ?? null,
        totalVotes: Number(rawProject?.votes?.all?.total ?? 0),
        uniqueVoters: Number(rawProject?.votes?.all?.uniqueVoters ?? 0),
        bullishVotes: Number(rawProject?.votes?.bullish?.total ?? 0),
        bearishVotes: Number(rawProject?.votes?.bearish?.total ?? 0),
        commentCount: Number(rawProject?.commentCount ?? 0),
        categories: (rawProject?.categories ?? []) as any,
        chains: (rawProject?.chains ?? []) as any,
        raw: rawProject as any
      },
      create: {
        projectId: Number(rawProject.id),
        userkey: String(rawProject.userkey ?? ""),
        name: rawProject?.user?.displayName ?? rawProject?.user?.username ?? `Project ${rawProject.id}`,
        username: rawProject?.user?.username ?? null,
        description: rawProject?.description ?? null,
        totalVotes: Number(rawProject?.votes?.all?.total ?? 0),
        uniqueVoters: Number(rawProject?.votes?.all?.uniqueVoters ?? 0),
        bullishVotes: Number(rawProject?.votes?.bullish?.total ?? 0),
        bearishVotes: Number(rawProject?.votes?.bearish?.total ?? 0),
        commentCount: Number(rawProject?.commentCount ?? 0),
        categories: (rawProject?.categories ?? []) as any,
        chains: (rawProject?.chains ?? []) as any,
        raw: rawProject as any
      }
    });

    await prisma.projectAlias.deleteMany({ where: { projectId: record.id } });
    if (aliases.length > 0) {
      await prisma.projectAlias.createMany({
        data: aliases.map((entry) => ({
          projectId: record.id,
          alias: entry.alias,
          normalizedAlias: entry.normalizedAlias
        }))
      });
    }

    if (record.username) {
      await prisma.projectMarketMapping.upsert({
        where: {
          projectId_source_symbol_baseCurrency: {
            projectId: record.id,
            source: "coingecko",
            symbol: record.username.toLowerCase(),
            baseCurrency: "usd"
          }
        },
        update: {},
        create: {
          projectId: record.id,
          source: "coingecko",
          symbol: record.username.toLowerCase(),
          baseCurrency: "usd",
          isPrimary: true
        }
      });
    }
  }

  return prisma.project.count();
}

export async function ensureProjectCatalog() {
  const count = await prisma.project.count();
  if (count > 0) {
    return count;
  }

  return syncProjectCatalog();
}
