import React from 'react';
import { fmt } from '../utils/formatters';

interface ModalNuevoProductoProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: () => Promise<void>;
  onOpenScanner: () => void;
  codigoBarra: string;
  setCodigoBarra: (val: string) => void;
  nombre: string;
  setNombre: (val: string) => void;
  categoria: string;
  setCategoria: (val: string) => void;
  stock: string;
  setStock: (val: string) => void;
  costo: string;
  setCosto: (val: string) => void;
  precio: string;
  setPrecio: (val: string) => void;
  stockMinimo: string;
  setStockMinimo: (val: string) => void;
  scannedFeedback: { msg: string; type: 'success' | 'info' | 'warn' } | null;
  setScannedFeedback: (val: { msg: string; type: 'success' | 'info' | 'warn' } | null) => void;
  categoriasDisponibles: string[];
  handleBarcodeManualChange: (code: string) => void;
}

export const ModalNuevoProducto: React.FC<ModalNuevoProductoProps> = ({
  isOpen,
  onClose,
  onGuardar,
  onOpenScanner,
  codigoBarra,
  nombre,
  setNombre,
  categoria,
  setCategoria,
  stock,
  setStock,
  costo,
  setCosto,
  precio,
  setPrecio,
  stockMinimo,
  setStockMinimo,
  scannedFeedback,
  setScannedFeedback,
  categoriasDisponibles,
  handleBarcodeManualChange,
}) => {
  if (!isOpen) return null;

  const parsedStock = parseFloat(stock) || 0;
  const parsedCosto = parseFloat(costo) || 0;
  const parsedPrecio = parseFloat(precio) || 0;
  const costoUnitario = parsedStock > 0 ? parsedCosto / parsedStock : 0;
  const gananciaUnitaria = parsedPrecio > 0 && costoUnitario > 0 ? parsedPrecio - costoUnitario : 0;
  const margenPorcentaje = parsedPrecio > 0 && gananciaUnitaria > 0 ? Math.round((gananciaUnitaria / parsedPrecio) * 100) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1050,
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
          maxWidth: 480,
          margin: 0,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(37, 99, 235, 0.35)',
          background: 'var(--card)',
          borderRadius: 16,
          padding: '16px 18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📦</span>
              <span>Nuevo Producto / Entrada</span>
            </div>
            <div className="sub" style={{ fontSize: '0.76rem', marginTop: 2 }}>
              Registra un producto o ingresa stock nuevo al inventario
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              padding: 0,
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* FEEDBACK DE ESCÁNER */}
        {scannedFeedback && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              marginBottom: 12,
              fontSize: '0.80rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background:
                scannedFeedback.type === 'success'
                  ? 'rgba(22, 163, 74, 0.12)'
                  : 'rgba(37, 99, 235, 0.12)',
              border: `1px solid ${
                scannedFeedback.type === 'success'
                  ? 'rgba(22, 163, 74, 0.35)'
                  : 'rgba(37, 99, 235, 0.35)'
              }`,
              color: 'var(--text)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '1rem' }}>
                {scannedFeedback.type === 'success' ? '✨' : 'ℹ️'}
              </span>
              <span>{scannedFeedback.msg}</span>
            </div>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '2px 6px', fontSize: '0.72rem' }}
              onClick={() => setScannedFeedback(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* CAMPOS DEL FORMULARIO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* CÓDIGO DE BARRA */}
          <div>
            <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
              Código de Barra (EAN-13 / UPC):
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="Ej: 7801610006733"
                value={codigoBarra}
                onChange={(e) => handleBarcodeManualChange(e.target.value)}
                style={{ fontSize: '0.88rem', flex: 1 }}
              />
              <button
                type="button"
                className="btn-primary"
                title="Abrir cámara escáner"
                onClick={onOpenScanner}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                <span>📷 Escanear</span>
              </button>
            </div>
          </div>

          {/* NOMBRE DEL PRODUCTO */}
          <div>
            <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
              Nombre del Producto: *
            </label>
            <input
              placeholder="Ej: Bebida Score Original 500ml"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          {/* CATEGORÍA */}
          <div>
            <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
              Categoría:
            </label>
            <input
              placeholder="Ej: Bebidas Energéticas"
              list="listaCategoriasModal"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            />
            <datalist id="listaCategoriasModal">
              <option value="Bebidas Energéticas" />
              <option value="Snacks y Barras" />
              <option value="Bebidas y Jugos" />
              <option value="Accesorios" />
              {categoriasDisponibles.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* GRID CANTIDAD Y COSTO TOTAL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                Cantidad de entrada: *
              </label>
              <input
                type="number"
                placeholder="Ej: 24"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                Costo TOTAL de compra $:
              </label>
              <input
                type="number"
                placeholder="Ej: 21600"
                min="0"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* GRID PRECIO VENTA Y STOCK MÍNIMO */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                Precio Venta Unitario $: *
              </label>
              <input
                type="number"
                placeholder="Ej: 1500"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                Stock Mínimo (Alerta):
              </label>
              <input
                type="number"
                placeholder="3"
                min="1"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* INDICADOR CALCULADO DE MARGEN */}
          {parsedStock > 0 && parsedCosto > 0 && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.08)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: '0.78rem',
                display: 'flex',
                justifyContent: 'space-between',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                Costo unitario: <b>{fmt(costoUnitario)}</b>
              </div>
              {parsedPrecio > 0 && (
                <div style={{ color: margenPorcentaje > 0 ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
                  Margen: {margenPorcentaje}% ({fmt(gananciaUnitaria)}/u)
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onGuardar}
            style={{
              padding: '8px 18px',
              fontSize: '0.88rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
            }}
          >
            + Registrar Producto
          </button>
        </div>
      </div>
    </div>
  );
};
