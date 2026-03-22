import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectOutcome, ProjectMention, ProjectSnapshot } from "@/lib/types/domain";

export function ProjectDetailPanel({
  projects,
  outcomes,
  mentions
}: {
  projects: ProjectSnapshot[];
  outcomes: ProjectOutcome[];
  mentions: ProjectMention[];
}) {
  const project = projects[0];
  const outcome = outcomes.find((item) => item.projectId === project?.id);
  const firstMention = mentions.find((item) => item.projectId === project?.id && item.isFirstTrackedMention);

  return (
    <Card variant="surface">
      <CardHeader>
        <CardTitle>Project detail</CardTitle>
      </CardHeader>
      <CardContent className="stack-4">
        <div className="project-detail-hero">
          <div>
            <div className="muted-text">Current leader</div>
            <h3>{project?.name}</h3>
          </div>
          <div className="project-detail-metric">
            <span>7d return</span>
            <strong>{outcome ? `${outcome.return7d?.toFixed(1)}%` : "-"}</strong>
          </div>
        </div>
        <div className="detail-list">
          <div>
            <span>First tracked mention</span>
            <strong>{firstMention?.mentionedAt ? new Date(firstMention.mentionedAt).toLocaleString() : "-"}</strong>
          </div>
          <div>
            <span>Categories</span>
            <strong>{project ? project.categories.map((item) => item.name).join(", ") : "-"}</strong>
          </div>
          <div>
            <span>Aliases</span>
            <strong>{project ? project.aliases.join(" / ") : "-"}</strong>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
