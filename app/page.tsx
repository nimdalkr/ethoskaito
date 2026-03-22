import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { MentionFlow } from "@/components/project/mention-flow";
import { ProjectDetailPanel } from "@/components/project/project-detail-panel";
import { ProjectHeatmap } from "@/components/project/project-heatmap";
import { ProjectRankTable } from "@/components/project/project-rank-table";
import { UserSummaryList } from "@/components/user/user-summary-list";
import { getTrustTierLabel } from "@/lib/analytics/tier";
import { getHomePageModel } from "@/lib/data/home";

export const dynamic = "force-dynamic";

export default async function Page() {
  const model = await getHomePageModel();
  const totalWeightedMentions = model.tierRollups.reduce((sum, row) => sum + row.weightedMentions, 0);
  const validatedProjects = model.outcomes.filter((outcome) => (outcome.return7d ?? 0) > 0).length;
  const firstMentions = model.mentions.filter((mention) => mention.isFirstTrackedMention);
  const topTierWeight = model.tierRollups
    .filter((row) => row.tier === "T4")
    .reduce((sum, row) => sum + row.weightedMentions, 0);

  return (
    <DashboardShell
      header={
        <div className="stack-4">
          <div className="header-row">
            <div className="hero-block stack-3">
              <Badge tone="accent">Ethos x FixTweet intelligence</Badge>
              <h1 className="hero-title">Tier-aware project flow for alpha discovery and reputation proof.</h1>
              <p className="hero-copy">
                Track which trust tier sees a project first, how that signal spreads, and whether the market later validates it.
              </p>
            </div>
          </div>
          <FilterBar />
        </div>
      }
    >
      <section className="metric-grid">
        <MetricCard label="Projects tracked" value={model.projects.length} delta="Ethos listings synced" />
        <MetricCard label="Signal authors" value={model.users.length} delta="Ranked by trust composite" />
        <MetricCard label="Mentions ingested" value={model.mentions.length} delta="First tracked calls retained" />
        <MetricCard label="Weighted mentions" value={totalWeightedMentions} delta="Tier-weighted signal volume" />
      </section>

      <section className="dual-grid dual-grid-ratio">
        <Card variant="surface">
          <CardHeader>
            <CardTitle>Tier x project heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectHeatmap projects={model.projects} tierRollups={model.tierRollups} />
          </CardContent>
        </Card>
        <Card variant="surface">
          <CardHeader>
            <CardTitle>Signal quality</CardTitle>
          </CardHeader>
          <CardContent className="stack-4">
            <div className="stack-3">
              <div className="panel-line">
                <span>First tracked mentions</span>
                <strong>{firstMentions.length}</strong>
              </div>
              <div className="panel-line">
                <span>Top tier weight share</span>
                <strong>
                  {getTrustTierLabel("T4")} {totalWeightedMentions > 0 ? `${Math.round((topTierWeight / totalWeightedMentions) * 100)}%` : "0%"}
                </strong>
              </div>
              <div className="panel-line">
                <span>Positive outcome match</span>
                <strong>
                  {validatedProjects} / {model.outcomes.length}
                </strong>
              </div>
            </div>
            <MentionFlow mentions={model.mentions} users={model.users} projects={model.projects} />
          </CardContent>
        </Card>
      </section>

      <section className="dual-grid dual-grid-ratio-alt">
        <Card variant="surface">
          <CardHeader className="card-header-inline">
            <CardTitle>Project ranking</CardTitle>
            <Badge tone="neutral">weighted by tier</Badge>
          </CardHeader>
          <CardContent>
            <ProjectRankTable projects={model.projects} outcomes={model.outcomes} tierRollups={model.tierRollups} />
          </CardContent>
        </Card>
        <ProjectDetailPanel projects={model.projects} outcomes={model.outcomes} mentions={model.mentions} />
      </section>

      <section className="dual-grid dual-grid-even">
        <Card variant="surface">
          <CardHeader>
            <CardTitle>First movers</CardTitle>
          </CardHeader>
          <CardContent>
            <UserSummaryList users={model.users} mentions={model.mentions} />
          </CardContent>
        </Card>
        <Card variant="surface">
          <CardHeader>
            <CardTitle>Operating notes</CardTitle>
          </CardHeader>
          <CardContent className="stack-3 muted-copy">
            <p>The dashboard now reads from the local database models rather than mock arrays.</p>
            <p>If the grid is empty, run the sync route and ingest at least one tracked tweet payload.</p>
            <p>Outcome cells remain blank until a market mapping resolves to a price source symbol.</p>
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
