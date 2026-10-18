import React from 'react';
import { Producto, Cliente } from '../types';
import { fmt } from '../utils/formatters';

interface ModalNuevaDeudaProps {
  isOpen: boolean;
  onClose: () => void;
  onGuardar: () => Promise<void>;
  nombre: string;
  setNombre: (val: string) => void;
  telefono: string;
  setTelefono: (val: string) => void;
  productoId: string;
  setProductoId: (val: string) => void;
  cantidad: string;
  setCantidad: (val: string) => void;
  precio: string;
  setPrecio: (val: string) => void;
  monto: string;
  setMonto: (val: string) => void;
  productos: Producto[];
  clientNames: string[];
  stockDe: (id: string) => number;
  handleProductoChange: (id: string) => void;
  handleCantidadChange: (val: string) => void;
  handlePrecioChange: (val: string) => void;
  clientes: Record<string, Cliente>;
}

export const ModalNuevaDeuda: React.FC<ModalNuevaDeudaProps> = ({
  isOpen,
  onClose,
  onGuardar,
  nombre,
  setNombre,
  telefono,
  setTelefono,
  productoId,
  cantidad,
  precio,
  monto,
  setMonto,
  productos,
  clientNames,
  stockDe,
  handleProductoChange,
  handleCantidadChange,
  handlePrecioChange,
  clientes,
}) => {
  if (!isOpen) return null;

  const selectedProd = productos.find((p) => p.id === productoId);
  const stockDisponible = selectedProd ? stockDe(selectedProd.id) : 0;

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
          maxWidth: 460,
          margin: 0,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(220, 38, 38, 0.35)',
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
              <span>👥</span>
              <span>Registrar Deuda Manual</span>
            </div>
            <div className="sub" style={{ fontSize: '0.76rem', marginTop: 2 }}>
              Anota un fiado o saldo pendiente para seguimiento y cobranza
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

        {/* CAMPOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* NOMBRE CLIENTE Y WHATSAPP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                Cliente / Deudor: *
              </label>
              <input
                placeholder="Nombre cliente"
                list="listaClientesModalDeuda"
                value={nombre}
                onChange={(e) => {
                  const val = e.target.value;
                  setNombre(val);
                  const k = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                  if (clientes[k]?.telefono && (!telefono || telefono === '+56 9 ')) {
                    setTelefono(clientes[k].telefono || '');
                  }
                }}
                style={{ fontSize: '0.88rem' }}
              />
              <datalist id="listaClientesModalDeuda">
                {clientNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                WhatsApp:
              </label>
              <input
                type="tel"
                placeholder="+56 9..."
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={{ fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* PRODUCTO (OPCIONAL) */}
          <div>
            <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
              Producto (Opcional - descuenta del stock):
            </label>
            <select
              value={productoId}
              onChange={(e) => handleProductoChange(e.target.value)}
              style={{ fontSize: '0.88rem', width: '100%' }}
            >
              <option value="">— Solo monto en dinero (sin producto) —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({fmt(p.precio || 0)} · stock: {stockDe(p.id)})
                </option>
              ))}
            </select>
          </div>

          {/* CANTIDAD Y PRECIO UNITARIO (SI ELIGE PRODUCTO) */}
          {selectedProd && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                  Cantidad ({selectedProd.nombre}):
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={cantidad}
                  onChange={(e) => handleCantidadChange(e.target.value)}
                  style={{ fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
                  Precio Unitario $:
                </label>
                <input
                  type="number"
                  placeholder="Precio"
                  value={precio}
                  onChange={(e) => handlePrecioChange(e.target.value)}
                  style={{ fontSize: '0.88rem' }}
                />
              </div>
            </div>
          )}

          {/* MONTO TOTAL ADEUDADO */}
          <div>
            <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 700, fontSize: '0.78rem' }}>
              Monto Total que Queda Debiendo $: *
            </label>
            <input
              type="number"
              placeholder="Ej: 3000"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent2)' }}
            />
          </div>

          {selectedProd && (
            <div className="sub" style={{ fontSize: '0.76rem' }}>
              Stock disponible tras esta deuda: <b>{stockDisponible - (parseFloat(cantidad) || 0)}</b>
            </div>
          )}
        </div>

        {/* BOTONES */}
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
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
            }}
          >
            + Registrar Deuda
          </button>
        </div>
      </div>
    </div>
  );
};
