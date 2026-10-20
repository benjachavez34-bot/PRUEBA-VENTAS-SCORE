const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
} = require('firebase/firestore');

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');

// Configuración de Firebase para persistencia de sesión en la nube
const firebaseConfig = {
  apiKey: "AIzaSyCIXW601maH0oKBkOgzcdfBUKFHM5W6r2I",
  authDomain: "ventas-score.firebaseapp.com",
  projectId: "ventas-score",
  storageBucket: "ventas-score.firebasestorage.app",
  messagingSenderId: "363479878821",
  appId: "1:363479878821:web:5e65569ea143ae4dd6914c",
};

const fbApp = initializeApp(firebaseConfig);
const fbDb = getFirestore(fbApp);
const SESSION_COLLECTION = 'whatsapp_session';

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
let isConnecting = false;
let serverExternalUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || '';
let keepAliveTimer = null;

// Middleware para auto-detectar URL externa si no se configuró en variables de entorno
app.use((req, res, next) => {
  if (!serverExternalUrl && req.headers.host && !req.headers.host.includes('localhost') && !req.headers.host.includes('127.0.0.1')) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    serverExternalUrl = `${proto}://${req.headers.host}`;
    console.log(`[KeepAlive] 🌐 Auto-detectada URL externa: ${serverExternalUrl}`);
    iniciarKeepAlive();
  }
  next();
});

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

  if (limpio.length === 9 && limpio.startsWith('9')) {
    limpio = '56' + limpio;
  } else if (limpio.length === 8) {
    limpio = '569' + limpio;
  }

  return limpio ? `${limpio}@s.whatsapp.net` : null;
}

/**
 * Restaura los archivos de sesión desde Firestore a la carpeta local auth_info_baileys
 * Esto garantiza que en Render (donde el disco se borra tras dormir), la sesión se recupere al 100%.
 */
async function restaurarSesionDesdeFirestore() {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const snapshot = await getDocs(collection(fbDb, SESSION_COLLECTION));
    if (snapshot.empty) {
      console.log('[Firestore] No hay sesión previa guardada en Firestore.');
      return false;
    }

    let archivosRestaurados = 0;
    snapshot.forEach((d) => {
      const data = d.data();
      if (data && data.content) {
        // En Firestore reemplazamos puntos por ___ para compatibilidad con IDs
        const fileName = d.id.replace(/___/g, '.');
        const filePath = path.join(AUTH_DIR, fileName);
        fs.writeFileSync(filePath, data.content, 'utf-8');
        archivosRestaurados++;
      }
    });

    console.log(`[Firestore] ✅ Sesión recuperada: ${archivosRestaurados} archivos de autenticación restaurados.`);
    return archivosRestaurados > 0;
  } catch (err) {
    console.warn('[Firestore] Error restaurando sesión:', err.message);
    return false;
  }
}

/**
 * Guarda todos los archivos de autenticación de auth_info_baileys en Firestore
 */
async function sincronizarSesionHaciaFirestoreInmediato() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    if (files.length === 0) return;

    const writePromises = files.map(async (file) => {
      const filePath = path.join(AUTH_DIR, file);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const docId = file.replace(/\./g, '___');
        return setDoc(
          doc(fbDb, SESSION_COLLECTION, docId),
          {
            content,
            fileName: file,
            actualizadoEn: Date.now(),
          },
          { merge: true }
        );
      }
    });

    await Promise.all(writePromises);
    console.log(`[Firestore] 💾 Sesión sincronizada y asegurada en Firestore (${files.length} archivos).`);
  } catch (err) {
    console.warn('[Firestore] Error sincronizando sesión a Firestore:', err.message);
  }
}

let syncTimer = null;
function sincronizarSesionHaciaFirestore() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    await sincronizarSesionHaciaFirestoreInmediato();
  }, 1200);
}

/**
 * Borra la sesión en Firestore cuando el usuario explícitamente se desvincula
 */
async function limpiarSesionEnFirestore() {
  try {
    const snapshot = await getDocs(collection(fbDb, SESSION_COLLECTION));
    const batchPromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(batchPromises);
    console.log('[Firestore] Colección de sesión eliminada.');
  } catch (err) {
    console.warn('[Firestore] Error limpiando sesión en Firestore:', err.message);
  }
}

/**
 * Inicia la conexión con los servidores de WhatsApp mediante Baileys
 */
async function iniciarConexionWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    // 1. Restaurar sesión previa de Firestore si el contenedor de Render se reinició
    await restaurarSesionDesdeFirestore();

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    // 2. Limpiar instancia previa de socket si existía
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end(undefined);
      } catch {}
      sock = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] Usando versión Baileys: v${version.join('.')} (Última: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      sincronizarSesionHaciaFirestore();
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WhatsApp] Código QR disponible para escanear.');
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
        isConnecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        lastDisconnectReason = lastDisconnect?.error?.message || statusCode;

        console.log(
          `[WhatsApp] Conexión cerrada. Código: ${statusCode}. Motivo: ${lastDisconnectReason}. Reconectando: ${shouldReconnect}`
        );

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[WhatsApp] Sesión cerrada explícitamente desde WhatsApp. Limpiando credenciales...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch {}
          await limpiarSesionEnFirestore();
          qrCodeDataUrl = null;
          setTimeout(iniciarConexionWhatsApp, 3000);
        } else if (shouldReconnect) {
          // Reintento automático preservando credenciales
          setTimeout(iniciarConexionWhatsApp, 3500);
        }
      } else if (connection === 'open') {
        isConnected = true;
        isConnecting = false;
        qrCodeDataUrl = null;
        const userJid = sock.user?.id || '';
        const phone = userJid.split(':')[0] || userJid.split('@')[0];
        connectedUser = {
          id: userJid,
          telefono: phone,
          nombre: sock.user?.name || 'Ventas Score Central',
        };
        console.log(`[WhatsApp] ✅ ¡CONECTADO CON ÉXITO! Número activo: +${phone}`);
        // Guardar estado actualizado en Firestore de inmediato
        await sincronizarSesionHaciaFirestoreInmediato();
      }
    });
  } catch (error) {
    isConnecting = false;
    console.error('[WhatsApp] Error iniciando socket:', error);
    setTimeout(iniciarConexionWhatsApp, 5000);
  }
}

// ================= RUTAS DE LA API =================

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
      error: 'WhatsApp no está conectado aún o se está reconectando. Intenta de nuevo en unos segundos.',
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
 * Desconecta la sesión activa y borra credenciales tanto locales como en Firestore
 */
app.post('/api/logout', validarApiKey, async (req, res) => {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
    }
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {}
    await limpiarSesionEnFirestore();
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
 * Panel Web visual para monitoreo y escaneo de QR
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
        // Auto-refrescar cada 6 segundos si está esperando QR
        ${!isConnected ? "setTimeout(() => { location.reload(); }, 6000);" : ""}
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
              Sesión guardada en Firestore y sincronizada. Los comprobantes y avisos de cobranza se envían automáticamente.
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

/**
 * Auto-KeepAlive Ping para evitar que Render se duerma tras 15 minutos de inactividad
 */
function iniciarKeepAlive() {
  if (keepAliveTimer) return;
  const urlBase = serverExternalUrl;
  if (!urlBase) {
    console.log('[KeepAlive] Nota: URL externa aún no configurada (se auto-detectará con la primera petición).');
    return;
  }

  const pingUrl = `${urlBase.replace(/\/+$/, '')}/api/status`;
  console.log(`[KeepAlive] ⏱️ Iniciado monitor anti-suspensión cada 8 minutos a ${pingUrl}`);

  keepAliveTimer = setInterval(async () => {
    try {
      const res = await fetch(pingUrl);
      if (res.ok) {
        console.log(`[KeepAlive] Ping exitoso: servidor activo (HTTP ${res.status})`);
      }
    } catch (e) {
      console.log('[KeepAlive] Ping fallido:', e.message);
    }
  }, 8 * 60 * 1000); // Cada 8 minutos (Render duerme a los 15 min)
}

// Asegurar guardado en Firestore si Render envía señal de reinicio o apagado
process.on('SIGTERM', async () => {
  console.log('[Servidor] Señal SIGTERM recibida. Asegurando sesión en Firestore antes de apagar...');
  await sincronizarSesionHaciaFirestoreInmediato();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Servidor] Señal SIGINT recibida. Asegurando sesión en Firestore antes de apagar...');
  await sincronizarSesionHaciaFirestoreInmediato();
  process.exit(0);
});

// Iniciar servidor y socket de WhatsApp
app.listen(PORT, () => {
  console.log(`[Servidor] Escuchando en puerto ${PORT}`);
  iniciarConexionWhatsApp();
  iniciarKeepAlive();
});
