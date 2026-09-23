import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluir logos CFDI en las funciones serverless (FacturoPorTi Logotipo).
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/cfdi/**/*", "./public/cfdi/**/*"],
  },
  serverExternalPackages: [
    '@nodecfdi/sat-ws-descarga-masiva',
    '@nodecfdi/credentials',
    '@napi-rs/canvas',
    'pdfjs-dist',
  ],
};

export default nextConfig;
