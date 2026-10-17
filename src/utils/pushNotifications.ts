import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { collection, doc, setDoc, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

let sharedAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Auto-desbloquear audio en el primer toque de pantalla (crucial para iOS Safari / iPhone)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {}
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('touchend', unlockAudio);
    window.removeEventListener('click', unlockAudio);
  };
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('touchend', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio, { passive: true });
}

export const isIosDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isStandalonePwa = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
};

/**
 * Sonido sutil y elegante de notificación (chime de doble tono)
 * Generado mediante la Web Audio API (compatible con todos los navegadores sin depender de archivos de audio externos).
 */
export function playNotificationSound() {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Tono 1: Mi5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Tono 2: Si5 (987.77 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.08);
    gain2.gain.setValueAtTime(0.22, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.32);
  } catch (e) {
    console.log('[Push Sound] Error audio:', e);
  }
}

/**
 * Muestra notificación en navegadores web (desktop / móviles / PWA)
 * Soporta Service Worker, constructor Notification, parpadeo de pestaña y sonido.
 */
export async function showBrowserNotification(
  title: string,
  body: string,
  icon: string = './icon-192.png'
) {
  // 1. Reproducir sonido de notificación
  playNotificationSound();

  if (typeof window === 'undefined') return;

  // 2. Parpadeo en el título de la pestaña si el usuario está en otra pestaña o minimizado
  if (document.hidden) {
    const originalTitle = document.title;
    let state = false;
    const interval = setInterval(() => {
      document.title = state ? `💬 ${title}` : originalTitle;
      state = !state;
    }, 1200);

    const onFocus = () => {
      clearInterval(interval);
      document.title = originalTitle;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('click', onFocus);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('click', onFocus);
  }

  // 3. Notificación de sistema
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          const swOptions: any = {
            body,
            icon,
            badge: './apple-touch-icon.png',
            vibrate: [200, 100, 200],
            tag: 'ventas-score-chat-' + Date.now(),
            data: { url: './', tab: 'miembros' },
          };
          await reg.showNotification(title, swOptions);
          return;
        }
      }
    } catch (e) {
      console.log('[Push SW fallback]', e);
    }

    try {
      new Notification(title, {
        body,
        icon,
      });
    } catch (e) {
      console.log('[Push Notification fallback]', e);
    }
  }
}

/**
 * Solicita explícitamente permisos de notificación al usuario
 */
export async function solicitarPermisoNotificaciones(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

/**
 * Inicializa el sistema de notificaciones Push en dispositivos móviles Android/iOS.
 */
export async function initializePushNotifications(userId?: string) {
  // Si estamos en entorno web (ej. PWA en Safari iOS o navegadores de escritorio)
  if (!Capacitor.isNativePlatform()) {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default' && userId) {
        try {
          await Notification.requestPermission();
        } catch (e) {
          console.log('[Push Web] Omitida solicitud de notificación:', e);
        }
      }
    }
    return;
  }

  try {
    // 1. Verificar y solicitar permisos de notificación en Android
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] Permiso de notificaciones no concedido en Android');
      return;
    }

    // 2. Registrar el dispositivo en el servicio de FCM
    await PushNotifications.register();

    // 3. Guardar Token FCM en Firestore para recibir push con la app cerrada
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] Token FCM obtenido con éxito:', token.value);
      try {
        const id = userId || 'dispositivo_anonimo';
        const tokenRef = doc(db, 'fcm_tokens', `${id}_${token.value.slice(-8)}`);
        await setDoc(
          tokenRef,
          {
            userId: userId || null,
            token: token.value,
            platform: Capacitor.getPlatform(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        console.log('[Push] Token guardado en Firestore.');
      } catch (err) {
        console.error('[Push] Error guardando token en Firestore:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Push] Error al registrar notificaciones:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notificación recibida en primer plano:', notification);
      playNotificationSound();
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('[Push] Notificación tocada:', notification.actionId, notification.notification);
    });
  } catch (error) {
    console.error('[Push] Excepción al configurar notificaciones:', error);
  }
}

/**
 * Registra una solicitud de notificación push en Firestore `notificaciones_cola`
 * para ser procesada por Cloud Functions o servicios en segundo plano hacia los
 * teléfonos que tengan la app cerrada.
 */
export async function registrarPushParaDispositivos(
  titulo: string,
  cuerpo: string,
  remitenteId?: string,
  remitenteEmail?: string
) {
  try {
    // 1. Obtener los tokens de otros dispositivos registrados
    const tokensSnap = await getDocs(collection(db, 'fcm_tokens'));
    const tokens: string[] = [];

    tokensSnap.forEach((d) => {
      const data = d.data();
      if (
        data &&
        data.token &&
        data.userId !== remitenteId &&
        data.userId !== remitenteEmail
      ) {
        tokens.push(data.token);
      }
    });

    const uniqueTokens = Array.from(new Set(tokens));

    // 2. Encolar en Firestore para que la Cloud Function o webhook lo despache
    await addDoc(collection(db, 'notificaciones_cola'), {
      titulo,
      cuerpo,
      remitenteId: remitenteId || 'sistema',
      remitenteEmail: remitenteEmail || '',
      tokens: uniqueTokens,
      totalDestinatarios: uniqueTokens.length,
      estado: 'pendiente',
      creadoEn: new Date().toISOString(),
      timestamp: Date.now(),
    });

    console.log(`[Push] Encolada notificación para ${uniqueTokens.length} dispositivos móviles.`);
  } catch (e) {
    console.warn('[Push] Error encolando notificación móvil:', e);
  }
}
