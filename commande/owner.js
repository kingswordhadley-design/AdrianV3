const settings = require('../settings');

async function ownerCommand(sock, chatId) {
    const presentation = `╭━━━〔 𝕯𝖊𝖛𝖊𝖑𝖔𝖕𝖊𝖗 〕━━━╮\n` +
        `┃  ADRIAN MD\n` +
        `┃  ───────────────\n` +
        `┃  Dev : ${settings.devName || 'DEV ADRIAN D THE MONARCH'}\n` +
        `┃  🌹「 Voir la chaîne 」\n` +
        `┃  ${settings.channelLink}\n` +
        `╰━━━━━━━━━━━━━━━━━━━╯\n` +
        `Powered by DEV ADRIAN D THE MONARCH`;

    await sock.sendMessage(chatId, { text: presentation });

    const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${settings.botOwner}
TEL;waid=${settings.ownerNumber}:${settings.ownerNumber}
END:VCARD
`;

    await sock.sendMessage(chatId, {
        contacts: { displayName: settings.botOwner, contacts: [{ vcard }] },
    });
}

module.exports = ownerCommand;
