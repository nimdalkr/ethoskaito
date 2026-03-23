"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getTrustTierLabel, getTrustTierRank } from "@/lib/analytics/tier";
import type { ProjectMention, ProjectOutcome, ProjectSnapshot, TrustTier } from "@/lib/types/domain";

type MindshareWindow = "1d" | "7d" | "30d" | "90d";
type MindshareMode = "absolute" | "relative";
type MindshareTierFilter = "all" | "high" | "mid" | "t1" | "t0";

const WINDOW_OPTIONS: Array<{ key: MindshareWindow; label: string; days: number }> = [
  { key: "1d", label: "1D", days: 1 },
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 }
];

const TIER_FILTERS: Array<{ key: MindshareTierFilter; label: string; tiers: TrustTier[] | null }> = [
  { key: "all", label: "All tiers", tiers: null },
  { key: "high", label: "Challenger + Diamond", tiers: ["T4", "T3"] },
  { key: "mid", label: "Platinum", tiers: ["T2"] },
  { key: "t1", label: "Gold", tiers: ["T1"] },
  { key: "t0", label: "Bronze", tiers: ["T0"] }
];

type ProjectStats = {
  project: ProjectSnapshot;
  outcome: ProjectOutcome | undefined;
  weighted: number;
  previousWeighted: number;
  mentions: number;
  authors: Set<string>;
  tierWeights: Record<TrustTier, number>;
  highTierWeight: number;
  leadTier: TrustTier;
};

function formatShare(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function formatDelta(value: number, mode: MindshareMode) {
  if (mode === "relative") {
    if (!Number.isFinite(value)) {
      return "+100%";
    }

    return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
  }

  const rounded = value > 0 ? Math.round(value) : Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function getTierContributionLabel(stats: ProjectStats) {
  const total = Object.values(stats.tierWeights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return "No tier split";
  }

  const dominantTier = (Object.entries(stats.tierWeights) as Array<[TrustTier, number]>).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return getTrustTierRank(right[0]) - getTrustTierRank(left[0]);
  })[0]?.[0];

  return dominantTier ? `${getTrustTierLabel(dominantTier)} led` : "No tier split";
}

function getTileSize(index: number) {
  if (index === 0) {
    return "mindshare-tile-hero";
  }

  if (index < 3) {
    return "mindshare-tile-large";
  }

  if (index < 7) {
    return "mindshare-tile-medium";
  }

  return "mindshare-tile-small";
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
  const [windowKey, setWindowKey] = useState<MindshareWindow>("7d");
  const [mode, setMode] = useState<MindshareMode>("absolute");
  const [tierFilter, setTierFilter] = useState<MindshareTierFilter>("all");

  const selectedWindow = WINDOW_OPTIONS.find((option) => option.key === windowKey) ?? WINDOW_OPTIONS[1];
  const selectedTierFilter = TIER_FILTERS.find((option) => option.key === tierFilter) ?? TIER_FILTERS[0];

  const board = useMemo(() => {
    const now = Date.now();
    const currentStart = now - selectedWindow.days * 24 * 60 * 60 * 1000;
    const previousStart = now - selectedWindow.days * 2 * 24 * 60 * 60 * 1000;
    const allowedTiers = selectedTierFilter.tiers ? new Set(selectedTierFilter.tiers) : null;
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const outcomeMap = new Map(outcomes.map((outcome) => [outcome.projectId, outcome]));
    const statsMap = new Map<string, ProjectStats>();

    for (const mention of mentions) {
      if (allowedTiers && !allowedTiers.has(mention.authorTier)) {
        continue;
      }

      const mentionedAt = new Date(mention.mentionedAt).getTime();
      if (mentionedAt < previousStart) {
        continue;
      }

      const project = projectMap.get(mention.projectId);
      if (!project) {
        continue;
      }

      const entry =
        statsMap.get(mention.projectId) ??
        {
          project,
          outcome: outcomeMap.get(mention.projectId),
          weighted: 0,
          previousWeighted: 0,
          mentions: 0,
          authors: new Set<string>(),
          tierWeights: { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 },
          highTierWeight: 0,
          leadTier: "T1" as TrustTier
        };

      if (mentionedAt >= currentStart) {
        entry.weighted += mention.weight;
        entry.mentions += 1;
        entry.authors.add(mention.authorUserkey);
        entry.tierWeights[mention.authorTier] += mention.weight;
        if (mention.authorTier === "T4" || mention.authorTier === "T3") {
          entry.highTierWeight += mention.weight;
        }
      } else {
        entry.previousWeighted += mention.weight;
      }

      statsMap.set(mention.projectId, entry);
    }

    const ranked = [...statsMap.values()]
      .filter((entry) => entry.weighted > 0)
      .map((entry) => {
        const shareDenominator = [...statsMap.values()].reduce((sum, item) => sum + item.weighted, 0);
        const share = shareDenominator > 0 ? (entry.weighted / shareDenominator) * 100 : 0;
        const deltaAbsolute = entry.weighted - entry.previousWeighted;
        const deltaRelative =
          entry.previousWeighted > 0 ? ((entry.weighted - entry.previousWeighted) / entry.previousWeighted) * 100 : entry.weighted > 0 ? 100 : 0;

        const leadTier = (Object.entries(entry.tierWeights) as Array<[TrustTier, number]>).sort((left, right) => {
          if (right[1] !== left[1]) {
            return right[1] - left[1];
          }

          return getTrustTierRank(right[0]) - getTrustTierRank(left[0]);
        })[0]?.[0] ?? "T1";

        return {
          ...entry,
          share,
          deltaAbsolute,
          deltaRelative,
          leadTier,
          highTierShare: entry.weighted > 0 ? (entry.highTierWeight / entry.weighted) * 100 : 0
        };
      })
      .sort((left, right) => {
        if (right.weighted !== left.weighted) {
          return right.weighted - left.weighted;
        }

        return right.authors.size - left.authors.size;
      });

    const momentumRanked = [...ranked].sort((left, right) => {
      const leftMomentum = mode === "absolute" ? left.deltaAbsolute : left.deltaRelative;
      const rightMomentum = mode === "absolute" ? right.deltaAbsolute : right.deltaRelative;

      if (rightMomentum !== leftMomentum) {
        return rightMomentum - leftMomentum;
      }

      return right.weighted - left.weighted;
    });

    const gainers = momentumRanked.filter((entry) => (mode === "absolute" ? entry.deltaAbsolute : entry.deltaRelative) > 0).slice(0, 6);
    const losers = [...momentumRanked]
      .filter((entry) => (mode === "absolute" ? entry.deltaAbsolute : entry.deltaRelative) < 0)
      .reverse()
      .slice(0, 6);

    const totalWeighted = ranked.reduce((sum, item) => sum + item.weighted, 0);
    const totalAuthors = ranked.reduce((sum, item) => sum + item.authors.size, 0);
    const highTierShare = totalWeighted > 0 ? (ranked.reduce((sum, item) => sum + item.highTierWeight, 0) / totalWeighted) * 100 : 0;

    return {
      ranked,
      gainers,
      losers,
      totalWeighted,
      totalAuthors,
      highTierShare
    };
  }, [mentions, mode, outcomes, projects, selectedTierFilter.tiers, selectedWindow.days]);

  if (board.ranked.length === 0) {
    return (
      <div className="mindshare-stack">
        <div className="mindshare-toolbar">
          <div className="mindshare-window-tabs">
            {WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.key}
                variant={option.key === windowKey ? "default" : "secondary"}
                className={option.key === windowKey ? "mindshare-window-button mindshare-window-button-active" : "mindshare-window-button"}
                onClick={() => setWindowKey(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mindshare-empty">
          <strong>No live project mindshare yet</strong>
          <span>Collector coverage is still building. Run more sweeps to populate the arena.</span>
        </div>
      </div>
    );
  }

  const tiles = board.ranked.slice(0, 15);

  return (
    <div className="mindshare-stack">
      <div className="mindshare-toolbar">
        <div className="mindshare-control-cluster">
          <div className="mindshare-window-tabs">
            {WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.key}
                variant={option.key === windowKey ? "default" : "secondary"}
                className={option.key === windowKey ? "mindshare-window-button mindshare-window-button-active" : "mindshare-window-button"}
                onClick={() => setWindowKey(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="mindshare-mode-tabs">
            <button
              type="button"
              className={mode === "absolute" ? "mindshare-mode-button mindshare-mode-button-active" : "mindshare-mode-button"}
              onClick={() => setMode("absolute")}
            >
              Absolute
            </button>
            <button
              type="button"
              className={mode === "relative" ? "mindshare-mode-button mindshare-mode-button-active" : "mindshare-mode-button"}
              onClick={() => setMode("relative")}
            >
              Relative
            </button>
          </div>
        </div>
        <div className="mindshare-filter-tabs" aria-label="Tier filter">
          {TIER_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={option.key === tierFilter ? "mindshare-mode-button mindshare-mode-button-active" : "mindshare-mode-button"}
              onClick={() => setTierFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mindshare-kpi-grid">
        <div className="mindshare-kpi-tile">
          <span>Window</span>
          <strong>{selectedWindow.label}</strong>
        </div>
        <div className="mindshare-kpi-tile">
          <span>Weighted mindshare</span>
          <strong>{Math.round(board.totalWeighted)}</strong>
        </div>
        <div className="mindshare-kpi-tile">
          <span>Active authors</span>
          <strong>{board.totalAuthors}</strong>
        </div>
        <div className="mindshare-kpi-tile">
          <span>High-tier share</span>
          <strong>{Math.round(board.highTierShare)}%</strong>
        </div>
      </div>

      <div className="mindshare-arena">
        <aside className="mindshare-sidebar">
          <section className="mindshare-side-card">
            <div className="mindshare-side-header">
              <div>
                <span>Top gainers</span>
                <strong>{mode === "absolute" ? "Weighted attention" : "Growth rate"}</strong>
              </div>
              <span className="mindshare-side-chip">{selectedWindow.label}</span>
            </div>
            <div className="mindshare-side-list">
              {board.gainers.map((entry, index) => (
                <div key={`gainer-${entry.project.id}`} className="mindshare-side-row">
                  <span className="mindshare-side-rank">{index + 1}</span>
                  <div className="mindshare-side-copy">
                    <strong>{entry.project.name}</strong>
                    <span>{formatShare(entry.share)} share</span>
                  </div>
                  <strong className="mindshare-delta mindshare-delta-positive">
                    {formatDelta(mode === "absolute" ? entry.deltaAbsolute : entry.deltaRelative, mode)}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <section className="mindshare-side-card">
            <div className="mindshare-side-header">
              <div>
                <span>Top losers</span>
                <strong>Cooling names</strong>
              </div>
              <span className="mindshare-side-chip">{selectedTierFilter.label}</span>
            </div>
            <div className="mindshare-side-list">
              {board.losers.length > 0 ? (
                board.losers.map((entry, index) => (
                  <div key={`loser-${entry.project.id}`} className="mindshare-side-row">
                    <span className="mindshare-side-rank">{index + 1}</span>
                    <div className="mindshare-side-copy">
                      <strong>{entry.project.name}</strong>
                      <span>{entry.authors.size} authors</span>
                    </div>
                    <strong className="mindshare-delta mindshare-delta-negative">
                      {formatDelta(mode === "absolute" ? entry.deltaAbsolute : entry.deltaRelative, mode)}
                    </strong>
                  </div>
                ))
              ) : (
                <div className="mindshare-side-empty">No negative momentum in this cohort yet.</div>
              )}
            </div>
          </section>
        </aside>

        <div className="mindshare-board">
          {tiles.map((entry, index) => {
            const tone =
              entry.outcome?.return7d && entry.outcome.return7d > 0
                ? "mindshare-positive"
                : entry.outcome?.return7d && entry.outcome.return7d < 0
                  ? "mindshare-negative"
                  : "mindshare-neutral";
            const tileClass = `mindshare-tile ${getTileSize(index)} ${tone}`;
            const totalTierWeight = Object.values(entry.tierWeights).reduce((sum, value) => sum + value, 0);

            return (
              <article key={entry.project.id} className={tileClass}>
                <div className="mindshare-meta">
                  <div className="mindshare-title-row">
                    <div className="mindshare-dot" />
                    <strong>{entry.project.name}</strong>
                  </div>
                  <span className="mindshare-handle">{entry.project.username ? `@${entry.project.username}` : entry.project.aliases[0] ?? "External project"}</span>
                </div>

                <div className="mindshare-body">
                  <div className="mindshare-primary-metric">
                    <strong>{formatShare(entry.share)}</strong>
                    <span>share</span>
                  </div>
                  <div className="mindshare-context-row">
                    <span>{entry.authors.size} authors</span>
                    <strong className={entry.deltaAbsolute > 0 ? "mindshare-delta-positive" : entry.deltaAbsolute < 0 ? "mindshare-delta-negative" : "mindshare-delta-neutral"}>
                      {formatDelta(mode === "absolute" ? entry.deltaAbsolute : entry.deltaRelative, mode)}
                    </strong>
                  </div>
                  <div className="mindshare-context-row">
                    <span>{Math.round(entry.weighted)} weighted</span>
                    <span>{getTierContributionLabel(entry)}</span>
                  </div>
                </div>

                <div className="mindshare-tier-strip" aria-label={`${entry.project.name} tier contribution`}>
                  {(Object.entries(entry.tierWeights) as Array<[TrustTier, number]>).map(([tier, value]) => {
                    const width = totalTierWeight > 0 ? `${(value / totalTierWeight) * 100}%` : "0%";
                    return (
                      <span
                        key={`${entry.project.id}-${tier}`}
                        className={`mindshare-tier-segment mindshare-tier-${tier.toLowerCase()}`}
                        style={{ width }}
                        title={`${getTrustTierLabel(tier)} ${Math.round(value)}`}
                      />
                    );
                  })}
                </div>

                <div className="mindshare-corner">{Math.round(entry.highTierShare)}% high-tier</div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
