/**
 * Normalisiertes IAM-/Serverless-Modell (SEC-032/033/034) — gemeinsame
 * Sicht auf Terraform-HCL und CloudFormation/SAM-Templates. Die Adapter
 * (`iam-from-hcl.ts`, `iam-from-cfn.ts`) füllen es, die Checks in
 * `iam-serverless.ts` arbeiten nur noch auf dieser Struktur.
 */

export interface IamStatement {
    readonly effect: string | null;
    readonly actions: readonly string[];
    readonly resources: readonly string[];
    /** Statements mit Condition werden nie geflaggt (Scoping über Bedingungen ist legitim). */
    readonly hasCondition: boolean;
    /** Principal ⇒ resource-based Policy (Bucket-/Key-Policy) — kein Ausführungsrollen-Recht, nie geflaggt. */
    readonly hasPrincipal: boolean;
    readonly line: number;
}

/** Eine Policy (inline oder managed) und die Rolle, an der sie hängt (null = unbekannt/standalone). */
export interface PolicyAttachment {
    readonly roleKey: string | null;
    readonly statements: readonly IamStatement[];
    readonly managedPolicyArn: string | null;
    readonly line: number;
}

export interface ArtifactReference {
    readonly value: string;
    readonly line: number;
}

export interface ServerlessFunction {
    readonly name: string;
    readonly line: number;
    readonly roleKey: string | null;
    /** Zeile des `role`-Attributs — Anker für SEC-033. */
    readonly roleLine: number;
    readonly layerArns: readonly ArtifactReference[];
    readonly imageUri: ArtifactReference | null;
}

export interface ServerlessTemplate {
    readonly policies: readonly PolicyAttachment[];
    readonly functions: readonly ServerlessFunction[];
}

/** High-Risk-Aktionen laut SEC-032 (Rechte-Eskalation / Code-Ausführung). */
const HIGH_RISK_ACTIONS: ReadonlySet<string> = new Set([
    'sts:assumerole',
    'iam:passrole',
    'iam:createrole',
    'iam:attachrolepolicy',
    'iam:putrolepolicy',
    'lambda:createfunction',
    'lambda:updatefunctioncode',
    's3:putbucketpolicy',
    'kms:putkeypolicy',
]);

const SERVICE_WILDCARD_ACTION = /^[a-z0-9-]+:\*$/i;
const ADMIN_MANAGED_POLICY = /(^|\/)(AdministratorAccess|PowerUserAccess|IAMFullAccess)$/;

export function isWildcardOrHighRiskAction(action: string): boolean {
    const normalized = action.trim();
    return normalized === '*'
        || normalized === '*:*'
        || SERVICE_WILDCARD_ACTION.test(normalized)
        || HIGH_RISK_ACTIONS.has(normalized.toLowerCase());
}

/** SEC-032-Prädikat: Allow + Resource "*" + Wildcard-/High-Risk-Aktion, ohne Condition. */
export function isWildcardAllowStatement(statement: IamStatement): boolean {
    return statement.effect?.toLowerCase() === 'allow'
        && !statement.hasCondition
        && !statement.hasPrincipal
        && statement.resources.some((resource) => resource.trim() === '*')
        && statement.actions.some(isWildcardOrHighRiskAction);
}

export function isAdminManagedPolicy(policyArn: string): boolean {
    return ADMIN_MANAGED_POLICY.test(policyArn.trim());
}

/** Rolle gilt als high-privilege, wenn eine ihrer Policies eine High-Risk-Aktion oder ein Admin-Managed-Policy trägt. */
export function isHighPrivilegeRole(template: ServerlessTemplate, roleKey: string): boolean {
    return template.policies.some((attachment) => attachment.roleKey === roleKey && (
        (attachment.managedPolicyArn !== null && isAdminManagedPolicy(attachment.managedPolicyArn))
        || attachment.statements.some((statement) => !statement.hasPrincipal
            && statement.actions.some(isWildcardOrHighRiskAction))
    ));
}

// =============================================================================
// Statement-Extraktion aus geparstem JSON (Heredoc-Policies, CFN-JSON-Strings)
// =============================================================================

type UnknownRecord = Record<string, unknown>;

function isRecord(candidate: unknown): candidate is UnknownRecord {
    return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}

export function stringList(candidate: unknown): readonly string[] {
    if (typeof candidate === 'string') return [candidate];
    if (Array.isArray(candidate)) return candidate.filter((entry): entry is string => typeof entry === 'string');
    return [];
}

/** Statements eines Policy-Dokuments, das bereits als JSON-Objekt vorliegt (alle auf `line` verankert). */
export function statementsFromJsonDocument(policyDocument: unknown, line: number): readonly IamStatement[] {
    if (!isRecord(policyDocument)) return [];
    const rawStatements = Array.isArray(policyDocument.Statement)
        ? policyDocument.Statement
        : [policyDocument.Statement];
    return rawStatements.flatMap((rawStatement) => (isRecord(rawStatement)
        ? [{
            effect: typeof rawStatement.Effect === 'string' ? rawStatement.Effect : null,
            actions: stringList(rawStatement.Action),
            resources: stringList(rawStatement.Resource),
            hasCondition: rawStatement.Condition !== undefined,
            hasPrincipal: rawStatement.Principal !== undefined,
            line,
        }]
        : []));
}

/** Parst einen Policy-JSON-String (Heredoc / file-Inhalt); Interpolationen machen ihn unparsbar ⇒ leer. */
export function statementsFromJsonText(policyText: string, line: number): readonly IamStatement[] {
    if (policyText.includes('${')) return [];
    try {
        return statementsFromJsonDocument(JSON.parse(policyText), line);
    } catch (parseError: unknown) {
        // Fail-safe (Design §9): unparsbare Policy ⇒ keine Statements ⇒ kein Finding — aber sichtbar, weil es ein stiller Miss ist.
        console.warn(`[Prescan] IAM-Policy-JSON (Zeile ${line}) unparsbar — Statements übersprungen: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        return [];
    }
}

// =============================================================================
// Account-Evidenz (SEC-034)
// =============================================================================

const LAYER_ARN_ACCOUNT = /^arn:aws[a-z-]*:lambda:[a-z0-9-]*:(\d{12}):layer:/;
const ECR_IMAGE_ACCOUNT = /^(\d{12})\.dkr\.ecr\./;
const NON_LAYER_ARN_ACCOUNT = /arn:aws[a-z-]*:(?!lambda:[a-z0-9-]*:\d{12}:layer:)[a-z0-9-]*:[a-z0-9-]*:(\d{12}):/g;
const ACCOUNT_ID_ATTRIBUTE = /(?:account[_-]?ids?|SourceAccount|AccountId)\W{1,6}"(\d{12})"/gi;

export function layerAccountId(layerArn: string): string | null {
    return LAYER_ARN_ACCOUNT.exec(layerArn)?.[1] ?? null;
}

export function imageAccountId(imageUri: string): string | null {
    return ECR_IMAGE_ACCOUNT.exec(imageUri)?.[1] ?? null;
}

export function hasImageDigest(imageUri: string): boolean {
    return imageUri.includes('@sha256:');
}

/**
 * Eigene Account-IDs = 12-stellige IDs in ARNs, die KEINE Layer-ARNs sind,
 * plus explizite account_id-/SourceAccount-Attribute. Ohne diese Evidenz ist
 * „fremd“ nicht entscheidbar und SEC-034 feuert nicht (fail-safe).
 */
export function collectOwnAccountIds(source: string): ReadonlySet<string> {
    const ownAccountIds = new Set<string>();
    for (const arnMatch of source.matchAll(NON_LAYER_ARN_ACCOUNT)) ownAccountIds.add(arnMatch[1]);
    for (const attributeMatch of source.matchAll(ACCOUNT_ID_ATTRIBUTE)) ownAccountIds.add(attributeMatch[1]);
    return ownAccountIds;
}
