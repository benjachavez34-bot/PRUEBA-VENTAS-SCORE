import React from 'react';
import scoreGorillaLogo from '../assets/images/score_gorilla_bg_1791923074721.jpg';

interface ModalMenuAdminProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  userName: string;
  userRole?: string;
  avatarId?: string;
  mensajesNoLeidos?: number;
  onOpenMiCuenta: () => void;
  onLogout: () => void;
}

export const ModalMenuAdmin: React.FC<ModalMenuAdminProps> = ({
  isOpen,
  onClose,
  isAdmin,
  activeTab,
  onSelectTab,
  userName,
  userRole,
  avatarId,
  mensajesNoLeidos = 0,
  onOpenMiCuenta,
  onLogout,
}) => {
  if (!isOpen) return null;

  const handleSelect = (tab: string) => {
    onSelectTab(tab);
    onClose();
  };

  const avatarSrc =
    avatarId?.startsWith('data:image/') || avatarId?.startsWith('http')
      ? avatarId
      : avatarId === 'gorilla'
      ? scoreGorillaLogo
      : avatarId === 'avatar1'
      ? 'https://api.dicebear.com/7.x/bottts/svg?seed=Benja'
      : avatarId === 'avatar2'
      ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
      : avatarId === 'avatar3'
      ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sara'
      : scoreGorillaLogo;

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
          maxWidth: 500,
          margin: 0,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          padding: '16px 18px 24px 18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO CON PERFIL Y CIERRE */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={avatarSrc}
              alt="Avatar"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--accent)',
              }}
              referrerPolicy="no-referrer"
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                {userName || 'Usuario'}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: isAdmin ? 'var(--accent)' : 'var(--accent3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {isAdmin ? '🛡️ Administrador' : userRole || '👤 Vendedor'}
              </div>
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

        {/* SECCIÓN GERENCIAL (SOLO ADMINISTRADORES) */}
        {isAdmin && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--muted)',
                marginBottom: 8,
              }}
            >
              👑 Panel de Gerencia & Finanzas
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* CENTRO FINANCIERO & BI INTEGRADO */}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleSelect('resumen')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background:
                    activeTab === 'resumen' || activeTab === 'estadisticas'
                      ? 'rgba(37, 99, 235, 0.15)'
                      : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${
                    activeTab === 'resumen' || activeTab === 'estadisticas'
                      ? 'var(--accent)'
                      : 'var(--border)'
                  }`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.35rem' }}>💰</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      Centro Financiero & BI
                    </div>
                    <div className="sub" style={{ fontSize: '0.75rem' }}>
                      Caja, turnos, arqueos, analítica predictiva y métricas BI
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>→</span>
              </button>

              {/* SUPERVISIÓN EQUIPO */}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleSelect('equipo')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background:
                    activeTab === 'equipo'
                      ? 'rgba(37, 99, 235, 0.15)'
                      : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${
                    activeTab === 'equipo'
                      ? 'var(--accent)'
                      : 'var(--border)'
                  }`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.35rem' }}>🏢</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      Supervisión de Vendedores
                    </div>
                    <div className="sub" style={{ fontSize: '0.75rem' }}>
                      Métricas, calificaciones y efectividad de cobranza
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>→</span>
              </button>

              {/* CHAT & INDICACIONES DE EQUIPO */}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleSelect('miembros')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background:
                    activeTab === 'miembros'
                      ? 'rgba(37, 99, 235, 0.15)'
                      : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${
                    activeTab === 'miembros'
                      ? 'var(--accent)'
                      : 'var(--border)'
                  }`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.35rem' }}>💬</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Chat & Directorio de Equipo</span>
                      {mensajesNoLeidos > 0 && (
                        <span
                          className="badge-unread-pulse"
                          style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: '0.68rem',
                            fontWeight: 900,
                            minWidth: 18,
                            height: 18,
                            padding: '0 5px',
                            borderRadius: 10,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 8px rgba(239, 68, 68, 0.9)',
                          }}
                        >
                          {mensajesNoLeidos}
                        </span>
                      )}
                    </div>
                    <div className="sub" style={{ fontSize: '0.75rem' }}>
                      Canal general, indicaciones del administrador y mensajes directos
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>→</span>
              </button>

              {/* CONFIGURACIÓN & TEMA */}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleSelect('configuracion')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background:
                    activeTab === 'configuracion'
                      ? 'rgba(37, 99, 235, 0.15)'
                      : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${
                    activeTab === 'configuracion'
                      ? 'var(--accent)'
                      : 'var(--border)'
                  }`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.35rem' }}>⚙️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      Configuración & Personalización
                    </div>
                    <div className="sub" style={{ fontSize: '0.75rem' }}>
                      Colores de acento, fondos Score y nombre corporativo
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>→</span>
              </button>
            </div>
          </div>
        )}

        {/* SECCIÓN HERRAMIENTAS Y CUENTA (DISPONIBLE PARA TODOS) */}
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--muted)',
              marginBottom: 8,
            }}
          >
            🛠️ Herramientas & Cuenta
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* AYUDA IA */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => handleSelect('ayuda')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 12,
                background:
                  activeTab === 'ayuda'
                    ? 'rgba(37, 99, 235, 0.15)'
                    : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${
                  activeTab === 'ayuda' ? 'var(--accent)' : 'var(--border)'
                }`,
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.35rem' }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    ScoreBot Asistente IA
                  </div>
                  <div className="sub" style={{ fontSize: '0.75rem' }}>
                    Consultas inteligentes sobre funciones, arqueo y tips
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>→</span>
            </button>

            {/* MI CUENTA */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                onClose();
                onOpenMiCuenta();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(0, 0, 0, 0.05)',
                border: '1px solid var(--border)',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.35rem' }}>👤</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    Mi Perfil & Seguridad
                  </div>
                  <div className="sub" style={{ fontSize: '0.75rem' }}>
                    Cambiar PIN, foto corporativa, teléfono y datos
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>→</span>
            </button>

            {/* CERRAR SESIÓN */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                onClose();
                onLogout();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: '1.35rem' }}>🚪</span>
              <span style={{ fontSize: '0.92rem' }}>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
