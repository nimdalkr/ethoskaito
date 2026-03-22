import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost";

export function Button({
  children,
  variant = "default",
  className,
  type = "button"
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button type={type} className={cn("button", `button-${variant}`, className)}>
      {children}
    </button>
  );
}
