import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluir logos CFDI (FacturoPorTi Logotipo) y plantillas de boletas de primaria en las funciones serverless.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./assets/cfdi/**/*",
      "./public/cfdi/**/*",
      "./public/boletas/primaria-es/boleta1.jpg",
      "./public/boletas/primaria-es/atras.jpg",
      "./public/boletas/primaria-en/bol1.jpg",
    ],
  },
  serverExternalPackages: [
    '@nodecfdi/sat-ws-descarga-masiva',
    '@nodecfdi/credentials',
    '@napi-rs/canvas',
    'pdfjs-dist',
  ],
};

export default nextConfig;
