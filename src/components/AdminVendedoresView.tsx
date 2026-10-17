import React, { useState, useMemo } from 'react';
import { Movimiento, CierreCaja, EvaluacionVendedor, EvaluacionCriterios } from '../types';
import { fmt, fTs } from '../utils/formatters';

interface AdminVendedoresViewProps {
  movs: Movimiento[];
  cierres: CierreCaja[];
  adminName: string;
  adminEmail: string;
  evaluaciones?: Record<string, EvaluacionVendedor>;
  onGuardarEvaluacion?: (evaluacion: EvaluacionVendedor) => Promise<void> | void;
  onOpenMiCuenta: () => void;
}

interface VendedorStats {
  nombre: string;
  totalVentas: number;
  unidadesVendidas: number;
  transacciones: number;
  totalCobrado: number;
  totalFiado: number;
  ticketPromedio: number;
  calificacion: number; // 1.0 to 5.0
  efectividadCobranza: number; // percentage
  badge: string;
  badgeClass: string;
  evaluacionOficial?: EvaluacionVendedor;
}

// Componente interactivo para calificar con estrellas
const StarRating: React.FC<{
  value: number;
  onChange?: (val: number) => void;
  size?: number;
}> = ({ value, onChange, size = 18 }) => {
  return (
    <div style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= Math.round(value);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange && onChange(star)}
            disabled={!onChange}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 1px',
              fontSize: `${size}px`,
              cursor: onChange ? 'pointer' : 'default',
              color: isFilled ? '#eab308' : 'rgba(160, 160, 160, 0.3)',
              lineHeight: 1,
              transition: 'transform 0.1s ease',
            }}
            title={onChange ? `Calificar con ${star} estrella${star > 1 ? 's' : ''}` : `${value}/5`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};

export const AdminVendedoresView: React.FC<AdminVendedoresViewProps> = ({
  movs,
  cierres,
  adminName,
  adminEmail,
  evaluaciones = {},
  onGuardarEvaluacion,
  onOpenMiCuenta,
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'todo' | 'mes' | 'semana'>('todo');
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string | null>(null);

  // Estados locales temporales para la evaluación en edición
  const [criteriosTemp, setCriteriosTemp] = useState<EvaluacionCriterios>({
    cumplimientoMetas: 4,
    cobranzaFiado: 4,
    servicioCliente: 4,
    cuadraturaStock: 4,
  });
  const [observacionTemp, setObservacionTemp] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);

  // Filtrado temporal de movimientos
  const movsFiltrados = useMemo(() => {
    if (periodoFiltro === 'todo') return movs;
    const ahora = Date.now();
    const msLimite =
      periodoFiltro === 'semana'
        ? ahora - 7 * 24 * 60 * 60 * 1000
        : ahora - 30 * 24 * 60 * 60 * 1000;
    return movs.filter((m) => m.ts >= msLimite);
  }, [movs, periodoFiltro]);

  // Cálculo de estadísticas y calificaciones por vendedor
  const statsVendedores = useMemo<VendedorStats[]>(() => {
    const nombresSet = new Set<string>();
    
    // Incluir siempre al administrador principal Benjamín Chávez
    nombresSet.add(adminName || 'Benjamín Chávez');

    movsFiltrados.forEach((m) => {
      if (m.por && m.por.trim()) nombresSet.add(m.por.trim());
    });
    cierres.forEach((c) => {
      if (c.por && c.por.trim()) nombresSet.add(c.por.trim());
    });

    const lista: VendedorStats[] = [];

    nombresSet.forEach((nombre) => {
      const vMovs = movsFiltrados.filter(
        (m) => (m.por && m.por.trim().toLowerCase() === nombre.toLowerCase()) ||
               (!m.por && nombre.toLowerCase().includes('benjam'))
      );

      const ventas = vMovs.filter((m) => m.tipo === 'venta');
      const totalVentas = ventas.reduce((s, m) => s + (m.total || 0), 0);
      const unidadesVendidas = ventas.reduce((s, m) => s + (m.cant || 0), 0);
      const transacciones = ventas.length;

      const fiados = ventas.filter((m) => m.fiado);
      const totalFiado = fiados.reduce((s, m) => s + (m.total || 0), 0);

      const pagos = vMovs.filter((m) => m.tipo === 'pago');
      const totalCobrado = pagos.reduce((s, m) => s + (m.total || 0), 0);

      const ticketPromedio = transacciones > 0 ? totalVentas / transacciones : 0;
      
      const efectividadCobranza =
        totalFiado > 0
          ? Math.min(100, Math.round((totalCobrado / totalFiado) * 100))
          : 100;

      // Consultar si tiene una evaluación oficial guardada por el supervisor
      const docKey = nombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const evalOficial = evaluaciones[docKey];

      let calificacion: number;
      if (evalOficial && evalOficial.puntuacionGeneral) {
        calificacion = evalOficial.puntuacionGeneral;
      } else {
        // Cálculo de calificación sugerida basada en desempeño real
        let base = 4.0;
        if (transacciones > 10) base += 0.3;
        if (efectividadCobranza >= 85) base += 0.4;
        if (efectividadCobranza < 50 && totalFiado > 0) base -= 0.5;
        if (totalVentas > 50000) base += 0.3;
        calificacion = Math.min(5.0, Math.max(3.0, Math.round(base * 10) / 10));
      }

      let badge = 'Ejecutivo en Meta';
      let badgeClass = 'ok';
      if (calificacion >= 4.8 || (nombre.toLowerCase().includes('benjam') && !evalOficial)) {
        badge = '🏆 Director Comercial / Top 1';
        badgeClass = 'ok';
      } else if (calificacion >= 4.4) {
        badge = '⭐ Vendedor Estrella';
        badgeClass = 'ok';
      } else if (calificacion >= 3.9) {
        badge = '📈 Ejecutivo en Meta';
        badgeClass = 'ok';
      } else if (calificacion >= 3.2) {
        badge = '🎯 En Capacitación';
        badgeClass = 'debt';
      } else {
        badge = '⚠️ Plan de Mejora';
        badgeClass = 'debt';
      }

      lista.push({
        nombre,
        totalVentas,
        unidadesVendidas,
        transacciones,
        totalCobrado,
        totalFiado,
        ticketPromedio,
        calificacion,
        efectividadCobranza,
        badge,
        badgeClass,
        evaluacionOficial: evalOficial,
      });
    });

    // Ordenar de mayor a menor ventas o calificación
    return lista.sort((a, b) => b.totalVentas - a.totalVentas || b.calificacion - a.calificacion);
  }, [movsFiltrados, cierres, adminName, evaluaciones]);

  // Métricas globales del equipo
  const totalEquipoVentas = useMemo(
    () => statsVendedores.reduce((s, v) => s + v.totalVentas, 0),
    [statsVendedores]
  );
  const totalEquipoUnidades = useMemo(
    () => statsVendedores.reduce((s, v) => s + v.unidadesVendidas, 0),
    [statsVendedores]
  );
  const promedioCobranza = useMemo(
    () =>
      statsVendedores.length
        ? Math.round(
            statsVendedores.reduce((s, v) => s + v.efectividadCobranza, 0) /
              statsVendedores.length
          )
        : 100,
    [statsVendedores]
  );

  // Manejar apertura y carga de datos del vendedor seleccionado para evaluar
  const handleToggleVendedor = (nombre: string) => {
    if (vendedorSeleccionado === nombre) {
      setVendedorSeleccionado(null);
      return;
    }

    const docKey = nombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const existing = evaluaciones[docKey];

    if (existing) {
      setCriteriosTemp({ ...existing.criterios });
      setObservacionTemp(existing.observacion || '');
    } else {
      const stat = statsVendedores.find((s) => s.nombre === nombre);
      const cobranzaStar = stat ? (stat.efectividadCobranza >= 85 ? 5 : stat.efectividadCobranza >= 65 ? 4 : 3) : 4;
      const ventasStar = stat ? (stat.transacciones >= 10 ? 5 : stat.transacciones >= 5 ? 4 : 3) : 4;
      setCriteriosTemp({
        cumplimientoMetas: ventasStar,
        cobranzaFiado: cobranzaStar,
        servicioCliente: 4,
        cuadraturaStock: 4,
      });
      setObservacionTemp('');
    }

    setVendedorSeleccionado(nombre);
  };

  // Guardar la evaluación formal
  const handleGuardarEvaluacionCompleta = async (nombre: string) => {
    setGuardando(true);
    try {
      const score =
        Math.round(
          ((criteriosTemp.cumplimientoMetas +
            criteriosTemp.cobranzaFiado +
            criteriosTemp.servicioCliente +
            criteriosTemp.cuadraturaStock) /
            4) *
            10
        ) / 10;

      const nuevaEvaluacion: EvaluacionVendedor = {
        vendedorNombre: nombre,
        puntuacionGeneral: score,
        criterios: { ...criteriosTemp },
        observacion: observacionTemp.trim(),
        evaluadoPor: adminName || 'Benjamín Chávez',
        evaluadoEn: Date.now(),
      };

      if (onGuardarEvaluacion) {
        await onGuardarEvaluacion(nuevaEvaluacion);
      }
    } finally {
      setGuardando(false);
    }
  };

  const scoreCalculado =
    Math.round(
      ((criteriosTemp.cumplimientoMetas +
        criteriosTemp.cobranzaFiado +
        criteriosTemp.servicioCliente +
        criteriosTemp.cuadraturaStock) /
        4) *
        10
    ) / 10;

  let badgeCalculado = '📈 Ejecutivo en Meta';
  if (scoreCalculado >= 4.8) badgeCalculado = '🏆 Top Élite / Director';
  else if (scoreCalculado >= 4.4) badgeCalculado = '⭐ Vendedor Estrella';
  else if (scoreCalculado >= 3.9) badgeCalculado = '📈 Ejecutivo en Meta';
  else if (scoreCalculado >= 3.2) badgeCalculado = '🎯 En Capacitación';
  else badgeCalculado = '⚠️ Plan de Mejora';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* BANNER CORPORATIVO DE ADMINISTRADOR */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--accent)',
          background: 'linear-gradient(135deg, var(--card) 0%, rgba(37,99,235,0.06) 100%)',
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.25rem' }}>👑</span>
              <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                Panel Ejecutivo de Administración & Supervisión
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 12,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                Cuenta Administrador
              </span>
            </div>
            <div className="sub" style={{ fontSize: '0.85rem' }}>
              Titular: <b style={{ color: 'var(--text)' }}>{adminName}</b> ({adminEmail}) · Control integral de equipo de ventas, metas y calificaciones
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
            onClick={onOpenMiCuenta}
          >
            👤 Configurar Mi Cuenta
          </button>
        </div>
      </div>

      {/* METRICAS GENERALES DE LA EMPRESA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
          <div className="sub" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Facturación Equipo
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
            {fmt(totalEquipoVentas)}
          </div>
          <div className="sub" style={{ fontSize: '0.72rem', marginTop: 2 }}>
            {statsVendedores.length} vendedores activos
          </div>
        </div>

        <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
          <div className="sub" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Unidades Colocadas
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {totalEquipoUnidades} un.
          </div>
          <div className="sub" style={{ fontSize: '0.72rem', marginTop: 2 }}>
            Bebidas Score y agua
          </div>
        </div>

        <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
          <div className="sub" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Índice de Cobranza
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent3)', marginTop: 4 }}>
            {promedioCobranza}%
          </div>
          <div className="sub" style={{ fontSize: '0.72rem', marginTop: 2 }}>
            Efectividad en deudores
          </div>
        </div>

        <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
          <div className="sub" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Líder de Ventas
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            🥇 {statsVendedores[0]?.nombre || adminName}
          </div>
          <div className="sub" style={{ fontSize: '0.72rem', marginTop: 2 }}>
            Top Rendimiento
          </div>
        </div>
      </div>

      {/* FILTRO TEMPORAL Y RANKING DE VENDEDORES */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
              📊 Ranking & Calificaciones del Equipo de Ventas
            </div>
            <div className="sub" style={{ fontSize: '0.8rem' }}>
              Evaluación de desempeño, recaudación y fidelización comercial basada en rúbrica oficial
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={periodoFiltro === 'todo' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setPeriodoFiltro('todo')}
            >
              Histórico
            </button>
            <button
              type="button"
              className={periodoFiltro === 'mes' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setPeriodoFiltro('mes')}
            >
              Últimos 30 días
            </button>
            <button
              type="button"
              className={periodoFiltro === 'semana' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setPeriodoFiltro('semana')}
            >
              Últimos 7 días
            </button>
          </div>
        </div>

        {/* LISTA DE VENDEDORES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {statsVendedores.map((v, idx) => {
            const isSelected = vendedorSeleccionado === v.nombre;
            const medalla = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const esOficial = Boolean(v.evaluacionOficial);

            return (
              <div
                key={v.nombre}
                style={{
                  border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: isSelected ? 'rgba(37,99,235,0.04)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{medalla}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{v.nombre}</span>
                        {v.nombre.toLowerCase().includes('benjam') && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              background: 'var(--accent)',
                              color: '#fff',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                          >
                            DIRECTOR / ADMIN
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: v.badgeClass === 'ok' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                            color: v.badgeClass === 'ok' ? 'var(--accent3)' : 'var(--accent2)',
                          }}
                        >
                          {v.badge}
                        </span>
                        {esOficial && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: 'var(--accent3)',
                              background: 'rgba(22,163,74,0.1)',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                            title="Evaluación oficial asignada por el supervisor"
                          >
                            ✓ Evaluado
                          </span>
                        )}
                      </div>
                      <div className="sub" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                        {v.transacciones} ventas · {v.unidadesVendidas} unidades · Ticket prom: {fmt(v.ticketPromedio)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Calificación por estrellas interactiva */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <StarRating value={v.calificacion} size={15} />
                        <span style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: 700 }}>
                          ({v.calificacion.toFixed(1)})
                        </span>
                      </div>
                      <div className="sub" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                        Cobranza: <b className={v.efectividadCobranza >= 80 ? 'ok' : 'debt'}>{v.efectividadCobranza}%</b>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                        {fmt(v.totalVentas)}
                      </div>
                      <button
                        type="button"
                        className={isSelected ? 'btn-primary' : 'btn-ghost'}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', marginTop: 2 }}
                        onClick={() => handleToggleVendedor(v.nombre)}
                      >
                        {isSelected ? 'Ocultar panel' : '⭐ Evaluar / Calificar'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* PANEL EXPANDIBLE DE EVALUACIÓN OFICIAL DE DESEMPEÑO */}
                {isSelected && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: '1px dashed var(--border)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📝 Evaluación Profesional de Desempeño:</span>
                          <span style={{ color: 'var(--accent)' }}>{v.nombre}</span>
                        </div>
                        <div className="sub" style={{ fontSize: '0.75rem' }}>
                          Asigna estrellas a los 4 pilares comerciales y escribe la observación o meta para este colaborador.
                        </div>
                      </div>

                      {v.evaluacionOficial && (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            background: 'rgba(22,163,74,0.1)',
                            color: 'var(--accent3)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 600,
                          }}
                        >
                          ✓ Última evaluación: {fTs(v.evaluacionOficial.evaluadoEn)} por {v.evaluacionOficial.evaluadoPor}
                        </div>
                      )}
                    </div>

                    {/* RÚBRICA DE 4 PILARES COMERCIALES */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {/* Pilar 1: Metas y Ventas */}
                      <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>🎯 1. Ventas & Metas</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#eab308' }}>
                            {criteriosTemp.cumplimientoMetas}.0
                          </span>
                        </div>
                        <div className="sub" style={{ fontSize: '0.72rem', marginBottom: 6 }}>
                          Rotación de bebidas Score, volumen facturado y colocación en ruta.
                        </div>
                        <StarRating
                          value={criteriosTemp.cumplimientoMetas}
                          onChange={(val) => setCriteriosTemp((c) => ({ ...c, cumplimientoMetas: val }))}
                          size={22}
                        />
                      </div>

                      {/* Pilar 2: Cobranza & Fiados */}
                      <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>💰 2. Cobranza & Fiado</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#eab308' }}>
                            {criteriosTemp.cobranzaFiado}.0
                          </span>
                        </div>
                        <div className="sub" style={{ fontSize: '0.72rem', marginBottom: 6 }}>
                          Recuperación oportuna de deudores y cumplimiento de política 7 días.
                        </div>
                        <StarRating
                          value={criteriosTemp.cobranzaFiado}
                          onChange={(val) => setCriteriosTemp((c) => ({ ...c, cobranzaFiado: val }))}
                          size={22}
                        />
                      </div>

                      {/* Pilar 3: Servicio al Cliente */}
                      <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>🤝 3. Servicio & Atención</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#eab308' }}>
                            {criteriosTemp.servicioCliente}.0
                          </span>
                        </div>
                        <div className="sub" style={{ fontSize: '0.72rem', marginBottom: 6 }}>
                          Cordialidad, fidelización de clientes y representación de la marca.
                        </div>
                        <StarRating
                          value={criteriosTemp.servicioCliente}
                          onChange={(val) => setCriteriosTemp((c) => ({ ...c, servicioCliente: val }))}
                          size={22}
                        />
                      </div>

                      {/* Pilar 4: Stock & Cuadratura */}
                      <div style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>📦 4. Stock & Cuadratura</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#eab308' }}>
                            {criteriosTemp.cuadraturaStock}.0
                          </span>
                        </div>
                        <div className="sub" style={{ fontSize: '0.72rem', marginBottom: 6 }}>
                          Cuidado físico del producto, rendición de caja y precisión en stock.
                        </div>
                        <StarRating
                          value={criteriosTemp.cuadraturaStock}
                          onChange={(val) => setCriteriosTemp((c) => ({ ...c, cuadraturaStock: val }))}
                          size={22}
                        />
                      </div>
                    </div>

                    {/* SCORE CALCULADO RESULTANTE */}
                    <div
                      style={{
                        background: 'rgba(37,99,235,0.06)',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid rgba(37,99,235,0.22)',
                        marginBottom: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.90rem' }}>
                          Score Promedio: <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{scoreCalculado.toFixed(1)} / 5.0</span>
                        </div>
                        <div className="sub" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                          Distintivo corporativo asignado: <b>{badgeCalculado}</b>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StarRating value={scoreCalculado} size={22} />
                      </div>
                    </div>

                    {/* RETROALIMENTACIÓN ESCRITA */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>
                        💬 Observación, Metas o Felicitación del Administrador:
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Escribe comentarios sobre su rendimiento, metas semanales o felicitaciones para el colaborador..."
                        value={observacionTemp}
                        onChange={(e) => setObservacionTemp(e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: '0.85rem',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--card)',
                          color: 'var(--text)',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* BOTONES DE ACCIÓN */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        onClick={() => setVendedorSeleccionado(null)}
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={guardando}
                        style={{
                          padding: '6px 16px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onClick={() => handleGuardarEvaluacionCompleta(v.nombre)}
                      >
                        {guardando ? 'Guardando...' : '💾 Guardar Calificación Oficial'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* METAS Y POLITICAS COMERCIALES */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>
          🎯 Objetivos Comerciales & Estándares de Servicio
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>⚡ Meta de Rotación Score</div>
            <div className="sub" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Mantener stock mínimo de 15 latas Gorilla y 10 Zero por ruta de venta.
            </div>
          </div>
          <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>📋 Política de Cobranza Fiado</div>
            <div className="sub" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Todo fiado debe liquidarse o abonarse dentro de los 7 días corridos.
            </div>
          </div>
          <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>🔒 Conciliación de Cierre</div>
            <div className="sub" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Cierre obligatorio semanal para cuadratura de caja e inventario físico.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
