import Link from "next/link";
import { cn } from "@/lib/utils";

export function SiteHeader({
  liveLabel = "Collector live",
  className
}: {
  liveLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("site-header", className)}>
      <div className="site-header-inner">
        <div className="site-header-left">
          <Link href="/" className="site-brand" aria-label="Ethos Alpha home">
            <span className="site-brand-mark" aria-hidden="true">
              <span className="site-brand-mark-core" />
            </span>
            <span className="site-brand-text">
              ETHOS<span className="site-brand-accent">ALPHA</span>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            <a href="/#mindshare-board">Mindshare</a>
            <a href="/#coverage-panel">Coverage</a>
            <a href="/#tier-system">Tiers</a>
          </nav>
        </div>
        <div className="site-header-right">
          <span className="live-pill">
            <span className="live-pill-dot" aria-hidden="true" />
            {liveLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
