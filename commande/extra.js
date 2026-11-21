/**
 * ADRIAN MD — Commandes supplémentaires (v3.1)
 * Registre de commandes : chaque commande déclare son nom, ses alias, sa catégorie
 * et ses permissions. Le menu (.menu) est généré automatiquement depuis ce registre.
 *
 * Toutes les API utilisées sont publiques et sans clé.
 */
const axios = require('axios');
const crypto = require('crypto');
const os = require('os');
const settings = require('../settings');

const HTTP = axios.create({ timeout: 15000, headers: { 'User-Agent': 'ADRIAN-MD/3.1' } });

/* ───────────────────────── Registre ───────────────────────── */
const registry = {};   // nom/alias -> entrée
const entries = [];    // liste ordonnée (pour le menu)

function def(names, meta, run) {
    const list = [].concat(names);
    const entry = { name: list[0], aliases: list.slice(1), ...meta, run };
    entries.push(entry);
    for (const n of list) registry[n] = entry;
}

/* ───────────────────────── Helpers ───────────────────────── */
const box = (title, lines) =>
    `╭━━━〔 ${title} 〕━━━╮\n${lines.filter(l => l !== null && l !== undefined).map(l => `┃ ${l}`).join('\n')}\n╰━━━━━━━━━━━━━━━━━━━╯`;

const fmtNum = (n, d = 2) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const pick = (arr) => arr[crypto.randomInt(arr.length)];

function getContext(message) {
    const m = message.message || {};
    for (const k of Object.keys(m)) {
        if (m[k] && typeof m[k] === 'object' && m[k].contextInfo) return m[k].contextInfo;
    }
    return {};
}

/** Cible d'une commande : mention > réponse > numéro écrit dans le texte */
function getTarget(message, text = '') {
    const ctx = getContext(message);
    if (ctx.mentionedJid && ctx.mentionedJid.length) return ctx.mentionedJid[0];
    if (ctx.participant) return ctx.participant;
    const num = String(text).replace(/[^0-9]/g, '');
    if (num.length >= 7 && num.length <= 15) return num + '@s.whatsapp.net';
    return null;
}

const numOf = (jid) => String(jid || '').split('@')[0].split(':')[0];

/* ───────────────────────── UTILITAIRES ───────────────────────── */

// Calculatrice sécurisée (aucun eval)
function safeCalc(expr) {
    const src = String(expr).toLowerCase()
        .replace(/×/g, '*').replace(/÷/g, '/').replace(/\*\*/g, '^')
        .replace(/,/g, '.').replace(/\s+/g, '');
    if (!src || src.length > 200) throw new Error('Expression invalide');
    let i = 0;
    const fns = { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil };
    const consts = { pi: Math.PI, e: Math.E };
    const peek = () => src[i];
    function expr_() {
        let v = term();
        while (peek() === '+' || peek() === '-') { const op = src[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
        return v;
    }
    function term() {
        let v = unary();
        while (peek() === '*' || peek() === '/' || peek() === '%') {
            const op = src[i++]; const r = unary();
            v = op === '*' ? v * r : op === '/' ? v / r : v % r;
        }
        return v;
    }
    function unary() {
        if (peek() === '-') { i++; return -unary(); }
        if (peek() === '+') { i++; return unary(); }
        return power();
    }
    function power() {
        const b = primary();
        if (peek() === '^') { i++; return Math.pow(b, unary()); }
        return b;
    }
    function primary() {
        if (peek() === '(') {
            i++; const v = expr_();
            if (peek() !== ')') throw new Error('Parenthèse manquante');
            i++; return v;
        }
        const rest = src.slice(i);
        let m = rest.match(/^(\d+\.?\d*|\.\d+)/);
        if (m) { i += m[0].length; return parseFloat(m[0]); }
        m = rest.match(/^[a-z]+/);
        if (m) {
            const name = m[0]; i += name.length;
            if (name in consts) return consts[name];
            if (name in fns) {
                if (peek() !== '(') throw new Error('Fonction sans parenthèses');
                i++; const v = expr_();
                if (peek() !== ')') throw new Error('Parenthèse manquante');
                i++; return fns[name](v);
            }
        }
        throw new Error('Expression invalide');
    }
    const result = expr_();
    if (i !== src.length || !Number.isFinite(result)) throw new Error('Expression invalide');
    return result;
}

def('calc', { cat: 'Utilitaires', usage: '.calc <opération>', desc: 'Calculatrice' }, async ({ reply, text }) => {
    if (!text) return reply('🧮 Exemple : *.calc (12+8)*3/2*  — fonctions : sqrt, abs, sin, cos, tan, log, ln, round, floor, ceil, pi, e');
    try {
        const r = safeCalc(text);
        await reply(box('CALCUL', [`${text}`, `= *${Number(r.toFixed(10))}*`]));
    } catch (e) { await reply('❌ ' + e.message); }
});

const CITY_TZ = {
    paris: 'Europe/Paris', france: 'Europe/Paris', londres: 'Europe/London', london: 'Europe/London', bruxelles: 'Europe/Brussels',
    madrid: 'Europe/Madrid', rome: 'Europe/Rome', berlin: 'Europe/Berlin', moscou: 'Europe/Moscow', istanbul: 'Europe/Istanbul',
    dakar: 'Africa/Dakar', senegal: 'Africa/Dakar', abidjan: 'Africa/Abidjan', lagos: 'Africa/Lagos', kinshasa: 'Africa/Kinshasa',
    brazzaville: 'Africa/Brazzaville', douala: 'Africa/Douala', casablanca: 'Africa/Casablanca', alger: 'Africa/Algiers', tunis: 'Africa/Tunis',
    caire: 'Africa/Cairo', cairo: 'Africa/Cairo', nairobi: 'Africa/Nairobi', johannesburg: 'Africa/Johannesburg',
    haiti: 'America/Port-au-Prince', 'port-au-prince': 'America/Port-au-Prince', montreal: 'America/Toronto', toronto: 'America/Toronto',
    newyork: 'America/New_York', 'new-york': 'America/New_York', miami: 'America/New_York', chicago: 'America/Chicago',
    'los-angeles': 'America/Los_Angeles', losangeles: 'America/Los_Angeles', mexico: 'America/Mexico_City', 'sao-paulo': 'America/Sao_Paulo',
    dubai: 'Asia/Dubai', tokyo: 'Asia/Tokyo', japon: 'Asia/Tokyo', seoul: 'Asia/Seoul', pekin: 'Asia/Shanghai', beijing: 'Asia/Shanghai',
    delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', bangkok: 'Asia/Bangkok', singapour: 'Asia/Singapore', sydney: 'Australia/Sydney',
    utc: 'UTC',
};

def(['time', 'heure'], { cat: 'Utilitaires', usage: '.time [ville]', desc: "Heure dans le monde" }, async ({ reply, text }) => {
    const fmt = (tz) => new Intl.DateTimeFormat('fr-FR', { timeZone: tz, dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    try {
        if (!text) {
            const zones = [['🇭🇹 Haïti', 'America/Port-au-Prince'], ['🇫🇷 Paris', 'Europe/Paris'], ['🇸🇳 Dakar', 'Africa/Dakar'], ['🇺🇸 New York', 'America/New_York'], ['🇯🇵 Tokyo', 'Asia/Tokyo'], ['🌍 UTC', 'UTC']];
            return reply(box('HEURE MONDIALE', zones.map(([n, tz]) => `${n} : ${new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date())}`)));
        }
        const key = text.toLowerCase().replace(/\s+/g, '-');
        const tz = CITY_TZ[key] || CITY_TZ[key.replace(/-/g, '')] || text.trim();
        await reply(box('HEURE', [`📍 ${tz}`, fmt(tz)]));
    } catch (e) {
        await reply('❌ Fuseau inconnu. Essaie une ville (paris, dakar, tokyo…) ou un fuseau IANA (ex: *Africa/Dakar*).');
    }
});

def(['define', 'dico'], { cat: 'Utilitaires', usage: '.define <mot>', desc: 'Définition d\'un mot' }, async ({ reply, text }) => {
    if (!text) return reply('📖 Exemple : *.define liberté*');
    const word = text.trim().split(/\s+/)[0];
    for (const lang of ['fr', 'en']) {
        try {
            const { data } = await HTTP.get(`https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word)}`);
            const e = data[0];
            const lines = [`*${e.word}* ${e.phonetic || ''}`.trim()];
            for (const m of (e.meanings || []).slice(0, 3)) {
                const d = m.definitions?.[0];
                if (d) lines.push(`• _${m.partOfSpeech}_ — ${cut(d.definition, 200)}`);
            }
            return reply(box(`DICO (${lang})`, lines));
        } catch (_) { /* essai suivant */ }
    }
    await reply('❌ Aucune définition trouvée pour *' + word + '*.');
});

def(['wiki', 'wikipedia'], { cat: 'Utilitaires', usage: '.wiki <sujet>', desc: 'Résumé Wikipédia' }, async ({ sock, chatId, message, reply, text }) => {
    if (!text) return reply('📚 Exemple : *.wiki Toussaint Louverture*');
    try {
        const s = await HTTP.get('https://fr.wikipedia.org/w/api.php', { params: { action: 'opensearch', search: text, limit: 1, format: 'json', origin: '*' } });
        const title = s.data?.[1]?.[0];
        if (!title) return reply('❌ Aucun article trouvé.');
        const { data } = await HTTP.get(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        const caption = `📚 *${data.title}*\n\n${cut(data.extract || '', 900)}\n\n🔗 ${data.content_urls?.desktop?.page || ''}`;
        const img = data.thumbnail?.source;
        if (img) await sock.sendMessage(chatId, { image: { url: img }, caption }, { quoted: message });
        else await reply(caption);
    } catch (e) { await reply('❌ Erreur Wikipédia, réessaie plus tard.'); }
});

const COIN_IDS = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', xrp: 'ripple', doge: 'dogecoin', ada: 'cardano', ltc: 'litecoin', usdt: 'tether', trx: 'tron', ton: 'the-open-network', dot: 'polkadot', matic: 'matic-network', shib: 'shiba-inu' };
def(['crypto', 'coin'], { cat: 'Utilitaires', usage: '.crypto <btc|eth|...>', desc: 'Prix d\'une crypto' }, async ({ reply, text }) => {
    const q = (text || 'btc').trim().toLowerCase();
    const id = COIN_IDS[q] || q;
    try {
        const { data } = await HTTP.get('https://api.coingecko.com/api/v3/simple/price', { params: { ids: id, vs_currencies: 'usd,eur', include_24hr_change: true, include_market_cap: true } });
        const d = data[id];
        if (!d) return reply('❌ Crypto inconnue. Essaie le nom complet (ex: *bitcoin*) ou le symbole (btc, eth, sol…).');
        const ch = d.usd_24h_change || 0;
        await reply(box(`💰 ${id.toUpperCase()}`, [
            `💵 USD : *$${fmtNum(d.usd, 6)}*`, `💶 EUR : *€${fmtNum(d.eur, 6)}*`,
            `${ch >= 0 ? '📈' : '📉'} 24h : ${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`,
            d.usd_market_cap ? `🏦 Cap : $${fmtNum(d.usd_market_cap, 0)}` : null,
        ]));
    } catch (e) { await reply('❌ API crypto indisponible (limite atteinte ?). Réessaie dans une minute.'); }
});

def(['convert', 'currency', 'devise'], { cat: 'Utilitaires', usage: '.convert 100 usd eur', desc: 'Convertisseur de devises' }, async ({ reply, args }) => {
    const amount = parseFloat(String(args[0] || '').replace(',', '.'));
    const from = (args[1] || '').toUpperCase();
    const to = (args[2] || '').toUpperCase();
    if (!amount || !from || !to) return reply('💱 Exemple : *.convert 100 usd eur*  (aussi htg, xof, cad, gbp…)');
    try {
        const { data } = await HTTP.get(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
        const rate = data?.rates?.[to];
        if (data?.result !== 'success' || !rate) return reply('❌ Devise inconnue.');
        await reply(box('CONVERSION', [`${fmtNum(amount)} ${from}`, `= *${fmtNum(amount * rate)} ${to}*`, `Taux : 1 ${from} = ${fmtNum(rate, 6)} ${to}`]));
    } catch (e) { await reply('❌ Devise inconnue ou service indisponible.'); }
});

def(['country', 'pays'], { cat: 'Utilitaires', usage: '.country <pays>', desc: 'Infos sur un pays' }, async ({ sock, chatId, message, reply, text }) => {
    if (!text) return reply('🌍 Exemple : *.country haiti*');
    try {
        const { data } = await HTTP.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(text)}`, { params: { fields: 'name,capital,population,region,subregion,languages,currencies,flags,cca2,timezones,translations' } });
        const c = data[0];
        const cur = Object.values(c.currencies || {}).map(x => `${x.name} (${x.symbol || ''})`).join(', ');
        const caption = box(`${c.translations?.fra?.common || c.name.common}`, [
            `🏛️ Capitale : ${(c.capital || ['—']).join(', ')}`, `👥 Population : ${fmtNum(c.population, 0)}`,
            `🧭 Région : ${c.region}${c.subregion ? ' / ' + c.subregion : ''}`, `🗣️ Langues : ${Object.values(c.languages || {}).join(', ') || '—'}`,
            `💱 Monnaie : ${cur || '—'}`, `🕒 Fuseau : ${(c.timezones || [])[0] || '—'}`,
        ]);
        if (c.flags?.png) await sock.sendMessage(chatId, { image: { url: c.flags.png }, caption }, { quoted: message });
        else await reply(caption);
    } catch (e) { await reply('❌ Pays introuvable (essaie le nom en anglais).'); }
});

def('qr', { cat: 'Utilitaires', usage: '.qr <texte/lien>', desc: 'Génère un QR code' }, async ({ sock, chatId, message, reply, text }) => {
    if (!text) return reply('▦ Exemple : *.qr https://exemple.com*');
    await sock.sendMessage(chatId, { image: { url: `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=${encodeURIComponent(text)}` }, caption: '✅ QR code généré' }, { quoted: message });
});

def(['password', 'mdp'], { cat: 'Utilitaires', usage: '.password [longueur]', desc: 'Mot de passe fort' }, async ({ reply, args }) => {
    const len = Math.min(Math.max(parseInt(args[0]) || 16, 8), 64);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
    let pwd = '';
    for (let i = 0; i < len; i++) pwd += chars[crypto.randomInt(chars.length)];
    await reply(box('MOT DE PASSE', [`\`${pwd}\``, `Longueur : ${len}`]));
});

def(['shorten', 'tinyurl'], { cat: 'Utilitaires', usage: '.shorten <lien>', desc: 'Raccourcit un lien' }, async ({ reply, text }) => {
    if (!/^https?:\/\//i.test(text || '')) return reply('🔗 Exemple : *.shorten https://site.com/un/tres/long/lien*');
    try {
        const { data } = await HTTP.get('https://tinyurl.com/api-create.php', { params: { url: text.trim() } });
        await reply('✅ ' + String(data).trim());
    } catch (e) { await reply('❌ Impossible de raccourcir ce lien.'); }
});

def('ip', { cat: 'Utilitaires', usage: '.ip <ip/domaine>', desc: 'Informations sur une IP' }, async ({ reply, text }) => {
    if (!text) return reply('🌐 Exemple : *.ip 8.8.8.8*');
    try {
        const { data } = await HTTP.get(`https://ipwho.is/${encodeURIComponent(text.trim())}`);
        if (!data.success) return reply('❌ ' + (data.message || 'IP invalide'));
        await reply(box('IP', [`🌐 ${data.ip} (${data.type})`, `📍 ${data.city}, ${data.region}, ${data.country} ${data.flag?.emoji || ''}`, `🏢 ${data.connection?.isp || data.connection?.org || '—'}`, `🕒 ${data.timezone?.id || '—'}`]));
    } catch (e) { await reply('❌ Service indisponible.'); }
});

def('npm', { cat: 'Utilitaires', usage: '.npm <package>', desc: 'Infos sur un package npm' }, async ({ reply, text }) => {
    if (!text) return reply('📦 Exemple : *.npm axios*');
    try {
        const { data } = await HTTP.get(`https://registry.npmjs.org/${encodeURIComponent(text.trim().toLowerCase()).replace('%40', '@')}/latest`);
        await reply(box(`NPM · ${data.name}`, [`🏷️ v${data.version}`, `📝 ${cut(data.description || '—', 150)}`, `📜 Licence : ${data.license || '—'}`, `🔗 https://www.npmjs.com/package/${data.name}`]));
    } catch (e) { await reply('❌ Package introuvable.'); }
});

def(['base64', 'b64'], { cat: 'Utilitaires', usage: '.base64 enc|dec <texte>', desc: 'Encode / décode en Base64' }, async ({ reply, args, text }) => {
    const mode = (args[0] || '').toLowerCase();
    const payload = text.slice(args[0]?.length || 0).trim();
    if (!['enc', 'encode', 'dec', 'decode'].includes(mode) || !payload) return reply('🔐 Exemple : *.base64 enc bonjour*  ou  *.base64 dec Ym9uam91cg==*');
    try {
        const out = mode.startsWith('enc') ? Buffer.from(payload).toString('base64') : Buffer.from(payload, 'base64').toString('utf8');
        await reply(out || '❌ Résultat vide');
    } catch (e) { await reply('❌ Base64 invalide.'); }
});

const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.' };
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
def('morse', { cat: 'Utilitaires', usage: '.morse <texte|code>', desc: 'Texte ⇄ Morse' }, async ({ reply, text }) => {
    if (!text) return reply('📡 Exemple : *.morse sos*  ou  *.morse ... --- ...*');
    const isMorse = /^[.\-/\s]+$/.test(text);
    const out = isMorse
        ? text.trim().split(/\s{2,}|\//).map(w => w.trim().split(/\s+/).map(c => MORSE_REV[c] || '?').join('')).join(' ')
        : text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split('').map(c => c === ' ' ? '/' : (MORSE[c] || '')).filter(Boolean).join(' ');
    await reply(out || '❌ Rien à convertir.');
});

def('reverse', { cat: 'Utilitaires', usage: '.reverse <texte>', desc: 'Inverse un texte' }, async ({ reply, text }) => {
    if (!text) return reply('🔁 Exemple : *.reverse bonjour*');
    await reply([...text].reverse().join(''));
});

def('mock', { cat: 'Utilitaires', usage: '.mock <texte>', desc: 'tExTe EnN MoCkErIe' }, async ({ reply, text }) => {
    if (!text) return reply('🤪 Exemple : *.mock tu es trop fort*');
    let i = 0;
    await reply([...text].map(c => /[a-zà-ÿ]/i.test(c) ? (i++ % 2 ? c.toUpperCase() : c.toLowerCase()) : c).join(''));
});

// Polices stylées (plages Unicode)
const mapRange = (text, up, low, dig) => [...text].map(ch => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(up + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(low + c - 97);
    if (dig && c >= 48 && c <= 57) return String.fromCodePoint(dig + c - 48);
    return ch;
}).join('');
const SMALLCAPS = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
const FANCY_STYLES = [
    ['Gras', t => mapRange(t, 0x1D400, 0x1D41A, 0x1D7CE)],
    ['Gras italique', t => mapRange(t, 0x1D468, 0x1D482)],
    ['Script', t => mapRange(t, 0x1D4D0, 0x1D4EA)],
    ['Gothique', t => mapRange(t, 0x1D56C, 0x1D586)],
    ['Sans gras', t => mapRange(t, 0x1D5D4, 0x1D5EE, 0x1D7EC)],
    ['Monospace', t => mapRange(t, 0x1D670, 0x1D68A, 0x1D7F6)],
    ['Large', t => mapRange(t, 0xFF21, 0xFF41, 0xFF10)],
    ['Rond', t => [...t].map(ch => { const c = ch.codePointAt(0); if (c >= 65 && c <= 90) return String.fromCodePoint(0x24B6 + c - 65); if (c >= 97 && c <= 122) return String.fromCodePoint(0x24D0 + c - 97); if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + c - 49); if (c === 48) return '⓪'; return ch; }).join('')],
    ['Petites capitales', t => [...t.toLowerCase()].map(ch => { const c = ch.charCodeAt(0); return c >= 97 && c <= 122 ? SMALLCAPS[c - 97] : ch; }).join('')],
];
def(['fancy', 'font', 'style'], { cat: 'Utilitaires', usage: '.fancy <texte>', desc: 'Textes stylés (9 polices)' }, async ({ reply, text }) => {
    if (!text) return reply('✨ Exemple : *.fancy Adrian MD*');
    const t = text.slice(0, 60);
    await reply(FANCY_STYLES.map(([n, f]) => `*${n}*\n${f(t)}`).join('\n\n'));
});

/* ───────────────────────── FUN & JEUX ───────────────────────── */
def(['flip', 'pileouface'], { cat: 'Fun', usage: '.flip', desc: 'Pile ou face' }, async ({ reply }) => reply(`🪙 ${pick(['*PILE*', '*FACE*'])} !`));

def(['dice', 'roll', 'de'], { cat: 'Fun', usage: '.dice [faces]', desc: 'Lance un dé' }, async ({ reply, args }) => {
    const n = Math.min(Math.max(parseInt(args[0]) || 6, 2), 1000);
    await reply(`🎲 Dé à ${n} faces : *${crypto.randomInt(1, n + 1)}*`);
});

def(['choose', 'choisir'], { cat: 'Fun', usage: '.choose a | b | c', desc: 'Choisit pour toi' }, async ({ reply, text }) => {
    const opts = (text || '').split(/[|,;]/).map(s => s.trim()).filter(Boolean);
    if (opts.length < 2) return reply('🤔 Exemple : *.choose pizza | burger | sushi*');
    await reply(`🎯 Je choisis : *${pick(opts)}*`);
});

def(['rate', 'note'], { cat: 'Fun', usage: '.rate <truc>', desc: 'Note sur 100' }, async ({ reply, text }) => {
    if (!text) return reply('⭐ Exemple : *.rate mon style*');
    await reply(`⭐ *${cut(text, 60)}* : *${crypto.randomInt(0, 101)}/100*`);
});

def('blague', { cat: 'Fun', usage: '.blague', desc: 'Blague aléatoire' }, async ({ reply }) => {
    const flags = 'nsfw,religious,political,racist,sexist,explicit';
    for (const lang of ['fr', 'en']) {
        try {
            const { data } = await HTTP.get('https://v2.jokeapi.dev/joke/Any', { params: { lang, blacklistFlags: flags } });
            if (data.error) continue;
            return reply(data.type === 'single' ? `😂 ${data.joke}` : `😂 ${data.setup}\n\n👉 ${data.delivery}`);
        } catch (_) { /* suivant */ }
    }
    await reply('❌ Pas de blague pour le moment.');
});

def('cat', { cat: 'Fun', usage: '.cat', desc: 'Photo de chat' }, async ({ sock, chatId, message, reply }) => {
    try {
        const { data } = await HTTP.get('https://api.thecatapi.com/v1/images/search');
        await sock.sendMessage(chatId, { image: { url: data[0].url }, caption: '🐱 Miaou !' }, { quoted: message });
    } catch (e) { await reply('❌ Impossible de récupérer un chat.'); }
});

def('dog', { cat: 'Fun', usage: '.dog', desc: 'Photo de chien' }, async ({ sock, chatId, message, reply }) => {
    try {
        const { data } = await HTTP.get('https://dog.ceo/api/breeds/image/random');
        await sock.sendMessage(chatId, { image: { url: data.message }, caption: '🐶 Ouaf !' }, { quoted: message });
    } catch (e) { await reply('❌ Impossible de récupérer un chien.'); }
});

def('fox', { cat: 'Fun', usage: '.fox', desc: 'Photo de renard' }, async ({ sock, chatId, message, reply }) => {
    try {
        const { data } = await HTTP.get('https://randomfox.ca/floof/');
        await sock.sendMessage(chatId, { image: { url: data.image }, caption: '🦊' }, { quoted: message });
    } catch (e) { await reply('❌ Impossible de récupérer un renard.'); }
});

def('pokemon', { cat: 'Fun', usage: '.pokemon <nom|numéro>', desc: 'Fiche Pokémon' }, async ({ sock, chatId, message, reply, text }) => {
    if (!text) return reply('⚡ Exemple : *.pokemon pikachu*');
    try {
        const { data: p } = await HTTP.get(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(text.trim().toLowerCase())}`);
        const stats = p.stats.map(s => `${s.stat.name}: ${s.base_stat}`).join(' · ');
        const caption = box(`#${p.id} ${p.name.toUpperCase()}`, [
            `🔰 Type : ${p.types.map(t => t.type.name).join(', ')}`, `📏 ${p.height / 10} m · ⚖️ ${p.weight / 10} kg`,
            `✨ Talents : ${p.abilities.map(a => a.ability.name).join(', ')}`, `📊 ${stats}`,
        ]);
        const img = p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default;
        if (img) await sock.sendMessage(chatId, { image: { url: img }, caption }, { quoted: message });
        else await reply(caption);
    } catch (e) { await reply('❌ Pokémon introuvable.'); }
});

def(['meal', 'recette'], { cat: 'Fun', usage: '.meal <plat en anglais>', desc: 'Recette de cuisine' }, async ({ sock, chatId, message, reply, text }) => {
    if (!text) return reply('🍲 Exemple : *.meal chicken*  (nom du plat en anglais)');
    try {
        const { data } = await HTTP.get('https://www.themealdb.com/api/json/v1/1/search.php', { params: { s: text.trim() } });
        const m = data.meals?.[0];
        if (!m) return reply('❌ Recette introuvable.');
        const ing = [];
        for (let i = 1; i <= 20; i++) if (m['strIngredient' + i]) ing.push(`${m['strMeasure' + i] || ''} ${m['strIngredient' + i]}`.trim());
        const caption = `🍲 *${m.strMeal}*\n${m.strCategory} · ${m.strArea}\n\n*Ingrédients*\n${ing.map(x => '• ' + x).join('\n')}\n\n*Préparation*\n${cut(m.strInstructions || '', 700)}${m.strYoutube ? '\n\n▶️ ' + m.strYoutube : ''}`;
        await sock.sendMessage(chatId, { image: { url: m.strMealThumb }, caption }, { quoted: message });
    } catch (e) { await reply('❌ Service de recettes indisponible.'); }
});

/* ───────────────────────── GROUPE ───────────────────────── */
def(['open', 'opengroup'], { cat: 'Groupe', usage: '.open', desc: 'Tout le monde peut écrire', group: true, admin: true }, async ({ sock, chatId, reply }) => {
    await sock.groupSettingUpdate(chatId, 'not_announcement');
    await reply('🔓 Groupe *ouvert* : tout le monde peut écrire.');
});

def(['close', 'closegroup'], { cat: 'Groupe', usage: '.close', desc: 'Seuls les admins écrivent', group: true, admin: true }, async ({ sock, chatId, reply }) => {
    await sock.groupSettingUpdate(chatId, 'announcement');
    await reply('🔒 Groupe *fermé* : seuls les admins peuvent écrire.');
});

def(['link', 'grouplink'], { cat: 'Groupe', usage: '.link', desc: "Lien d'invitation", group: true, admin: true }, async ({ sock, chatId, reply }) => {
    const code = await sock.groupInviteCode(chatId);
    await reply(`🔗 https://chat.whatsapp.com/${code}`);
});

def('add', { cat: 'Groupe', usage: '.add <numéro>', desc: 'Ajoute un membre', group: true, admin: true }, async ({ sock, chatId, reply, text, message }) => {
    const jid = getTarget(message, text);
    if (!jid) return reply('➕ Exemple : *.add 50937000000* (indicatif + numéro)');
    const res = await sock.groupParticipantsUpdate(chatId, [jid], 'add');
    const st = String(res?.[0]?.status || '');
    if (st === '200') return reply(`✅ +${numOf(jid)} ajouté.`);
    if (st === '403') return reply('📩 Cette personne bloque les ajouts : une invitation est nécessaire (utilise *.link*).');
    if (st === '409') return reply('ℹ️ Déjà dans le groupe.');
    await reply('❌ Impossible d\'ajouter ce numéro (code ' + (st || '?') + ').');
});

def('kickall', { cat: 'Groupe', usage: '.kickall confirm', desc: 'Expulse tous les non-admins', group: true, admin: true }, async ({ sock, chatId, reply, args }) => {
    const meta = await sock.groupMetadata(chatId);
    const me = numOf(sock.user?.id);
    const meLid = numOf(sock.user?.lid);
    const targets = meta.participants.filter(p => !p.admin && ![me, meLid].includes(numOf(p.id)) && numOf(p.id) !== String(settings.ownerNumber)).map(p => p.id);
    if (!targets.length) return reply('ℹ️ Il n\'y a aucun membre non-admin à expulser.');
    if ((args[0] || '').toLowerCase() !== 'confirm') {
        return reply(`⚠️ *${targets.length} membre(s)* seront expulsés.\nConfirme avec : *.kickall confirm*`);
    }
    await reply(`🧹 Expulsion de ${targets.length} membre(s)…`);
    for (let i = 0; i < targets.length; i += 5) {
        try { await sock.groupParticipantsUpdate(chatId, targets.slice(i, i + 5), 'remove'); } catch (e) { console.error('kickall:', e.message); }
        await new Promise(r => setTimeout(r, 1500));
    }
    await reply('✅ Terminé.');
});

def('poll', { cat: 'Groupe', usage: '.poll question | choix1 | choix2', desc: 'Crée un sondage', group: true }, async ({ sock, chatId, reply, text }) => {
    const parts = (text || '').split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) return reply('📊 Exemple : *.poll On mange quoi ? | Pizza | Burger | Sushi*');
    await sock.sendMessage(chatId, { poll: { name: cut(parts[0], 120), values: parts.slice(1, 13).map(v => cut(v, 100)), selectableCount: 1 } });
});

def(['getpp', 'pp'], { cat: 'Groupe', usage: '.getpp @user', desc: 'Photo de profil' }, async ({ sock, chatId, message, reply, text, senderId }) => {
    const jid = getTarget(message, text) || senderId;
    try {
        const url = await sock.profilePictureUrl(jid, 'image');
        await sock.sendMessage(chatId, { image: { url }, caption: `🖼️ Photo de +${numOf(jid)}` }, { quoted: message });
    } catch (e) { await reply('❌ Pas de photo de profil (ou profil privé).'); }
});

def(['whois', 'profile'], { cat: 'Groupe', usage: '.whois @user', desc: "Infos sur quelqu'un" }, async ({ sock, chatId, message, reply, text, senderId }) => {
    const jid = getTarget(message, text) || senderId;
    let about = '—', pic = null;
    try { const st = await sock.fetchStatus(jid); about = st?.status || st?.[0]?.status?.status || '—'; } catch (_) { }
    try { pic = await sock.profilePictureUrl(jid, 'image'); } catch (_) { }
    const caption = box('PROFIL', [`📱 +${numOf(jid)}`, `💬 ${cut(String(about), 120)}`]);
    if (pic) await sock.sendMessage(chatId, { image: { url: pic }, caption }, { quoted: message });
    else await reply(caption);
});

/* ───────────────────────── PROPRIÉTAIRE ───────────────────────── */
def(['block', 'bloquer'], { cat: 'Propriétaire', usage: '.block @user', desc: 'Bloque un contact', owner: true }, async ({ sock, chatId, message, reply, text }) => {
    const jid = getTarget(message, text) || (!chatId.endsWith('@g.us') ? chatId : null);
    if (!jid) return reply('🚫 Mentionne, réponds à un message, ou écris le numéro.');
    await sock.updateBlockStatus(jid, 'block');
    await reply(`🚫 +${numOf(jid)} bloqué.`);
});

def(['unblock', 'debloquer'], { cat: 'Propriétaire', usage: '.unblock <numéro>', desc: 'Débloque un contact', owner: true }, async ({ sock, chatId, message, reply, text }) => {
    const jid = getTarget(message, text) || (!chatId.endsWith('@g.us') ? chatId : null);
    if (!jid) return reply('✅ Écris le numéro à débloquer.');
    await sock.updateBlockStatus(jid, 'unblock');
    await reply(`✅ +${numOf(jid)} débloqué.`);
});

def(['join', 'rejoindre'], { cat: 'Propriétaire', usage: '.join <lien groupe>', desc: 'Rejoint un groupe', owner: true }, async ({ sock, reply, text }) => {
    const m = (text || '').match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    if (!m) return reply('🔗 Exemple : *.join https://chat.whatsapp.com/XXXX*');
    await sock.groupAcceptInvite(m[1]);
    await reply('✅ Groupe rejoint.');
});

def(['leave', 'quitter'], { cat: 'Propriétaire', usage: '.leave', desc: 'Quitte le groupe', owner: true, group: true }, async ({ sock, chatId, reply }) => {
    await reply('👋 Au revoir !');
    await sock.groupLeave(chatId);
});

def(['broadcast', 'bc'], { cat: 'Propriétaire', usage: '.bc <message>', desc: 'Message à tous les groupes', owner: true }, async ({ sock, reply, text }) => {
    if (!text) return reply('📢 Exemple : *.bc Maintenance ce soir à 20h*');
    const groups = Object.keys(await sock.groupFetchAllParticipating());
    await reply(`📢 Envoi à ${groups.length} groupe(s)…`);
    let ok = 0;
    for (const g of groups) {
        try { await sock.sendMessage(g, { text: `📢 *ANNONCE*\n\n${text}` }); ok++; } catch (_) { }
        await new Promise(r => setTimeout(r, 2500));
    }
    await reply(`✅ Envoyé dans ${ok}/${groups.length} groupe(s).`);
});

def('setbio', { cat: 'Propriétaire', usage: '.setbio <texte>', desc: 'Change la bio du bot', owner: true }, async ({ sock, reply, text }) => {
    if (!text) return reply('✏️ Exemple : *.setbio ADRIAN MD en ligne*');
    await sock.updateProfileStatus(cut(text, 139));
    await reply('✅ Bio mise à jour.');
});

def('restart', { cat: 'Propriétaire', usage: '.restart', desc: 'Redémarre le bot', owner: true }, async ({ reply }) => {
    await reply('♻️ Redémarrage… (Render relance le service automatiquement)');
    setTimeout(() => process.exit(0), 1500);
});

def('session', { cat: 'Propriétaire', usage: '.session', desc: 'Envoie ton SESSION_ID (privé)', owner: true }, async ({ reply, isGroup }) => {
    if (isGroup) return reply('🔐 Utilise cette commande en privé, jamais dans un groupe.');
    const sid = require('../lib/sessionManager').exportSessionId();
    await reply(sid ? `🔐 *SESSION_ID* (secret !)\n\n${sid}` : '❌ Aucune session trouvée.');
});

/* ───────────────────────── MÉDIA / BOT ───────────────────────── */
def(['tomp3', 'toaudio'], { cat: 'Média', usage: '.tomp3 (réponds à une vidéo)', desc: 'Vidéo → audio MP3' }, async ({ sock, chatId, message, reply }) => {
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
    const { toAudio } = require('../lib/converter');
    const quoted = getContext(message).quotedMessage;
    const holder = quoted || message.message;
    const type = ['videoMessage', 'audioMessage'].find(t => holder?.[t]);
    if (!type) return reply('🎵 Réponds à une *vidéo* ou un *vocal* avec *.tomp3*');
    await reply('⏳ Conversion…');
    const stream = await downloadContentFromMessage(holder[type], type === 'videoMessage' ? 'video' : 'audio');
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const mp3 = await toAudio(Buffer.concat(chunks), type === 'videoMessage' ? 'mp4' : 'ogg');
    await sock.sendMessage(chatId, { audio: mp3, mimetype: 'audio/mpeg' }, { quoted: message });
});

const fmtUptime = (s) => `${Math.floor(s / 86400)}j ${Math.floor(s % 86400 / 3600)}h ${Math.floor(s % 3600 / 60)}m ${Math.floor(s % 60)}s`;
def(['runtime', 'uptime'], { cat: 'Bot', usage: '.runtime', desc: 'Temps de fonctionnement' }, async ({ reply }) => {
    await reply(box('RUNTIME', [`⏱️ ${fmtUptime(process.uptime())}`]));
});

def(['botinfo', 'stats'], { cat: 'Bot', usage: '.botinfo', desc: 'Infos techniques du bot' }, async ({ reply }) => {
    const mem = process.memoryUsage();
    await reply(box(String(settings.botName || 'ADRIAN MD').toUpperCase(), [
        `🔖 Version : v${settings.version}`, `⏱️ Uptime : ${fmtUptime(process.uptime())}`,
        `🧠 RAM bot : ${(mem.rss / 1048576).toFixed(0)} MB`, `🖥️ Node ${process.version} · ${os.platform()}`,
        `⚙️ Commandes ajoutées : ${entries.length}`, `🌐 Mode : ${process.env.RENDER ? 'Render' : 'local'}`,
    ]));
});

/* ───────────────────────── Dispatch ───────────────────────── */
/**
 * @returns {Promise<boolean>} true si la commande a été traitée ici
 */
async function handleExtraCommand(sock, message, { chatId, senderId, isGroup, rawText, isOwner }) {
    const m = String(rawText || '').match(/^\.\s*(\S+)\s*([\s\S]*)$/);
    if (!m) return false;
    const cmd = m[1].toLowerCase();
    const entry = registry[cmd];
    if (!entry) return false;

    const text = (m[2] || '').trim();
    const args = text ? text.split(/\s+/) : [];
    const reply = (t) => sock.sendMessage(chatId, { text: t }, { quoted: message });

    try {
        if (entry.owner && !isOwner) { await reply('❌ Commande réservée au propriétaire.'); return true; }
        if (entry.group && !isGroup) { await reply('❌ Cette commande fonctionne uniquement dans un groupe.'); return true; }
        if (entry.admin && isGroup) {
            const isAdmin = require('../lib/isAdmin');
            const st = await isAdmin(sock, chatId, senderId);
            if (!st.isBotAdmin) { await reply('⚠️ Je dois être *admin* du groupe pour faire ça.'); return true; }
            if (!st.isSenderAdmin && !message.key.fromMe && !isOwner) { await reply('❌ Réservé aux admins du groupe.'); return true; }
        }
        await entry.run({ sock, message, chatId, senderId, isGroup, args, text, cmd, isOwner, reply });
    } catch (e) {
        console.error(`❌ Erreur .${cmd}:`, e?.message || e);
        try { await reply('❌ La commande a échoué. Réessaie dans un instant.'); } catch (_) { }
    }
    return true;
}

/** Texte du menu (généré depuis le registre) */
function extraMenu() {
    const order = ['Utilitaires', 'Fun', 'Groupe', 'Média', 'Bot', 'Propriétaire'];
    const icons = { Utilitaires: '🧰', Fun: '🎉', Groupe: '👥', Média: '🎞️', Bot: '🤖', Propriétaire: '🩸' };
    let out = `╭━━━━━━━━━━━━━━━━━━━━━╮\n┃  ✦ 𝕹𝕺𝖀𝖁𝕰𝕷𝕷𝕰𝕾 𝕮𝕺𝕸𝕸𝕬𝕹𝕯𝕰𝕾 ✦\n╰━━━━━━━━━━━━━━━━━━━━━╯`;
    for (const cat of order) {
        const list = entries.filter(e => e.cat === cat);
        if (!list.length) continue;
        out += `\n\n╭─━━━━ ◆ ━━━━─╮\n${icons[cat]} *${cat}*\n` + list.map(e => `┃ ▸ ${e.usage}`).join('\n') + '\n╰─━━━━ ◆ ━━━━─╯';
    }
    return out;
}

module.exports = { handleExtraCommand, extraMenu, safeCalc, FANCY_STYLES, registry, entries };
