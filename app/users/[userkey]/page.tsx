import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrustTierLabel } from "@/lib/analytics/tier";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserDetail } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function UserPage({ params }: { params: { userkey: string } }) {
  const payload = await getUserDetail(params.userkey);
  if (!payload) {
    notFound();
  }

  const { user, mentionCount, firstMentionCount, hitRate, projects, categories, recentActivities, xpMultipliers } = payload;

  return (
    <main className="app-shell">
      <div className="shell-inner dashboard-stack">
        <div className="shell-panel shell-panel-header stack-4">
          <div className="header-row">
            <div className="hero-block stack-3">
              <Badge tone="accent">User Detail</Badge>
              <h1 className="hero-title">{user.displayName}</h1>
              <p className="hero-copy">{user.description ?? "No user description synced yet."}</p>
            </div>
            <div className="button-row">
              <Link className="button button-secondary" href="/">
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
        <div className="dashboard-grid">
          <section className="metric-grid">
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Trust tier</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{getTrustTierLabel(user.trustTier as any)}</strong>
              </CardContent>
            </Card>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Total mentions</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{mentionCount}</strong>
              </CardContent>
            </Card>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>First calls</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{firstMentionCount}</strong>
              </CardContent>
            </Card>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Hit rate</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{(hitRate * 100).toFixed(1)}%</strong>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Lead projects</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                {projects.length === 0 ? (
                  <p className="muted-copy">No first-tracked mentions recorded for this user.</p>
                ) : (
                  projects.map((project: any) => (
                    <div key={`${project.projectId}-${project.mentionedAt.toISOString()}`} className="panel-line">
                      <span>{project.projectName}</span>
                      <strong>{new Date(project.mentionedAt).toLocaleString()}</strong>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Ethos category ranks</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                {categories.length === 0 ? (
                  <p className="muted-copy">No category ranking data available yet.</p>
                ) : (
                  categories.slice(0, 6).map((item: any) => (
                    <div key={`${item.category.id}-${item.rank}`} className="panel-line">
                      <span>{item.category.name}</span>
                      <strong>#{item.rank}</strong>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Recent Ethos activity</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                {recentActivities.length === 0 ? (
                  <p className="muted-copy">No recent Ethos activity was returned for this profile.</p>
                ) : (
                  recentActivities.map((activity: any, index: number) => (
                    <div key={`${activity.type}-${activity.createdAt ?? index}`} className="stack-1">
                      <div className="panel-line">
                        <span>{activity.title}</span>
                        <strong>{activity.type}</strong>
                      </div>
                      <span className="muted-copy">
                        {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "Timestamp unavailable"}
                        {activity.score !== null ? ` · score ${activity.score}` : ""}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>XP multipliers</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                {!xpMultipliers ? (
                  <p className="muted-copy">XP multiplier data is not available for this user yet.</p>
                ) : (
                  <>
                    <div className="panel-line">
                      <span>Combined multiplier</span>
                      <strong>{xpMultipliers.combinedMultiplier.toFixed(2)}x</strong>
                    </div>
                    <div className="panel-line">
                      <span>Score multiplier</span>
                      <strong>{xpMultipliers.scoreMultiplier.value.toFixed(2)}x</strong>
                    </div>
                    <div className="panel-line">
                      <span>Streak multiplier</span>
                      <strong>{xpMultipliers.streakMultiplier.value.toFixed(2)}x</strong>
                    </div>
                    <div className="panel-line">
                      <span>Validator count</span>
                      <strong>{xpMultipliers.validatorCount}</strong>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
