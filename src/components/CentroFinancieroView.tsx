import React, { useState, useEffect } from 'react';
import { Producto, Movimiento, CierreCaja, ResumenPeriodo } from '../types';
import { fmt } from '../utils/formatters';
import { EstadisticasView } from './EstadisticasView';

interface CentroFinancieroViewProps {
  initialSubTab?: 'caja' | 'bi' | 'cierres' | 'auditoria';
  desdeTxt: string;
  resumenPeriodo: ResumenPeriodo;
  resumenTotal: ResumenPeriodo;
  cta: number;
  pc: number;
  productos: Producto[];
  movs: Movimiento[];
  pagosPeriodo: Movimiento[];
  cierres: CierreCaja[];
  handleOpenCerrarCaja: () => void;
  setModalDetalleCierre: (data: { isOpen: boolean; cierre: CierreCaja | null }) => void;
  setModalHistorialMermas: (open: boolean) => void;
  handleOpenBorrarTodo: () => void;
  onVolverPos?: () => void;
}

export const CentroFinancieroView: React.FC<CentroFinancieroViewProps> = ({
  initialSubTab = 'caja',
  desdeTxt,
  resumenPeriodo,
  resumenTotal,
  cta,
  pc,
  productos,
  movs,
  pagosPeriodo,
  cierres,
  handleOpenCerrarCaja,
  setModalDetalleCierre,
  setModalHistorialMermas,
  handleOpenBorrarTodo,
  onVolverPos,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'caja' | 'bi' | 'cierres' | 'auditoria'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* HEADER PRINCIPAL DEL CENTRO FINANCIERO */}
      <div
        className="card"
        style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(37, 99, 235, 0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>🏛️</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
                Centro Financiero & BI
              </h2>
            </div>
            <div className="sub" style={{ fontSize: '0.8rem', marginTop: 2 }}>
              Gestión de caja viva, arqueos de turno, balances e inteligencia predictiva de negocio
            </div>
          </div>

          {onVolverPos && (
            <button
              type="button"
              className="btn-ghost"
              onClick={onVolverPos}
              style={{
                fontSize: '0.82rem',
                padding: '6px 12px',
                color: 'var(--accent)',
                fontWeight: 700,
                border: '1px solid var(--accent)',
                borderRadius: 8,
              }}
            >
              ← Ir a Cobrar (POS)
            </button>
          )}
        </div>

        {/* SELECTOR DE SUB-PESTAÑAS ERGONÓMICO */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            type="button"
            className={`btn-ghost ${activeSubTab === 'caja' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('caja')}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: activeSubTab === 'caja' ? 'var(--accent)' : 'rgba(0, 0, 0, 0.25)',
              color: activeSubTab === 'caja' ? '#fff' : 'var(--text)',
              border: `1px solid ${activeSubTab === 'caja' ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💰</span>
            <span>Caja & Turno Actual</span>
          </button>

          <button
            type="button"
            className={`btn-ghost ${activeSubTab === 'bi' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('bi')}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: activeSubTab === 'bi' ? 'var(--accent)' : 'rgba(0, 0, 0, 0.25)',
              color: activeSubTab === 'bi' ? '#fff' : 'var(--text)',
              border: `1px solid ${activeSubTab === 'bi' ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📊</span>
            <span>Inteligencia BI & Métricas</span>
          </button>

          <button
            type="button"
            className={`btn-ghost ${activeSubTab === 'cierres' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('cierres')}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: activeSubTab === 'cierres' ? 'var(--accent)' : 'rgba(0, 0, 0, 0.25)',
              color: activeSubTab === 'cierres' ? '#fff' : 'var(--text)',
              border: `1px solid ${activeSubTab === 'cierres' ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🔒</span>
            <span>Historial de Cierres ({cierres.length})</span>
          </button>

          <button
            type="button"
            className={`btn-ghost ${activeSubTab === 'auditoria' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('auditoria')}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: activeSubTab === 'auditoria' ? 'var(--accent)' : 'rgba(0, 0, 0, 0.25)',
              color: activeSubTab === 'auditoria' ? '#fff' : 'var(--text)',
              border: `1px solid ${activeSubTab === 'auditoria' ? 'var(--accent)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📋</span>
            <span>Auditoría & Mantención</span>
          </button>
        </div>
      </div>

      {/* SUB-PESTAÑA 1: CAJA & TURNO ACTUAL */}
      {activeSubTab === 'caja' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* CUADRÍCULA DE SALDOS OPERATIVOS CLAVE (HERO METRICS) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {/* Dinero en Cuenta / Caja */}
            <div
              className="card"
              style={{
                margin: 0,
                padding: '14px 16px',
                borderLeft: `4px solid ${cta >= 0 ? '#10b981' : '#ef4444'}`,
                background: 'rgba(16, 185, 129, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sub" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  🏦 Dinero en Cuenta / Caja
                </span>
                <span style={{ fontSize: '1rem' }}>💵</span>
              </div>
              <div
                className={`amount ${cta >= 0 ? 'ok' : 'debt'}`}
                style={{ fontSize: '1.5rem', fontWeight: 800, margin: '6px 0 2px 0' }}
              >
                {fmt(cta)}
              </div>
              <div className="sub" style={{ fontSize: '0.75rem' }}>
                Saldo operativo real que deberías tener en cuenta
              </div>
            </div>

            {/* Deudores / Por Cobrar */}
            <div
              className="card"
              style={{
                margin: 0,
                padding: '14px 16px',
                borderLeft: '4px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sub" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  ⏳ Por Cobrar (Fiados)
                </span>
                <span style={{ fontSize: '1rem' }}>👥</span>
              </div>
              <div
                className="amount debt"
                style={{ fontSize: '1.5rem', fontWeight: 800, margin: '6px 0 2px 0', color: '#f59e0b' }}
              >
                {fmt(pc)}
              </div>
              <div className="sub" style={{ fontSize: '0.75rem' }}>
                Crédito pendiente de recaudación en la calle
              </div>
            </div>

            {/* Patrimonio Total Estimado */}
            <div
              className="card"
              style={{
                margin: 0,
                padding: '14px 16px',
                borderLeft: '4px solid #3b82f6',
                background: 'rgba(59, 130, 246, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sub" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  💎 Patrimonio Líquido
                </span>
                <span style={{ fontSize: '1rem' }}>📈</span>
              </div>
              <div
                className="amount ok"
                style={{ fontSize: '1.5rem', fontWeight: 800, margin: '6px 0 2px 0', color: '#3b82f6' }}
              >
                {fmt(cta + pc)}
              </div>
              <div className="sub" style={{ fontSize: '0.75rem' }}>
                Al cobrar todas las deudas pendientes
              </div>
            </div>
          </div>

          {/* TARJETA DEL TURNO / PERÍODO ACTUAL */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 10,
                paddingBottom: 8,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚡</span> Turno Actual en Marcha
                </div>
                <div className="sub" style={{ fontSize: '0.78rem' }}>
                  Período: {desdeTxt} → Hoy (activo sin cerrar)
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenCerrarCaja}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                }}
              >
                <span>🔒</span>
                <span>Cerrar Caja & Arqueo Ciego</span>
              </button>
            </div>

            <div className="item">
              <span>Compras del período (inversión)</span>
              <span className="amount">{fmt(resumenPeriodo.inv)}</span>
            </div>
            <div className="item">
              <span>Ventas del período ({resumenPeriodo.ventas} transacciones)</span>
              <span className="amount">{fmt(resumenPeriodo.vend)}</span>
            </div>
            <div className="item">
              <span>Cobrado al contado</span>
              <span className="amount">{fmt(resumenPeriodo.ventasPag)}</span>
            </div>
            <div className="item">
              <span>Pagos recibidos de deudores</span>
              <span className="amount">{fmt(resumenPeriodo.pagos)}</span>
            </div>
            <div className="item" style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8, padding: '8px 10px' }}>
              <span>
                <b style={{ color: 'var(--text)' }}>Total dinero ingresado a caja</b>
              </span>
              <span className="amount ok" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {fmt(resumenPeriodo.ingresado)}
              </span>
            </div>
            <div className="item">
              <span>Costo de lo vendido</span>
              <span className="amount">{fmt(resumenPeriodo.costoV)}</span>
            </div>

            {Boolean(resumenPeriodo.costoMerma && resumenPeriodo.costoMerma > 0) && (
              <div className="item" style={{ color: '#ea580c' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠️ Pérdida por mermas/roturas ({resumenPeriodo.mermasCant} u.)</span>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '1px 6px' }}
                    onClick={() => setModalHistorialMermas(true)}
                  >
                    Ver detalle
                  </button>
                </span>
                <span className="amount debt">-{fmt(resumenPeriodo.costoMerma || 0)}</span>
              </div>
            )}

            <div
              className="item"
              style={{
                marginTop: 6,
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <span>
                <b style={{ fontSize: '1rem' }}>Ganancia neta del turno</b>
              </span>
              <span
                className={`amount ${resumenPeriodo.ganancia >= 0 ? 'ok' : 'debt'}`}
                style={{ fontSize: '1.25rem', fontWeight: 800 }}
              >
                {fmt(resumenPeriodo.ganancia)}
              </span>
            </div>
          </div>

          {/* TARJETA DE ACUMULADO TOTAL HISTÓRICO */}
          <div className="card">
            <div className="sub" style={{ fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              🏛️ Acumulado Histórico Global (No se reinicia al cerrar caja)
            </div>
            <div className="item">
              <span>Inversión total acumulada en compras</span>
              <span className="amount">{fmt(resumenTotal.inv)}</span>
            </div>
            <div className="item">
              <span>Total dinero ingresado acumulado</span>
              <span className="amount ok">{fmt(resumenTotal.ingresado)}</span>
            </div>
            <div className="item">
              <span>Falta recuperar de la inversión</span>
              <span className="amount debt">
                {fmt(Math.max(0, resumenTotal.inv - resumenTotal.ingresado))}
              </span>
            </div>
            <div className="item">
              <span>Ganancia real ya recuperada y consolidada</span>
              <span className="amount ok" style={{ fontWeight: 800 }}>
                {fmt(Math.max(0, resumenTotal.ingresado - resumenTotal.inv))}
              </span>
            </div>
          </div>

          {/* RENDIMIENTO POR PRODUCTO DEL TURNO */}
          <div className="card">
            <div className="sub" style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📦</span> Rentabilidad por Producto (Turno Actual)
            </div>
            <div>
              {productos.length ? (
                productos.map((p) => {
                  const x = resumenPeriodo.porP[p.id] || { inv: 0, vend: 0, costo: 0 };
                  const g = x.vend - x.costo;
                  if (x.vend === 0 && x.inv === 0) return null;
                  return (
                    <div className="item" key={p.id}>
                      <div>
                        <div className="name">{p.nombre}</div>
                        <div className="sub" style={{ fontSize: '0.74rem' }}>
                          Ventas {fmt(x.vend)} · Costo {fmt(x.costo)}
                        </div>
                      </div>
                      <div className={`amount ${g >= 0 ? 'ok' : 'debt'}`}>
                        {fmt(g)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty">Sin productos registrados</div>
              )}
            </div>
          </div>

          {/* PAGOS RECIBIDOS EN EL TURNO */}
          <div className="card">
            <div className="sub" style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🤝</span> Abonos de Deudores Recibidos (Turno Actual)
            </div>
            <div>
              {pagosPeriodo.length ? (
                pagosPeriodo.map((m) => (
                  <div className="item" key={m.id || m.ts}>
                    <div>
                      <div className="name">{m.cliente}</div>
                      <div className="sub" style={{ fontSize: '0.74rem' }}>{m.fecha || ''}</div>
                    </div>
                    <div className="amount ok">+{fmt(m.total || 0)}</div>
                  </div>
                ))
              ) : (
                <div className="empty" style={{ padding: '8px 0' }}>No se han recibido abonos en este turno</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 2: INTELIGENCIA BI & MÉTRICAS PREDICTIVAS */}
      {activeSubTab === 'bi' && (
        <EstadisticasView
          movs={movs}
          productos={productos}
          cierres={cierres}
          onVerDetalleCierre={(cierre) => setModalDetalleCierre({ isOpen: true, cierre })}
        />
      )}

      {/* SUB-PESTAÑA 3: HISTORIAL DE CIERRES & ARQUEO CIEGO */}
      {activeSubTab === 'cierres' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔒</span> Cierres de Caja & Conciliación Ciega
                </div>
                <div className="sub" style={{ fontSize: '0.78rem' }}>
                  Auditoría completa de turnos anteriores con análisis de cuadratura (sobrantes o faltantes)
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenCerrarCaja}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                + Nuevo Cierre de Turno
              </button>
            </div>

            <div>
              {cierres.length ? (
                cierres.map((c) => (
                  <div
                    className="item"
                    key={c.id || c.hasta}
                    style={{
                      cursor: 'pointer',
                      padding: '12px 14px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: 10,
                      marginBottom: 8,
                      border: '1px solid var(--border)',
                    }}
                    onClick={() => setModalDetalleCierre({ isOpen: true, cierre: c })}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span className="name" style={{ fontWeight: 800, fontSize: '0.95rem' }}>{c.nombre}</span>
                        {c.estadoArqueo ? (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background:
                                c.estadoArqueo === 'cuadrada'
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : c.estadoArqueo === 'sobrante'
                                  ? 'rgba(234, 179, 8, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                              color:
                                c.estadoArqueo === 'cuadrada'
                                  ? '#22c55e'
                                  : c.estadoArqueo === 'sobrante'
                                  ? '#eab308'
                                  : '#ef4444',
                              border: `1px solid ${
                                c.estadoArqueo === 'cuadrada'
                                  ? 'rgba(34, 197, 94, 0.3)'
                                  : c.estadoArqueo === 'sobrante'
                                  ? 'rgba(234, 179, 8, 0.3)'
                                  : 'rgba(239, 68, 68, 0.3)'
                              }`,
                            }}
                          >
                            {c.estadoArqueo === 'cuadrada'
                              ? '🟢 Cuadrada ($0)'
                              : c.estadoArqueo === 'sobrante'
                              ? `🟡 Sobrante (+${fmt(c.diferenciaTotal || 0)})`
                              : `🔴 Faltante (-${fmt(Math.abs(c.diferenciaTotal || 0))})`}
                          </span>
                        ) : null}
                        {c.por ? (
                          <span className="sub" style={{ fontSize: '0.75rem' }}>
                            • Responsable: {c.por}
                          </span>
                        ) : null}
                      </div>
                      <div className="sub" style={{ fontSize: '0.78rem' }}>
                        {c.desdeTxt} → {c.hastaTxt}
                      </div>
                      <div className="sub" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                        Ventas {fmt(c.vend)} ({c.ventas} ops) · Ingresado {fmt(c.ingresado)} · Compras {fmt(c.inv)}
                      </div>
                      <div className="sub" style={{ fontSize: '0.78rem' }}>
                        Te debían {fmt(c.porCobrar)} · Saldo en cuenta {fmt(c.enCuenta)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <div
                        className={`amount ${c.ganancia >= 0 ? 'ok' : 'debt'}`}
                        style={{ fontWeight: 800, fontSize: '1rem' }}
                      >
                        {fmt(c.ganancia)}
                      </div>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalDetalleCierre({ isOpen: true, cierre: c });
                        }}
                      >
                        📋 Ver Arqueo
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">Aún no has registrado ningún cierre de caja</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 4: AUDITORÍA & MANTENCIÓN */}
      {activeSubTab === 'auditoria' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🛡️</span> Registro de Operaciones y Mantenimiento
            </div>
            <p className="sub" style={{ fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
              Aquí puedes supervisar los movimientos globales registrados en el sistema, revisar inconsistencias y, si es necesario, restablecer la base de datos de pruebas.
            </p>
          </div>

          <div
            className="card"
            style={{
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.05)',
            }}
          >
            <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠️</span> Zona de Mantenimiento Crítico
            </div>
            <div className="sub" style={{ marginBottom: 12, fontSize: '0.8rem' }}>
              Borra ventas, productos, deudas y cierres para reiniciar la tienda desde cero. Te recomendamos exportar a Excel antes si deseas conservar un respaldo.
            </div>
            <button className="btn-red" onClick={handleOpenBorrarTodo} style={{ maxWidth: 280 }}>
              🗑 Eliminar todo el registro
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
