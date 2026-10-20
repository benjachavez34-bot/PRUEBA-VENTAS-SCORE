import React from 'react';
import { CartItem, MedioPago, Cliente } from '../types';
import { fmt } from '../utils/formatters';

interface ModalCheckoutPOSProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateCartCant: (productoId: string, cant: number) => void;
  onUpdateCartPrecioUnit: (productoId: string, newPrecio: number) => void;
  onRemoveFromCart: (productoId: string) => void;
  onClearCart: () => void;
  posDescuento: string;
  setPosDescuento: (val: string) => void;
  posTipoAjuste: 'descuento' | 'recargo';
  setPosTipoAjuste: (val: 'descuento' | 'recargo') => void;
  posMedioPago: MedioPago;
  setPosMedioPago: (val: MedioPago) => void;
  posPagoCon: string;
  setPosPagoCon: (val: string) => void;
  posCliente: string;
  setPosCliente: (val: string) => void;
  posTelefono: string;
  setPosTelefono: (val: string) => void;
  clientNames: string[];
  clientPhones?: string[];
  clientes: Record<string, Cliente>;
  onCobrar: () => Promise<void>;
}

export const ModalCheckoutPOS: React.FC<ModalCheckoutPOSProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateCartCant,
  onUpdateCartPrecioUnit,
  onRemoveFromCart,
  onClearCart,
  posDescuento,
  setPosDescuento,
  posTipoAjuste,
  setPosTipoAjuste,
  posMedioPago,
  setPosMedioPago,
  posPagoCon,
  setPosPagoCon,
  posCliente,
  setPosCliente,
  posTelefono,
  setPosTelefono,
  clientNames,
  clientPhones = [],
  clientes,
  onCobrar,
}) => {
  if (!isOpen) return null;

  const [editingPriceId, setEditingPriceId] = React.useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = React.useState<string>('');

  const subtotal = cart.reduce((s, it) => s + it.subtotal, 0);
  const montoAjuste = Math.max(0, parseFloat(posDescuento) || 0);
  const descuento = posTipoAjuste === 'descuento' ? montoAjuste : 0;
  const recargo = posTipoAjuste === 'recargo' ? montoAjuste : 0;
  const total = Math.max(0, subtotal - descuento + recargo);
  const parsedPago = parseFloat(posPagoCon);
  const pagoConVal = isNaN(parsedPago) ? total : parsedPago;
  const vueltoVal = Math.max(0, pagoConVal - total);
  const totalItems = cart.reduce((s, it) => s + it.cant, 0);

  const isFormValid = () => {
    if (cart.length === 0) return false;
    if (posMedioPago === 'fiado' && !posCliente.trim()) return false;
    if (posMedioPago === 'efectivo' && pagoConVal < total) return false;
    return true;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 520,
          margin: 0,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 -10px 38px rgba(0, 0, 0, 0.45)',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          padding: '16px 18px 24px 18px',
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
            <div style={{ fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚡</span>
              <span>Cobrar Pedido ({totalItems} u.)</span>
            </div>
            <div className="sub" style={{ fontSize: '0.76rem', marginTop: 2 }}>
              Verifica los productos, medio de pago y entrega el comprobante
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{
              width: 34,
              height: 34,
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

        {/* LISTADO DE ITEMS DEL CARRITO */}
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: '10px 12px',
            border: '1px solid var(--border)',
            marginBottom: 12,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)' }}>
              Detalle de Productos
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.72rem', padding: '2px 8px', color: 'var(--accent2)' }}
              onClick={onClearCart}
            >
              Vaciar carrito
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cart.map((it) => (
              <div
                key={it.producto.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 6,
                  borderBottom: '1px dashed var(--border)',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.producto.nombre}
                  </div>
                  {editingPriceId === it.producto.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--muted)' }}>$</span>
                      <input
                        type="number"
                        value={editingPriceVal}
                        onChange={(e) => setEditingPriceVal(e.target.value)}
                        style={{ width: 85, padding: '3px 6px', fontSize: '0.80rem', borderRadius: 4 }}
                        autoFocus
                        placeholder={String(it.precioUnit)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const p = parseFloat(editingPriceVal);
                            if (!isNaN(p) && p >= 0) {
                              onUpdateCartPrecioUnit(it.producto.id, p);
                            }
                            setEditingPriceId(null);
                          } else if (e.key === 'Escape') {
                            setEditingPriceId(null);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-green"
                        style={{ padding: '2px 7px', fontSize: '0.74rem', borderRadius: 4 }}
                        onClick={() => {
                          const p = parseFloat(editingPriceVal);
                          if (!isNaN(p) && p >= 0) {
                            onUpdateCartPrecioUnit(it.producto.id, p);
                          }
                          setEditingPriceId(null);
                        }}
                        title="Confirmar nuevo precio"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: '2px 6px', fontSize: '0.74rem', borderRadius: 4 }}
                        onClick={() => setEditingPriceId(null)}
                        title="Cancelar"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span className="sub" style={{ fontSize: '0.74rem' }}>
                        {fmt(it.precioUnit)} c/u
                      </span>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          color: 'var(--accent)',
                          border: '1px solid rgba(37,99,235,0.3)',
                          borderRadius: 4,
                          background: 'rgba(37,99,235,0.08)',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setEditingPriceId(it.producto.id);
                          setEditingPriceVal(String(it.precioUnit));
                        }}
                        title="Modificar precio unitario en esta ocasión"
                      >
                        ✏️ Modificar
                      </button>
                    </div>
                  )}
                </div>

                {/* CONTROLES CANTIDAD */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '2px 8px', fontSize: '0.85rem', fontWeight: 800, borderRadius: 6 }}
                    onClick={() => onUpdateCartCant(it.producto.id, it.cant - 1)}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 800, minWidth: 22, textAlign: 'center', fontSize: '0.90rem' }}>
                    {it.cant}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '2px 8px', fontSize: '0.85rem', fontWeight: 800, borderRadius: 6 }}
                    onClick={() => onUpdateCartCant(it.producto.id, it.cant + 1)}
                  >
                    +
                  </button>
                </div>

                <div style={{ minWidth: 65, textAlign: 'right', fontWeight: 700, fontSize: '0.92rem' }}>
                  {fmt(it.subtotal)}
                </div>

                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '2px 6px', fontSize: '0.76rem', color: 'var(--muted)' }}
                  onClick={() => onRemoveFromCart(it.producto.id)}
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* TOTAL, AJUSTE (DESCUENTO / RECARGO) Y SUB-TOTAL */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="sub" style={{ fontSize: '0.82rem' }}>Subtotal productos:</span>
            <span style={{ fontWeight: 700 }}>{fmt(subtotal)}</span>
          </div>

          {/* SELECTOR DE AJUSTE: DESCUENTO (-) O RECARGO (+) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              gap: 8,
              flexWrap: 'wrap',
              background: 'rgba(0, 0, 0, 0.12)',
              padding: '6px 10px',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                style={{
                  padding: '3px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: posTipoAjuste === 'descuento' ? '#16a34a' : 'transparent',
                  color: posTipoAjuste === 'descuento' ? '#fff' : 'var(--text)',
                  border: `1px solid ${posTipoAjuste === 'descuento' ? '#16a34a' : 'var(--border)'}`,
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setPosTipoAjuste('descuento')}
              >
                🏷️ Descuento (-)
              </button>
              <button
                type="button"
                style={{
                  padding: '3px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: posTipoAjuste === 'recargo' ? 'var(--accent)' : 'transparent',
                  color: posTipoAjuste === 'recargo' ? '#fff' : 'var(--text)',
                  border: `1px solid ${posTipoAjuste === 'recargo' ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setPosTipoAjuste('recargo')}
              >
                ➕ Recargo / Aumento (+)
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: posTipoAjuste === 'recargo' ? 'var(--accent)' : '#16a34a',
                }}
              >
                {posTipoAjuste === 'recargo' ? '+$' : '-$'}
              </span>
              <input
                type="number"
                placeholder="0"
                value={posDescuento}
                onChange={(e) => setPosDescuento(e.target.value)}
                style={{
                  width: 95,
                  fontSize: '0.88rem',
                  textAlign: 'right',
                  padding: '5px 8px',
                  borderRadius: 6,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.06) 100%)',
              border: '1px solid rgba(37,99,235,0.35)',
              borderRadius: 12,
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>TOTAL A COBRAR:</span>
            <span style={{ fontWeight: 900, fontSize: '1.65rem', color: 'var(--accent)' }}>
              {fmt(total)}
            </span>
          </div>
        </div>

        {/* MEDIOS DE PAGO */}
        <div style={{ marginBottom: 12 }}>
          <label className="sub" style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', marginBottom: 6 }}>
            💳 Medio de Pago:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 6 }}>
            {[
              { id: 'efectivo', label: '💵 Efectivo' },
              { id: 'transferencia', label: '📱 Transf.' },
              { id: 'debito', label: '💳 Débito' },
              { id: 'fiado', label: '⏳ Fiado' },
              { id: 'mixto', label: '🔀 Mixto' },
            ].map((mp) => (
              <button
                key={mp.id}
                type="button"
                className={posMedioPago === mp.id ? 'btn-primary' : 'btn-ghost'}
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 4px',
                  borderRadius: 8,
                }}
                onClick={() => setPosMedioPago(mp.id as MedioPago)}
              >
                {mp.label}
              </button>
            ))}
          </div>
        </div>

        {/* CALCULADORA DE VUELTO (EFECTIVO O MIXTO) */}
        {(posMedioPago === 'efectivo' || posMedioPago === 'mixto') && (
          <div
            style={{
              background: 'rgba(0,0,0,0.12)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                🧮 ¿Con cuánto paga el cliente?
              </span>
              {pagoConVal >= total ? (
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>
                  Vuelto: {fmt(vueltoVal)}
                </span>
              ) : (
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#dc2626' }}>
                  Falta: {fmt(total - pagoConVal)}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                type="number"
                placeholder={String(total)}
                value={posPagoCon}
                onChange={(e) => setPosPagoCon(e.target.value)}
                style={{ fontSize: '1.15rem', fontWeight: 800, flex: 1, padding: '8px 12px' }}
              />
            </div>

            {/* BOTONES BILLETES */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: 'Exacto', val: total },
                { label: '$2.000', val: 2000 },
                { label: '$5.000', val: 5000 },
                { label: '$10.000', val: 10000 },
                { label: '$20.000', val: 20000 },
              ].map((b, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.10)',
                    fontWeight: 600,
                  }}
                  onClick={() => setPosPagoCon(String(b.val))}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CLIENTE Y WHATSAPP */}
        <div style={{ marginBottom: 14 }}>
          <div className="sub" style={{ fontSize: '0.78rem', marginBottom: 4, fontWeight: 700 }}>
            {posMedioPago === 'fiado'
              ? '👤 Cliente Fiado / Crédito (Obligatorio): *'
              : '👤 Cliente & WhatsApp (Opcional para comprobante):'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <input
                placeholder="Nombre cliente"
                list="listaClientesCheckout"
                value={posCliente}
                onChange={(e) => {
                  const val = e.target.value;
                  setPosCliente(val);
                  const normVal = val
                    .trim()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]/g, '');

                  if (normVal) {
                    const match = Object.values(clientes).find((c) => {
                      const cNorm = c.nombre
                        .trim()
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]/g, '');
                      return cNorm === normVal || (c.id && c.id.toLowerCase() === normVal);
                    });
                    if (match?.telefono && (!posTelefono || posTelefono === '+56 9 ')) {
                      setPosTelefono(match.telefono);
                    }
                  }
                }}
                style={{ fontSize: '0.86rem' }}
              />
              <datalist id="listaClientesCheckout">
                {clientNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <input
                type="tel"
                placeholder="WhatsApp (+56 9...)"
                list="listaTelefonosCheckout"
                value={posTelefono}
                onChange={(e) => {
                  const val = e.target.value;
                  setPosTelefono(val);
                  const digits = val.replace(/\D/g, '');
                  if (digits.length >= 8) {
                    const match = Object.values(clientes).find((c) => {
                      if (!c.telefono) return false;
                      const cDigits = c.telefono.replace(/\D/g, '');
                      return cDigits.endsWith(digits.slice(-8)) || digits.endsWith(cDigits.slice(-8));
                    });
                    if (match?.nombre && (!posCliente.trim() || posCliente.startsWith('Cliente '))) {
                      setPosCliente(match.nombre);
                    }
                  }
                }}
                style={{ fontSize: '0.86rem' }}
              />
              <datalist id="listaTelefonosCheckout">
                {clientPhones.map((ph) => (
                  <option key={ph} value={ph} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* BOTÓN FINALIZAR COBRO */}
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={onCobrar}
            disabled={!isFormValid()}
            style={{
              width: '100%',
              padding: '13px 18px',
              fontSize: '1.08rem',
              fontWeight: 900,
              background: isFormValid()
                ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                : 'rgba(107, 114, 128, 0.4)',
              boxShadow: isFormValid() ? '0 6px 18px rgba(22, 163, 74, 0.4)' : 'none',
              cursor: isFormValid() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 12,
            }}
          >
            <span>⚡ Finalizar y Cobrar {fmt(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
