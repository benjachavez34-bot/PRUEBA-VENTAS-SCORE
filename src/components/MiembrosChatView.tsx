import React, { useState, useRef, useEffect } from 'react';
import { Miembro, MensajeChat } from '../types';
import { fTs } from '../utils/formatters';
import scoreGorillaLogo from '../assets/images/score_gorilla_bg_1791923074721.jpg';

interface MiembrosChatViewProps {
  miembros: Miembro[];
  mensajes: MensajeChat[];
  nombreActual: string;
  emailActual: string;
  avatarIdActual: string;
  rolActual: string;
  isAdmin: boolean;
  onEnviarMensaje: (texto: string, tipo: 'general' | 'indicacion' | 'urgente') => Promise<void>;
  onOpenMiCuenta: () => void;
}

const ADMIN_EMAILS = [
  'benja.chavez34@gmail.com',
  'fco.inzunza.re@gmail.com',
];

const esAdminEmail = (email?: string) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

export const MiembrosChatView: React.FC<MiembrosChatViewProps> = ({
  miembros,
  mensajes,
  nombreActual,
  emailActual,
  avatarIdActual,
  rolActual,
  isAdmin,
  onEnviarMensaje,
  onOpenMiCuenta,
}) => {
  const [subVista, setSubVista] = useState<'miembros' | 'chat'>('miembros');
  const [nuevoMensaje, setNuevoMensaje] = useState<string>('');
  const [tipoMensaje, setTipoMensaje] = useState<'general' | 'indicacion' | 'urgente'>('general');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final del chat cuando llegan nuevos mensajes
  useEffect(() => {
    if (subVista === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, subVista]);

  // Lista de miembros combinada (siempre garantiza a Benjamín y los demás)
  const listaMiembros = React.useMemo(() => {
    const list: Miembro[] = [];
    const emails = new Set<string>();

    // Benjamín Chávez garantizado como Admin
    const benjaEnLista = miembros.find(
      (m) => m.email?.toLowerCase() === 'benja.chavez34@gmail.com'
    );
    if (benjaEnLista) {
      list.push({ ...benjaEnLista, isAdmin: true });
      emails.add('benja.chavez34@gmail.com');
    } else {
      list.push({
        id: 'admin-benja',
        nombre: 'Benjamín Chávez',
        email: 'benja.chavez34@gmail.com',
        rol: 'Administrador General & Director Comercial',
        telefono: '+56 9 8765 4321',
        sucursal: 'Casa Central - Santiago',
        avatarId: 'gorilla',
        isAdmin: true,
        estado: 'disponible',
      });
      emails.add('benja.chavez34@gmail.com');
    }

    // Francisco Inzunza garantizado como Admin
    const fcoEnLista = miembros.find(
      (m) => m.email?.toLowerCase() === 'fco.inzunza.re@gmail.com'
    );
    if (fcoEnLista) {
      list.push({ ...fcoEnLista, isAdmin: true });
      emails.add('fco.inzunza.re@gmail.com');
    } else {
      list.push({
        id: 'admin-fco',
        nombre: 'Francisco Inzunza',
        email: 'fco.inzunza.re@gmail.com',
        rol: 'Administrador General & Socio',
        telefono: '',
        sucursal: 'Casa Central - Santiago',
        avatarId: 'gorilla',
        isAdmin: true,
        estado: 'disponible',
      });
      emails.add('fco.inzunza.re@gmail.com');
    }

    // Agregar el resto de miembros
    miembros.forEach((m) => {
      if (m.email && !emails.has(m.email.toLowerCase())) {
        list.push(m);
        emails.add(m.email.toLowerCase());
      }
    });

    // Si el usuario actual no está registrado aún, agregarlo
    if (emailActual && !emails.has(emailActual.toLowerCase())) {
      list.push({
        id: 'curr-user',
        nombre: nombreActual || 'Vendedor',
        email: emailActual,
        rol: rolActual || 'Vendedor',
        telefono: '',
        sucursal: 'Ruta Comercial',
        avatarId: avatarIdActual || 'avatar2',
        isAdmin,
        estado: 'disponible',
      });
    }

    // Filtrar por búsqueda si existe
    if (!filtroTexto.trim()) return list;
    const q = filtroTexto.toLowerCase();
    return list.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        m.rol.toLowerCase().includes(q) ||
        m.sucursal.toLowerCase().includes(q) ||
        m.telefono.includes(q)
    );
  }, [miembros, emailActual, nombreActual, rolActual, avatarIdActual, isAdmin, filtroTexto]);

  const handleEnviar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nuevoMensaje.trim() || enviando) return;

    try {
      setEnviando(true);
      await onEnviarMensaje(nuevoMensaje.trim(), tipoMensaje);
      setNuevoMensaje('');
      if (tipoMensaje === 'urgente') setTipoMensaje('general');
    } finally {
      setEnviando(false);
    }
  };

  const getAvatarSrc = (avatarId?: string) => {
    if (avatarId === 'gorilla' || !avatarId) return scoreGorillaLogo;
    if (avatarId === 'avatar1') return 'https://api.dicebear.com/7.x/bottts/svg?seed=Benja';
    if (avatarId === 'avatar2') return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix';
    if (avatarId === 'avatar3') return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sara';
    return scoreGorillaLogo;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* HEADER DE SUBVISTAS (MIEMBROS VS CHAT) */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={subVista === 'miembros' ? 'btn-primary' : 'btn-ghost'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.88rem' }}
              onClick={() => setSubVista('miembros')}
            >
              👥 Directorio de Miembros ({listaMiembros.length})
            </button>
            <button
              type="button"
              className={subVista === 'chat' ? 'btn-primary' : 'btn-ghost'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.88rem' }}
              onClick={() => setSubVista('chat')}
            >
              💬 Chat & Indicaciones ({mensajes.length})
            </button>
          </div>

          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '0.82rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={onOpenMiCuenta}
          >
            ⚙️ Editar mis datos
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUBVISTA 1: DIRECTORIO DE MIEMBROS                        */}
      {/* ========================================================= */}
      {subVista === 'miembros' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* BUSCADOR DE MIEMBROS */}
          <div className="card" style={{ padding: '8px 12px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Buscar compañero por nombre, cargo, teléfono o sucursal..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                style={{ paddingRight: filtroTexto ? 32 : 10 }}
              />
              {filtroTexto && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ position: 'absolute', right: 6, border: 'none', background: 'transparent' }}
                  onClick={() => setFiltroTexto('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* GRID DE MIEMBROS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 10,
            }}
          >
            {listaMiembros.map((m) => {
              const esAdminCard = m.isAdmin || esAdminEmail(m.email);
              const telClean = (m.telefono || '').replace(/[^0-9+]/g, '');

              return (
                <div
                  key={m.id || m.email}
                  className="card"
                  style={{
                    padding: '14px',
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    border: esAdminCard ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: esAdminCard
                      ? 'linear-gradient(135deg, var(--card) 0%, rgba(37,99,235,0.04) 100%)'
                      : 'var(--card)',
                  }}
                >
                  {/* Info Superior */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <img
                      src={getAvatarSrc(m.avatarId)}
                      alt={m.nombre}
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: esAdminCard ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                        boxShadow: esAdminCard ? '0 0 10px rgba(37,99,235,0.35)' : 'none',
                        flexShrink: 0,
                      }}
                      referrerPolicy="no-referrer"
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>{m.nombre}</span>
                        {esAdminCard ? (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              background: 'var(--accent)',
                              color: '#fff',
                              padding: '1px 6px',
                              borderRadius: 4,
                              letterSpacing: '0.5px',
                            }}
                          >
                            👑 ADMIN
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              background: 'var(--bg)',
                              color: 'var(--muted)',
                              border: '1px solid var(--border)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            MIEMBRO
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
                        {m.rol || (esAdminCard ? 'Administrador' : 'Vendedor')}
                      </div>

                      <div className="sub" style={{ fontSize: '0.75rem', marginTop: 3 }}>
                        📍 {m.sucursal || 'Casa Central'}
                      </div>
                    </div>
                  </div>

                  {/* Contacto & Acciones Rápidas */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                      📞 <b>{m.telefono || 'Sin teléfono'}</b>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {telClean && (
                        <a
                          href={`https://wa.me/${telClean.replace('+', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-green"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.78rem',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Abrir WhatsApp"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => {
                          setSubVista('chat');
                          setNuevoMensaje(`@${m.nombre} `);
                        }}
                        title="Escribir en el chat de la empresa"
                      >
                        Mensaje
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVISTA 2: CANAL DE CHAT E INDICACIONES DEL ADMINISTRADOR */}
      {/* ========================================================= */}
      {subVista === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* BANNER INFORMATIVO */}
          <div
            className="card"
            style={{
              padding: '10px 14px',
              margin: 0,
              background: 'linear-gradient(135deg, var(--card) 0%, rgba(37,99,235,0.05) 100%)',
              borderLeft: '4px solid var(--accent)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 2 }}>
              📢 Canal Corporativo de Indicaciones y Coordinación
            </div>
            <div className="sub" style={{ fontSize: '0.8rem' }}>
              Espacio oficial para que la administración (Benjamín) comunique metas, cambios de ruta, alertas de stock y para que el equipo reporte novedades en tiempo real.
            </div>
          </div>

          {/* CAJA DE MENSAJES */}
          <div
            className="card"
            style={{
              padding: '12px',
              minHeight: 320,
              maxHeight: 460,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              margin: 0,
            }}
          >
            {mensajes.length === 0 ? (
              <div
                className="sub"
                style={{
                  textAlign: 'center',
                  margin: 'auto',
                  padding: 24,
                  fontStyle: 'italic',
                }}
              >
                No hay indicaciones aún en el canal. ¡Escribe el primer mensaje para el equipo!
              </div>
            ) : (
              mensajes.map((msg, idx) => {
                const esMio = msg.deEmail?.toLowerCase() === emailActual.toLowerCase();
                const esAdminMsg = msg.esAdmin || esAdminEmail(msg.deEmail);
                const esUrgente = msg.tipo === 'urgente';
                const esIndicacion = msg.tipo === 'indicacion';

                return (
                  <div
                    key={msg.id || msg.ts || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: esMio ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        borderRadius: 12,
                        padding: '10px 12px',
                        background: esUrgente
                          ? 'rgba(220,38,38,0.1)'
                          : esIndicacion
                          ? 'rgba(37,99,235,0.1)'
                          : esMio
                          ? 'rgba(37,99,235,0.12)'
                          : 'var(--bg)',
                        border: esUrgente
                          ? '1px solid var(--accent2)'
                          : esIndicacion
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      {/* Cabecera del mensaje */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text)' }}>
                          {msg.deNombre}
                        </span>
                        {esAdminMsg && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              background: 'var(--accent)',
                              color: '#fff',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            👑 ADMIN
                          </span>
                        )}
                        {esUrgente && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              background: 'var(--accent2)',
                              color: '#fff',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            ⚠️ URGENTE
                          </span>
                        )}
                        {esIndicacion && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              background: 'rgba(37,99,235,0.2)',
                              color: 'var(--accent)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            📢 INDICACIÓN
                          </span>
                        )}
                        <span className="sub" style={{ fontSize: '0.7rem', marginLeft: 'auto' }}>
                          {fTs(msg.ts)}
                        </span>
                      </div>

                      {/* Texto del mensaje */}
                      <div
                        style={{
                          fontSize: '0.88rem',
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: 'var(--text)',
                        }}
                      >
                        {msg.texto}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* FORMULARIO DE ENVÍO */}
          <form
            onSubmit={handleEnviar}
            className="card"
            style={{ padding: '10px 12px', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {/* Si es Admin, puede marcar la categoría de la indicación */}
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
                <span className="sub" style={{ fontWeight: 600 }}>Tipo de indicación:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="tipoMsg"
                    value="general"
                    checked={tipoMensaje === 'general'}
                    onChange={() => setTipoMensaje('general')}
                  />
                  General
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="tipoMsg"
                    value="indicacion"
                    checked={tipoMensaje === 'indicacion'}
                    onChange={() => setTipoMensaje('indicacion')}
                  />
                  📢 Indicación Oficial
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--accent2)', fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="tipoMsg"
                    value="urgente"
                    checked={tipoMensaje === 'urgente'}
                    onChange={() => setTipoMensaje('urgente')}
                  />
                  ⚠️ Urgente
                </label>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={
                  isAdmin
                    ? 'Escribe una indicación o mensaje para el equipo de ventas...'
                    : 'Escribe un mensaje o consulta para Benjamín / equipo...'
                }
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={!nuevoMensaje.trim() || enviando}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                {enviando ? 'Enviando...' : 'Enviar ➤'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
