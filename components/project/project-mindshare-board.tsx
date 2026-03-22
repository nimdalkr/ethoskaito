import type { CSSProperties } from "react";

import { getTrustTierLabel, TRUST_TIER_ORDER } from "@/lib/analytics/tier";
import type { ProjectOutcome, ProjectSnapshot, TierRollup } from "@/lib/types/domain";

function getBoardTone(return7d: number | null | undefined) {
  if ((return7d ?? 0) > 0) {
    return "positive";
  }

  if ((return7d ?? 0) < 0) {
    return "negative";
  }

  return "neutral";
}

export function ProjectMindshareBoard({
  projects,
  outcomes,
  tierRollups
}: {
  projects: ProjectSnapshot[];
  outcomes: ProjectOutcome[];
  tierRollups: TierRollup[];
}) {
  const rows = projects
    .map((project) => {
      const weightedMentions = tierRollups
        .filter((row) => row.projectId === project.id)
        .reduce((sum, row) => sum + row.weightedMentions, 0);

      return {
        project,
        weightedMentions,
        outcome: outcomes.find((item) => item.projectId === project.id),
        tierLead:
          TRUST_TIER_ORDER.find((tier) =>
            tierRollups.some((row) => row.projectId === project.id && row.tier === tier && row.weightedMentions > 0)
          ) ?? null
      };
    })
    .sort((left, right) => right.weightedMentions - left.weightedMentions)
    .slice(0, 16);

  const totalWeight = rows.reduce((sum, row) => sum + row.weightedMentions, 0);

  return (
    <div className="mindshare-board">
      {rows.map((row, index) => {
        const share = totalWeight > 0 ? (row.weightedMentions / totalWeight) * 100 : 0;
        const tone = getBoardTone(row.outcome?.return7d);
        const handle = row.project.username ? `@${row.project.username}` : null;
        const categoryLine = row.project.categories.slice(0, 2).map((item) => item.name).join(" · ");
        const tierLead = row.tierLead ? getTrustTierLabel(row.tierLead) : "Unranked";

        return (
          <article
            key={row.project.id}
            className={`mindshare-tile mindshare-${tone} ${index === 0 ? "mindshare-tile-featured" : ""}`}
            style={{ "--mindshare-share": `${Math.max(share, 4)}%` } as CSSProperties}
          >
            <div className="mindshare-corner">{index + 1}</div>
            <div className="mindshare-meta">
              <div className="mindshare-title-row">
                <span className="mindshare-dot" />
                <strong>{row.project.name}</strong>
              </div>
              <span>{share.toFixed(2)}%</span>
            </div>
            <div className="mindshare-body">
              <span>{handle ?? categoryLine ?? "Tracked project"}</span>
              <div className="mindshare-stats">
                <strong>{row.weightedMentions} weighted</strong>
                <strong>{row.outcome?.return7d != null ? `${row.outcome.return7d.toFixed(1)}% 7d` : "No 7d yet"}</strong>
              </div>
              <div className="mindshare-footer">
                <span>{tierLead} lead</span>
                <span>{row.project.commentCount} comments</span>
              </div>
            </div>
            <div className="mindshare-spark" />
          </article>
        );
      })}
    </div>
  );
}
