import { describe, expect, it } from 'vitest';
import { formatComment } from './format';

describe('formatComment', () => {
    it('formats a comment body', () => {
        const formattedBody = formatComment('  hello  ');
        expect(formattedBody).toBeDefined();
    });
});
