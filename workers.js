/**
 * Telegram File Link Generator Bot
 * Hosted on Cloudflare workers
 * 
 * Features:
 * - Generates direct download links for Telegram files
 * - Channel membership requirement
 * - User-specific link management
 * - Secure token-based access
 * 
 * Made by: https://t.me/Ashlynn_Repository
 * 
 * Configuration:
 * - BOT_TOKEN (Secret): Telegram bot token
 * - WORKER_DOMAIN (Variable): Worker's URL (e.g., https://your-worker.your-name.workers.dev)
 * - CHANNEL_ID (Variable): Required channel ID (e.g., -100123456789)
 * - CHANNEL_USERNAME (Variable): Channel username (e.g., @MyChannel)
 * - ashlynn (KV Binding): KV namespace for storing link metadata
 */

// --- Constants ---
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (Telegram Bot API limit)
const FILE_CACHE_TTL = 60 * 60 * 24; // 24 hours cache for KV metadata

// Made by: https://t.me/Ashlynn_Repository
const env = {
    BOT_TOKEN: BOT_TOKEN,
    WORKER_DOMAIN: WORKER_DOMAIN,
    CHANNEL_ID: CHANNEL_ID,
    CHANNEL_USERNAME: CHANNEL_USERNAME,
    KV: ashlynn
};
// Made by: https://t.me/Ashlynn_Repository
const TELEGRAM_API_URL = `https://api.telegram.org/bot${env.BOT_TOKEN}`;

// Made by: https://t.me/Ashlynn_Repository
addEventListener('fetch', event => {
    event.respondWith(
        handleRequest(event.request).catch(err => {
            console.error('Unhandled error:', err);
            return new Response('Internal Server Error', { status: 500 });
        })
    );
});

// Made by: https://t.me/Ashlynn_Repository
async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/').filter(part => part !== '');

// Made by: https://t.me/Ashlynn_Repository
        if (pathParts[0] === 'set-webhook') {
            if (request.method !== 'GET') {
                return methodNotAllowed();
            }
            return await setTelegramWebhook();
        }
// Made by: https://t.me/Ashlynn_Repository
        switch (pathParts[0]) {
            case 'webhook':
                return await handleTelegramWebhook(request);
            case 'file':
                if (pathParts.length < 3) return badRequest('Invalid file URL');
                return await serveFile(pathParts[1], pathParts[2]);
            default:
                return notFound();
        }
    } catch (error) {
        console.error('Request handling error:', error);
        return serverError();
    }
}
// Made by: https://t.me/Ashlynn_Repository
async function setTelegramWebhook() {
    const webhookUrl = `${env.WORKER_DOMAIN}/webhook`;
    const setupUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    
    try {
        const response = await fetch(setupUrl);
        const data = await response.json();
        
        if (data.ok) {
            return new Response(JSON.stringify({
                success: true,
                message: `Webhook set successfully to ${webhookUrl}`
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                message: data.description
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Made by: https://t.me/Ashlynn_Repository
async function handleTelegramWebhook(request) {
    if (request.method !== 'POST') {
        return methodNotAllowed();
    }
// Made by: https://t.me/Ashlynn_Repository
    try {
        const update = await request.json();
        if (!update.message?.chat?.id || !update.message?.from?.id) {
            return okResponse();
        }
// Made by: https://t.me/Ashlynn_Repository
        const { message } = update;
        const chatId = message.chat.id;
        const userId = message.from.id;

// Made by: https://t.me/Ashlynn_Repository
        if (!(await verifyChannelMembership(userId))) {
            return sendTelegramMessage(
                chatId,
                `⛔ To use this bot, you must join our channel: ${env.CHANNEL_USERNAME}\n\n` +
                `After joining, send /start again.`
            );
        }

// Made by: https://t.me/Ashlynn_Repository
        if (message.text) {
            return await handleTextCommand(chatId, userId, message.text);
        }

// Made by: https://t.me/Ashlynn_Repository
        return await handleFileMessage(chatId, message);
    } catch (error) {
        console.error('Webhook processing error:', error);
        return okResponse();
    }
}

// Made by: https://t.me/Ashlynn_Repository
async function handleTextCommand(chatId, userId, text) {
    if (text === '/start') {
        return sendTelegramMessage(
            chatId,
            '👋 Welcome to File Link Generator Bot!\n\n' +
            '📤 Send me any file (up to 20MB) and I will create a direct download link for you.\n\n' +
            '🔗 Use /links to view your active download links.'
        );
    }

    if (text.startsWith('/links')) {
        return await sendUserLinks(chatId, userId);
    }

    return sendTelegramMessage(
        chatId,
        'ℹ️ Please send a file to generate a download link or use /links to view your existing links.'
    );
}
// Made by: https://t.me/Ashlynn_Repository
async function handleFileMessage(chatId, message) {
    const { fileId, fileName, fileSize } = extractFileInfo(message);
    
    if (!fileId || !fileName) {
        return sendTelegramMessage(chatId, '❗ Please send a valid file (document, video, audio, or photo).');
    }

    if (fileSize > MAX_FILE_SIZE) {
        return sendTelegramMessage(
            chatId,
            `❌ File size (${formatFileSize(fileSize)}) exceeds the 20MB limit.\n\n` +
            'Telegram bots cannot process files larger than 20MB.'
        );
    }

    const token = generateSecureToken();
    const key = `user:${chatId}:${token}`;
    
    await env.KV.put(
        key,
        JSON.stringify({ fileId, fileName, fileSize, timestamp: Date.now() }),
        { expirationTtl: FILE_CACHE_TTL }
    );

    const downloadLink = `${env.WORKER_DOMAIN}/file/${chatId}/${token}/${encodeURIComponent(fileName)}`;
    const messageText = 
        `📁 File: ${fileName}\n` +
        `📦 Size: ${formatFileSize(fileSize)}\n\n` +
        `🔗 Download Link:\n\`${downloadLink}\`\n\n` +
        '⚠️ Note: Links may expire after 24 hours of inactivity.';

    return sendTelegramMessage(chatId, messageText);
}

// Made by: https://t.me/Ashlynn_Repository
async function serveFile(userId, token) {
    if (!userId || !token) {
        return badRequest('Missing user ID or token');
    }
// Made by: https://t.me/Ashlynn_Repository
    const key = `user:${userId}:${token}`;
    const metaStr = await env.KV.get(key);
    
    if (!metaStr) {
        return notFound('This link is invalid or has expired');
    }
// Made by: https://t.me/Ashlynn_Repository
    const meta = JSON.parse(metaStr);
    const telegramFileUrl = await getTelegramFileLink(meta.fileId);

    if (!telegramFileUrl) {
        await env.KV.delete(key);
        return notFound('Could not retrieve file from Telegram. The link may have expired.');
    }
// Made by: https://t.me/Ashlynn_Repository
    try {
        const fileResponse = await fetch(telegramFileUrl);
        
        if (!fileResponse.ok) {
            await env.KV.delete(key);
            return serverError('Failed to fetch file from Telegram');
        }
// Made by: https://t.me/Ashlynn_Repository
        const headers = new Headers(fileResponse.headers);
        headers.set('Content-Disposition', `attachment; filename="${meta.fileName}"`);
        headers.set('Cache-Control', 'no-store, max-age=0');

        return new Response(fileResponse.body, {
            status: fileResponse.status,
            headers: headers
        });
    } catch (error) {
        console.error('File serving error:', error);
        await env.KV.delete(key);
        return serverError('Failed to process file download');
    }
}

// Made by: https://t.me/Ashlynn_Repository
async function sendUserLinks(chatId, userId) {
    const list = await env.KV.list({ prefix: `user:${userId}:` });
    
    if (list.keys.length === 0) {
        return sendTelegramMessage(chatId, 'ℹ️ You currently have no active download links.');
    }

    let message = '📂 Your Active Download Links:\n\n';
    
    for (const key of list.keys) {
        const value = await env.KV.get(key.name);
        if (!value) continue;

        const meta = JSON.parse(value);
        const token = key.name.split(':')[2];
        const link = `${env.WORKER_DOMAIN}/file/${userId}/${token}/${encodeURIComponent(meta.fileName)}`;
        
        message += `📄 ${meta.fileName}\n` +
                  `📏 Size: ${formatFileSize(meta.fileSize)}\n` +
                  `🔗 ${link}\n\n`;
    }

    message += `ℹ️ Total links: ${list.keys.length}\n` +
               '⚠️ Links expire after 24 hours of inactivity.';

    return sendTelegramMessage(chatId, message);
}

// Made by: https://t.me/Ashlynn_Repository
function extractFileInfo(message) {
    const file = message.document || message.video || message.audio || message.photo?.[message.photo.length - 1];
    if (!file) return {};

    const fileName = file.file_name || 
                   (message.video ? 'video.mp4' : 
                   message.audio ? 'audio.mp3' : 
                   'photo.jpg');
    
    return { 
        fileId: file.file_id, 
        fileName: fileName, 
        fileSize: file.file_size 
    };
}
// Made by: https://t.me/Ashlynn_Repository
async function verifyChannelMembership(userId) {
    try {
        const response = await fetch(`${TELEGRAM_API_URL}/getChatMember?chat_id=${env.CHANNEL_ID}&user_id=${userId}`);
        const data = await response.json();
        return data.ok && ['member', 'creator', 'administrator'].includes(data.result.status);
    } catch (error) {
        console.error('Membership verification failed:', error);
        return false;
    }
}
// Made by: https://t.me/Ashlynn_Repository
async function sendTelegramMessage(chatId, text) {
    try {
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text: text, 
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            }),
        });
    } catch (error) {
        console.error('Failed to send Telegram message:', error);
    }
    return okResponse();
}
// Made by: https://t.me/Ashlynn_Repository
async function getTelegramFileLink(fileId) {
    try {
        const response = await fetch(`${TELEGRAM_API_URL}/getFile?file_id=${fileId}`);
        const data = await response.json();
        return data.ok ? `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${data.result.file_path}` : null;
    } catch (error) {
        console.error('Failed to get Telegram file link:', error);
        return null;
    }
}
// Made by: https://t.me/Ashlynn_Repository
function generateSecureToken() {
    return crypto.randomUUID();
}
// Made by: https://t.me/Ashlynn_Repository
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Made by: https://t.me/Ashlynn_Repository
function okResponse() {
    return new Response('OK', { status: 200 });
}
// Made by: https://t.me/Ashlynn_Repository
function badRequest(message = 'Bad Request') {
    return new Response(message, { status: 400 });
}
// Made by: https://t.me/Ashlynn_Repository
function notFound(message = 'Not Found') {
    return new Response(message, { status: 404 });
}
// Made by: https://t.me/Ashlynn_Repository
function methodNotAllowed() {
    return new Response('Method Not Allowed', { status: 405 });
}
// Made by: https://t.me/Ashlynn_Repository
function serverError(message = 'Internal Server Error') {
    return new Response(message, { status: 500 });
}
