import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("ui-table-wrap", className)}>{children}</div>;
}
