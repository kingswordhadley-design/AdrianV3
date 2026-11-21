// Mini serveur HTTP requis par Render (web service) + keep-alive + page d'état
const http = require('http');
const axios = require('axios');

const state = {
    status: 'starting',       // starting | waiting_pairing | connected | disconnected
    pairingCode: null,
    startedAt: Date.now(),
    number: null,
};

const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function page() {
    const uptime = Math.floor((Date.now() - state.startedAt) / 1000);
    const label = {
        starting: '⏳ Démarrage…',
        waiting_pairing: '🔗 En attente du jumelage',
        connected: '✅ Connecté',
        disconnected: '🔴 Déconnecté — reconnexion…',
    }[state.status] || state.status;
    const pairing = state.pairingCode
        ? `<p>Code de jumelage :</p><div class="code">${esc(state.pairingCode)}</div>
           <p class="sm">WhatsApp → Appareils connectés → Connecter un appareil → <b>Connecter avec le numéro de téléphone</b></p>`
        : '';
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="20">
<title>ADRIAN MD</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:#e8e8ee;font-family:system-ui,sans-serif}
.card{max-width:420px;margin:16px;padding:28px;border:1px solid #2a2a38;border-radius:16px;background:#12121a;text-align:center}
h1{margin:0 0 6px;letter-spacing:.12em}.sm{color:#8a8a9a;font-size:13px}
.code{font:700 34px ui-monospace,monospace;letter-spacing:.2em;margin:12px 0;color:#c9b3ff}
</style></head><body><div class="card"><h1>ADRIAN MD</h1>
<p>${label}</p>${pairing}
<p class="sm">${state.number ? 'Numéro : +' + esc(state.number) + ' · ' : ''}Uptime : ${Math.floor(uptime / 3600)}h ${Math.floor(uptime % 3600 / 60)}m</p>
</div></body></html>`;
}

function start() {
    const port = process.env.PORT || 3000;
    http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('ok');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page());
    }).listen(port, '0.0.0.0', () => console.log(`🌐 Serveur web sur le port ${port}`));

    // Keep-alive : Render (offre gratuite) endort le service après ~15 min sans trafic entrant
    const url = process.env.RENDER_EXTERNAL_URL || process.env.KEEPALIVE_URL;
    if (url) {
        setInterval(() => {
            axios.get(url.replace(/\/$/, '') + '/health', { timeout: 15000 }).catch(() => { });
        }, 8 * 60 * 1000);
        console.log('♻️  Keep-alive actif →', url);
    }
}

module.exports = { start, state };
