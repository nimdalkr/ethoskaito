import { normalizeToken } from "@/lib/utils";

export interface AliasCandidate {
  projectId: string;
  aliases: string[];
  allowLooseTextMatch?: boolean;
}

const AMBIGUOUS_SINGLE_TOKEN_ALIASES = new Set([
  "abstract",
  "beyond",
  "cap",
  "level",
  "loop",
  "momentum",
  "movement",
  "noise",
  "record",
  "rise",
  "soon",
  "space",
  "story"
]);

function normalizeSignalToken(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function extractSignalTokens(text: string, pattern: RegExp) {
  const matches = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const token = normalizeSignalToken(match[1] ?? "");
    if (token.length >= 2) {
      matches.add(token);
    }
  }

  return matches;
}

function canLooseMatchAlias(alias: string, allowLooseTextMatch = true) {
  if (!allowLooseTextMatch) {
    return false;
  }

  const normalizedAlias = normalizeToken(alias);
  if (!normalizedAlias) {
    return false;
  }

  if (normalizedAlias.includes(" ")) {
    return true;
  }

  if (/[^A-Za-z0-9]/.test(alias) || /\d/.test(alias)) {
    return true;
  }

  return !AMBIGUOUS_SINGLE_TOKEN_ALIASES.has(normalizedAlias);
}

export function matchProjectsByText(text: string, projects: AliasCandidate[]) {
  const normalizedText = ` ${normalizeToken(text)} `;
  const signalTokens = new Set([
    ...extractSignalTokens(text, /(?:^|[\s(])@([A-Za-z0-9_]{2,32})/g),
    ...extractSignalTokens(text, /(?:^|[\s(])#([A-Za-z0-9_]{2,32})/g),
    ...extractSignalTokens(text, /(?:^|[\s(])\$([A-Za-z0-9_]{2,16})/g)
  ]);
  const matches = new Set<string>();

  for (const project of projects) {
    const orderedAliases = [...project.aliases]
      .filter((alias) => normalizeToken(alias).length >= 3)
      .sort((a, b) => b.length - a.length);

    for (const alias of orderedAliases) {
      const normalizedAlias = normalizeToken(alias);
      if (!normalizedAlias) {
        continue;
      }

      if (signalTokens.has(normalizeSignalToken(alias))) {
        matches.add(project.projectId);
        break;
      }

      if (!canLooseMatchAlias(alias, project.allowLooseTextMatch ?? true)) {
        continue;
      }

      if (normalizedText.includes(` ${normalizedAlias} `)) {
        matches.add(project.projectId);
        break;
      }
    }
  }

  return [...matches];
}
