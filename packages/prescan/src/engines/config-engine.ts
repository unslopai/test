/**
 * Config-Engine — YAML-Parse + Pfad-Prädikate für K8s-Manifeste
 * (INFRA-001…011, pre_scanner_design.md §1). Kein externes Tool nötig:
 * die Regeln sind Presence-/Value-Checks auf geparsten Dokumenten.
 */
import { LineCounter, isMap, isScalar, isSeq, parseAllDocuments } from 'yaml';
import { RULE_REGISTRY } from '../rules/registry';
import type { Node as YamlNode, Pair, YAMLMap, YAMLSeq } from 'yaml';
import type { PrescanFinding, PrescanSeverity } from '../types';

const SECRET_KEY_PATTERN = /(password|passwd|secret|token|api[-_]?key|credential|client_secret|private[-_]?key)/i;
const HTTP_LITERAL_PATTERN = /\bhttp:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/;
const DANGEROUS_CAPABILITIES = /^(CAP_)?(SYS_ADMIN|SYS_MODULE)$/;
const ALLOWED_SECCOMP_TYPES = new Set(['RuntimeDefault', 'Localhost']);

interface ConfigScanState {
    readonly path: string;
    readonly lineCounter: LineCounter;
    readonly findings: PrescanFinding[];
}

export interface ConfigEngineInput {
    readonly path: string;
    readonly source: string;
}

export function runConfigEngine(input: ConfigEngineInput): PrescanFinding[] {
    const lineCounter = new LineCounter();
    const documents = parseAllDocuments(input.source, { lineCounter, keepSourceTokens: true });
    const state: ConfigScanState = { path: input.path, lineCounter, findings: [] };

    for (const document of documents) {
        const rootNode = document.contents;
        if (!isMap(rootNode) || !isKubernetesDocument(rootNode)) continue;

        for (const podSpec of findPodSpecs(rootNode)) {
            checkPodSpec(state, podSpec);
        }
        checkHttpLiterals(state, rootNode);
    }

    return state.findings;
}

function isKubernetesDocument(rootMap: YAMLMap): boolean {
    return mapValue(rootMap, 'apiVersion') !== null && mapValue(rootMap, 'kind') !== null;
}

/** Rekursiv alle Maps mit einer `containers`-Sequenz — deckt Pod, Deployment-Template, CronJob usw. ab. */
function findPodSpecs(node: YamlNode | null): YAMLMap[] {
    if (isMap(node)) {
        const containers = mapValue(node, 'containers');
        if (isSeq(containers)) return [node];
        return node.items.flatMap((pair) => findPodSpecs(pair.value as YamlNode | null));
    }
    if (isSeq(node)) {
        return node.items.flatMap((item) => findPodSpecs(item as YamlNode | null));
    }
    return [];
}

// =============================================================================
// Pod-Level-Checks
// =============================================================================

function checkPodSpec(state: ConfigScanState, podSpec: YAMLMap): void {
    for (const hostNamespaceKey of ['hostNetwork', 'hostPID', 'hostIPC']) {
        const flagNode = mapValue(podSpec, hostNamespaceKey);
        if (isScalar(flagNode) && flagNode.value === true) {
            addConfigFinding(state, 'INFRA-003', flagNode, `${hostNamespaceKey}: true`);
        }
    }

    checkDockerSocketMounts(state, podSpec);

    const podSecurityContext = asMap(mapValue(podSpec, 'securityContext'));
    for (const containerList of ['containers', 'initContainers']) {
        const containers = mapValue(podSpec, containerList);
        if (!isSeq(containers)) continue;
        for (const container of containers.items) {
            if (isMap(container)) checkContainer(state, container, podSecurityContext);
        }
    }
}

function checkDockerSocketMounts(state: ConfigScanState, podSpec: YAMLMap): void {
    const volumes = mapValue(podSpec, 'volumes');
    if (!isSeq(volumes)) return;

    for (const volume of volumes.items) {
        if (!isMap(volume)) continue;
        const hostPathValue = asMap(mapValue(volume, 'hostPath'));
        const pathNode = hostPathValue ? mapValue(hostPathValue, 'path') : null;
        if (isScalar(pathNode) && String(pathNode.value).includes('docker.sock')) {
            addConfigFinding(state, 'INFRA-005', pathNode, String(pathNode.value));
        }
    }
}

// =============================================================================
// Container-Level-Checks
// =============================================================================

function checkContainer(state: ConfigScanState, container: YAMLMap, podSecurityContext: YAMLMap | null): void {
    const securityContext = asMap(mapValue(container, 'securityContext'));
    const isPrivileged = scalarBool(securityContext, 'privileged') === true;

    if (isPrivileged) {
        addConfigFinding(state, 'INFRA-001', mapValue(securityContext, 'privileged') ?? container, 'privileged: true');
    }
    if (scalarBool(securityContext, 'allowPrivilegeEscalation') !== false) {
        addConfigFinding(state, 'INFRA-002', securityContext ?? container, containerLabel(container));
    }
    checkCapabilities(state, securityContext);
    checkEnvSecrets(state, container);
    checkRunAsNonRoot(state, container, securityContext, podSecurityContext);
    checkResourceLimits(state, container);
    checkSeccompProfile(state, container, securityContext, podSecurityContext, isPrivileged);
    if (scalarBool(securityContext, 'readOnlyRootFilesystem') !== true) {
        addConfigFinding(state, 'INFRA-010', securityContext ?? container, containerLabel(container));
    }
}

function checkCapabilities(state: ConfigScanState, securityContext: YAMLMap | null): void {
    const capabilities = asMap(mapValue(securityContext, 'capabilities'));
    const addedCapabilities = capabilities ? mapValue(capabilities, 'add') : null;
    if (!isSeq(addedCapabilities)) return;

    for (const capability of addedCapabilities.items) {
        if (isScalar(capability) && DANGEROUS_CAPABILITIES.test(String(capability.value))) {
            addConfigFinding(state, 'INFRA-004', capability, String(capability.value));
        }
    }
}

function checkEnvSecrets(state: ConfigScanState, container: YAMLMap): void {
    const environmentEntries = mapValue(container, 'env');
    if (!isSeq(environmentEntries)) return;

    for (const environmentEntry of environmentEntries.items) {
        if (!isMap(environmentEntry)) continue;
        const nameNode = mapValue(environmentEntry, 'name');
        const literalValue = mapValue(environmentEntry, 'value');
        const usesSecretRef = mapValue(environmentEntry, 'valueFrom') !== null;

        const hasSecretName = isScalar(nameNode) && SECRET_KEY_PATTERN.test(String(nameNode.value));
        const hasNonEmptyLiteral = isScalar(literalValue) && String(literalValue.value ?? '').length > 0;
        if (hasSecretName && hasNonEmptyLiteral && !usesSecretRef) {
            addConfigFinding(state, 'INFRA-006', literalValue ?? environmentEntry, String(isScalar(nameNode) ? nameNode.value : ''));
        }
    }
}

function checkRunAsNonRoot(
    state: ConfigScanState,
    container: YAMLMap,
    securityContext: YAMLMap | null,
    podSecurityContext: YAMLMap | null,
): void {
    const runAsNonRoot = scalarBool(securityContext, 'runAsNonRoot') ?? scalarBool(podSecurityContext, 'runAsNonRoot');
    if (runAsNonRoot !== true) {
        addConfigFinding(state, 'INFRA-007', securityContext ?? container, containerLabel(container));
    }
}

function checkResourceLimits(state: ConfigScanState, container: YAMLMap): void {
    const limits = asMap(mapValue(asMap(mapValue(container, 'resources')), 'limits'));
    const hasCpuLimit = limits !== null && mapValue(limits, 'cpu') !== null;
    const hasMemoryLimit = limits !== null && mapValue(limits, 'memory') !== null;
    if (!hasCpuLimit || !hasMemoryLimit) {
        addConfigFinding(state, 'INFRA-008', limits ?? container, containerLabel(container));
    }
}

function checkSeccompProfile(
    state: ConfigScanState,
    container: YAMLMap,
    securityContext: YAMLMap | null,
    podSecurityContext: YAMLMap | null,
    isPrivileged: boolean,
): void {
    const profile = asMap(mapValue(securityContext, 'seccompProfile'))
        ?? asMap(mapValue(podSecurityContext, 'seccompProfile'));
    const profileType = profile ? mapValue(profile, 'type') : null;
    const hasAllowedProfile = isScalar(profileType) && ALLOWED_SECCOMP_TYPES.has(String(profileType.value));
    if (hasAllowedProfile) return;

    // Eskalation (§1): privilegierter Container ohne Seccomp ist CRITICAL.
    const severity: PrescanSeverity = isPrivileged ? 'CRITICAL' : 'WARNING';
    addConfigFinding(state, 'INFRA-009', securityContext ?? container, containerLabel(container), severity);
}

// =============================================================================
// INFRA-011 — http://-Literale (alle Skalare eines K8s-Dokuments)
// =============================================================================

function checkHttpLiterals(state: ConfigScanState, node: YamlNode | null): void {
    if (isScalar(node)) {
        if (typeof node.value === 'string' && HTTP_LITERAL_PATTERN.test(node.value)) {
            addConfigFinding(state, 'INFRA-011', node, node.value);
        }
        return;
    }
    if (isMap(node)) {
        for (const pair of node.items) checkHttpLiterals(state, pair.value as YamlNode | null);
    } else if (isSeq(node)) {
        for (const item of node.items) checkHttpLiterals(state, item as YamlNode | null);
    }
}

// =============================================================================
// YAML-Helfer
// =============================================================================

function mapValue(mapNode: YAMLMap | null, key: string): YamlNode | null {
    if (!mapNode) return null;
    const matchingPair = mapNode.items.find(
        (pair: Pair) => isScalar(pair.key) && pair.key.value === key,
    );
    return (matchingPair?.value as YamlNode | undefined) ?? null;
}

function asMap(node: YamlNode | null): YAMLMap | null {
    return isMap(node) ? node : null;
}

function scalarBool(mapNode: YAMLMap | null, key: string): boolean | null {
    const valueNode = mapValue(mapNode, key);
    return isScalar(valueNode) && typeof valueNode.value === 'boolean' ? valueNode.value : null;
}

function containerLabel(container: YAMLMap): string {
    const nameNode = mapValue(container, 'name');
    return isScalar(nameNode) ? `(container: ${String(nameNode.value)})` : '';
}

function addConfigFinding(
    state: ConfigScanState,
    ruleId: string,
    anchorNode: YamlNode | YAMLSeq | YAMLMap | null,
    detail: string,
    severityOverride?: PrescanSeverity,
): void {
    const descriptor = RULE_REGISTRY.get(ruleId);
    const anchorOffset = anchorNode?.range?.[0] ?? 0;
    const anchorLine = state.lineCounter.linePos(anchorOffset).line;

    state.findings.push({
        ruleId,
        ruleTitle: descriptor?.title ?? ruleId,
        severity: severityOverride ?? descriptor?.severity ?? 'WARNING',
        path: state.path,
        line: anchorLine,
        endLine: anchorLine,
        exactQuote: detail.substring(0, 200),
        explanation: descriptor?.explanation ?? '',
        fixTemplate: descriptor?.fixTemplate,
        engine: 'config',
        fileLevel: false,
    });
}
