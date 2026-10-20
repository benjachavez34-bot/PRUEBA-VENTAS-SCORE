# 📱 Servidor Automatizado de WhatsApp · Ventas Score

Microservicio autónomo de WhatsApp de costo $0 para despacho desatendido de comprobantes de venta, recordatorios de cobranza y resúmenes de turno.

---

## 🚀 Opción 1: Despliegue 100% Gratuito en la Nube (Render.com)

Render ofrece alojamiento gratuito para servicios Node.js que funcionan las 24 horas del día.

1. Crea una cuenta gratuita en [Render.com](https://render.com/).
2. Haz clic en **New + > Web Service**.
3. Selecciona tu repositorio de GitHub: `PRUEBA-VENTAS-SCORE`.
4. Configura los siguientes campos:
   - **Name**: `ventas-score-whatsapp` (o el nombre que prefieras).
   - **Root Directory**: `whatsapp-service` *(¡Importante!)*.
   - **Environment**: `Node`.
   - **Build Command**: `npm install`.
   - **Start Command**: `npm start`.
   - **Instance Type**: `Free`.
5. Haz clic en **Create Web Service**.
6. Render te asignará una URL pública (ejemplo: `https://ventas-score-whatsapp.onrender.com`).
7. Abre esa URL en tu navegador o cópiala en la app de Ventas Score en **Configuración > WhatsApp Central**.
8. ¡Escanea el código QR desde tu WhatsApp y listo!

---

## 💻 Opción 2: Ejecución Local en tu Computador

Si prefieres ejecutarlo en tu computador de la tienda:

```bash
cd whatsapp-service
npm install
npm start
```

El servidor iniciará en `http://localhost:3001`. Abre esa dirección en tu navegador para escanear el código QR.

---

## 📡 Endpoints de la API

- `GET /`: Panel visual con código QR en vivo o estado de conexión.
- `GET /api/status`: Estado en formato JSON (`{ conectado: boolean, telefono: string, qr: dataUrl }`).
- `POST /api/send`: Envío de mensaje.
  ```json
  {
    "telefono": "+56 9 8765 4321",
    "mensaje": "¡Gracias por tu compra en Ventas Score! Comprobante: #1234"
  }
  ```
- `POST /api/logout`: Desvincula la sesión y genera un código QR nuevo.
