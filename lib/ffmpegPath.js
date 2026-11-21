// Résout le binaire ffmpeg : ffmpeg-static (Render n'a pas ffmpeg) puis ffmpeg système
let bin = process.env.FFMPEG_PATH || 'ffmpeg';
if (!process.env.FFMPEG_PATH) {
    try { bin = require('ffmpeg-static') || 'ffmpeg'; } catch (_) { bin = 'ffmpeg'; }
}
process.env.FFMPEG_PATH = bin; // lu automatiquement par fluent-ffmpeg
module.exports = bin;
