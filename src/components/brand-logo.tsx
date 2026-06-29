import Image from "next/image";
import { cn } from "@/lib/utils";

const ASPECTS = {
  horizontal: { w: 1123, h: 255 },
  isotype: { w: 1197, h: 1197 },
  vertical: { w: 1620, h: 1620 },
} as const;

const FILES = {
  horizontal: "/brand/softop-horizontal.png",
  isotype: "/brand/softop-isotype.png",
  vertical: "/brand/softop-vertical.png",
} as const;

export function BrandLogo({
  variant = "horizontal",
  height = 28,
  className,
  priority,
}: {
  variant?: keyof typeof ASPECTS;
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const { w, h } = ASPECTS[variant];
  const width = Math.round((w / h) * height);
  return (
    <Image
      src={FILES[variant]}
      alt="Softop"
      width={width}
      height={height}
      priority={priority}
      unoptimized
      style={{ height, width: "auto" }}
      className={cn("object-contain", className)}
    />
  );
}
