import { normalizeToken } from "@/lib/utils";

export interface AliasCandidate {
  projectId: string;
  aliases: string[];
}

export function matchProjectsByText(text: string, projects: AliasCandidate[]) {
  const normalizedText = ` ${normalizeToken(text)} `;
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

      if (normalizedText.includes(` ${normalizedAlias} `)) {
        matches.add(project.projectId);
        break;
      }
    }
  }

  return [...matches];
}
