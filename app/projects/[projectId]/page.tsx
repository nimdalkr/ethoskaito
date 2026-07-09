import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrustTierLabel } from "@/lib/analytics/tier";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/layout/site-header";
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
  const mentionTotal =
    "mentionTotal" in project && typeof project.mentionTotal === "number"
      ? project.mentionTotal
      : project.mentions.length;
  const firstTrackedMentionAt =
    "firstTrackedMentionAt" in project && project.firstTrackedMentionAt
      ? project.firstTrackedMentionAt
      : project.mentions[0]?.mentionedAt ?? null;

  return (
    <main className="app-shell">
      <SiteHeader />
      <div className="shell-inner dashboard-stack">
        <section className="detail-shell-header">
          <div className="header-row">
            <div className="hero-block">
              <Badge tone="accent">Project</Badge>
              <h1 className="detail-title">{project.name}</h1>
              <p className="detail-lead">{project.description ?? "No project description synced yet."}</p>
              {project.username ? (
                <div className="page-hero-chip-row">
                  <span className="page-hero-chip">
                    Handle
                    <strong>@{project.username}</strong>
                  </span>
                </div>
              ) : null}
            </div>
            <div className="button-row">
              <Link className="button button-secondary" href="/#mindshare-board">
                Back to mindshare
              </Link>
            </div>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="metric-grid">
            <Card variant="surface" className="metric-card-shell metric-card-tone-accent">
              <CardContent className="metric-card">
                <div className="metric-label">Mentions</div>
                <div className="metric-value">{mentionTotal}</div>
                <div className="metric-delta">Tracked in cohort window</div>
              </CardContent>
            </Card>
            <Card variant="surface" className="metric-card-shell">
              <CardContent className="metric-card">
                <div className="metric-label">First tracked mention</div>
                <div className="metric-value" style={{ fontSize: "1.15rem", letterSpacing: "-0.03em" }}>
                  {firstTrackedMentionAt ? new Date(firstTrackedMentionAt).toLocaleString() : "—"}
                </div>
                <div className="metric-delta">Earliest capture on record</div>
              </CardContent>
            </Card>
            <Card variant="surface" className="metric-card-shell metric-card-tone-warm">
              <CardContent className="metric-card">
                <div className="metric-label">30d outcome</div>
                <div className="metric-value">
                  {outcome?.return30d !== null && outcome?.return30d !== undefined ? formatPct(outcome.return30d) : "—"}
                </div>
                <div className="metric-delta">Primary market mapping</div>
              </CardContent>
            </Card>
            <Card variant="surface" className="metric-card-shell">
              <CardContent className="metric-card">
                <div className="metric-label">7d outcome</div>
                <div className="metric-value">
                  {outcome?.return7d !== null && outcome?.return7d !== undefined ? formatPct(outcome.return7d) : "—"}
                </div>
                <div className="metric-delta">Short-window validation</div>
              </CardContent>
            </Card>
          </section>

          <section className="dual-grid dual-grid-even">
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
                        {getTrustTierLabel(edge.source as any)} → {getTrustTierLabel(edge.target as any)}
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
                  <strong>{project.aliases.map((alias: any) => alias.alias).join(", ") || "—"}</strong>
                </div>
                <div className="panel-line">
                  <span>Market mapping</span>
                  <strong>{project.marketMappings[0]?.symbol ?? "—"}</strong>
                </div>
                <div className="panel-line">
                  <span>Categories</span>
                  <strong>
                    {Array.isArray(project.categories)
                      ? (project.categories as any[]).map((item) => item?.name ?? item).filter(Boolean).join(", ") ||
                        "—"
                      : "—"}
                  </strong>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card variant="surface" className="section-card">
              <CardHeader className="card-header-split">
                <div className="stack-3">
                  <CardTitle>Tracked mentions</CardTitle>
                  <p className="muted-copy compact-copy">
                    {mentionTotal > project.mentions.length
                      ? `Showing ${project.mentions.length} of ${mentionTotal} mentions (latest window, oldest first).`
                      : "Mentions matched to this project from the Ethos cohort."}
                  </p>
                </div>
                <Badge tone="neutral">{project.mentions.length} shown</Badge>
              </CardHeader>
              <CardContent className="stack-3">
                {project.mentions.length === 0 ? (
                  <p className="muted-copy">No tracked mentions yet.</p>
                ) : (
                  <>
                    <div className="mention-table-head">
                      <span>Author</span>
                      <span>Tier</span>
                      <span>Weight</span>
                      <span>Link</span>
                    </div>
                    {project.mentions.map((mention: any) => (
                      <div key={mention.id} className="table-row">
                        <div>
                          <strong>{mention.tweet.authorName}</strong>
                          <div className="muted-text">@{mention.tweet.xUsername}</div>
                        </div>
                        <div>
                          <Badge tone="accent">{getTrustTierLabel(mention.authorTier as any)}</Badge>
                        </div>
                        <div>{mention.weight}</div>
                        <div>
                          <a href={mention.tweet.url} target="_blank" rel="noreferrer">
                            View tweet →
                          </a>
                        </div>
                      </div>
                    ))}
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
