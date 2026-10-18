import React from 'react';
import { CierreCaja } from '../types';
import { fmt, generarMensajeWhatsAppCierre } from '../utils/formatters';

export interface ModalDetalleCierreProps {
  isOpen: boolean;
  onClose: () => void;
  cierre: CierreCaja | null;
  onConsultarEstadisticas?: (cierre: CierreCaja) => void;
}

export const ModalDetalleCierre: React.FC<ModalDetalleCierreProps> = ({
  isOpen,
  onClose,
  cierre,
  onConsultarEstadisticas,
}) => {
  if (!isOpen || !cierre) return null;

  const efEsp = cierre.efectivoEsperado ?? 0;
  const efReal = cierre.efectivoReal ?? efEsp;
  const difEf = efReal - efEsp;

  const trEsp = cierre.transferenciaEsperado ?? 0;
  const trReal = cierre.transferenciaReal ?? trEsp;
  const difTr = trReal - trEsp;

  const debEsp = cierre.debitoEsperado ?? 0;
  const debReal = cierre.debitoReal ?? debEsp;
  const difDeb = debReal - debEsp;

  const totalEsperado = efEsp + trEsp + debEsp;
  const totalReal = efReal + trReal + debReal;
  const difTotal =
    cierre.diferenciaTotal !== undefined
      ? cierre.diferenciaTotal
      : totalReal - totalEsperado;

  const tieneArqueo = cierre.efectivoEsperado !== undefined;

  const handleCompartirWhatsApp = () => {
    const texto = generarMensajeWhatsAppCierre(cierre);
    const tel = cierre.telefonoReporte ? cierre.telefonoReporte.replace(/\D/g, '') : '';
    let url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    if (tel && tel.length >= 8) {
      let clean = tel;
      if (clean.length === 9 && clean.startsWith('9')) clean = '56' + clean;
      else if (clean.length === 8) clean = '569' + clean;
      url = `https://wa.me/${clean}?text=${encodeURIComponent(texto)}`;
    }
    window.open(url, '_blank');
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
              <span>🔒</span> {cierre.nombre}
            </div>
            <div className="sub" style={{ fontSize: '0.82rem', marginTop: 3 }}>
              {cierre.por && <span>Cerrado por <b>{cierre.por}</b> · </span>}
              {cierre.desdeTxt} → {cierre.hastaTxt}
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

        {/* BADGE DE ESTADO DE ARQUEO */}
        <div
          style={{
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            background: !tieneArqueo
              ? 'rgba(107, 114, 128, 0.12)'
              : difTotal === 0
              ? 'rgba(34, 197, 94, 0.12)'
              : difTotal > 0
              ? 'rgba(234, 179, 8, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${
              !tieneArqueo
                ? 'rgba(107, 114, 128, 0.3)'
                : difTotal === 0
                ? 'rgba(34, 197, 94, 0.35)'
                : difTotal > 0
                ? 'rgba(234, 179, 8, 0.35)'
                : 'rgba(239, 68, 68, 0.35)'
            }`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {!tieneArqueo
                ? '⚪ Cierre Consolidado Histórico'
                : difTotal === 0
                ? '🟢 Caja Cuadrada al 100%'
                : difTotal > 0
                ? `🟡 Sobrante en Caja (+${fmt(difTotal)})`
                : `🔴 Faltante en Caja (-${fmt(Math.abs(difTotal))})`}
            </span>
            {tieneArqueo && (
              <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                {difTotal === 0 ? '$0' : difTotal > 0 ? `+${fmt(difTotal)}` : `-${fmt(Math.abs(difTotal))}`}
              </span>
            )}
          </div>
          {tieneArqueo && (
            <div className="sub" style={{ fontSize: '0.8rem', marginTop: 4 }}>
              Total contado en mano: <b>{fmt(totalReal)}</b> vs Esperado según sistema: <b>{fmt(totalEsperado)}</b>
            </div>
          )}
        </div>

        {/* RESUMEN FINANCIERO */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>
            📊 Resumen Financiero del Período
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              fontSize: '0.85rem',
            }}
          >
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span className="sub">Ventas totales:</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {fmt(cierre.vend)} <span className="sub" style={{ fontSize: '0.78rem' }}>({cierre.ventas} un.)</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span className="sub">Dinero ingresado:</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent3)' }}>
                {fmt(cierre.ingresado)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span className="sub">Ganancia neta:</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: cierre.ganancia >= 0 ? 'var(--accent3)' : 'var(--accent2)' }}>
                {fmt(cierre.ganancia)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span className="sub">Costo de lo vendido:</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {fmt(cierre.costoV)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span className="sub">Deuda pendiente clientes:</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: cierre.porCobrar > 0 ? '#eab308' : 'inherit' }}>
                {fmt(cierre.porCobrar)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span className="sub">En cuenta al cierre:</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {fmt(cierre.enCuenta)}
              </div>
            </div>
          </div>
        </div>

        {/* DESGLOSE POR MEDIO DE PAGO & CONCILIACIÓN */}
        {tieneArqueo && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>
              💵 Conciliación por Medio de Pago
            </div>
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.06)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Medio de Pago</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Esperado</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Real</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>💵 Efectivo</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(efEsp)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(efReal)}</td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: difEf === 0 ? 'var(--accent3)' : difEf > 0 ? '#eab308' : 'var(--accent2)',
                      }}
                    >
                      {difEf === 0 ? '$0' : difEf > 0 ? `+${fmt(difEf)}` : `-${fmt(Math.abs(difEf))}`}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>🏦 Transferencias</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(trEsp)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(trReal)}</td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: difTr === 0 ? 'var(--accent3)' : difTr > 0 ? '#eab308' : 'var(--accent2)',
                      }}
                    >
                      {difTr === 0 ? '$0' : difTr > 0 ? `+${fmt(difTr)}` : `-${fmt(Math.abs(difTr))}`}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>💳 Tarjetas / POS</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(debEsp)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(debReal)}</td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: difDeb === 0 ? 'var(--accent3)' : difDeb > 0 ? '#eab308' : 'var(--accent2)',
                      }}
                    >
                      {difDeb === 0 ? '$0' : difDeb > 0 ? `+${fmt(difDeb)}` : `-${fmt(Math.abs(difDeb))}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {(cierre.fiadoTotal || cierre.mermasTotal) ? (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  fontSize: '0.8rem',
                  marginTop: 8,
                  color: 'var(--muted)',
                }}
              >
                {cierre.fiadoTotal ? (
                  <div>🏷️ Fiados otorgados: <b>{fmt(cierre.fiadoTotal)}</b></div>
                ) : null}
                {cierre.mermasTotal ? (
                  <div>🗑️ Mermas del turno: <b>{fmt(cierre.mermasTotal)}</b></div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {/* OBSERVACIONES */}
        {cierre.observaciones && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
              📝 Observaciones del Turno:
            </div>
            <div
              style={{
                background: 'var(--bg)',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
                fontStyle: 'italic',
              }}
            >
              "{cierre.observaciones}"
            </div>
          </div>
        )}

        {/* ACCIONES FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            onClick={handleCompartirWhatsApp}
          >
            <span>📲</span> Compartir por WhatsApp
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {onConsultarEstadisticas && (
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  onConsultarEstadisticas(cierre);
                  onClose();
                }}
              >
                🔍 Cargar Estadísticas
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
