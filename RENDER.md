# 🚀 Déployer ADRIAN MD sur Render

## 1. Mettre le projet sur GitHub
Crée un dépôt **privé** sur GitHub et envoie-y tout le contenu de ce dossier
(le fichier `.gitignore` empêche déjà d'envoyer `session/` et `.env`).

## 2. Créer le service sur Render
1. render.com → **New +** → **Web Service** → choisis ton dépôt
   (ou **New +** → **Blueprint** : Render lit `render.yaml` tout seul).
2. Réglages si tu les remplis à la main :
   - **Runtime** : Node
   - **Build Command** : `npm install --no-audit --no-fund`
   - **Start Command** : `npm start`
   - **Health Check Path** : `/health`
   - **Plan** : Free
3. Onglet **Environment**, ajoute :

| Variable | Valeur |
|---|---|
| `OWNER_NUMBER` | ton numéro avec l'indicatif, sans `+` (ex : `50937000000`) |
| `PHONE_NUMBER` | le numéro WhatsApp du bot (souvent le même) |
| `SESSION_ID` | **vide** pour le moment |

## 3. Première connexion (jumelage)
1. Lance le déploiement. Quand il est « Live », ouvre l'URL du service
   (`https://adrian-md.onrender.com`) : le **code de jumelage** s'affiche (il est aussi dans les *Logs*).
2. WhatsApp → **Appareils connectés** → **Connecter un appareil** →
   **Connecter avec le numéro de téléphone** → entre le code.
3. Le bot t'envoie en privé un message **🔐 SESSION_ID**.
4. Copie-le, colle-le dans Render → Environment → `SESSION_ID`, puis **Save** (le service redémarre).

> Sans `SESSION_ID`, le disque de Render étant éphémère, la session est perdue à chaque redémarrage
> et il faut se jumeler de nouveau. Garde le SESSION_ID **secret** (c'est l'accès à ton WhatsApp).
> Si tu te déconnectes depuis le téléphone, **vide** `SESSION_ID` avant de te rejumeler.

## 4. Garder le bot réveillé (plan gratuit)
Render endort un service gratuit après ~15 min sans visite. Le bot se « ping » tout seul via
`RENDER_EXTERNAL_URL`, mais pour être tranquille, crée un moniteur gratuit sur
[UptimeRobot](https://uptimerobot.com) → HTTP(s) toutes les 5 min sur `https://TON-SERVICE.onrender.com/health`.

## Variables optionnelles
| Variable | Rôle |
|---|---|
| `BOT_NAME` | nom affiché du bot |
| `MAX_RAM_MB` | seuil de redémarrage auto (défaut 450, le plan gratuit a 512 Mo) |
| `GIPHY_API_KEY` | clé Giphy perso pour `.gif` |

## Commandes ajoutées (46)
`.menu` les affiche toutes. Utilitaires : calc, time, define, wiki, crypto, convert, country, qr, password, shorten, ip, npm, base64, morse, reverse, mock, fancy · Fun : flip, dice, choose, rate, blague, cat, dog, fox, pokemon, meal · Groupe : open, close, link, add, kickall, poll, getpp, whois · Propriétaire : block, unblock, join, leave, bc, setbio, restart, session · Média/Bot : tomp3, runtime, botinfo.
