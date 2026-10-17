const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function que se dispara automáticamente cuando un usuario envía un mensaje de chat.
 * Envía una notificación Push vía FCM a todos los teléfonos móviles registrados en `fcm_tokens`,
 * permitiendo que les llegue la notificación incluso con la pantalla apagada o la app cerrada.
 */
exports.enviarNotificacionNuevoMensaje = functions.firestore
  .document("mensajes/{msgId}")
  .onCreate(async (snap, context) => {
    const msg = snap.data();
    if (!msg) return null;

    try {
      // 1. Obtener todos los tokens FCM registrados en la base de datos
      const tokensSnap = await admin.firestore().collection("fcm_tokens").get();
      if (tokensSnap.empty) {
        console.log("[FCM] No hay tokens registrados en fcm_tokens.");
        return null;
      }

      const tokens = [];
      tokensSnap.forEach((doc) => {
        const d = doc.data();
        // Excluir al emisor del mensaje para no auto-notificarse
        if (
          d &&
          d.token &&
          d.userId !== msg.deEmail &&
          d.userId !== msg.deUid
        ) {
          tokens.push(d.token);
        }
      });

      if (tokens.length === 0) {
        console.log("[FCM] No hay destinatarios distintos al emisor.");
        return null;
      }

      const uniqueTokens = Array.from(new Set(tokens));

      const titulo = `💬 ${msg.deNombre || 'Compañero'}`;
      const cuerpo = msg.texto || 'Nuevo mensaje en Ventas Score';

      const payload = {
        notification: {
          title: titulo,
          body: cuerpo,
        },
        data: {
          tipo: 'chat',
          url: '/',
          mensajeId: context.params.msgId,
          deNombre: msg.deNombre || '',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
          },
        },
        tokens: uniqueTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`[FCM] Enviado a ${uniqueTokens.length} dispositivos. Éxito: ${response.successCount}, Fallos: ${response.failureCount}`);

      // Limpieza de tokens caducados
      if (response.failureCount > 0) {
        const tokensABorrar = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/registration-token-not-registered'
            ) {
              tokensABorrar.push(uniqueTokens[idx]);
            }
          }
        });

        for (const tok of tokensABorrar) {
          const snapshot = await admin.firestore().collection("fcm_tokens").where("token", "==", tok).get();
          snapshot.forEach((d) => d.ref.delete());
        }
      }

      return null;
    } catch (error) {
      console.error("[FCM] Error enviando notificación push:", error);
      return null;
    }
  });

/**
 * Procesa notificaciones directas encoladas en Firestore
 */
exports.procesarColaNotificaciones = functions.firestore
  .document("notificaciones_cola/{colaId}")
  .onCreate(async (snap, context) => {
    const item = snap.data();
    if (!item || !item.tokens || item.tokens.length === 0) return null;

    try {
      const payload = {
        notification: {
          title: item.titulo || 'Ventas Score',
          body: item.cuerpo || '',
        },
        data: {
          url: '/',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
          },
        },
        tokens: item.tokens,
      };

      const res = await admin.messaging().sendEachForMulticast(payload);
      await snap.ref.update({
        estado: 'enviado',
        exitos: res.successCount,
        fallos: res.failureCount,
        procesadoEn: new Date().toISOString(),
      });
      return null;
    } catch (e) {
      console.error("[FCM Cola] Error:", e);
      await snap.ref.update({ estado: 'error', error: String(e) });
      return null;
    }
  });
