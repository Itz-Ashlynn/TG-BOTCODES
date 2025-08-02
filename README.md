# Telegram File Link Generator Bot

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)
![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-2CA5E0?logo=telegram)

A Cloudflare Worker that acts as a Telegram bot to generate direct download links for files shared through Telegram.

## Features

- 🚀 Generates direct download links for Telegram files (up to 20MB)
- 🔒 Secure token-based access system
- 👥 Channel membership requirement
- 📊 User-specific link management
- ⚡ Lightning-fast delivery via Cloudflare's global network
- 🔄 Automatic link expiration after 24 hours

## Prerequisites

- Cloudflare account with Workers access
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- Telegram channel (for membership verification)

## Configuration

### Environment Variables

Set these in your Cloudflare Worker settings:

| Variable Name       | Type    | Description                                  | Example Value                        |
|---------------------|---------|----------------------------------------------|--------------------------------------|
| `BOT_TOKEN`         | Secret  | Your Telegram bot token                      | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `WORKER_DOMAIN`     | Variable| Your worker's domain                         | `https://file.example.workers.dev`   |
| `CHANNEL_ID`        | Variable| Your Telegram channel ID                     | `-1001234567890`                    |
| `CHANNEL_USERNAME`  | Variable| Your channel username (with @)               | `@MyChannel`                        |

### KV Namespace Binding

Create a KV namespace named `ashlynn` and bind it to your Worker.

## Installation

1. **Create a new Worker** in your Cloudflare dashboard
2. **Paste the code** from `worker.js`
3. **Configure the environment variables** as shown above
4. **Bind the KV namespace** named `ashlynn`
5. **Deploy the Worker**

## Setting Up the Webhook

After deployment, set up your Telegram webhook by visiting:

```
https://your-worker.workers.dev/set-webhook
```

Or manually using cURL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-worker.workers.dev/webhook"}'
```

## Usage

1. Send any file (up to 20MB) to the bot
2. The bot will generate a direct download link
3. Use `/links` to view all your active download links

## API Endpoints

| Endpoint          | Method | Description                          |
|-------------------|--------|--------------------------------------|
| `/webhook`        | POST   | Telegram bot webhook endpoint        |
| `/file/:id/:token`| GET    | Download file endpoint               |
| `/set-webhook`    | GET    | Setup Telegram webhook               |

## Troubleshooting

### Common Issues

1. **"Method Not Allowed" error**:
   - Ensure you're making POST requests to `/webhook`
   - Telegram automatically sends POST requests for webhooks

2. **Webhook not working**:
   - Verify the webhook is set correctly by visiting:
     ```
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
     ```
   - Check your Worker logs for errors

3. **File download issues**:
   - Links expire after 24 hours of inactivity
   - Maximum file size is 20MB

## License

This project is licensed under the MIT License.

---

**Made with ❤️ by [Ashlynn's Repository](https://t.me/Ashlynn_Repository)**
