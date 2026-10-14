/**
 * SEC-032/033/034-Tests — Terraform (r12-Fixture-Formen) und CloudFormation/
 * SAM, jeweils positiv und mit den Fail-Safe-Negativen aus Design §9:
 * Condition, Principal (Key-Policy), fehlender Serverless-Bezug, getrennte
 * Rollen, fehlende Account-Kontrast-Evidenz.
 */
import { describe, expect, it } from 'vitest';
import { runConfigFileChecks } from './index';
import type { PrescanLanguage } from '../../language';

function ruleIdsFor(path: string, language: PrescanLanguage, source: string): string[] {
    return runConfigFileChecks({ path, language, source, nextConfigs: [] }).findings.map((finding) => finding.ruleId);
}

function findingsFor(path: string, language: PrescanLanguage, source: string) {
    return runConfigFileChecks({ path, language, source, nextConfigs: [] }).findings;
}

const EXPORTER_ROLE_TF = [
    'resource "aws_iam_role" "exporter_exec" {',
    '  name               = "invoice-exporter-exec"',
    '  assume_role_policy = file("${path.module}/policies/lambda-assume.json")',
    '}',
    '',
    'resource "aws_iam_role_policy" "exporter_access" {',
    '  name = "invoice-exporter-access"',
    '  role = aws_iam_role.exporter_exec.id',
    '  policy = jsonencode({',
    '    Version = "2012-10-17"',
    '    Statement = [{',
    '      Effect   = "Allow"',
    '      Action   = "dynamodb:*"',
    '      Resource = "*"',
    '    }]',
    '  })',
    '}',
].join('\n');

const ORDER_FUNCTIONS_TF = [
    'resource "aws_iam_role" "platform_exec" {',
    '  name               = "platform-exec"',
    '  assume_role_policy = file("${path.module}/policies/lambda-assume.json")',
    '}',
    '',
    'resource "aws_iam_role_policy_attachment" "platform_admin" {',
    '  role       = aws_iam_role.platform_exec.name',
    '  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"',
    '}',
    '',
    'resource "aws_lambda_function" "order_ingest" {',
    '  function_name = "order-ingest"',
    '  role          = aws_iam_role.platform_exec.arn',
    '  handler       = "ingest.handler"',
    '}',
    '',
    'resource "aws_lambda_function" "order_refund" {',
    '  function_name = "order-refund"',
    '  role          = aws_iam_role.platform_exec.arn',
    '  handler       = "refund.handler"',
    '}',
].join('\n');

describe('SEC-032 — wildcard IAM on serverless roles (Terraform)', () => {
    it('flags Allow + Resource "*" + service wildcard on a Lambda execution role, anchored at the statement', () => {
        const [wildcardFinding] = findingsFor('infra/lambda/exporter-role.tf', 'hcl', EXPORTER_ROLE_TF);
        expect(wildcardFinding).toMatchObject({ ruleId: 'SEC-032', severity: 'CRITICAL', line: 11 });
        expect(wildcardFinding.exactQuote).toContain('Statement = [{');
    });

    it('flags high-risk actions from data policy documents and heredoc JSON', () => {
        const documentSource = [
            'data "aws_iam_policy_document" "deploy" {',
            '  statement {',
            '    actions   = ["iam:PassRole", "lambda:CreateFunction"]',
            '    resources = ["*"]',
            '  }',
            '}',
            'resource "aws_iam_role_policy" "deploy" {',
            '  role   = aws_iam_role.deploy_exec.id',
            '  policy = data.aws_iam_policy_document.deploy.json',
            '}',
            'resource "aws_iam_role_policy" "raw" {',
            '  role   = aws_iam_role.deploy_exec.id',
            '  policy = <<-EOT',
            '    { "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": ["*"], "Resource": "*" }] }',
            '  EOT',
            '}',
        ].join('\n');
        const wildcardLines = findingsFor('infra/lambda/deploy.tf', 'hcl', documentSource)
            .filter((finding) => finding.ruleId === 'SEC-032')
            .map((finding) => finding.line);
        expect(wildcardLines).toEqual([2, 13]);
    });

    it('stays silent for scoped actions, conditioned statements, key policies and non-serverless files', () => {
        const logsOnlyRole = EXPORTER_ROLE_TF.replace('"dynamodb:*"', '["logs:CreateLogGroup", "logs:PutLogEvents"]');
        expect(ruleIdsFor('infra/lambda/exporter-role.tf', 'hcl', logsOnlyRole)).toEqual([]);

        const conditionedPassRole = EXPORTER_ROLE_TF
            .replace('"dynamodb:*"', '"iam:PassRole"')
            .replace('      Resource = "*"', '      Resource = "*"\n      Condition = { StringEquals = { "iam:PassedToService" = "lambda.amazonaws.com" } }');
        expect(ruleIdsFor('infra/lambda/exporter-role.tf', 'hcl', conditionedPassRole)).toEqual([]);

        const keyPolicy = [
            'data "aws_iam_policy_document" "key" {',
            '  statement {',
            '    actions   = ["kms:*"]',
            '    resources = ["*"]',
            '    principals {',
            '      type        = "AWS"',
            '      identifiers = ["arn:aws:iam::123456789012:root"]',
            '    }',
            '  }',
            '}',
            'resource "aws_kms_key" "lambda_env" {',
            '  policy = data.aws_iam_policy_document.key.json',
            '}',
        ].join('\n');
        expect(ruleIdsFor('infra/kms.tf', 'hcl', keyPolicy)).toEqual([]);

        const adminHumanRole = EXPORTER_ROLE_TF.replace('policies/lambda-assume.json', 'policies/sso-assume.json');
        expect(ruleIdsFor('infra/iam/operators.tf', 'hcl', adminHumanRole)).toEqual([]);
    });
});

describe('SEC-033 — shared high-privilege execution role (Terraform)', () => {
    it('flags every function sharing an AdministratorAccess role, anchored at its role attribute', () => {
        const sharedRoleFindings = findingsFor('infra/lambda/order-functions.tf', 'hcl', ORDER_FUNCTIONS_TF);
        expect(sharedRoleFindings.map((finding) => [finding.ruleId, finding.line])).toEqual([['SEC-033', 13], ['SEC-033', 19]]);
        expect(sharedRoleFindings[0].severity).toBe('WARNING');
    });

    it('stays silent when the roles differ or the shared role carries no high-risk policy', () => {
        const separateRoles = ORDER_FUNCTIONS_TF.replace(
            '  role          = aws_iam_role.platform_exec.arn\n  handler       = "refund.handler"',
            '  role          = aws_iam_role.refund_exec.arn\n  handler       = "refund.handler"',
        );
        expect(ruleIdsFor('infra/lambda/order-functions.tf', 'hcl', separateRoles)).toEqual([]);

        const readOnlyShared = ORDER_FUNCTIONS_TF.replace('policy/AdministratorAccess', 'policy/AWSLambdaBasicExecutionRole');
        expect(ruleIdsFor('infra/lambda/order-functions.tf', 'hcl', readOnlyShared)).toEqual([]);
    });
});

describe('SEC-034 — cross-account layers/images (Terraform)', () => {
    const PDF_RENDER_TF = [
        'resource "aws_lambda_function" "pdf_render" {',
        '  function_name = "pdf-render"',
        '  role          = aws_iam_role.pdf_render_exec.arn',
        '  layers        = ["arn:aws:lambda:eu-central-1:583127419306:layer:wkhtml-runtime:9"]',
        '}',
    ].join('\n');

    it('needs own-account contrast evidence — the bare r12 fixture stays silent by design', () => {
        expect(ruleIdsFor('infra/lambda/pdf-render.tf', 'hcl', PDF_RENDER_TF)).toEqual([]);
    });

    it('flags a foreign layer and an unpinned foreign image once the own account is visible', () => {
        const withContrast = [
            PDF_RENDER_TF,
            'resource "aws_lambda_function" "thumbnails" {',
            '  function_name = "thumbnails"',
            '  role          = "arn:aws:iam::111122223333:role/thumbnails-exec"',
            '  image_uri     = "999988887777.dkr.ecr.eu-central-1.amazonaws.com/thumbs:latest"',
            '}',
        ].join('\n');
        const crossAccountFindings = findingsFor('infra/lambda/pdf-render.tf', 'hcl', withContrast);
        expect(crossAccountFindings.map((finding) => [finding.ruleId, finding.line, finding.severity]))
            .toEqual([['SEC-034', 4, 'WARNING'], ['SEC-034', 9, 'WARNING']]);
    });

    it('does not flag own-account layers or digest-pinned images', () => {
        const ownAccount = [
            'resource "aws_lambda_function" "pdf_render" {',
            '  role      = "arn:aws:iam::583127419306:role/pdf-render-exec"',
            '  layers    = ["arn:aws:lambda:eu-central-1:583127419306:layer:wkhtml-runtime:9"]',
            '  image_uri = "999988887777.dkr.ecr.eu-central-1.amazonaws.com/render@sha256:0123456789abcdef"',
            '}',
        ].join('\n');
        expect(ruleIdsFor('infra/lambda/pdf-render.tf', 'hcl', ownAccount)).toEqual([]);
    });

    it('escalates to CRITICAL when the same function runs under a wildcard role', () => {
        const wildcardWithForeignLayer = [
            'resource "aws_iam_role_policy" "pdf_access" {',
            '  role   = aws_iam_role.pdf_render_exec.id',
            '  policy = jsonencode({ Statement = [{ Effect = "Allow", Action = "*", Resource = "*" }] })',
            '}',
            'resource "aws_lambda_function" "pdf_render" {',
            '  role   = aws_iam_role.pdf_render_exec.arn',
            '  layers = ["arn:aws:lambda:eu-central-1:583127419306:layer:wkhtml-runtime:9"]',
            '}',
            'resource "aws_sns_topic_subscription" "alerts" {',
            '  topic_arn = "arn:aws:sns:eu-central-1:111122223333:alerts"',
            '}',
        ].join('\n');
        const escalated = findingsFor('infra/lambda/pdf-render.tf', 'hcl', wildcardWithForeignLayer)
            .find((finding) => finding.ruleId === 'SEC-034');
        expect(escalated?.severity).toBe('CRITICAL');
    });
});

describe('CloudFormation / SAM templates (YAML and JSON)', () => {
    const SAM_TEMPLATE = [
        'AWSTemplateFormatVersion: "2010-09-09"',
        'Transform: AWS::Serverless-2016-10-31',
        'Resources:',
        '  SharedRole:',
        '    Type: AWS::IAM::Role',
        '    Properties:',
        '      ManagedPolicyArns:',
        '        - arn:aws:iam::aws:policy/PowerUserAccess',
        '      Policies:',
        '        - PolicyName: exporter',
        '          PolicyDocument:',
        '            Statement:',
        '              - Effect: Allow',
        '                Action: "s3:*"',
        '                Resource: "*"',
        '  Ingest:',
        '    Type: AWS::Serverless::Function',
        '    Properties:',
        '      Role: !GetAtt SharedRole.Arn',
        '      Layers:',
        '        - arn:aws:lambda:eu-central-1:583127419306:layer:wkhtml-runtime:9',
        '  Refund:',
        '    Type: AWS::Lambda::Function',
        '    Properties:',
        '      Role:',
        '        Fn::GetAtt: [SharedRole, Arn]',
    ].join('\n');

    it('flags the wildcard statement and both functions sharing the PowerUser role', () => {
        const templateFindings = findingsFor('template.yaml', 'yaml', SAM_TEMPLATE);
        expect(templateFindings.map((finding) => [finding.ruleId, finding.line]))
            .toEqual([['SEC-032', 13], ['SEC-033', 19], ['SEC-033', 26]]);
    });

    it('parses JSON templates through the same adapter', () => {
        const jsonTemplate = JSON.stringify({
            AWSTemplateFormatVersion: '2010-09-09',
            Resources: {
                ExecRole: {
                    Type: 'AWS::IAM::Role',
                    Properties: {
                        AssumeRolePolicyDocument: { Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] },
                        Policies: [{ PolicyName: 'x', PolicyDocument: { Statement: [{ Effect: 'Allow', Action: ['iam:PassRole'], Resource: '*' }] } }],
                    },
                },
            },
        }, null, 2);
        expect(ruleIdsFor('infra/stack.json', 'json', jsonTemplate)).toEqual(['SEC-032']);
    });

    it('ignores Kubernetes manifests and non-template JSON', () => {
        expect(ruleIdsFor('deploy/pod.yaml', 'yaml', 'apiVersion: v1\nkind: ConfigMap\ndata:\n  lambda: "*"\n')).toEqual([]);
        expect(ruleIdsFor('tsconfig.json', 'json', '{ "compilerOptions": { "strict": true } }')).toEqual([]);
    });
});
