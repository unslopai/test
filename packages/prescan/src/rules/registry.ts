/**
 * RULE_REGISTRY — alle im Core implementierten deterministischen Regeln (v1).
 *
 * Titel, Default-Severity und Erklärungs-Template pro Golden-Rule-ID.
 * Die DB-Spalten deterministic_coverage/prescan_engine (Migration 029/030)
 * sind die externe Sicht; dieses Registry ist die Ausführungs-Sicht.
 */
import type { EngineId, PrescanSeverity } from '../types';

export interface RuleDescriptor {
    readonly ruleId: string;
    readonly title: string;
    readonly severity: PrescanSeverity;
    readonly engine: EngineId;
    readonly explanation: string;
    readonly fixTemplate?: string;
}

const RULE_LIST: readonly RuleDescriptor[] = [
    // ── Regex-Engine ─────────────────────────────────────────────────────────
    {
        ruleId: 'SEC-005', title: 'Hardcoded secret', severity: 'CRITICAL', engine: 'regex',
        explanation: 'A credential-shaped literal is committed to source. Secrets belong in environment variables or a secret manager — a leaked key in git history stays leaked forever.',
        fixTemplate: 'Move the value into an environment variable / secret store and rotate the leaked credential.',
    },
    {
        ruleId: 'SEC-014', title: 'MD5/SHA-1 used in a security context', severity: 'CRITICAL', engine: 'regex',
        explanation: 'MD5/SHA-1 are cryptographically broken. Use SHA-256+ for integrity and a dedicated KDF (bcrypt/scrypt/argon2) for passwords.',
    },
    {
        ruleId: 'SEC-015', title: 'Insecure cipher/mode (ECB/DES/RC4)', severity: 'CRITICAL', engine: 'regex',
        explanation: 'ECB mode and legacy ciphers (DES/RC2/RC4/Blowfish) do not provide semantic security. Use an AEAD mode such as AES-GCM or ChaCha20-Poly1305.',
    },
    {
        ruleId: 'SEC-017', title: 'TLS certificate verification disabled', severity: 'CRITICAL', engine: 'regex',
        explanation: 'Disabling certificate verification turns TLS into plaintext against an active attacker. Fix the trust store instead of switching verification off.',
    },
    {
        ruleId: 'SEC-024', title: 'Permissive CORS policy', severity: 'CRITICAL', engine: 'regex',
        explanation: 'A wildcard or reflected Access-Control-Allow-Origin exposes authenticated responses to arbitrary origins. Allow-list the exact origins instead.',
    },
    {
        ruleId: 'SEC-027', title: 'Unbounded %s in scanf', severity: 'CRITICAL', engine: 'regex',
        explanation: 'A %s/%[ conversion without a field width writes unbounded input into the buffer — a classic stack overflow. Specify the maximum field width.',
        fixTemplate: 'Use a bounded conversion, e.g. scanf("%63s", buf) for char buf[64].',
    },
    {
        ruleId: 'SEC-029', title: 'Banned libc API', severity: 'CRITICAL', engine: 'regex',
        explanation: 'This libc function has no bounds checking (or is inherently racy) and is on every modern banned-API list. Use the bounded/secure replacement.',
        fixTemplate: 'gets→fgets, strcpy→strlcpy/snprintf, strcat→strlcat, sprintf→snprintf, tmpnam/mktemp→mkstemp.',
    },
    {
        ruleId: 'SEC-048', title: 'PowerShell download cradle', severity: 'CRITICAL', engine: 'regex',
        explanation: 'Downloading and immediately executing remote content (IEX + web request) is the canonical malware delivery pattern and must never appear in committed code.',
    },
    {
        ruleId: 'SEC-049', title: 'ExecutionPolicy/AMSI bypass', severity: 'CRITICAL', engine: 'regex',
        explanation: 'Bypassing ExecutionPolicy or AMSI disables the platform’s script-security controls — this belongs in no legitimate deployment script.',
    },
    {
        ruleId: 'SEC-050', title: 'Credential dumping / LOLBin invocation', severity: 'CRITICAL', engine: 'regex',
        explanation: 'This command line matches known credential-dumping / living-off-the-land tooling patterns and must not ship in source.',
    },
    {
        ruleId: 'HAL-002', title: 'Hallucinated standard-library API', severity: 'CRITICAL', engine: 'regex',
        explanation: 'This function does not exist in the standard library (a classic LLM hallucination) — the code cannot compile or will fail at runtime. Use the real API.',
        fixTemplate: 'Go: strings.ToLowerCase→strings.ToLower, strings.ToUpperCase→strings.ToUpper.',
    },
    {
        ruleId: 'MAINT-005', title: 'Overblanking (>2 consecutive blank lines)', severity: 'WARNING', engine: 'regex',
        explanation: 'More than two consecutive blank lines are typical generated-code padding and hurt readability.',
    },
    {
        ruleId: 'MAINT-006', title: 'AI-generated TODO without ticket', severity: 'WARNING', engine: 'regex',
        explanation: 'A TODO/FIXME referencing an AI assistant without a ticket reference is self-admitted technical debt with no owner. Create a ticket or resolve it now.',
    },
    // ── tree-sitter-Engine ───────────────────────────────────────────────────
    {
        ruleId: 'MAINT-001', title: 'Empty catch/except block', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'An empty exception handler silently swallows failures — the error disappears and the system continues in an undefined state. Log and handle, or let it propagate.',
    },
    {
        ruleId: 'MAINT-002', title: 'Exception swallowed without re-raise or log', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'A broad exception handler that neither re-raises nor logs hides real failures. Narrow the exception type and record the error.',
    },
    {
        ruleId: 'ARCH-001', title: 'Cognitive complexity > 15', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'This function exceeds the cognitive-complexity threshold of 15 (Sonar algorithm). Extract nested logic into named helper functions.',
    },
    {
        ruleId: 'ARCH-002', title: 'Nesting > 5 or method > 50 lines', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'Deeply nested or very long functions are the strongest structural predictor of defects. Split the function along its logical phases.',
    },
    {
        ruleId: 'ARCH-003', title: 'Containers nested ≥ 3 (Python)', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'Literals/comprehensions nested three or more levels deep are unreadable and untypeable. Introduce named intermediate structures (dataclasses/TypedDicts).',
    },
    {
        ruleId: 'ARCH-004', title: 'Long parameter list (> 5)', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'More than five parameters make call sites error-prone. Group related parameters into a parameter object / dataclass.',
    },
    {
        ruleId: 'SEC-004', title: 'SQL built by string interpolation', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'The SQL statement is assembled from interpolated/concatenated values — SQL injection. Use parameterized queries exclusively.',
    },
    {
        ruleId: 'SEC-006', title: 'Unsafe deserialization', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'Deserializing untrusted data with pickle/yaml.load/ObjectInputStream-class APIs is remote code execution by design. Use a safe loader or a schema-validated format.',
    },
    {
        ruleId: 'SEC-009', title: 'Command injection risk', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'A shell command is built from non-literal input. Use the argument-array form without shell=True / exec, or validate against a strict allow-list.',
    },
    {
        ruleId: 'SEC-016', title: 'RSA modulus < 2048 bit', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'RSA keys below 2048 bit are considered factorable by well-resourced attackers. Use ≥ 2048 (better 3072/4096) or an elliptic-curve scheme.',
    },
    {
        ruleId: 'SEC-022', title: 'Insecure session cookie flags', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'The cookie is set without httpOnly/secure/sameSite. Session cookies without these flags are stealable via XSS and cross-site requests.',
    },
    {
        ruleId: 'SEC-026', title: 'XSS sink (dangerouslySetInnerHTML/innerHTML)', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'Unsanitized HTML is written into the DOM — direct cross-site-scripting. Sanitize with DOMPurify (or render as text).',
    },
    {
        ruleId: 'TEST-001', title: 'Assertion-free test', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'This test contains no assertion and can never fail — it is coverage theater. Assert the observable behavior or delete the test.',
    },
    {
        ruleId: 'TEST-002', title: 'Assertion roulette (unlabeled multi-asserts)', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'Multiple assertions without messages make a failing test undiagnosable. Add assertion messages or split the test.',
    },
    {
        ruleId: 'TEST-005', title: 'Tautological assertion', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'This assertion compares a value with itself (or one literal with another) and can never exercise the code under test — it is coverage theater. Assert the actual output of the unit under test.',
    },
    {
        ruleId: 'ARCH-005', title: 'Write to a nil map (compiles clean, panics at runtime)', severity: 'CRITICAL', engine: 'tree-sitter',
        explanation: 'This map field is written without ever being initialized with make() — the code compiles, but the first write panics at runtime ("assignment to entry in nil map"). Initialize the map in the constructor or composite literal.',
        fixTemplate: 'return &Ledger{counts: make(map[string]int)} — or field = make(map[K]V) before the first write.',
    },
    {
        ruleId: 'CONC-003', title: 'volatile used as thread-synchronization signal', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'volatile provides neither atomicity nor memory ordering between threads — a flag like this can be torn, reordered, or never observed by the other thread. Use C11 atomics or a mutex (sig_atomic_t is only correct for signal handlers).',
    },
    {
        ruleId: 'COND-011', title: 'Condition 11: JSX nesting deeper than 4 levels', severity: 'WARNING', engine: 'tree-sitter',
        explanation: 'The JSX return contains conditional nesting (elements, ternaries, logical ANDs) deeper than 4 levels, or the component declares more than 2 useEffect hooks — a god component. Extract the deeply nested branches into named child components.',
    },
    // ── ESLint-Engine (TS/JS) ────────────────────────────────────────────────
    {
        ruleId: 'SEC-008', title: 'Weak randomness for security value', severity: 'WARNING', engine: 'eslint',
        explanation: 'Math.random()/pseudoRandomBytes are not cryptographically secure. Use crypto.randomBytes / crypto.getRandomValues for tokens and secrets.',
    },
    {
        ruleId: 'SEC-010', title: 'Non-literal path/require', severity: 'WARNING', engine: 'eslint',
        explanation: 'A filesystem path or require target is built from a variable — path traversal / arbitrary code load risk. Validate against an allow-list.',
    },
    {
        ruleId: 'SEC-011', title: 'eval/exec with expression', severity: 'CRITICAL', engine: 'eslint',
        explanation: 'eval on a non-literal expression executes arbitrary injected code. Replace with explicit parsing/dispatch.',
    },
    {
        ruleId: 'SEC-012', title: 'Possible timing-unsafe secret comparison', severity: 'WARNING', engine: 'eslint',
        explanation: 'Comparing secrets with == / === leaks timing information. Use crypto.timingSafeEqual.',
    },
    {
        ruleId: 'SEC-025', title: 'CSRF middleware ordering', severity: 'WARNING', engine: 'eslint',
        explanation: 'CSRF protection registered after method-override can be bypassed. Register CSRF before method-override middleware.',
    },
    // ── Config-Engine (K8s/IaC) ──────────────────────────────────────────────
    {
        ruleId: 'INFRA-001', title: 'privileged: true container', severity: 'CRITICAL', engine: 'config',
        explanation: 'A privileged container has full access to the host kernel — container escape by configuration. Drop privileged and grant specific capabilities.',
    },
    {
        ruleId: 'INFRA-002', title: 'allowPrivilegeEscalation not disabled', severity: 'WARNING', engine: 'config',
        explanation: 'Without allowPrivilegeEscalation: false a process can gain more privileges than its parent (setuid/file capabilities). Set it explicitly to false.',
    },
    {
        ruleId: 'INFRA-003', title: 'Host namespace sharing enabled', severity: 'CRITICAL', engine: 'config',
        explanation: 'hostNetwork/hostPID/hostIPC break container isolation and expose host processes and network stack. Remove the host* flags.',
    },
    {
        ruleId: 'INFRA-004', title: 'Dangerous capability added', severity: 'CRITICAL', engine: 'config',
        explanation: 'CAP_SYS_ADMIN/CAP_SYS_MODULE are equivalent to root on the host. Drop them and use a minimal capability set.',
    },
    {
        ruleId: 'INFRA-005', title: 'docker.sock mounted', severity: 'CRITICAL', engine: 'config',
        explanation: 'Mounting the Docker socket hands the container full control over the container runtime — root on the node. Remove the hostPath mount.',
    },
    {
        ruleId: 'INFRA-006', title: 'Secret literal in manifest', severity: 'CRITICAL', engine: 'config',
        explanation: 'Secrets in manifests end up in git and etcd in plaintext. Use secretKeyRef / an external secret store.',
        fixTemplate: 'valueFrom:\n  secretKeyRef:\n    name: <secret-name>\n    key: <key>',
    },
    {
        ruleId: 'INFRA-007', title: 'Missing securityContext / runAsNonRoot', severity: 'WARNING', engine: 'config',
        explanation: 'Without runAsNonRoot: true the container may run as root by default. Add a securityContext with runAsNonRoot: true.',
    },
    {
        ruleId: 'INFRA-008', title: 'Missing resource limits', severity: 'WARNING', engine: 'config',
        explanation: 'Containers without cpu/memory limits can starve the node (noisy neighbor / DoS). Set resources.limits.cpu and .memory.',
    },
    {
        ruleId: 'INFRA-009', title: 'Missing seccompProfile', severity: 'WARNING', engine: 'config',
        explanation: 'Without a seccomp profile the container may use the full syscall surface. Set seccompProfile.type: RuntimeDefault.',
    },
    {
        ruleId: 'INFRA-010', title: 'Writable root filesystem', severity: 'WARNING', engine: 'config',
        explanation: 'A writable root filesystem lets a compromised process persist and tamper with binaries. Set readOnlyRootFilesystem: true.',
    },
    {
        ruleId: 'INFRA-011', title: 'Insecure http:// literal', severity: 'WARNING', engine: 'config',
        explanation: 'A plaintext http:// endpoint in a manifest moves real traffic unencrypted. Use https:// (localhost is exempt).',
    },
    // ── Registry-Engine (Netzwerk) ───────────────────────────────────────────
    {
        ruleId: 'SEC-035', title: 'Package does not exist on its registry', severity: 'CRITICAL', engine: 'registry',
        explanation: 'This imported/declared package does not exist on the public registry — the hallmark of a hallucinated dependency and a slopsquatting target. Verify the name before anyone publishes a malicious package under it.',
    },
    {
        ruleId: 'SEC-036', title: 'Unverified Hugging Face artifact', severity: 'CRITICAL', engine: 'registry',
        explanation: 'The referenced Hugging Face model id does not resolve (or only ships pickle-format weights). Verify the id and prefer safetensors weights.',
    },
];

export const RULE_REGISTRY: ReadonlyMap<string, RuleDescriptor> = new Map(
    RULE_LIST.map((descriptor) => [descriptor.ruleId, descriptor]),
);

/** Alle Regel-IDs, die der Core in dieser Version tatsächlich ausführt. */
export const IMPLEMENTED_RULE_IDS: readonly string[] = RULE_LIST.map((rule) => rule.ruleId);
