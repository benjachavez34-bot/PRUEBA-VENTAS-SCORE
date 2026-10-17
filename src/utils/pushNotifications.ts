import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Inicializa el sistema de notificaciones Push en dispositivos móviles Android/iOS.
 * Si se ejecuta en un navegador web convencional, se omite de forma segura.
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
    // 1. Verificar y solicitar permisos de notificación (Android 13+)
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] Permiso de notificaciones no concedido');
      return;
    }

    // 2. Registrar el dispositivo en el servicio de FCM
    await PushNotifications.register();

    // 3. Listener: Token FCM recibido con éxito
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] Token FCM obtenido con éxito:', token.value);
      try {
        const id = userId || 'dispositivo_anonimo';
        const tokenRef = doc(db, 'fcm_tokens', `${id}_${token.value.slice(-8)}`);
        await setDoc(tokenRef, {
          userId: userId || null,
          token: token.value,
          platform: Capacitor.getPlatform(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('[Push] Token guardado en Firestore.');
      } catch (err) {
        console.error('[Push] Error guardando token en Firestore:', err);
      }
    });

    // 4. Listener: Errores durante el registro
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Push] Error al registrar notificaciones:', error);
    });

    // 5. Listener: Notificación recibida con la aplicación en primer plano
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notificación recibida en primer plano:', notification);
    });

    // 6. Listener: Al hacer clic en la notificación
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('[Push] Notificación tocada:', notification.actionId, notification.notification);
    });

  } catch (error) {
    console.error('[Push] Excepción al configurar notificaciones:', error);
  }
}
