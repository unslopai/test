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
  // Das File-Tracing der API-Funktionen sammelt ganze Projektordner ein, die
  // zur Laufzeit niemand liest (fixtures, docs, supabase, scripts). Mit den
  // Videos unter distribution/ riss /api/internal/prescan am 2026-09-29 auf
  // einem Preview die 250-MB-Grenze von Vercel (278 MB). Keine Serverroute
  // liest diese Ordner (git grep ohne Treffer ausserhalb von Tests).
  outputFileTracingExcludes: {
    "/api/**": [
      "./distribution/**",
      "./docs/**",
      "./fixtures/**",
      "./supabase/**",
      "./scripts/**",
    ],
  },
  // NUR für die Prescan-Route: sie ist die einzige, die runPrescan ausführt
  // (eigene Invocation, internal-contract.ts). Mit "/api/**" lagen die ~50 MB
  // WASM in allen API-Routen, ~1,4 GB je Deployment, und füllten am
  // 2026-09-30 75 % der 10 GB Function Storage des Hobby-Teams.
  outputFileTracingIncludes: {
    "/api/internal/prescan": [
      "./node_modules/web-tree-sitter/*.wasm",
      "./node_modules/tree-sitter-wasms/out/*.wasm",
    ],
    // Rechtsseiten (LEGAL_PAGES_SPEC.md §5.3): die Markdown-Quellen werden
    // zur Laufzeit per fs gelesen, nicht importiert.
    "/[locale]/[legalSlug]": ["./src/content/legal/*.md"],
  },
};

export default withNextIntl(nextConfig);
