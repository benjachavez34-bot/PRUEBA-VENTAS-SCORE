import React, { useState, useRef } from 'react';
import scoreBgDesktop from '../assets/images/score_surtidas_desktop_bg_1792157664500.jpg';
import scoreGorillaLogo from '../assets/images/score_gorilla_bg_1791923074721.jpg';

export interface ThemeConfig {
  accentColor: string;
  customBgUrl: string | null;
  mode: 'dark' | 'light' | 'auto';
  nombreEmpresa: string;
  cardOpacity?: number; // 0.15 a 0.95
  bgOpacity?: number;   // 0.15 a 0.95
}

interface ConfiguracionViewProps {
  currentTheme: ThemeConfig;
  onSaveTheme: (newTheme: ThemeConfig) => void;
  onResetTheme: () => void;
}

const PALETAS_PREDEFINIDAS = [
  { nombre: 'Azul Score (Original)', color: '#2563eb' },
  { nombre: 'Cian Neón Energético', color: '#0891b2' },
  { nombre: 'Verde Éxito / Esmeralda', color: '#059669' },
  { nombre: 'Naranja Eléctrico', color: '#ea580c' },
  { nombre: 'Rojo Pasión Score', color: '#dc2626' },
  { nombre: 'Púrpura Imperial', color: '#7c3aed' },
  { nombre: 'Dorado Comercial', color: '#d97706' },
];

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  currentTheme,
  onSaveTheme,
  onResetTheme,
}) => {
  const [tema, setTema] = useState<ThemeConfig>(currentTheme);
  const [cargandoImagen, setCargandoImagen] = useState<boolean>(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mostrarMensaje = (msg: string) => {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleColorChange = (color: string) => {
    const actualizado = { ...tema, accentColor: color };
    setTema(actualizado);
    onSaveTheme(actualizado);
    mostrarMensaje('Color de acento actualizado');
  };

  const handleImagenFondo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG o WebP).');
      return;
    }

    setCargandoImagen(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setCargandoImagen(false);
        return;
      }

      // Comprimir imagen usando canvas para que cargue rápido y no sature localStorage
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const actualizado = { ...tema, customBgUrl: compressedDataUrl };
          setTema(actualizado);
          onSaveTheme(actualizado);
          mostrarMensaje('Foto de fondo actualizada correctamente');
        }
        setCargandoImagen(false);
      };
      img.onerror = () => {
        setCargandoImagen(false);
        alert('No se pudo procesar la imagen.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleQuitarFondoPersonalizado = () => {
    const actualizado = { ...tema, customBgUrl: null };
    setTema(actualizado);
    onSaveTheme(actualizado);
    if (fileInputRef.current) fileInputRef.current.value = '';
    mostrarMensaje('Fondo restablecido al original de Score');
  };

  const handleCardOpacityChange = (val: number) => {
    const actualizado = { ...tema, cardOpacity: val };
    setTema(actualizado);
    onSaveTheme(actualizado);
  };

  const handleBgOpacityChange = (val: number) => {
    const actualizado = { ...tema, bgOpacity: val };
    setTema(actualizado);
    onSaveTheme(actualizado);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* HEADER DE CONFIGURACIÓN */}
      <div
        className="card"
        style={{
          padding: '14px',
          margin: 0,
          background: 'linear-gradient(135deg, var(--card) 0%, rgba(37,99,235,0.06) 100%)',
          borderLeft: '4px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <img
          src={scoreGorillaLogo}
          alt="Admin Config"
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid var(--accent)',
            boxShadow: '0 0 10px rgba(37,99,235,0.35)',
            flexShrink: 0,
          }}
          referrerPolicy="no-referrer"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Personalización & Ajustes</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                background: 'var(--accent)',
                color: '#fff',
                padding: '2px 7px',
                borderRadius: 4,
                letterSpacing: '0.5px',
              }}
            >
              👑 SOLO ADMINISTRADORES
            </span>
          </div>
          <div className="sub" style={{ fontSize: '0.8rem', marginTop: 3 }}>
            Personaliza los colores, fondo de pantalla y preferencias visuales de la aplicación.
          </div>
        </div>
      </div>

      {notificacion && (
        <div
          style={{
            background: 'var(--accent3)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ✓ {notificacion}
        </div>
      )}

      {/* SECCIÓN 1: PALETA DE COLORES DE LA INTERFAZ */}
      <div className="card" style={{ padding: '16px', margin: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 6 }}>
          🎨 Color de Acento Principal
        </div>
        <div className="sub" style={{ marginBottom: 12, fontSize: '0.82rem' }}>
          Define el color de los botones principales, pestañas activas, bordes destacados y badges en toda la app.
        </div>

        {/* Paletas rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
          {PALETAS_PREDEFINIDAS.map((p) => {
            const isSelected = tema.accentColor.toLowerCase() === p.color.toLowerCase();

            return (
              <button
                key={p.color}
                type="button"
                className="btn-ghost"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: isSelected ? `2px solid ${p.color}` : '1px solid var(--border)',
                  background: isSelected ? 'rgba(37,99,235,0.08)' : 'var(--card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onClick={() => handleColorChange(p.color)}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: p.color,
                    boxShadow: '0 0 6px rgba(0,0,0,0.2)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: 'var(--text)' }}>
                  {p.nombre}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selector de color libre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
            O elige un color personalizado:
          </label>
          <input
            type="color"
            value={tema.accentColor}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{ width: 44, height: 32, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--muted)' }}>
            {tema.accentColor.toUpperCase()}
          </span>
        </div>
      </div>

      {/* SECCIÓN 2: FOTO DE FONDO PERSONALIZADA */}
      <div className="card" style={{ padding: '16px', margin: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 6 }}>
          🖼️ Foto de Fondo de la Aplicación
        </div>
        <div className="sub" style={{ marginBottom: 12, fontSize: '0.82rem' }}>
          Puedes cargar una imagen corporativa, fotografía del equipo o fondo temático de Score para personalizar el fondo de la pantalla.
        </div>

        {/* Vista previa actual */}
        <div
          style={{
            position: 'relative',
            height: 140,
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 12,
            border: '1px solid var(--border)',
          }}
        >
          <img
            src={tema.customBgUrl || scoreBgDesktop}
            alt="Fondo actual"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            referrerPolicy="no-referrer"
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '10px 14px',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            {tema.customBgUrl ? '📷 Fondo Personalizado Activo' : '🦍 Fondo Oficial Score Gorilla Activo'}
          </div>
        </div>

        {/* Controles de carga */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImagenFondo}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={cargandoImagen}
          >
            {cargandoImagen ? 'Procesando imagen...' : '📁 Cargar Foto de Fondo'}
          </button>

          {tema.customBgUrl && (
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              onClick={handleQuitarFondoPersonalizado}
            >
              Restablecer fondo original
            </button>
          )}
        </div>
      </div>

      {/* SECCIÓN 3: TRANSPARENCIA DE BANNERS, TARJETAS Y FONDO */}
      <div className="card" style={{ padding: '16px', margin: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>✨</span> Transparencia de Banners y Fondo
        </div>
        <div className="sub" style={{ marginBottom: 14, fontSize: '0.82rem' }}>
          Haz los banners, menús y tarjetas más transparentes con efecto glassmorphism para que tu foto de fondo se aprecie con total claridad.
        </div>

        {/* Control 1: Opacidad / Transparencia de Banners y Tarjetas */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
              Transparencia de Banners y Tarjetas
            </span>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'rgba(var(--card-rgb), 0.5)',
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {Math.round((1 - (tema.cardOpacity ?? 0.60)) * 100)}% transparente
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', width: 45 }}>Cristal</span>
            <input
              type="range"
              min="0.15"
              max="0.95"
              step="0.05"
              value={tema.cardOpacity ?? 0.60}
              onChange={(e) => handleCardOpacityChange(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', width: 45, textAlign: 'right' }}>Sólido</span>
          </div>

          {/* Presets rápidos de transparencia */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {[
              { label: '💎 Cristal (75%)', val: 0.25 },
              { label: '✨ Glass (50%)', val: 0.50 },
              { label: '⚖️ Recomendado (40%)', val: 0.60 },
              { label: '🛡️ Sólido (10%)', val: 0.90 },
            ].map((preset) => {
              const activo = Math.abs((tema.cardOpacity ?? 0.60) - preset.val) < 0.04;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={activo ? 'btn-primary' : 'btn-ghost'}
                  style={{ padding: '5px 10px', fontSize: '0.76rem', borderRadius: 6 }}
                  onClick={() => handleCardOpacityChange(preset.val)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Control 2: Nitidez / Opacidad de la foto de fondo */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
              Intensidad / Nitidez del fondo
            </span>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'rgba(var(--card-rgb), 0.5)',
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {Math.round((tema.bgOpacity ?? 0.45) * 100)}% visibilidad
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', width: 45 }}>Tenue</span>
            <input
              type="range"
              min="0.15"
              max="0.95"
              step="0.05"
              value={tema.bgOpacity ?? 0.45}
              onChange={(e) => handleBgOpacityChange(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', width: 45, textAlign: 'right' }}>Vibrante</span>
          </div>

          {/* Presets rápidos de fondo */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {[
              { label: 'Suave (25%)', val: 0.25 },
              { label: 'Equilibrado (45%)', val: 0.45 },
              { label: 'Vívido (65%)', val: 0.65 },
              { label: 'Máximo (85%)', val: 0.85 },
            ].map((preset) => {
              const activo = Math.abs((tema.bgOpacity ?? 0.45) - preset.val) < 0.04;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={activo ? 'btn-primary' : 'btn-ghost'}
                  style={{ padding: '5px 10px', fontSize: '0.76rem', borderRadius: 6 }}
                  onClick={() => handleBgOpacityChange(preset.val)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: PREFERENCIAS DE MODO (OSCURO / CLARO) */}
      <div className="card" style={{ padding: '16px', margin: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 6 }}>
          🌓 Modo de Visualización
        </div>
        <div className="sub" style={{ marginBottom: 12, fontSize: '0.82rem' }}>
          Selecciona si prefieres tema oscuro inmersivo, claro de alto contraste o sincronización automática con tu sistema.
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={tema.mode === 'dark' ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            onClick={() => {
              const actualizado = { ...tema, mode: 'dark' as const };
              setTema(actualizado);
              onSaveTheme(actualizado);
              mostrarMensaje('Modo Oscuro activado');
            }}
          >
            🌙 Oscuro
          </button>
          <button
            type="button"
            className={tema.mode === 'light' ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            onClick={() => {
              const actualizado = { ...tema, mode: 'light' as const };
              setTema(actualizado);
              onSaveTheme(actualizado);
              mostrarMensaje('Modo Claro activado');
            }}
          >
            ☀️ Claro
          </button>
          <button
            type="button"
            className={tema.mode === 'auto' ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            onClick={() => {
              const actualizado = { ...tema, mode: 'auto' as const };
              setTema(actualizado);
              onSaveTheme(actualizado);
              mostrarMensaje('Modo Automático según el sistema');
            }}
          >
            💻 Automático (Sistema)
          </button>
        </div>
      </div>

      {/* SECCIÓN 4: RESTABLECER VALORES DE FÁBRICA */}
      <div className="card" style={{ padding: '14px 16px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Restablecer Diseño Original</div>
          <div className="sub" style={{ fontSize: '0.78rem' }}>
            Vuelve a la configuración de fábrica (colores originales de Score Gorilla y fondo oficial).
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
          onClick={() => {
            onResetTheme();
            setTema({
              accentColor: '#2563eb',
              customBgUrl: null,
              mode: 'auto',
              nombreEmpresa: 'Ventas Score',
            });
            mostrarMensaje('Diseño restablecido a valores de fábrica');
          }}
        >
          🔄 Restablecer Todo
        </button>
      </div>
    </div>
  );
};
