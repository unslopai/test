/**
 * Terraform-Adapter des IAM-/Serverless-Modells: liest Rollen, Policies,
 * Attachments und Lambda-Funktionen aus einer HCL-Datei (nur Identity-
 * Policies — Bucket-/Key-Policies über `data.aws_iam_policy_document`
 * werden nur aufgelöst, wenn eine Rolle sie referenziert).
 */
import {
    findBlocks,
    hclObject,
    hclReference,
    hclString,
    hclStrings,
} from './hcl-reader';
import { statementsFromJsonText } from './iam-model';
import type { HclBlock, HclBody, HclValue } from './hcl-reader';
import type { IamStatement, PolicyAttachment, ServerlessFunction, ServerlessTemplate } from './iam-model';

type StandalonePolicies = ReadonlyMap<string, readonly IamStatement[]>;

export function serverlessTemplateFromHcl(body: HclBody): ServerlessTemplate {
    const standalonePolicies = collectStandalonePolicies(body);
    const policies = [
        ...collectRolePolicies(body, standalonePolicies),
        ...collectAttachments(body, standalonePolicies),
        ...collectRoleInlinePolicies(body),
    ];
    const referencedPolicyKeys = new Set(collectReferencedPolicyKeys(body));
    for (const [policyKey, statements] of standalonePolicies) {
        const isIdentityPolicy = policyKey.startsWith('aws_iam_policy.');
        if (isIdentityPolicy && !referencedPolicyKeys.has(policyKey)) {
            policies.push({ roleKey: null, statements, managedPolicyArn: null, line: statements[0]?.line ?? 1 });
        }
    }
    return { policies, functions: collectFunctions(body) };
}

// =============================================================================
// Policies
// =============================================================================

function collectStandalonePolicies(body: HclBody): StandalonePolicies {
    const standalone = new Map<string, readonly IamStatement[]>();
    for (const policyBlock of findBlocks(body, 'resource', 'aws_iam_policy')) {
        standalone.set(`aws_iam_policy.${policyBlock.labels[1]}`, statementsFromPolicyValue(policyBlock.attributes.get('policy'), new Map()));
    }
    for (const documentBlock of findBlocks(body, 'data', 'aws_iam_policy_document')) {
        standalone.set(`data.aws_iam_policy_document.${documentBlock.labels[1]}`, statementsFromDocumentBlock(documentBlock));
    }
    return standalone;
}

function collectRolePolicies(body: HclBody, standalone: StandalonePolicies): PolicyAttachment[] {
    return findBlocks(body, 'resource', 'aws_iam_role_policy').map((policyBlock) => ({
        roleKey: roleKeyFromValue(policyBlock.attributes.get('role')),
        statements: statementsFromPolicyValue(policyBlock.attributes.get('policy'), standalone),
        managedPolicyArn: null,
        line: policyBlock.line,
    }));
}

function collectAttachments(body: HclBody, standalone: StandalonePolicies): PolicyAttachment[] {
    return findBlocks(body, 'resource', 'aws_iam_role_policy_attachment').map((attachmentBlock) => {
        const policyArnValue = attachmentBlock.attributes.get('policy_arn');
        const referencedKey = policyKeyFromReference(hclReference(policyArnValue));
        return {
            roleKey: roleKeyFromValue(attachmentBlock.attributes.get('role')),
            statements: referencedKey ? standalone.get(referencedKey) ?? [] : [],
            managedPolicyArn: hclString(policyArnValue),
            line: policyArnValue?.line ?? attachmentBlock.line,
        };
    });
}

function collectRoleInlinePolicies(body: HclBody): PolicyAttachment[] {
    return findBlocks(body, 'resource', 'aws_iam_role').flatMap((roleBlock) => {
        const roleKey = `aws_iam_role.${roleBlock.labels[1]}`;
        const inlineAttachments = findBlocks(roleBlock, 'inline_policy').map((inlineBlock) => ({
            roleKey,
            statements: statementsFromPolicyValue(inlineBlock.attributes.get('policy'), new Map()),
            managedPolicyArn: null,
            line: inlineBlock.line,
        }));
        const managedAttachments = hclStrings(roleBlock.attributes.get('managed_policy_arns')).map((managedArn) => ({
            roleKey,
            statements: [],
            managedPolicyArn: managedArn.value,
            line: managedArn.line,
        }));
        return [...inlineAttachments, ...managedAttachments];
    });
}

function collectReferencedPolicyKeys(body: HclBody): string[] {
    return findBlocks(body, 'resource', 'aws_iam_role_policy_attachment')
        .map((attachmentBlock) => policyKeyFromReference(hclReference(attachmentBlock.attributes.get('policy_arn'))))
        .filter((policyKey): policyKey is string => policyKey !== null);
}

/** `policy = jsonencode({…})` | Heredoc-/String-JSON | `data.aws_iam_policy_document.x.json`. */
function statementsFromPolicyValue(policyValue: HclValue | undefined, standalone: StandalonePolicies): readonly IamStatement[] {
    if (!policyValue) return [];
    if (policyValue.kind === 'call' && policyValue.name === 'jsonencode') {
        return statementsFromEncodedObject(hclObject(policyValue.args[0]));
    }
    if (policyValue.kind === 'string') return statementsFromJsonText(policyValue.value, policyValue.line);
    const referencedKey = policyKeyFromReference(hclReference(policyValue));
    return referencedKey ? standalone.get(referencedKey) ?? [] : [];
}

function statementsFromEncodedObject(policyObject: ReadonlyMap<string, HclValue> | null): readonly IamStatement[] {
    const statementValue = policyObject?.get('Statement');
    if (!statementValue) return [];
    const statementObjects = statementValue.kind === 'list' ? statementValue.items : [statementValue];
    return statementObjects.flatMap((statementObject) => {
        const entries = hclObject(statementObject);
        if (!entries) return [];
        return [{
            effect: hclString(entries.get('Effect')),
            actions: hclStrings(entries.get('Action')).map((action) => action.value),
            resources: hclStrings(entries.get('Resource')).map((resource) => resource.value),
            hasCondition: entries.has('Condition'),
            hasPrincipal: entries.has('Principal'),
            line: statementObject.line,
        }];
    });
}

/** `data "aws_iam_policy_document"` — `statement {}`-Blöcke; effect default Allow (Terraform-Semantik). */
function statementsFromDocumentBlock(documentBlock: HclBlock): readonly IamStatement[] {
    return findBlocks(documentBlock, 'statement').map((statementBlock) => ({
        effect: hclString(statementBlock.attributes.get('effect')) ?? 'Allow',
        actions: hclStrings(statementBlock.attributes.get('actions')).map((action) => action.value),
        resources: hclStrings(statementBlock.attributes.get('resources')).map((resource) => resource.value),
        hasCondition: findBlocks(statementBlock, 'condition').length > 0,
        hasPrincipal: findBlocks(statementBlock, 'principals').length > 0,
        line: statementBlock.line,
    }));
}

// =============================================================================
// Funktionen & Referenzen
// =============================================================================

function collectFunctions(body: HclBody): ServerlessFunction[] {
    return findBlocks(body, 'resource', 'aws_lambda_function').map((functionBlock) => {
        const roleValue = functionBlock.attributes.get('role');
        const imageUri = functionBlock.attributes.get('image_uri');
        return {
            name: functionBlock.labels[1] ?? '',
            line: functionBlock.line,
            roleKey: roleKeyFromValue(roleValue),
            roleLine: roleValue?.line ?? functionBlock.line,
            layerArns: hclStrings(functionBlock.attributes.get('layers')),
            imageUri: imageUri?.kind === 'string' ? { value: imageUri.value, line: imageUri.line } : null,
        };
    });
}

/** `aws_iam_role.x.arn|.id|.name` ⇒ `aws_iam_role.x`; literale ARN-Strings bleiben als Key erhalten. */
function roleKeyFromValue(roleValue: HclValue | undefined): string | null {
    const reference = hclReference(roleValue);
    if (reference !== null) return reference.replace(/\.(arn|id|name)$/, '');
    return hclString(roleValue);
}

function policyKeyFromReference(reference: string | null): string | null {
    if (reference === null) return null;
    const trimmed = reference.replace(/\.(arn|id|json)$/, '');
    return trimmed.startsWith('aws_iam_policy.') || trimmed.startsWith('data.aws_iam_policy_document.') ? trimmed : null;
}
