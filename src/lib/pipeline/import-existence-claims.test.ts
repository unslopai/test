/**
 * Unit Tests: HAL-002 auf Import-Zeilen endet als WARNING
 * (LANGUAGE_COVERAGE_SPEC §6.5, Variante a). Der Auslöser war ein falsches
 * CRITICAL auf einem Spring-Boot-4-Import (Job `9f8dccf4`).
 */
import { describe, expect, it } from 'vitest';
import { downgradeImportExistenceClaim } from '@/lib/pipeline/import-existence-claims';
import { buildReviewIssue } from '@/lib/pipeline/testing/context-fixture';

const HAL_002_RULE = 'HAL-002 (Hallucinated API)';

describe('downgradeImportExistenceClaim', () => {
    it('downgrades the Spring Boot 4 import claim from the Java shadow run to WARNING', () => {
        const importClaim = buildReviewIssue({
            rule: HAL_002_RULE,
            severity: 'CRITICAL',
            path: 'src/test/java/org/springframework/samples/petclinic/PetClinicConcurrencyTests.java',
            exactQuote: 'import org.springframework.boot.restclient.RestTemplateBuilder;',
            critique: 'The package does not exist.',
        });

        const downgradedClaim = downgradeImportExistenceClaim(importClaim);

        expect(downgradedClaim.severity).toBe('WARNING');
        expect(downgradedClaim.critique).toContain('The package does not exist.');
        expect(downgradedClaim.critique).toContain('depends on the dependency version');
    });

    it.each([
        ['src/lib/client.ts', "import { createClient } from '@acme/sdk/v9';"],
        ['src/lib/legacy.cjs', "const sdkClient = require('@acme/sdk/v9');"],
        ['services/report_job.py', 'from acme_sdk.v9 import ReportClient'],
        ['internal/handles/display_handle.go', '"golang.org/x/exp/slices"'],
        ['src/net/session.c', '#include <acme/session_v9.h>'],
        ['scripts/deploy/prepare-host.ps1', 'Import-Module Acme.Deployment'],
        ['src/lib/client.ts', "import {\n    createClient,\n    retryPolicy,\n} from '@acme/sdk/v9';"],
        ['src/lib/client.ts', "} from '@acme/sdk/v9';"],
        ['src/lib/lazy.ts', "const sdkModule = await import('@acme/sdk/v9');"],
        ['services/report_job.py', 'from acme_sdk.v9 import (\n    ReportClient,\n    RetryPolicy,\n)'],
        ['internal/handles/display_handle.go', 'import (\n\t"fmt"\n\tslices "golang.org/x/exp/slices" // experimental\n)'],
        ['src/Billing/Ledger.cs', 'using Ledger = Acme.Billing.V9.Ledger;'],
        ['src/codec/frame.rs', 'pub(crate) use acme_codec::v9::Frame;'],
        ['src/lib/client.ts', "+import { createClient } from '@acme/sdk/v9';"],
    ])('treats an import line in %s as a claim about a package', (filePath, importLine) => {
        const importClaim = buildReviewIssue({ rule: HAL_002_RULE, severity: 'CRITICAL', path: filePath, exactQuote: importLine });

        expect(downgradeImportExistenceClaim(importClaim).severity).toBe('WARNING');
    });

    it('keeps HAL-002 on an API call CRITICAL', () => {
        const callClaim = buildReviewIssue({
            rule: HAL_002_RULE,
            severity: 'CRITICAL',
            path: 'internal/handles/display_handle.go',
            exactQuote: 'return "@" + strings.ToLowerCase(trimmedHandle)',
        });

        expect(downgradeImportExistenceClaim(callClaim)).toBe(callClaim);
    });

    it.each([
        ['src/lib/lazy.ts', "import('left-pad-pro').then((padModule) => padModule.padFake('x'))"],
        ['src/lib/lazy.ts', "import.meta.resolveFake('./x')"],
        ['services/report_job.py', 'import secrets; session_token = secrets.token_base58(32)'],
        ['scripts/deploy/prepare-host.ps1', 'Import-Module Acme; Invoke-AcmeFake -Level 1'],
        ['src/lib/legacy.cjs', "const first = registry.fake(), second = require('@acme/sdk');"],
        ['internal/handles/display_handle.go', 'return "handle"'],
    ])('keeps a line in %s that also calls something CRITICAL', (filePath, quotedLine) => {
        const callClaim = buildReviewIssue({ rule: HAL_002_RULE, severity: 'CRITICAL', path: filePath, exactQuote: quotedLine });

        expect(downgradeImportExistenceClaim(callClaim)).toBe(callClaim);
    });

    it('keeps a quote that mixes an import with a call CRITICAL', () => {
        const mixedClaim = buildReviewIssue({
            rule: HAL_002_RULE,
            severity: 'CRITICAL',
            path: 'services/report_job.py',
            exactQuote: 'import secrets\nsession_token = secrets.token_base58(32)',
        });

        expect(downgradeImportExistenceClaim(mixedClaim)).toBe(mixedClaim);
    });

    it('leaves other rules on an import line untouched', () => {
        const registryClaim = buildReviewIssue({
            rule: 'SEC-035 (Package does not exist on its registry)',
            severity: 'CRITICAL',
            path: 'src/lib/client.ts',
            exactQuote: "import { createClient } from 'acme-sdk-pro';",
        });

        expect(downgradeImportExistenceClaim(registryClaim)).toBe(registryClaim);
    });
});
