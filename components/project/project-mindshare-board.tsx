"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProjectMention, ProjectSnapshot, TrustTier } from "@/lib/types/domain";

type MindshareWindow = "1d" | "7d" | "30d" | "90d";
type MindshareTierFilter = "all" | "high" | "mid" | "t1" | "t0";
type WindowDays = 1 | 7 | 30 | 90;

type WindowMetrics = {
  currentWeight: number;
  previousWeight: number;
  share: number;
  deltaAbsolute: number;
  deltaRelative: number;
};

type RankedEntry = {
  project: ProjectSnapshot;
  currentWeight: number;
  share: number;
  selectedDeltaAbsolute: number;
  selectedDeltaRelative: number;
  highTierShare: number;
  authors: Set<string>;
  sparkline: number[];
  metricsByWindow: Record<WindowDays, WindowMetrics>;
  isOthers?: boolean;
};

type TreemapRect<T> = {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
};

const WINDOW_OPTIONS: Array<{ key: MindshareWindow; label: string; days: WindowDays }> = [
  { key: "1d", label: "24H", days: 1 },
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "3M", days: 90 }
];

const TIER_FILTERS: Array<{ key: MindshareTierFilter; label: string; tiers: TrustTier[] | null }> = [
  { key: "all", label: "All tiers", tiers: null },
  { key: "high", label: "Challenger + Diamond", tiers: ["T4", "T3"] },
  { key: "mid", label: "Platinum", tiers: ["T2"] },
  { key: "t1", label: "Gold", tiers: ["T1"] },
  { key: "t0", label: "Bronze", tiers: ["T0"] }
];

const WINDOW_DAY_VALUES: WindowDays[] = [1, 7, 30, 90];
const SPARKLINE_BINS = 18;

function formatShare(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function sumAreas<T>(items: Array<{ item: T; area: number }>) {
  return items.reduce((sum, item) => sum + item.area, 0);
}

function worstAspectRatio<T>(row: Array<{ item: T; area: number }>, shortSide: number) {
  if (row.length === 0 || shortSide <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const total = sumAreas(row);
  const max = Math.max(...row.map((item) => item.area));
  const min = Math.min(...row.map((item) => item.area));

  return Math.max((shortSide * shortSide * max) / (total * total), (total * total) / (shortSide * shortSide * min));
}

function layoutTreemapRow<T>(
  row: Array<{ item: T; area: number }>,
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
  const remainingItems = items
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .map((item) => ({ item: item.item, area: item.value * scale }));

  const placed: TreemapRect<T>[] = [];
  let row: Array<{ item: T; area: number }> = [];
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

function mergeTreemapEntries(entries: RankedEntry[], selectedWindow: WindowDays): RankedEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const authors = new Set<string>();
  const metricsByWindow = Object.fromEntries(
    WINDOW_DAY_VALUES.map((days) => [
      days,
      {
        currentWeight: 0,
        previousWeight: 0,
        share: 0,
        deltaAbsolute: 0,
        deltaRelative: 0
      }
    ])
  ) as Record<WindowDays, WindowMetrics>;
  const sparkline = Array.from({ length: SPARKLINE_BINS }, () => 0);

  let currentWeight = 0;
  let highTierWeighted = 0;

  for (const entry of entries) {
    for (const author of entry.authors) {
      authors.add(author);
    }

    currentWeight += entry.currentWeight;
    highTierWeighted += (entry.highTierShare / 100) * entry.currentWeight;

    for (const days of WINDOW_DAY_VALUES) {
      metricsByWindow[days].currentWeight += entry.metricsByWindow[days].currentWeight;
      metricsByWindow[days].previousWeight += entry.metricsByWindow[days].previousWeight;
    }

    entry.sparkline.forEach((value, index) => {
      sparkline[index] += value;
    });
  }

  for (const days of WINDOW_DAY_VALUES) {
    const current = metricsByWindow[days].currentWeight;
    const previous = metricsByWindow[days].previousWeight;
    metricsByWindow[days].share = entries.reduce((sum, entry) => sum + entry.metricsByWindow[days].share, 0);
    metricsByWindow[days].deltaAbsolute = current - previous;
    metricsByWindow[days].deltaRelative = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  }

  return [
    {
      project: createOthersProject(),
      currentWeight,
      share: entries.reduce((sum, entry) => sum + entry.share, 0),
      selectedDeltaAbsolute: metricsByWindow[selectedWindow].deltaAbsolute,
      selectedDeltaRelative: metricsByWindow[selectedWindow].deltaRelative,
      highTierShare: currentWeight > 0 ? (highTierWeighted / currentWeight) * 100 : 0,
      authors,
      sparkline,
      metricsByWindow,
      isOthers: true
    }
  ];
}

function buildDisplayTreemap(entries: RankedEntry[], selectedWindow: WindowDays) {
  let working = [...entries];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const treemap = createTreemapLayout(working.map((entry) => ({ item: entry, value: entry.share })));
    const mergeTargets = treemap.filter((rect) => !rect.item.isOthers && rect.item.share < 2);

    if (mergeTargets.length === 0) {
      return treemap;
    }

    const mergeIds = new Set(mergeTargets.map((rect) => rect.item.project.id));
    const keep = working.filter((entry) => !mergeIds.has(entry.project.id));
    const merged = mergeTreemapEntries(working.filter((entry) => mergeIds.has(entry.project.id)), selectedWindow);
    working = [...keep, ...merged].sort((left, right) => right.share - left.share);
  }

  return createTreemapLayout(working.map((entry) => ({ item: entry, value: entry.share })));
}

function getTreemapScaleClass(share: number) {
  if (share >= 14) return "mindshare-scale-hero";
  if (share >= 7) return "mindshare-scale-large";
  if (share >= 3) return "mindshare-scale-medium";
  return "mindshare-scale-small";
}

function getTileSpan(share: number, maxShare: number) {
  const normalized = Math.max(share / Math.max(maxShare, 1), 0.12);
  const targetArea = Math.max(4, Math.min(36, Math.round(normalized * 36)));
  const cols = Math.max(2, Math.min(6, Math.round(Math.sqrt(targetArea))));
  const rows = Math.max(2, Math.min(6, Math.ceil(targetArea / cols)));

  return { cols, rows };
}

export function ProjectMindshareBoard({
  projects,
  mentions
}: {
  projects: ProjectSnapshot[];
  mentions: ProjectMention[];
}) {
  const [windowKey, setWindowKey] = useState<MindshareWindow>("90d");
  const [tierFilter, setTierFilter] = useState<MindshareTierFilter>("all");

  const selectedWindow = WINDOW_OPTIONS.find((option) => option.key === windowKey) ?? WINDOW_OPTIONS[3];
  const selectedTierFilter = TIER_FILTERS.find((option) => option.key === tierFilter) ?? TIER_FILTERS[0];

  const board = useMemo(() => {
    const now = Date.now();
    const longestWindowMs = 90 * 24 * 60 * 60 * 1000;
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const mentionBuckets = new Map<string, ProjectMention[]>();
    const allowedTiers = selectedTierFilter.tiers ? new Set(selectedTierFilter.tiers) : null;

    for (const mention of mentions) {
      if (allowedTiers && !allowedTiers.has(mention.authorTier)) {
        continue;
      }

      const mentionedAt = new Date(mention.mentionedAt).getTime();
      if (mentionedAt < now - longestWindowMs * 2) {
        continue;
      }

      const project = projectMap.get(mention.projectId);
      if (!project) {
        continue;
      }

      const bucket = mentionBuckets.get(mention.projectId) ?? [];
      bucket.push(mention);
      mentionBuckets.set(mention.projectId, bucket);
    }

    const totalsByWindow = Object.fromEntries(WINDOW_DAY_VALUES.map((days) => [days, 0])) as Record<WindowDays, number>;
    const projectWeights = new Map<
      string,
      {
        current: Record<WindowDays, number>;
        previous: Record<WindowDays, number>;
      }
    >();

    for (const [projectId, projectMentions] of mentionBuckets.entries()) {
      const current = Object.fromEntries(WINDOW_DAY_VALUES.map((days) => [days, 0])) as Record<WindowDays, number>;
      const previous = Object.fromEntries(WINDOW_DAY_VALUES.map((days) => [days, 0])) as Record<WindowDays, number>;

      for (const mention of projectMentions) {
        const mentionedAt = new Date(mention.mentionedAt).getTime();

        for (const days of WINDOW_DAY_VALUES) {
          const windowMs = days * 24 * 60 * 60 * 1000;
          const currentStart = now - windowMs;
          const previousStart = now - windowMs * 2;

          if (mentionedAt >= currentStart) {
            current[days] += mention.weight;
            totalsByWindow[days] += mention.weight;
          } else if (mentionedAt >= previousStart) {
            previous[days] += mention.weight;
          }
        }
      }

      projectWeights.set(projectId, { current, previous });
    }

    const ranked: RankedEntry[] = [...mentionBuckets.entries()]
      .map(([projectId, projectMentions]) => {
        const project = projectMap.get(projectId);
        const weights = projectWeights.get(projectId);
        if (!project || !weights) {
          return null;
        }

        const authors = new Set<string>();
        let highTierWeight = 0;

        for (const mention of projectMentions) {
          if (new Date(mention.mentionedAt).getTime() >= now - selectedWindow.days * 24 * 60 * 60 * 1000) {
            authors.add(mention.authorUserkey);
            if (mention.authorTier === "T4" || mention.authorTier === "T3") {
              highTierWeight += mention.weight;
            }
          }
        }

        const metricsByWindow = Object.fromEntries(
          WINDOW_DAY_VALUES.map((days) => {
            const currentWeight = weights.current[days];
            const previousWeight = weights.previous[days];
            const share = totalsByWindow[days] > 0 ? (currentWeight / totalsByWindow[days]) * 100 : 0;
            const deltaAbsolute = currentWeight - previousWeight;
            const deltaRelative = previousWeight > 0 ? ((currentWeight - previousWeight) / previousWeight) * 100 : currentWeight > 0 ? 100 : 0;

            return [
              days,
              {
                currentWeight,
                previousWeight,
                share,
                deltaAbsolute,
                deltaRelative
              }
            ];
          })
        ) as Record<WindowDays, WindowMetrics>;

        const selectedMetrics = metricsByWindow[selectedWindow.days];
        const sparkline = Array.from({ length: SPARKLINE_BINS }, () => 0);
        const selectedWindowMs = selectedWindow.days * 24 * 60 * 60 * 1000;
        const selectedStart = now - selectedWindowMs;

        for (const mention of projectMentions) {
          const mentionedAt = new Date(mention.mentionedAt).getTime();
          if (mentionedAt < selectedStart) {
            continue;
          }

          const progress = (mentionedAt - selectedStart) / selectedWindowMs;
          const clamped = Math.max(0, Math.min(SPARKLINE_BINS - 1, Math.floor(progress * SPARKLINE_BINS)));
          sparkline[clamped] += mention.weight;
        }

        return {
          project,
          currentWeight: selectedMetrics.currentWeight,
          share: selectedMetrics.share,
          selectedDeltaAbsolute: selectedMetrics.deltaAbsolute,
          selectedDeltaRelative: selectedMetrics.deltaRelative,
          highTierShare: selectedMetrics.currentWeight > 0 ? (highTierWeight / selectedMetrics.currentWeight) * 100 : 0,
          authors,
          sparkline,
          metricsByWindow
        };
      })
      .filter((entry): entry is RankedEntry => Boolean(entry))
      .filter((entry) => entry.currentWeight > 0)
      .sort((left, right) => {
        if (right.currentWeight !== left.currentWeight) {
          return right.currentWeight - left.currentWeight;
        }

        return right.authors.size - left.authors.size;
      });

    const totalWeighted = ranked.reduce((sum, item) => sum + item.currentWeight, 0);
    const totalAuthors = ranked.reduce((sum, item) => sum + item.authors.size, 0);
    const highTierShare =
      totalWeighted > 0 ? (ranked.reduce((sum, item) => sum + (item.highTierShare / 100) * item.currentWeight, 0) / totalWeighted) * 100 : 0;

    return {
      ranked,
      totalWeighted,
      totalAuthors,
      highTierShare
    };
  }, [mentions, projects, selectedTierFilter.tiers, selectedWindow.days]);

  const topTwenty = board.ranked.slice(0, 20);
  const treemap = useMemo(() => buildDisplayTreemap(topTwenty, selectedWindow.days), [selectedWindow.days, topTwenty]);
  const maxShare = treemap.reduce((max, rect) => Math.max(max, rect.item.share), 0);

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

        <div className="mindshare-filter-tabs">
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

      <div className="mindshare-context-row">
        <span>{selectedWindow.label} cohort window</span>
        <strong>{Math.round(board.totalWeighted)} weighted</strong>
        <span>{board.totalAuthors} active authors</span>
        <strong>{Math.round(board.highTierShare)}% high-tier</strong>
      </div>

      <div className="mindshare-grid-board">
        {treemap.map(({ item: entry }) => {
          const momentumValue = entry.selectedDeltaRelative;
          const tone = momentumValue > 0 ? "mindshare-positive" : momentumValue < 0 ? "mindshare-negative" : "mindshare-neutral";
          const span = getTileSpan(entry.share, maxShare);

          return (
            <article
              key={entry.project.id}
              className={`mindshare-grid-tile ${tone} ${getTreemapScaleClass(entry.share)}`}
              style={{
                gridColumn: `span ${span.cols}`,
                gridRow: `span ${span.rows}`
              }}
            >
              <div className="mindshare-meta">
                <div className="mindshare-title-row">
                  <div className="mindshare-dot" />
                  <strong>{entry.project.name}</strong>
                </div>
              </div>
              <div className="mindshare-share">{formatShare(entry.share)}</div>
              <div className="mindshare-corner">{Math.round(entry.highTierShare)}% high-tier</div>
              <div className="mindshare-sparkline" aria-hidden="true">
                {entry.sparkline.map((value, index) => {
                  const max = Math.max(...entry.sparkline, 1);
                  const heightPct = `${Math.max(8, (value / max) * 100)}%`;
                  return <span key={`${entry.project.id}-spark-${index}`} className="mindshare-spark-bar" style={{ height: heightPct }} />;
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
