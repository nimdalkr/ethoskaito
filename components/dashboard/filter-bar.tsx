import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getTrustTierLabel } from "@/lib/analytics/tier";

export function FilterBar() {
  return (
    <div className="filter-bar">
      <Input placeholder="Search projects, aliases, users, or X handles" aria-label="Search" />
      <div className="filter-pills">
        <Badge tone="accent">30d</Badge>
        <Badge tone="neutral">{getTrustTierLabel("T5")} first</Badge>
        <Badge tone="neutral">Public</Badge>
        <Badge tone="warm">Verified only</Badge>
      </div>
    </div>
  );
}
