import React, { useState, useRef, useEffect } from 'react';
import scoreGorillaLogo from '../assets/images/score_gorilla_bg_1791923074721.jpg';

interface AccionSugerida {
  label: string;
  tab: string;
  icon?: string;
}

interface MensajeIA {
  id: string;
  remitente: 'usuario' | 'ia';
  texto: string;
  ts: number;
  accion?: AccionSugerida;
}

interface AyudaViewProps {
  userName?: string;
  isAdmin?: boolean;
  onNavigateTab?: (tab: string) => void;
}

// Preguntas sugeridas para interacción rápida en 1 toque
const PREGUNTAS_RAPIDAS = [
  '🛒 ¿Cómo usar el carrito POS y código de barras?',
  '🔒 ¿Cómo funciona el cierre de caja ciego y arqueo?',
  '🗑️ ¿Cómo registrar mermas o productos dañados?',
  '📲 ¿Cómo cobrar deudas por WhatsApp?',
  '📈 ¿Cómo ver horas punta y rentabilidad de stock?',
  '💳 ¿Cómo cobrar con débito o transferencia?',
  '🔑 ¿Cómo cambiar mi PIN de ingreso rápido?',
  '📊 ¿Cómo exportar reportes a Excel o WhatsApp?',
];

interface RespuestaIA {
  texto: string;
  accion?: AccionSugerida;
}

// Motor de Conocimiento Especializado de Ventas Score (Actualizado Fases 1 a 5)
function responderDudaApp(pregunta: string, isAdmin: boolean): RespuestaIA {
  const q = pregunta.toLowerCase().trim();

  // 1. Saludos
  if (
    q.includes('hola') ||
    q.includes('buenos dias') ||
    q.includes('buenas tardes') ||
    q.includes('buenas noches') ||
    q.includes('hey')
  ) {
    return {
      texto:
        '¡Hola! 👋 Soy **ScoreBot**, el asistente de inteligencia artificial de **Ventas Score** 🦍.\n\n' +
        'He sido actualizado con todo el conocimiento de las nuevas herramientas de la plataforma:\n\n' +
        '• 🛒 **Punto de Venta (POS)**: Carrito multiproducto, código de barras y vuelto.\n' +
        '• 📲 **Cobranza WhatsApp**: Notificaciones automáticas con datos de transferencia y tickets.\n' +
        '• 📦 **Stock & Mermas**: Categorías, stock mínimo y bajas contables.\n' +
        '• 🔒 **Cierre de Caja Ciego**: Arqueo real vs esperado y auditoría de descuadre.\n' +
        '• 📊 **Business Intelligence**: Horas punta 24h, rentabilidad de productos y auditoría.\n\n' +
        '¿Sobre qué función te gustaría aprender hoy?',
    };
  }

  // 2. POS, Carrito Multiproducto, Código de Barras y Calculadora de Vuelto
  if (
    q.includes('carrito') ||
    q.includes('pos') ||
    q.includes('codigo de barra') ||
    q.includes('código de barra') ||
    q.includes('lector') ||
    q.includes('escan') ||
    q.includes('escaner') ||
    q.includes('escáner') ||
    q.includes('vuelto') ||
    q.includes('cambio') ||
    (q.includes('venta') && (q.includes('multiproducto') || q.includes('varios')))
  ) {
    return {
      texto:
        '🛒 **Punto de Venta (POS) con Carrito & Escáner**:\n\n' +
        '1. **Armar Carrito**: En la pestaña **Ventas**, selecciona cualquier producto del catálogo o usa la barra de búsqueda y toca **"Agregar al Carrito"**. Puedes sumar múltiples productos diferentes en una sola transacción.\n' +
        '2. **Lector de Código de Barras**: Pulsa el botón **📷 Escanear** para abrir la cámara de tu smartphone y apuntar al código de barras del producto. Al detectarlo, se sumará automáticamente al carrito.\n' +
        '3. **Medios de Pago**: Elige entre Efectivo, Transferencia, Débito / Tarjetas POS o Fiado.\n' +
        '4. **Calculadora de Vuelto**: Si el cliente paga en efectivo, el sistema te muestra botones rápidos de billetes chilenos ($20.000, $10.000, $5.000, etc.) o puedes ingresar el monto recibido. Te calculará el vuelto exacto al instante.\n' +
        '5. **Ticket Digital**: Tras confirmar, puedes enviar el ticket detallado de la compra directamente al WhatsApp del cliente.',
      accion: { label: 'Ir al Punto de Venta (POS)', tab: 'venta', icon: '🛒' },
    };
  }

  // 3. Medios de Pago (Efectivo, Transferencia, Débito, Fiado)
  if (
    q.includes('medio de pago') ||
    q.includes('medios de pago') ||
    q.includes('debito') ||
    q.includes('débito') ||
    q.includes('tarjeta') ||
    q.includes('transferencia') ||
    q.includes('pos')
  ) {
    return {
      texto:
        '💳 **Medios de Pago Disponibles**:\n\n' +
        'Al registrar una venta puedes elegir cómo paga tu cliente:\n\n' +
        '• 💵 **Efectivo**: Conteo en dinero físico. Activa la calculadora de vuelto con billetes chilenos.\n' +
        '• 🏦 **Transferencia**: Para transferencias bancarias verificadas en la cuenta de la empresa.\n' +
        '• 💳 **Débito / POS**: Para cobros con máquina de tarjetas (Transbank, Getnet, SumUp, etc.).\n' +
        '• 🏷️ **Fiado (Crédito)**: Suma la deuda a la cuenta corriente del cliente en la pestaña Deudores.\n\n' +
        '💡 Todos los medios de pago se separan y concilian automáticamente en el **Cierre de Caja** y en las **Estadísticas de Negocio**.',
      accion: { label: 'Ir a Ventas', tab: 'venta', icon: '💳' },
    };
  }

  // 4. Mermas, Desperdicios y Bajas de Stock
  if (
    q.includes('merma') ||
    q.includes('mermas') ||
    q.includes('roto') ||
    q.includes('rotos') ||
    q.includes('vencid') ||
    q.includes('dañad') ||
    q.includes('degustacion') ||
    q.includes('baja')
  ) {
    return {
      texto:
        '🗑️ **Registro de Mermas y Bajas de Stock**:\n\n' +
        'Cuando un producto se rompe, vence o se utiliza para degustación/muestra:\n\n' +
        '1. Ve a la pestaña **Stock**.\n' +
        '2. En la tarjeta del producto, pulsa el botón **"🗑️ Merma"**.\n' +
        '3. Ingresa la **Cantidad de unidades** y el **Motivo**: Vencimiento, Rotura/Daño, Degustación/Muestra u Otro.\n' +
        '4. **Impacto Contable Inteligente**:\n' +
        '   - Descuenta el stock físico de inmediato para mantener el inventario 100% exacto.\n' +
        '   - **NO** altera el dinero de caja (no fue una venta ni un ingreso).\n' +
        '   - Registra el costo de la pérdida en el resumen contable e historial de mermas.',
      accion: { label: 'Ir a Control de Stock', tab: 'stock', icon: '📦' },
    };
  }

  // 5. Cierre de Caja Ciego, Arqueo y Descuadre
  if (
    q.includes('cierre ciego') ||
    q.includes('arqueo') ||
    q.includes('descuadre') ||
    q.includes('cuadrada') ||
    q.includes('sobrante') ||
    q.includes('faltante') ||
    (q.includes('cierre') && (q.includes('caja') || q.includes('turno')))
  ) {
    if (!isAdmin) {
      return {
        texto:
          '🔒 **Cierre de Caja & Arqueo**:\n\n' +
          'El cierre oficial de caja y la auditoría de turno están reservados para los **Administradores**.\n\n' +
          'Como vendedor, el sistema computa tus ventas y cobros en tiempo real para que el supervisor realice el arqueo al final del turno.',
      };
    }
    return {
      texto:
        '🔒 **Cierre de Caja Ciego & Conciliación Multimedio**:\n\n' +
        '1. Ve a **Resumen** y pulsa **"🔒 Cerrar caja"**.\n' +
        '2. **Modo Guiado vs Conteo Ciego**: Puedes activar el "Modo Conteo Ciego" para ingresar el dinero físico sin ver las expectativas del sistema, evitando sesgos en el cajero.\n' +
        '3. **Arqueo por Medio de Pago**:\n' +
        '   - **Efectivo contado**: Con calculadora rápida de billetes ($20k, $10k, $5k, etc.).\n' +
        '   - **Transferencias**: Total verificado en cuenta bancaria.\n' +
        '   - **Tarjetas Débito**: Total de vouchers de la máquina POS.\n' +
        '4. **Auditoría de Descuadre en Vivo**:\n' +
        '   - 🟢 **Caja Cuadrada ($0)**: Coincidencia perfecta.\n' +
        '   - 🟡 **Sobrante (+)**: Dinero excedente en caja.\n' +
        '   - 🔴 **Faltante (-)**: Alerta destacada para justificación.\n' +
        '5. **Reporte WhatsApp**: Al confirmar, puedes enviar el comprobante oficial formateado directamente al dueño o supervisor.',
      accion: { label: 'Ir a Resumen y Cierre', tab: 'resumen', icon: '🔒' },
    };
  }

  // 6. Deudores, Cobranza WhatsApp y Datos Bancarios
  if (
    q.includes('deud') ||
    q.includes('cobranza') ||
    q.includes('abono') ||
    q.includes('cuenta rut') ||
    q.includes('bancoestado') ||
    q.includes('datos bancarios') ||
    q.includes('moros') ||
    q.includes('limite de credito')
  ) {
    return {
      texto:
        '👥 **Cobranza WhatsApp & Gestión de Deudores**:\n\n' +
        '• **Cobro en 1 Toque por WhatsApp**: Toca el botón de WhatsApp en la tarjeta del deudor. El sistema redactará un mensaje con el saldo adeudado y los **datos de transferencia bancaria de Benjamín Chávez** (BancoEstado, Cuenta RUT 20.627.873-0).\n' +
        '• **Comprobante de Abono**: Al registrar un abono parcial o liquidación total, puedes enviarle un comprobante digital inmediato con su saldo anterior y saldo restante.\n' +
        '• **Semáforo de Morosidad**:\n' +
        '   - 🟢 **Al día** (deuda reciente < 15 días).\n' +
        '   - 🟡 **Moroso** (entre 15 y 30 días de antigüedad).\n' +
        '   - 🔴 **Crítico** (más de 30 días sin registrar abonos).\n' +
        '• **Límite de Crédito**: Puedes fijar un monto máximo de fiado por cliente para proteger el capital.',
      accion: { label: 'Ir a Deudores', tab: 'deudores', icon: '👥' },
    };
  }

  // 7. Horas Punta, Rentabilidad y Business Intelligence
  if (
    q.includes('hora punta') ||
    q.includes('horas punta') ||
    q.includes('rentabilidad') ||
    q.includes('estrella') ||
    q.includes('estancad') ||
    q.includes('agotamiento') ||
    q.includes('dias de stock') ||
    q.includes('inteligencia') ||
    q.includes('bi')
  ) {
    if (!isAdmin) {
      return {
        texto:
          '📈 **Business Intelligence & Métricas**:\n\n' +
          'El panel de analítica avanzada, horas punta y matrices de rentabilidad está reservado para los **Administradores**.',
      };
    }
    return {
      texto:
        '📈 **Business Intelligence & Analítica de Negocio**:\n\n' +
        'En la pestaña **Estadísticas** encontrarás herramientas de alta dirección:\n\n' +
        '• ⏰ **Horas Punta (24h)**: Gráfico de ventas por hora del día con detección de la **Hora Pico** de mayor facturación para optimizar turnos y promociones.\n' +
        '• 💳 **Cuota por Medio de Pago**: Participación porcentual de Efectivo, Transferencia, Débito y Fiado.\n' +
        '• 📊 **Matriz de Rentabilidad & Días de Stock**:\n' +
        '   - 🌟 **Producto Estrella**: Alto margen y alta rotación.\n' +
        '   - 💎 **Rentable**: Margen superior al 35%.\n' +
        '   - 🚨 **Alerta Crítica**: Productos con stock para **<= 3 días** según su ritmo de venta.\n' +
        '   - 🧊 **Estancado**: Productos en bodega sin ventas en el período.\n' +
        '• 🛡️ **Registro de Auditoría**: Trazabilidad completa por tipo de operación y vendedor.\n' +
        '• 📲 **Reporte Ejecutivo WhatsApp**: Envía un resumen gerencial en 1 clic.',
      accion: { label: 'Ir a Estadísticas BI', tab: 'estadisticas', icon: '📈' },
    };
  }

  // 8. Stock Mínimo, Categorías y Reposición
  if (
    q.includes('stock minimo') ||
    q.includes('stock mínimo') ||
    q.includes('categoria') ||
    q.includes('categoría') ||
    q.includes('alerta') ||
    q.includes('reposicion') ||
    q.includes('reposición')
  ) {
    return {
      texto:
        '📦 **Stock Mínimo & Categorías de Productos**:\n\n' +
        '• **Filtros por Categoría**: Tanto en **Stock** como en el **Punto de Venta** puedes filtrar por Energéticas, Bebidas, Snacks, etc., para ubicar productos velozmente.\n' +
        '• **Stock Mínimo Personalizado**: Al crear o editar un producto puedes definir su umbral crítico (ej: 5 unidades).\n' +
        '• **Banner de Alerta Urgente**: Si algún producto cae por debajo de su stock mínimo, aparecerá un banner rojo arriba de la pantalla avisando exactamente qué producto necesita reposición urgente.',
      accion: { label: 'Ir a Stock', tab: 'stock', icon: '📦' },
    };
  }

  // 9. PIN de Acceso Rápido y Perfil
  if (
    q.includes('pin') ||
    q.includes('ingreso rapido') ||
    q.includes('ingreso rápido') ||
    q.includes('perfil') ||
    q.includes('avatar') ||
    q.includes('contraseña')
  ) {
    return {
      texto:
        '🔑 **PIN de Ingreso Rápido & Perfil**:\n\n' +
        '• **Cambiar tu PIN**: Ve a **Configuración** o pulsa en **"Mi Perfil"**. Encontrarás el campo para definir un PIN de 4 dígitos. Con este PIN puedes entrar a la app en 1 segundo sin necesidad de escribir tu correo o contraseña cada vez.\n' +
        '• **Datos de Contacto**: Puedes actualizar tu nombre, teléfono de WhatsApp y sucursal asignada.\n' +
        '• **Avatar Corporativo**: Elige tu insignia entre el Gorilla Score 🦍, Director 👔, Ejecutivo 💼 o Vendedor 🚀.',
      accion: { label: 'Ir a Configuración', tab: 'configuracion', icon: '⚙️' },
    };
  }

  // 10. Supervisión y Evaluación de Vendedores
  if (
    q.includes('supervis') ||
    q.includes('evalua') ||
    q.includes('estrellas') ||
    q.includes('puntuacion') ||
    q.includes('puntuación') ||
    q.includes('vendedor')
  ) {
    if (!isAdmin) {
      return {
        texto:
          '⭐ **Evaluación y Desempeño Comercial**:\n\n' +
          'El panel de supervisión y evaluación de vendedores permite al supervisor medir la efectividad en ventas, cobranza y atención al cliente.',
      };
    }
    return {
      texto:
        '⭐ **Supervisión & Evaluación de Vendedores**:\n\n' +
        'En la pestaña **Supervisión** (solo administradores):\n\n' +
        '• **Métricas por Vendedor**: Ventas totales, unidades comercializadas, ticket promedio y efectividad de cobranza de fiados.\n' +
        '• **Evaluación Profesional de 4 Criterios** (1 a 5 estrellas):\n' +
        '   1. Cumplimiento de Metas.\n' +
        '   2. Cobranza de Fiados.\n' +
        '   3. Servicio al Cliente.\n' +
        '   4. Cuadratura de Stock y Arqueo.\n' +
        '• **Puntaje Ponderado**: Calcula automáticamente la calificación general oficial del vendedor con notas del supervisor.',
      accion: { label: 'Ir a Supervisión', tab: 'equipo', icon: '⭐' },
    };
  }

  // 11. Exportación a Excel y Reportes
  if (
    q.includes('excel') ||
    q.includes('exportar') ||
    q.includes('descargar') ||
    q.includes('informe') ||
    q.includes('reporte')
  ) {
    return {
      texto:
        '📊 **Exportación de Datos a Excel & Reportes WhatsApp**:\n\n' +
        '• **Libro Excel Completo (.xlsx)**: En Estadísticas o Resumen pulsa **"📊 Exportar Excel"**. Genera un archivo con 5 hojas ordenadas:\n' +
        '   - 👥 **Deudores**: Saldos pendientes y teléfonos.\n' +
        '   - 📦 **Stock**: Existencias y valoración.\n' +
        '   - 🧾 **Ventas**: Desglose con medio de pago y vendedor.\n' +
        '   - 💰 **Resumen**: Balance financiero general.\n' +
        '   - 📑 **Cierres**: Historial de arqueos con estado de cuadratura.\n\n' +
        '• **Reporte WhatsApp Ejecutivo**: En Estadísticas pulsa **"📲 Reporte WhatsApp"** para enviar el resumen del negocio directo a tu celular.',
      accion: { label: 'Ir a Estadísticas', tab: 'estadisticas', icon: '📊' },
    };
  }

  // 12. Permisos y Roles
  if (
    q.includes('permiso') ||
    q.includes('admin') ||
    q.includes('administrador') ||
    q.includes('rol') ||
    q.includes('quién') ||
    q.includes('quien')
  ) {
    return {
      texto:
        '👑 **Roles y Niveles de Autorización en Ventas Score**:\n\n' +
        '• **Administrador Principal & Propietario**: **Benjamín Chávez** (`benja.chavez34@gmail.com`).\n' +
        '  - Posee la facultad exclusiva de **otorgar y revocar permisos de Administrador** a cualquier miembro del equipo directamente desde la pestaña "Miembros & Chat".\n\n' +
        '• **Nivel Administrador**:\n' +
        '  - Acceso total a: Caja y Turnos, Arqueo Ciego, Estadísticas BI predictivas, Reporte de Rentabilidad por producto, Márgenes de Costo, Valoración de Bodega, Mermas express y Supervisión del equipo de ventas.\n\n' +
        '• **Nivel Vendedor (Equipo Comercial)**:\n' +
        '  - Acceso enfocado a: Registro de Ventas en Punto de Venta (POS), Clientes y Cobranzas con WhatsApp, Catálogo de Stock en ruta y Chat corporativo (con funciones de gerencia y finanzas resguardadas).',
    };
  }

  // Respuesta por defecto con orientación general
  return {
    texto:
      '💡 **Guía Rápida de Ventas Score**:\n\n' +
      'Puedo orientarte paso a paso sobre cualquiera de estas áreas:\n\n' +
      '• 🛒 **Punto de Venta**: Carrito multiproducto, código de barras y vuelto en efectivo.\n' +
      '• 📲 **Cobranza**: Notificaciones por WhatsApp con cuenta bancaria y comprobantes.\n' +
      '• 📦 **Inventario**: Stock mínimo, categorías y registro de mermas/roturas.\n' +
      '• 🔒 **Caja**: Cierre ciego, arqueo por medio de pago y detección de descuadre.\n' +
      '• 📈 **Estadísticas**: Horas punta 24h, rentabilidad de productos y reporte ejecutivo.\n' +
      '• 🔑 **Seguridad**: Configuración de PIN de ingreso rápido y perfiles.\n\n' +
      '¿Sobre cuál de estos temas deseas consultar?',
  };
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
      texto: `¡Hola ${userName}! 👋 Soy **ScoreBot**, el Asistente Virtual Especializado de **Ventas Score** 🦍.\n\nHe sido actualizado con todas las funciones nuevas de la app: Carrito POS con código de barras, cobranza WhatsApp con datos bancarios, registro de mermas, cierre de caja ciego y el panel de Business Intelligence.\n\n¿En qué te puedo orientar hoy?`,
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

    // Simulación de respuesta inteligente instantánea pero natural
    setTimeout(() => {
      const resp = responderDudaApp(texto, isAdmin);
      const nuevoMsgIA: MensajeIA = {
        id: 'ia-' + Date.now(),
        remitente: 'ia',
        texto: resp.texto,
        accion: resp.accion,
        ts: Date.now(),
      };
      setMensajes((prev) => [...prev, nuevoMsgIA]);
      setEscribiendo(false);
    }, 380);
  };

  const handleLimpiarChat = () => {
    setMensajes([
      {
        id: 'bienvenida-' + Date.now(),
        remitente: 'ia',
        texto: `Chat reiniciado. ¿En qué duda operativa de **Ventas Score** te puedo ayudar, ${userName}?`,
        ts: Date.now(),
      },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* BANNER DE IDENTIFICACIÓN DE LA IA */}
      <div
        className="card"
        style={{
          padding: '12px 14px',
          margin: 0,
          background: 'linear-gradient(135deg, var(--card) 0%, rgba(37,99,235,0.08) 100%)',
          borderLeft: '4px solid var(--accent)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
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
                  padding: '2px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                Actualizado 2026
              </span>
            </div>
            <div className="sub" style={{ fontSize: '0.78rem', marginTop: 2 }}>
              Experto en POS, cobranza WhatsApp, mermas, cierre ciego y métricas BI.
            </div>
          </div>
        </div>

        {mensajes.length > 2 && (
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '0.75rem', padding: '4px 8px', flexShrink: 0 }}
            onClick={handleLimpiarChat}
            title="Reiniciar conversación"
          >
            Limpiar ↺
          </button>
        )}
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
              fontSize: '0.78rem',
              padding: '6px 10px',
              borderRadius: 16,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              flexShrink: 0,
              cursor: 'pointer',
            }}
            onClick={() => handleEnviar(pregunta)}
          >
            {pregunta}
          </button>
        ))}
      </div>

      {/* HISTORIAL DEL CHAT */}
      <div
        className="card"
        style={{
          padding: 14,
          margin: 0,
          minHeight: 380,
          maxHeight: 520,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
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
                  alt="ScoreBot"
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

                {/* Botón de acción interactiva integrada si existe */}
                {m.accion && onNavigateTab && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                      onClick={() => onNavigateTab(m.accion!.tab)}
                    >
                      <span>{m.accion.icon || '👉'}</span>
                      <span>{m.accion.label}</span>
                    </button>
                  </div>
                )}
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
          placeholder="Escribe tu consulta sobre la app (ej: POS, mermas, arqueo, horas punta)..."
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
