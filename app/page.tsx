import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ProjectMindshareBoard } from "@/components/project/project-mindshare-board";
import { getHomePageModel } from "@/lib/data/home";

export const dynamic = "force-dynamic";

const tierGuide = [
  {
    tier: "T5",
    label: "Challenger",
    range: "1782+",
    band: "Top 1%",
    description: "Narrow top-score slice. Use this filter to see where elite conviction concentrates."
  },
  {
    tier: "T4",
    label: "Grandmaster",
    range: "1514–1781",
    band: "Top 5%",
    description: "High-signal cohort just under Challenger. Often early on breakout narratives."
  },
  {
    tier: "T3",
    label: "Diamond",
    range: "1361–1513",
    band: "80–95th",
    description: "Upper cohort. Strong for reading how attention expands past the elite tip."
  },
  {
    tier: "T2",
    label: "Platinum",
    range: "1280–1360",
    band: "60–80th",
    description: "Solid mid-high band. Useful for comparing durable mid-tier interest."
  },
  {
    tier: "T1",
    label: "Gold",
    range: "1238–1279",
    band: "40–60th",
    description: "Median band. Good baseline for how broad the conversation is becoming."
  },
  {
    tier: "T0",
    label: "Bronze",
    range: "<1238",
    band: "Bottom 40%",
    description: "Widest spread. Helps separate niche signal from general noise."
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
  const liveLabel =
    collector.coveragePct > 0 ? `${collector.coveragePct}% covered · 24h` : "Collector standby";
  const freshness = model.freshness;

  return (
    <DashboardShell liveLabel={liveLabel}>
      {freshness.isStale || freshness.mentionsLast90d === 0 ? (
        <section className="data-alert" role="status">
          <div className="data-alert-copy">
            <strong>Data looks stale or outside short windows</strong>
            <p>
              {freshness.totalMentions > 0
                ? `DB has ${freshness.totalMentions.toLocaleString()} mentions, but only ${freshness.mentionsLast90d.toLocaleString()} in the last 90 days (and ${freshness.mentionsLast180d.toLocaleString()} in 180 days).`
                : "No mentions are stored yet — the board will stay empty until the collector ingests tweets."}
              {freshness.latestCollectorRunAt
                ? ` Last collector run: ${new Date(freshness.latestCollectorRunAt).toLocaleString()}.`
                : " No collector run recorded."}
              {freshness.latestMentionAt
                ? ` Latest mention: ${new Date(freshness.latestMentionAt).toLocaleString()}.`
                : ""}
            </p>
            <p className="data-alert-hint">
              Fix: run <code>npm run collector:supervisor</code> (or Vercel/Railway cron with a real{" "}
              <code>CRON_SECRET</code>) and confirm <code>DATABASE_URL</code> points at the same DB as production.
              The mindshare board defaults to the <strong>6M</strong> window when short windows are empty.
            </p>
          </div>
        </section>
      ) : null}

      <section className="page-hero">
        <div className="page-hero-copy">
          <Badge tone="accent" className="page-hero-badge">
            Ethos × X mindshare
          </Badge>
          <h1 className="page-title">
            See which reputation tier
            <span className="page-title-accent"> moves first</span>
          </h1>
          <p className="page-subtitle">
            Track project attention across Ethos score cohorts, capture first mentions, and check whether the thesis
            held up on market outcomes — without inflating top-tier weight.
          </p>
          {topProject?.project ? (
            <div className="page-hero-chip-row">
              <span className="page-hero-chip">
                Leading board
                <strong>{topProject.project.name}</strong>
              </span>
              <span className="page-hero-chip">
                Mentions
                <strong>{totalMentions.toLocaleString()}</strong>
              </span>
              <span className="page-hero-chip">
                First calls
                <strong>{firstMentions.length.toLocaleString()}</strong>
              </span>
            </div>
          ) : null}
        </div>
        <div className="page-hero-panel">
          <div className="page-hero-panel-label">Collector coverage</div>
          <div className="page-hero-panel-value">{collector.coveragePct}%</div>
          <div className="page-hero-panel-meta">
            {collector.coveredLast24h.toLocaleString()} / {collector.totalTrackedAccounts.toLocaleString()} accounts in
            24h
          </div>
          <div className="coverage-meter" aria-hidden="true">
            <div className="coverage-meter-fill" style={{ width: `${Math.min(100, Math.max(0, collector.coveragePct))}%` }} />
          </div>
          <div className="page-hero-panel-grid">
            <div>
              <span>Due now</span>
              <strong>{collector.dueNow.toLocaleString()}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{collector.failedAccounts.toLocaleString()}</strong>
            </div>
            <div>
              <span>Validated 7d+</span>
              <strong>
                {validatedProjects} / {model.outcomes.length}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section id="coverage-panel" className="dashboard-intro stack-4">
        <FilterBar windowLabel="Live cohort" coveragePct={collector.coveragePct} />
        <div className="metric-grid">
          <MetricCard label="Projects tracked" value={model.projects.length} delta="Ethos listings synced" tone="accent" />
          <MetricCard label="Signal authors" value={model.totalUsers.toLocaleString()} delta="Ethos profiles synced" />
          <MetricCard label="Mentions ingested" value={totalMentions.toLocaleString()} delta="Fresh live signals" />
          <MetricCard
            label="24h collector coverage"
            value={`${collector.coveragePct}%`}
            delta={`${collector.coveredLast24h} of ${collector.totalTrackedAccounts} accounts`}
            tone={collector.coveragePct >= 70 ? "accent" : "warm"}
          />
        </div>
      </section>

      <section id="mindshare-board" className="stack-4">
        <Card variant="surface" className="section-card">
          <CardHeader className="card-header-split">
            <div className="stack-3">
              <CardTitle>Mindshare arena</CardTitle>
              <p className="muted-copy compact-copy">
                Project attention from the Ethos cohort, split by time window and tier filter so you can compare where
                conviction starts and where it spreads.
              </p>
            </div>
            <Badge tone="accent">Live cohort mindshare</Badge>
          </CardHeader>
          <CardContent className="stack-3">
            <ProjectMindshareBoard projects={model.projects} mentions={model.mentions} freshness={freshness} />
          </CardContent>
        </Card>
      </section>

      <section id="tier-system" className="stack-4">
        <Card variant="surface" className="section-card">
          <CardHeader className="card-header-split">
            <div className="stack-3">
              <CardTitle>How the tier system works</CardTitle>
              <p className="muted-copy compact-copy">
                Tiers come from raw Ethos score only. Every mention counts equally; use filters to inspect the same flow
                across higher-score and lower-score cohorts.
              </p>
            </div>
            <Badge tone="neutral">Score-based · equal weight</Badge>
          </CardHeader>
          <CardContent className="stack-4">
            <div className="tier-guide-grid">
              {tierGuide.map((entry) => (
                <article key={entry.tier} className={`tier-guide-card tier-guide-${entry.tier.toLowerCase()}`}>
                  <div className="tier-guide-top">
                    <span className="tier-guide-code">{entry.tier}</span>
                    <span className="tier-guide-band">{entry.band}</span>
                  </div>
                  <h3 className="tier-guide-label">{entry.label}</h3>
                  <div className="tier-guide-range">Score {entry.range}</div>
                  <p className="tier-guide-copy">{entry.description}</p>
                </article>
              ))}
            </div>
            <p className="muted-copy compact-copy tier-guide-footnote">
              Cutoffs track the Ethos score distribution: T0 below the 40th percentile through T5 at the top 1%. Compare
              cohorts with the mindshare tier filter instead of inflating elite mention weight.
            </p>
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
