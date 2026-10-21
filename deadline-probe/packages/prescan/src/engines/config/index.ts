/**
 * Dispatcher der Config-Datei-Checks (v4): wählt pro Datei die passenden
 * Checks — K8s-Manifeste (config-engine), CloudFormation/SAM + Terraform
 * (SEC-032/033/034), Claude-Code-Settings (SEC-042/043) und Next.js-
 * Middleware/Proxy (SEC-019). Jede Datei wird genau einmal geparst pro Format.
 */
import { LineCounter, parseAllDocuments } from 'yaml';
import { runConfigEngine } from '../config-engine';
import { runAgentConfigChecks } from './agent-config';
import { parseHcl } from './hcl-reader';
import { serverlessTemplateFromCfn } from './iam-from-cfn';
import { serverlessTemplateFromHcl } from './iam-from-hcl';
import { runIamServerlessChecks } from './iam-serverless';
import { runSecurityHeaderChecks } from './security-headers';
import { asMap } from './yaml-helpers';
import type { Node as YamlNode } from 'yaml';
import type { PrescanLanguage } from '../../language';
import type { PrescanCompanionFile, PrescanFinding, SkippedCheck } from '../../types';

const NEXT_CONFIG_FILE = /(^|\/)next\.config\.(js|mjs|cjs|ts|mts)$/;

export interface ConfigFileChecksInput {
    readonly path: string;
    readonly language: PrescanLanguage;
    readonly source: string;
    /** Alle sichtbaren `next.config.*` des Scans (Diff + Begleitdateien). */
    readonly nextConfigs: readonly PrescanCompanionFile[];
}

export interface ConfigFileChecksResult {
    readonly findings: PrescanFinding[];
    readonly skippedChecks: SkippedCheck[];
}

export function isNextConfigPath(path: string): boolean {
    return NEXT_CONFIG_FILE.test(path);
}

export function runConfigFileChecks(input: ConfigFileChecksInput): ConfigFileChecksResult {
    switch (input.language) {
        case 'yaml':
            return withoutSkips([
                ...runConfigEngine({ path: input.path, source: input.source }),
                ...runCloudFormationChecks(input),
            ]);
        case 'json':
            return withoutSkips([
                ...runCloudFormationChecks(input),
                ...runAgentConfigChecks({ path: input.path, source: input.source }),
            ]);
        case 'hcl':
            return withoutSkips(runIamServerlessChecks({
                path: input.path,
                source: input.source,
                template: serverlessTemplateFromHcl(parseHcl(input.source)),
            }));
        case 'typescript':
        case 'javascript':
            return runSecurityHeaderChecks(input);
        default:
            return withoutSkips([]);
    }
}

function runCloudFormationChecks(input: ConfigFileChecksInput): PrescanFinding[] {
    const lineCounter = new LineCounter();
    const documents = parseAllDocuments(input.source, { lineCounter, keepSourceTokens: true });
    return documents.flatMap((document) => {
        const rootMap = asMap(document.contents as YamlNode | null);
        const template = rootMap ? serverlessTemplateFromCfn(rootMap, lineCounter) : null;
        return template ? runIamServerlessChecks({ path: input.path, source: input.source, template }) : [];
    });
}

function withoutSkips(findings: PrescanFinding[]): ConfigFileChecksResult {
    return { findings, skippedChecks: [] };
}
