import { cn } from "@/lib/utils";
import type { Severidad } from "@/lib/audit-types";

const STYLES: Record<Severidad, string> = {
  ALTA: "bg-sev-alta/12 text-sev-alta border-sev-alta/25",
  MEDIA: "bg-sev-media/15 text-sev-media-foreground border-sev-media/40",
  BAJA: "bg-sev-baja/12 text-sev-baja border-sev-baja/25",
};

const LABEL: Record<Severidad, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export function SeverityBadge({
  severidad,
  className,
}: {
  severidad: Severidad;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[severidad],
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          severidad === "ALTA" && "bg-sev-alta",
          severidad === "MEDIA" && "bg-sev-media",
          severidad === "BAJA" && "bg-sev-baja"
        )}
      />
      {LABEL[severidad]}
    </span>
  );
}
