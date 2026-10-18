import React, { useState } from 'react';
import { ConciliacionCierre, fmt } from '../utils/formatters';

export interface ModalCerrarCajaProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (datosCierre: {
    nombre: string;
    efectivoReal: number;
    transferenciaReal: number;
    debitoReal: number;
    observaciones: string;
    telefonoReporte?: string;
    enviarWhatsApp: boolean;
  }) => void;
  nombreDefault: string;
  responsable: string;
  desdeTxt: string;
  hastaTxt: string;
  conciliacion: ConciliacionCierre;
}

export const ModalCerrarCaja: React.FC<ModalCerrarCajaProps> = ({
  isOpen,
  onClose,
  onConfirmar,
  nombreDefault,
  responsable,
  desdeTxt,
  hastaTxt,
  conciliacion,
}) => {
  const [nombre, setNombre] = useState<string>(nombreDefault);
  const [modoCiego, setModoCiego] = useState<boolean>(false);
  const [mostrarCalculadoraBilletes, setMostrarCalculadoraBilletes] = useState<boolean>(false);

  // Valores contados por el cajero (como string para inputs)
  const [efectivoInput, setEfectivoInput] = useState<string>('');
  const [transfInput, setTransfInput] = useState<string>('');
  const [debitoInput, setDebitoInput] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // WhatsApp
  const [enviarWhatsApp, setEnviarWhatsApp] = useState<boolean>(true);
  const [telefonoReporte, setTelefonoReporte] = useState<string>('');

  if (!isOpen) return null;

  // Calculadora de billetes
  const denominaciones = [20000, 10000, 5000, 2000, 1000, 500, 100];
  const handleSumarBillete = (monto: number) => {
    const act = parseFloat(efectivoInput) || 0;
    setEfectivoInput(String(act + monto));
  };

  const handleLimpiarEfectivo = () => {
    setEfectivoInput('');
  };

  // Cálculos numéricos
  const efectivoRealNum =
    efectivoInput !== '' ? parseFloat(efectivoInput) || 0 : conciliacion.efectivoEsperado;
  const transfRealNum =
    transfInput !== '' ? parseFloat(transfInput) || 0 : conciliacion.transferenciaEsperado;
  const debitoRealNum =
    debitoInput !== '' ? parseFloat(debitoInput) || 0 : conciliacion.debitoEsperado;

  const totalEsperado = conciliacion.totalEsperado;
  const totalReal = efectivoRealNum + transfRealNum + debitoRealNum;
  const difTotal = totalReal - totalEsperado;

  const difEf = efectivoRealNum - conciliacion.efectivoEsperado;
  const difTr = transfRealNum - conciliacion.transferenciaEsperado;
  const difDeb = debitoRealNum - conciliacion.debitoEsperado;

  const handleConfirmarClick = () => {
    const nom = nombre.trim();
    if (!nom) {
      alert('Por favor ingresa un nombre para el cierre.');
      return;
    }

    onConfirmar({
      nombre: nom,
      efectivoReal: efectivoRealNum,
      transferenciaReal: transfRealNum,
      debitoReal: debitoRealNum,
      observaciones: observaciones.trim(),
      telefonoReporte: telefonoReporte.trim() || undefined,
      enviarWhatsApp,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 540,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          margin: 0,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          border: '1px solid var(--border)',
          padding: '20px 22px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔒</span> Cierre de Caja & Arqueo
            </div>
            <div className="sub" style={{ fontSize: '0.82rem', marginTop: 3 }}>
              Responsable: <b>{responsable}</b> · {desdeTxt} → {hastaTxt}
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '1rem', padding: '4px 8px' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* SELECTOR MODO GUIADO / CIEGO */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg)',
            borderRadius: 8,
            padding: 3,
            marginBottom: 14,
            border: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: !modoCiego ? 'var(--accent)' : 'transparent',
              color: !modoCiego ? '#fff' : 'var(--text)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setModoCiego(false)}
          >
            👁️ Modo Guiado (Ver esperado)
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: modoCiego ? 'var(--accent)' : 'transparent',
              color: modoCiego ? '#fff' : 'var(--text)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setModoCiego(true)}
          >
            🙈 Conteo Ciego (Sin sesgos)
          </button>
        </div>

        {/* NOMBRE DEL CIERRE */}
        <div style={{ marginBottom: 14 }}>
          <label className="sub" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Nombre del cierre o turno:
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Cierre Turno Tarde - 17 oct"
            style={{ width: '100%' }}
          />
        </div>

        {/* SECCIÓN ARQUEO POR MEDIO DE PAGO */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>💵 Arqueo y Conteo de Fondos</span>
            {!modoCiego && (
              <span className="sub" style={{ fontSize: '0.78rem' }}>
                Esperado: <b>{fmt(totalEsperado)}</b>
              </span>
            )}
          </div>

          {/* 1. EFECTIVO */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                💵 Efectivo en Caja
              </div>
              {!modoCiego ? (
                <div style={{ fontSize: '0.8rem' }}>
                  <span className="sub">Esperado: </span>
                  <b>{fmt(conciliacion.efectivoEsperado)}</b>
                  <span className="sub" style={{ fontSize: '0.72rem', marginLeft: 4 }}>
                    (Ventas {fmt(conciliacion.ventasEfectivo)} + Pagos {fmt(conciliacion.pagosEfectivo)})
                  </span>
                </div>
              ) : (
                <span className="sub" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                  Esperado oculto
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                placeholder={
                  modoCiego
                    ? 'Ingresa el total contado'
                    : `Sugerido: ${conciliacion.efectivoEsperado}`
                }
                value={efectivoInput}
                onChange={(e) => setEfectivoInput(e.target.value)}
                style={{ flex: 1 }}
              />
              {!modoCiego && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '6px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => setEfectivoInput(String(conciliacion.efectivoEsperado))}
                  title="Copiar monto esperado"
                >
                  ✓ Cuadrado
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.75rem', padding: '6px 8px', whiteSpace: 'nowrap' }}
                onClick={() => setMostrarCalculadoraBilletes(!mostrarCalculadoraBilletes)}
                title="Abrir calculadora rápida de billetes"
              >
                🧮 Billetes
              </button>
            </div>

            {/* Calculadora rápida de billetes expandible */}
            {mostrarCalculadoraBilletes && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: 'var(--card)',
                  borderRadius: 8,
                  border: '1px dashed var(--border)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                  Suma rápida de billetes y monedas en caja:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {denominaciones.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: '0.72rem', padding: '4px 6px' }}
                      onClick={() => handleSumarBillete(d)}
                    >
                      +{fmt(d)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn-red"
                    style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    onClick={handleLimpiarEfectivo}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            )}

            {!modoCiego && efectivoInput !== '' && (
              <div style={{ marginTop: 4, fontSize: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <span className="sub">Diferencia efectivo:</span>
                <b style={{ color: difEf === 0 ? 'var(--accent3)' : difEf > 0 ? '#eab308' : 'var(--accent2)' }}>
                  {difEf === 0 ? '$0 (Cuadrado)' : difEf > 0 ? `+${fmt(difEf)} (Sobrante)` : `-${fmt(Math.abs(difEf))} (Faltante)`}
                </b>
              </div>
            )}
          </div>

          {/* 2. TRANSFERENCIAS */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                🏦 Transferencias Bancarias
              </div>
              {!modoCiego ? (
                <div style={{ fontSize: '0.8rem' }}>
                  <span className="sub">Esperado: </span>
                  <b>{fmt(conciliacion.transferenciaEsperado)}</b>
                </div>
              ) : (
                <span className="sub" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                  Esperado oculto
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                placeholder={
                  modoCiego
                    ? 'Total confirmado en banco'
                    : `Sugerido: ${conciliacion.transferenciaEsperado}`
                }
                value={transfInput}
                onChange={(e) => setTransfInput(e.target.value)}
                style={{ flex: 1 }}
              />
              {!modoCiego && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '6px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => setTransfInput(String(conciliacion.transferenciaEsperado))}
                >
                  ✓ Cuadrado
                </button>
              )}
            </div>

            {!modoCiego && transfInput !== '' && (
              <div style={{ marginTop: 4, fontSize: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <span className="sub">Diferencia transf:</span>
                <b style={{ color: difTr === 0 ? 'var(--accent3)' : difTr > 0 ? '#eab308' : 'var(--accent2)' }}>
                  {difTr === 0 ? '$0 (Cuadrado)' : difTr > 0 ? `+${fmt(difTr)}` : `-${fmt(Math.abs(difTr))}`}
                </b>
              </div>
            )}
          </div>

          {/* 3. DÉBITO / POS */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                💳 Tarjetas Débito / POS
              </div>
              {!modoCiego ? (
                <div style={{ fontSize: '0.8rem' }}>
                  <span className="sub">Esperado: </span>
                  <b>{fmt(conciliacion.debitoEsperado)}</b>
                </div>
              ) : (
                <span className="sub" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                  Esperado oculto
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                placeholder={
                  modoCiego
                    ? 'Total vouchers de la máquina POS'
                    : `Sugerido: ${conciliacion.debitoEsperado}`
                }
                value={debitoInput}
                onChange={(e) => setDebitoInput(e.target.value)}
                style={{ flex: 1 }}
              />
              {!modoCiego && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '6px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => setDebitoInput(String(conciliacion.debitoEsperado))}
                >
                  ✓ Cuadrado
                </button>
              )}
            </div>

            {!modoCiego && debitoInput !== '' && (
              <div style={{ marginTop: 4, fontSize: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <span className="sub">Diferencia POS:</span>
                <b style={{ color: difDeb === 0 ? 'var(--accent3)' : difDeb > 0 ? '#eab308' : 'var(--accent2)' }}>
                  {difDeb === 0 ? '$0 (Cuadrado)' : difDeb > 0 ? `+${fmt(difDeb)}` : `-${fmt(Math.abs(difDeb))}`}
                </b>
              </div>
            )}
          </div>

          {/* DATOS COMPLEMENTARIOS (FIADOS & MERMAS) */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              fontSize: '0.78rem',
              color: 'var(--muted)',
              padding: '6px 10px',
              background: 'var(--bg)',
              borderRadius: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              🏷️ Fiados del turno: <b>{fmt(conciliacion.fiadoTotal)}</b>
            </div>
            <div style={{ flex: 1 }}>
              🗑️ Mermas: <b>{fmt(conciliacion.costoMerma)}</b> ({conciliacion.mermasCant} un.)
            </div>
          </div>
        </div>

        {/* AUDITORÍA & RESULTADO EN VIVO */}
        <div
          style={{
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            background:
              difTotal === 0
                ? 'rgba(34, 197, 94, 0.12)'
                : difTotal > 0
                ? 'rgba(234, 179, 8, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${
              difTotal === 0
                ? 'rgba(34, 197, 94, 0.35)'
                : difTotal > 0
                ? 'rgba(234, 179, 8, 0.35)'
                : 'rgba(239, 68, 68, 0.35)'
            }`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {difTotal === 0
                ? '🟢 Caja Cuadrada al 100%'
                : difTotal > 0
                ? `🟡 Sobrante en Caja (+${fmt(difTotal)})`
                : `🔴 Faltante en Caja (-${fmt(Math.abs(difTotal))})`}
            </span>
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              {difTotal === 0 ? '$0' : (difTotal > 0 ? `+${fmt(difTotal)}` : `-${fmt(Math.abs(difTotal))}`)}
            </span>
          </div>
          <div className="sub" style={{ fontSize: '0.78rem', marginTop: 4 }}>
            Total contado en mano: <b>{fmt(totalReal)}</b> vs Total esperado por sistema: <b>{fmt(totalEsperado)}</b>
          </div>
        </div>

        {/* OBSERVACIONES */}
        <div style={{ marginBottom: 14 }}>
          <label className="sub" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Observaciones o justificación del arqueo:
          </label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej: Todo cuadrado sin novedades, o motivo de cualquier diferencia detectada..."
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              padding: '8px 10px',
              fontFamily: 'inherit',
              fontSize: '0.88rem',
            }}
          />
        </div>

        {/* OPCIÓN ENVIAR COMPROBANTE WHATSAPP */}
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 16,
            border: '1px solid var(--border)',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={enviarWhatsApp}
              onChange={(e) => setEnviarWhatsApp(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span>📲 Enviar reporte oficial por WhatsApp al confirmar</span>
          </label>

          {enviarWhatsApp && (
            <div style={{ marginTop: 8 }}>
              <input
                type="tel"
                placeholder="Teléfono admin (opcional, ej: +56 9 1234 5678)"
                value={telefonoReporte}
                onChange={(e) => setTelefonoReporte(e.target.value)}
                style={{ width: '100%', fontSize: '0.82rem' }}
              />
              <span className="sub" style={{ fontSize: '0.72rem', display: 'block', marginTop: 2 }}>
                Si lo dejas vacío, abrirá WhatsApp para que elijas a quién enviárselo.
              </span>
            </div>
          )}
        </div>

        {/* ACCIONES FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirmarClick}>
            🔒 Confirmar y Cerrar Caja
          </button>
        </div>
      </div>
    </div>
  );
};
