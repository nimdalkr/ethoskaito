import type { EthosUserSnapshot, ProjectMention, ProjectOutcome, ProjectSnapshot, TierRollup } from "@/lib/types/domain";

export const demoProjects: ProjectSnapshot[] = [
  {
    id: "project-1",
    projectId: 1,
    userkey: "alpha-ethos",
    name: "AlphaCore",
    username: "alphacore",
    description: "Infrastructure liquidity network focused on real-world utility.",
    categories: [
      { id: 1, name: "DeFi", slug: "defi" },
      { id: 2, name: "Infra", slug: "infra" }
    ],
    chains: [
      { id: 1, name: "Ethereum", url: "https://ethereum.org", iconUrl: null },
      { id: 2, name: "Base", url: "https://base.org", iconUrl: null }
    ],
    totalVotes: 1240,
    uniqueVoters: 412,
    bullishVotes: 956,
    bearishVotes: 284,
    commentCount: 88,
    aliases: ["alphacore", "alpha core", "$alpha"]
  },
  {
    id: "project-2",
    projectId: 2,
    userkey: "orbit-labs",
    name: "Orbit Labs",
    username: "orbitlabs",
    description: "Consumer crypto tooling with strong distribution loops.",
    categories: [
      { id: 3, name: "Consumer", slug: "consumer" },
      { id: 4, name: "Tooling", slug: "tooling" }
    ],
    chains: [{ id: 3, name: "Solana", url: "https://solana.com", iconUrl: null }],
    totalVotes: 920,
    uniqueVoters: 301,
    bullishVotes: 644,
    bearishVotes: 276,
    commentCount: 61,
    aliases: ["orbit labs", "orbit"]
  },
  {
    id: "project-3",
    projectId: 3,
    userkey: "lattice-vault",
    name: "Lattice Vault",
    username: "latticevault",
    description: "Onchain vault strategy with risk-aware routing.",
    categories: [
      { id: 1, name: "DeFi", slug: "defi" },
      { id: 5, name: "Yield", slug: "yield" }
    ],
    chains: [{ id: 4, name: "Arbitrum", url: "https://arbitrum.io", iconUrl: null }],
    totalVotes: 801,
    uniqueVoters: 245,
    bullishVotes: 552,
    bearishVotes: 249,
    commentCount: 44,
    aliases: ["lattice vault", "lattice"]
  }
];

export const demoUsers: EthosUserSnapshot[] = [
  {
    userId: "u1",
    userkey: "0x1",
    profileId: 101,
    displayName: "Mina",
    username: "mina_alpha",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&q=80",
    description: "Research lead focused on market structure.",
    score: 2480,
    level: "renowned",
    influenceFactor: 0.96,
    influenceFactorPercentile: 99.2,
    humanVerificationStatus: "VERIFIED",
    validatorNftCount: 7,
    xpTotal: 1820,
    xpStreakDays: 41,
    stats: {
      review: { received: { negative: 0, neutral: 2, positive: 34 } },
      vouch: {
        given: { amountWeiTotal: "4200000000000000000", count: 11 },
        received: { amountWeiTotal: "8300000000000000000", count: 18 }
      }
    },
    trustComposite: 96,
    trustTier: "T4"
  },
  {
    userId: "u2",
    userkey: "0x2",
    profileId: 102,
    displayName: "Jae",
    username: "jae_signals",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&q=80",
    description: "Macro and narrative observer.",
    score: 2140,
    level: "distinguished",
    influenceFactor: 0.82,
    influenceFactorPercentile: 95.4,
    humanVerificationStatus: "VERIFIED",
    validatorNftCount: 4,
    xpTotal: 1264,
    xpStreakDays: 18,
    stats: {
      review: { received: { negative: 1, neutral: 3, positive: 20 } },
      vouch: {
        given: { amountWeiTotal: "2100000000000000000", count: 7 },
        received: { amountWeiTotal: "4300000000000000000", count: 9 }
      }
    },
    trustComposite: 84,
    trustTier: "T4"
  },
  {
    userId: "u3",
    userkey: "0x3",
    profileId: 103,
    displayName: "Nora",
    username: "nora_mid",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=256&q=80",
    description: "Mid-tier operator with strong niche coverage.",
    score: 1625,
    level: "reputable",
    influenceFactor: 0.64,
    influenceFactorPercentile: 81.5,
    humanVerificationStatus: "VERIFIED",
    validatorNftCount: 2,
    xpTotal: 820,
    xpStreakDays: 9,
    stats: {
      review: { received: { negative: 2, neutral: 4, positive: 14 } },
      vouch: {
        given: { amountWeiTotal: "500000000000000000", count: 4 },
        received: { amountWeiTotal: "1700000000000000000", count: 6 }
      }
    },
    trustComposite: 67,
    trustTier: "T3"
  }
];

export const demoMentions: ProjectMention[] = [
  { tweetId: "t1", projectId: "project-1", authorUserkey: "0x1", authorTier: "T4", authorComposite: 96, mentionedAt: "2026-03-18T09:10:00.000Z", weight: 10, isFirstTrackedMention: true },
  { tweetId: "t2", projectId: "project-1", authorUserkey: "0x2", authorTier: "T4", authorComposite: 84, mentionedAt: "2026-03-18T14:05:00.000Z", weight: 10, isFirstTrackedMention: false },
  { tweetId: "t3", projectId: "project-2", authorUserkey: "0x3", authorTier: "T3", authorComposite: 67, mentionedAt: "2026-03-19T11:40:00.000Z", weight: 7, isFirstTrackedMention: true },
  { tweetId: "t4", projectId: "project-3", authorUserkey: "0x2", authorTier: "T4", authorComposite: 84, mentionedAt: "2026-03-20T07:20:00.000Z", weight: 10, isFirstTrackedMention: true }
];

export const demoOutcomes: ProjectOutcome[] = [
  { projectId: "project-1", symbol: "ALPHA", source: "coingecko", firstPriceAt: "2026-03-18T12:00:00.000Z", latestPriceAt: "2026-03-22T12:00:00.000Z", return1d: 7.1, return7d: 18.4, return30d: 41.9 },
  { projectId: "project-2", symbol: "ORBIT", source: "coingecko", firstPriceAt: "2026-03-19T12:00:00.000Z", latestPriceAt: "2026-03-22T12:00:00.000Z", return1d: 2.8, return7d: 9.4, return30d: 24.6 },
  { projectId: "project-3", symbol: "LATT", source: "coingecko", firstPriceAt: "2026-03-20T12:00:00.000Z", latestPriceAt: "2026-03-22T12:00:00.000Z", return1d: -1.8, return7d: 6.2, return30d: 13.9 }
];

export const demoTierRollups: TierRollup[] = [
  { projectId: "project-1", tier: "T4", mentionCount: 12, weightedMentions: 120, uniqueAuthors: 5, firstMentionAt: "2026-03-18T09:10:00.000Z" },
  { projectId: "project-1", tier: "T3", mentionCount: 7, weightedMentions: 49, uniqueAuthors: 4, firstMentionAt: "2026-03-18T21:00:00.000Z" },
  { projectId: "project-2", tier: "T4", mentionCount: 8, weightedMentions: 80, uniqueAuthors: 3, firstMentionAt: "2026-03-19T11:40:00.000Z" },
  { projectId: "project-3", tier: "T3", mentionCount: 9, weightedMentions: 63, uniqueAuthors: 4, firstMentionAt: "2026-03-20T07:20:00.000Z" }
];

export function getDemoHomePageModel() {
  return {
    projects: demoProjects,
    users: demoUsers,
    outcomes: demoOutcomes,
    mentions: demoMentions,
    tierRollups: demoTierRollups
  };
}

export function getDemoProjectDetail(projectId: string) {
  const project = demoProjects.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }

  return {
    id: project.id,
    projectId: project.projectId,
    name: project.name,
    username: project.username,
    description: project.description,
    categories: project.categories,
    aliases: project.aliases.map((alias) => ({ alias })),
    marketMappings: [{ symbol: project.username ?? project.name.toLowerCase() }],
    outcomes: demoOutcomes.filter((item) => item.projectId === projectId),
    mentions: demoMentions
      .filter((mention) => mention.projectId === projectId)
      .map((mention) => {
        const user = demoUsers.find((item) => item.userkey === mention.authorUserkey);
        return {
          id: `${mention.projectId}-${mention.tweetId}`,
          ...mention,
          tweet: {
            tweetId: mention.tweetId,
            text: `${project.name} mention by ${user?.displayName ?? mention.authorUserkey}`,
            url: `https://x.com/${user?.username ?? "demo"}/status/${mention.tweetId}`,
            xUsername: user?.username ?? "demo",
            authorName: user?.displayName ?? mention.authorUserkey
          }
        };
      })
  };
}

export function getDemoProjectFlow(projectId: string) {
  const mentions = demoMentions.filter((item) => item.projectId === projectId);
  const firstByTier = Object.fromEntries(
    ["T4", "T3", "T2", "T1", "T0"]
      .map((tier) => [tier, mentions.find((item) => item.authorTier === tier)?.mentionedAt])
      .filter((entry) => entry[1])
  );
  const edges: Array<{
    source: string;
    target: string;
    startedAt: string;
    reachedAt: string;
    delayHours: number;
  }> = [];

  if (firstByTier.T4 && firstByTier.T3) {
    edges.push({
      source: "T4",
      target: "T3",
      startedAt: String(firstByTier.T4),
      reachedAt: String(firstByTier.T3),
      delayHours: 11.9
    });
  }

  return {
    projectId,
    firstByTier,
    edges
  };
}

export function getDemoUserDetail(userkey: string) {
  const user = demoUsers.find((item) => item.userkey === userkey);
  if (!user) {
    return null;
  }

  const mentions = demoMentions.filter((item) => item.authorUserkey === userkey);
  const firstMentions = mentions.filter((item) => item.isFirstTrackedMention);

  return {
    user,
    mentionCount: mentions.length,
    firstMentionCount: firstMentions.length,
    hitRate: mentions.length > 0 ? firstMentions.length / mentions.length : 0,
    projects: firstMentions.map((mention) => ({
      projectId: mention.projectId,
      projectName: demoProjects.find((project) => project.id === mention.projectId)?.name ?? mention.projectId,
      mentionedAt: new Date(mention.mentionedAt),
      weight: mention.weight
    }))
  };
}
