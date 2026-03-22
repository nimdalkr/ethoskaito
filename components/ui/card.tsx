import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  variant = "default"
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "surface";
}) {
  return <section className={cn("ui-card", variant === "surface" && "ui-card-surface", className)}>{children}</section>;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ui-card-header", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("ui-card-title", className)}>{children}</h2>;
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ui-card-content", className)}>{children}</div>;
}
