"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type Sentiment = "positive" | "negative" | "neutral";

type RankedEntry = {
  project: ProjectSnapshot;
  currentWeight: number;
  mentionCount: number;
  share: number;
  selectedDeltaAbsolute: number;
  selectedDeltaRelative: number;
  delta24hRelative: number;
  highTierShare: number;
  sentiment: Sentiment;
  rank: number;
  authors: Set<string>;
  trend: number[];
  metricsByWindow: Record<WindowDays, WindowMetrics>;
  isOthers?: boolean;
};

type MindshareGridTile<T> = {
  item: T;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

type MindshareGridLayout<T> = {
  tiles: MindshareGridTile<T>[];
  width: number;
  columns: number;
  rowHeight: number;
  rows: number;
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
const SPARKLINE_BINS = 24;
const MAX_VISIBLE_ITEMS = 20;

function formatShare(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function sumValues<T>(items: Array<{ item: T; value: number }>) {
  return items.reduce((sum, item) => sum + item.value, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMindshareColumns(width: number) {
  if (width >= 1440) return 12;
  if (width >= 1180) return 10;
  if (width >= 920) return 8;
  if (width >= 720) return 6;
  return 4;
}

function getMindshareRowHeight(width: number, columns: number) {
  return Math.max(72, Math.round((width / columns) * 0.82));
}

function getSpanCandidates(value: number, index: number, columns: number) {
  const candidates: Array<{ colSpan: number; rowSpan: number }> = [];
  const add = (colSpan: number, rowSpan: number) => {
    if (colSpan > columns || colSpan <= 0 || rowSpan <= 0) {
      return;
    }

    if (!candidates.some((candidate) => candidate.colSpan === colSpan && candidate.rowSpan === rowSpan)) {
      candidates.push({ colSpan, rowSpan });
    }
  };

  if (index === 0) {
    add(columns >= 10 ? 4 : columns >= 8 ? 3 : 2, 4);
    add(columns >= 10 ? 4 : 3, 3);
    add(3, 3);
  } else if (index <= 2) {
    add(columns >= 10 ? 4 : 3, 3);
    add(3, 3);
    add(3, 2);
  } else if (value >= 6) {
    add(3, 3);
    add(3, 2);
    add(2, 3);
  } else if (value >= 3.5) {
    add(3, 2);
    add(2, 3);
    add(2, 2);
  } else if (value >= 2) {
    add(2, 2);
    add(2, 3);
    add(1, 2);
  } else {
    add(2, 2);
    add(1, 2);
    add(1, 1);
  }

  add(2, 2);
  add(1, 2);
  add(1, 1);
  return candidates;
}

function canPlaceInGrid(occupancy: boolean[][], rowStart: number, colStart: number, colSpan: number, rowSpan: number, columns: number) {
  if (colStart + colSpan > columns) {
    return false;
  }

  for (let row = rowStart; row < rowStart + rowSpan; row += 1) {
    for (let col = colStart; col < colStart + colSpan; col += 1) {
      if (occupancy[row]?.[col]) {
        return false;
      }
    }
  }

  return true;
}

function fillGridCells(occupancy: boolean[][], rowStart: number, colStart: number, colSpan: number, rowSpan: number) {
  for (let row = rowStart; row < rowStart + rowSpan; row += 1) {
    for (let col = colStart; col < colStart + colSpan; col += 1) {
      occupancy[row][col] = true;
    }
  }
}

function clearGridCells(occupancy: boolean[][], rowStart: number, colStart: number, colSpan: number, rowSpan: number) {
  for (let row = rowStart; row < rowStart + rowSpan; row += 1) {
    for (let col = colStart; col < colStart + colSpan; col += 1) {
      occupancy[row][col] = false;
    }
  }
}

function canExpandRight(tile: MindshareGridTile<unknown>, occupancy: boolean[][], columns: number) {
  const colIndex = tile.colStart - 1 + tile.colSpan;
  if (colIndex >= columns) {
    return false;
  }

  for (let row = tile.rowStart - 1; row < tile.rowStart - 1 + tile.rowSpan; row += 1) {
    if (occupancy[row]?.[colIndex]) {
      return false;
    }
  }

  return true;
}

function canExpandLeft(tile: MindshareGridTile<unknown>, occupancy: boolean[][]) {
  const colIndex = tile.colStart - 2;
  if (colIndex < 0) {
    return false;
  }

  for (let row = tile.rowStart - 1; row < tile.rowStart - 1 + tile.rowSpan; row += 1) {
    if (occupancy[row]?.[colIndex]) {
      return false;
    }
  }

  return true;
}

function canExpandDown(tile: MindshareGridTile<unknown>, occupancy: boolean[][], maxRows: number) {
  const rowIndex = tile.rowStart - 1 + tile.rowSpan;
  if (rowIndex >= maxRows) {
    return false;
  }

  for (let col = tile.colStart - 1; col < tile.colStart - 1 + tile.colSpan; col += 1) {
    if (occupancy[rowIndex]?.[col]) {
      return false;
    }
  }

  return true;
}

function canExpandUp(tile: MindshareGridTile<unknown>, occupancy: boolean[][]) {
  const rowIndex = tile.rowStart - 2;
  if (rowIndex < 0) {
    return false;
  }

  for (let col = tile.colStart - 1; col < tile.colStart - 1 + tile.colSpan; col += 1) {
    if (occupancy[rowIndex]?.[col]) {
      return false;
    }
  }

  return true;
}

function getAspectScore(colSpan: number, rowSpan: number, cellWidth: number, rowHeight: number) {
  const aspect = (colSpan * cellWidth) / Math.max(rowSpan * rowHeight, 1);
  return Math.abs(aspect - 1.35);
}

function expandMindshareTiles(
  tiles: MindshareGridTile<unknown>[],
  occupancy: boolean[][],
  columns: number,
  maxRows: number,
  cellWidth: number,
  rowHeight: number
) {
  let changed = true;

  while (changed) {
    changed = false;

    for (const tile of tiles) {
      const canGrowLeft = canExpandLeft(tile, occupancy);
      const canGrowRight = canExpandRight(tile, occupancy, columns);
      const canGrowUp = canExpandUp(tile, occupancy);
      const canGrowDown = canExpandDown(tile, occupancy, maxRows);
      if (!canGrowLeft && !canGrowRight && !canGrowUp && !canGrowDown) {
        continue;
      }

      const options = [
        canGrowLeft
          ? {
              direction: "left" as const,
              score: getAspectScore(tile.colSpan + 1, tile.rowSpan, cellWidth, rowHeight)
            }
          : null,
        canGrowRight
          ? {
              direction: "right" as const,
              score: getAspectScore(tile.colSpan + 1, tile.rowSpan, cellWidth, rowHeight)
            }
          : null,
        canGrowUp
          ? {
              direction: "up" as const,
              score: getAspectScore(tile.colSpan, tile.rowSpan + 1, cellWidth, rowHeight)
            }
          : null,
        canGrowDown
          ? {
              direction: "down" as const,
              score: getAspectScore(tile.colSpan, tile.rowSpan + 1, cellWidth, rowHeight)
            }
          : null
      ].filter((option): option is { direction: "left" | "right" | "up" | "down"; score: number } => Boolean(option));

      options.sort((left, right) => left.score - right.score);
      const selected = options[0];
      if (!selected) {
        continue;
      }

      clearGridCells(occupancy, tile.rowStart - 1, tile.colStart - 1, tile.colSpan, tile.rowSpan);

      if (selected.direction === "left") {
        tile.colStart -= 1;
        tile.colSpan += 1;
      } else if (selected.direction === "right") {
        tile.colSpan += 1;
      } else if (selected.direction === "up") {
        tile.rowStart -= 1;
        tile.rowSpan += 1;
      } else {
        tile.rowSpan += 1;
      }

      fillGridCells(occupancy, tile.rowStart - 1, tile.colStart - 1, tile.colSpan, tile.rowSpan);
      changed = true;
    }
  }
}

function createMindshareGrid<T>(items: Array<{ item: T; value: number }>, width = 1000): MindshareGridLayout<T> {
  const columns = getMindshareColumns(width);
  const rowHeight = getMindshareRowHeight(width, columns);

  if (items.length === 0 || width <= 0) {
    return { tiles: [], width, columns, rowHeight, rows: 0 };
  }

  const occupancy: boolean[][] = [];
  const tiles: MindshareGridTile<T>[] = [];
  let maxRow = 0;

  const ensureRows = (count: number) => {
    while (occupancy.length < count) {
      occupancy.push(Array.from({ length: columns }, () => false));
    }
  };

  for (const [index, entry] of items.entries()) {
    const candidates = getSpanCandidates(entry.value, index, columns);
    let placed = false;

    for (const candidate of candidates) {
      for (let row = 0; row <= maxRow + 8 && !placed; row += 1) {
        ensureRows(row + candidate.rowSpan);

        for (let col = 0; col <= columns - candidate.colSpan; col += 1) {
          if (!canPlaceInGrid(occupancy, row, col, candidate.colSpan, candidate.rowSpan, columns)) {
            continue;
          }

          fillGridCells(occupancy, row, col, candidate.colSpan, candidate.rowSpan);
          tiles.push({
            item: entry.item,
            colStart: col + 1,
            rowStart: row + 1,
            colSpan: candidate.colSpan,
            rowSpan: candidate.rowSpan
          });
          maxRow = Math.max(maxRow, row + candidate.rowSpan);
          placed = true;
          break;
        }
      }

      if (placed) {
        break;
      }
    }
  }

  expandMindshareTiles(
    tiles as MindshareGridTile<unknown>[],
    occupancy,
    columns,
    maxRow,
    width / columns,
    rowHeight
  );

  return {
    tiles,
    width,
    columns,
    rowHeight,
    rows: maxRow
  };
}

function getTreemapScaleClass(share: number) {
  if (share >= 14) return "mindshare-scale-hero";
  if (share >= 7) return "mindshare-scale-large";
  if (share >= 3) return "mindshare-scale-medium";
  return "mindshare-scale-small";
}

function getSentiment(deltaRelative: number, currentWeight: number): Sentiment {
  if (currentWeight <= 0) {
    return "neutral";
  }

  if (deltaRelative >= 8) {
    return "positive";
  }

  if (deltaRelative <= -8) {
    return "negative";
  }

  return "neutral";
}

function buildSparklinePath(trend: number[]) {
  if (trend.length === 0) {
    return "";
  }

  const max = Math.max(...trend, 1);
  return trend
    .map((value, index) => {
      const x = trend.length === 1 ? 50 : (index / (trend.length - 1)) * 100;
      const y = 28 - (value / max) * 24 - 2;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function formatDelta(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}%`;
}

function getRankTone(rank: number) {
  if (rank === 1) return "mindshare-rank-gold";
  if (rank === 2) return "mindshare-rank-silver";
  if (rank === 3) return "mindshare-rank-bronze";
  return "mindshare-rank-default";
}

function getRankLabel(entry: RankedEntry) {
  return entry.isOthers ? "OT" : `#${entry.rank}`;
}

function createOthersProject(): ProjectSnapshot {
  return {
    id: "others",
    projectId: -1,
    userkey: "external:others",
    name: "Others",
    logoUrl: null,
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

function createOthersEntry(entries: RankedEntry[], rank: number): RankedEntry | null {
  if (entries.length === 0) {
    return null;
  }

  const authors = new Set<string>();
  const trend = Array.from({ length: SPARKLINE_BINS }, () => 0);
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

  let currentWeight = 0;
  let mentionCount = 0;
  let weightedHighTier = 0;

  for (const entry of entries) {
    currentWeight += entry.currentWeight;
    mentionCount += entry.mentionCount;
    weightedHighTier += (entry.highTierShare / 100) * entry.currentWeight;
    entry.authors.forEach((author) => authors.add(author));
    entry.trend.forEach((value, index) => {
      trend[index] += value;
    });

    for (const days of WINDOW_DAY_VALUES) {
      metricsByWindow[days].currentWeight += entry.metricsByWindow[days].currentWeight;
      metricsByWindow[days].previousWeight += entry.metricsByWindow[days].previousWeight;
      metricsByWindow[days].share += entry.metricsByWindow[days].share;
    }
  }

  for (const days of WINDOW_DAY_VALUES) {
    const metric = metricsByWindow[days];
    metric.deltaAbsolute = metric.currentWeight - metric.previousWeight;
    metric.deltaRelative =
      metric.previousWeight > 0 ? ((metric.currentWeight - metric.previousWeight) / metric.previousWeight) * 100 : metric.currentWeight > 0 ? 100 : 0;
  }

  return {
    project: createOthersProject(),
    currentWeight,
    mentionCount,
    share: entries.reduce((sum, entry) => sum + entry.share, 0),
    selectedDeltaAbsolute: entries.reduce((sum, entry) => sum + entry.selectedDeltaAbsolute, 0),
    selectedDeltaRelative:
      entries.reduce((sum, entry) => sum + entry.currentWeight * entry.selectedDeltaRelative, 0) / Math.max(currentWeight, 1),
    delta24hRelative:
      entries.reduce((sum, entry) => sum + entry.currentWeight * entry.delta24hRelative, 0) / Math.max(currentWeight, 1),
    highTierShare: currentWeight > 0 ? (weightedHighTier / currentWeight) * 100 : 0,
    sentiment: getSentiment(
      entries.reduce((sum, entry) => sum + entry.currentWeight * entry.delta24hRelative, 0) / Math.max(currentWeight, 1),
      currentWeight
    ),
    rank,
    authors,
    trend,
    metricsByWindow,
    isOthers: true
  };
}

function getLayoutValue(entries: RankedEntry[], entry: RankedEntry) {
  if (!entry.isOthers) {
    return entry.share;
  }

  const regular = entries.filter((item) => !item.isOthers);
  const anchorA = regular[4]?.share ?? regular[regular.length - 1]?.share ?? entry.share;
  const anchorB = regular[5]?.share ?? anchorA;
  const cap = Math.max(anchorA * 1.18, anchorB * 1.28, 4.8);
  return Math.min(entry.share, cap);
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
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardWidth, setBoardWidth] = useState(1000);
  const [hovered, setHovered] = useState<{ entry: RankedEntry; x: number; y: number } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<RankedEntry | null>(null);

  useEffect(() => {
    const node = boardRef.current;
    if (!node) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.max(node.clientWidth, 1);
      setBoardWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

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

    const rankedBase = [...mentionBuckets.entries()]
      .map(([projectId, projectMentions]) => {
        const project = projectMap.get(projectId);
        const weights = projectWeights.get(projectId);
        if (!project || !weights) {
          return null;
        }

        const authors = new Set<string>();
        let highTierWeight = 0;
        let mentionCount = 0;

        for (const mention of projectMentions) {
          if (new Date(mention.mentionedAt).getTime() >= now - selectedWindow.days * 24 * 60 * 60 * 1000) {
            authors.add(mention.authorUserkey);
            mentionCount += 1;
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
        const trend = Array.from({ length: SPARKLINE_BINS }, () => 0);
        const trendWindowMs = 24 * 60 * 60 * 1000;
        const trendStart = now - trendWindowMs;

        for (const mention of projectMentions) {
          const mentionedAt = new Date(mention.mentionedAt).getTime();
          if (mentionedAt < trendStart) {
            continue;
          }

          const progress = (mentionedAt - trendStart) / trendWindowMs;
          const clamped = Math.max(0, Math.min(SPARKLINE_BINS - 1, Math.floor(progress * SPARKLINE_BINS)));
          trend[clamped] += mention.weight;
        }

        return {
          project,
          currentWeight: selectedMetrics.currentWeight,
          mentionCount,
          share: selectedMetrics.share,
          selectedDeltaAbsolute: selectedMetrics.deltaAbsolute,
          selectedDeltaRelative: selectedMetrics.deltaRelative,
          delta24hRelative: metricsByWindow[1].deltaRelative,
          highTierShare: selectedMetrics.currentWeight > 0 ? (highTierWeight / selectedMetrics.currentWeight) * 100 : 0,
          sentiment: getSentiment(metricsByWindow[1].deltaRelative, selectedMetrics.currentWeight),
          rank: 0,
          authors,
          trend,
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

    const ranked: RankedEntry[] = rankedBase.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

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

  const visibleEntries = useMemo(() => {
    const leaders = board.ranked.slice(0, MAX_VISIBLE_ITEMS - 1);
    const remainder = board.ranked.slice(MAX_VISIBLE_ITEMS - 1);
    const others = createOthersEntry(remainder, MAX_VISIBLE_ITEMS);
    return others ? [...leaders, others] : board.ranked.slice(0, MAX_VISIBLE_ITEMS);
  }, [board.ranked]);
  const arrangedEntries = useMemo(() => {
    const others = visibleEntries.find((entry) => entry.isOthers);
    if (!others) {
      return visibleEntries;
    }

    const regular = visibleEntries.filter((entry) => !entry.isOthers);
    return [...regular.slice(0, 12), others, ...regular.slice(12)];
  }, [visibleEntries]);
  const boardInnerWidth = Math.max(boardWidth - 4, 1);
  const layout = useMemo(
    () => createMindshareGrid(arrangedEntries.map((entry) => ({ item: entry, value: getLayoutValue(arrangedEntries, entry) })), boardInnerWidth),
    [arrangedEntries, boardInnerWidth]
  );

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
        {board.ranked.length > MAX_VISIBLE_ITEMS ? <span>showing top {MAX_VISIBLE_ITEMS - 1} + others of {board.ranked.length}</span> : null}
      </div>

      <div ref={boardRef} className="mindshare-board">
        <div
          className="mindshare-board-canvas"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            gridAutoRows: `${layout.rowHeight}px`
          }}
        >
          {layout.tiles.map(({ item: entry, colStart, rowStart, colSpan, rowSpan }) => {
            const width = colSpan * (boardInnerWidth / layout.columns);
            const height = rowSpan * layout.rowHeight;
            const tone =
              entry.sentiment === "positive" ? "mindshare-positive" : entry.sentiment === "negative" ? "mindshare-negative" : "mindshare-neutral";
            const compact = width < 220 || height < 140;
            const tight = width < 180 || height < 118;
            const micro = width < 145 || height < 92;
            const showSparkline = !entry.isOthers && width >= 150 && height >= 92;
            const sparklineClass = width >= 250 && height >= 165 ? "mindshare-sparkline-large" : width >= 185 && height >= 110 ? "mindshare-sparkline-medium" : "mindshare-sparkline-mini";
            const showSubtle = !micro;
            const showShare = true;

            return (
              <div
                key={entry.project.id}
                className="mindshare-tile-shell"
                style={{
                  gridColumn: `${colStart} / span ${colSpan}`,
                  gridRow: `${rowStart} / span ${rowSpan}`,
                  minWidth: 0
                }}
                onMouseMove={(event) => setHovered({ entry, x: event.clientX + 14, y: event.clientY + 14 })}
                onMouseLeave={() => setHovered((current) => (current?.entry.project.id === entry.project.id ? null : current))}
                onClick={() => setSelectedEntry(entry)}
              >
                <article
                  className={`mindshare-tile ${tone} ${getTreemapScaleClass(entry.share)} ${getRankTone(entry.rank)}${
                    tight ? " mindshare-layout-tight" : ""
                  }${micro ? " mindshare-layout-micro" : ""}`}
                >
                  {micro ? (
                    <div className="mindshare-micro-row">
                      <div className="mindshare-title-row">
                        {entry.project.logoUrl ? (
                          <img src={entry.project.logoUrl} alt="" className="mindshare-logo" loading="lazy" />
                        ) : (
                          <div className="mindshare-dot" />
                        )}
                        <strong>{entry.project.name}</strong>
                      </div>
                      <div className="mindshare-share mindshare-share-inline">{formatShare(entry.share)}</div>
                    </div>
                  ) : (
                    <>
                      <div className="mindshare-meta">
                        <div className="mindshare-title-row">
                          {entry.project.logoUrl ? (
                            <img src={entry.project.logoUrl} alt="" className="mindshare-logo" loading="lazy" />
                          ) : (
                            <div className="mindshare-dot" />
                          )}
                          <strong>{entry.project.name}</strong>
                        </div>
                      </div>
                      {showShare ? <div className="mindshare-share">{formatShare(entry.share)}</div> : null}
                    </>
                  )}
                  {!micro ? <div className={`mindshare-corner ${getRankTone(entry.rank)}`}>{getRankLabel(entry)}</div> : null}
                  {showSparkline ? (
                    <div className={`mindshare-sparkline ${sparklineClass}`} aria-hidden="true">
                      <svg viewBox="0 0 100 28" preserveAspectRatio="none">
                        <path className="mindshare-sparkline-path" d={buildSparklinePath(entry.trend)} />
                      </svg>
                    </div>
                  ) : null}
                  {!compact && showSubtle ? (
                    <div className="mindshare-subtle">{entry.isOthers ? "aggregated tail" : `${Math.round(entry.highTierShare)}% high-tier`}</div>
                  ) : null}
                </article>
              </div>
            );
          })}
        </div>
      </div>

      {hovered ? (
        <div className="mindshare-tooltip" style={{ left: hovered.x, top: hovered.y }}>
          <strong>{hovered.entry.project.name}</strong>
          <span>{formatShare(hovered.entry.share)} mindshare</span>
          <span>{formatDelta(hovered.entry.delta24hRelative)} in 24H</span>
          <span>{hovered.entry.mentionCount} mentions</span>
        </div>
      ) : null}

      {selectedEntry ? (
        <div className="mindshare-modal-backdrop" onClick={() => setSelectedEntry(null)}>
          <div className="mindshare-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mindshare-modal-header">
              <div className="stack-3">
                <span className={`mindshare-modal-rank ${getRankTone(selectedEntry.rank)}`}>Rank #{selectedEntry.rank}</span>
                <strong>{selectedEntry.project.name}</strong>
              </div>
              <button type="button" className="mindshare-modal-close" onClick={() => setSelectedEntry(null)}>
                Close
              </button>
            </div>

            <div className="mindshare-modal-grid">
              <div className="mindshare-modal-stat">
                <span>Mindshare</span>
                <strong>{formatShare(selectedEntry.share)}</strong>
              </div>
              <div className="mindshare-modal-stat">
                <span>24H change</span>
                <strong>{formatDelta(selectedEntry.delta24hRelative)}</strong>
              </div>
              <div className="mindshare-modal-stat">
                <span>Mentions</span>
                <strong>{selectedEntry.mentionCount}</strong>
              </div>
              <div className="mindshare-modal-stat">
                <span>High-tier share</span>
                <strong>{Math.round(selectedEntry.highTierShare)}%</strong>
              </div>
            </div>

            <div className="mindshare-modal-chart">
              <svg viewBox="0 0 100 28" preserveAspectRatio="none">
                <path className="mindshare-sparkline-path" d={buildSparklinePath(selectedEntry.trend)} />
              </svg>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
