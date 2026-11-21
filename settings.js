require('dotenv').config();

const clean = (v) => String(v || '').replace(/[^0-9]/g, '');

const settings = {
  packname: process.env.BOT_NAME || 'ADRIAN MD',
  author: '‎',
  botName: process.env.BOT_NAME || 'ADRIAN MD',
  botOwner: process.env.OWNER_NAME || 'DEV ADRIAN D THE MONARCH',
  devName: 'DEV ADRIAN D THE MONARCH',
  signature: 'Powered by DEV ADRIAN D THE MONARCH',
  channelLink: process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029VbDq1hqHLHQUb52LVi31',
  // Ton numéro WhatsApp (indicatif + numéro, sans +). Si vide, le numéro lié au bot devient le propriétaire.
  ownerNumber: clean(process.env.OWNER_NUMBER),
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: "public",
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: "ADRIAN MD — un bot WhatsApp sombre, élégant et sans compromis.",
  version: "3.1.0",
  updateZipUrl: "",
  githubRepo: "",
  supportLink: "",
};

module.exports = settings;
