import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";

export function DashboardShell({
  header,
  children,
  liveLabel
}: {
  header?: ReactNode;
  children: ReactNode;
  liveLabel?: string;
}) {
  return (
    <main className="app-shell">
      <SiteHeader liveLabel={liveLabel} />
      <div className="shell-inner dashboard-stack">
        {header ? <div className="page-intro">{header}</div> : null}
        <div className="dashboard-grid">{children}</div>
      </div>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>Ethos reputation × X signal mindshare</span>
          <span className="site-footer-meta">Equal-weight mentions · score-based tiers</span>
        </div>
      </footer>
    </main>
  );
}
