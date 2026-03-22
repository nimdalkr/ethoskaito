"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { getTrustTierLabel, TRUST_TIER_ORDER } from "@/lib/analytics/tier";
import { Button } from "@/components/ui/button";
import type { ProjectMention, ProjectOutcome, ProjectSnapshot } from "@/lib/types/domain";

const WINDOWS = [
  { label: "1d", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 }
] as const;

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
  mentions
}: {
  projects: ProjectSnapshot[];
  outcomes: ProjectOutcome[];
  mentions: ProjectMention[];
}) {
  const [windowDays, setWindowDays] = useState<number>(30);

  const rows = useMemo(() => {
    const fromDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const scopedMentions = mentions.filter((mention) => new Date(mention.mentionedAt) >= fromDate);

    return projects
      .map((project) => {
        const projectMentions = scopedMentions.filter((mention) => mention.projectId === project.id);
        const weightedMentions = projectMentions.reduce((sum, mention) => sum + mention.weight, 0);
        const mentionCount = projectMentions.length;
        const tierLead =
          TRUST_TIER_ORDER.find((tier) => projectMentions.some((mention) => mention.authorTier === tier)) ?? null;

        return {
          project,
          weightedMentions,
          mentionCount,
          tierLead,
          outcome: outcomes.find((item) => item.projectId === project.id)
        };
      })
      .filter((row) => row.weightedMentions > 0)
      .sort((left, right) => right.weightedMentions - left.weightedMentions)
      .slice(0, 16);
  }, [mentions, outcomes, projects, windowDays]);

  const totalWeight = rows.reduce((sum, row) => sum + row.weightedMentions, 0);
  const activeWindow = WINDOWS.find((window) => window.days === windowDays) ?? WINDOWS[2];

  return (
    <div className="mindshare-stack">
      <div className="mindshare-toolbar">
        <div className="mindshare-window-tabs" role="tablist" aria-label="Mindshare window">
          {WINDOWS.map((window) => (
            <Button
              key={window.days}
              variant={window.days === windowDays ? "default" : "ghost"}
              className={`mindshare-window-button ${window.days === windowDays ? "mindshare-window-button-active" : ""}`}
              onClick={() => setWindowDays(window.days)}
            >
              {window.label}
            </Button>
          ))}
        </div>
        <span className="mindshare-window-meta">Window: last {activeWindow.label}</span>
      </div>

      <div className="mindshare-board">
        {rows.map((row, index) => {
          const share = totalWeight > 0 ? (row.weightedMentions / totalWeight) * 100 : 0;
          const tone = getBoardTone(row.outcome?.return7d);
          const handle = row.project.username ? `@${row.project.username}` : null;
          const tierLead = row.tierLead ? getTrustTierLabel(row.tierLead) : "Unranked";

          return (
            <article
              key={row.project.id}
              className={`mindshare-tile mindshare-${tone} ${index === 0 ? "mindshare-tile-featured" : ""}`}
              style={{ "--mindshare-share": `${Math.max(share, 4)}%` } as CSSProperties}
            >
              <div className="mindshare-corner">#{index + 1}</div>
              <div className="mindshare-meta">
                <div className="mindshare-title-row">
                  <span className="mindshare-dot" />
                  <strong>{row.project.name}</strong>
                </div>
                {handle ? <span className="mindshare-handle">{handle}</span> : null}
              </div>

              <div className="mindshare-body">
                <div className="mindshare-primary-metric">
                  <strong>{share.toFixed(1)}%</strong>
                  <span>share</span>
                </div>
                <div className="mindshare-kpis">
                  <span>{row.weightedMentions} weighted</span>
                  <span>{row.mentionCount} calls</span>
                  <span>{tierLead} lead</span>
                </div>
              </div>

              <div className="mindshare-spark" />
            </article>
          );
        })}

        {rows.length === 0 ? (
          <div className="mindshare-empty">
            <strong>No tracked mentions in the selected window.</strong>
            <span>Try a wider range like 30d or 90d.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
