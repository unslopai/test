// Shared helpers for channel stills. ansiToHtml renders the REAL CLI output captured in _kit/cli/*.ansi
// (colours = the terminal palette used in film 03: red CRITICAL, amber WARNING, lime OK, dim grey).
window.ready = false;
const ANSI = { '1': 'color:#fafafa;font-weight:500', '2': 'color:#71717a', '31': 'color:#f87171', '32': 'color:#bef264', '33': 'color:#fcd34d', '36': 'color:#7dd3fc' };
function escapeHtml(text) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function ansiToHtml(raw) {
  let html = '', open = 0;
  for (const part of raw.split(/(\u001b\[\d+m)/)) {
    const code = /^\u001b\[(\d+)m$/.exec(part);
    // keep CLI flags such as --fix on one line (text unchanged, only the wrap point moves)
    if (!code) { html += escapeHtml(part).replace(/(\S*--[\w-]+)/g, '<span style="white-space:nowrap">$1</span>'); continue; }
    if (code[1] === '0') { html += '</span>'.repeat(open); open = 0; continue; }
    html += `<span style="${ANSI[code[1]] || ''}">`; open += 1;
  }
  return html + '</span>'.repeat(open);
}
async function fillTerminals() {
  for (const el of document.querySelectorAll('[data-ansi]')) {
    const raw = await (await fetch(el.dataset.ansi)).text();
    el.innerHTML = (el.dataset.prefix || '') + ansiToHtml(raw);
  }
}
window.addEventListener('load', async () => { await document.fonts.ready; await fillTerminals(); window.ready = true; });
