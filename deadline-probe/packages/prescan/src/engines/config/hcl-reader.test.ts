/**
 * HCL-Reader-Tests — die Formen, die Terraform-IAM-Dateien real verwenden:
 * jsonencode-Objekte, Heredoc-JSON, Interpolation mit verschachtelten
 * Quotes, Referenzen, verschachtelte Blöcke, Conditionals (⇒ raw).
 */
import { describe, expect, it } from 'vitest';
import { findBlocks, hclReference, hclString, hclStrings, parseHcl } from './hcl-reader';

const POLICY_WITH_JSONENCODE = [
    'resource "aws_iam_role_policy" "exporter_access" {',
    '  name = "invoice-exporter-access" # inline comment',
    '  role = aws_iam_role.exporter_exec.id',
    '  policy = jsonencode({',
    '    Version = "2012-10-17"',
    '    Statement = [{',
    '      Effect   = "Allow"',
    '      Action   = ["dynamodb:*", "s3:GetObject"]',
    '      Resource = "*"',
    '    }]',
    '  })',
    '}',
].join('\n');

describe('parseHcl', () => {
    it('reads labelled blocks, attributes, references and jsonencode objects with line numbers', () => {
        const [policyBlock] = findBlocks(parseHcl(POLICY_WITH_JSONENCODE), 'resource', 'aws_iam_role_policy');

        expect(policyBlock.labels).toEqual(['aws_iam_role_policy', 'exporter_access']);
        expect(hclString(policyBlock.attributes.get('name'))).toBe('invoice-exporter-access');
        expect(hclReference(policyBlock.attributes.get('role'))).toBe('aws_iam_role.exporter_exec.id');

        const policyValue = policyBlock.attributes.get('policy');
        expect(policyValue?.kind).toBe('call');
        if (policyValue?.kind !== 'call') return;
        const encodedObject = policyValue.args[0];
        expect(encodedObject.kind).toBe('object');
        if (encodedObject.kind !== 'object') return;
        const statementList = encodedObject.entries.get('Statement');
        expect(statementList?.kind).toBe('list');
        if (statementList?.kind !== 'list') return;
        const statement = statementList.items[0];
        expect(statement.line).toBe(6);
        if (statement.kind !== 'object') return;
        expect(hclStrings(statement.entries.get('Action')).map((action) => action.value)).toEqual(['dynamodb:*', 's3:GetObject']);
        expect(hclString(statement.entries.get('Resource'))).toBe('*');
    });

    it('keeps heredoc bodies as one string and survives interpolation with nested quotes', () => {
        const heredocSource = [
            'resource "aws_iam_role_policy" "raw" {',
            '  policy = <<-POLICY',
            '    { "Statement": [{ "Effect": "Allow", "Action": "*", "Resource": "*" }] }',
            '  POLICY',
            '  bucket = "${aws_s3_bucket.logs.id}-${lookup(var.suffixes, "prod")}"',
            '}',
        ].join('\n');
        const [rawBlock] = parseHcl(heredocSource).blocks;

        const policyText = hclString(rawBlock.attributes.get('policy'));
        expect(policyText).toContain('"Resource": "*"');
        expect(rawBlock.attributes.get('policy')?.line).toBe(2);
        expect(hclString(rawBlock.attributes.get('bucket'))).toBe('${aws_s3_bucket.logs.id}-${lookup(var.suffixes, "prod")}');
    });

    it('reads nested blocks (data policy documents) and degrades operators to raw values', () => {
        const documentSource = [
            'data "aws_iam_policy_document" "assume" {',
            '  statement {',
            '    effect    = "Allow"',
            '    actions   = ["sts:AssumeRole"]',
            '    resources = ["*"]',
            '    condition {',
            '      test = "StringEquals"',
            '    }',
            '  }',
            '  timeout = var.long ? 300 : 30',
            '  count   = length(var.names) > 0 ? 1 : 0',
            '}',
        ].join('\n');
        const [documentBlock] = parseHcl(documentSource).blocks;
        const [statementBlock] = findBlocks(documentBlock, 'statement');

        expect(hclStrings(statementBlock.attributes.get('actions')).map((action) => action.value)).toEqual(['sts:AssumeRole']);
        expect(findBlocks(statementBlock, 'condition')).toHaveLength(1);
        expect(documentBlock.attributes.get('timeout')).toMatchObject({ kind: 'raw', text: 'var.long ? 300 : 30' });
        expect(documentBlock.attributes.get('count')?.kind).toBe('raw');
    });

    it('never throws on malformed input', () => {
        expect(() => parseHcl('resource "x" { policy = jsonencode({ Statement = [ { ')).not.toThrow();
        expect(() => parseHcl('= = = }}} ]] "unterminated')).not.toThrow();
    });
});
