import React, { useState, useMemo } from 'react';
import { Deudor, Movimiento, Cliente } from '../types';
import { fmt, fTs } from '../utils/formatters';

interface ClientesCobranzasViewProps {
  deudoresList: Deudor[];
  busquedaDeudor: string;
  setBusquedaDeudor: (val: string) => void;
  totalDeudaNum: number;
  resumenMorosidad: { alDia: number; atencion: number; critico: number };
  movs: Movimiento[];
  clientes: Record<string, Cliente>;
  expandedDeudores: Record<string, boolean>;
  toggleDeudorDetalle: (nombre: string) => void;
  setModalNuevaDeudaOpen: (open: boolean) => void;
  setModalCliente: (data: { isOpen: boolean; nombre: string; telefono: string; limiteCredito: string }) => void;
  handleWhatsAppRecordatorio: (deudor: Deudor) => void;
  handleOpenAbonar: (nombre: string, deuda: number) => void;
  handleSumarDeuda: (nombre: string) => void;
  handleSaldar: (nombre: string, deuda: number) => void;
  handleEnviarComprobanteWhatsApp: (
    nombre: string,
    monto: number,
    saldoAnterior: number,
    saldoActual: number,
    fechaStr: string
  ) => void;
}

export const ClientesCobranzasView: React.FC<ClientesCobranzasViewProps> = ({
  deudoresList,
  busquedaDeudor,
  setBusquedaDeudor,
  totalDeudaNum,
  resumenMorosidad,
  movs,
  clientes,
  expandedDeudores,
  toggleDeudorDetalle,
  setModalNuevaDeudaOpen,
  setModalCliente,
  handleWhatsAppRecordatorio,
  handleOpenAbonar,
  handleSumarDeuda,
  handleSaldar,
  handleEnviarComprobanteWhatsApp,
}) => {
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'critico' | 'atencion' | 'aldia' | 'limite'>('todos');

  // Filtrado reactivo combinado de búsqueda + estado de morosidad/cupo
  const deudoresFiltrados = useMemo(() => {
    let result = deudoresList;

    // Filtro por texto (nombre o teléfono)
    if (busquedaDeudor.trim()) {
      const q = busquedaDeudor.trim().toLowerCase();
      result = result.filter(
        (d) =>
          d.nombre.toLowerCase().includes(q) ||
          (d.telefono && d.telefono.toLowerCase().includes(q))
      );
    }

    // Filtro por píldora de morosidad
    if (filtroEstado === 'critico') {
      result = result.filter((d) => d.diasAntiguedad !== undefined && d.diasAntiguedad > 15);
    } else if (filtroEstado === 'atencion') {
      result = result.filter(
        (d) => d.diasAntiguedad !== undefined && d.diasAntiguedad >= 7 && d.diasAntiguedad <= 15
      );
    } else if (filtroEstado === 'aldia') {
      result = result.filter(
        (d) => d.deuda <= 0 || (d.diasAntiguedad !== undefined && d.diasAntiguedad < 7)
      );
    } else if (filtroEstado === 'limite') {
      result = result.filter(
        (d) => d.limiteCredito && d.limiteCredito > 0 && d.deuda >= d.limiteCredito * 0.8
      );
    }

    return result;
  }, [deudoresList, busquedaDeudor, filtroEstado]);

  // Total de la selección actual filtrada
  const totalFiltradoNum = useMemo(() => {
    return deudoresFiltrados.reduce((acc, d) => acc + (d.deuda || 0), 0);
  }, [deudoresFiltrados]);

  // Obtener iniciales para avatar
  const getInitials = (name: string) => {
    if (!name) return '👤';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* HEADER DE CARTERA: TOTAL ADEUDADO Y ACCIÓN RÁPIDA */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%)',
          border: '1px solid rgba(220, 38, 38, 0.28)',
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>👥</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
                Cartera de Clientes & Cobranzas
              </h2>
            </div>
            <div className="sub" style={{ fontSize: '0.8rem', marginTop: 2 }}>
              Gestión de fiados, límites de crédito, recordatorios por WhatsApp y control de morosidad
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setModalNuevaDeudaOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              borderRadius: 8,
            }}
          >
            <span>+</span>
            <span>Registrar Nuevo Fiado</span>
          </button>
        </div>

        {/* HERO TOTAL BAR */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            padding: '12px 14px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>
              Deuda Total por Cobrar ({deudoresList.length} clientes)
            </span>
            {busquedaDeudor.trim() || filtroEstado !== 'todos' ? (
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f59e0b', marginTop: 3 }}>
                Filtrado ({deudoresFiltrados.length}): <b>{fmt(totalFiltradoNum)}</b>
              </div>
            ) : null}
          </div>
          <div className="debt" style={{ fontSize: '1.6rem', fontWeight: 900 }}>
            {fmt(totalDeudaNum)}
          </div>
        </div>

        {/* BARRA DE SALUD DE CARTERA INTERACTIVA (CLICKABLE PILLS) */}
        {deudoresList.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 10,
            }}
          >
            <div
              style={{
                background: filtroEstado === 'aldia' ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.10)',
                border: `1px solid ${filtroEstado === 'aldia' ? '#10b981' : 'rgba(16, 185, 129, 0.25)'}`,
                borderRadius: 8,
                padding: '8px 6px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setFiltroEstado(filtroEstado === 'aldia' ? 'todos' : 'aldia')}
            >
              <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#10b981' }}>🟢 AL DÍA (&lt;7d)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 2 }}>{resumenMorosidad.alDia}</div>
            </div>

            <div
              style={{
                background: filtroEstado === 'atencion' ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.10)',
                border: `1px solid ${filtroEstado === 'atencion' ? '#f59e0b' : 'rgba(245, 158, 11, 0.25)'}`,
                borderRadius: 8,
                padding: '8px 6px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setFiltroEstado(filtroEstado === 'atencion' ? 'todos' : 'atencion')}
            >
              <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#f59e0b' }}>🟡 ATENCIÓN (7-15d)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 2 }}>{resumenMorosidad.atencion}</div>
            </div>

            <div
              style={{
                background: filtroEstado === 'critico' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.10)',
                border: `1px solid ${filtroEstado === 'critico' ? '#ef4444' : 'rgba(239, 68, 68, 0.25)'}`,
                borderRadius: 8,
                padding: '8px 6px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setFiltroEstado(filtroEstado === 'critico' ? 'todos' : 'critico')}
            >
              <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#ef4444' }}>🔴 VENCIDO (&gt;15d)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 2 }}>{resumenMorosidad.critico}</div>
            </div>
          </div>
        )}
      </div>

      {/* BUSCADOR Y FILTROS RÁPIDOS */}
      <div className="card" style={{ padding: '10px 12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <input
            type="text"
            placeholder="🔍 Buscar deudor por nombre o teléfono (+56 9...)"
            value={busquedaDeudor}
            onChange={(e) => setBusquedaDeudor(e.target.value)}
            style={{ paddingRight: busquedaDeudor ? 36 : 10, borderRadius: 8 }}
          />
          {busquedaDeudor && (
            <button
              type="button"
              className="btn-ghost"
              style={{
                position: 'absolute',
                right: 6,
                padding: '4px 8px',
                fontSize: '0.85rem',
                border: 'none',
                color: 'var(--muted)',
                background: 'transparent',
              }}
              onClick={() => setBusquedaDeudor('')}
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* CHIPS DE FILTRO */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          <button
            type="button"
            className={`chip-filter ${filtroEstado === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('todos')}
          >
            👥 Todos ({deudoresList.length})
          </button>
          <button
            type="button"
            className={`chip-filter ${filtroEstado === 'critico' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('critico')}
          >
            🔴 Vencidos ({resumenMorosidad.critico})
          </button>
          <button
            type="button"
            className={`chip-filter ${filtroEstado === 'atencion' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('atencion')}
          >
            🟡 En Atención ({resumenMorosidad.atencion})
          </button>
          <button
            type="button"
            className={`chip-filter ${filtroEstado === 'aldia' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('aldia')}
          >
            🟢 Al Día ({resumenMorosidad.alDia})
          </button>
          <button
            type="button"
            className={`chip-filter ${filtroEstado === 'limite' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('limite')}
          >
            ⚠️ Cupo &gt;80%
          </button>
        </div>
      </div>

      {/* LISTADO DE TARJETAS DE CLIENTE CRM */}
      <div id="listaDeudores">
        {deudoresFiltrados.length ? (
          deudoresFiltrados.map((d) => {
            const isExpanded = Boolean(expandedDeudores[d.nombre]);
            const clienteMovs = movs.filter(
              (m) =>
                m.cliente &&
                m.cliente.trim().toLowerCase() === d.nombre.trim().toLowerCase()
            );
            const comprasFiadas = clienteMovs
              .filter((m) => (m.tipo === 'venta' && m.fiado) || m.tipo === 'deuda')
              .sort((a, b) => b.ts - a.ts);
            const pagos = clienteMovs
              .filter((m) => m.tipo === 'pago')
              .sort((a, b) => b.ts - a.ts);

            // Cálculo de uso de cupo si tiene límite
            const tieneLimite = Boolean(d.limiteCredito && d.limiteCredito > 0);
            const porcentajeCupo = tieneLimite
              ? Math.min(100, Math.round((d.deuda / (d.limiteCredito || 1)) * 100))
              : 0;

            const estadoColorClass =
              d.diasAntiguedad !== undefined && d.diasAntiguedad > 15
                ? 'moroso'
                : d.diasAntiguedad !== undefined && d.diasAntiguedad >= 7
                ? 'atencion'
                : 'al-dia';

            const cleanPhone = (d.telefono || '').replace(/\s+/g, '');

            return (
              <div key={d.nombre} className={`cliente-card ${estadoColorClass}`}>
                {/* CABECERA: AVATAR, NOMBRE, BADGE Y ACCIONES DE CONTACTO */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div className="cliente-avatar">{getInitials(d.nombre)}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                          {d.nombre}
                        </span>

                        {/* Semáforo de Morosidad */}
                        {d.diasAntiguedad !== undefined && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 12,
                              background:
                                d.diasAntiguedad > 15
                                  ? 'rgba(239, 68, 68, 0.18)'
                                  : d.diasAntiguedad >= 7
                                  ? 'rgba(245, 158, 11, 0.18)'
                                  : 'rgba(16, 185, 129, 0.18)',
                              color:
                                d.diasAntiguedad > 15
                                  ? '#ef4444'
                                  : d.diasAntiguedad >= 7
                                  ? '#f59e0b'
                                  : '#10b981',
                              border: `1px solid ${
                                d.diasAntiguedad > 15
                                  ? 'rgba(239, 68, 68, 0.35)'
                                  : d.diasAntiguedad >= 7
                                  ? 'rgba(245, 158, 11, 0.35)'
                                  : 'rgba(16, 185, 129, 0.35)'
                              }`,
                            }}
                          >
                            {d.diasAntiguedad > 15
                              ? `🔴 Vencida (${d.diasAntiguedad}d)`
                              : d.diasAntiguedad >= 7
                              ? `🟡 Atención (${d.diasAntiguedad}d)`
                              : `🟢 Al día (${d.diasAntiguedad === 0 ? 'Hoy' : `${d.diasAntiguedad}d`})`}
                          </span>
                        )}
                      </div>

                      {/* Teléfono & Acceso a Perfil */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            color: d.telefono ? 'var(--text)' : 'var(--muted)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>📞</span>
                          <span>{d.telefono || 'Sin teléfono'}</span>
                        </span>

                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: '0.70rem', padding: '1px 6px', color: 'var(--accent)' }}
                          onClick={() =>
                            setModalCliente({
                              isOpen: true,
                              nombre: d.nombre,
                              telefono: d.telefono || '+56 9 ',
                              limiteCredito: d.limiteCredito ? String(d.limiteCredito) : '',
                            })
                          }
                          title="Editar teléfono o cupo de crédito"
                        >
                          ✏️ Editar
                        </button>

                        {cleanPhone && (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="btn-ghost"
                            style={{
                              fontSize: '0.70rem',
                              padding: '1px 6px',
                              color: '#3b82f6',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            Llamar
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* MONTO ADEUDADO DESTACADO */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.70rem', color: 'var(--muted)', fontWeight: 600 }}>Saldo actual</div>
                    <div
                      className={`amount ${d.deuda > 0 ? 'debt' : 'ok'}`}
                      style={{ fontSize: '1.25rem', fontWeight: 900 }}
                    >
                      {d.deuda > 0 ? fmt(d.deuda) : 'Al día'}
                    </div>
                  </div>
                </div>

                {/* BARRA DE CUPO DE CRÉDITO */}
                {tieneLimite ? (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.15)',
                      padding: '8px 10px',
                      borderRadius: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 600 }}>
                      <span>
                        Cupo: <b>{fmt(d.deuda)}</b> / {fmt(d.limiteCredito || 0)}
                      </span>
                      <span
                        style={{
                          color:
                            porcentajeCupo >= 90
                              ? '#ef4444'
                              : porcentajeCupo >= 70
                              ? '#f59e0b'
                              : '#10b981',
                          fontWeight: 700,
                        }}
                      >
                        {porcentajeCupo}% utilizado
                      </span>
                    </div>
                    <div className="credito-bar-bg">
                      <div
                        className="credito-bar-fill"
                        style={{
                          width: `${porcentajeCupo}%`,
                          background:
                            porcentajeCupo >= 90
                              ? '#ef4444'
                              : porcentajeCupo >= 70
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.72rem',
                      color: 'var(--muted)',
                      marginBottom: 10,
                    }}
                  >
                    <span>Sin límite de cupo configurado.</span>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: '0.70rem', padding: '1px 6px', color: 'var(--accent)' }}
                      onClick={() =>
                        setModalCliente({
                          isOpen: true,
                          nombre: d.nombre,
                          telefono: d.telefono || '+56 9 ',
                          limiteCredito: '',
                        })
                      }
                    >
                      + Asignar cupo
                    </button>
                  </div>
                )}

                {/* BOTONES DE ACCIÓN ERGONÓMICOS */}
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    paddingTop: 6,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  {/* WhatsApp 1-Tap Recordatorio */}
                  <button
                    type="button"
                    style={{
                      background: '#25D366',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 12px',
                      borderRadius: 8,
                      fontSize: '0.80rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      boxShadow: '0 2px 8px rgba(37,211,102,0.3)',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleWhatsAppRecordatorio(d)}
                    title="Cobranza express por WhatsApp con datos de BancoEstado"
                  >
                    <span>💬</span>
                    <span>Cobrar WhatsApp</span>
                  </button>

                  {/* Registrar Pago / Abono */}
                  <button
                    type="button"
                    className="btn-green"
                    style={{ padding: '7px 12px', fontSize: '0.80rem', borderRadius: 8, fontWeight: 700 }}
                    onClick={() => handleOpenAbonar(d.nombre, d.deuda)}
                  >
                    💵 Abonar
                  </button>

                  {/* Saldar Todo */}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '7px 10px', fontSize: '0.80rem', borderRadius: 8 }}
                    onClick={() => handleSaldar(d.nombre, d.deuda)}
                  >
                    ✔ Saldar
                  </button>

                  {/* Agregar Fiado Rápido */}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '7px 10px', fontSize: '0.80rem', borderRadius: 8, color: '#ef4444' }}
                    onClick={() => handleSumarDeuda(d.nombre)}
                  >
                    + Fiado
                  </button>

                  {/* Toggle Historial */}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      marginLeft: 'auto',
                      padding: '7px 10px',
                      fontSize: '0.78rem',
                      color: 'var(--muted)',
                      fontWeight: 600,
                    }}
                    onClick={() => toggleDeudorDetalle(d.nombre)}
                  >
                    {isExpanded ? '▲ Ocultar' : `▼ Detalle (${comprasFiadas.length})`}
                  </button>
                </div>

                {/* HISTORIAL DETALLADO COLAPSABLE */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '12px 14px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        marginBottom: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>📦 Compras y Fiados Registrados:</span>
                      <span className="sub">{comprasFiadas.length} compras</span>
                    </div>

                    {comprasFiadas.length === 0 ? (
                      <div className="sub" style={{ fontStyle: 'italic', padding: '4px 0' }}>
                        No hay productos registrados con saldo pendiente.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {comprasFiadas.map((m, idx) => (
                          <div
                            key={m.id || m.ts || idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '5px 0',
                              borderBottom:
                                idx < comprasFiadas.length - 1 ? '1px dashed var(--border)' : 'none',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {m.producto
                                  ? `${m.cant ? `${m.cant}x ` : ''}${m.producto}`
                                  : m.nota || 'Deuda manual'}
                              </div>
                              <div className="sub" style={{ fontSize: '0.74rem' }}>
                                {fTs(m.ts)}
                                {m.por ? ` · Registró: ${m.por}` : ''}
                                {m.producto && m.nota ? ` (${m.nota})` : ''}
                              </div>
                            </div>
                            <div className="amount debt" style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                              {fmt(m.total || 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Historial de abonos/pagos */}
                    {pagos.length > 0 && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 8,
                          borderTop: '1px solid var(--border)',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.80rem',
                            color: 'var(--muted)',
                            marginBottom: 6,
                          }}
                        >
                          🤝 Abonos y pagos recibidos:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {pagos.slice(0, 5).map((p, idx) => (
                            <div
                              key={p.id || p.ts || idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.80rem',
                                gap: 6,
                              }}
                            >
                              <span className="sub">
                                {fTs(p.ts)} {p.nota ? `(${p.nota})` : ''}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="amount ok" style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                                  -{fmt(p.total || 0)}
                                </span>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.72rem',
                                    borderRadius: 6,
                                    color: '#16a34a',
                                    border: '1px solid rgba(22,163,74,0.35)',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() =>
                                    handleEnviarComprobanteWhatsApp(
                                      d.nombre,
                                      p.total || 0,
                                      d.deuda + (p.total || 0),
                                      d.deuda,
                                      fTs(p.ts)
                                    )
                                  }
                                  title="Enviar comprobante de este abono por WhatsApp"
                                >
                                  🧾 Comprobante
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Saldo adeudado actual */}
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: 700,
                      }}
                    >
                      <span>Saldo total adeudado:</span>
                      <span className="debt" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                        {fmt(d.deuda)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : deudoresList.length > 0 ? (
          <div className="card empty">
            <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>🔍</div>
            No se encontraron clientes con los filtros aplicados.
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                onClick={() => {
                  setBusquedaDeudor('');
                  setFiltroEstado('todos');
                }}
              >
                Limpiar filtros y ver todos
              </button>
            </div>
          </div>
        ) : (
          <div className="card empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#10b981' }}>
              ¡Cartera 100% al Día!
            </div>
            <div className="sub" style={{ fontSize: '0.82rem', marginTop: 4 }}>
              Ningún cliente tiene deudas o fiados pendientes en este momento.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
