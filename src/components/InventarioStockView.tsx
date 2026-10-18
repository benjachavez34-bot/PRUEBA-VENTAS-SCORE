import React, { useState, useMemo } from 'react';
import { Producto, Movimiento } from '../types';
import { fmt } from '../utils/formatters';

interface InventarioStockViewProps {
  isAdmin: boolean;
  productos: Producto[];
  movs: Movimiento[];
  categoriasDisponibles: string[];
  stockDe: (id: string, movs: Movimiento[]) => number;
  costoUnit: (id: string, movs: Movimiento[]) => number;
  invertido: (id: string, movs: Movimiento[]) => number;
  setModalNuevoProductoOpen: (open: boolean) => void;
  setScannerOpen: (open: boolean) => void;
  handleOpenEntrada: (id: string) => void;
  handleOpenMerma: (prodId?: string) => void;
  setModalHistorialMermas: (open: boolean) => void;
  handleOpenVentaRapida: (prodId: string) => void;
  handleEliminarProducto: (id: string) => void;
}

export const InventarioStockView: React.FC<InventarioStockViewProps> = ({
  isAdmin,
  productos,
  movs,
  categoriasDisponibles,
  stockDe,
  costoUnit,
  invertido,
  setModalNuevoProductoOpen,
  setScannerOpen,
  handleOpenEntrada,
  handleOpenMerma,
  setModalHistorialMermas,
  handleOpenVentaRapida,
  handleEliminarProducto,
}) => {
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroSeleccionado, setFiltroSeleccionado] = useState<string>('todas');

  // Detección de productos en stock bajo o agotados
  const productosBajoStock = useMemo(() => {
    return productos
      .map((p) => {
        const s = stockDe(p.id, movs);
        const min = p.stockMinimo !== undefined ? p.stockMinimo : 3;
        return {
          producto: p,
          stock: s,
          stockMinimo: min,
          isAgotado: s <= 0,
          isBajo: s <= min,
        };
      })
      .filter((it) => it.isBajo);
  }, [productos, movs, stockDe]);

  // Métricas financieras y de volumen del inventario
  const metrics = useMemo(() => {
    let unidadesFisicas = 0;
    let valorCosto = 0;
    let valorVenta = 0;
    let agotados = 0;
    let bajos = 0;

    productos.forEach((p) => {
      const s = Math.max(0, stockDe(p.id, movs));
      const cu = costoUnit(p.id, movs);
      const min = p.stockMinimo !== undefined ? p.stockMinimo : 3;

      unidadesFisicas += s;
      valorCosto += s * cu;
      valorVenta += s * (p.precio || 0);

      if (s === 0) agotados++;
      else if (s <= min) bajos++;
    });

    return {
      unidadesFisicas,
      valorCosto,
      valorVenta,
      agotados,
      bajos,
    };
  }, [productos, movs, stockDe, costoUnit]);

  // Filtrado reactivo de productos
  const productosFiltrados = useMemo(() => {
    let result = productos;

    // Filtro por búsqueda
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.categoria && p.categoria.toLowerCase().includes(q)) ||
          (p.codigoBarra && p.codigoBarra.toLowerCase().includes(q))
      );
    }

    // Filtro por categoría o estado
    if (filtroSeleccionado === 'alertas') {
      const idsBajoStock = new Set(productosBajoStock.map((it) => it.producto.id));
      result = result.filter((p) => idsBajoStock.has(p.id));
    } else if (filtroSeleccionado === 'agotados') {
      result = result.filter((p) => stockDe(p.id, movs) <= 0);
    } else if (filtroSeleccionado === 'en_stock') {
      result = result.filter((p) => {
        const s = stockDe(p.id, movs);
        const min = p.stockMinimo !== undefined ? p.stockMinimo : 3;
        return s > min;
      });
    } else if (filtroSeleccionado !== 'todas') {
      result = result.filter((p) => p.categoria === filtroSeleccionado);
    }

    return result;
  }, [productos, busqueda, filtroSeleccionado, productosBajoStock, stockDe, movs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* HEADER DE INVENTARIO: VALORACIÓN Y CONTROLES PRINCIPALES */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12) 0%, rgba(37, 99, 235, 0.08) 100%)',
          border: '1px solid rgba(22, 163, 74, 0.3)',
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
              <span style={{ fontSize: '1.4rem' }}>📦</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
                Gestión Ágil de Inventario
              </h2>
            </div>
            <div className="sub" style={{ fontSize: '0.8rem', marginTop: 2 }}>
              Control de existencias físicas, valoración de bodega, reposición rápida y registro de bajas
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isAdmin && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setModalNuevoProductoOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                  borderRadius: 8,
                }}
              >
                <span>+</span>
                <span>Nuevo Producto</span>
              </button>
            )}

            <button
              type="button"
              className="btn-primary"
              onClick={() => setScannerOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: 8,
              }}
            >
              <span>📷</span>
              <span>Escanear Código</span>
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => handleOpenMerma()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontWeight: 700,
                border: '1px solid rgba(234, 88, 12, 0.4)',
                color: '#ea580c',
                background: 'rgba(234, 88, 12, 0.08)',
                borderRadius: 8,
              }}
            >
              <span>⚠️</span>
              <span>Baja / Merma</span>
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => setModalHistorialMermas(true)}
              style={{
                fontSize: '0.85rem',
                padding: '8px 12px',
                borderRadius: 8,
              }}
            >
              📋 Historial
            </button>
          </div>
        </div>

        {/* HERO KPI CARDS DE INVENTARIO */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 8,
            marginTop: 8,
          }}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.22)',
              borderRadius: 8,
              padding: '10px 12px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '0.70rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Unidades en Stock
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
              {metrics.unidadesFisicas} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>u.</span>
            </div>
          </div>

          {isAdmin && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.22)',
                borderRadius: 8,
                padding: '10px 12px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '0.70rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Valoración al Costo
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                {fmt(metrics.valorCosto)}
              </div>
            </div>
          )}

          <div
            style={{
              background: 'rgba(0, 0, 0, 0.22)',
              borderRadius: 8,
              padding: '10px 12px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '0.70rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Valor Proyectado Venta
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
              {fmt(metrics.valorVenta)}
            </div>
          </div>

          <div
            style={{
              background: metrics.agotados > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 0, 0, 0.22)',
              borderRadius: 8,
              padding: '10px 12px',
              border: `1px solid ${metrics.agotados > 0 ? 'rgba(239, 68, 68, 0.35)' : 'var(--border)'}`,
            }}
          >
            <div style={{ fontSize: '0.70rem', color: metrics.agotados > 0 ? '#ef4444' : 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Alertas Críticas
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: metrics.agotados > 0 ? '#ef4444' : '#f59e0b', marginTop: 2 }}>
              {metrics.agotados + metrics.bajos} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>({metrics.agotados} agotados)</span>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER DE REABASTECIMIENTO RÁPIDO (SI HAY ALERTAS) */}
      {productosBajoStock.length > 0 && (
        <div
          className="card"
          style={{
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.08)',
            padding: '12px 14px',
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🚨</span>
              <span>Reabastecimiento Urgente ({productosBajoStock.length})</span>
            </div>
            <span className="sub" style={{ fontSize: '0.76rem' }}>
              Existencias menores o iguales al mínimo operativo
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
            {productosBajoStock.map((it) => (
              <div
                key={it.producto.id}
                style={{
                  background: 'var(--card)',
                  border: `1px solid ${it.isAgotado ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.45)'}`,
                  borderRadius: 10,
                  padding: '8px 12px',
                  minWidth: 180,
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.producto.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      marginTop: 2,
                      color: it.isAgotado ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {it.isAgotado ? '🔴 Agotado (0 unid)' : `🟡 Stock Bajo (${it.stock} / mín ${it.stockMinimo})`}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    className="btn-green"
                    style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: 700, width: '100%', justifyContent: 'center' }}
                    onClick={() => handleOpenEntrada(it.producto.id)}
                  >
                    + Reponer Stock
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BUSCADOR Y PÍLDORAS DE FILTRADO */}
      <div className="card" style={{ padding: '10px 12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <input
            type="text"
            placeholder="🔍 Buscar por nombre, categoría o código de barra..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ paddingRight: busqueda ? 36 : 10, borderRadius: 8 }}
          />
          {busqueda && (
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
              onClick={() => setBusqueda('')}
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* PÍLDORAS DE CATEGORÍA Y ESTADO */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          <button
            type="button"
            className={`chip-filter ${filtroSeleccionado === 'todas' ? 'active' : ''}`}
            onClick={() => setFiltroSeleccionado('todas')}
          >
            📦 Todos ({productos.length})
          </button>

          {productosBajoStock.length > 0 && (
            <button
              type="button"
              className={`chip-filter ${filtroSeleccionado === 'alertas' ? 'active' : ''}`}
              style={{ color: filtroSeleccionado === 'alertas' ? '#fff' : '#ef4444' }}
              onClick={() => setFiltroSeleccionado('alertas')}
            >
              ⚠️ Alertas ({productosBajoStock.length})
            </button>
          )}

          <button
            type="button"
            className={`chip-filter ${filtroSeleccionado === 'en_stock' ? 'active' : ''}`}
            onClick={() => setFiltroSeleccionado('en_stock')}
          >
            🟢 Con Stock
          </button>

          {categoriasDisponibles.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip-filter ${filtroSeleccionado === cat ? 'active' : ''}`}
              onClick={() => setFiltroSeleccionado(cat)}
            >
              🏷️ {cat}
            </button>
          ))}
        </div>
      </div>

      {/* LISTADO DE TARJETAS DE INVENTARIO */}
      <div id="listaProductos">
        {productosFiltrados.length ? (
          productosFiltrados.map((p) => {
            const s = stockDe(p.id, movs);
            const min = p.stockMinimo !== undefined ? p.stockMinimo : 3;
            const cu = costoUnit(p.id, movs);
            const inv = invertido(p.id, movs);
            const gananciaUnit = (p.precio || 0) - cu;
            const margenPct = p.precio && p.precio > 0 ? Math.round((gananciaUnit / p.precio) * 100) : 0;

            const estadoStockClass = s <= 0 ? 'agotado' : s <= min ? 'bajo-stock' : 'en-stock';

            return (
              <div key={p.id} className={`inventario-card ${estadoStockClass}`}>
                {/* CABECERA: NOMBRE, BADGES Y PRECIO */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                        {p.nombre}
                      </span>

                      {/* Badge de Stock */}
                      <span className={`badge-stock ${estadoStockClass}`}>
                        {s <= 0 ? '🔴 Agotado (0 u.)' : s <= min ? `🟡 Stock Bajo (${s} / mín ${min})` : `🟢 Stock: ${s} u.`}
                      </span>

                      {/* Badge de Categoría */}
                      {p.categoria && (
                        <span
                          style={{
                            fontSize: '0.70rem',
                            background: 'rgba(37,99,235,0.12)',
                            color: 'var(--accent)',
                            padding: '2px 7px',
                            borderRadius: 12,
                            fontWeight: 700,
                          }}
                        >
                          🏷️ {p.categoria}
                        </span>
                      )}

                      {/* Código de Barra */}
                      {p.codigoBarra && (
                        <span
                          style={{
                            fontSize: '0.70rem',
                            background: 'rgba(100,116,139,0.15)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 600,
                            color: 'var(--sub)',
                          }}
                        >
                          🔖 {p.codigoBarra}
                        </span>
                      )}
                    </div>

                    {/* Desglose Financiero para Administradores */}
                    {isAdmin && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: 'var(--muted)',
                          marginTop: 4,
                          display: 'flex',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          Costo reposición: <b>{fmt(cu)}</b>
                        </span>
                        <span>·</span>
                        <span>
                          Margen ganancia: <b className={gananciaUnit >= 0 ? 'ok' : 'debt'}>{fmt(gananciaUnit)} ({margenPct}%)</b>
                        </span>
                        <span>·</span>
                        <span>Invertido histórico: {fmt(inv)}</span>
                      </div>
                    )}
                  </div>

                  {/* PRECIO DE VENTA DESTACADO */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.70rem', color: 'var(--muted)', fontWeight: 600 }}>Precio venta</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent)' }}>
                      {p.precio ? fmt(p.precio) : 'Sin precio'}
                    </div>
                  </div>
                </div>

                {/* BARRA DE ACCIONES TÁCTILES RÁPIDAS */}
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    paddingTop: 8,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  {/* Botón de Venta Express */}
                  <button
                    type="button"
                    className="btn-primary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.80rem',
                      fontWeight: 700,
                      borderRadius: 8,
                    }}
                    onClick={() => handleOpenVentaRapida(p.id)}
                    title="Vender este producto"
                  >
                    🧾 Vender
                  </button>

                  {/* Entrada de Stock (Admin) */}
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-green"
                      style={{ padding: '6px 12px', fontSize: '0.80rem', fontWeight: 700, borderRadius: 8 }}
                      onClick={() => handleOpenEntrada(p.id)}
                      title="Registrar factura o entrada de stock"
                    >
                      + Entrada de Stock
                    </button>
                  )}

                  {/* Baja / Merma */}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.80rem',
                      fontWeight: 700,
                      borderRadius: 8,
                      color: '#ea580c',
                      borderColor: 'rgba(234, 88, 12, 0.3)',
                    }}
                    onClick={() => handleOpenMerma(p.id)}
                    title="Registrar merma, rotura o degustación"
                  >
                    ⚠️ Merma
                  </button>

                  {/* Eliminar Producto (Admin) */}
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{
                        marginLeft: 'auto',
                        padding: '6px 10px',
                        fontSize: '0.80rem',
                        borderRadius: 8,
                        color: 'var(--muted)',
                      }}
                      onClick={() => handleEliminarProducto(p.id)}
                      title="Eliminar producto permanentemente"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="card empty">
            <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>🔍</div>
            No se encontraron productos que coincidan con los filtros aplicados.
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                onClick={() => {
                  setBusqueda('');
                  setFiltroSeleccionado('todas');
                }}
              >
                Ver todos los productos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
