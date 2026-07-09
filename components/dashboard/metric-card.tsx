import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  delta,
  tone = "default"
}: {
  label: string;
  value: string | number;
  delta: string;
  tone?: "default" | "accent" | "warm";
}) {
  return (
    <Card variant="surface" className={cn("metric-card-shell", `metric-card-tone-${tone}`)}>
      <CardContent className="metric-card">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-delta">{delta}</div>
      </CardContent>
    </Card>
  );
}
