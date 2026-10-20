const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const API_KEY = process.env.WHATSAPP_API_KEY || '';

let sock = null;
let qrCodeDataUrl = null;
let isConnected = false;
let connectedUser = null;
let lastDisconnectReason = null;

// Logger silencioso para no saturar consola con los paquetes binarios de WhatsApp
const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });

/**
 * Normaliza números de teléfono para WhatsApp:
 * Elimina espacios, guiones, paréntesis y signos +.
 * Asegura el formato internacional de Chile (código 56 + 9 dígitos) o el país correspondiente.
 */
function normalizarNumero(numero) {
  if (!numero) return null;
  let limpio = String(numero).replace(/\D/g, '');

  // Formato chileno: si tiene 9 dígitos y empieza con 9 (ej. 987654321), se le agrega 56
  if (limpio.length === 9 && limpio.startsWith('9')) {
    limpio = '56' + limpio;
  }
  // Si tiene 8 dígitos (ej. 87654321), se le agrega 569
  else if (limpio.length === 8) {
    limpio = '569' + limpio;
  }

  return limpio ? `${limpio}@s.whatsapp.net` : null;
}

/**
 * Inicia la conexión con los servidores de WhatsApp mediante Baileys
 */
async function iniciarConexionWhatsApp() {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] Usando versión Baileys: v${version.join('.')} (Última: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Ventas Score', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WhatsApp] Nuevo código QR generado. Listo para escanear.');
        try {
          qrCodeDataUrl = await qrcode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            scale: 7,
          });
        } catch (e) {
          console.error('[WhatsApp] Error convirtiendo QR a imagen:', e);
        }
      }

      if (connection === 'close') {
        isConnected = false;
        connectedUser = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        lastDisconnectReason = lastDisconnect?.error?.message || statusCode;

        console.log(
          `[WhatsApp] Conexión cerrada. Motivo: ${lastDisconnectReason}. Reconectando: ${shouldReconnect}`
        );

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[WhatsApp] Sesión cerrada desde el celular. Limpiando credenciales...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch {}
          qrCodeDataUrl = null;
          setTimeout(iniciarConexionWhatsApp, 3000);
        } else if (shouldReconnect) {
          setTimeout(iniciarConexionWhatsApp, 4000);
        }
      } else if (connection === 'open') {
        isConnected = true;
        qrCodeDataUrl = null;
        const userJid = sock.user?.id || '';
        const phone = userJid.split(':')[0] || userJid.split('@')[0];
        connectedUser = {
          id: userJid,
          telefono: phone,
          nombre: sock.user?.name || 'Ventas Score Central',
        };
        console.log(`[WhatsApp] ✅ ¡CONECTADO CON ÉXITO! Número activo: +${phone}`);
      }
    });
  } catch (error) {
    console.error('[WhatsApp] Error iniciando socket:', error);
    setTimeout(iniciarConexionWhatsApp, 5000);
  }
}

// ================= RUTAS DE LA API =================

// Middleware opcional de autenticación con API Key
function validarApiKey(req, res, next) {
  if (!API_KEY) return next();
  const keyProporcionada = req.headers['x-api-key'] || req.query.apiKey || req.body?.apiKey;
  if (keyProporcionada !== API_KEY) {
    return res.status(401).json({ error: 'No autorizado: API Key inválida o faltante' });
  }
  next();
}

/**
 * GET /api/status
 * Retorna el estado actual de la conexión y el código QR si está pendiente
 */
app.get('/api/status', (req, res) => {
  res.json({
    conectado: isConnected,
    telefono: connectedUser?.telefono || null,
    nombre: connectedUser?.nombre || null,
    qr: isConnected ? null : qrCodeDataUrl,
    motivoDesconexion: lastDisconnectReason,
    timestamp: Date.now(),
  });
});

/**
 * POST /api/send
 * Envía un mensaje de texto por WhatsApp al teléfono especificado
 * Body: { telefono: string, mensaje: string, apiKey?: string }
 */
app.post('/api/send', validarApiKey, async (req, res) => {
  const { telefono, mensaje } = req.body;

  if (!isConnected || !sock) {
    return res.status(503).json({
      ok: false,
      error: 'WhatsApp no está conectado aún. Por favor escanea el código QR en la administración.',
    });
  }

  if (!telefono || !mensaje) {
    return res.status(400).json({
      ok: false,
      error: 'Parámetros obligatorios faltantes: "telefono" y "mensaje"',
    });
  }

  const jid = normalizarNumero(telefono);
  if (!jid) {
    return res.status(400).json({
      ok: false,
      error: `Formato de número inválido: "${telefono}"`,
    });
  }

  try {
    const resultado = await sock.sendMessage(jid, { text: String(mensaje) });
    return res.json({
      ok: true,
      mensajeId: resultado.key.id,
      destinatario: jid,
      enviadoEn: Date.now(),
    });
  } catch (err) {
    console.error(`[WhatsApp] Error enviando mensaje a ${jid}:`, err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error al enviar mensaje por WhatsApp',
    });
  }
});

/**
 * POST /api/logout
 * Desconecta la sesión activa y borra credenciales para permitir vincular otro número
 */
app.post('/api/logout', validarApiKey, async (req, res) => {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
    }
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {}
    isConnected = false;
    connectedUser = null;
    qrCodeDataUrl = null;
    setTimeout(iniciarConexionWhatsApp, 2000);
    return res.json({ ok: true, mensaje: 'Sesión cerrada exitosamente. Generando nuevo QR...' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * Panel Web simple para ver estado o escanear QR directamente desde cualquier navegador
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ventas Score · Servidor WhatsApp Central</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; margin-bottom: 20px; }
        .badge-online { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; }
        .badge-offline { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid #eab308; }
        .qr-box { background: white; padding: 16px; border-radius: 16px; display: inline-block; margin: 20px 0; }
        .qr-box img { width: 260px; height: 260px; display: block; }
        .instructions { text-align: left; background: #0f172a; padding: 16px; border-radius: 12px; font-size: 0.88rem; line-height: 1.5; color: #cbd5e1; margin-top: 20px; }
        .instructions ol { margin: 8px 0 0 20px; padding: 0; }
        .btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-top: 14px; font-size: 0.9rem; }
        .btn:hover { background: #1d4ed8; }
      </style>
      <script>
        // Auto-refrescar cada 5 segundos si está esperando QR
        setTimeout(() => { location.reload(); }, 6000);
      </script>
    </head>
    <body>
      <div class="card">
        <h2 style="margin: 0 0 10px 0;">⚡ Ventas Score</h2>
        <p style="color: #94a3b8; margin: 0 0 20px 0; font-size: 0.95rem;">Servidor Automatizado de Despacho WhatsApp</p>
        
        ${
          isConnected
            ? `
            <div class="badge badge-online">🟢 CONECTADO Y ACTIVO</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #f8fafc; margin: 15px 0;">
              +${connectedUser?.telefono}
            </div>
            <p style="color: #94a3b8; font-size: 0.88rem;">
              Todos los comprobantes y avisos de cobranza se están enviando automáticamente desde esta cuenta.
            </p>
            <form action="/api/logout" method="POST" onsubmit="return confirm('¿Desconectar WhatsApp?');">
              <button class="btn" style="background: #dc2626;" type="submit">Desvincular WhatsApp</button>
            </form>
          `
            : `
            <div class="badge badge-offline">🟡 ESPERANDO ESCANEO DE QR</div>
            <div class="qr-box">
              ${
                qrCodeDataUrl
                  ? `<img src="${qrCodeDataUrl}" alt="Escanear Código QR WhatsApp" />`
                  : `<div style="width:260px;height:260px;display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:700;">Generando código QR...</div>`
              }
            </div>
            <div class="instructions">
              <b>Cómo vincular:</b>
              <ol>
                <li>Abre WhatsApp en el celular central de la empresa.</li>
                <li>Toca <b>Menú ⋮</b> o <b>Configuración</b>.</li>
                <li>Selecciona <b>Dispositivos vinculados</b>.</li>
                <li>Toca <b>Vincular un dispositivo</b> y apunta tu cámara a este código QR.</li>
              </ol>
            </div>
          `
        }
      </div>
    </body>
    </html>
  `);
});

// Iniciar servidor y socket de WhatsApp
app.listen(PORT, () => {
  console.log(`[Servidor] Escuchando en puerto ${PORT}`);
  iniciarConexionWhatsApp();
});
