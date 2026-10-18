import React, { useState, useRef, useEffect } from 'react';
import { Miembro, MensajeChat } from '../types';
import { fTs } from '../utils/formatters';
import scoreGorillaLogo from '../assets/images/score_gorilla_bg_1791923074721.jpg';
import { playNotificationSound, showBrowserNotification } from '../utils/pushNotifications';

interface MiembrosChatViewProps {
  miembros: Miembro[];
  mensajes: MensajeChat[];
  nombreActual: string;
  emailActual: string;
  avatarIdActual: string;
  rolActual: string;
  telefonoActual?: string;
  sucursalActual?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  adminEmails?: string[];
  onToggleAdminMember?: (email: string, makeAdmin: boolean) => Promise<void>;
  onEnviarMensaje: (texto: string, tipo: 'general' | 'indicacion' | 'urgente') => Promise<void>;
  onOpenMiCuenta: () => void;
}

export const SUPER_ADMIN_EMAIL = 'benja.chavez34@gmail.com';

const ADMIN_EMAILS_DEFAULT = [
  'benja.chavez34@gmail.com',
  'fco.inzunza.re@gmail.com',
];

const esAdminEmail = (email?: string, dynamicAdmins?: string[]) => {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  if (clean === SUPER_ADMIN_EMAIL) return true;
  if (dynamicAdmins && dynamicAdmins.length > 0) {
    return dynamicAdmins.some((e) => e.toLowerCase().trim() === clean);
  }
  return ADMIN_EMAILS_DEFAULT.includes(clean);
};

export const MiembrosChatView: React.FC<MiembrosChatViewProps> = ({
  miembros,
  mensajes,
  nombreActual,
  emailActual,
  avatarIdActual,
  rolActual,
  telefonoActual,
  sucursalActual,
  isAdmin,
  isSuperAdmin = false,
  adminEmails,
  onToggleAdminMember,
  onEnviarMensaje,
  onOpenMiCuenta,
}) => {
  const [subVista, setSubVista] = useState<'miembros' | 'chat'>('miembros');
  const [nuevoMensaje, setNuevoMensaje] = useState<string>('');
  const [tipoMensaje, setTipoMensaje] = useState<'general' | 'indicacion' | 'urgente'>('general');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [nuevoEmailAdmin, setNuevoEmailAdmin] = useState<string>('');
  const [procesandoAutorizacion, setProcesandoAutorizacion] = useState<boolean>(false);
  const [permisoNotif, setPermisoNotif] = useState<NotificationPermission | null>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return null;
  });
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isMeSuperAdmin = isSuperAdmin || emailActual?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;

  const handleConfirmToggleAdmin = async (targetEmail: string, makeAdmin: boolean, targetName: string) => {
    if (!targetEmail || procesandoAutorizacion) return;
    const action = makeAdmin ? 'otorgar permisos de Administrador a' : 'revocar los permisos de Administrador a';
    const detail = makeAdmin
      ? 'Tendrá acceso completo a Caja, Arqueos, Finanzas, Estadísticas BI, Costos, Mermas y Supervisión.'
      : 'Pasará a nivel Vendedor: las secciones de finanzas, caja, costos y gerencia quedarán ocultas.';

    if (window.confirm(`¿Estás seguro de ${action} ${targetName || targetEmail}?\n\n${detail}`)) {
      try {
        setProcesandoAutorizacion(true);
        if (onToggleAdminMember) {
          await onToggleAdminMember(targetEmail, makeAdmin);
        }
      } finally {
        setProcesandoAutorizacion(false);
      }
    }
  };

  const handleAgregarAdminPorCorreo = async () => {
    const clean = nuevoEmailAdmin.toLowerCase().trim();
    if (!clean) return;
    if (!clean.includes('@') || !clean.includes('.')) {
      alert('Por favor ingresa un correo electrónico válido');
      return;
    }
    const yaEsAdmin = adminEmails
      ? adminEmails.some((e) => e.toLowerCase().trim() === clean)
      : esAdminEmail(clean, adminEmails);
    if (yaEsAdmin) {
      alert(`El correo ${clean} ya cuenta con permisos de Administrador.`);
      return;
    }
    try {
      setProcesandoAutorizacion(true);
      if (onToggleAdminMember) {
        await onToggleAdminMember(clean, true);
        setNuevoEmailAdmin('');
      }
    } finally {
      setProcesandoAutorizacion(false);
    }
  };

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

    // Benjamín Chávez garantizado como Administrador Principal
    const benjaEnLista = miembros.find(
      (m) => m.email?.toLowerCase() === SUPER_ADMIN_EMAIL
    );
    const isMeBenja = emailActual?.toLowerCase() === SUPER_ADMIN_EMAIL;
    const benjaNombre = isMeBenja && nombreActual ? nombreActual : (benjaEnLista?.nombre || 'Benjamín Chávez');
    const benjaAvatar = (isMeBenja && avatarIdActual) || benjaEnLista?.avatarId || 'gorilla';
    const benjaTel = (isMeBenja && telefonoActual !== undefined) ? telefonoActual : (benjaEnLista?.telefono || '+56 9 8765 4321');
    const benjaSucursal = (isMeBenja && sucursalActual) || benjaEnLista?.sucursal || 'Casa Central - Santiago';
    const benjaRol = (isMeBenja && rolActual) || benjaEnLista?.rol || 'Administrador General & Director Comercial';

    list.push({
      id: benjaEnLista?.id || 'admin-benja',
      nombre: benjaNombre,
      email: SUPER_ADMIN_EMAIL,
      rol: benjaRol,
      telefono: benjaTel,
      sucursal: benjaSucursal,
      avatarId: benjaAvatar,
      isAdmin: true,
      estado: 'disponible',
    });
    emails.add(SUPER_ADMIN_EMAIL);

    // Francisco Inzunza garantizado en la lista con verificación dinámica de rol Admin
    const fcoEnLista = miembros.find(
      (m) => m.email?.toLowerCase() === 'fco.inzunza.re@gmail.com'
    );
    const isMeFco = emailActual?.toLowerCase() === 'fco.inzunza.re@gmail.com';
    const fcoNombre = isMeFco && nombreActual ? nombreActual : (fcoEnLista?.nombre || 'Francisco Inzunza');
    const fcoAvatar = (isMeFco && avatarIdActual) || fcoEnLista?.avatarId || 'gorilla';
    const fcoTel = (isMeFco && telefonoActual !== undefined) ? telefonoActual : (fcoEnLista?.telefono || '');
    const fcoSucursal = (isMeFco && sucursalActual) || fcoEnLista?.sucursal || 'Casa Central - Santiago';
    
    // Nivel de autorización dinámico según adminEmails
    const fcoIsAdmin = adminEmails
      ? adminEmails.some((e) => e.toLowerCase().trim() === 'fco.inzunza.re@gmail.com')
      : (fcoEnLista ? !!fcoEnLista.isAdmin : true);
    const fcoRol = (isMeFco && rolActual) || fcoEnLista?.rol || (fcoIsAdmin ? 'Administrador General & Socio' : 'Vendedor & Socio');

    list.push({
      id: fcoEnLista?.id || 'admin-fco',
      nombre: fcoNombre,
      email: 'fco.inzunza.re@gmail.com',
      rol: fcoRol,
      telefono: fcoTel,
      sucursal: fcoSucursal,
      avatarId: fcoAvatar,
      isAdmin: fcoIsAdmin,
      estado: 'disponible',
    });
    emails.add('fco.inzunza.re@gmail.com');

    // Agregar el resto de miembros con autorización dinámica
    miembros.forEach((m) => {
      if (m.email && !emails.has(m.email.toLowerCase())) {
        const isCurrent = m.email.toLowerCase() === emailActual?.toLowerCase();
        const isMemberAdmin = m.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL
          ? true
          : adminEmails
          ? adminEmails.some((e) => e.toLowerCase().trim() === m.email.toLowerCase().trim())
          : !!m.isAdmin;

        list.push({
          ...m,
          nombre: isCurrent && nombreActual ? nombreActual : m.nombre,
          avatarId: isCurrent && avatarIdActual ? avatarIdActual : m.avatarId,
          telefono: isCurrent && telefonoActual !== undefined ? telefonoActual : m.telefono,
          rol: isCurrent && rolActual ? rolActual : m.rol,
          sucursal: isCurrent && sucursalActual ? sucursalActual : m.sucursal,
          isAdmin: isMemberAdmin,
        });
        emails.add(m.email.toLowerCase());
      }
    });

    // Si el usuario actual no está registrado aún, agregarlo
    if (emailActual && !emails.has(emailActual.toLowerCase())) {
      const isCurrAdmin = isMeSuperAdmin
        ? true
        : adminEmails
        ? adminEmails.some((e) => e.toLowerCase().trim() === emailActual.toLowerCase().trim())
        : isAdmin;

      list.push({
        id: 'curr-user',
        nombre: nombreActual || (isCurrAdmin ? 'Administrador' : 'Vendedor'),
        email: emailActual,
        rol: rolActual || (isCurrAdmin ? 'Administrador' : 'Vendedor'),
        telefono: '',
        sucursal: 'Ruta Comercial',
        avatarId: avatarIdActual || (isCurrAdmin ? 'gorilla' : 'avatar2'),
        isAdmin: isCurrAdmin,
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
  }, [miembros, emailActual, nombreActual, rolActual, avatarIdActual, isAdmin, isMeSuperAdmin, adminEmails, filtroTexto]);

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
    if (!avatarId) return scoreGorillaLogo;
    if (avatarId.startsWith('data:image/') || avatarId.startsWith('http')) return avatarId;
    if (avatarId === 'gorilla') return scoreGorillaLogo;
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
          {/* BANNER DE AUTORIZACIÓN EXCLUSIVO BENJAMÍN CHÁVEZ */}
          {isMeSuperAdmin && (
            <div
              className="card"
              style={{
                padding: '12px 16px',
                margin: 0,
                background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(6,182,212,0.06) 100%)',
                border: '1.5px solid var(--accent)',
                borderRadius: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    👑 <span>Gestión de Autorizaciones & Administradores</span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: 'var(--accent)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      Exclusivo Benjamín Chávez
                    </span>
                  </div>
                  <div className="sub" style={{ fontSize: '0.80rem', marginTop: 4 }}>
                    Como <b>Administrador Principal</b>, puedes otorgar o revocar permisos de administración a cualquier miembro del equipo.
                    Los miembros con nivel <b>Administrador</b> tienen acceso a Caja, Arqueos, Finanzas, BI, Costos y Supervisión.
                  </div>
                </div>

                {/* Pre-autorizar nuevo correo */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', maxWidth: 380 }}>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={nuevoEmailAdmin}
                    onChange={(e) => setNuevoEmailAdmin(e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '6px 10px', flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '0.80rem', padding: '6px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={handleAgregarAdminPorCorreo}
                    disabled={procesandoAutorizacion}
                  >
                    🛡️ Dar Admin
                  </button>
                </div>
              </div>
            </div>
          )}

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
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: 10,
            }}
          >
            {listaMiembros.map((m) => {
              const isCardSuperAdmin = m.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
              const esAdminCard = isCardSuperAdmin || (adminEmails ? adminEmails.some((e) => e.toLowerCase().trim() === m.email?.toLowerCase().trim()) : (m.isAdmin || esAdminEmail(m.email, adminEmails)));
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
                    gap: 10,
                    border: isCardSuperAdmin
                      ? '1.8px solid #f59e0b'
                      : esAdminCard
                      ? '1.5px solid var(--accent)'
                      : '1px solid var(--border)',
                    background: isCardSuperAdmin
                      ? 'linear-gradient(135deg, var(--card) 0%, rgba(245,158,11,0.06) 100%)'
                      : esAdminCard
                      ? 'linear-gradient(135deg, var(--card) 0%, rgba(37,99,235,0.05) 100%)'
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
                        border: isCardSuperAdmin
                          ? '2.5px solid #f59e0b'
                          : esAdminCard
                          ? '2px solid var(--accent)'
                          : '1.5px solid var(--border)',
                        boxShadow: isCardSuperAdmin
                          ? '0 0 12px rgba(245,158,11,0.45)'
                          : esAdminCard
                          ? '0 0 10px rgba(37,99,235,0.35)'
                          : 'none',
                        flexShrink: 0,
                      }}
                      referrerPolicy="no-referrer"
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>{m.nombre}</span>
                        {isCardSuperAdmin ? (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                              color: '#fff',
                              padding: '1px 7px',
                              borderRadius: 4,
                              letterSpacing: '0.5px',
                            }}
                          >
                            👑 SUPER ADMIN
                          </span>
                        ) : esAdminCard ? (
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
                            🛡️ ADMIN
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
                            👤 VENDEDOR
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
                        {m.rol || (isCardSuperAdmin ? 'Administrador Principal' : esAdminCard ? 'Administrador' : 'Vendedor')}
                      </div>

                      <div className="sub" style={{ fontSize: '0.74rem', marginTop: 2 }}>
                        ✉️ {m.email}
                      </div>

                      <div className="sub" style={{ fontSize: '0.74rem', marginTop: 1 }}>
                        📍 {m.sucursal || 'Casa Central'}
                      </div>
                    </div>
                  </div>

                  {/* PANEL DE GESTIÓN DE AUTORIZACIÓN: EXCLUSIVO BENJAMÍN CHÁVEZ */}
                  {isMeSuperAdmin && (
                    <div style={{ marginTop: 2, marginBottom: 2 }}>
                      {isCardSuperAdmin ? (
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'rgba(234, 179, 8, 0.08)',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            👑 Propietario & Titular
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>
                            🔒 Seguridad Permanente
                          </span>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: esAdminCard ? 'rgba(37,99,235,0.08)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${esAdminCard ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 130 }}>
                            <div
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                color: esAdminCard ? 'var(--accent)' : 'var(--muted)',
                              }}
                            >
                              {esAdminCard ? '🛡️ NIVEL: ADMINISTRADOR' : '👤 NIVEL: VENDEDOR'}
                            </div>
                            <div style={{ fontSize: '0.70rem', color: 'var(--muted)' }}>
                              {esAdminCard
                                ? 'Acceso total a finanzas, caja y costos'
                                : 'Funciones de gerencia y finanzas ocultas'}
                            </div>
                          </div>

                          <button
                            type="button"
                            className={esAdminCard ? 'btn-ghost' : 'btn-primary'}
                            style={{
                              fontSize: '0.74rem',
                              padding: '5px 12px',
                              fontWeight: 700,
                              borderRadius: 8,
                              color: esAdminCard ? '#ef4444' : undefined,
                              borderColor: esAdminCard ? 'rgba(239, 68, 68, 0.4)' : undefined,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onClick={() => handleConfirmToggleAdmin(m.email, !esAdminCard, m.nombre)}
                            disabled={procesandoAutorizacion}
                          >
                            {esAdminCard ? '✕ Quitar Admin' : '👑 Hacer Admin'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
              <span className="sub" style={{ fontSize: '0.74rem' }}>
                💡 En iPhone / Safari: Activa alertas flotantes en pantalla y sonido.
              </span>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.74rem', padding: '3px 8px', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => {
                  playNotificationSound();
                  showBrowserNotification('💬 Prueba de Notificación', '¡El sistema de sonido y alertas está funcionando!');
                  alert('🔔 Prueba ejecutada:\n\n1. Sonido acústico dual reproducido.\n2. Alerta de mensaje enviada.\n\nEn iPhone (Safari normal), las alertas flotantes y sonidos se activan mientras tienes la app abierta. Si deseas notificaciones con pantalla apagada en iPhone, agrega el ícono a tu inicio (Compartir ➔ Agregar a pantalla de inicio).');
                }}
              >
                🧪 Probar sonido y alerta
              </button>
            </div>
          </div>

          {/* AVISO DE ACTIVACIÓN DE NOTIFICACIONES */}
          {permisoNotif === 'default' && (
            <div
              className="card"
              style={{
                padding: '10px 14px',
                margin: 0,
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid var(--accent)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>🔔</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                    Activa las notificaciones de chat
                  </div>
                  <div className="sub" style={{ fontSize: '0.74rem' }}>
                    Recibe alertas y sonido cuando un compañero o la administración envíe un mensaje.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                onClick={async () => {
                  if (typeof window !== 'undefined' && 'Notification' in window) {
                    const p = await Notification.requestPermission();
                    setPermisoNotif(p);
                  }
                }}
              >
                Activar notificaciones
              </button>
            </div>
          )}

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
                const esAdminMsg = msg.esAdmin || esAdminEmail(msg.deEmail, adminEmails);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '0.8rem', padding: '2px 0' }}>
                <span className="sub" style={{ fontWeight: 700, marginRight: 2 }}>Prioridad:</span>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: tipoMensaje === 'general' ? 'var(--card)' : 'transparent',
                    fontWeight: tipoMensaje === 'general' ? 700 : 500,
                  }}
                >
                  <input
                    type="radio"
                    name="tipoMsg"
                    value="general"
                    checked={tipoMensaje === 'general'}
                    onChange={() => setTipoMensaje('general')}
                    style={{ margin: 0, width: 14, height: 14, flex: '0 0 auto', cursor: 'pointer' }}
                  />
                  <span>General</span>
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: tipoMensaje === 'indicacion' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: tipoMensaje === 'indicacion' ? 'rgba(37,99,235,0.08)' : 'transparent',
                    color: tipoMensaje === 'indicacion' ? 'var(--accent)' : 'var(--text)',
                    fontWeight: tipoMensaje === 'indicacion' ? 700 : 500,
                  }}
                >
                  <input
                    type="radio"
                    name="tipoMsg"
                    value="indicacion"
                    checked={tipoMensaje === 'indicacion'}
                    onChange={() => setTipoMensaje('indicacion')}
                    style={{ margin: 0, width: 14, height: 14, flex: '0 0 auto', cursor: 'pointer' }}
                  />
                  <span>📢 Indicación</span>
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: tipoMensaje === 'urgente' ? '1px solid var(--accent2)' : '1px solid var(--border)',
                    background: tipoMensaje === 'urgente' ? 'rgba(220,38,38,0.08)' : 'transparent',
                    color: 'var(--accent2)',
                    fontWeight: tipoMensaje === 'urgente' ? 700 : 500,
                  }}
                >
                  <input
                    type="radio"
                    name="tipoMsg"
                    value="urgente"
                    checked={tipoMensaje === 'urgente'}
                    onChange={() => setTipoMensaje('urgente')}
                    style={{ margin: 0, width: 14, height: 14, flex: '0 0 auto', cursor: 'pointer' }}
                  />
                  <span>⚠️ Urgente</span>
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
