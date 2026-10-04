/**
 * `unslop login` — browser-based authorization.
 *
 * Flow: temporary HTTP server on 127.0.0.1 (random port) →
 * browser opens /dashboard/settings/cli-auth?port&state&label →
 * user clicks "Authorize" → the page redirects with the fresh key to the
 * local callback → CLI validates the state nonce and stores the key.
 *
 * Flags:
 *   --dev      backend = http://localhost:3000 (instead of production)
 *   --manual   classic key entry via prompt (fallback, e.g. SSH sessions)
 */
import * as http from 'node:http';
import * as os from 'node:os';
import { randomBytes } from 'node:crypto';
import * as readline from 'node:readline/promises';
import { saveConfig, DEFAULT_BASE_URL } from '@unslop/shared/node';
import { openBrowser, green, dim, bold } from './ui.js';

const CALLBACK_TIMEOUT_MS = 180_000;

export async function runLogin(loginArgs: readonly string[]): Promise<number> {
    const useDevBackend = loginArgs.includes('--dev');
    const useManualEntry = loginArgs.includes('--manual');

    const baseUrl = useDevBackend
        ? 'http://localhost:3000'
        : (process.env.UNSLOP_BASE_URL ?? DEFAULT_BASE_URL);

    if (useManualEntry) {
        return runManualLogin(baseUrl, useDevBackend);
    }

    const stateNonce = randomBytes(24).toString('base64url');
    const keyLabel = `cli-${os.hostname()}`.substring(0, 60);

    const receivedKey = await receiveKeyViaCallback(stateNonce, (callbackPort) => {
        const authorizeUrl = new URL(`${baseUrl}/dashboard/settings/cli-auth`);
        authorizeUrl.searchParams.set('port', String(callbackPort));
        authorizeUrl.searchParams.set('state', stateNonce);
        authorizeUrl.searchParams.set('label', keyLabel);

        console.error(`Opening your browser to authorize this machine (${dim(keyLabel)})…`);
        console.error(dim(`If the browser does not open, visit:\n  ${authorizeUrl.toString()}`));
        openBrowser(authorizeUrl.toString());
    });

    if (!receivedKey) {
        console.error('Authorization timed out or failed. Try again, or use `unslop login --manual`.');
        return 2;
    }

    const configPath = saveConfig(receivedKey, useDevBackend ? baseUrl : null);
    console.error(green('✔ CLI authorized.') + dim(` Key saved to ${configPath}`));
    console.error(
        `\nNext step: navigate to a git repository and run ${bold('unslop scan')}, ` +
        `or run ${bold('unslop help')} to see all commands.`,
    );
    return 0;
}

/**
 * Starts the local callback server and waits for the key.
 * Returns null on timeout or state mismatch.
 */
function receiveKeyViaCallback(
    expectedState: string,
    onServerReady: (callbackPort: number) => void,
): Promise<string | null> {
    return new Promise((resolve) => {
        let settled = false;
        const settle = (result: string | null): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutHandle);
            callbackServer.close();
            resolve(result);
        };

        const callbackServer = http.createServer((incoming, response) => {
            const requestUrl = new URL(incoming.url ?? '/', 'http://127.0.0.1');
            if (requestUrl.pathname !== '/cli-auth-callback') {
                response.writeHead(404).end();
                return;
            }

            const presentedState = requestUrl.searchParams.get('state');
            const presentedKey = requestUrl.searchParams.get('key');

            if (presentedState !== expectedState || !presentedKey?.startsWith('usk_')) {
                response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                response.end(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Auth Failed</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');body{margin:0;background-color:#09090b;color:#fafafa;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;position:relative;}.container{text-align:center;z-index:10;background:rgba(24,24,27,0.4);backdrop-filter:blur(12px);padding:40px;border-radius:16px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 40px rgba(0,0,0,0.5);}h3{margin:0 0 8px 0;font-size:24px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;}p{margin:0;color:#a1a1aa;font-size:15px;}.icon{color:#ef4444;font-size:28px;}</style></head><body><div class="container"><h3><span class="icon">✘</span> Authorization failed</h3><p>State mismatch. Please try running unslop login again.</p></div></body></html>`);
                settle(null);
                return;
            }

            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>CLI Authorized</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');body{margin:0;background-color:#000;color:#fafafa;font-family:'Inter',sans-serif;height:100vh;overflow:hidden;}canvas{position:absolute;top:0;left:0;width:100vw;height:100vh;z-index:1;}.container{position:relative;z-index:10;text-align:center;background:rgba(15,15,20,0.6);backdrop-filter:blur(16px);padding:40px;border-radius:16px;border:1px solid rgba(255,255,255,0.05);box-shadow:0 0 80px rgba(16,185,129,0.2);animation:fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;top:50%;left:50%;transform:translate(-50%, -50%);width:fit-content;}h3{margin:0 0 12px 0;font-size:28px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;}p{margin:0;color:#a1a1aa;font-size:16px;}.icon{color:#10b981;font-size:32px;text-shadow:0 0 20px rgba(16,185,129,0.5);}@keyframes fadeIn{from{opacity:0;transform:translate(-50%, -40%);}to{opacity:1;transform:translate(-50%, -50%);}}</style></head><body><canvas id="canvas"></canvas><div class="container"><h3><span class="icon">✔</span> Gatekeeper CLI Authorized</h3><p>Your machine is secured. You can return to your terminal.</p></div><script>const canvas=document.getElementById('canvas');const ctx=canvas.getContext('2d');let w=canvas.width=window.innerWidth;let h=canvas.height=window.innerHeight;let particles=[];let mouse={x:w/2,y:h/2};window.addEventListener('resize',()=>{w=canvas.width=window.innerWidth;h=canvas.height=window.innerHeight;});window.addEventListener('mousemove',(e)=>{mouse.x=e.clientX;mouse.y=e.clientY;});class Particle{constructor(){this.x=Math.random()*w;this.y=Math.random()*h;this.vx=(Math.random()-0.5)*1.5;this.vy=(Math.random()-0.5)*1.5;this.baseSize=Math.random()*2+1;}update(){let dx=mouse.x-this.x;let dy=mouse.y-this.y;let dist=Math.sqrt(dx*dx+dy*dy);if(dist<150){this.x-=(dx/dist)*2;this.y-=(dy/dist)*2;}this.x+=this.vx;this.y+=this.vy;if(this.x<0||this.x>w)this.vx*=-1;if(this.y<0||this.y>h)this.vy*=-1;}draw(){ctx.fillStyle='rgba(16, 185, 129, 0.5)';ctx.beginPath();ctx.arc(this.x,this.y,this.baseSize,0,Math.PI*2);ctx.fill();}}for(let i=0;i<100;i++)particles.push(new Particle());function animate(){ctx.fillStyle='rgba(0, 0, 0, 0.2)';ctx.fillRect(0,0,w,h);for(let i=0;i<particles.length;i++){particles[i].update();particles[i].draw();for(let j=i;j<particles.length;j++){let dx=particles[i].x-particles[j].x;let dy=particles[i].y-particles[j].y;let dist=Math.sqrt(dx*dx+dy*dy);if(dist<100){ctx.beginPath();ctx.strokeStyle=\`rgba(16, 185, 129, \${1-dist/100})\`;ctx.lineWidth=0.5;ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.stroke();}}}requestAnimationFrame(animate);}animate();</script></body></html>`);
            settle(presentedKey);
        });

        const timeoutHandle = setTimeout(() => settle(null), CALLBACK_TIMEOUT_MS);

        // Loopback only — the key must never leave the machine.
        callbackServer.listen(0, '127.0.0.1', () => {
            const boundAddress = callbackServer.address();
            if (boundAddress === null || typeof boundAddress === 'string') {
                settle(null);
                return;
            }
            onServerReady(boundAddress.port);
        });
    });
}

/** Fallback: classic manual key entry (e.g. remote/SSH sessions). */
async function runManualLogin(baseUrl: string, storeBaseUrl: boolean): Promise<number> {
    const promptInterface = readline.createInterface({ input: process.stdin, output: process.stderr });
    try {
        console.error(`Create a key at ${bold(`${baseUrl}/dashboard/settings/keys`)} and paste it below.`);
        const apiKey = (await promptInterface.question('API key (usk_…): ')).trim();
        if (!apiKey.startsWith('usk_')) {
            console.error('That does not look like a Gatekeeper API key (expected usk_ prefix).');
            return 2;
        }
        const configPath = saveConfig(apiKey, storeBaseUrl ? baseUrl : null);
        console.error(green('✔ Saved.') + dim(` (${configPath})`));
        return 0;
    } finally {
        promptInterface.close();
    }
}
