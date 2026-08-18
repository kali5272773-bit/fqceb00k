# FaceB00k Final — Private Demo

## What this version does

- FaceB00k login + signup UI
- Cloudflare Worker API
- Cloudflare D1 user database
- Passwords are hashed server-side with PBKDF2
- Telegram bot receives account/login notifications containing:
  - User ID
  - Name
  - Email
  - Timestamp
- Passwords are deliberately NOT sent to Telegram.

## Why the password is not sent

Even for a private/fun site, storing or transmitting real passwords in plaintext creates an unnecessary credential leak. The backend verifies the password without ever sending it to Telegram.

## Cloudflare setup

1. Create a D1 database named `faceb00k-db`.
2. Put its database ID in `wrangler.toml`.
3. Run the SQL in `schema.sql`.
4. Add Worker secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. Deploy `worker.js`.

Do NOT paste your bot token into `login.html`, `signup.html`, `script.js`, GitHub, or this chat.

## Frontend API

After deploying the Worker, point your frontend login/signup forms to:

POST /api/signup
POST /api/login

The browser should call your Worker URL, not Telegram directly.

## Important

Telegram is used here as an admin notification/backup channel. D1 is the actual database so login can reliably verify accounts.
