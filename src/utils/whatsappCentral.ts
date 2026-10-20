/**
 * Módulo de integración para el Servidor Automatizado de WhatsApp Central
 * Permite despachar comprobantes y recordatorios de cobranza desatendidos
 * sin requerir que los vendedores tengan WhatsApp abierto en su dispositivo.
 */

export interface WhatsAppCentralConfig {
  serverUrl: string;
  autoSend: boolean;
  apiKey?: string;
}

export interface WhatsAppStatusResponse {
  conectado: boolean;
  telefono?: string | null;
  nombre?: string | null;
  qr?: string | null;
  motivoDesconexion?: string | null;
  error?: string | null;
}

const STORAGE_KEY = 'ventas_score_whatsapp_central_config';

export function getWhatsAppCentralConfig(): WhatsAppCentralConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  return {
    serverUrl: '',
    autoSend: true,
    apiKey: '',
  };
}

export function saveWhatsAppCentralConfig(cfg: WhatsAppCentralConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

/**
 * Consulta el estado de la conexión y obtiene el código QR si está pendiente
 */
export async function checkWhatsAppCentralStatus(
  customUrl?: string
): Promise<WhatsAppStatusResponse> {
  const config = getWhatsAppCentralConfig();
  const url = (customUrl || config.serverUrl || '').trim().replace(/\/+$/, '');

  if (!url) {
    return {
      conectado: false,
      error: 'Servidor no configurado. Ingresa la URL de tu servidor en Render o Local.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    const res = await fetch(`${url}/api/status`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        conectado: false,
        error: `Error del servidor HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      conectado: Boolean(data.conectado),
      telefono: data.telefono || null,
      nombre: data.nombre || null,
      qr: data.qr || null,
      motivoDesconexion: data.motivoDesconexion || null,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        conectado: false,
        error: 'Tiempo de espera agotado al conectar con el servidor de WhatsApp.',
      };
    }
    return {
      conectado: false,
      error: 'No se pudo conectar con el servidor. Verifica que esté iniciado y accesible.',
    };
  }
}

/**
 * Envía un mensaje de texto por WhatsApp a través del servidor central
 */
export async function enviarWhatsAppCentral(
  telefono: string,
  mensaje: string
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const config = getWhatsAppCentralConfig();
  const url = (config.serverUrl || '').trim().replace(/\/+$/, '');

  if (!url) {
    return { ok: false, error: 'URL del servidor WhatsApp no configurada' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    const res = await fetch(`${url}/api/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        telefono,
        mensaje,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error: data.error || `Error HTTP ${res.status}`,
      };
    }

    return {
      ok: Boolean(data.ok),
      messageId: data.mensajeId,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado enviando mensaje' };
    }
    return { ok: false, error: err.message || 'Error de conexión' };
  }
}

/**
 * Cierra la sesión activa en el servidor para permitir volver a escanear un nuevo QR
 */
export async function desconectarWhatsAppCentral(customUrl?: string): Promise<boolean> {
  const config = getWhatsAppCentralConfig();
  const url = (customUrl || config.serverUrl || '').trim().replace(/\/+$/, '');
  if (!url) return false;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }
    const res = await fetch(`${url}/api/logout`, {
      method: 'POST',
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}
