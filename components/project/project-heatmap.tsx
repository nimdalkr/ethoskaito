import { Fragment } from "react";
import type { CSSProperties } from "react";
import { getTrustTierLabel, TRUST_TIER_ORDER } from "@/lib/analytics/tier";
import type { ProjectSnapshot, TierRollup } from "@/lib/types/domain";

export function ProjectHeatmap({
  projects,
  tierRollups
}: {
  projects: ProjectSnapshot[];
  tierRollups: TierRollup[];
}) {
  return (
    <div className="heatmap-grid">
      <div className="heatmap-head" />
      {TRUST_TIER_ORDER.map((tier) => (
        <div key={tier} className="heatmap-head">
          {getTrustTierLabel(tier)}
        </div>
      ))}
      {projects.map((project) => {
        const rows = TRUST_TIER_ORDER.map((tier) => tierRollups.find((row) => row.projectId === project.id && row.tier === tier));
        return (
          <Fragment key={project.id}>
            <div key={`${project.id}-name`} className="heatmap-project">
              <strong>{project.name}</strong>
              <span>{project.aliases[0]}</span>
            </div>
            {rows.map((row, index) => {
              const intensity = row ? Math.min(1, row.weightedMentions / 120) : 0.05;
              return (
                <div
                  key={`${project.id}-${TRUST_TIER_ORDER[index]}`}
                  className="heatmap-cell"
                  style={{ "--cell-intensity": intensity } as CSSProperties}
                >
                  <span>{row?.mentionCount ?? 0}</span>
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
