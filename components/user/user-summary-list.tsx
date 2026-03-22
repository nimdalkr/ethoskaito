import type { EthosUserSnapshot, ProjectMention } from "@/lib/types/domain";

export function UserSummaryList({
  users,
  mentions
}: {
  users: EthosUserSnapshot[];
  mentions: ProjectMention[];
}) {
  return (
    <div className="user-list">
      {users.map((user) => {
        const leadMentions = mentions.filter((item) => item.authorUserkey === user.userkey && item.isFirstTrackedMention).length;
        return (
          <div key={user.userId} className="user-row">
            <img src={user.avatarUrl} alt={user.displayName} className="avatar" />
            <div className="user-meta">
              <strong>{user.displayName}</strong>
              <span>
                {user.trustTier} · score {user.score.toFixed(0)}
              </span>
            </div>
            <div className="user-badge">{leadMentions} first calls</div>
          </div>
        );
      })}
    </div>
  );
}
