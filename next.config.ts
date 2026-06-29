import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen Docker mínima para Cloud Run (genera .next/standalone + server.js).
  output: "standalone",
  // El cliente/motor de Prisma vive en src/generated/prisma; lo forzamos en el
  // trace para que el binario del query engine quede dentro del standalone.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
