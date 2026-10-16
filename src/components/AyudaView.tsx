import React, { useState, useRef, useEffect } from 'react';
import scoreGorillaLogo from '../assets/images/score_gorilla_bg_1791923074721.jpg';

interface MensajeIA {
  id: string;
  remitente: 'usuario' | 'ia';
  texto: string;
  ts: number;
}

interface AyudaViewProps {
  userName?: string;
  isAdmin?: boolean;
  onNavigateTab?: (tab: string) => void;
}

// Preguntas sugeridas para interacción rápida en 1 toque
const PREGUNTAS_RAPIDAS = [
  '¿Cómo registro una venta fiada?',
  '¿Cómo liquidar o registrar un abono a un deudor?',
  '¿Cómo funciona el stock y costo unitario?',
  '¿Cómo hacer un cierre de caja?',
  '¿Cómo exportar los datos a Excel?',
  '¿Qué permisos tienen los vendedores y administradores?',
];

// Motor de Conocimiento Especializado de Ventas Score
function responderDudaApp(pregunta: string, isAdmin: boolean): string {
  const q = pregunta.toLowerCase().trim();

  // Filtro de ámbito: Si no tiene que ver con la app o el negocio, restringir educadamente
  const palabrasClaveApp = [
    'venta', 'ventas', 'fiad', 'fiado', 'fiada', 'deud', 'deuda', 'deudor', 'deudores',
    'stock', 'producto', 'productos', 'precio', 'costo', 'entrada', 'mercader', 'inventario',
    'cierre', 'caja', 'ganancia', 'resumen', 'en cuenta', 'estadistica', 'estadísticas',
    'excel', 'exportar', 'miembro', 'miembros', 'chat', 'indicacion', 'indicación',
    'admin', 'administrador', 'vendedor', 'cuenta', 'perfil', 'avatar', 'telefono', 'teléfono',
    'score', 'gorilla', 'hola', 'ayuda', 'cómo', 'como', 'qué', 'que', 'quien', 'quién',
    'permiso', 'supervis', 'abono', 'pago', 'pagar', 'cobrar', 'ticket', 'invitado', 'app',
    'aplicacion', 'aplicación', 'tutorial', 'manual', 'funciona', 'usar'
  ];

  const esRelevante = palabrasClaveApp.some((kw) => q.includes(kw));

  if (!esRelevante) {
    return (
      '⚠️ **Ámbito restringido**:\n\n' +
      'Soy el asistente virtual especializado de **Ventas Score** 🦍.\n\n' +
      'Solo puedo responder consultas sobre el uso y las funciones de esta aplicación (gestión de ventas, control de deudores, stock, cierres de caja, reportes y permisos).\n\n' +
      '¿En qué duda de la app te puedo orientar hoy?'
    );
  }

  // Respuestas específicas según intención:

  // 1. Saludo
  if (q.includes('hola') || q.includes('buenos dias') || q.includes('buenas tardes')) {
    return (
      '¡Hola! 👋 Soy el asistente oficial de **Ventas Score**.\n\n' +
      'Estoy aquí para resolver cualquier duda que tengas sobre cómo registrar ventas, controlar inventario, gestionar deudas o entender tus números.\n\n' +
      '💡 Puedes seleccionar una de las preguntas frecuentes arriba o escribir directamente lo que necesitas saber.'
    );
  }

  // 2. Ventas fiadas y al contado
  if (q.includes('fiad') || (q.includes('venta') && (q.includes('cómo') || q.includes('como') || q.includes('registrar')))) {
    return (
      '🧾 **Cómo registrar una Venta**:\n\n' +
      '1. Ve a la pestaña **Venta**.\n' +
      '2. Selecciona el **Producto** en el menú desplegable. El sistema te mostrará automáticamente el stock actual disponible.\n' +
      '3. Ingresa la **Cantidad**. El precio y total se calculan de inmediato (puedes ajustar el precio si hay una oferta especial).\n' +
      '4. **Tipo de venta**:\n' +
      '   - **Al contado**: Deja la casilla "Fiado" desmarcada y pulsa **Registrar Venta**.\n' +
      '   - **Fiado / A crédito**: Marca la casilla **"Fiado"** y escribe el **nombre del cliente**. La venta se sumará automáticamente a la cuenta corriente del cliente en la pestaña **Deudores**.\n' +
      '5. Al registrarse, el stock del producto se descuenta automáticamente para mantener el inventario al día.'
    );
  }

  // 3. Deudores, pagos y abonos
  if (q.includes('deud') || q.includes('abono') || q.includes('cobrar') || q.includes('pagar') || q.includes('pagó todo')) {
    return (
      '👥 **Gestión de Deudores y Cobranza**:\n\n' +
      'En la pestaña **Deudores** verás la lista de todos los clientes con saldo pendiente:\n\n' +
      '• **Abono Parcial**: Haz clic en el botón verde **"Abonar"** en la tarjeta del cliente, ingresa el monto pagado y confirma. El saldo adeudado se reducirá y el dinero ingresará a caja.\n' +
      '• **Liquidación Total ("Pagó todo")**: Si el cliente cancela la totalidad de la deuda, pulsa **"Pagó todo"** para saldar la cuenta a $0.\n' +
      '• **Agregar Deuda Extra**: Si el cliente pide fiado productos adicionales o una deuda manual, pulsa **"+ Deuda"**. Puedes elegir si descuenta stock o solo suma saldo adeudado.\n' +
      '• **Historial**: Puedes tocar en **"Ver detalle"** de cada deudor para revisar cuándo y qué productos compró fiado.'
    );
  }

  // 4. Stock, inventario y costo
  if (q.includes('stock') || q.includes('costo') || q.includes('inventario') || q.includes('entrada') || q.includes('producto')) {
    return (
      '📦 **Control de Stock y Entradas de Mercadería**:\n\n' +
      '• **Crear Producto**: En la pestaña **Stock**, en la parte superior completa el nombre del producto, existencias iniciales, costo de compra y precio de venta recomendado.\n' +
      '• **Entrada de Mercadería (Reposición)**: Cuando compres más unidades para reponer, pulsa el botón **"+ Entrada"** en el producto correspondiente. Ingresa las unidades recibidas y el costo total pagado. El sistema recalcula automáticamente el **costo unitario ponderado**.\n' +
      '• **Venta Rápida**: Puedes vender 1 o más unidades directamente desde la tarjeta del producto con el botón de venta rápida.\n' +
      '• **Margen y Utilidad**: Cada tarjeta de producto muestra cuánto ganas en dinero y porcentaje por cada unidad vendida.'
    );
  }

  // 5. Cierres de caja y resumen
  if (q.includes('cierre') || q.includes('resumen') || q.includes('en cuenta') || q.includes('caja')) {
    if (!isAdmin) {
      return (
        '💰 **Cierres de Caja y Resumen Financiero**:\n\n' +
        'Las pestañas de **Resumen**, **Cierres de Caja** y **Estadísticas avanzadas** están reservadas exclusivamente para los **Administradores** por motivos de seguridad y confidencialidad comercial.\n\n' +
        'Como vendedor, tus ventas al contado y abonos cobrados se computan automáticamente en tiempo real en los números consolidados de la administración.'
      );
    }
    return (
      '💰 **Resumen y Cierre de Caja (Modo Administrador)**:\n\n' +
      '• **Inversión**: Total de dinero destinado a compras de stock.\n' +
      '• **Total Ingresado**: Dinero real cobrado (ventas al contado + abonos recibidos de deudores).\n' +
      '• **En Cuenta**: Dinero neto disponible tras restar la inversión realizada (`Ingresado - Inversión`).\n' +
      '• **Te Deben**: Saldo acumulado por cobrar a todos los clientes fiados.\n' +
      '• **Ganancia Neta**: Utilidad real calculada sobre las unidades efectivamente comercializadas.\n\n' +
      '🔒 **Cómo Cerrar Caja**: Pulsa el botón **"Cerrar Caja"** en el Resumen o Estadísticas, dale un nombre al período (ej. "Cierre Semana 1 - Octubre") y el sistema congelará y guardará el corte numerado en el historial para auditoría.'
    );
  }

  // 6. Exportación a Excel
  if (q.includes('excel') || q.includes('exportar') || q.includes('descargar') || q.includes('reporte')) {
    return (
      '📊 **Exportación de Datos a Excel (`.xlsx`)**:\n\n' +
      'Puedes descargar un informe financiero completo en cualquier momento:\n\n' +
      '1. Ve a la pestaña **Resumen** o **Estadísticas** (o desde el botón de exportación rápida).\n' +
      '2. Haz clic en el botón verde **"Exportar a Excel"**.\n' +
      '3. El sistema generará y descargará automáticamente un archivo con **5 hojas ordenadas**:\n' +
      '   - 👥 **Deudores**: Lista de saldos por cobrar y total pendiente.\n' +
      '   - 📦 **Stock**: Existencias actuales, precios y valoración de inventario.\n' +
      '   - 🧾 **Ventas**: Detalle cronológico de cada venta, vendedor responsable y método de pago.\n' +
      '   - 💰 **Resumen**: Totales de inversión, ingresos, cuenta y utilidad.\n' +
      '   - 📑 **Cierres**: Historial de cortes de caja oficiales archivados.'
    );
  }

  // 7. Permisos y Roles (Admin vs Vendedor)
  if (q.includes('permiso') || q.includes('admin') || q.includes('rol') || q.includes('supervis') || q.includes('quién') || q.includes('quien')) {
    return (
      '👑 **Roles y Permisos en Ventas Score**:\n\n' +
      '• **Administradores Autorizados**: **Benjamín Chávez** (`benja.chavez34@gmail.com`) y **Francisco Inzunza** (`fco.inzunza.re@gmail.com`).\n' +
      '  - Acceso total a: Ventas, Deudores, Stock, Resumen financiero, Estadísticas de rendimiento, Miembros de la empresa, Chat corporativo con emisión de indicaciones oficiales y Panel de Supervisión.\n\n' +
      '• **Vendedores (Equipo Comercial)**:\n' +
      '  - Acceso enfocado a: Registro de Ventas en ruta, consulta y cobranza de Deudores, catálogo de Stock disponible, configuración de su propio perfil en "Mi Cuenta" y esta sección de Ayuda IA.'
    );
  }

  // 8. Miembros y Chat corporativo
  if (q.includes('chat') || q.includes('miembro') || q.includes('indicacion') || q.includes('indicación') || q.includes('mensaje')) {
    return (
      '💬 **Directorio de Miembros y Chat**:\n\n' +
      '• **Directorio**: Muestra a los miembros del equipo con su cargo, sucursal, foto y botón de enlace directo a WhatsApp.\n' +
      '• **Canal de Chat**: Los administradores pueden emitir mensajes con categoría **"📢 Indicación Oficial"** o **"⚠️ Urgente"**, permitiendo coordinar rutas y metas en tiempo real con el equipo.\n' +
      '*(Nota: El acceso a este panel está reservado para la supervisión y administración corporativa).*'
    );
  }

  // 9. Perfil y Mi Cuenta
  if (q.includes('cuenta') || q.includes('perfil') || q.includes('avatar') || q.includes('foto') || q.includes('telefono')) {
    return (
      '👤 **Configuración de "Mi Cuenta"**:\n\n' +
      'Todos los usuarios pueden personalizar su información:\n' +
      '1. Pulsa en el botón **"👤 Mi Cuenta"** en la barra superior (o toca tu foto de perfil).\n' +
      '2. Puedes editar tu **Nombre y Apellidos**, **Teléfono de WhatsApp**, **Sucursal / Zona** y **Cargo**.\n' +
      '3. Elige tu **Avatar Corporativo**: Score Gorilla 🦍, Director 👔, Ejecutivo 💼 o Vendedor 🚀.\n' +
      '4. Pulsa **"Guardar cambios"** para que tus compañeros vean tu ficha actualizada en el directorio.'
    );
  }

  // Respuesta por defecto con orientación general
  return (
    '💡 **Asistencia de Ventas Score**:\n\n' +
    'Puedo guiarte detalladamente sobre cualquiera de estos temas:\n' +
    '• **Ventas**: Cómo vender al contado o a crédito (fiado).\n' +
    '• **Deudores**: Cómo registrar abonos parciales o liquidar una cuenta.\n' +
    '• **Stock**: Cómo agregar productos y registrar entradas de mercadería.\n' +
    '• **Cierres y Resumen**: Cómo interpretar los saldos e ingresos.\n' +
    '• **Exportación**: Cómo descargar el reporte de Excel.\n' +
    '• **Roles**: Diferencias entre cuenta Administrador y Vendedor.\n\n' +
    'Escribe tu pregunta con tus propias palabras o pulsa una de las sugerencias rápidas arriba.'
  );
}

export const AyudaView: React.FC<AyudaViewProps> = ({
  userName = 'Compañero',
  isAdmin = false,
  onNavigateTab,
}) => {
  const [mensajes, setMensajes] = useState<MensajeIA[]>([
    {
      id: 'bienvenida',
      remitente: 'ia',
      texto: `¡Hola ${userName}! 👋 Soy el Asistente Virtual de **Ventas Score** 🦍.\n\nEstoy aquí para responder cualquier duda sobre el funcionamiento de la aplicación: registro de ventas, deudores, control de stock, cierres de caja y reportes.\n\n¿En qué te puedo ayudar hoy?`,
      ts: Date.now(),
    },
  ]);
  const [inputTexto, setInputTexto] = useState<string>('');
  const [escribiendo, setEscribiendo] = useState<boolean>(false);
  const finChatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, escribiendo]);

  const handleEnviar = (textoAEnviar?: string) => {
    const texto = (textoAEnviar || inputTexto).trim();
    if (!texto) return;

    const nuevoMsgUsuario: MensajeIA = {
      id: 'usr-' + Date.now(),
      remitente: 'usuario',
      texto,
      ts: Date.now(),
    };

    setMensajes((prev) => [...prev, nuevoMsgUsuario]);
    if (!textoAEnviar) setInputTexto('');
    setEscribiendo(true);

    // Simulación de respuesta inteligente con micro-delay para naturalidad
    setTimeout(() => {
      const respuesta = responderDudaApp(texto, isAdmin);
      const nuevoMsgIA: MensajeIA = {
        id: 'ia-' + Date.now(),
        remitente: 'ia',
        texto: respuesta,
        ts: Date.now(),
      };
      setMensajes((prev) => [...prev, nuevoMsgIA]);
      setEscribiendo(false);
    }, 450);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* BANNER DE IDENTIFICACIÓN DE LA IA */}
      <div
        className="card"
        style={{
          padding: '12px 14px',
          margin: 0,
          background: 'linear-gradient(135deg, var(--card) 0%, rgba(37,99,235,0.06) 100%)',
          borderLeft: '4px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <img
          src={scoreGorillaLogo}
          alt="Score AI"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid var(--accent)',
            boxShadow: '0 0 10px rgba(37,99,235,0.35)',
            flexShrink: 0,
          }}
          referrerPolicy="no-referrer"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>ScoreBot — Asistente IA</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                background: 'var(--accent)',
                color: '#fff',
                padding: '1px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
              }}
            >
              Exclusivo de la App
            </span>
          </div>
          <div className="sub" style={{ fontSize: '0.78rem', marginTop: 2 }}>
            Responde dudas operativas sobre ventas, deudores, stock, números y cierres de caja.
          </div>
        </div>
      </div>

      {/* CHIPS DE PREGUNTAS RÁPIDAS (DESLIZABLES EN SMARTPHONES) */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {PREGUNTAS_RAPIDAS.map((pregunta, idx) => (
          <button
            key={idx}
            type="button"
            className="btn-ghost"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              flexShrink: 0,
            }}
            onClick={() => handleEnviar(pregunta)}
          >
            💬 {pregunta}
          </button>
        ))}
      </div>

      {/* VENTANA DE CONVERSACIÓN */}
      <div
        className="card"
        style={{
          padding: '12px',
          minHeight: 340,
          maxHeight: '58vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          margin: 0,
        }}
      >
        {mensajes.map((m) => {
          const esMio = m.remitente === 'usuario';

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: esMio ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              {!esMio && (
                <img
                  src={scoreGorillaLogo}
                  alt="IA"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid var(--accent)',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                  referrerPolicy="no-referrer"
                />
              )}

              <div
                style={{
                  maxWidth: '85%',
                  borderRadius: 14,
                  padding: '10px 14px',
                  background: esMio ? 'var(--accent)' : 'var(--bg)',
                  color: esMio ? '#ffffff' : 'var(--text)',
                  border: esMio ? 'none' : '1px solid var(--border)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {!esMio && (
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>🦍 ScoreBot</span>
                  </div>
                )}
                <div>{m.texto}</div>
              </div>
            </div>
          );
        })}

        {escribiendo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: '0.82rem' }}>
            <img
              src={scoreGorillaLogo}
              alt="IA"
              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
            <span>ScoreBot está escribiendo...</span>
          </div>
        )}
        <div ref={finChatRef} />
      </div>

      {/* CAJA DE ENTRADA DE TEXTO */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleEnviar();
        }}
        className="card"
        style={{
          padding: '8px 10px',
          margin: 0,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Escribe tu consulta sobre la app (ej: cómo fiar, cierres, stock)..."
          value={inputTexto}
          onChange={(e) => setInputTexto(e.target.value)}
          style={{ flex: 1, fontSize: '0.9rem' }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={!inputTexto.trim() || escribiendo}
          style={{
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          Enviar ➤
        </button>
      </form>
    </div>
  );
};
