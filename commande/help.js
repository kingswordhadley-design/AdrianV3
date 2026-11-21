const settings = require('../settings');
const fs = require('fs');
const path = require('path');
const { extraMenu } = require('./extra');

async function helpCommand(sock, chatId, message) {
    const helpMessage = `
╭━━━━━━━━━━━━━━━━━━━━━╮
┃        𝕬𝕯𝕽𝕴𝕬𝕹 𝕸𝕯
┃    👑 THE MONARCH ・ 支配者
┃  ───────────────────
┃  Version   : *${settings.version || '3.0.0'}*
┃  Dev       : *${settings.devName || 'DEV ADRIAN D THE MONARCH'}*
╰━━━━━━━━━━━━━━━━━━━━━╯

*𝕮𝖔𝖒𝖒𝖆𝖓𝖉𝖊𝖘 ・ 命令*

╭─━━━━ ◆ ━━━━─╮
🕸️ *𝕲𝖊𝖓𝖊𝖗𝖆𝖑* 一般
┃ ▸ .help or .menu
┃ ▸ .ping
┃ ▸ .alive
┃ ▸ .tts <text>
┃ ▸ .owner
┃ ▸ .joke
┃ ▸ .quote
┃ ▸ .fact
┃ ▸ .weather <city>
┃ ▸ .news
┃ ▸ .attp <text>
┃ ▸ .lyrics <song_title>
┃ ▸ .8ball <question>
┃ ▸ .groupinfo
┃ ▸ .staff or .admins 
┃ ▸ .vv
┃ ▸ .trt <text> <lang>
┃ ▸ .ss <link>
┃ ▸ .jid
┃ ▸ .url
╰─━━━━ ◆ ━━━━─╯ 

╭─━━━━ ◆ ━━━━─╮
⛓️ *𝕬𝖉𝖒𝖎𝖓* 管理
┃ ▸ .ban @user
┃ ▸ .promote @user
┃ ▸ .demote @user
┃ ▸ .mute <minutes>
┃ ▸ .unmute
┃ ▸ .delete or .del
┃ ▸ .kick @user
┃ ▸ .warnings @user
┃ ▸ .warn @user
┃ ▸ .antilink
┃ ▸ .antibadword
┃ ▸ .clear
┃ ▸ .tag <message>
┃ ▸ .tagall
┃ ▸ .tagnotadmin
┃ ▸ .hidetag <message>
┃ ▸ .chatbot
┃ ▸ .resetlink
┃ ▸ .antitag <on/off>
┃ ▸ .welcome <on/off>
┃ ▸ .goodbye <on/off>
┃ ▸ .setgdesc <description>
┃ ▸ .setgname <new name>
┃ ▸ .setgpp (reply to image)
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
🩸 *𝕺𝖜𝖓𝖊𝖗* 主
┃ ▸ .mode <public/private>
┃ ▸ .clearsession
┃ ▸ .antidelete
┃ ▸ .cleartmp
┃ ▸ .update
┃ ▸ .settings
┃ ▸ .setpp <reply to image>
┃ ▸ .autoreact <on/off>
┃ ▸ .autostatus <on/off>
┃ ▸ .autostatus react <on/off>
┃ ▸ .autotyping <on/off>
┃ ▸ .autoread <on/off>
┃ ▸ .anticall <on/off>
┃ ▸ .pmblocker <on/off/status>
┃ ▸ .pmblocker setmsg <text>
┃ ▸ .setmention <reply to msg>
┃ ▸ .mention <on/off>
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
🎴 *𝕴𝖒𝖆𝖌𝖊 / 𝕾𝖙𝖎𝖈𝖐𝖊𝖗* 画像
┃ ▸ .blur <image>
┃ ▸ .simage <reply to sticker>
┃ ▸ .sticker <reply to image>
┃ ▸ .removebg
┃ ▸ .remini
┃ ▸ .crop <reply to image>
┃ ▸ .tgsticker <Link>
┃ ▸ .meme
┃ ▸ .take <packname> 
┃ ▸ .emojimix <emj1>+<emj2>
┃ ▸ .igs <insta link>
┃ ▸ .igsc <insta link>
╰─━━━━ ◆ ━━━━─╯  

╭─━━━━ ◆ ━━━━─╮
🖼️ *𝕻𝖎𝖊𝖘* 写真
┃ ▸ .pies <country>
┃ ▸ .china 
┃ ▸ .indonesia 
┃ ▸ .japan 
┃ ▸ .korea 
┃ ▸ .hijab
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
🎲 *𝕲𝖆𝖒𝖊𝖘* 遊戯
┃ ▸ .tictactoe @user
┃ ▸ .hangman
┃ ▸ .guess <letter>
┃ ▸ .trivia
┃ ▸ .answer <answer>
┃ ▸ .truth
┃ ▸ .dare
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
👁️ *𝕬𝕴* 機械
┃ ▸ .gpt <question>
┃ ▸ .gemini <question>
┃ ▸ .imagine <prompt>
┃ ▸ .flux <prompt>
┃ ▸ .sora <prompt>
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
🃏 *𝕱𝖚𝖓* 娯楽
┃ ▸ .compliment @user
┃ ▸ .insult @user
┃ ▸ .flirt 
┃ ▸ .shayari
┃ ▸ .goodnight
┃ ▸ .roseday
┃ ▸ .character @user
┃ ▸ .wasted @user
┃ ▸ .ship @user
┃ ▸ .simp @user
┃ ▸ .stupid @user [text]
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
🔤 *𝕿𝖊𝖝𝖙𝖒𝖆𝖐𝖊𝖗* 文字
┃ ▸ .metallic <text>
┃ ▸ .ice <text>
┃ ▸ .snow <text>
┃ ▸ .impressive <text>
┃ ▸ .matrix <text>
┃ ▸ .light <text>
┃ ▸ .neon <text>
┃ ▸ .devil <text>
┃ ▸ .purple <text>
┃ ▸ .thunder <text>
┃ ▸ .leaves <text>
┃ ▸ .1917 <text>
┃ ▸ .arena <text>
┃ ▸ .hacker <text>
┃ ▸ .sand <text>
┃ ▸ .blackpink <text>
┃ ▸ .glitch <text>
┃ ▸ .fire <text>
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
📥 *𝕯𝖔𝖜𝖓𝖑𝖔𝖆𝖉𝖊𝖗* 落
┃ ▸ .play <song_name>
┃ ▸ .song <song_name>
┃ ▸ .spotify <query>
┃ ▸ .instagram <link>
┃ ▸ .facebook <link>
┃ ▸ .tiktok <link>
┃ ▸ .video <song name>
┃ ▸ .ytmp4 <Link>
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
🧩 *𝕸𝖎𝖘𝖈* 雑
┃ ▸ .heart
┃ ▸ .horny
┃ ▸ .circle
┃ ▸ .lgbt
┃ ▸ .lolice
┃ ▸ .its-so-stupid
┃ ▸ .namecard 
┃ ▸ .oogway
┃ ▸ .tweet
┃ ▸ .ytcomment 
┃ ▸ .comrade 
┃ ▸ .gay 
┃ ▸ .glass 
┃ ▸ .jail 
┃ ▸ .passed 
┃ ▸ .triggered
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
🌙 *𝕬𝖓𝖎𝖒𝖊* アニメ
┃ ▸ .nom 
┃ ▸ .poke 
┃ ▸ .cry 
┃ ▸ .kiss 
┃ ▸ .pat 
┃ ▸ .hug 
┃ ▸ .wink 
┃ ▸ .facepalm 
╰─━━━━ ◆ ━━━━─╯

╭─━━━━ ◆ ━━━━─╮
💻 *𝕲𝖎𝖙𝖍𝖚𝖇* ギット
┃ ▸ .git
┃ ▸ .github
┃ ▸ .sc
┃ ▸ .script
┃ ▸ .repo
╰─━━━━ ◆ ━━━━─╯

╭━━━━━━━━━━━━━━━━━━━━━╮
┃  冷徹 ・ 優雅 ・ 絶対
┃  Powered by DEV ADRIAN D THE MONARCH
╰━━━━━━━━━━━━━━━━━━━━━╯`;

    try {
        const imagePath = path.join(__dirname, '../assets/bot_image.jpg');
        
        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'ADRIAN MD',
                        serverMessageId: -1
                    }
                }
            },{ quoted: message });
        } else {
            console.error('Bot image not found at:', imagePath);
            await sock.sendMessage(chatId, { 
                text: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: 'ADRIAN MD',
                        serverMessageId: -1
                    } 
                }
            });
        }
        // Nouvelles commandes (menu généré automatiquement)
        await sock.sendMessage(chatId, { text: extraMenu() });
    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: helpMessage });
    }
}

module.exports = helpCommand;