// Service Worker para Ventas Score PWA (iOS y Web)
const CACHE_NAME = 'ventas-score-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manejo de notificaciones push en iOS Safari PWA y navegadores
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Ventas Score', body: event.data.text() };
    }
  }

  const title = data.notification?.title || data.title || 'Ventas Score';
  const options = {
    body: data.notification?.body || data.body || 'Nueva actualización registrada en Ventas Score',
    icon: './icon-192.png',
    badge: './apple-touch-icon.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE_TAB', tab: 'miembros' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});
