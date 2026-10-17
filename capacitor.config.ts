import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ventasscore.app',
  appName: 'Ventas Score',
  webDir: 'dist',
  server: {
    // Apunta directamente a la versión publicada en GitHub Pages
    // Esto permite que cualquier cambio en GitHub se actualice automáticamente en el APK
    url: 'https://benjachavez34-bot.github.io/PRUEBA-VENTAS-SCORE/',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
