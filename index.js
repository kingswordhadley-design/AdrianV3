/**
 * Adrian MD - A WhatsApp Bot
 * Copyright (c) 2026 DEV SORA
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */

require('./lib/ffmpegPath')
require('dotenv').config()
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

const MAX_RAM_MB = parseInt(process.env.MAX_RAM_MB || '450', 10)
// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > MAX_RAM_MB) {
        console.log(`⚠️ RAM trop haute (>${MAX_RAM_MB}MB), redémarrage...`)
        process.exit(1) // Render redémarre le service automatiquement
    }
}, 30_000) // check every 30 seconds

const sessionManager = require('./lib/sessionManager')
const webServer = require('./lib/webServer')

// Numéro à jumeler (pairing code) : PHONE_NUMBER, sinon OWNER_NUMBER
const phoneNumber = String(process.env.PHONE_NUMBER || settings.ownerNumber || '').replace(/[^0-9]/g, '')
let owner = []
try { owner = JSON.parse(fs.readFileSync('./data/owner.json')) } catch (_) { }

global.botname = settings.botName || "ADRIAN MD"
global.themeemoji = "•"
const usePairingCode = !!phoneNumber

async function startXeonBotInc() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        // Save credentials when they update
        XeonBotInc.ev.on('creds.update', saveCreds)

    // Chaîne WhatsApp : l'identifiant (JID) est résolu depuis le lien à la connexion.
    // Tous les messages "transférés depuis une chaîne" pointent alors vers TA chaîne.
    const channelState = { jid: null, name: null }
    const _send = XeonBotInc.sendMessage.bind(XeonBotInc)
    XeonBotInc.sendMessage = (jid, content, options) => {
        try {
            const f = content?.contextInfo?.forwardedNewsletterMessageInfo
            if (f) {
                if (channelState.jid) { f.newsletterJid = channelState.jid; f.newsletterName = channelState.name || settings.botName }
                else { delete content.contextInfo.forwardedNewsletterMessageInfo; content.contextInfo.isForwarded = false }
            }
        } catch (_) { }
        return _send(jid, content, options)
    }

    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            // In private mode, only block non-group messages (allow groups for moderation)
            // Note: XeonBotInc.public is not synced, so we check mode in main.js instead
            // This check is kept for backward compatibility but mainly blocks DMs
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                if (!isGroup) return // Block DMs in private mode, but allow group messages
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            // Clear message retry cache to prevent memory bloat
            if (XeonBotInc?.msgRetryCounterCache) {
                XeonBotInc.msgRetryCounterCache.clear()
            }

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.',
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363161513685998@newsletter',
                                newsletterName: 'ADRIAN MD',
                                serverMessageId: -1
                            }
                        }
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    // Jumelage par code (première connexion uniquement)
    if (usePairingCode && !XeonBotInc.authState.creds.registered) {
        webServer.state.status = 'waiting_pairing'
        setTimeout(async () => {
            try {
                let code = await XeonBotInc.requestPairingCode(phoneNumber, "ADRIANMD")
                code = code?.match(/.{1,4}/g)?.join("-") || code
                webServer.state.pairingCode = code
                console.log(chalk.black(chalk.bgGreen(` CODE DE JUMELAGE : ${code} `)))
                console.log(chalk.yellow('WhatsApp > Appareils connectés > Connecter un appareil > Connecter avec le numéro de téléphone'))
            } catch (error) {
                console.error('Erreur pairing code:', error)
            }
        }, 3000)
    }

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s

        if (qr && !usePairingCode) {
            webServer.state.status = 'waiting_pairing'
            console.log(chalk.yellow('📱 Scanne ce QR code (ou définis PHONE_NUMBER pour utiliser un code de jumelage) :'))
            try { require('qrcode-terminal').generate(qr, { small: true }) } catch (_) { }
        }

        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connexion à WhatsApp...'))
        }

        if (connection == "open") {
            const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'
            const botNum = XeonBotInc.user.id.split(':')[0].split('@')[0]
            webServer.state.status = 'connected'
            webServer.state.pairingCode = null
            webServer.state.number = botNum
            console.log(chalk.green(`✅ Connecté : +${botNum}`))

            // Résout et suit la chaîne WhatsApp du développeur
            try {
                const code = (settings.channelLink.match(/channel\/([A-Za-z0-9_-]+)/) || [])[1]
                if (code) {
                    const meta = await XeonBotInc.newsletterMetadata('invite', code)
                    channelState.jid = meta?.id || null
                    channelState.name = meta?.name || meta?.thread_metadata?.name?.text || null
                    if (channelState.jid) {
                        await XeonBotInc.newsletterFollow(channelState.jid).catch(() => { })
                        console.log(chalk.green(`📢 Chaîne suivie : ${channelState.name || channelState.jid}`))
                    }
                }
            } catch (e) { console.error('Chaîne non résolue :', e.message) }

            // Pas de propriétaire défini : le numéro lié au bot devient le propriétaire
            if (!settings.ownerNumber) settings.ownerNumber = botNum

            try {
                await XeonBotInc.sendMessage(botJid, {
                    text: `🤖 *${settings.botName}* est en ligne !\n\n⏰ ${new Date().toLocaleString('fr-FR')}\n✅ Tape *.menu* pour voir les commandes.`
                })
                // Première connexion : envoie le SESSION_ID à coller dans Render > Environment
                if (!process.env.SESSION_ID) {
                    await delay(3000)
                    const sid = sessionManager.exportSessionId()
                    if (sid) {
                        await XeonBotInc.sendMessage(botJid, {
                            text: `🔐 *SESSION_ID* (garde-le secret !)\nColle-le dans Render > Environment > SESSION_ID pour ne plus avoir à te reconnecter après chaque redémarrage :\n\n${sid}`
                        })
                    }
                }
            } catch (error) {
                console.error('Erreur message de connexion:', error.message)
            }

            await delay(1999)
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`${global.themeemoji} IDENTITY : ${settings.botName}`))
            console.log(chalk.magenta(`${global.themeemoji} OWNER    : ${settings.ownerNumber}`))
            console.log(chalk.blue(`${global.themeemoji} VERSION  : ${settings.version}`))
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401
            webServer.state.status = 'disconnected'
            console.log(chalk.red(`Connexion fermée (${statusCode || lastDisconnect?.error}), reconnexion...`))

            if (loggedOut) {
                try {
                    rmSync('./session', { recursive: true, force: true })
                    console.log(chalk.yellow('Session supprimée (déconnecté depuis le téléphone). Nouveau jumelage nécessaire.'))
                    console.log(chalk.yellow('➡️  Pense à vider la variable SESSION_ID dans Render, sinon l\'ancienne session sera restaurée au prochain démarrage.'))
                } catch (error) {
                    console.error('Erreur suppression session:', error)
                }
            }
            await delay(loggedOut ? 3000 : 5000)
            startXeonBotInc()
        }
    })

    // Track recently-notified callers to avoid spamming messages
    const antiCallNotified = new Set();

    // Anticall handler: block callers when enabled
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;
                try {
                    // First: attempt to reject the call if supported
                    try {
                        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                            await XeonBotInc.rejectCall(call.id, callerJid);
                        } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                            await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                        }
                    } catch {}

                    // Notify the caller only once within a short window
                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Anticall is enabled. Your call was rejected and you will be blocked.' });
                    }
                } catch {}
                // Then: block after a short delay to ensure rejection and message are processed
                setTimeout(async () => {
                    try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                }, 800);
            }
        } catch (e) {
            // ignore
        }
    });

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('messages.upsert', async (m) => {
        if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
            await handleStatus(XeonBotInc, m);
        }
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        await delay(5000)
        startXeonBotInc()
    }
}


// Démarrage
webServer.start()
sessionManager.restoreFromEnv()
startXeonBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})
