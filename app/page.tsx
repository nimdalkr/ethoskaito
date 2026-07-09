import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
    description: "Narrow top-score slice. Where elite conviction concentrates first."
  },
  {
    tier: "T4",
    label: "Grandmaster",
    range: "1514–1781",
    band: "Top 5%",
    description: "High-signal cohort just under Challenger. Often early on breakouts."
  },
  {
    tier: "T3",
    label: "Diamond",
    range: "1361–1513",
    band: "80–95th",
    description: "Upper cohort. Watch how attention expands past the elite tip."
  },
  {
    tier: "T2",
    label: "Platinum",
    range: "1280–1360",
    band: "60–80th",
    description: "Solid mid-high band for durable interest."
  },
  {
    tier: "T1",
    label: "Gold",
    range: "1238–1279",
    band: "40–60th",
    description: "Median band — baseline for how broad the conversation is becoming."
  },
  {
    tier: "T0",
    label: "Bronze",
    range: "<1238",
    band: "Bottom 40%",
    description: "Widest spread. Separates niche signal from general noise."
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
      <section className="hero-stage">
        <div className="hero-stage-glow hero-stage-glow-a" aria-hidden="true" />
        <div className="hero-stage-glow hero-stage-glow-b" aria-hidden="true" />
        <div className="hero-stage-ring" aria-hidden="true" />

        <div className="hero-stage-content">
          <div className="hero-kicker-row">
            <Badge tone="accent" className="hero-kicker">
              <span className="hero-kicker-dot" />
              Ethos × X · equal-weight mindshare
            </Badge>
            {freshness.isStale ? (
              <Badge tone="warm">Data window stale — try 6M</Badge>
            ) : (
              <Badge tone="neutral">Live cohort board</Badge>
            )}
          </div>

          <h1 className="hero-display">
            Reputation tiers.
            <br />
            <span className="hero-display-accent">First conviction.</span>
          </h1>

          <p className="hero-lede">
            See which Ethos score cohort spots a project first, how attention spreads across the board, and whether the
            thesis held — without inflating top-tier weight.
          </p>

          <div className="hero-cta-row">
            <a className="button button-default hero-cta-primary" href="#mindshare-board">
              Open mindshare arena
            </a>
            <a className="button button-secondary hero-cta-secondary" href="#tier-system">
              How tiers work
            </a>
          </div>

          <div className="hero-stat-bento">
            <article className="hero-stat hero-stat-featured">
              <span className="hero-stat-label">Leading project</span>
              <strong className="hero-stat-value hero-stat-value-text">
                {topProject?.project.name ?? "Awaiting signal"}
              </strong>
              <span className="hero-stat-meta">Highest mention weight on board</span>
            </article>
            <article className="hero-stat">
              <span className="hero-stat-label">Mentions</span>
              <strong className="hero-stat-value">{totalMentions.toLocaleString()}</strong>
              <span className="hero-stat-meta">Loaded cohort window</span>
            </article>
            <article className="hero-stat">
              <span className="hero-stat-label">First calls</span>
              <strong className="hero-stat-value">{firstMentions.length.toLocaleString()}</strong>
              <span className="hero-stat-meta">First-tracked mentions</span>
            </article>
            <article className="hero-stat">
              <span className="hero-stat-label">24h coverage</span>
              <strong className="hero-stat-value">{collector.coveragePct}%</strong>
              <span className="hero-stat-meta">
                {collector.coveredLast24h.toLocaleString()} / {collector.totalTrackedAccounts.toLocaleString()} accounts
              </span>
              <div className="coverage-meter hero-coverage-meter" aria-hidden="true">
                <div
                  className="coverage-meter-fill"
                  style={{ width: `${Math.min(100, Math.max(0, collector.coveragePct))}%` }}
                />
              </div>
            </article>
            <article className="hero-stat">
              <span className="hero-stat-label">Validated 7d+</span>
              <strong className="hero-stat-value">
                {validatedProjects}
                <span className="hero-stat-slash">/{model.outcomes.length}</span>
              </strong>
              <span className="hero-stat-meta">Outcomes with positive 7d return</span>
            </article>
          </div>
        </div>
      </section>

      {freshness.isStale || freshness.mentionsLast90d === 0 ? (
        <section className="data-alert" role="status">
          <div className="data-alert-icon" aria-hidden="true">
            ⚡
          </div>
          <div className="data-alert-copy">
            <strong>Short windows look quiet</strong>
            <p>
              {freshness.totalMentions > 0
                ? `${freshness.totalMentions.toLocaleString()} historical mentions in DB · ${freshness.mentionsLast90d.toLocaleString()} in 90d · ${freshness.mentionsLast180d.toLocaleString()} in 180d.`
                : "No mentions stored yet — the arena fills after collector sweeps."}
              {freshness.latestCollectorRunAt
                ? ` Last run ${new Date(freshness.latestCollectorRunAt).toLocaleString()}.`
                : ""}
            </p>
          </div>
        </section>
      ) : null}

      <section id="coverage-panel" className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Coverage</p>
            <h2 className="section-title">Network pulse</h2>
          </div>
          <p className="section-sub">
            Ethos listings, signal authors, and collector health at a glance.
          </p>
        </div>
        <div className="metric-grid">
          <MetricCard label="Projects tracked" value={model.projects.length} delta="Ethos listings synced" tone="accent" icon="◈" />
          <MetricCard label="Signal authors" value={model.totalUsers.toLocaleString()} delta="Ethos profiles synced" icon="◎" />
          <MetricCard label="Mentions ingested" value={totalMentions.toLocaleString()} delta="In current load window" icon="✦" />
          <MetricCard
            label="24h coverage"
            value={`${collector.coveragePct}%`}
            delta={`${collector.coveredLast24h} of ${collector.totalTrackedAccounts} accounts`}
            tone={collector.coveragePct >= 70 ? "accent" : "warm"}
            icon="◉"
          />
        </div>
      </section>

      <section id="mindshare-board" className="section-block">
        <Card variant="surface" className="section-card arena-card">
          <CardHeader className="card-header-split arena-header">
            <div className="stack-3">
              <p className="section-eyebrow">Arena</p>
              <CardTitle className="section-title-inline">Mindshare</CardTitle>
              <p className="muted-copy compact-copy">
                Project attention from the Ethos cohort — filter by time window and tier to see where conviction starts
                and where it spreads.
              </p>
            </div>
            <Badge tone="accent">Live board</Badge>
          </CardHeader>
          <CardContent className="stack-3 arena-body">
            <ProjectMindshareBoard projects={model.projects} mentions={model.mentions} freshness={freshness} />
          </CardContent>
        </Card>
      </section>

      <section id="tier-system" className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Scoring</p>
            <h2 className="section-title">Tier system</h2>
          </div>
          <Badge tone="neutral">Score-based · equal weight</Badge>
        </div>
        <p className="section-sub section-sub-wide">
          Tiers come from raw Ethos score only. Every mention counts equally — use filters to inspect the same flow
          across higher-score and lower-score cohorts.
        </p>
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
      </section>
    </DashboardShell>
  );
}
