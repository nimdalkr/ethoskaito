import { Badge } from "@/components/ui/badge";
import type { ProjectOutcome, ProjectSnapshot, TierRollup } from "@/lib/types/domain";

export function ProjectRankTable({
  projects,
  outcomes,
  tierRollups
}: {
  projects: ProjectSnapshot[];
  outcomes: ProjectOutcome[];
  tierRollups: TierRollup[];
}) {
  const rows = projects.map((project) => {
    const outcome = outcomes.find((item) => item.projectId === project.id);
    const weightedMentions = tierRollups.filter((row) => row.projectId === project.id).reduce((sum, row) => sum + row.weightedMentions, 0);
    return { project, outcome, weightedMentions };
  });

  return (
    <div className="table-shell">
      <div className="table-head">
        <span>Project</span>
        <span>Mentions</span>
        <span>7d</span>
        <span>Status</span>
      </div>
      {rows.map(({ project, outcome, weightedMentions }) => (
        <div key={project.id} className="table-row">
          <div>
            <strong>{project.name}</strong>
            <div className="muted-text">{project.description}</div>
          </div>
          <div>{weightedMentions}</div>
          <div>{outcome ? `${outcome.return7d?.toFixed(1)}%` : "-"}</div>
          <div>
            <Badge tone={outcome && (outcome.return7d ?? 0) > 0 ? "accent" : "danger"}>
              {outcome && (outcome.return7d ?? 0) > 0 ? "validated" : "watch"}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
