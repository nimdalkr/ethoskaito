import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrustTierLabel } from "@/lib/analytics/tier";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/layout/site-header";
import { getUserDetail } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function UserPage({ params }: { params: { userkey: string } }) {
  const payload = await getUserDetail(params.userkey);
  if (!payload) {
    notFound();
  }

  const { user, mentionCount, firstMentionCount, hitRate, projects, categories, recentActivities, xpMultipliers } =
    payload;

  return (
    <main className="app-shell">
      <SiteHeader />
      <div className="shell-inner dashboard-stack">
        <section className="detail-shell-header">
          <div className="header-row">
            <div className="hero-block">
              <Badge tone="accent">Signal author</Badge>
              <h1 className="detail-title">{user.displayName}</h1>
              <p className="detail-lead">{user.description ?? "No user description synced yet."}</p>
              <div className="page-hero-chip-row">
                {user.username ? (
                  <span className="page-hero-chip">
                    Handle
                    <strong>@{user.username}</strong>
                  </span>
                ) : null}
                <span className="page-hero-chip">
                  Score
                  <strong>{user.score}</strong>
                </span>
                <span className="page-hero-chip">
                  Composite
                  <strong>{user.trustComposite}</strong>
                </span>
              </div>
            </div>
            <div className="button-row">
              <Link className="button button-secondary" href="/">
                Back to dashboard
              </Link>
            </div>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="metric-grid">
            <Card variant="surface" className="metric-card-shell metric-card-tone-accent">
              <CardContent className="metric-card">
                <div className="metric-label">Trust tier</div>
                <div className="metric-value" style={{ fontSize: "1.6rem" }}>
                  {getTrustTierLabel(user.trustTier as any)}
                </div>
                <div className="metric-delta">{user.trustTier}</div>
              </CardContent>
            </Card>
            <Card variant="surface" className="metric-card-shell">
              <CardContent className="metric-card">
                <div className="metric-label">Total mentions</div>
                <div className="metric-value">{mentionCount}</div>
                <div className="metric-delta">Projects discussed</div>
              </CardContent>
            </Card>
            <Card variant="surface" className="metric-card-shell">
              <CardContent className="metric-card">
                <div className="metric-label">First calls</div>
                <div className="metric-value">{firstMentionCount}</div>
                <div className="metric-delta">First-tracked mentions</div>
              </CardContent>
            </Card>
            <Card variant="surface" className="metric-card-shell metric-card-tone-warm">
              <CardContent className="metric-card">
                <div className="metric-label">Hit rate</div>
                <div className="metric-value">{(hitRate * 100).toFixed(1)}%</div>
                <div className="metric-delta">First calls / mentions</div>
              </CardContent>
            </Card>
          </section>

          <section className="dual-grid dual-grid-even">
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Lead projects</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                {projects.length === 0 ? (
                  <p className="muted-copy">No first-tracked mentions recorded for this user.</p>
                ) : (
                  projects.map((project: any) => (
                    <div key={`${project.projectId}-${project.mentionedAt}`} className="panel-line">
                      <span>{project.projectName}</span>
                      <strong>{new Date(project.mentionedAt).toLocaleDateString()}</strong>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Ethos profile signals</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                <div className="panel-line">
                  <span>Category ranks</span>
                  <strong>{Array.isArray(categories) ? categories.length : 0}</strong>
                </div>
                <div className="panel-line">
                  <span>Recent activities</span>
                  <strong>{Array.isArray(recentActivities) ? recentActivities.length : 0}</strong>
                </div>
                <div className="panel-line">
                  <span>XP multipliers</span>
                  <strong>{xpMultipliers ? "Loaded" : "—"}</strong>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
