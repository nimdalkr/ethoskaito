import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  delta
}: {
  label: string;
  value: string | number;
  delta: string;
}) {
  return (
    <Card variant="surface">
      <CardContent className="metric-card">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-delta">{delta}</div>
      </CardContent>
    </Card>
  );
}
