import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ProjectMindshareBoard } from "@/components/project/project-mindshare-board";
import { getTrustTierLabel } from "@/lib/analytics/tier";
import { getHomePageModel } from "@/lib/data/home";

export const dynamic = "force-dynamic";

const tierGuide = [
  {
    tier: "T5",
    label: "Challenger",
    range: "1782+",
    description: "Top 1% score cohort. This is the narrowest, highest-score slice of Ethos."
  },
  {
    tier: "T4",
    label: "Grandmaster",
    range: "1514-1781",
    description: "Top 5% cohort excluding the Challenger tail."
  },
  {
    tier: "T3",
    label: "Diamond",
    range: "1361-1513",
    description: "Upper cohort covering the 80th to 95th percentile."
  },
  {
    tier: "T2",
    label: "Platinum",
    range: "1280-1360",
    description: "60th to 80th percentile. Useful for comparing solid mid-high signal."
  },
  {
    tier: "T1",
    label: "Gold",
    range: "1238-1279",
    description: "40th to 60th percentile. A narrow middle band around the score median."
  },
  {
    tier: "T0",
    label: "Bronze",
    range: "<1238",
    description: "Bottom 40% of the score distribution. Useful for seeing the broadest spread."
  }
] as const;

export default async function Page() {
  const model = await getHomePageModel();
  const totalMentions = model.mentions.length;
  const validatedProjects = model.outcomes.filter((outcome) => (outcome.return7d ?? 0) > 0).length;
  const firstMentions = model.mentions.filter((mention) => mention.isFirstTrackedMention);
  const topProject = [...model.projects]
    .map((project) => ({
      project,
      mentionCount: model.tierRollups
        .filter((row) => row.projectId === project.id)
        .reduce((sum, row) => sum + row.mentionCount, 0)
    }))
    .sort((left, right) => right.mentionCount - left.mentionCount)[0];
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
                  <a href="#tier-system">Tier System</a>
                  <a href="#coverage-panel">Coverage</a>
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
                  {getTrustTierLabel("T5")} monitors active
                </Button>
              </div>
            </div>

            <div className="hero-strip">
              <div className="hero-strip-card">
                <span>Top live project</span>
                <strong>{topProject?.project.name ?? "No project yet"}</strong>
              </div>
              <div className="hero-strip-card">
                <span>Mentions tracked</span>
                <strong>{totalMentions}</strong>
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
      <section id="coverage-panel" className="dashboard-intro stack-4">
        <FilterBar />
        <div className="metric-grid">
          <MetricCard label="Projects tracked" value={model.projects.length} delta="Ethos listings synced" />
          <MetricCard label="Signal authors" value={model.totalUsers} delta="Ethos profiles synced" />
          <MetricCard label="Mentions ingested" value={model.mentions.length} delta="Fresh live signals captured" />
          <MetricCard
            label="24h collector coverage"
            value={`${collector.coveragePct}%`}
            delta={`${collector.coveredLast24h} of ${collector.totalTrackedAccounts} accounts`}
          />
        </div>
      </section>

      <section id="mindshare-board" className="stack-4">
        <Card variant="surface">
          <CardHeader className="card-header-split">
            <div className="stack-3">
              <CardTitle>Mindshare arena</CardTitle>
              <p className="muted-copy compact-copy">
                Project attention from the Ethos cohort, split by time window and tier filter so you can compare where conviction starts and where it spreads.
              </p>
            </div>
            <Badge tone="accent">Live cohort mindshare</Badge>
          </CardHeader>
          <CardContent className="stack-3">
            <ProjectMindshareBoard projects={model.projects} mentions={model.mentions} />
          </CardContent>
        </Card>
      </section>

      <section id="tier-system" className="stack-4">
        <Card variant="surface">
          <CardHeader className="card-header-split">
            <div className="stack-3">
              <CardTitle>How The Tier System Works</CardTitle>
              <p className="muted-copy compact-copy">
                Tiers now come directly from raw Ethos score only. Mindshare itself counts every mention equally, and tier filters let you inspect how that
                same mention flow looks across higher-score and lower-score cohorts.
              </p>
            </div>
            <Badge tone="neutral">Score-based tiering</Badge>
          </CardHeader>
          <CardContent className="stack-4">
            <div className="metric-grid">
              {tierGuide.map((entry) => (
                <Card key={entry.tier} variant="default">
                  <CardContent className="stack-3">
                    <div className="stack-2">
                      <Badge tone="accent">{entry.label}</Badge>
                      <div className="muted-copy compact-copy">Ethos score {entry.range}</div>
                    </div>
                    <p className="muted-copy compact-copy">{entry.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="muted-copy compact-copy">
              Tier cutoffs now follow the current Ethos score distribution: T0 below the 40th percentile, T1 from the 40th to 60th, T2 from the 60th to
              80th, T3 from the 80th to 95th, T4 for the top 5%, and T5 for the top 1%. To compare cohorts, switch the tier filter in the mindshare board
              instead of adding extra weight to top tiers.
            </p>
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
