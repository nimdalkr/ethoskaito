import type { ReactNode } from "react";

export function DashboardShell({
  header,
  children
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <div className="shell-inner dashboard-stack">
        <div className="shell-panel shell-panel-header">{header}</div>
        <div className="dashboard-grid">{children}</div>
      </div>
    </main>
  );
}
