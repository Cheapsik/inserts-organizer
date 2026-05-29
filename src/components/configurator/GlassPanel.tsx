import type { ReactNode } from "react";

export function GlassPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`spatial-glass pointer-events-auto rounded-[24px] ${className}`}>{children}</div>
  );
}
