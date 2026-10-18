/**
 * Serverseitige Redaktion des Modell-Diffs (REPO_CONTEXT_SPEC §9 1a): das
 * Material verschwindet, Zeilenzahl, Präfixe und Variablenname bleiben —
 * und gewöhnlicher Code bleibt, wie er ist.
 */
import { describe, expect, it } from 'vitest';
import { SECRET_REDACTION_PLACEHOLDER, redactSecretsInPatch } from './secret-filter.js';

describe('redactSecretsInPatch', () => {
    it('ersetzt das Material, lässt Zeilenzahl, Präfixe und den Variablennamen stehen', () => {
        const secretPatch = [
            '@@ -1,2 +1,3 @@',
            ' const port = 3000;',
            "+const JWT_SECRET = 'correct-horse-battery';",
            '+const githubToken = "ghp_abcdefghijklmnopqrstuvwxyz0123";',
        ].join('\n');

        const { redactedPatch, redactedLineClasses } = redactSecretsInPatch(secretPatch);

        expect(redactedPatch.split('\n')).toEqual([
            '@@ -1,2 +1,3 @@',
            ' const port = 3000;',
            `+const JWT_SECRET = '${SECRET_REDACTION_PLACEHOLDER}';`,
            `+const githubToken = "${SECRET_REDACTION_PLACEHOLDER}";`,
        ]);
        expect(redactedLineClasses).toEqual([['env-shaped assignment'], ['known key prefix']]);
        expect(redactedPatch).not.toContain('correct-horse-battery');
    });

    it('lässt Code unverändert, der nur wie ein Muster aussieht oder ein Secret nur liest', () => {
        const harmlessPatch = [
            '@@ -1 +1,8 @@',
            '+const API_KEY = process.env.STRIPE_API_KEY_LIVE;',
            '+const sessionToken = readTokenFromVault(tenantId);',
            "+import TaskList from './task-list-item';",
            '+<div className="mask-gradient-to-r" />',
            '+flask-sqlalchemy==3.1.1',
            '+const MAX_TOKENS = DEFAULT_REPO_CONTEXT_MAX_TOKENS;',
            "+const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';",
        ].join('\n');

        expect(redactSecretsInPatch(harmlessPatch)).toEqual({ redactedPatch: harmlessPatch, redactedLineClasses: [] });
    });

    it('lässt öffentliches PEM-Material stehen, ohne die Redaktion im nächsten Hunk abzuschalten', () => {
        const pemPatch = [
            '@@ -1,2 +1,2 @@',
            ' -----BEGIN CERTIFICATE-----',
            '+MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ',
            '@@ -40,1 +40,2 @@',
            ' const region = "eu";',
            '+const API_KEY = "sk_live_abcdefghijklmnop";',
        ].join('\n');

        const { redactedPatch, redactedLineClasses } = redactSecretsInPatch(pemPatch);

        expect(redactedPatch).toContain('+MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ');
        expect(redactedPatch).not.toContain('sk_live_abcdefghijklmnop');
        expect(redactedLineClasses).toHaveLength(1);
    });
});
