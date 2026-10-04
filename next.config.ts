import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Workspace-Packages werden als TS-Quelle konsumiert und müssen von Next transpiliert werden.
  transpilePackages: ["@unslop/shared", "@unslop/prescan"],
  // Die Engine-Dependencies des Pre-Scanners bleiben UNGEBUNDELT: Turbopack
  // würde sonst versuchen, jede Grammatik-WASM als ES-Modul zu bundeln
  // (199 Build-Fehler), und web-tree-sitter lädt sein Runtime-WASM per fs
  // relativ zum eigenen Modulpfad — das funktioniert nur als echtes
  // node_modules-Require zur Laufzeit.
  serverExternalPackages: [
    "web-tree-sitter",
    "tree-sitter-wasms",
    "eslint",
    "eslint-plugin-sonarjs",
    "eslint-plugin-security",
    "eslint-plugin-react",
    "@typescript-eslint/parser",
  ],
  // Pre-Scanner (pre_scanner_design.md §7.6): web-tree-sitter lädt sein
  // Runtime-WASM und die Grammatiken zur Laufzeit via fs — Vercels
  // File-Tracing sieht diese Pfade nicht und muss sie explizit mitnehmen.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/web-tree-sitter/*.wasm",
      "./node_modules/tree-sitter-wasms/out/*.wasm",
    ],
    // Rechtsseiten (LEGAL_PAGES_SPEC.md §5.3): die Markdown-Quellen werden
    // zur Laufzeit per fs gelesen, nicht importiert.
    "/[locale]/[legalSlug]": ["./src/content/legal/*.md"],
  },
};

export default withNextIntl(nextConfig);
