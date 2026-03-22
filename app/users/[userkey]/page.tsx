import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserDetail } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function UserPage({ params }: { params: { userkey: string } }) {
  const payload = await getUserDetail(params.userkey);
  if (!payload) {
    notFound();
  }

  const { user, mentionCount, firstMentionCount, hitRate, projects } = payload;

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
                <strong>{user.trustTier}</strong>
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
        </div>
      </div>
    </main>
  );
}
