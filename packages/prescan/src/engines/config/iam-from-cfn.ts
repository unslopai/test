/**
 * CloudFormation-/SAM-Adapter des IAM-/Serverless-Modells (YAML und JSON —
 * JSON-Templates laufen durch denselben `yaml`-Parser, Intrinsics wie
 * `!GetAtt`/`!Sub`/`!Ref` bleiben als getaggte Skalare erhalten).
 */
import { isMap, isScalar } from 'yaml';
import { asMap, asSeq, lineOfNode, mapEntries, mapValue, scalarString, scalarStrings } from './yaml-helpers';
import type { LineCounter, Node as YamlNode, YAMLMap } from 'yaml';
import type { IamStatement, PolicyAttachment, ServerlessFunction, ServerlessTemplate } from './iam-model';

const FUNCTION_TYPES: ReadonlySet<string> = new Set(['AWS::Lambda::Function', 'AWS::Serverless::Function']);
const POLICY_TYPES: ReadonlySet<string> = new Set(['AWS::IAM::Policy', 'AWS::IAM::ManagedPolicy']);

interface CfnResource {
    readonly name: string;
    readonly type: string;
    readonly properties: YAMLMap | null;
    readonly node: YamlNode;
}

interface CfnReadContext {
    readonly lineCounter: LineCounter;
}

/** null, wenn das Dokument kein CloudFormation-/SAM-Template ist (kein `Resources` mit `AWS::`-Typen). */
export function serverlessTemplateFromCfn(rootMap: YAMLMap, lineCounter: LineCounter): ServerlessTemplate | null {
    const resources = collectResources(rootMap);
    if (resources.length === 0) return null;
    const context: CfnReadContext = { lineCounter };

    const policies: PolicyAttachment[] = [];
    const functions: ServerlessFunction[] = [];
    for (const resource of resources) {
        if (resource.type === 'AWS::IAM::Role') policies.push(...roleAttachments(resource, context));
        else if (POLICY_TYPES.has(resource.type)) policies.push(...standalonePolicyAttachments(resource, context));
        else if (FUNCTION_TYPES.has(resource.type)) {
            const serverlessFunction = functionFromResource(resource, context);
            functions.push(serverlessFunction);
            policies.push(...samInlinePolicies(resource, serverlessFunction, context));
        }
    }
    return { policies, functions };
}

function collectResources(rootMap: YAMLMap): CfnResource[] {
    const resourcesMap = asMap(mapValue(rootMap, 'Resources'));
    return mapEntries(resourcesMap).flatMap(({ key, value }) => {
        const resourceMap = asMap(value);
        const type = scalarString(mapValue(resourceMap, 'Type'));
        if (!resourceMap || type === null || !type.startsWith('AWS::')) return [];
        return [{ name: key, type, properties: asMap(mapValue(resourceMap, 'Properties')), node: resourceMap }];
    });
}

// =============================================================================
// Rollen & Policies
// =============================================================================

function roleAttachments(resource: CfnResource, context: CfnReadContext): PolicyAttachment[] {
    const roleKey = `role:${resource.name}`;
    const inlinePolicies = asSeq(mapValue(resource.properties, 'Policies'))?.items ?? [];
    const inlineAttachments = inlinePolicies.flatMap((policyNode): PolicyAttachment[] => {
        const policyDocument = asMap(mapValue(asMap(policyNode as YamlNode), 'PolicyDocument'));
        if (!policyDocument) return [];
        return [{
            roleKey,
            statements: statementsFromDocument(policyDocument, context),
            managedPolicyArn: null,
            line: lineOfNode(context.lineCounter, policyNode as YamlNode),
        }];
    });
    const managedArnsNode = mapValue(resource.properties, 'ManagedPolicyArns');
    const managedAttachments = scalarStrings(managedArnsNode).map((managedArn) => ({
        roleKey,
        statements: [],
        managedPolicyArn: managedArn,
        line: lineOfNode(context.lineCounter, managedArnsNode),
    }));
    return [...inlineAttachments, ...managedAttachments];
}

function standalonePolicyAttachments(resource: CfnResource, context: CfnReadContext): PolicyAttachment[] {
    const policyDocument = asMap(mapValue(resource.properties, 'PolicyDocument'));
    if (!policyDocument) return [];
    const statements = statementsFromDocument(policyDocument, context);
    const line = lineOfNode(context.lineCounter, policyDocument);
    const roleKeys = (asSeq(mapValue(resource.properties, 'Roles'))?.items ?? [])
        .map((roleNode) => referenceName(roleNode as YamlNode))
        .filter((roleName): roleName is string => roleName !== null)
        .map((roleName) => `role:${roleName}`);
    if (roleKeys.length === 0) return [{ roleKey: null, statements, managedPolicyArn: null, line }];
    return roleKeys.map((roleKey) => ({ roleKey, statements, managedPolicyArn: null, line }));
}

/** SAM `Policies:` — Managed-Policy-Namen oder Inline-Statements; ohne explizite `Role` gilt die Funktion selbst als Rolle. */
function samInlinePolicies(
    resource: CfnResource,
    serverlessFunction: ServerlessFunction,
    context: CfnReadContext,
): PolicyAttachment[] {
    if (resource.type !== 'AWS::Serverless::Function') return [];
    const roleKey = serverlessFunction.roleKey ?? `fn:${resource.name}`;
    const policyNodes = asSeq(mapValue(resource.properties, 'Policies'))?.items ?? [];
    return policyNodes.flatMap((policyNode): PolicyAttachment[] => {
        const line = lineOfNode(context.lineCounter, policyNode as YamlNode);
        const managedName = scalarString(policyNode as YamlNode);
        if (managedName !== null) return [{ roleKey, statements: [], managedPolicyArn: managedName, line }];
        const inlineDocument = asMap(policyNode as YamlNode);
        if (!inlineDocument || mapValue(inlineDocument, 'Statement') === null) return [];
        return [{ roleKey, statements: statementsFromDocument(inlineDocument, context), managedPolicyArn: null, line }];
    });
}

function statementsFromDocument(policyDocument: YAMLMap, context: CfnReadContext): IamStatement[] {
    const statementNode = mapValue(policyDocument, 'Statement');
    const statementNodes = isMap(statementNode) ? [statementNode] : asSeq(statementNode)?.items ?? [];
    return statementNodes.flatMap((node) => {
        const statementMap = asMap(node as YamlNode);
        if (!statementMap) return [];
        return [{
            effect: scalarString(mapValue(statementMap, 'Effect')),
            actions: scalarStrings(mapValue(statementMap, 'Action')),
            resources: scalarStrings(mapValue(statementMap, 'Resource')),
            hasCondition: mapValue(statementMap, 'Condition') !== null,
            hasPrincipal: mapValue(statementMap, 'Principal') !== null,
            line: lineOfNode(context.lineCounter, statementMap),
        }];
    });
}

// =============================================================================
// Funktionen & Intrinsics
// =============================================================================

function functionFromResource(resource: CfnResource, context: CfnReadContext): ServerlessFunction {
    const roleNode = mapValue(resource.properties, 'Role');
    const layersNode = mapValue(resource.properties, 'Layers');
    const imageUriNode = mapValue(resource.properties, 'ImageUri')
        ?? mapValue(asMap(mapValue(resource.properties, 'Code')), 'ImageUri');
    const imageUri = scalarString(imageUriNode);
    return {
        name: resource.name,
        line: lineOfNode(context.lineCounter, resource.node),
        roleKey: roleKeyFromNode(roleNode),
        roleLine: lineOfNode(context.lineCounter, roleNode ?? resource.node),
        layerArns: (asSeq(layersNode)?.items ?? []).flatMap((layerNode) => {
            const layerArn = scalarString(layerNode as YamlNode);
            return layerArn === null ? [] : [{ value: layerArn, line: lineOfNode(context.lineCounter, layerNode as YamlNode) }];
        }),
        imageUri: imageUri === null ? null : { value: imageUri, line: lineOfNode(context.lineCounter, imageUriNode) },
    };
}

/** `!GetAtt Role.Arn` | `Fn::GetAtt: [Role, Arn]` ⇒ `role:Role`; literale ARN-Strings bleiben als Key erhalten. */
function roleKeyFromNode(roleNode: YamlNode | null): string | null {
    if (roleNode === null) return null;
    if (isScalar(roleNode) && typeof roleNode.value === 'string') {
        if (roleNode.tag === '!GetAtt') return `role:${roleNode.value.split('.')[0]}`;
        return roleNode.value;
    }
    const getAttNode = mapValue(asMap(roleNode), 'Fn::GetAtt');
    const getAttTarget = scalarStrings(getAttNode)[0];
    return getAttTarget === undefined ? null : `role:${getAttTarget}`;
}

/** `!Ref Name` | `Ref: Name` ⇒ Name. */
function referenceName(node: YamlNode): string | null {
    if (isScalar(node) && node.tag === '!Ref' && typeof node.value === 'string') return node.value;
    return scalarString(mapValue(asMap(node), 'Ref'));
}
