import * as React from "react";

import { cn } from "@/lib/utils";

type StatusAlertTone = "success" | "error" | "info";

interface StatusAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone: StatusAlertTone;
  icon?: React.ReactNode;
}

const toneClasses: Record<StatusAlertTone, string> = {
  success: "border-success-subtle bg-success-subtle/50 text-success",
  error: "border-error-subtle bg-error-subtle/50 text-error",
  info: "border-info-subtle bg-info-subtle/50 text-info",
};

export function StatusAlert({
  tone,
  icon,
  className,
  children,
  ...props
}: StatusAlertProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        icon ? "flex items-start gap-3" : null,
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
      <div>{children}</div>
    </div>
  );
}
