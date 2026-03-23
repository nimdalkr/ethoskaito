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

function sumValues<T>(items: Array<{ item: T; value: number }>) {
  return items.reduce((sum, item) => sum + item.value, 0);
}

function createTreemapLayout<T>(items: Array<{ item: T; value: number }>, width = 100, height = 100) {
  const normalizedItems = items
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);

  const total = sumValues(normalizedItems);
  if (total <= 0 || width <= 0 || height <= 0) {
    return [] as TreemapRect<T>[];
  }

  const layout = (
    input: Array<{ item: T; value: number }>,
    rect: { x: number; y: number; width: number; height: number }
  ): TreemapRect<T>[] => {
    if (input.length === 0 || rect.width <= 0 || rect.height <= 0) {
      return [];
    }

    if (input.length === 1) {
      return [{ item: input[0].item, x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
    }

    const totalValue = sumValues(input);
    let leftValue = 0;
    let splitIndex = 1;

    while (splitIndex < input.length) {
      const nextValue = leftValue + input[splitIndex - 1].value;
      if (Math.abs(totalValue / 2 - nextValue) > Math.abs(totalValue / 2 - leftValue) && splitIndex > 1) {
        break;
      }

      leftValue = nextValue;
      splitIndex += 1;
    }

    splitIndex = Math.min(Math.max(splitIndex - 1, 1), input.length - 1);
    leftValue = sumValues(input.slice(0, splitIndex));

    const leftItems = input.slice(0, splitIndex);
    const rightItems = input.slice(splitIndex);
    const leftRatio = leftValue / totalValue;

    if (rect.width >= rect.height) {
      const leftWidth = rect.width * leftRatio;
      return [
        ...layout(leftItems, { x: rect.x, y: rect.y, width: leftWidth, height: rect.height }),
        ...layout(rightItems, { x: rect.x + leftWidth, y: rect.y, width: rect.width - leftWidth, height: rect.height })
      ];
    }

    const topHeight = rect.height * leftRatio;
    return [
      ...layout(leftItems, { x: rect.x, y: rect.y, width: rect.width, height: topHeight }),
      ...layout(rightItems, { x: rect.x, y: rect.y + topHeight, width: rect.width, height: rect.height - topHeight })
    ];
  };

  return layout(normalizedItems, { x: 0, y: 0, width, height });
}

function getTreemapScaleClass(share: number) {
  if (share >= 14) return "mindshare-scale-hero";
  if (share >= 7) return "mindshare-scale-large";
  if (share >= 3) return "mindshare-scale-medium";
  return "mindshare-scale-small";
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
  const [boardSize, setBoardSize] = useState({ width: 1000, height: 1000 });

  useEffect(() => {
    const node = boardRef.current;
    if (!node) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.max(node.clientWidth, 1);
      const nextHeight = Math.max(node.clientHeight, 1);
      setBoardSize((current) =>
        current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight }
      );
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
  const treemap = useMemo(
    () => createTreemapLayout(topTwenty.map((entry) => ({ item: entry, value: entry.share })), boardSize.width, boardSize.height),
    [boardSize.height, boardSize.width, topTwenty]
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
      </div>

      <div ref={boardRef} className="mindshare-board">
        {treemap.map(({ item: entry, x, y, width, height }) => {
          const momentumValue = entry.selectedDeltaRelative;
          const tone = momentumValue > 0 ? "mindshare-positive" : momentumValue < 0 ? "mindshare-negative" : "mindshare-neutral";
          const compact = width < 16 || height < 14;
          const tiny = width < 11 || height < 10;

          return (
            <div
              key={entry.project.id}
              className="mindshare-tile-shell"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`
              }}
            >
              <article className={`mindshare-tile ${tone} ${getTreemapScaleClass(entry.share)}`}>
                <div className="mindshare-meta">
                  <div className="mindshare-title-row">
                    <div className="mindshare-dot" />
                    <strong>{entry.project.name}</strong>
                  </div>
                </div>
                <div className="mindshare-share">{formatShare(entry.share)}</div>
                {!compact ? <div className="mindshare-corner">{Math.round(entry.highTierShare)}% high-tier</div> : null}
                {!tiny ? <div className="mindshare-footer-fill" aria-hidden="true" /> : null}
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
