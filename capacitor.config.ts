import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ventasscore.app',
  appName: 'Ventas Score',
  webDir: 'dist',
  server: {
    // Apunta directamente a la versión publicada en GitHub Pages
    url: 'https://benjachavez34-bot.github.io/PRUEBA-VENTAS-SCORE/',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    // Google bloquea inicios de sesión en WebViews si detecta la firma 'wv' o 'Version/4.0' (error: 403 disallowed_useragent)
    // Con overrideUserAgent usamos un User-Agent estándar de Chrome Mobile para permitir Google OAuth
    overrideUserAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
