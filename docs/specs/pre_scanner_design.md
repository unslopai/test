# Deterministic Pre-Scanner (Zero-Token Filter) — Design Blueprint

**Roadmap §1 · Status: IMPLEMENTED v1–v4 (rollout §8, v4 decisions §9) · designed 2026-07-19, last update 2026-09-26**

The pre-scanner is a deterministic static-analysis layer that runs **after `diff-loader` and before `rag-loader`**, producing `PipelineIssue`s with zero LLM tokens, zero hallucination risk, and structural immunity from the verifier cascade. It is the direct implementation of **PROC-001** ("CI gates must be deterministic; an LLM may explain findings but never be the pass/fail criterion") and **PROC-003** ("run the deterministic detector *before* any AI step").

---

## 0. Executive Summary of Decisions

| Decision | Choice | Why |
|---|---|---|
| Parsing backbone | **web-tree-sitter (WASM)** — one parser API for C/C++, Python, Java, Go, Rust, TS/TSX, JS | Runs in the Vercel Node runtime (no native binaries), one grammar per language, single traversal shared by all AST rules. Native `tree-sitter` bindings are faster but cannot deploy to Vercel; WASM speed is sufficient for diff-sized inputs. |
| TS/JS deep rules | **ESLint `Linter` API (in-memory) + `eslint-plugin-sonarjs` + `eslint-plugin-security` (+ `react/no-danger`)** | `sonarjs/cognitive-complexity` is the reference Sonar implementation of ARCH-001 — do not re-implement it for TS/JS. `eslint-plugin-security` is pure JS and battle-tested — its `detect-child-process`, `detect-eval-with-expression`, `detect-pseudoRandomBytes`, `detect-non-literal-fs-filename` rules upgrade several JS/TS checks from CLI-only to cloud-capable. For Python/Go/Java, a generic Sonar-algorithm visitor runs on tree-sitter trees. |
| Secrets | **Custom regex + Shannon entropy in the shared core** (provider formats from SEC-005), `gitleaks` as CLI-tier upgrade | gitleaks/trufflehog are Go/Python binaries — not cloud-deployable. The provider-format regex set covers the documented failure mode (demo-code secrets). |
| K8s / IaC | **`yaml` npm parse + JSON-path predicates** implementing INFRA-001…011 directly; `checkov`/`kube-linter` as CLI-tier ensemble (PROC-014) | The 11 INFRA rules are trivially expressible as presence/value checks on parsed manifests — no external engine needed for the core. |
| Package-existence (SEC-035/036) | **Registry HTTP checks (npm/PyPI/crates/HF Hub JSON APIs)** with a Supabase-backed cache table | The only rule class that needs network — it is still deterministic (registry 404 is a fact, not a judgment). |
| External tools (Semgrep, checkov, clang-tidy, PSScriptAnalyzer, Slither) | **`StaticAnalysisAdapter` tier — CLI environment only, availability-probed, never required** | Semgrep needs Python≥3.7, checkov is Python, gitleaks is Go — none run inside the Next.js server. The cloud core must be self-sufficient; external tools only *add* findings locally. |
| Input acquisition | **Full file contents at `headSha` via GitHub Contents API** (PR jobs); patch-only degraded mode for CLI jobs | ASTs cannot be built from unified-diff patches. Findings are then filtered to **added lines** (PROC-007). Full-file scanning also satisfies PROC-004/CONC-008 (scan the whole file, not the hunk). |
| Cascade bypass | New context lane **`prescanIssues`**, merged only at report/persist time | `claim-verifier` builds blind claims from `context.issues` — a separate field is a *structural* guarantee (same pattern as the PROC-001 practices isolation) that deterministic findings are never re-judged by an LLM. |
| Short-circuit | Config-gated: ≥ N CRITICAL prescan findings ⇒ skip `rag-loader` + all LLM steps | Token cost drops to zero for structurally broken diffs; reporter/persister still run. Never via `shouldAbort` (that suppresses reporting). |
| Code location | New workspace package **`packages/prescan`** (pure TS core + engine adapters), consumed by `src/lib/pipeline/steps/pre-scanner-step.ts` | The CLI and VS Code extension can later run the identical core locally ("fast fail before upload") without duplicating rule logic. |
| Launch posture | **On by default** (`pre-scanner` in `DEFAULT_PIPELINE_CONFIG.enabledStepIds` and `CLI_PIPELINE_STEPS`) behind a **Soft-Launch Fail-Safe Gate** (§5.4) | Zero-token wins should reach every repo immediately; the fail-safe guarantees a prescan failure can never degrade the product below its pre-prescan behavior — the LLM review always proceeds. |

---

## 1. Rule Categorization Table (all 119 golden rules)

**Mechanism legend**
- **AST** — custom tree-sitter/ESLint rule in the shared JS core (Cloud + CLI)
- **RGX** — regex/line rule on file content or added lines (Cloud + CLI)
- **CFG-P** — config-file parse check (`yaml`/JSON/HCL) (Cloud + CLI)
- **NET** — registry existence lookup over HTTPS (Cloud + CLI)
- **EXT** — external tool via `StaticAnalysisAdapter` (**CLI only**; containerized cloud runner is a possible later phase)
- **LLM** — stays in the LLM pipeline (not deterministically checkable)
- **POLICY** — a process rule implemented as pipeline/scanner *behavior*, not a per-line check

**Coverage**: `full` = the deterministic check fully enforces the rule → candidate for Law-block removal (§7.3); `partial` = deterministic check catches the mechanical subset, LLM keeps the semantic remainder; `—` = no deterministic component in v1.

### Security (SEC)

| Rule | Deterministic mechanism | Cloud engine | CLI upgrade | Coverage |
|---|---|---|---|---|
| SEC-001 malloc w/o NULL-check (c;cpp) | AST: alloc-assignment → next-use-before-null-guard heuristic | tree-sitter-c/cpp | clang-tidy `clang-analyzer-core.NullDereference` | partial |
| SEC-002 loop bound unverified (c;cpp) | scope analysis too FP-heavy for core | — (LLM) | CodeQL / clang-tidy | partial (EXT only) |
| SEC-003 int overflow before alloc (c;cpp) | — (needs value-range analysis) | — (LLM) | CodeQL | — |
| SEC-004 SQLi string interpolation | AST: `.execute/.raw/.query` with f-string/`.format`/`%`/template-literal/`+`-concat arg | tree-sitter py/ts/java | Semgrep `p/sql-injection` (e.g. `javascript.lang.security.audit.sqli.node-mysql-sqli`, `node-knex-sqli`), Bandit B608, Sonar S2077/S3649, CodeQL `py/sql-injection`+`js/sql-injection` | full (mechanical form) |
| SEC-005 hardcoded secrets | RGX: provider formats (`GOCSPX-`, `AIza`, `sk-`, `AKIA`, `ghp_`, PEM, JWT) + entropy ≥ 4.0 on `/key\|secret\|passw\|token/i` assignments | regex engine | gitleaks / trufflehog | full |
| SEC-006 unsafe deserialization | AST: `pickle.load(s)`, `yaml.load` w/o `SafeLoader`, `torch.load` w/o `weights_only=True`, `joblib.load`, `ObjectInputStream` w/o filter, `enableDefaultTyping`, `new Yaml()` w/o `SafeConstructor` | tree-sitter py/java | Bandit B301/B302/B506, CodeQL | full |
| SEC-007 resource leaks / no timeout | AST subset: `open()`/connection acquire outside `with`/try-finally; `requests.*`/`fetch` w/o `timeout` | tree-sitter py | CodeQL `py/file-not-closed` + `js/missing-resource-release` | partial |
| SEC-008 weak randomness for secrets | AST: `import random` + `/token\|session\|secret\|otp\|nonce\|reset/i` identifier in same function; `random.seed(<literal>)`; `Math.random()` flowing into token-named vars | tree-sitter py/ts + ESLint `security/detect-pseudoRandomBytes` | Bandit B311/B324, Sonar S2245, gosec G404 | partial |
| SEC-009 command injection | AST: `subprocess.*(shell=True)` / `os.system` / `Runtime.exec` / `child_process.exec` with non-literal argument | tree-sitter py/java/ts + ESLint `security/detect-child-process` | Bandit B602–B607, gosec G204, Sonar S4721, Semgrep `p/command-injection` (e.g. `java.spring.security.injection.tainted-system-command`), CodeQL `py/command-line-injection` | full (mechanical form) |
| SEC-010 uncontrolled search path / path manipulation | RGX: `sys.path.insert(0,`, `os.environ["PATH"] +=` (py); ESLint `security/detect-non-literal-fs-filename` + `detect-non-literal-require` (JS/TS) | regex + ESLint | CodeQL `py/path-injection`, gosec G304, Sonar S2083, Semgrep `javascript.lang.security.audit.path-traversal.path-join-resolve-traversal` | partial |
| SEC-011 eval/exec injection | AST: `eval(`/`exec(` non-literal arg (py/js); RGX: `Invoke-Expression`/`IEX` (ps1) | tree-sitter + regex + ESLint `security/detect-eval-with-expression` | Bandit B307/B102, PSScriptAnalyzer `PSAvoidUsingInvokeExpression` | full |
| SEC-012 insecure password storage | RGX subset: `md5\|sha1\|sha256(` applied to `/passw(or)?d/i` identifiers; KDF-allowlist absence in auth files; raw `==` compare → ESLint `security/detect-possible-timing-attacks` | regex + ESLint | CodeQL taint, FindSecBugs `WEAK_MESSAGE_DIGEST_*`, Sonar S5344 | partial |
| SEC-013 fail-open privilege logic | needs CFG + reachability | — (LLM) | CodeQL custom query | — |
| SEC-014 MD5/SHA1 for auth | RGX: `\b(MD5\|MD4\|SHA-?1)\b` inside `getInstance`/`hashlib.`/`createHash(` | regex | gosec G501–G505 (import blacklist), Sonar S4790, CodeQL `java/weak-cryptographic-algorithm` + `py/weak-cryptographic-algorithm` (auth-sink taint) | full (algorithm part) |
| SEC-015 ECB/DES/no-AEAD modes | RGX/AST: `Cipher.getInstance`/`createCipheriv` arg matches `ECB\|DES\|DESede\|RC2\|RC4\|Blowfish` or bare algorithm | tree-sitter java/ts + regex | FindSecBugs, Sonar S5542 | full |
| SEC-016 RSA < 2048 bit | AST: `initialize(n)` / `modulusLength: n` integer literal `< 2048` | tree-sitter java/ts | Sonar S4426 | full |
| SEC-017 disabled TLS verification | RGX: `verify=False`, `rejectUnauthorized: false`, `InsecureSkipVerify: true`, `CURLOPT_SSL_VERIFY*` = 0; AST: empty `checkServerTrusted`, `return true` HostnameVerifier | regex + tree-sitter java | Bandit B501–B503, gosec G402, Sonar S4830 (cert validation) + S5527 (hostname) | full |
| SEC-018 OAuth w/o state/PKCE | RGX presence: auth-URL construction without `state`/`code_challenge` params (secret part → SEC-005) | regex | Semgrep oauth pack | partial |
| SEC-019 missing security headers | CFG-P: parse `next.config.*`/middleware/bootstrap for CSP, X-Frame-Options, HSTS, Referrer-Policy; new `express()`/`Flask()` without helmet/secure_headers | config engine | — | partial (file-level; v4 ships the Next.js middleware/proxy form only, §9.1) |
| SEC-020 account enumeration | AST heuristic: distinct error literals in user-lookup vs password-compare branches — FP-prone | — (LLM) | Semgrep custom | — |
| SEC-021 no rate-limit on login | AST presence: route handler matching `/(login\|signin\|auth\|password\|token)/i` + credential compare, no known limiter import/call | tree-sitter ts | — | partial |
| SEC-022 insecure session cookies | AST: `cookies().set`/`res.cookie`/`Set-Cookie` options object missing `httpOnly`/`secure`/`sameSite` | tree-sitter ts | Sonar S2092 (`secure`) + S3330 (`httpOnly`) | full (flag part) |
| SEC-023 non-surviving memset (c;cpp) | AST: `memset`/`bzero` on `/key\|secret\|password\|iv\|nonce\|token/i` buffer before `free`/scope-exit without `explicit_bzero` family | tree-sitter c | clang-tidy `c:S5798` analog | partial |
| SEC-024 permissive CORS | RGX: `Access-Control-Allow-Origin: *` or reflected `req.headers.origin`; hard fail with `Allow-Credentials: true` | regex | Sonar S5122 | full |
| SEC-025 missing CSRF protection | AST presence: POST/PUT/PATCH/DELETE handler reading cookies without origin-check/CSRF middleware | tree-sitter ts + ESLint `security/detect-no-csrf-before-method-override` | Sonar S4502 | partial |
| SEC-026 XSS sinks | AST: `dangerouslySetInnerHTML` `__html` not a direct `DOMPurify.sanitize`/`sanitize-html` call or static literal; `.innerHTML`/`.outerHTML`/`document.write` assignment | tree-sitter tsx + ESLint `react/no-danger` | Semgrep react pack | full |
| SEC-027 unbounded `%s` scanf (c;cpp) | RGX: `\b(f\|s)?scanf\s*\(` format with `%s`/`%[` lacking field width | regex | ESBMC, `-Wformat -Werror` | full |
| SEC-028 use-after-free (c;cpp) | AST heuristic: use of `p` after `free(p)` in same block w/o reassignment; `free(p)` w/o `p = NULL` → WARNING | tree-sitter c | CodeQL `cpp/use-after-free`, ASan | partial |
| SEC-029 banned libc APIs (c;cpp) | RGX word-boundary: `gets\|strcpy\|strcat\|sprintf\|vsprintf\|stpcpy\|alloca\|tmpnam\|mktemp` | regex | clang-tidy `insecureAPI.*` | full |
| SEC-030 NPE / bare `Optional.get` (java) | AST: `.get()` on Optional receiver without dominating `isPresent`/`orElseThrow` in method | tree-sitter java | SpotBugs NP_*, NullAway | partial |
| SEC-031 silent success in catch | AST: catch/except returning success-shaped value (2xx / same keys as happy path) without re-raise/log | tree-sitter py/ts/java | — | partial |
| SEC-032 wildcard IAM on serverless | CFG-P: IAM statement `Effect: Allow` + `Resource: "*"` + high-risk action list (JSON/YAML CFN/SAM; HCL via `hcl2-parser`) | config engine | checkov CKV_AWS_1/355/62 | full |
| SEC-033 shared high-priv role | CFG-P: count functions per role ARN in template graph, flag > 1 with high-risk policy | config engine | checkov/OPA custom | full |
| SEC-034 cross-account layer/image | CFG-P partial: foreign account-ID in layer ARN / image URI without pinned digest (stack account unknown in cloud) | config engine | checkov custom | partial |
| SEC-035 hallucinated packages | NET: every import/dependency **added in the diff** resolved against npm/PyPI/crates JSON API; 404 ⇒ CRITICAL; results cached (§6.3) | registry engine | same + lockfile re-runs | full |
| SEC-036 unverified HF artifacts | NET: `from_pretrained`/`hub_download` literal id resolved via HF Hub API; non-safetensors pickle format ⇒ fail | registry engine | same | full |
| SEC-037 eval of LLM output | AST heuristic: `eval`/`exec`/`Function()` arg traced (single-function) to `/response\|completion\|choices\|output/i`-named source | tree-sitter | CodeQL taint | partial |
| SEC-038 unvalidated tool params | AST presence: tool-call handler dispatching to API/DB/shell without schema/Zod/Pydantic validation call | tree-sitter | — | partial |
| SEC-039 secrets in agent memory | RGX: SEC-005 pattern set applied to memory-store/transcript writes | regex | trufflehog | partial |
| SEC-040 unsanitized exec feedback | AST: raw subprocess stdout/stderr concatenated into LLM prompt without length-limit/strip call | tree-sitter | — | partial |
| SEC-041 MCP metadata injection | AST: MCP `description`/`annotations` field passed into prompt context without sanitize call | tree-sitter | — | partial |
| SEC-042 denylist-only shell gates | CFG-P: agent config with `deny/blocklist` keys and no `allow` counterpart | config engine | — | full |
| SEC-043 unscoped tool grants | CFG-P: tool manifest without scoped resource pattern (`**` glob, absent command list) | config engine | — | full |
| SEC-044 non-expiring subtask grants | AST reachability (revoke on success path) — beyond v1 | — (LLM) | CodeQL custom | — |
| SEC-045 tool output into system role | AST: raw tool-output concat into system/developer role fields | tree-sitter | — | partial |
| SEC-046 missing scope boundary | RGX presence check on agent prompt/template files | regex | — | full (presence part) |
| SEC-047 pre-trust execution/egress | control-flow reachability — beyond v1 | — (LLM) | CodeQL custom | — |
| SEC-048 PS download cradle | RGX: `IEX/Invoke-Expression` + `Invoke-WebRequest\|DownloadString\|Net.WebClient` in one pipeline (after PROC-013 decode pass) | regex | PSScriptAnalyzer | full |
| SEC-049 ExecutionPolicy/AMSI bypass | RGX: `-ExecutionPolicy (Bypass\|Unrestricted)`, `AmsiUtils\|amsiInitFailed`, `-EncodedCommand` | regex | custom PSSA rules | full |
| SEC-050 credential dumping / LOLBins | RGX denylist: `rundll32\|certutil -urlcache\|mshta\|Invoke-Mimikatz\|procdump.*lsass` | regex | Sigma rule set | full |
| SEC-051 Solidity gate | — in cloud | — (LLM advisory) | Slither + Mythril (EXT) | full via EXT |

### Hallucination (HAL)

| Rule | Mechanism | Cloud | CLI | Coverage |
|---|---|---|---|---|
| HAL-001 hand-rolled crypto primitives | RGX: crypto magic constants (`0x67452301`, SHA-256 K-table, AES S-box literals) + `/def (sha1\|md5\|aes\|encrypt)/i` on non-lib files | regex | Semgrep crypto pack | partial |
| HAL-002 API hallucination | needs full project + type info | — (LLM) | `tsc --noEmit`, pyright, ESLint `no-undef` (EXT, project-level) | partial via EXT |
| HAL-003 uninitialized variables | — (needs CFG dominance) | — (LLM) | Ruff F821, CodeQL | full via EXT |
| HAL-004 stub implementations | AST subset: new/changed method with empty body or lone `return null/0` / `throw UnsupportedOperationException` | tree-sitter java/ts/py | javac -Werror (EXT) | partial |
| HAL-005 hallucinated embedded APIs | compile/link gate | — | vendor-SDK compile (EXT) | full via EXT |
| HAL-006 translation semantic drift | differential testing — not static | — (LLM) | — | — |
| HAL-007 collapsed error branches | AST count-compare needs source+target pair — beyond v1 | — (LLM) | — | — |
| HAL-008 type/format narrowing | AST subset: diff-visible narrowing (`int64→int32`, `decimal→double`) in changed signatures | tree-sitter | — | partial |
| HAL-009 translation baseline | process gate (mutant voting) | POLICY | — | — |

### Complexity (ARCH)

| Rule | Mechanism | Cloud | CLI | Coverage |
|---|---|---|---|---|
| ARCH-001 cognitive complexity > 15 | AST: `sonarjs/cognitive-complexity` (TS/JS via ESLint Linter API); generic Sonar-algorithm tree-sitter visitor (py/go/java). **Exempt test files (TEST-010).** | ESLint + tree-sitter | — | full |
| ARCH-002 >5 nesting / method >50 lines | AST: control-structure ancestor depth; function span in logical lines | tree-sitter all langs | Sonar S134 (nesting depth), S138 (function length) | full |
| ARCH-003 containers nested ≥3 (py) | AST: container-literal/comprehension ancestor depth | tree-sitter py | custom pylint visitor | full |
| ARCH-004 long parameter list (>5) | AST: formal-parameter count on function nodes | tree-sitter all langs | Pylint R0913, ESLint max-params | full |
| ARCH-005 compile gate low-resource langs | compilation — not static-scannable | — | `go build`/`go vet`, `sbt compile`… (EXT) | full via EXT |

### Maintainability (MAINT)

| Rule | Mechanism | Cloud | CLI | Coverage |
|---|---|---|---|---|
| MAINT-001 empty catch / swallowing | AST: empty catch bodies, `pass`-only except handlers | tree-sitter ts/py/java | detekt, ESLint no-empty | full |
| MAINT-002 broad suppression / `.unwrap()` after crypto | AST: `except Exception:`/bare except w/o re-raise+log; `catch` w/o rethrow/log; Rust `.unwrap()\|.expect(` after `encrypt\|decrypt\|sign\|verify` receiver | tree-sitter ts/py/java/rust | detekt SwallowedException, Sonar S2486 | full |
| MAINT-003 magic numbers | AST: numeric literals ∉ {0,1,-1} in conditions/assertions without named binding | tree-sitter | SonarQube S109 | full (noisy → WARNING) |
| MAINT-004 redundant variables | AST: alias assignment (`const b = a`) with no divergent use | tree-sitter | PMD | partial |
| MAINT-005 duplication / overblanking | RGX: >2 consecutive blank lines (overblanking); duplication needs corpus | regex | jscpd, Prettier diff-gate | partial |
| MAINT-006 AI-SATD comments | RGX: `(TODO\|FIXME\|HACK\|XXX)` + `(copilot\|chatgpt\|gpt\|gemini\|claude\|llm\|ai.generated)` in same comment, no ticket ref | regex | — | full |
| MAINT-007 dead code | project-wide reachability | — (LLM) | Vulture, ESLint no-unused-vars (EXT project run) | partial via EXT |
| MAINT-008 copyleft provenance | needs OSS index | — | ScanCode/FOSSA (EXT) | full via EXT |
| MAINT-009 unused new dependency | NET/CFG-P partial: manifest-added package with no import in diff → WARNING | config engine | dynamic import tracing (EXT) | partial |

### Testing (TEST)

| Rule | Mechanism | Cloud | CLI | Coverage |
|---|---|---|---|---|
| TEST-001 assertion-free tests | AST: test function (`it()`/`test()`/`@Test`/`def test_`) with zero assertion-API calls and no expected-throw construct | tree-sitter | — | full |
| TEST-002 assertion roulette | AST: ≥2 assertions w/o message/description arg per test | tree-sitter | — | full |
| TEST-003 missing exception-path tests | coverage cross-check | — (LLM) | coverage tooling (EXT) | — |
| TEST-004 non-compiling tests | execution gate | — | test runner (EXT/CI) | full via CI |
| TEST-005 coverage illusion | mutation testing | — | PITest/Stryker (EXT/CI) | — |
| TEST-006 self-verification bias | process rule | POLICY | — | — |
| TEST-007 shallow mocking | project surface comparison | — (LLM) | EXT advisory | — |
| TEST-008 unseeded randomness in tests | AST subset (b): `Math.random()`/`random.*`/`new Random()` w/o seed in test files | tree-sitter | rerun-gate (CI) | partial |
| TEST-009 mutation realism | process rule | POLICY | — | — |
| TEST-010 no cognitive-complexity gate on tests | **Scanner policy**: ARCH-001/002 suppressed for test files; assertion-density check (TEST-001/002) applies instead | POLICY (in core) | — | full |
| TEST-011 auth-logic single-line bugs | mutation testing | — (LLM flag) | PIT (EXT/CI) | — |

### Concurrency (CONC)

| Rule | Mechanism | Cloud | CLI | Coverage |
|---|---|---|---|---|
| CONC-001 races/deadlocks | AST subset: function acquiring >1 lock → WARNING flag | tree-sitter java/go | JPF, `go -race`, TSan (EXT/CI) | partial |
| CONC-002 fake concurrency | AST: `java.util.concurrent` import with <2 `submit`/`Thread.start` calls | tree-sitter java | JPF (EXT) | partial |
| CONC-003 relaxed memory ordering | RGX flag: `memory_order_(relaxed\|acquire\|release\|acq_rel)`, `volatile` inter-thread signaling → human-review WARNING | regex | TSan (EXT) | partial (flag) |
| CONC-004 unsynced RTOS shared state | RGX heuristic: `xTaskCreate` + shared global writes w/o `xSemaphoreTake`/`taskENTER_CRITICAL` | regex | clang `-Wthread-safety` (EXT) | partial |
| CONC-005 unbounded ISR loops | WCET analysis | — | MISRA tooling (EXT) | — |
| CONC-006 retry w/o idempotency key | AST: retry construct (loop/tenacity/Polly) wrapping POST/INSERT/publish without idempotency-key/UPSERT evidence | tree-sitter | — | partial |
| CONC-007 TOCTOU in agent plans | needs plan-level dataflow | — (LLM) | replay tests (EXT) | — |
| CONC-008 refinement regressions | **Scanner policy**: analyze the whole changed file, not just the hunk (§8.2) | POLICY (in core) | — | full (policy part) |

### Process (PROC) — implemented as architecture, not per-line rules

| Rule | Realization in this design |
|---|---|
| PROC-001 no LLM-judge gating | The pre-scanner itself; `prescanIssues` bypass lane (§5); confidence pinned to 100 |
| PROC-002 scan every revision | Pipeline already runs per PR push; prescan runs unconditionally before LLM steps |
| PROC-003 detector before AI + rule-ID into fix prompt | Step ordering (§5); prescan findings (rule IDs) are available to `draft-reviewer` prompt as *known findings* so the LLM doesn't re-report them |
| PROC-004 full-file re-scan | §8.2 — whole file at `headSha`, findings filtered to added lines |
| PROC-005 static gate ≠ only gate | Prescan never suppresses the LLM review by default (short-circuit is opt-in) |
| PROC-006 no CoT discount | No prompting metadata reaches the scanner — structurally satisfied |
| PROC-007 every added line, no legacy exemption | Added-line filter includes lines that copy pre-existing insecure patterns (§8.3) |
| PROC-008 strictness scales with size | `complexity-router` already does this; prescan adds finding counts to its signal (optional phase 2) |
| PROC-009 gated retrieval | Already implemented (Phase 5); short-circuit additionally skips retrieval entirely |
| PROC-010/011 benchmark & multi-sample gates | Out of scanner scope (evaluation methodology) |
| PROC-012 repair-loop logging | Out of scanner scope (CI concern) |
| PROC-013 deobfuscation pass | §8.4 — `-EncodedCommand` base64 auto-decode before PS regex rules |
| PROC-014 K8s tool ensemble | Core YAML checks + CLI EXT ensemble (checkov + kube-linter); union of rule IDs recorded in `prescanStats` |

### Infrastructure (INFRA) — all cloud-checkable via YAML parse

| Rule | Mechanism (all: `yaml` npm parse of K8s docs + path predicates; CLI upgrade: checkov/kube-linter) | Coverage |
|---|---|---|
| INFRA-001 `privileged: true` | predicate on `containers[].securityContext.privileged` | full |
| INFRA-002 `allowPrivilegeEscalation` not explicitly false | required-field + value predicate | full |
| INFRA-003 `hostIPC/hostNetwork/hostPID: true` | pod-spec predicates | full |
| INFRA-004 `CAP_SYS_ADMIN`/`CAP_SYS_MODULE` added | denylist on `capabilities.add` | full |
| INFRA-005 docker.sock hostPath | value match on `hostPath.path` | full |
| INFRA-006 secrets in manifests | SEC-005 regex set + broad key heuristic (`password\|secret\|token\|key\|credential\|client_secret`) on YAML values not using `valueFrom.secretKeyRef` | full |
| INFRA-007 missing securityContext / runAsNonRoot | presence predicate | full |
| INFRA-008 missing resource limits | presence of `resources.limits.cpu` AND `.memory` per container | full |
| INFRA-009 missing seccompProfile | value ∈ {RuntimeDefault, Localhost}; CRITICAL escalation with privileged | full |
| INFRA-010 writable root FS | `readOnlyRootFilesystem: true` required | full |
| INFRA-011 `http://` literals | regex on Ingress/Service/ConfigMap values (localhost exempt) | full |
| INFRA-012 Terraform cross-resource semantics | needs `terraform plan` against a provider | — cloud; EXT: plan + OPA/Conftest policies (CLI) | partial via EXT |

**Tally**: 58 rules have a full or mechanical-subset deterministic check runnable in **both** environments (AST 31, RGX 17, CFG-P 8, NET 2), 12 more become checkable via CLI-only external tools, ~14 are realized as scanner/pipeline policy, and the remainder stays with the LLM cascade (semantic reasoning, cross-file dataflow, execution-dependent gates).

**Adopted standard rule IDs (research-grounded)**: the cloud ESLint engine bundles `eslint-plugin-security` (`detect-child-process`, `detect-eval-with-expression`, `detect-pseudoRandomBytes`, `detect-non-literal-fs-filename`, `detect-non-literal-require`, `detect-possible-timing-attacks`, `detect-no-csrf-before-method-override`) and `react/no-danger` alongside `sonarjs` — all pure-JS, all runnable in-memory via the `Linter` API. The CLI adapter tier standardizes on: **Bandit** B102/B307, B301/B302/B506, B311/B324, B501–B503, B602–B608 (Python); **gosec** G204, G304, G402, G404, G501–G505 (Go); **Semgrep** packs `p/sql-injection`, `p/command-injection`, `p/owasp-top-ten`; **SonarQube/SonarJS** S107, S109, S134, S138, S2077, S2083, S2092, S2245, S2486, S3330, S3649, S4426, S4502, S4721, S4790, S4830, S5122, S5344, S5527, S5542; **CodeQL** `py/sql-injection`, `py/command-line-injection`, `py/path-injection`, `py/file-not-closed`, `js/missing-resource-release`, `java/weak-cryptographic-algorithm`, `cpp/use-after-free`; **checkov** CKV_K8S_1/2/9/10–13/16/20–23/27/28/29/31/37 and CKV_AWS_1/62/355. Each adapter ships a static `toolRuleId → goldenRuleId` mapping table (§3) so external findings always surface under the golden rule ID.

---

## 2. AST Node Specifications (custom rules)

One tree per file, one traversal: rule visitors register for node types; the walker dispatches during a single depth-first pass. Node names below are tree-sitter grammar node types unless marked *(ESLint)*.

### MAINT-001 / MAINT-002 — exception swallowing
- **TS/JS**: `catch_clause` → child `statement_block` with 0 named children ⇒ CRITICAL-family finding. Non-empty blocks: no `throw_statement` descendant AND no call whose callee text matches `/console\.(error\|warn)\|log(ger)?\./` ⇒ WARNING. *(ESLint fallback: `CatchClause` with empty `BlockStatement`.)*
- **Python**: `except_clause` → body `block` consisting solely of `pass_statement` ⇒ CRITICAL; handler type `except` bare or `Exception` without `raise_statement` descendant and no logging call ⇒ WARNING.
- **Java**: `catch_clause` → empty `block`; broad `catch_type` `Exception|Throwable` w/o `throw_statement`/logger call.
- **Rust (MAINT-002)**: `call_expression` where field `method` ∈ {`unwrap`, `expect`} and receiver subtree contains a call to `/encrypt|decrypt|sign|verify|seal|open/`.

### SEC-004 — SQL string interpolation
- **Python**: `call` node, `function` is `attribute` with attr ∈ {`execute`, `executemany`, `raw`}; first `argument` is: `binary_operator` (`%` or `+`), OR `call` on attr `format`, OR `string` containing `interpolation` (f-string) ⇒ fail even if remaining args are parameterized.
- **TS/JS**: `call_expression`, callee `member_expression` property ∈ {`query`, `raw`, `execute`, `unsafe`}; argument is `template_string` containing ≥1 `template_substitution`, or `binary_expression` with `+` joining a string fragment matching `/\b(select|insert|update|delete|drop)\b/i`.
- **Java**: `method_invocation` name ∈ {`executeQuery`, `executeUpdate`, `execute`}; argument subtree contains `binary_expression` string concatenation or `String.format` invocation.
- Identifier allow-list escape hatch: interpolated value provably from an enum/whitelist literal matching `^[A-Za-z_][A-Za-z0-9_]*$` within the same function ⇒ downgrade to WARNING (per the rule's enforcement text).

### ARCH-001 — cognitive complexity (Sonar algorithm)
- **TS/JS**: delegate to `sonarjs/cognitive-complexity` with threshold from config (default 15) via in-memory `Linter.verify(fileText, flatConfig)` using `@typescript-eslint/parser` *without* `parserOptions.project` (no type info needed for this rule).
- **Python/Go/Java (generic visitor)**: +1 for each `if_statement`/`elif_clause`/`else_clause`, `for_statement`, `while_statement`, `catch/except_clause`, `switch/match` case group, `conditional_expression`, recursion (call to own enclosing function name), each **change** in boolean operator sequence (`&&`↔`||` in `binary_operator`/`boolean_operator` chains); +nesting-level for each increment inside nested structures (nesting level = count of ancestor control-structure nodes within the function). Threshold > 15 ⇒ WARNING at function definition line.
- **Test-file exemption (TEST-010)**: files matching `/\.(test|spec)\.[jt]sx?$|_test\.(go|py)$|test_.*\.py$|Test\.java$/` skip ARCH-001/002 and get TEST-001/002 instead.

### ARCH-002 — nesting depth / method length
- Function-like nodes per language (`function_declaration`, `method_definition`, `arrow_function`, `function_definition`, `method_declaration`). Logical line count = span of the body minus blank/comment-only lines ⇒ >50 fails. Nesting: during traversal, track control-structure ancestor count; any node reaching depth >5 within one function fails once per function.

### SEC-001 — malloc without NULL check (C)
- `call_expression` with `identifier` ∈ {`malloc`, `calloc`, `realloc`} whose parent chain reaches `init_declarator` or `assignment_expression` binding identifier `P`.
- Walk following named siblings in the enclosing `compound_statement`: pass if the *first* statement referencing `P` is an `if_statement` whose condition contains `P` compared to `null`/`NULL`/`!P`; fail (CRITICAL) if the first reference is a dereference — `pointer_expression` (`*P`), `field_expression` with `->`, or `subscript_expression` on `P`.

### SEC-026 — XSS sinks (TSX)
- `jsx_attribute` with `property_identifier` = `dangerouslySetInnerHTML`; value object's `__html` `pair`: pass only if `call_expression` whose callee text ∈ {`DOMPurify.sanitize`, `sanitizeHtml`} or plain `string` literal; anything else ⇒ CRITICAL.
- `assignment_expression` whose left `member_expression` property ∈ {`innerHTML`, `outerHTML`} and right side is not a `string` literal; `call_expression` callee `document.write`.

### SEC-016 — RSA modulus constant
- **Java**: `method_invocation` name `initialize`, receiver type-hint irrelevant — argument `decimal_integer_literal` < 2048 on a receiver whose declaration text contains `KeyPairGenerator` (single-function lookup).
- **TS/JS**: `call_expression` callee `generateKeyPair(Sync)?` → options `object` → `pair` key `modulusLength` value `number` < 2048. **Python**: `call` attr `generate` with first int arg < 2048.

### TEST-001 / TEST-002 — assertion checks
- Test unit detection: `call_expression` callee ∈ {`it`, `test`, `describe.each`…} with function argument (JS/TS); `function_definition` name `test_*` (py); `method_declaration` with `@Test` `annotation` (Java).
- Assertion APIs: callee matches `/^(assert\w*|expect|.*\.should)/`, `pytest.raises`, `assertThrows`, `expect(...).rejects`. Zero matches and no expected-exception construct ⇒ TEST-001 CRITICAL. ≥2 assertion calls where the assertion-message argument slot is absent ⇒ TEST-002 WARNING.

### SEC-009 — command injection
- **Python**: `call` where function resolves to `subprocess.(run|call|Popen|check_output)` with `keyword_argument` `shell=True` AND first argument not a plain `string` literal; `os.system`/`os.popen` with non-literal argument.
- **TS/JS**: `call_expression` callee `exec|execSync` (from `child_process` import in same file) with `template_string` containing substitutions or non-literal expression.
- **Java**: `method_invocation` `Runtime.getRuntime().exec` / `object_creation_expression` `ProcessBuilder` with non-literal argument.

### SEC-022 — cookie flags
- `call_expression` callee matching `cookies().set`, `res.cookie`, `response.cookies.set`: locate the options `object` argument; required `pair` keys `httpOnly: true`, `secure: true`, `sameSite: <any>` — each absent key is one finding line (CRITICAL if the cookie name argument matches `/session|auth|token/i`).

### ARCH-003 — nested containers (Python)
- Node types {`list`, `dictionary`, `set`, `list_comprehension`, `dictionary_comprehension`, `set_comprehension`}: count same-set ancestors; depth ≥3 ⇒ WARNING at the innermost literal.

---

## 3. Package & Module Layout

```
packages/prescan/                  # pure TS, workspace package "@unslop/prescan"
  src/
    index.ts                       # runPrescan(input, config): PrescanResult
    types.ts                       # PrescanFinding, PrescanStats, RuleDescriptor, EngineId
    rules/
      registry.ts                  # RULE_REGISTRY: Map<ruleId, RuleDescriptor>
      regex/*.ts                   # SEC-005, SEC-014/15/17/24/27/29, SEC-048/49/50, MAINT-006, ...
      ast/*.ts                     # one module per rule family (§2)
      config/*.ts                  # INFRA-001..011, SEC-032/033/042/043, SEC-019
      registry-net/*.ts            # SEC-035, SEC-036
    engines/
      regex-engine.ts              # line rules on added lines, deobfuscation pre-pass (PROC-013)
      tree-sitter-engine.ts        # lazy WASM grammar loading, one-pass dispatch walker
      eslint-engine.ts             # Linter API + sonarjs + eslint-plugin-security + react/no-danger (TS/JS only)
      config-engine.ts             # yaml / JSON / HCL parsing + predicates
      registry-engine.ts           # fetch + RegistryCache port (injected)
    diff/added-lines.ts            # patch hunks -> Set<line> per file
    language.ts                    # extension -> language/grammar mapping, test-file detection
  grammars/*.wasm                  # tree-sitter-{c,cpp,python,java,go,rust,typescript,tsx,javascript}

src/lib/pipeline/steps/pre-scanner-step.ts   # thin step: acquire contents, call core, map findings
src/lib/prescan/file-content-loader.ts        # GitHub Contents API at headSha (PR jobs)
src/lib/prescan/registry-cache.ts             # Supabase-backed cache implementation (port from core)

packages/cli  (later phase)
  src/local-prescan.ts             # same core + StaticAnalysisAdapter (EXT tools)
```

The core takes **injected ports** (file contents, registry cache, clock) — no Supabase/Next imports inside `packages/prescan`, so the CLI and extension can embed it unchanged [ARCH-002 boundary].

### `StaticAnalysisAdapter` (external-tool tier, CLI environment)

```ts
interface StaticAnalysisAdapter {
    readonly toolId: 'semgrep' | 'bandit' | 'gosec' | 'gitleaks' | 'checkov' | 'kube-linter' | 'clang-tidy' | 'psscriptanalyzer' | 'spotbugs' | 'slither';
    /** Probe once per run: `<tool> --version`, 2 s timeout. */
    isAvailable(): Promise<boolean>;
    /** Runs with JSON output flags, hard wall-clock timeout, cwd = repo root. */
    run(targetPaths: readonly string[], ruleScope: readonly string[]): Promise<readonly PrescanFinding[]>;
}
```

Rules of the tier: adapters are **additive only** (a missing tool never fails the scan — availability is recorded in `prescanStats.toolsUnavailable`, honest per INFRA-002: "not checked" ≠ "clean"); output is normalized to `PrescanFinding` with the *golden rule ID* (e.g. checkov `CKV_K8S_16` → `INFRA-001`) via per-adapter mapping tables; duplicate findings against the JS core are dropped on the key `(ruleId, path, line)`. In the cloud, `runPrescan` receives an empty adapter list — same code path, no branching on environment strings.

---

## 4. Data Format — mapping to `PipelineIssue`

```ts
/** Core-internal finding (packages/prescan). */
interface PrescanFinding {
    readonly ruleId: string;          // 'SEC-029'
    readonly ruleTitle: string;       // 'Banned libc API (strcpy)'
    readonly severity: 'CRITICAL' | 'WARNING';   // = shared Severity
    readonly path: string;
    readonly line: number;            // 1-based, new-file coordinates
    readonly endLine: number;
    readonly exactQuote: string;      // the matched source text (trimmed, ≤200 chars)
    readonly explanation: string;     // static template per rule, no LLM
    readonly fixTemplate?: string;    // e.g. 'Use fgets(buf, sizeof buf, stdin) instead of gets()'
    readonly engine: EngineId;        // 'tree-sitter' | 'regex' | 'eslint' | 'config' | 'registry' | toolId
    readonly fileLevel: boolean;      // e.g. SEC-019 header checks — anchored to first added line
}
```

Mapping to `PipelineIssue` (in `pre-scanner-step.ts`):

| PipelineIssue field | Value |
|---|---|
| `rule` | `` `${ruleId} (${ruleTitle})` `` — same convention as Law rule references |
| `severity` | pass-through (CSV grades map 1:1 onto shared `Severity`) |
| `path` / `line` / `endLine` / `exactQuote` | pass-through (already new-file coordinates, satisfying the GitHub inline-comment contract) |
| `critique` | `explanation` + optional evidence (e.g. registry 404 URL for SEC-035) |
| `fixedCodeSnippet` | `fixTemplate` when the rule has a mechanical rewrite |
| `source` | `'pre-scanner'` |
| `confidence` | `100` — deterministic by definition; the integrity scorer treats these as verdict-exempt |

---

## 5. Pipeline Integration & Cascade Bypass

### 5.1 New context fields

```ts
interface PipelineContext {
    // ... existing ...
    /** Deterministic findings — NEVER enters buildBlindClaims (PROC-001 lane). */
    readonly prescanIssues: readonly PipelineIssue[];
    /** Telemetry + honesty record of the prescan run (§6.4), incl. degraded flag (§5.4). */
    readonly prescanStats: PrescanStats | null;
    /** true = LLM steps skipped (short-circuit); reason lives in prescanStats. */
    readonly llmSkipped: boolean;
}
```

**Why a separate lane**: `claim-verifier-step.ts:52` builds blind claims from `context.issues`. Adding prescan findings there would send deterministic facts through an LLM judge — precisely what PROC-001 forbids (44:1 under-count risk) and a waste of verifier tokens. The separation is structural, mirroring how `practicesPromptSection` is kept away from the verifier.

**Merge point**: a helper `collectReportableIssues(context) = [...context.prescanIssues, ...context.issues]` used by exactly three consumers — `github-reporter-step`, `result-persister-step`, and the worker's `closeCheckRun`/`deriveReviewConclusion`. The integrity scorer keeps operating on `context.issues` only: the integrity score measures **LLM claim survival** and would be distorted by confidence-100 mechanical findings.

**De-duplication against the LLM**: the draft-reviewer user prompt gains a short `<already_flagged>` section listing prescan `(ruleId, path, line)` tuples (data, not instructions — SEC-002 segregation preserved) so the Flash draft doesn't duplicate them; any LLM issue that still collides on `(path, line-range, ruleId)` is dropped at merge time in favor of the deterministic finding.

### 5.2 Step order & flow

```
worker.assembleSteps / CLI_PIPELINE_STEPS
        │
        ▼
diff-loader ──► pre-scanner ──► rag-loader ──► complexity-router ──► draft-reviewer
                   │                (skip if llmSkipped)   ...cascade...
                   │ 1. acquire file contents (headSha, caps)          │
                   │ 2. added-line map from patches                    ▼
                   │ 3. engines: regex → tree-sitter/eslint      claim-verifier ─► escalation
                   │            → config → registry                    │
                   │ 4. filter to added lines (PROC-007)               ▼
                   │ 5. prescanIssues + prescanStats             integrity-scorer
                   │ 6. short-circuit decision                        │
                   ▼                                                  ▼
              (llmSkipped?) ────────────────────────────────► github-reporter
                                                                      │  (collectReportableIssues)
                                                                      ▼
                                                              result-persister
```

- Registered in `STEP_REGISTRY` as `pre-scanner`; **enabled by default**: inserted into `DEFAULT_PIPELINE_CONFIG.enabledStepIds` after `diff-loader` and into `CLI_PIPELINE_STEPS` after `cli-diff-loader`. Repos with a persisted `pipeline_config` predating the feature don't run it until their config is updated (worker's unknown-ID filtering already tolerates both directions); the dashboard offers the toggle either way.
- The step obeys `shouldAbort` like every other step and **never sets `shouldAbort` itself** — an empty-finding prescan is not an abort, and a finding-rich prescan must still reach the reporter.

### 5.4 Soft-Launch Fail-Safe Gate

Because the pre-scanner ships **on by default**, its failure mode must be strictly better than not having it. The step's entire body runs inside a fail-safe boundary:

```ts
async execute(context: PipelineContext): Promise<PipelineContext> {
    if (context.shouldAbort) return context;
    try {
        return await runPrescanStep(context);   // §7 — content fetch, engines, filtering
    } catch (prescanError: unknown) {
        // [MAINT-001]: loud, contextual, and recorded — never swallowed silently.
        console.error(
            `[PreScanner] Job ${context.jobId}: Pre-Scan fehlgeschlagen — Review läuft `
            + `ohne deterministische Findings weiter: ${extractErrorMessage(prescanError)}`,
        );
        return {
            ...context,
            prescanIssues: [],
            llmSkipped: false,
            prescanStats: {
                degraded: true,
                degradedReason: extractErrorMessage(prescanError),
                findingsCount: 0,
                skippedChecks: [{ ruleId: '*', reason: 'step-failure' }],
            },
        };
    }
}
```

Contract:
- **Any** execution error — WASM/grammar load failure, GitHub blob-fetch timeout or auth error, parser crash, registry-cache DB error, a bug in a rule visitor — is caught here. The context passes through unchanged (plus a degraded stats record), `rag-loader` and the LLM cascade run exactly as they would today, and the job **never** reaches `status: 'error'` because of the prescan. `review_jobs.status = 'error'` remains reserved for failures of the review itself.
- The catch is [MAINT-001]-conform, not a violation of it: the error is logged with job context, *and* persisted in `prescanStats.degraded`/`degradedReason` via the result persister — a diagnosable trace, not a swallowed exception.
- **Honesty rule (INFRA-002 discipline)**: a degraded prescan is recorded as `degraded: true` with a blanket `skippedChecks` entry — it must never be distinguishable-from/reported-as "0 findings, clean". The GitHub summary and dashboard render degraded runs as "deterministic pre-scan unavailable for this run", not as a pass.
- A degradation **never** triggers the short-circuit path (`llmSkipped` is forced `false`) — skipping the LLM review is only ever justified by *findings*, not by scanner failure.
- Exit criterion for the soft launch: once `prescanStats.degraded` telemetry shows a stable near-zero rate across real jobs, a later phase may add an opt-in strict mode (e.g. for repos using the check as a required gate); until then the fail-safe is unconditional.

### 5.3 Short-circuit semantics (config-gated, default off)

When `prescan.shortCircuit.mode === 'critical'` and `criticalFindings ≥ minCriticalFindings`:
- `pre-scanner-step` returns `llmSkipped: true`; `reviewSummary` is set to a deterministic template ("LLM review skipped: N critical structural violations found by the deterministic pre-scanner. Fix these first.").
- `rag-loader`, `complexity-router`, `draft-reviewer`, `claim-verifier`, `escalation-reviewer` each add a one-line guard `if (context.llmSkipped) return context;` (same pattern as their existing `shouldAbort` guards). This also skips the embedding call — true zero-token path.
- `integrity-scorer` leaves `integrityScore: null` (no claims were verified — an honest null, consistent with the existing degradation semantics, not a fake 100).
- Reporter and persister run normally on the merged issues; `deriveReviewConclusion` produces `failure` from the CRITICALs as usual.

Token economics: a short-circuited job costs 0 LLM tokens (vs. ~draft+verify Flash spend today); a non-short-circuited job still saves tokens indirectly (draft doesn't re-derive mechanical findings; Law-block slimming, §7.3).

---

## 6. Database & Configuration Schema

### 6.1 `pipeline_config` extension (JSONB — no migration required)

```jsonc
{
  "enabledStepIds": ["diff-loader", "pre-scanner", "rag-loader", ...],
  "activeConditionIds": [...],
  "overrideSmartDetection": false,
  "cascade": { ... },
  "prescan": {
    // Per-rule toggles. Default: every registered rule is ON.
    // Only overrides are stored — { "MAINT-003": false } disables magic-number checks.
    "ruleOverrides": { "<ruleId>": boolean },
    "shortCircuit": {
      "mode": "off" | "critical",          // default "off"
      "minCriticalFindings": 1              // default 1, integer ≥ 1
    },
    "registryChecks": true,                 // SEC-035/036 network lookups on/off
    "maxFileBytes": 262144,                 // per-file content cap (default 256 KB)
    "totalBudgetMs": 15000                  // global wall-clock budget (default 15 s)
  }
}
```

Validation at the boundary [ARCH-002]: a `zod` schema `prescanConfigSchema` with `.catch()` per field — parsed in a new `resolvePrescanConfig(partial)` mirroring `resolveCascadeConfig` (a broken repo config falls back field-wise to defaults, never kills a job). `parsePipelineConfig` in `worker.ts` passes the raw `prescan` block through structurally, identical to how `cascade` is handled today.

Dashboard UX: the step toggle (`pre-scanner` in `enabledStepIds`) is the coarse switch; the per-rule matrix (grouped by CSV category, severity-badged) writes `ruleOverrides`. Rule metadata for rendering comes from `golden_standards` (§6.2), not from a hardcoded frontend list.

### 6.2 Migration 1 — deterministic metadata on `golden_standards`

```sql
-- apply_migration: add_prescan_metadata_to_golden_standards
ALTER TABLE golden_standards
    ADD COLUMN deterministic_coverage text NOT NULL DEFAULT 'none'
        CHECK (deterministic_coverage IN ('full', 'partial', 'none')),
    ADD COLUMN prescan_engine text
        CHECK (prescan_engine IN ('ast', 'regex', 'config', 'registry', 'external', 'policy'));
```

Backfill from the §1 table (one UPDATE per rule, applied via MCP `apply_migration`). Purpose: (a) the dashboard rule matrix and the CLI `--list-rules` read one source of truth; (b) the Law-block slimming decision (§7.3) is data-driven; (c) coverage drift between scanner releases is visible in the DB.

### 6.3 Migration 2 — registry lookup cache (SEC-035/036)

```sql
-- apply_migration: create_prescan_registry_cache
CREATE TABLE prescan_registry_cache (
    registry      text NOT NULL CHECK (registry IN ('npm', 'pypi', 'crates', 'hf-hub')),
    package_name  text NOT NULL,
    package_exists boolean NOT NULL,
    checked_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (registry, package_name)
);
```

TTL semantics in code, asymmetric on purpose: `exists = true` cached 7 days; `exists = false` cached only **1 hour** — a 404 must be re-checked because the slopsquatting attack window is exactly the gap where a hallucinated name *becomes* registered; and a package legitimately published five minutes ago must not stay flagged for a week. Lookup misses fetch `https://registry.npmjs.org/<name>` / `https://pypi.org/pypi/<name>/json` / `https://crates.io/api/v1/crates/<name>` / HF Hub `api/models/<id>` with 3 s timeout; **network failure ≠ 404** — timeouts are recorded as `blocked: tooling` in `prescanStats.skippedChecks`, never as a finding and never as a pass (INFRA-002 discipline). The table is global (package existence is not tenant data), written via the service-role client; no RLS-exposed reads.

### 6.4 Persisted results — no new columns

`result-persister-step` already writes `{ has_slop, issues }`; it now persists the merged issue list plus a `prescan` block inside the existing result JSONB:

```jsonc
"prescan": {
  "degraded": false, "degradedReason": null,
  "findingsCount": 7, "criticalCount": 3,
  "rulesEvaluated": 58, "rulesDisabled": ["MAINT-003"],
  "filesScanned": 12, "filesSkipped": [{ "path": "big.min.js", "reason": "size-cap" }],
  "skippedChecks": [{ "ruleId": "SEC-035", "reason": "registry-timeout" }],
  "llmSkipped": false, "durationMs": 1840,
  "engineVersions": { "prescanCore": "0.1.0", "treeSitter": "0.26.x", "grammars": { "python": "0.25.0" } }
}
```

`engineVersions` makes runs reproducible/comparable release-over-release (PROC-002's monotonic-finding-count comparison needs a stable baseline).

---

## 7. Execution Strategy

### 7.1 Content acquisition
- **PR jobs (cloud)**: for each of the ≤ N reviewable files (existing diff caps apply), fetch blob content at `context.headSha` via the GitHub Contents API using the already-resolved `githubToken` — parallel, pool of 4, per-file cap `maxFileBytes`, oversized/binary files recorded in `filesSkipped`. This reuses the exact auth path of `diff-loader` (works for both `app` and `oauth` modes).
- **CLI jobs (cloud-executed)**: no GitHub token exists — the payload contains only the diff. **Degraded mode**: regex/line rules run directly on added-line text from the patch; AST/config rules are skipped and recorded honestly in `skippedChecks` (`reason: 'patch-only-input'`). **Phase 2**: extend the CLI scan payload with optional gzipped full contents of changed files (bounded by the existing 300 KB payload discipline) to unlock full AST mode; the core is input-agnostic either way.

### 7.2 Whole-file scan, added-line reporting
The engines analyze the **entire file** (ASTs need it; PROC-004/CONC-008 demand it), then findings are filtered: a finding survives if `[line, endLine]` intersects the added-line set derived from the patch hunks, or if the rule is `fileLevel` (anchored to the file's first added line). This keeps reviews scoped to the PR while the *analysis* still sees full context (e.g., a `free(p)` above the hunk for SEC-028).

### 7.3 Prompt/token interaction (Phase 2 option)
Rules with `deterministic_coverage = 'full'` can be dropped from the static Law block in the system prompt when `pre-scanner` is enabled — a second, permanent token saving on *every* LLM call. **Caveat**: the Law block participates in the prompt-cache contract (Phase 5 made it ecosystem-filtered but ingest-stable); making it depend on `pipeline_config` adds a cache-key dimension. Decision deferred to its own change with cache-hit telemetry before/after — not part of pre-scanner v1.

### 7.4 Engine execution order & budget
Per file: language detection → cheap engines first (regex, config) → tree-sitter parse (grammar lazily loaded once per process, parser instances cached at module scope across warm invocations) → single-pass rule dispatch → ESLint pass (TS/JS only). Deobfuscation pre-pass (PROC-013): PowerShell `-EncodedCommand`/`-enc` base64 payloads are decoded and scanned as virtual content attributed to the original line. Global `totalBudgetMs` enforced between files; per-file wall clock 2 s. Budget exhaustion skips remaining files **loudly** (`filesSkipped`, reason `budget-exhausted`) — a skipped file is never reported clean.

### 7.5 Error handling [MAINT-001] — two nested layers
- **Inner layer (per file × engine)**: a grammar load failure, WASM trap, or rule exception logs with rule/file context, lands in `skippedChecks`, and the scan continues with the remaining files/engines.
- **Outer layer (whole step)**: anything that escapes the inner layer — including content-fetch failures — is absorbed by the Soft-Launch Fail-Safe Gate (§5.4): logged, recorded as `degraded: true`, and the pipeline proceeds to RAG/LLM untouched. The pre-scanner can *never* be the reason a review job writes `status: 'error'`.

### 7.6 Vercel deployment notes
`web-tree-sitter` + grammar `.wasm` files ship inside the deployment (`next.config` `outputFileTracingIncludes` for `packages/prescan/grammars/*.wasm`; `Parser.init({ locateFile })` pointed at the traced path). Cold-start cost ≈ 50–100 ms per loaded grammar — amortized by lazy loading only the languages present in the diff and by module-scope caching. WASM execution is slower than native bindings, which is acceptable at diff scale (≤ ~30 files × ≤ 256 KB) inside the `after()` background context; the CLI local mode may later swap in native `tree-sitter` bindings behind the same engine interface.

---

## 8. Rollout Phases

1. **v1 (this spec)**: `packages/prescan` core with the RGX + CFG-P rule set and the highest-value AST rules (MAINT-001/002, ARCH-001/002/003/004, SEC-004/006/009/016/017/022/026/027/029, TEST-001/002, INFRA-001…011), registry checks (SEC-035/036) with cache table, `pre-scanner-step` **enabled by default behind the Soft-Launch Fail-Safe Gate (§5.4)**, `prescanIssues` lane, config schema, migrations §6.2/§6.3. Unit tests per rule against fixture snippets (positive + negative) plus fail-safe tests (forced WASM-load failure, blob-fetch timeout ⇒ degraded stats, LLM steps still run), per THE LAW also for test code.
2. **v1.1**: short-circuit mode, dashboard rule matrix, `<already_flagged>` draft-prompt section, remaining partial-coverage AST rules.
3. **v2**: CLI local prescan (`StaticAnalysisAdapter` tier: semgrep/gitleaks/checkov/kube-linter/PSScriptAnalyzer), CLI payload extension for full-file cloud AST mode, Law-block slimming behind cache telemetry.

**Definition of Done per phase (DOC-001)**: ROADMAP §1 item moves to Done only with receipts — passing rule-fixture tests, a live job whose persisted result contains a non-empty `prescan` block, and the migrations verified via MCP against the live schema.

---

## 9. v4 (2026-09-24) — Config-Engine gaps closed: SEC-019, SEC-032/033/034, SEC-042/043, pyproject.toml

Closes ROADMAP To-Do §1 "Config-Engine-Lücken vs. Design §1". Every check below is **fail-safe by construction**: whenever the single-file view cannot prove the violation, the check stays silent (or records a `skippedCheck`), it never guesses. Code: `packages/prescan/src/engines/config/` (dispatcher `index.ts`) and `engines/registry/pyproject-deps.ts`. Core version `0.4.0`, 50 implemented rule IDs.

### 9.1 SEC-019 — missing security headers (`security-headers.ts`)

**Scope: Next.js `middleware.*` / `proxy.*` only.** The first v4 cut (2026-09-24) also had Express- and Flask-bootstrap forms; the review of 2026-09-24 built seven realistic files on which the committed check fired although nothing in the file proved a violation (`@/`-alias security helper, `headers()` in `next.config.js` fed from another module, `@nosecone/next` / `next-safe-middleware`, `lusca`, inline `require('./middleware/security')`, `@/`-alias Express middleware, gunicorn-served Flask with Talisman in `extensions.py`) — a breach of the fail-safe rule above. Express and Flask were dropped on 2026-09-26 (not narrowed: headers there live in other modules or the hosting layer — `vercel.json`, `_headers`, `netlify.toml`, a reverse proxy — which a single file cannot disprove); they return only after being tested against real repositories (ROADMAP To-Do §1). All seven cases are unit tests in `security-headers.test.ts` and stay silent.

The Next form fires only when the file itself proves the violation:

| Fires when (all of) | Suppressed when (any of — fail-safe) |
|---|---|
| file imports `next/server`; ≥ 1 `.headers.set/append('literal', …)` on a **response** receiver; no security header anywhere in the file; every mutated response is declared exactly once as `NextResponse.next/rewrite/redirect/json(…)` or `new NextResponse(…)` and otherwise appears only in its own header mutations and a bare `return <name>` | the response **escapes** — any other use, e.g. as a call argument (`return withSecurityHeaders(response)`), reassignment or property access; it does not come from `NextResponse.*` (e.g. a package middleware's result); the receiver is a request or not a plain identifier; a header name is computed; a `headers:` object or `new Headers(` is used; the export is wrapped (`export default chain(…)`, `export const middleware = withX(…)`); a local import (relative, `@/`, `~/`, `#/`) mentions `secur|header|csp|helmet|nonce|harden`; a visible `next.config.*` has a `headers()` function / `headers` key or names a security header |

**Companion files** (new in `PrescanInput.companionFiles` / `InternalPrescanRequest.companionFiles`): a Next middleware alone proves nothing about the app, the headers may live in `next.config.*`. The worker (`src/lib/prescan/companion-loader.ts`) lists the middleware's directory (and the parent for `src/`) at `headSha` and passes every `next.config.*` it finds. Contract: listed = exists, `content: null` = unreadable **or unknown** ⇒ `skippedChecks: SEC-019 companion-unavailable`, not listed = does not exist. "Unknown" covers a truncated directory listing (the Contents API returns at most 1000 entries, unpaginated) and a `next.config.*` that is not a regular file (symlink, submodule). Every companion request carries a 10 s `AbortSignal.timeout` (below the 15 s `totalBudgetMs`); a timeout is an error ⇒ unreadable. A `next.config.*` inside the diff itself counts too. CLI jobs run patch-only, so SEC-019 never fires there (no full content). The benchmark rig passes no companions, which is truthful for synthetic fixtures.

Security-header set: CSP, X-Frame-Options, frame-ancestors, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options. Presence of **any** of them suppresses the check (partial coverage: the LLM keeps "incomplete set").

Realism probe: this repo's own `src/proxy.ts` sets a *request* header and delegates to `updateSession` — correctly silent.

### 9.2 SEC-032 / SEC-033 / SEC-034 — IAM & serverless (`iam-model.ts`, `iam-from-hcl.ts`, `iam-from-cfn.ts`, `iam-serverless.ts`)

- **Formats**: Terraform HCL via a purpose-built reader (`hcl-reader.ts`, ~350 lines: blocks, attributes, strings with `${}`/nested quotes, heredocs, lists, objects, calls, references; operators/conditionals degrade to `raw`). **No external HCL parser** — `hcl2-parser`/`@cdktf/hcl2json` are multi-MB Go-WASM bundles, unacceptable in the memory-critical prescan Lambda (§1 route-instance leak). CloudFormation/SAM in YAML **and** JSON through the existing `yaml` parser (`!GetAtt`/`!Ref`/`!Sub` survive as tagged scalars).
- **Serverless gate**: the file must mention `lambda` or `serverless` (Terraform: `aws_lambda_function`, `lambda.amazonaws.com`, a `lambda-assume.json` path; CFN: the resource types). Wildcard policies on human/admin roles are not SEC-032 and stay with the LLM.
- **Identity policies only**: `aws_iam_role_policy`, `aws_iam_role.inline_policy`/`managed_policy_arns`, `aws_iam_role_policy_attachment`, `aws_iam_policy`; `data.aws_iam_policy_document` only when a role references it. Statements with `Condition` or `Principal` are never flagged (PassRole-with-condition, KMS key policies with `kms:*` on `*` are standard).
- **SEC-032** (CRITICAL): `Effect: Allow` + `Resource: "*"` + an action that is `*`, `service:*`, or in the high-risk set (`sts:AssumeRole`, `iam:PassRole`, `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:PutRolePolicy`, `lambda:CreateFunction`, `lambda:UpdateFunctionCode`, `s3:PutBucketPolicy`, `kms:PutKeyPolicy`). Anchored at the statement.
- **SEC-033** (WARNING): ≥ 2 functions referencing the same role **and** that role (in the same file) carries `AdministratorAccess`/`PowerUserAccess`/`IAMFullAccess` or a high-risk/wildcard action. One finding per function at its `role` attribute. Roles whose policies live in another file are unknown ⇒ silent (partial).
- **SEC-034** (WARNING, CRITICAL when the same function runs under a SEC-032 role): a layer ARN or ECR image URI whose 12-digit account differs from **own-account evidence in the same file** (account IDs in non-layer ARNs, `account_id`/`SourceAccount` attributes). Without contrast evidence "foreign" is undecidable and the check stays silent — the bare r12 fixture therefore remains an LLM catch by design. Digest-pinned images (`@sha256:`) are exempt.

### 9.3 SEC-042 / SEC-043 — agent configs (`agent-config.ts`)

Only **Claude Code settings** (`.claude/settings.json`, `.claude/settings.local.json`) — the one harness format with documented permission semantics. Generic `deny`/`allow` keys in arbitrary YAML/JSON stay out (no semantics ⇒ FP-prone).
- **SEC-042** (CRITICAL): `permissions.defaultMode: bypassPermissions` **plus** a non-empty `permissions.deny`. A deny list in the default (ask) mode is *not* a denylist gate — the human approval is the gate — and is deliberately not flagged.
- **SEC-043** (WARNING): `bypassPermissions` without a deny list (binary full access), or an unscoped shell grant in `permissions.allow` (`Bash`, `Bash(*)`, `Bash(*:*)`). Bare `Edit`/`Read` grants are not flagged (ubiquitous in real settings; the rule's letter would allow it, the fail-safe posture does not).
Both rules stay excluded from the benchmark fixtures (`excluded-rules.json`): the LLM lane cannot attribute them from a hunk, and adding fixtures would change the 126-rule universe the reference series is measured against.

### 9.4 pyproject.toml — registry engine (`registry/pyproject-deps.ts`)

Line-oriented TOML scanner with table/array state (no TOML dependency). Covered: PEP 621 `[project] dependencies`, `[project.optional-dependencies]`, PEP 735 `[dependency-groups]` (inline `{ include-group = … }` ignored), `[build-system] requires`, Poetry `dependencies`/`dev-dependencies`/`group.<x>.dependencies` (`python` skipped), uv `dev-dependencies`, PDM `dev-dependencies`. Candidates only for added lines; context lines (table headers, array openers) come from the full line map that `index.ts` passes solely for `pyproject.toml` (`RegistryEngineFile.lineTexts`) to keep the registry phase memory-flat. Lookups reuse the SEC-035 HEAD path and cache.

### 9.5 Deliberately left out — MAINT-009 (unused new dependency)

Rejected as a deterministic check, same reasoning as CONC-008 / SEC-012 / SEC-021 (ROADMAP §7): a diff-only view cannot distinguish "unused" from **peer dependencies** (`react-dom`, `postcss`, `graphql` for `@apollo/client`), **implicit runtime dependencies** (`sharp` for `next/image`, `tslib`, optional native peers) and **usage in files outside the diff**. Every gate tried (dependencies-only, `@types/*` skip, new-manifest-only, name appears anywhere in the diff) still fires on a freshly scaffolded Next app adding `react-dom`. WARNING-level noise on every second dependency bump would erode the zero-FP promise of the deterministic lane; MAINT-009 stays with the LLM reviewer (r06 catches it there). `golden_standards.deterministic_coverage` for MAINT-009 should move to `none` (draft migration `046`, blocked: tooling).

### 9.6 Receipts (2026-09-24, zero-token lanes only)

- `npx vitest run packages/prescan`: 125/125 (35 new tests across `hcl-reader`, `iam-serverless`, `security-headers`, `agent-config`, `registry-engine` pyproject, `index` companion routing).
- `npm test`: 1220 passed / 21 skipped / 98 files; the single failure is the documented `git.test.ts` timeout flake (ROADMAP §8), 18/18 in isolation.
- `npm run benchmark:rules -- --prescan-only`: **49/126 deterministic (38.9 %)**, up from 46/126 (v3 reference `results/2026-08-25-prescan-only-v3.json`), **0 false positives on all four negative controls**, no collateral finding on the target bundles: r08 `middleware.ts` SEC-019 ✓ (the last stable benchmark miss), r12 `exporter-role.tf` SEC-032 ✓, `order-functions.tf` SEC-033 ✓ (2 findings, one per function), `pdf-render.tf` SEC-034 silent by design (no contrast evidence).
- No LLM benchmark run and no Vertex call were made for this change; the combined recall claim (SEC-019 now deterministic ⇒ expected 126/126 combined) awaits the next paid full run.

**Revision 2026-09-26 (fixes for the review of 2026-09-24, zero-token lanes only):** SEC-019 narrowed to Next.js (§9.1), companion timeout + "unknown" listing cases (§9.1 companion contract), the intentional swallow in `iam-model.ts` stated.
- `npx vitest run packages/prescan`: 127/127; the seven review cases were red against the 2026-09-24 code and are silent now, r08 still fires.
- Dogfood on PR #9 (job `83f211d3`, prod core 0.3.0, 2026-09-26) flagged three issues in this code, fixed the same day: MAINT-002 on the `iam-model.ts` catch (a comment does not satisfy the rule — the parse error is now logged as `[Prescan]` warning), ARCH-001 on `runIamServerlessChecks` (split into one helper per rule), and a **CRITICAL SEC-035 false positive in the registry engine**: `import … from '${specifier}'` inside a template literal was looked up on npm as the package `${specifier}` (404). `normalizeNpmImport` now drops every root that is not a valid npm name; regression test in `registry-engine.test.ts`. Local re-scan of the four files: none of the three fires; prescan-only still 49/126, 0 FP.
- `npm test`: 1225 passed / 21 skipped / 98 files, 0 failures.
- `npm run benchmark:rules -- --prescan-only`: **49/126 unchanged, 0 false positives** on all four negative controls; r08 `middleware.ts` SEC-019 still `caughtByPrescan` (the fixture is a confined `NextResponse.next()` with literal non-security headers). Express/Flask had no benchmark fixture, so dropping them costs no measured recall.

---

## Appendix A — Research sources

- web-tree-sitter WASM bindings & serverless usage: [web-tree-sitter (npm)](https://www.npmjs.com/package/web-tree-sitter), [tree-sitter binding_web README](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md), [Using Parsers — Tree-sitter docs](https://tree-sitter.github.io/tree-sitter/using-parsers/), [sourcegraph/tree-sitter-wasms (prebuilt grammar WASMs)](https://github.com/sourcegraph/tree-sitter-wasms)
- Semgrep runtime requirements (Python ≥ 3.7 CLI — not embeddable in the Node cloud runtime): [Semgrep FAQ](https://semgrep.dev/docs/faq/overview), [semgrep/semgrep](https://github.com/semgrep/semgrep), [Getting started](https://semgrep.dev/docs/getting-started/)
- Sonar cognitive complexity for ESLint (reference ARCH-001 implementation; ≥ 2.0 ships all SonarJS rules): [eslint-plugin-sonarjs (npm)](https://www.npmjs.com/package/eslint-plugin-sonarjs), [cognitive-complexity rule doc](https://github.com/SonarSource/eslint-plugin-sonarjs/blob/master/docs/rules/cognitive-complexity.md), [SonarJS rules](https://github.com/SonarSource/SonarJS/blob/master/packages/jsts/src/rules/README.md)
- Secret scanning (JS-native vs. Go binaries; regex + entropy approach): [secretlint](https://github.com/secretlint/secretlint), [Gitleaks vs TruffleHog comparison](https://rafter.so/blog/secrets/secret-scanning-tools-comparison), [gitleaks CI usage](https://oneuptime.com/blog/post/2026-01-25-secret-scanning-gitleaks/view)
- ESLint security rules (pure JS, cloud-capable): [eslint-plugin-security rule index](https://github.com/eslint-community/eslint-plugin-security/blob/main/index.js), [detect-eval-with-expression doc](https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-eval-with-expression.md), [detect-child-process source](https://github.com/eslint-community/eslint-plugin-security/blob/main/rules/detect-child-process.js)
- Bandit rule IDs: [Bandit plugin index](https://bandit.readthedocs.io/en/latest/plugins/), [B608 hardcoded_sql_expressions](https://bandit.readthedocs.io/en/latest/plugins/b608_hardcoded_sql_expressions.html)
- gosec rule IDs & CWE mapping: [gosec RULES.md](https://github.com/securego/gosec/blob/master/RULES.md), [securego/gosec](https://github.com/securego/gosec)
- SonarJS/SonarQube security rule IDs (S2077, S4721, S2245, S5122, …): [SonarJS 6.1 release notes](https://github.com/SonarSource/SonarJS/releases/tag/6.1.0.11503), [eslint-plugin-sonar rule list](https://github.com/un-ts/eslint-plugin-sonar)
- Semgrep registry packs: [p/sql-injection](https://semgrep.dev/p/sql-injection), [p/command-injection](https://semgrep.dev/p/command-injection), [p/owasp-top-ten](https://semgrep.dev/p/owasp-top-ten), [p/security-audit](https://semgrep.dev/p/security-audit)
- CodeQL query IDs: [py/path-injection query help](https://codeql.github.com/codeql-query-help/python/py-path-injection/), [java/weak-cryptographic-algorithm query help](https://codeql.github.com/codeql-query-help/java/java-weak-cryptographic-algorithm/)
