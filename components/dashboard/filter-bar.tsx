import { Badge } from "@/components/ui/badge";
import { getTrustTierLabel } from "@/lib/analytics/tier";

/** Lightweight status strip — search is handled inside the mindshare board filters. */
export function FilterBar({
  windowLabel = "Live board",
  coveragePct
}: {
  windowLabel?: string;
  coveragePct?: number;
}) {
  return (
    <div className="status-strip">
      <div className="status-strip-copy">
        <span className="status-strip-kicker">Dashboard</span>
        <strong>Ethos cohort attention, first calls, and outcome validation</strong>
      </div>
      <div className="filter-pills">
        <Badge tone="accent">{windowLabel}</Badge>
        <Badge tone="neutral">{getTrustTierLabel("T5")} monitors</Badge>
        {typeof coveragePct === "number" ? (
          <Badge tone={coveragePct >= 70 ? "accent" : "warm"}>{coveragePct}% 24h coverage</Badge>
        ) : (
          <Badge tone="warm">Equal mention weight</Badge>
        )}
      </div>
    </div>
  );
}
