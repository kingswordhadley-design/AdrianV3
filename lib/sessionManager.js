// Persistance de la session WhatsApp pour Render (disque éphémère).
// - SESSION_ID (variable d'environnement) = creds.json encodé en base64, préfixé "ADRIAN~"
// - Au démarrage : si ./session/creds.json n'existe pas, on le restaure depuis SESSION_ID
// - Une fois connecté sans SESSION_ID : le bot envoie le SESSION_ID dans ta discussion privée
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(process.cwd(), 'session');
const CREDS = path.join(SESSION_DIR, 'creds.json');
const PREFIX = 'ADRIAN~';

function restoreFromEnv() {
    const raw = (process.env.SESSION_ID || '').trim();
    if (!raw) return false;
    if (fs.existsSync(CREDS)) return true; // déjà présent (même conteneur)
    try {
        const b64 = raw.replace(/^[A-Za-z]+~/, '');
        const json = Buffer.from(b64, 'base64').toString('utf8');
        JSON.parse(json); // validation
        fs.mkdirSync(SESSION_DIR, { recursive: true });
        fs.writeFileSync(CREDS, json);
        console.log('✅ Session restaurée depuis SESSION_ID');
        return true;
    } catch (e) {
        console.error('❌ SESSION_ID invalide :', e.message);
        return false;
    }
}

function exportSessionId() {
    try {
        if (!fs.existsSync(CREDS)) return null;
        return PREFIX + Buffer.from(fs.readFileSync(CREDS)).toString('base64');
    } catch (_) { return null; }
}

module.exports = { restoreFromEnv, exportSessionId, SESSION_DIR, CREDS };
