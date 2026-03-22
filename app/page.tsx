import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ProjectDetailPanel } from "@/components/project/project-detail-panel";
import { ProjectHeatmap } from "@/components/project/project-heatmap";
import { ProjectMindshareBoard } from "@/components/project/project-mindshare-board";
import { UserSummaryList } from "@/components/user/user-summary-list";
import { getTrustTierLabel } from "@/lib/analytics/tier";
import { getCollectorModeLabel } from "@/lib/collector/scheduling";
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
  const topProject = [...model.projects]
    .map((project) => ({
      project,
      weightedMentions: model.tierRollups
        .filter((row) => row.projectId === project.id)
        .reduce((sum, row) => sum + row.weightedMentions, 0)
    }))
    .sort((left, right) => right.weightedMentions - left.weightedMentions)[0];
  const collector = model.collectorSummary;

  return (
    <DashboardShell
      header={
        <section className="hero-surface">
          <video
            className="hero-video"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda.mp4"
          />
          <div className="hero-overlay" />
          <div className="hero-gradient" />
          <div className="hero-content">
            <div className="hero-nav">
              <div className="hero-brand-row">
                <div className="hero-brand">ETHOSALPHA</div>
                <nav className="hero-nav-links" aria-label="Primary">
                  <a href="#mindshare-board">Mindshare</a>
                  <a href="#signal-grid">Signal Grid</a>
                  <a href="#project-lab">Project Lab</a>
                  <a href="#first-movers">First Movers</a>
                </nav>
              </div>
              <Button variant="secondary" className="hero-pill-button">
                Collector Live
              </Button>
            </div>

            <div className="hero-copy-stack">
              <Badge tone="neutral" className="hero-badge">
                <span className="hero-badge-dot" />
                Early access available from <strong>May 1, 2026</strong>
              </Badge>
              <h1 className="hero-title hero-title-gradient">Web3 signal at the speed of conviction.</h1>
              <p className="hero-copy hero-copy-wide">
                Ethos reputation and project-level flow analytics in one board. See which tier spotted a project first,
                how attention spread, and whether the thesis actually held up.
              </p>
              <div className="hero-action-row">
                <Button className="hero-primary-button">Open Live Dashboard</Button>
                <Button variant="secondary" className="hero-secondary-button">
                  {getTrustTierLabel("T4")} monitors active
                </Button>
              </div>
            </div>

            <div className="hero-strip">
              <div className="hero-strip-card">
                <span>Top live project</span>
                <strong>{topProject?.project.name ?? "No project yet"}</strong>
              </div>
              <div className="hero-strip-card">
                <span>Weighted mentions</span>
                <strong>{totalWeightedMentions}</strong>
              </div>
              <div className="hero-strip-card">
                <span>First mention captures</span>
                <strong>{firstMentions.length}</strong>
              </div>
              <div className="hero-strip-card">
                <span>Validated outcomes</span>
                <strong>
                  {validatedProjects} / {model.outcomes.length}
                </strong>
              </div>
              <div className="hero-strip-card">
                <span>24h coverage</span>
                <strong>{collector.coveragePct}%</strong>
              </div>
            </div>
          </div>
        </section>
      }
    >
      <section className="dashboard-intro stack-4">
        <FilterBar />
        <div className="metric-grid">
          <MetricCard label="Projects tracked" value={model.projects.length} delta="Ethos listings synced" />
          <MetricCard label="Signal authors" value={model.totalUsers} delta="Ethos profiles synced" />
          <MetricCard label="Mentions ingested" value={model.mentions.length} delta="Fresh live signals captured" />
          <MetricCard label="24h collector coverage" value={`${collector.coveragePct}%`} delta={`${collector.coveredLast24h} of ${collector.totalTrackedAccounts} accounts`} />
        </div>
      </section>

      <section id="mindshare-board" className="stack-4">
        <Card variant="surface">
          <CardHeader className="card-header-split">
            <div className="stack-3">
              <CardTitle>Mindshare board</CardTitle>
              <p className="muted-copy compact-copy">
                Weighted attention by project, ranked by live mention share, trust-tier participation, and outcome pressure.
              </p>
            </div>
            <Badge tone="accent">Top live projects</Badge>
          </CardHeader>
          <CardContent className="stack-3">
            <ProjectMindshareBoard projects={model.projects} outcomes={model.outcomes} tierRollups={model.tierRollups} />
            <div className="board-summary-grid">
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
          </CardContent>
        </Card>
      </section>

      <section id="signal-grid" className="stack-4">
        <Card variant="surface">
          <CardHeader className="card-header-split">
            <div className="stack-3">
              <CardTitle>Tier x project heatmap</CardTitle>
              <p className="muted-copy compact-copy">
                Full-width tier distribution across the live project set. Read across for project spread and down each column for trust-layer concentration.
              </p>
            </div>
            <Badge tone="neutral">Trust-weighted grid</Badge>
          </CardHeader>
          <CardContent>
            <ProjectHeatmap projects={model.projects} tierRollups={model.tierRollups} />
          </CardContent>
        </Card>
      </section>

      <section id="project-lab" className="dual-grid dual-grid-ratio-alt">
        <ProjectDetailPanel projects={model.projects} outcomes={model.outcomes} mentions={model.mentions} />
        <Card variant="surface">
          <CardHeader>
            <CardTitle>Collector operations</CardTitle>
          </CardHeader>
          <CardContent className="stack-3">
            <div className="panel-line">
              <span>24h covered accounts</span>
              <strong>
                {collector.coveredLast24h} / {collector.totalTrackedAccounts}
              </strong>
            </div>
            <div className="panel-line">
              <span>Due right now</span>
              <strong>{collector.dueNow}</strong>
            </div>
            <div className="panel-line">
              <span>Accounts with failures</span>
              <strong>{collector.failedAccounts}</strong>
            </div>
            <div className="panel-line">
              <span>Last main sweep</span>
              <strong>{collector.latestMainCompletedAt ? new Date(collector.latestMainCompletedAt).toLocaleString() : "Not completed yet"}</strong>
            </div>
            <div className="panel-line">
              <span>Last repair sweep</span>
              <strong>{collector.latestRepairCompletedAt ? new Date(collector.latestRepairCompletedAt).toLocaleString() : "Not completed yet"}</strong>
            </div>
            <div className="panel-line">
              <span>Last hot sweep</span>
              <strong>{collector.latestHotCompletedAt ? new Date(collector.latestHotCompletedAt).toLocaleString() : "Not completed yet"}</strong>
            </div>
            <div className="panel-line">
              <span>Most recent run</span>
              <strong>
                {collector.latestRun ? `${getCollectorModeLabel(collector.latestRun.mode as any)} · ${collector.latestRun.status}` : "No collector run yet"}
              </strong>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="first-movers" className="dual-grid dual-grid-even">
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
            <CardTitle>Validation pressure</CardTitle>
          </CardHeader>
          <CardContent className="stack-3">
            <div className="panel-line">
              <span>Tracked accounts</span>
              <strong>{model.totalTrackedAccounts}</strong>
            </div>
            <div className="panel-line">
              <span>Current first-call density</span>
              <strong>{model.projects.length > 0 ? `${Math.round((firstMentions.length / model.projects.length) * 100)}%` : "0%"}</strong>
            </div>
            <div className="panel-line">
              <span>Collector mode</span>
              <strong>Main + repair + hot lane</strong>
            </div>
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
