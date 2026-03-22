import type { EthosUserSnapshot, ProjectMention, ProjectSnapshot } from "@/lib/types/domain";

export function MentionFlow({
  mentions,
  users,
  projects
}: {
  mentions: ProjectMention[];
  users: EthosUserSnapshot[];
  projects: ProjectSnapshot[];
}) {
  return (
    <div className="mention-flow">
      {mentions.slice(0, 4).map((mention) => {
        const user = users.find((item) => item.userkey === mention.authorUserkey);
        const project = projects.find((item) => item.id === mention.projectId);
        return (
          <div key={mention.tweetId} className="mention-flow-item">
            <div>
              <strong>{user?.displayName ?? mention.authorUserkey}</strong>
              <div className="muted-text">{user?.trustTier ?? mention.authorTier}</div>
            </div>
            <div className="mention-flow-arrow">→</div>
            <div>
              <strong>{project?.name ?? mention.projectId}</strong>
              <div className="muted-text">{mention.weight} weight</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
