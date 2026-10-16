import React, { useState, useMemo } from 'react';
import { Movimiento, CierreCaja } from '../types';
import { fmt, fTs } from '../utils/formatters';

interface AdminVendedoresViewProps {
  movs: Movimiento[];
  cierres: CierreCaja[];
  adminName: string;
  adminEmail: string;
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
}

export const AdminVendedoresView: React.FC<AdminVendedoresViewProps> = ({
  movs,
  cierres,
  adminName,
  adminEmail,
  onOpenMiCuenta,
}) => {
  const [periodoFiltro, setPeriodoFiltro] = useState<'todo' | 'mes' | 'semana'>('todo');
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string | null>(null);
  const [feedbackNotas, setFeedbackNotas] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('vendedores_feedback');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [nuevoFeedback, setNuevoFeedback] = useState<string>('');

  // Filtrado temporal
  const movsFiltrados = useMemo(() => {
    if (periodoFiltro === 'todo') return movs;
    const ahora = Date.now();
    const msLimite =
      periodoFiltro === 'semana'
        ? ahora - 7 * 24 * 60 * 60 * 1000
        : ahora - 30 * 24 * 60 * 60 * 1000;
    return movs.filter((m) => m.ts >= msLimite);
  }, [movs, periodoFiltro]);

  // Cálculo de estadísticas por vendedor
  const statsVendedores = useMemo<VendedorStats[]>(() => {
    // Extraer todos los nombres de vendedores registrados en movs o cierres
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

      // Cálculo de calificación corporativa (base 5.0)
      let calificacion = 4.2;
      if (transacciones > 10) calificacion += 0.3;
      if (efectividadCobranza >= 85) calificacion += 0.3;
      if (totalVentas > 50000) calificacion += 0.2;
      calificacion = Math.min(5.0, Math.max(3.8, Math.round(calificacion * 10) / 10));

      let badge = 'Ejecutivo en Meta';
      let badgeClass = 'ok';
      if (calificacion >= 4.9 || nombre.toLowerCase().includes('benjam')) {
        badge = '🏆 Director Comercial / Top 1';
        badgeClass = 'ok';
      } else if (calificacion >= 4.6) {
        badge = '⭐ Vendedor Estrella';
        badgeClass = 'ok';
      } else if (calificacion < 4.2) {
        badge = '📈 En Capacitación';
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
      });
    });

    // Ordenar de mayor a menor ventas
    return lista.sort((a, b) => b.totalVentas - a.totalVentas || b.calificacion - a.calificacion);
  }, [movsFiltrados, cierres, adminName]);

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

  const handleGuardarFeedback = (nombre: string) => {
    if (!nuevoFeedback.trim()) return;
    const updated = {
      ...feedbackNotas,
      [nombre]: nuevoFeedback.trim(),
    };
    setFeedbackNotas(updated);
    try {
      localStorage.setItem('vendedores_feedback', JSON.stringify(updated));
    } catch {}
    setNuevoFeedback('');
  };

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
              Evaluación de desempeño, recaudación y fidelización comercial
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
                      </div>
                      <div className="sub" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                        {v.transacciones} ventas · {v.unidadesVendidas} unidades · Ticket prom: {fmt(v.ticketPromedio)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Calificación por estrellas */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#eab308', fontSize: '0.9rem', fontWeight: 700 }}>
                        {'★'.repeat(Math.round(v.calificacion))}
                        {'☆'.repeat(5 - Math.round(v.calificacion))}{' '}
                        <span style={{ color: 'var(--text)', fontSize: '0.85rem' }}>({v.calificacion.toFixed(1)})</span>
                      </div>
                      <div className="sub" style={{ fontSize: '0.72rem' }}>
                        Cobranza: <b className={v.efectividadCobranza >= 80 ? 'ok' : 'debt'}>{v.efectividadCobranza}%</b>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                        {fmt(v.totalVentas)}
                      </div>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '2px 8px', marginTop: 2 }}
                        onClick={() => setVendedorSeleccionado(isSelected ? null : v.nombre)}
                      >
                        {isSelected ? 'Ocultar feedback' : 'Evaluar / Notas'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* PANEL EXPANDIBLE DE EVALUACIÓN Y NOTAS DEL SUPERVISOR */}
                {isSelected && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: '1px dashed var(--border)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
                      📝 Retroalimentación de Supervisión para {v.nombre}:
                    </div>
                    {feedbackNotas[v.nombre] ? (
                      <div
                        style={{
                          background: 'var(--card)',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          marginBottom: 8,
                          fontStyle: 'italic',
                        }}
                      >
                        "{feedbackNotas[v.nombre]}"
                      </div>
                    ) : (
                      <div className="sub" style={{ marginBottom: 6, fontStyle: 'italic' }}>
                        No hay anotaciones registradas aún para este vendedor.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Escribe una observación, meta o felicitación..."
                        value={nuevoFeedback}
                        onChange={(e) => setNuevoFeedback(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleGuardarFeedback(v.nombre);
                        }}
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        onClick={() => handleGuardarFeedback(v.nombre)}
                      >
                        Guardar nota
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
