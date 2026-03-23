"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProjectMention, ProjectSnapshot, TrustTier } from "@/lib/types/domain";

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
  weighted: number;
  previousWeighted: number;
  authors: Set<string>;
  tierWeights: Record<TrustTier, number>;
  highTierWeight: number;
};

type RankedEntry = ProjectStats & {
  share: number;
  deltaAbsolute: number;
  deltaRelative: number;
  highTierShare: number;
  isOthers?: boolean;
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

type TreemapRect<T> = {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TreemapItem<T> = {
  item: T;
  area: number;
};

function sumAreas<T>(items: TreemapItem<T>[]) {
  return items.reduce((sum, item) => sum + item.area, 0);
}

function worstAspectRatio<T>(row: TreemapItem<T>[], shortSide: number) {
  if (row.length === 0 || shortSide <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const total = sumAreas(row);
  const max = Math.max(...row.map((item) => item.area));
  const min = Math.min(...row.map((item) => item.area));

  return Math.max((shortSide * shortSide * max) / (total * total), (total * total) / (shortSide * shortSide * min));
}

function layoutTreemapRow<T>(
  row: TreemapItem<T>[],
  rect: { x: number; y: number; width: number; height: number }
): { placed: TreemapRect<T>[]; remaining: { x: number; y: number; width: number; height: number } } {
  const total = sumAreas(row);

  if (rect.width >= rect.height) {
    const rowHeight = total / rect.width;
    let x = rect.x;
    const placed = row.map((entry) => {
      const width = entry.area / rowHeight;
      const next = { item: entry.item, x, y: rect.y, width, height: rowHeight };
      x += width;
      return next;
    });

    return {
      placed,
      remaining: {
        x: rect.x,
        y: rect.y + rowHeight,
        width: rect.width,
        height: rect.height - rowHeight
      }
    };
  }

  const rowWidth = total / rect.height;
  let y = rect.y;
  const placed = row.map((entry) => {
    const height = entry.area / rowWidth;
    const next = { item: entry.item, x: rect.x, y, width: rowWidth, height };
    y += height;
    return next;
  });

  return {
    placed,
    remaining: {
      x: rect.x + rowWidth,
      y: rect.y,
      width: rect.width - rowWidth,
      height: rect.height
    }
  };
}

function createTreemapLayout<T>(items: Array<{ item: T; value: number }>, width = 100, height = 100) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return [] as TreemapRect<T>[];
  }

  const scale = (width * height) / total;
  const remainingItems: TreemapItem<T>[] = items
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .map((item) => ({ item: item.item, area: item.value * scale }));

  const placed: TreemapRect<T>[] = [];
  let row: TreemapItem<T>[] = [];
  let rect = { x: 0, y: 0, width, height };

  while (remainingItems.length > 0 && rect.width > 0 && rect.height > 0) {
    const candidate = remainingItems[0];
    const shortSide = Math.min(rect.width, rect.height);
    const candidateRatio = worstAspectRatio([...row, candidate], shortSide);
    const currentRatio = worstAspectRatio(row, shortSide);

    if (row.length === 0 || candidateRatio <= currentRatio) {
      row.push(candidate);
      remainingItems.shift();
      continue;
    }

    const next = layoutTreemapRow(row, rect);
    placed.push(...next.placed);
    rect = next.remaining;
    row = [];
  }

  if (row.length > 0 && rect.width > 0 && rect.height > 0) {
    const next = layoutTreemapRow(row, rect);
    placed.push(...next.placed);
  }

  return placed;
}

function getTreemapScaleClass(share: number) {
  if (share >= 14) {
    return "mindshare-scale-hero";
  }

  if (share >= 7) {
    return "mindshare-scale-large";
  }

  if (share >= 3) {
    return "mindshare-scale-medium";
  }

  return "mindshare-scale-small";
}

function createOthersProject(): ProjectSnapshot {
  return {
    id: "others",
    projectId: -1,
    userkey: "external:others",
    name: "Others",
    username: null,
    description: null,
    categories: [],
    chains: [],
    totalVotes: 0,
    uniqueVoters: 0,
    bullishVotes: 0,
    bearishVotes: 0,
    commentCount: 0,
    aliases: []
  };
}

function mergeTreemapEntries(entries: RankedEntry[]) {
  if (entries.length <= 1) {
    return entries;
  }

  const authors = new Set<string>();
  const tierWeights: Record<TrustTier, number> = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 };

  for (const entry of entries) {
    for (const author of entry.authors) {
      authors.add(author);
    }

    for (const tier of Object.keys(tierWeights) as TrustTier[]) {
      tierWeights[tier] += entry.tierWeights[tier];
    }
  }

  const weighted = entries.reduce((sum, entry) => sum + entry.weighted, 0);
  const previousWeighted = entries.reduce((sum, entry) => sum + entry.previousWeighted, 0);
  const highTierWeight = entries.reduce((sum, entry) => sum + entry.highTierWeight, 0);
  const deltaAbsolute = weighted - previousWeighted;
  const deltaRelative = previousWeighted > 0 ? ((weighted - previousWeighted) / previousWeighted) * 100 : weighted > 0 ? 100 : 0;

  return [
    {
      project: createOthersProject(),
      weighted,
      previousWeighted,
      authors,
      tierWeights,
      highTierWeight,
      share: entries.reduce((sum, entry) => sum + entry.share, 0),
      deltaAbsolute,
      deltaRelative,
      highTierShare: weighted > 0 ? (highTierWeight / weighted) * 100 : 0,
      isOthers: true
    }
  ];
}

function shouldMergeTile(entry: RankedEntry, rect: TreemapRect<RankedEntry>) {
  return !entry.isOthers && entry.share < 2;
}

function buildDisplayTreemap(entries: RankedEntry[]) {
  let working = [...entries];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const treemap = createTreemapLayout(working.map((entry) => ({ item: entry, value: entry.share })));
    const mergeTargets = treemap.filter((rect) => shouldMergeTile(rect.item, rect));

    if (mergeTargets.length === 0) {
      return treemap;
    }

    const mergeIds = new Set(mergeTargets.map((rect) => rect.item.project.id));
    const keep = working.filter((entry) => !mergeIds.has(entry.project.id));
    const merged = mergeTreemapEntries(working.filter((entry) => mergeIds.has(entry.project.id)));
    working = [...keep, ...merged].sort((left, right) => right.share - left.share);
  }

  return createTreemapLayout(working.map((entry) => ({ item: entry, value: entry.share })));
}

export function ProjectMindshareBoard({
  projects,
  mentions
}: {
  projects: ProjectSnapshot[];
  mentions: ProjectMention[];
}) {
  const [windowKey, setWindowKey] = useState<MindshareWindow>("90d");
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
          weighted: 0,
          previousWeighted: 0,
          authors: new Set<string>(),
          tierWeights: { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 },
          highTierWeight: 0
        };

      if (mentionedAt >= currentStart) {
        entry.weighted += mention.weight;
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

    const shareDenominator = [...statsMap.values()].reduce((sum, item) => sum + item.weighted, 0);
    const ranked: RankedEntry[] = [...statsMap.values()]
      .filter((entry) => entry.weighted > 0)
      .map((entry) => {
        const share = shareDenominator > 0 ? (entry.weighted / shareDenominator) * 100 : 0;
        const deltaAbsolute = entry.weighted - entry.previousWeighted;
        const deltaRelative =
          entry.previousWeighted > 0 ? ((entry.weighted - entry.previousWeighted) / entry.previousWeighted) * 100 : entry.weighted > 0 ? 100 : 0;

        return {
          ...entry,
          share,
          deltaAbsolute,
          deltaRelative,
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
  }, [mentions, mode, projects, selectedTierFilter.tiers, selectedWindow.days]);

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

  const tiles = board.ranked.slice(0, 20);
  const treemap = useMemo(() => buildDisplayTreemap(tiles), [tiles]);

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
          {treemap.map(({ item: entry, x, y, width, height }) => {
            const momentumValue = mode === "absolute" ? entry.deltaAbsolute : entry.deltaRelative;
            const tone = momentumValue > 0 ? "mindshare-positive" : momentumValue < 0 ? "mindshare-negative" : "mindshare-neutral";
            const tileClass = `mindshare-tile ${tone} ${getTreemapScaleClass(entry.share)}`;

            return (
              <div
                key={entry.project.id}
                className="mindshare-tile-shell"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${width}%`,
                  height: `${height}%`
                }}
              >
                <article className={tileClass}>
                  <div className="mindshare-meta">
                    <div className="mindshare-title-row">
                      <div className="mindshare-dot" />
                      <strong>{entry.project.name}</strong>
                    </div>
                  </div>

                  <div className="mindshare-share">{formatShare(entry.share)}</div>
                  <div className="mindshare-wave" aria-hidden="true" />
                  <div className="mindshare-corner">{Math.round(entry.highTierShare)}% high-tier</div>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
