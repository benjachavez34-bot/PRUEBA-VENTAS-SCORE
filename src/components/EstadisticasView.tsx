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
  onCerrarCaja,
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

  // Lista de meses disponibles en los datos históricos para selector rápido
  const mesesDisponibles = useMemo(() => {
    const monthsSet = new Set<string>();
    movs.forEach((m) => {
      const d = new Date(m.ts);
      const y = d.getFullYear();
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      monthsSet.add(`${y}-${mon}`);
    });
    // Agregar mes actual si está vacío
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

  // Función para cargar un cierre específico en la vista estadística
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

  // Escala para el gráfico de barras por día
  const maxVentaDia = useMemo(() => {
    return Math.max(...stats.ventasPorDia.map((d) => d.total), 1);
  }, [stats.ventasPorDia]);

  const maxUnidadesProd = useMemo(() => {
    return Math.max(...stats.topProductos.map((p) => p.unidades), 1);
  }, [stats.topProductos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* TARJETA DE FILTROS */}
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
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            Filtrar período de estadísticas
          </div>
          <button
            type="button"
            className="btn-green"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => exportExcel(productos, movs, cierres)}
            title="Descargar libro Excel con todas las hojas (.xlsx)"
          >
            📊 Exportar a Excel
          </button>
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
          /* Filtro de rango de fechas personalizado */
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

        {/* Selector rápido de meses si el usuario está en filtro 'mes' */}
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

        {/* Ganancia del período (calculada si hay costo unitario registrado) */}
        <div className="item">
          <div>
            <div className="name">Ganancia bruta estimada</div>
            <div className="sub">
              Ventas ({fmt(stats.ventasTotal)}) menos costo de lo vendido ({fmt(stats.costoTotal)})
            </div>
          </div>
          <div className={`amount ${stats.gananciaTotal >= 0 ? 'ok' : 'debt'}`}>
            {fmt(stats.gananciaTotal)}
          </div>
        </div>
      </div>

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
            {/* Visualización de barras vertical responsiva */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 4,
                height: 140,
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

            {/* Etiquetas de fechas en eje horizontal */}
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

            {/* Días con mayor venta */}
            <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Pico de venta del período:{' '}
              <b style={{ color: 'var(--text)' }}>
                {fmt(maxVentaDia)}
              </b>
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
                  {/* Barra de progreso de volumen */}
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
