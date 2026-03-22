import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "accent" | "neutral" | "warm" | "danger";

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return <span className={cn("badge", `badge-${tone}`, className)}>{children}</span>;
}
