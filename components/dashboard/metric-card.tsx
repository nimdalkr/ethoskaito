import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  delta,
  tone = "default",
  icon
}: {
  label: string;
  value: string | number;
  delta: string;
  tone?: "default" | "accent" | "warm";
  icon?: string;
}) {
  return (
    <Card variant="surface" className={cn("metric-card-shell", `metric-card-tone-${tone}`)}>
      <CardContent className="metric-card">
        <div className="metric-card-top">
          <div className="metric-label">{label}</div>
          {icon ? <span className="metric-icon" aria-hidden="true">{icon}</span> : null}
        </div>
        <div className="metric-value">{value}</div>
        <div className="metric-delta">{delta}</div>
      </CardContent>
    </Card>
  );
}
