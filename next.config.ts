import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluir logos CFDI en las funciones serverless (FacturoPorTi Logotipo).
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/cfdi/**/*", "./public/cfdi/**/*"],
  },
};

export default nextConfig;
