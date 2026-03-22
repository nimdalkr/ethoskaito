import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrustTierLabel } from "@/lib/analytics/tier";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectDetail, getProjectFlow } from "@/lib/data/dashboard";
import { formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const project = await getProjectDetail(params.projectId);
  if (!project) {
    notFound();
  }

  const flow = await getProjectFlow(params.projectId);
  const outcome = project.outcomes[0] ?? null;

  return (
    <main className="app-shell">
      <div className="shell-inner dashboard-stack">
        <div className="shell-panel shell-panel-header stack-4">
          <div className="header-row">
            <div className="hero-block stack-3">
              <Badge tone="accent">Project Detail</Badge>
              <h1 className="hero-title">{project.name}</h1>
              <p className="hero-copy">{project.description ?? "No project description synced yet."}</p>
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
                <CardTitle>Mentions</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{project.mentions.length}</strong>
              </CardContent>
            </Card>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>First tracked mention</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{project.mentions[0] ? new Date(project.mentions[0].mentionedAt).toLocaleString() : "-"}</strong>
              </CardContent>
            </Card>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>30d outcome</CardTitle>
              </CardHeader>
              <CardContent>
                <strong>{outcome?.return30d !== null && outcome?.return30d !== undefined ? formatPct(outcome.return30d) : "-"}</strong>
              </CardContent>
            </Card>
          </section>

          <section className="dual-grid dual-grid-ratio">
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Tier flow</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                {flow.edges.length === 0 ? (
                  <p className="muted-copy">No tier propagation edge has been recorded yet.</p>
                ) : (
                  flow.edges.map((edge) => (
                    <div key={`${edge.source}-${edge.target}`} className="panel-line">
                      <span>
                        {getTrustTierLabel(edge.source as any)} to {getTrustTierLabel(edge.target as any)}
                      </span>
                      <strong>{edge.delayHours}h</strong>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Project metadata</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                <div className="panel-line">
                  <span>Aliases</span>
                  <strong>{project.aliases.map((alias: any) => alias.alias).join(", ") || "-"}</strong>
                </div>
                <div className="panel-line">
                  <span>Market mapping</span>
                  <strong>{project.marketMappings[0]?.symbol ?? "-"}</strong>
                </div>
                <div className="panel-line">
                  <span>Categories</span>
                  <strong>{(project.categories as any[]).map((item) => item.name).join(", ") || "-"}</strong>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card variant="surface">
              <CardHeader>
                <CardTitle>Tracked mentions</CardTitle>
              </CardHeader>
              <CardContent className="stack-3">
                {project.mentions.length === 0 ? (
                  <p className="muted-copy">No tracked mentions yet.</p>
                ) : (
                  project.mentions.map((mention: any) => (
                    <div key={mention.id} className="table-row">
                      <div>
                        <strong>{mention.tweet.authorName}</strong>
                        <div className="muted-text">@{mention.tweet.xUsername}</div>
                      </div>
                      <div>{getTrustTierLabel(mention.authorTier as any)}</div>
                      <div>{mention.weight}</div>
                      <div>
                        <a href={mention.tweet.url} target="_blank" rel="noreferrer">
                          View tweet
                        </a>
                      </div>
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
