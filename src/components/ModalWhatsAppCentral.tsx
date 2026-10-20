import React, { useState, useEffect } from 'react';
import {
  getWhatsAppCentralConfig,
  saveWhatsAppCentralConfig,
  checkWhatsAppCentralStatus,
  enviarWhatsAppCentral,
  desconectarWhatsAppCentral,
  WhatsAppStatusResponse,
} from '../utils/whatsappCentral';

interface ModalWhatsAppCentralProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

export const ModalWhatsAppCentral: React.FC<ModalWhatsAppCentralProps> = ({
  isOpen,
  onClose,
  isAdmin,
}) => {
  const [config, setConfig] = useState(getWhatsAppCentralConfig());
  const [status, setStatus] = useState<WhatsAppStatusResponse | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);
  const [guardadoToast, setGuardadoToast] = useState<boolean>(false);
  const [testTel, setTestTel] = useState<string>('');
  const [enviandoTest, setEnviandoTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const consultarEstado = async (urlOverride?: string) => {
    setCargando(true);
    try {
      const res = await checkWhatsAppCentralStatus(urlOverride || config.serverUrl);
      setStatus(res);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const cfg = getWhatsAppCentralConfig();
      setConfig(cfg);
      consultarEstado(cfg.serverUrl);

      // Sondeo automático cada 4 segundos mientras el modal esté abierto para detectar escaneo de QR
      const timer = setInterval(() => {
        checkWhatsAppCentralStatus(cfg.serverUrl).then(setStatus).catch(() => {});
      }, 4000);

      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGuardarConfig = () => {
    saveWhatsAppCentralConfig(config);
    setGuardadoToast(true);
    setTimeout(() => setGuardadoToast(false), 3000);
    consultarEstado(config.serverUrl);
  };

  const handleTestSend = async () => {
    if (!testTel.trim()) return;
    setEnviandoTest(true);
    setTestResult(null);
    try {
      const res = await enviarWhatsAppCentral(
        testTel.trim(),
        '⚡ ¡Hola! Este es un mensaje de prueba automático desde tu cuenta central de Ventas Score.'
      );
      if (res.ok) {
        setTestResult({ ok: true, msg: '¡Mensaje de prueba entregado con éxito por WhatsApp!' });
      } else {
        setTestResult({ ok: false, msg: res.error || 'No se pudo enviar el mensaje' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || 'Error de conexión' });
    } finally {
      setEnviandoTest(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('¿Estás seguro de desvincular la sesión de WhatsApp de este servidor?')) {
      setCargando(true);
      await desconectarWhatsAppCentral(config.serverUrl);
      setTimeout(() => consultarEstado(), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 540,
          margin: 0,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          background: 'var(--card)',
          borderRadius: 20,
          padding: '20px 22px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
              }}
            >
              📱
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>
                WhatsApp Central Automatizado
              </div>
              <div className="sub" style={{ fontSize: '0.78rem' }}>
                Despacho desatendido de comprobantes y cobranzas
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              padding: 0,
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* ESTADO DE CONEXIÓN */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: status?.conectado
                ? 'rgba(34, 197, 94, 0.12)'
                : status?.qr
                ? 'rgba(234, 179, 8, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${
                status?.conectado
                  ? 'rgba(34, 197, 94, 0.35)'
                  : status?.qr
                  ? 'rgba(234, 179, 8, 0.35)'
                  : 'rgba(239, 68, 68, 0.35)'
              }`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{status?.conectado ? '🟢' : status?.qr ? '🟡' : '🔴'}</span>
                <span>
                  {status?.conectado
                    ? 'CONECTADO Y ACTIVO'
                    : status?.qr
                    ? 'ESPERANDO ESCANEO DE QR'
                    : 'SERVIDOR NO CONECTADO'}
                </span>
              </span>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.76rem', padding: '4px 8px', borderRadius: 6 }}
                onClick={() => consultarEstado()}
                disabled={cargando}
              >
                {cargando ? 'Consultando...' : '🔄 Actualizar'}
              </button>
            </div>

            {status?.conectado && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                Número vinculado: <b style={{ color: '#22c55e' }}>+{status.telefono}</b>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span>☁️ Sesión guardada en la nube (No se desconectará al reiniciar)</span>
                </div>
                <div className="sub" style={{ fontSize: '0.76rem', marginTop: 3 }}>
                  Todos los comprobantes y avisos de cobro salen automáticamente desde este número.
                </div>
              </div>
            )}

            {!status?.conectado && status?.error && (
              <div style={{ fontSize: '0.78rem', color: 'var(--accent2)' }}>
                {status.error}
              </div>
            )}
          </div>
        </div>

        {/* SI ESTÁ ESPERANDO QR: MOSTRAR QR DIRECTO */}
        {!status?.conectado && status?.qr && (
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              background: 'var(--bg)',
              borderRadius: 16,
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 6 }}>
              📸 Escanea este código con tu WhatsApp (1 sola vez)
            </div>
            <div className="sub" style={{ fontSize: '0.78rem', marginBottom: 12 }}>
              Apunta la cámara de WhatsApp desde tu teléfono para vincular. La sesión se guardará en Firestore para que no se desconecte nunca más:
            </div>
            <div
              style={{
                display: 'inline-block',
                background: '#ffffff',
                padding: 12,
                borderRadius: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              }}
            >
              <img
                src={status.qr}
                alt="Código QR WhatsApp"
                style={{ width: 220, height: 220, display: 'block' }}
              />
            </div>
            <div
              style={{
                textAlign: 'left',
                marginTop: 14,
                background: 'rgba(0,0,0,0.1)',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: '0.78rem',
                lineHeight: 1.5,
              }}
            >
              <b>Pasos en tu celular:</b>
              <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Abre WhatsApp en el celular central de la empresa.</li>
                <li>Toca <b>Menú ⋮</b> (en Android) o <b>Configuración</b> (en iPhone).</li>
                <li>Selecciona <b>Dispositivos vinculados</b> &gt; <b>Vincular un dispositivo</b>.</li>
                <li>Apunta tu cámara a este código QR.</li>
              </ol>
            </div>
          </div>
        )}

        {/* PRUEBA DE ENVÍO (SI ESTÁ CONECTADO) */}
        {status?.conectado && (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              background: 'var(--bg)',
              borderRadius: 14,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
              📤 Probar Envío Inmediato
            </div>
            <div className="sub" style={{ fontSize: '0.76rem', marginBottom: 10 }}>
              Ingresa un número para recibir un mensaje de prueba al instante:
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="tel"
                placeholder="+56 9..."
                value={testTel}
                onChange={(e) => setTestTel(e.target.value)}
                style={{ fontSize: '0.86rem', flex: 1 }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleTestSend}
                disabled={enviandoTest || !testTel.trim()}
                style={{
                  padding: '8px 14px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                }}
              >
                {enviandoTest ? 'Enviando...' : 'Enviar Prueba'}
              </button>
            </div>
            {testResult && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: testResult.ok ? '#22c55e' : 'var(--accent2)',
                }}
              >
                {testResult.msg}
              </div>
            )}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleLogout}
                style={{ color: 'var(--accent2)', fontSize: '0.76rem', padding: '4px 10px' }}
              >
                Desvincular número WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* CONFIGURACIÓN DEL SERVIDOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="sub" style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', marginBottom: 4 }}>
              URL del Servidor WhatsApp (Render o Local):
            </label>
            <input
              placeholder="Ej: https://ventas-score-whatsapp.onrender.com o http://localhost:3001"
              value={config.serverUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, serverUrl: e.target.value }))}
              style={{ fontSize: '0.86rem', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 6 }}
                onClick={() => setConfig((prev) => ({ ...prev, serverUrl: 'http://localhost:3001' }))}
              >
                Usar Local (http://localhost:3001)
              </button>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            <input
              type="checkbox"
              checked={config.autoSend}
              onChange={(e) => setConfig((prev) => ({ ...prev, autoSend: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: '#22c55e' }}
            />
            <span>Despachar automáticamente comprobantes al cobrar ventas en POS y registrar deudas</span>
          </label>
        </div>

        {/* BOTONES FINALES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <span style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>
            {guardadoToast && '✓ Configuración guardada'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              style={{ fontSize: '0.86rem', padding: '8px 16px' }}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleGuardarConfig}
              style={{
                fontSize: '0.86rem',
                padding: '8px 18px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              }}
            >
              Guardar y Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
