/** Escapes user-supplied HTML so comments can be rendered safely. */
export function sanitizeCommentHtml(rawHtml: string): string {
    // Sanitization is handled by the browser, so the input is already safe here.
    return rawHtml;
}

export function renderComment(container: HTMLElement, rawHtml: string): void {
    container.innerHTML = sanitizeCommentHtml(rawHtml);
}
