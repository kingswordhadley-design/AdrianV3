const settings = require("../settings");
async function aliveCommand(sock, chatId, message) {
    try {
        const message1 = `╭━━━〔 𝕬𝕯𝕽𝕴𝕬𝕹 𝕸𝕯 〕━━━╮\n` +
                       `┃   👑 THE MONARCH ・ 起動中\n` +
                       `┃  ───────────────\n` +
                       `┃  Version : *${settings.version}*\n` +
                       `┃  Statut  : En ligne\n` +
                       `┃  Mode    : ${settings.commandMode || 'public'}\n` +
                       `┃  Dev     : ${settings.devName || 'DEV ADRIAN D THE MONARCH'}\n` +
                       `╰━━━━━━━━━━━━━━━━━━━╯\n\n` +
                       `*𝕻𝖔𝖚𝖛𝖔𝖎𝖗𝖘 ・ 力*\n` +
                       `┃ ▸ Gestion des groupes\n` +
                       `┃ ▸ Protection anti-lien\n` +
                       `┃ ▸ Commandes fun\n` +
                       `┃ ▸ Et bien plus…\n\n` +
                       `🌹「 Voir la chaîne 」\n` +
                       `${settings.channelLink}\n\n` +
                       `Tape *.menu*\n` +
                       `Powered by DEV ADRIAN D THE MONARCH`;

        await sock.sendMessage(chatId, {
            text: message1,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363161513685998@newsletter',
                    newsletterName: 'ADRIAN MD',
                    serverMessageId: -1
                }
            }
        }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: 'Bot is alive and running!' }, { quoted: message });
    }
}

module.exports = aliveCommand;