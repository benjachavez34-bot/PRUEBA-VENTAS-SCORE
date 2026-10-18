import React, { useState, useMemo } from 'react';
import {
  Producto,
  Movimiento,
  CierreCaja,
  FiltroPeriodo,
} from '../types';
import {
  fmt,
  fTs,
  getPeriodRange,
  getEquivalentPreviousRange,
  calcEstadisticas,
  generarReporteEjecutivoWhatsApp,
} from '../utils/formatters';
import { exportExcel } from '../utils/excel';

interface EstadisticasViewProps {
  movs: Movimiento[];
  productos: Producto[];
  cierres: CierreCaja[];
  onCerrarCaja?: (nombreCierre: string, desde: number, hasta: number) => Promise<void>;
  onVerDetalleCierre?: (cierre: CierreCaja) => void;
}

export const EstadisticasView: React.FC<EstadisticasViewProps> = ({
  movs,
  productos,
  cierres,
  onVerDetalleCierre,
}) => {
  const [filtro, setFiltro] = useState<FiltroPeriodo>('mes');
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [customDesde, setCustomDesde] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customHasta, setCustomHasta] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Filtros de la Matriz de Rentabilidad
  const [filtroMatriz, setFiltroMatriz] = useState<'todos' | 'estrellas' | 'criticos' | 'estancados'>('todos');

  // Filtros de Auditoría de Operaciones
  const [mostrarAuditoria, setMostrarAuditoria] = useState<boolean>(false);
  const [filtroAuditoriaTipo, setFiltroAuditoriaTipo] = useState<string>('todos');
  const [filtroAuditoriaOperador, setFiltroAuditoriaOperador] = useState<string>('todos');
  const [filtroAuditoriaSearch, setFiltroAuditoriaSearch] = useState<string>('');

  // Rango activo
  const activeRange = useMemo(() => {
    return getPeriodRange(filtro, refDate, customDesde, customHasta);
  }, [filtro, refDate, customDesde, customHasta]);

  // Rango anterior equivalente para comparación
  const prevRange = useMemo(() => {
    return getEquivalentPreviousRange(filtro, activeRange.desde, activeRange.hasta, refDate);
  }, [filtro, activeRange.desde, activeRange.hasta, refDate]);

  // Estadísticas del período actual y del período anterior
  const stats = useMemo(() => {
    return calcEstadisticas(movs, productos, activeRange.desde, activeRange.hasta, activeRange.etiqueta);
  }, [movs, productos, activeRange.desde, activeRange.hasta, activeRange.etiqueta]);

  const prevStats = useMemo(() => {
    return calcEstadisticas(movs, productos, prevRange.prevDesde, prevRange.prevHasta, prevRange.prevEtiqueta);
  }, [movs, productos, prevRange.prevDesde, prevRange.prevHasta, prevRange.prevEtiqueta]);

  // Operadores disponibles en el histórico
  const operadoresDisponibles = useMemo(() => {
    const s = new Set<string>();
    movs.forEach((m) => {
      if (m.por && m.por.trim()) s.add(m.por.trim());
    });
    return Array.from(s).sort();
  }, [movs]);

  // Movimientos del período para el registro de auditoría
  const movsAuditoriaFiltrados = useMemo(() => {
    const list = movs.filter((m) => m.ts >= activeRange.desde && m.ts <= activeRange.hasta);
    return list
      .filter((m) => {
        if (filtroAuditoriaTipo !== 'todos' && m.tipo !== filtroAuditoriaTipo) return false;
        if (filtroAuditoriaOperador !== 'todos' && (m.por || '').trim().toLowerCase() !== filtroAuditoriaOperador.toLowerCase()) return false;
        if (filtroAuditoriaSearch.trim()) {
          const q = filtroAuditoriaSearch.trim().toLowerCase();
          const prod = (m.producto || '').toLowerCase();
          const cli = (m.cliente || '').toLowerCase();
          const nota = (m.nota || '').toLowerCase();
          if (!prod.includes(q) && !cli.includes(q) && !nota.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.ts - a.ts);
  }, [movs, activeRange.desde, activeRange.hasta, filtroAuditoriaTipo, filtroAuditoriaOperador, filtroAuditoriaSearch]);

  // Navegación temporal rápida
  const handleNavPrev = () => {
    const next = new Date(refDate);
    if (filtro === 'dia') next.setDate(next.getDate() - 1);
    else if (filtro === 'semana') next.setDate(next.getDate() - 7);
    else if (filtro === 'mes') next.setMonth(next.getMonth() - 1);
    setRefDate(next);
  };

  const handleNavNext = () => {
    const next = new Date(refDate);
    if (filtro === 'dia') next.setDate(next.getDate() + 1);
    else if (filtro === 'semana') next.setDate(next.getDate() + 7);
    else if (filtro === 'mes') next.setMonth(next.getMonth() + 1);
    setRefDate(next);
  };

  const handleNavHoy = () => {
    setRefDate(new Date());
  };

  // Selector rápido de meses
  const mesesDisponibles = useMemo(() => {
    const monthsSet = new Set<string>();
    movs.forEach((m) => {
      const d = new Date(m.ts);
      const y = d.getFullYear();
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      monthsSet.add(`${y}-${mon}`);
    });
    const now = new Date();
    monthsSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

    return Array.from(monthsSet)
      .sort()
      .reverse()
      .map((ym) => {
        const [y, m] = ym.split('-').map(Number);
        const dateObj = new Date(y, m - 1, 1);
        const label = dateObj.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
        return {
          key: ym,
          dateObj,
          label: label.charAt(0).toUpperCase() + label.slice(1),
        };
      });
  }, [movs]);

  const handleSeleccionarCierre = (cierre: CierreCaja) => {
    setFiltro('personalizado');
    const d1 = new Date(cierre.desde).toISOString().split('T')[0];
    const d2 = new Date(cierre.hasta).toISOString().split('T')[0];
    setCustomDesde(d1);
    setCustomHasta(d2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cálculo de variación porcentual
  const calcVariacion = (actual: number, anterior: number): { pct: number | null; texto: string; isPositive: boolean } => {
    if (anterior === 0) {
      if (actual === 0) return { pct: 0, texto: '0%', isPositive: true };
      return { pct: null, texto: '+100% (nuevo)', isPositive: true };
    }
    const diff = ((actual - anterior) / anterior) * 100;
    const isPositive = diff >= 0;
    const texto = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
    return { pct: diff, texto, isPositive };
  };

  const varVentas = calcVariacion(stats.ventasTotal, prevStats.ventasTotal);
  const varIngresos = calcVariacion(stats.ingresosTotal, prevStats.ingresosTotal);
  const varUnidades = calcVariacion(stats.unidadesVendidas, prevStats.unidadesVendidas);

  // Escalas gráficas
  const maxVentaDia = useMemo(() => {
    return Math.max(...stats.ventasPorDia.map((d) => d.total), 1);
  }, [stats.ventasPorDia]);

  const maxUnidadesProd = useMemo(() => {
    return Math.max(...stats.topProductos.map((p) => p.unidades), 1);
  }, [stats.topProductos]);

  const maxVentaHora = useMemo(() => {
    return Math.max(...(stats.distribucionHoraria || []).map((h) => h.total), 1);
  }, [stats.distribucionHoraria]);

  // Productos de la Matriz filtrados
  const rentabilidadFiltrada = useMemo(() => {
    const lista = stats.rentabilidadProductos || [];
    if (filtroMatriz === 'estrellas') {
      return lista.filter((p) => p.clasificacion === 'estrella');
    }
    if (filtroMatriz === 'criticos') {
      return lista.filter((p) => p.alertaAgotamiento);
    }
    if (filtroMatriz === 'estancados') {
      return lista.filter((p) => p.clasificacion === 'estancado');
    }
    return lista;
  }, [stats.rentabilidadProductos, filtroMatriz]);

  const cantCriticos = (stats.rentabilidadProductos || []).filter((p) => p.alertaAgotamiento).length;
  const cantEstrellas = (stats.rentabilidadProductos || []).filter((p) => p.clasificacion === 'estrella').length;
  const cantEstancados = (stats.rentabilidadProductos || []).filter((p) => p.clasificacion === 'estancado').length;

  const handleCompartirReporteWhatsApp = () => {
    const texto = generarReporteEjecutivoWhatsApp(stats);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* TARJETA DE FILTROS & ACCIONES DE GERENCIA */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📊</span> Inteligencia de Negocio & Estadísticas
            </div>
            <div className="sub" style={{ fontSize: '0.78rem' }}>
              Análisis financiero, rotación de stock, horarios punta y auditoría
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
              onClick={handleCompartirReporteWhatsApp}
              title="Compartir informe ejecutivo oficial por WhatsApp"
            >
              📲 Reporte WhatsApp
            </button>
            <button
              type="button"
              className="btn-green"
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
              onClick={() => exportExcel(productos, movs, cierres)}
              title="Descargar libro Excel con todas las hojas (.xlsx)"
            >
              📊 Exportar Excel
            </button>
          </div>
        </div>

        {/* Botones de filtro rápido */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button
            className={filtro === 'dia' ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setFiltro('dia')}
          >
            Día
          </button>
          <button
            className={filtro === 'semana' ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setFiltro('semana')}
          >
            Semana
          </button>
          <button
            className={filtro === 'mes' ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setFiltro('mes')}
          >
            Mes
          </button>
          <button
            className={filtro === 'personalizado' ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setFiltro('personalizado')}
          >
            Personalizado
          </button>
        </div>

        {/* Navegación temporal para Día / Semana / Mes */}
        {filtro !== 'personalizado' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background: 'var(--bg)',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <button
              className="btn-ghost"
              style={{ padding: '4px 10px', fontSize: '0.9rem' }}
              onClick={handleNavPrev}
              title="Período anterior"
            >
              ◀
            </button>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {activeRange.etiqueta}
              </div>
              <div className="sub" style={{ fontSize: '0.75rem' }}>
                Comparando con: {prevRange.prevEtiqueta}
              </div>
            </div>
            <button
              className="btn-ghost"
              style={{ padding: '4px 10px', fontSize: '0.9rem' }}
              onClick={handleNavNext}
              title="Período siguiente"
            >
              ▶
            </button>
            <button
              className="btn-ghost"
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
              onClick={handleNavHoy}
            >
              Hoy
            </button>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 6 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="sub">Desde:</span>
              <input
                type="date"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="sub">Hasta:</span>
              <input
                type="date"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Selector rápido de meses */}
        {filtro === 'mes' && mesesDisponibles.length > 1 && (
          <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
            <span className="sub" style={{ flex: 'none' }}>
              Saltar a mes:
            </span>
            <select
              value={`${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                setRefDate(new Date(y, m - 1, 1));
              }}
            >
              {mesesDisponibles.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TARJETA DE RESUMEN KPI CON COMPARACIÓN */}
      <div className="card">
        <div className="sub" style={{ fontWeight: 600, marginBottom: 8 }}>
          Rendimiento del período vs {prevRange.prevEtiqueta}
        </div>

        {/* Ventas Totales */}
        <div className="item">
          <div>
            <div className="name">Total ventas</div>
            <div className="sub">
              Anterior: {fmt(prevStats.ventasTotal)} ·{' '}
              <span className={varVentas.isPositive ? 'ok' : 'debt'} style={{ fontWeight: 600 }}>
                {varVentas.texto}
              </span>
            </div>
          </div>
          <div className="amount" style={{ fontSize: '1.2rem' }}>
            {fmt(stats.ventasTotal)}
          </div>
        </div>

        {/* Ingresos Recaudados */}
        <div className="item">
          <div>
            <div className="name">Ingresos cobrados</div>
            <div className="sub">
              Contado + abonos de deudores ·{' '}
              <span className={varIngresos.isPositive ? 'ok' : 'debt'} style={{ fontWeight: 600 }}>
                {varIngresos.texto}
              </span>
            </div>
          </div>
          <div className="amount ok" style={{ fontSize: '1.15rem' }}>
            {fmt(stats.ingresosTotal)}
          </div>
        </div>

        {/* Unidades Vendidas */}
        <div className="item">
          <div>
            <div className="name">Unidades vendidas</div>
            <div className="sub">
              Anterior: {prevStats.unidadesVendidas} unidades ·{' '}
              <span className={varUnidades.isPositive ? 'ok' : 'debt'} style={{ fontWeight: 600 }}>
                {varUnidades.texto}
              </span>
            </div>
          </div>
          <div className="amount">{stats.unidadesVendidas} un.</div>
        </div>

        {/* Transacciones y Ticket promedio */}
        <div className="item">
          <div>
            <div className="name">Ticket promedio</div>
            <div className="sub">{stats.transaccionesCount} operaciones de venta registradas</div>
          </div>
          <div className="amount">{fmt(stats.ticketPromedio)}</div>
        </div>

        {/* Ganancia del período */}
        <div className="item">
          <div>
            <div className="name">Ganancia bruta estimada</div>
            <div className="sub">
              Ventas ({fmt(stats.ventasTotal)}) menos costo ({fmt(stats.costoTotal)})
              {stats.ventasTotal > 0 && (
                <span> · Margen: <b>{Math.round((stats.gananciaTotal / stats.ventasTotal) * 100)}%</b></span>
              )}
            </div>
          </div>
          <div className={`amount ${stats.gananciaTotal >= 0 ? 'ok' : 'debt'}`}>
            {fmt(stats.gananciaTotal)}
          </div>
        </div>
      </div>

      {/* SECCIÓN 1 BI: PARTICIPACIÓN POR MEDIO DE PAGO */}
      {stats.desgloseMedios && stats.desgloseMedios.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💳</span> Cuota por Medio de Pago
              </div>
              <div className="sub" style={{ fontSize: '0.75rem' }}>
                Distribución del dinero según el método de pago utilizado por los clientes
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.desgloseMedios.map((mp) => {
              const colorBar =
                mp.medio === 'efectivo'
                  ? 'var(--accent3)'
                  : mp.medio === 'transferencia'
                  ? 'var(--accent)'
                  : mp.medio === 'debito'
                  ? '#8b5cf6'
                  : '#f97316';

              return (
                <div key={mp.medio}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{mp.label}</span>
                    <span>
                      <b>{fmt(mp.total)}</b>{' '}
                      <span className="sub" style={{ fontSize: '0.75rem' }}>
                        ({mp.porcentaje}% · {mp.transacciones} ventas)
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      width: '100%',
                      background: 'var(--border)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${mp.porcentaje}%`,
                        background: colorBar,
                        borderRadius: 4,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECCIÓN 2 BI: DISTRIBUCIÓN HORARIA & HORAS PUNTA DE VENTA */}
      {stats.distribucionHoraria && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⏰</span> Horas Punta & Flujo de Clientes
              </div>
              <div className="sub" style={{ fontSize: '0.75rem' }}>
                Concentración de ventas a lo largo de las 24 horas del día
              </div>
            </div>

            {stats.horaPico ? (
              <div
                style={{
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  color: '#eab308',
                  padding: '4px 10px',
                  borderRadius: 16,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🔥</span> Pico: {stats.horaPico.horaLabel} hrs ({fmt(stats.horaPico.total)})
              </div>
            ) : null}
          </div>

          {stats.ventasTotal === 0 ? (
            <div className="empty">Sin ventas registradas en el período</div>
          ) : (
            <div>
              {/* Gráfico horario 24h */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 3,
                  height: 120,
                  padding: '8px 2px 4px 2px',
                  borderBottom: '1px solid var(--border)',
                  overflowX: 'auto',
                }}
              >
                {stats.distribucionHoraria.map((dh) => {
                  const isPeak = stats.horaPico && stats.horaPico.hora === dh.hora;
                  const heightPct = Math.max(Math.round((dh.total / maxVentaHora) * 100), dh.total > 0 ? 8 : 2);
                  return (
                    <div
                      key={dh.hora}
                      style={{
                        flex: 1,
                        minWidth: 12,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                      }}
                      title={`${dh.horaLabel} hrs: ${fmt(dh.total)} (${dh.transacciones} ventas, ${dh.unidades} un.)`}
                    >
                      <div
                        style={{
                          width: '85%',
                          height: `${heightPct}%`,
                          background: isPeak ? '#eab308' : dh.total > 0 ? 'var(--accent)' : 'var(--border)',
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 0.2s',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Horas de referencia */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 4,
                  fontSize: '0.7rem',
                  color: 'var(--muted)',
                }}
              >
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRÁFICO DE VENTAS POR DÍA */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div className="sub" style={{ fontWeight: 600 }}>
            Ventas por día
          </div>
          <span className="sub">{stats.ventasPorDia.length} días en el rango</span>
        </div>

        {stats.ventasTotal === 0 ? (
          <div className="empty">No se registraron ventas en este período</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 4,
                height: 130,
                padding: '10px 4px 4px 4px',
                borderBottom: '1px solid var(--border)',
                overflowX: 'auto',
              }}
            >
              {stats.ventasPorDia.map((dia) => {
                const heightPct = Math.max(Math.round((dia.total / maxVentaDia) * 100), dia.total > 0 ? 6 : 2);
                return (
                  <div
                    key={dia.fechaCompleta}
                    style={{
                      flex: 1,
                      minWidth: stats.ventasPorDia.length > 15 ? 18 : 26,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                    }}
                    title={`${dia.fechaCompleta}: ${fmt(dia.total)} (${dia.unidades} un.)`}
                  >
                    <div
                      style={{
                        width: '80%',
                        height: `${heightPct}%`,
                        background: dia.total > 0 ? 'var(--accent)' : 'var(--border)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.2s ease',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 4,
                fontSize: '0.75rem',
                color: 'var(--muted)',
              }}
            >
              <span>{stats.ventasPorDia[0]?.fechaStr || ''}</span>
              {stats.ventasPorDia.length > 2 && (
                <span>
                  {stats.ventasPorDia[Math.floor(stats.ventasPorDia.length / 2)]?.fechaStr || ''}
                </span>
              )}
              <span>{stats.ventasPorDia[stats.ventasPorDia.length - 1]?.fechaStr || ''}</span>
            </div>

            <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Pico de venta del período: <b style={{ color: 'var(--text)' }}>{fmt(maxVentaDia)}</b>
            </div>
          </div>
        )}
      </div>

      {/* TOP DE PRODUCTOS MÁS VENDIDOS */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div className="sub" style={{ fontWeight: 600 }}>
            Productos más vendidos
          </div>
          <span className="sub">{stats.topProductos.length} productos con ventas</span>
        </div>

        {stats.topProductos.length === 0 ? (
          <div className="empty">Sin ventas de productos en este período</div>
        ) : (
          stats.topProductos.slice(0, 10).map((prod, idx) => {
            const barWidth = Math.max(Math.round((prod.unidades / maxUnidadesProd) * 100), 4);
            return (
              <div className="item" key={prod.productoId || prod.nombre}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: idx === 0 ? '#eab308' : 'var(--muted)',
                        minWidth: 18,
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <span className="name">{prod.nombre}</span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      width: '90%',
                      background: 'var(--border)',
                      borderRadius: 3,
                      marginTop: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${barWidth}%`,
                        background: 'var(--accent)',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div className="sub" style={{ marginTop: 2 }}>
                    {prod.unidades} unidades vendidas
                  </div>
                </div>
                <div className="amount">{fmt(prod.total)}</div>
              </div>
            );
          })
        )}
      </div>

      {/* SECCIÓN 3 BI: MATRIZ DE RENTABILIDAD & ESTIMACIÓN DE STOCK */}
      {stats.rentabilidadProductos && stats.rentabilidadProductos.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📈</span> Matriz de Rentabilidad & Días de Stock
              </div>
              <div className="sub" style={{ fontSize: '0.75rem' }}>
                Margen real, velocidad de venta y estimación de días restantes antes de agotar inventario
              </div>
            </div>

            {/* Filtros rápidos de clasificación */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={filtroMatriz === 'todos' ? 'btn-primary' : 'btn-ghost'}
                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                onClick={() => setFiltroMatriz('todos')}
              >
                Todos ({stats.rentabilidadProductos.length})
              </button>
              {cantCriticos > 0 && (
                <button
                  type="button"
                  className={filtroMatriz === 'criticos' ? 'btn-red' : 'btn-ghost'}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  onClick={() => setFiltroMatriz('criticos')}
                >
                  🚨 Críticos ({cantCriticos})
                </button>
              )}
              {cantEstrellas > 0 && (
                <button
                  type="button"
                  className={filtroMatriz === 'estrellas' ? 'btn-primary' : 'btn-ghost'}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  onClick={() => setFiltroMatriz('estrellas')}
                >
                  🌟 Estrellas ({cantEstrellas})
                </button>
              )}
              {cantEstancados > 0 && (
                <button
                  type="button"
                  className={filtroMatriz === 'estancados' ? 'btn-ghost' : 'btn-ghost'}
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  onClick={() => setFiltroMatriz('estancados')}
                >
                  🧊 Sin venta ({cantEstancados})
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rentabilidadFiltrada.slice(0, 15).map((p) => {
              return (
                <div
                  key={p.productoId}
                  style={{
                    background: 'var(--bg)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: p.alertaAgotamiento ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.nombre}</span>
                      {p.clasificacion === 'estrella' && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', fontWeight: 700 }}>
                          🌟 Estrella
                        </span>
                      )}
                      {p.clasificacion === 'rentable' && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 700 }}>
                          💎 Rentable
                        </span>
                      )}
                      {p.clasificacion === 'volumen' && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', fontWeight: 700 }}>
                          🐎 Volumen
                        </span>
                      )}
                      {p.clasificacion === 'estancado' && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, background: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', fontWeight: 700 }}>
                          🧊 Estancado
                        </span>
                      )}
                      {p.alertaAgotamiento && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800 }}>
                          🚨 Quedan {p.diasInventarioRestante}d
                        </span>
                      )}
                    </div>
                    <div className="sub" style={{ fontSize: '0.75rem', marginTop: 3 }}>
                      Stock actual: <b>{p.stockActual} un.</b> ·{' '}
                      {p.diasInventarioRestante !== null ? (
                        <span>Duración est.: <b>{p.diasInventarioRestante} días</b></span>
                      ) : (
                        <span>Sin rotación</span>
                      )}
                      {' '}· Margen: <b>{p.margenPct}%</b> ({fmt(p.margenUnit)}/un.)
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: p.gananciaTotal >= 0 ? 'var(--accent3)' : 'var(--accent2)' }}>
                      {fmt(p.gananciaTotal)}
                    </div>
                    <div className="sub" style={{ fontSize: '0.72rem' }}>
                      {p.unidadesVendidas} un. ({fmt(p.ventasTotal)})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECCIÓN 4 BI: REGISTRO DE AUDITORÍA DE OPERACIONES */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🛡️</span> Registro de Auditoría de Operaciones
            </div>
            <div className="sub" style={{ fontSize: '0.75rem' }}>
              Trazabilidad completa de ventas, cobros, entradas y mermas del período
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            onClick={() => setMostrarAuditoria(!mostrarAuditoria)}
          >
            {mostrarAuditoria ? 'Ocultar ▲' : `Ver registros (${movsAuditoriaFiltrados.length}) ▼`}
          </button>
        </div>

        {mostrarAuditoria && (
          <div style={{ marginTop: 12 }}>
            {/* Controles de filtro */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Buscar por producto, cliente o nota..."
                value={filtroAuditoriaSearch}
                onChange={(e) => setFiltroAuditoriaSearch(e.target.value)}
                style={{ flex: 1, minWidth: 160, fontSize: '0.82rem' }}
              />
              <select
                value={filtroAuditoriaTipo}
                onChange={(e) => setFiltroAuditoriaTipo(e.target.value)}
                style={{ fontSize: '0.82rem' }}
              >
                <option value="todos">Todos los tipos</option>
                <option value="venta">Ventas</option>
                <option value="pago">Abonos / Pagos</option>
                <option value="entrada">Entradas de stock</option>
                <option value="merma">Mermas / Bajas</option>
              </select>
              <select
                value={filtroAuditoriaOperador}
                onChange={(e) => setFiltroAuditoriaOperador(e.target.value)}
                style={{ fontSize: '0.82rem' }}
              >
                <option value="todos">Todos los operadores</option>
                {operadoresDisponibles.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {movsAuditoriaFiltrados.length === 0 ? (
              <div className="empty">No se encontraron operaciones con los filtros aplicados</div>
            ) : (
              <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {movsAuditoriaFiltrados.slice(0, 40).map((m, idx) => {
                  const icon =
                    m.tipo === 'venta'
                      ? '🏷️'
                      : m.tipo === 'pago'
                      ? '💰'
                      : m.tipo === 'entrada'
                      ? '📦'
                      : '🗑️';

                  return (
                    <div
                      key={m.id || `${m.ts}-${idx}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--bg)',
                        fontSize: '0.82rem',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{icon}</span>
                          <span>{m.producto || m.cliente || 'Operación'}</span>
                          {m.cant && <span>({m.cant} un.)</span>}
                          {m.fiado && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: 8, background: '#f97316', color: '#fff' }}>
                              Fiado
                            </span>
                          )}
                        </div>
                        <div className="sub" style={{ fontSize: '0.72rem', marginTop: 1 }}>
                          {fTs(m.ts)} {m.por ? `· Operador: ${m.por}` : ''}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontWeight: 700 }}>
                        <span className={m.tipo === 'venta' || m.tipo === 'pago' ? 'ok' : 'debt'}>
                          {fmt(m.total || m.costoTotal || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* HISTORIAL DE CIERRES MENSUALES Y REGISTROS ANTERIORES */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <div className="sub" style={{ fontWeight: 600 }}>
            Cierres mensuales e historial
          </div>
          <span className="sub">{cierres.length} cierres registrados</span>
        </div>

        <p className="sub" style={{ margin: '4px 0 10px 0', fontSize: '0.8rem' }}>
          Puedes consultar cualquier cierre anterior sin alterar los movimientos originales. Al pulsar
          "Consultar", el filtro superior se ajustará a las fechas de ese período cerrado.
        </p>

        {cierres.length === 0 ? (
          <div className="empty">Aún no hay cierres registrados en el historial</div>
        ) : (
          cierres.map((c) => (
            <div
              className="item"
              key={c.id || c.hasta}
              style={{
                background: 'var(--bg)',
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 6,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="name">{c.nombre}</span>
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
                      • Por {c.por}
                    </span>
                  ) : null}
                </div>
                <div className="sub" style={{ marginTop: 2 }}>
                  {c.desdeTxt} → {c.hastaTxt}
                </div>
                <div className="sub" style={{ marginTop: 2 }}>
                  Ventas: <b>{fmt(c.vend)}</b> ({c.ventas} un.) · Ingresado: <b>{fmt(c.ingresado)}</b> · Ganancia:{' '}
                  <b className={c.ganancia >= 0 ? 'ok' : 'debt'}>{fmt(c.ganancia)}</b>
                </div>
                <div className="sub">
                  En cuenta al cierre: {fmt(c.enCuenta)} · Deuda pendiente clientes: {fmt(c.porCobrar)}
                </div>
              </div>

              <div className="actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {onVerDetalleCierre && (
                  <button
                    className="btn-ghost"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    onClick={() => onVerDetalleCierre(c)}
                    title="Ver desglose completo de arqueo y WhatsApp"
                  >
                    📋 Arqueo
                  </button>
                )}
                <button
                  className="btn-primary"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => handleSeleccionarCierre(c)}
                  title="Cargar fechas de este cierre en las estadísticas"
                >
                  🔍 Consultar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* TARJETA DE EXPORTACIÓN A EXCEL */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '14px 16px',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
            📊 Exportar informe contable completo a Excel
          </div>
          <div className="sub" style={{ fontSize: '0.8rem' }}>
            Genera un archivo .xlsx con hojas detalladas de Deudores, Stock, Ventas, Resumen financiero y Cierres.
          </div>
        </div>
        <button
          type="button"
          className="btn-green"
          style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }}
          onClick={() => exportExcel(productos, movs, cierres)}
        >
          📥 Descargar Excel (.xlsx)
        </button>
      </div>
    </div>
  );
};
