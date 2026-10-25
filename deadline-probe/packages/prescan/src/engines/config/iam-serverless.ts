/**
 * SEC-032 / SEC-033 / SEC-034 — IAM-/Serverless-Checks auf dem normalisierten
 * Modell (Terraform-HCL oder CloudFormation/SAM). Alle drei sind Datei-lokal:
 * Rollen, deren Policies in einer anderen Datei liegen, gelten als
 * unbekannt — nie als „unauffällig“, aber auch nie als Finding.
 *
 * Fail-Safe-Entscheidungen (pre_scanner_design.md §9):
 *  - Serverless-Gate: die Datei muss Lambda-/Serverless-Bezug zeigen, sonst
 *    ist eine Wildcard-Policy ein Fall für den LLM-Reviewer (Admin-/Human-
 *    Rollen sind nicht SEC-032).
 *  - Statements mit Condition oder Principal werden nie geflaggt.
 *  - SEC-034 feuert nur mit Kontrast-Evidenz (eigene Account-ID in derselben
 *    Datei) — ohne sie ist „fremd“ nicht entscheidbar.
 */
import { buildConfigFinding } from './config-finding';
import {
    collectOwnAccountIds,
    hasImageDigest,
    imageAccountId,
    isHighPrivilegeRole,
    isWildcardAllowStatement,
    layerAccountId,
} from './iam-model';
import type { PrescanFinding } from '../../types';
import type { ServerlessFunction, ServerlessTemplate } from './iam-model';

const SERVERLESS_EVIDENCE = /lambda|serverless/i;

export interface IamServerlessInput {
    readonly path: string;
    readonly source: string;
    readonly template: ServerlessTemplate;
}

export function runIamServerlessChecks(input: IamServerlessInput): PrescanFinding[] {
    if (!SERVERLESS_EVIDENCE.test(input.source)) return [];
    const sourceLines = input.source.split('\n');
    const findingAt: FindingAt = (ruleId, line, severityOverride) => buildConfigFinding({
        ruleId, path: input.path, line, quote: sourceLines[line - 1] ?? '', severityOverride,
    });

    const wildcard = wildcardPolicyFindings(input.template, findingAt);
    const sharedRole = functionsSharingHighPrivilegeRole(input.template)
        .map((sharedFunction) => findingAt('SEC-033', sharedFunction.roleLine));
    return [...wildcard.findings, ...sharedRole, ...foreignArtifactFindings(input, wildcard.roleKeys, findingAt)];
}

type FindingAt = (ruleId: string, line: number, severityOverride?: 'CRITICAL') => PrescanFinding;

/** SEC-032 je Wildcard-Allow-Statement, plus die Rollen, an denen solche Statements hängen. */
function wildcardPolicyFindings(template: ServerlessTemplate, findingAt: FindingAt): { findings: PrescanFinding[]; roleKeys: ReadonlySet<string> } {
    const roleKeys = new Set<string>();
    const findings: PrescanFinding[] = [];
    for (const attachment of template.policies) {
        for (const statement of attachment.statements.filter(isWildcardAllowStatement)) {
            if (attachment.roleKey !== null) roleKeys.add(attachment.roleKey);
            findings.push(findingAt('SEC-032', statement.line));
        }
    }
    return { findings, roleKeys };
}

/** SEC-034 je fremdem Layer/Image; CRITICAL, wenn die Funktion unter einer SEC-032-Rolle läuft. */
function foreignArtifactFindings(input: IamServerlessInput, wildcardRoleKeys: ReadonlySet<string>, findingAt: FindingAt): PrescanFinding[] {
    const ownAccountIds = collectOwnAccountIds(input.source);
    return input.template.functions.flatMap((serverlessFunction) => {
        const runsUnderWildcardRole = serverlessFunction.roleKey !== null && wildcardRoleKeys.has(serverlessFunction.roleKey);
        return foreignArtifacts(serverlessFunction, ownAccountIds)
            .map((foreignArtifact) => findingAt('SEC-034', foreignArtifact.line, runsUnderWildcardRole ? 'CRITICAL' : undefined));
    });
}

/** Funktionen, die sich eine Rolle mit ≥ 1 weiteren Funktion teilen UND deren Rolle high-privilege ist. */
function functionsSharingHighPrivilegeRole(template: ServerlessTemplate): ServerlessFunction[] {
    const functionsByRole = new Map<string, ServerlessFunction[]>();
    for (const serverlessFunction of template.functions) {
        if (serverlessFunction.roleKey === null) continue;
        const group = functionsByRole.get(serverlessFunction.roleKey) ?? [];
        group.push(serverlessFunction);
        functionsByRole.set(serverlessFunction.roleKey, group);
    }
    return [...functionsByRole.entries()]
        .filter(([roleKey, group]) => group.length > 1 && isHighPrivilegeRole(template, roleKey))
        .flatMap(([, group]) => group);
}

interface ForeignArtifact {
    readonly line: number;
}

function foreignArtifacts(serverlessFunction: ServerlessFunction, ownAccountIds: ReadonlySet<string>): ForeignArtifact[] {
    if (ownAccountIds.size === 0) return [];
    const foreignLayers = serverlessFunction.layerArns.filter((layer) => {
        const accountId = layerAccountId(layer.value);
        return accountId !== null && !ownAccountIds.has(accountId);
    });
    const image = serverlessFunction.imageUri;
    const imageAccount = image === null ? null : imageAccountId(image.value);
    const isForeignUnpinnedImage = image !== null && imageAccount !== null
        && !ownAccountIds.has(imageAccount) && !hasImageDigest(image.value);
    return [...foreignLayers, ...(isForeignUnpinnedImage ? [image] : [])];
}
