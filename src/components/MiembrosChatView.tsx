import React, { useState, useRef, useEffect } from 'react';
import { Miembro, MensajeChat, AdjuntoChat } from '../types';
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
  onEnviarMensaje: (
    texto: string,
    tipo?: 'general' | 'indicacion' | 'urgente',
    paraEmail?: string,
    paraNombre?: string,
    adjunto?: AdjuntoChat
  ) => Promise<void>;
  onMarcarLeidos?: (msgIds: string[]) => Promise<void>;
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

export const EMOJI_CATEGORIAS = [
  {
    nombre: 'Reacciones & Gestos',
    emojis: ['👍', '👎', '👌', '✌️', '👏', '🙌', '🤝', '👊', '🙏', '💪', '❤️', '🔥', '⭐', '💯'],
  },
  {
    nombre: 'Caritas & Expresiones',
    emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤔', '😅', '😬', '🥳', '😴', '😇', '🤩'],
  },
  {
    nombre: 'Ventas & Operaciones',
    emojis: ['💰', '💵', '💳', '📦', '🛒', '⚡', '🚀', '📈', '📊', '🎯', '🏆', '👑', '🔔', '📢', '📍'],
  },
  {
    nombre: 'Símbolos & Alertas',
    emojis: ['✅', '❌', '⚠️', '❗', '❓', '💡', '🔒', '🔑', '🛡️', '📌', '🏷️', '📝', '📋', '🚚', '⏰'],
  },
];

export const comprimirImagen = (file: File, maxDim = 1024, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return reject(new Error('No se pudo leer la imagen'));
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

export const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileIcon = (nombre: string) => {
  const ext = (nombre || '').split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) return '📕';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '📊';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) return '📄';
  if (['zip', 'rar', '7z'].includes(ext || '')) return '🗜️';
  return '📎';
};

export const descargarAdjunto = (url: string, nombre: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre || 'archivo_chat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  onMarcarLeidos,
  onOpenMiCuenta,
}) => {
  const [subVista, setSubVista] = useState<'miembros' | 'chat'>('miembros');
  const [activeChatChannel, setActiveChatChannel] = useState<string>('general');
  const [chatsIniciados, setChatsIniciados] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chats_directos_iniciados');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('chats_directos_iniciados', JSON.stringify(chatsIniciados));
    } catch {}
  }, [chatsIniciados]);

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
  const [adjuntoPendiente, setAdjuntoPendiente] = useState<AdjuntoChat | null>(null);
  const [procesandoAdjunto, setProcesandoAdjunto] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [fotoFullscreen, setFotoFullscreen] = useState<AdjuntoChat | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const mensajeInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

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

  const myEmail = (emailActual || '').toLowerCase().trim();

  // Lista de correos que tienen chat directo activo
  const directChatEmails = React.useMemo(() => {
    const set = new Set<string>();

    // 1. Iniciados explícitamente desde el banner al hacer clic en 'Mensaje'
    chatsIniciados.forEach((e) => {
      const clean = e.toLowerCase().trim();
      if (clean && clean !== myEmail) {
        set.add(clean);
      }
    });

    // 2. Historial de mensajes directos que involucran al usuario actual
    mensajes.forEach((msg) => {
      const de = (msg.deEmail || '').toLowerCase().trim();
      const para = (msg.paraEmail || '').toLowerCase().trim();
      if (para && para === myEmail && de && de !== myEmail) {
        set.add(de);
      } else if (de && de === myEmail && para && para !== myEmail) {
        set.add(para);
      }
    });

    return Array.from(set);
  }, [chatsIniciados, mensajes, myEmail]);

  // Miembros de los chats directos activos
  const activeDmMembers = React.useMemo(() => {
    return directChatEmails.map((email) => {
      const found = listaMiembros.find((m) => m.email?.toLowerCase().trim() === email);
      if (found) return found;
      return {
        id: `dm-${email}`,
        nombre: email.split('@')[0],
        email: email,
        rol: 'Miembro del Equipo',
        telefono: '',
        sucursal: 'Ventas',
        avatarId: 'avatar2',
        isAdmin: false,
        estado: 'disponible' as const,
      };
    });
  }, [directChatEmails, listaMiembros]);

  const isDirectChat = activeChatChannel !== 'general';
  const targetDmEmail = isDirectChat ? activeChatChannel : null;
  const targetDmMember = isDirectChat
    ? activeDmMembers.find((m) => m.email?.toLowerCase().trim() === targetDmEmail) || null
    : null;

  // Filtrado de mensajes según canal activo
  const mensajesFiltrados = React.useMemo(() => {
    if (!isDirectChat) {
      // Chat General & Anuncios: solo mensajes públicos / sin destinatario específico
      return mensajes.filter((m) => !m.paraEmail || m.canalId === 'general');
    }

    const expectedCanalId = 'dm_' + [myEmail, targetDmEmail!].sort().join('__');
    return mensajes.filter((m) => {
      if (m.canalId === expectedCanalId) return true;
      const de = (m.deEmail || '').toLowerCase().trim();
      const para = (m.paraEmail || '').toLowerCase().trim();
      return (de === myEmail && para === targetDmEmail) || (de === targetDmEmail && para === myEmail);
    });
  }, [mensajes, isDirectChat, targetDmEmail, myEmail]);

  // Helper para saber si un mensaje está no leído por el usuario actual
  const esMensajeNoLeido = (m: MensajeChat) => {
    const de = (m.deEmail || '').toLowerCase().trim();
    if (de === myEmail) return false;
    const para = (m.paraEmail || '').toLowerCase().trim();
    if (para && para !== myEmail) return false;
    if (m.leidoPor && Array.isArray(m.leidoPor)) {
      return !m.leidoPor.map((e) => e.toLowerCase().trim()).includes(myEmail);
    }
    if (para === myEmail && m.leido) return false;
    return true;
  };

  const countMensajesGenerales = React.useMemo(() => {
    return mensajes.filter((m) => !m.paraEmail || m.canalId === 'general').length;
  }, [mensajes]);

  // Mensajes no leídos en el canal general
  const noLeidosGenerales = React.useMemo(() => {
    return mensajes.filter((m) => (!m.paraEmail || m.canalId === 'general') && esMensajeNoLeido(m)).length;
  }, [mensajes, myEmail]);

  // Mensajes no leídos de un miembro en particular
  const noLeidosDeMiembro = (email: string) => {
    const clean = email.toLowerCase().trim();
    return mensajes.filter((m) => {
      const de = (m.deEmail || '').toLowerCase().trim();
      const para = (m.paraEmail || '').toLowerCase().trim();
      return de === clean && (!para || para === myEmail) && esMensajeNoLeido(m);
    }).length;
  };

  // Total de mensajes no leídos
  const totalNoLeidos = React.useMemo(() => {
    return mensajes.filter((m) => esMensajeNoLeido(m)).length;
  }, [mensajes, myEmail]);

  const countMensajesDirectos = (email: string) => {
    const clean = email.toLowerCase().trim();
    const expectedCanalId = 'dm_' + [myEmail, clean].sort().join('__');
    return mensajes.filter((m) => {
      if (m.canalId === expectedCanalId) return true;
      const de = (m.deEmail || '').toLowerCase().trim();
      const para = (m.paraEmail || '').toLowerCase().trim();
      return (de === myEmail && para === clean) || (de === clean && para === myEmail);
    }).length;
  };

  const handleIniciarChatDirecto = (targetMemberEmail?: string) => {
    if (!targetMemberEmail) return;
    const clean = targetMemberEmail.toLowerCase().trim();
    if (!clean || clean === myEmail) return;

    setChatsIniciados((prev) => {
      if (!prev.map((e) => e.toLowerCase().trim()).includes(clean)) {
        return [...prev, clean];
      }
      return prev;
    });

    setActiveChatChannel(clean);
    setSubVista('chat');
    setNuevoMensaje('');
  };

  const handleCerrarChatDirecto = (emailToClose: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const clean = emailToClose.toLowerCase().trim();
    setChatsIniciados((prev) => prev.filter((em) => em.toLowerCase().trim() !== clean));
    if (activeChatChannel === clean) {
      setActiveChatChannel('general');
    }
  };

  // Auto-scroll al final del chat cuando llegan nuevos mensajes o cambia de canal
  useEffect(() => {
    if (subVista === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajesFiltrados, subVista, activeChatChannel]);

  // Marcar automáticamente mensajes como leídos cuando el usuario está en la vista de chat
  useEffect(() => {
    if (subVista !== 'chat' || !onMarcarLeidos) return;

    const unreadIds = mensajesFiltrados
      .filter((m) => m.id && esMensajeNoLeido(m))
      .map((m) => m.id!);

    if (unreadIds.length > 0) {
      onMarcarLeidos(unreadIds);
    }
  }, [subVista, activeChatChannel, mensajesFiltrados, onMarcarLeidos]);

  const handleInsertEmoji = (emoji: string) => {
    const input = mensajeInputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const nextText = nuevoMensaje.slice(0, start) + emoji + nuevoMensaje.slice(end);
      setNuevoMensaje(nextText);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 10);
    } else {
      setNuevoMensaje((prev) => prev + emoji);
    }
  };

  const handleSelectFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProcesandoAdjunto(true);
      const compressedDataUrl = await comprimirImagen(file, 1024, 0.75);
      const estSize = Math.round(compressedDataUrl.length * 0.75);
      setAdjuntoPendiente({
        nombre: file.name || 'foto.jpg',
        tipo: 'imagen',
        url: compressedDataUrl,
        tamano: estSize,
        mimeType: 'image/jpeg',
      });
    } catch (err: any) {
      alert('No se pudo procesar la foto: ' + (err?.message || err));
    } finally {
      setProcesandoAdjunto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSelectArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Límite de 750KB para sincronización directa en Firestore sin Storage externo
    const MAX_BYTES = 750 * 1024;
    if (file.size > MAX_BYTES) {
      alert(
        `El archivo "${file.name}" pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB.\n\nEl límite para sincronización instantánea es de 750 KB por archivo para garantizar máxima velocidad.\n\nPor favor adjunta un documento PDF comprimido o una versión más ligera.`
      );
      if (e.target) e.target.value = '';
      return;
    }

    try {
      setProcesandoAdjunto(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          alert('No se pudo leer el archivo seleccionado');
          setProcesandoAdjunto(false);
          return;
        }
        setAdjuntoPendiente({
          nombre: file.name,
          tipo: 'archivo',
          url: dataUrl,
          tamano: file.size,
          mimeType: file.type,
        });
        setProcesandoAdjunto(false);
      };
      reader.onerror = () => {
        alert('Error al leer el archivo');
        setProcesandoAdjunto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Error al procesar archivo: ' + (err?.message || err));
      setProcesandoAdjunto(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoverAdjunto = () => {
    setAdjuntoPendiente(null);
    if (fotoInputRef.current) fotoInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEnviar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!nuevoMensaje.trim() && !adjuntoPendiente) || enviando) return;

    try {
      setEnviando(true);
      if (isDirectChat && targetDmEmail) {
        await onEnviarMensaje(
          nuevoMensaje.trim(),
          'general',
          targetDmEmail,
          targetDmMember?.nombre || targetDmEmail,
          adjuntoPendiente || undefined
        );
      } else {
        await onEnviarMensaje(
          nuevoMensaje.trim(),
          tipoMensaje,
          undefined,
          undefined,
          adjuntoPendiente || undefined
        );
      }
      setNuevoMensaje('');
      setAdjuntoPendiente(null);
      setShowEmojiPicker(false);
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
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.88rem', position: 'relative' }}
              onClick={() => setSubVista('chat')}
            >
              <span>💬 Chat & Indicaciones ({mensajes.length})</span>
              {totalNoLeidos > 0 && (
                <span
                  className="badge-unread-pulse"
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {totalNoLeidos}
                </span>
              )}
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
                      {m.email?.toLowerCase().trim() === myEmail ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          onClick={onOpenMiCuenta}
                          title="Editar mi perfil"
                        >
                          👤 Mis datos
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontWeight: 700,
                            position: 'relative',
                            background: noLeidosDeMiembro(m.email) > 0 ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined,
                            boxShadow: noLeidosDeMiembro(m.email) > 0 ? '0 0 10px rgba(239, 68, 68, 0.5)' : undefined,
                          }}
                          onClick={() => handleIniciarChatDirecto(m.email)}
                          title={`Iniciar conversación directa con ${m.nombre}`}
                        >
                          <span>💬 Mensaje</span>
                          {noLeidosDeMiembro(m.email) > 0 && (
                            <span
                              className="badge-unread-pulse"
                              style={{
                                background: '#ffffff',
                                color: '#dc2626',
                                fontSize: '0.65rem',
                                fontWeight: 900,
                                padding: '0 4px',
                                borderRadius: 8,
                                minWidth: 16,
                                height: 16,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {noLeidosDeMiembro(m.email)}
                            </span>
                          )}
                        </button>
                      )}
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
          {/* SELECTOR DE CANALES DE CONVERSACIÓN */}
          <div
            className="card"
            style={{
              padding: '10px 14px',
              margin: 0,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.85rem' }}>💬</span>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: 'var(--muted)',
                  }}
                >
                  Canales de Conversación
                </span>
              </div>
              <div className="sub" style={{ fontSize: '0.72rem' }}>
                {activeDmMembers.length > 0
                  ? `${activeDmMembers.length} chat${activeDmMembers.length > 1 ? 's' : ''} directo${activeDmMembers.length > 1 ? 's' : ''} activo${activeDmMembers.length > 1 ? 's' : ''}`
                  : 'Presiona "Mensaje" en cualquier miembro para abrir un chat directo'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 4,
              }}
            >
              {/* POSICIÓN #1 FIJA: CHAT GENERAL & ANUNCIOS */}
              <button
                type="button"
                onClick={() => setActiveChatChannel('general')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 10,
                  border: activeChatChannel === 'general' ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: activeChatChannel === 'general' ? 'var(--accent)' : 'rgba(0,0,0,0.03)',
                  color: activeChatChannel === 'general' ? '#ffffff' : 'var(--text)',
                  fontWeight: activeChatChannel === 'general' ? 800 : 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: activeChatChannel === 'general' ? '0 2px 8px rgba(37,99,235,0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>📢</span>
                <span>Chat General & Anuncios</span>
                {noLeidosGenerales > 0 ? (
                  <span
                    className="badge-unread-pulse"
                    style={{
                      fontSize: '0.68rem',
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 900,
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)',
                    }}
                  >
                    {noLeidosGenerales}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: activeChatChannel === 'general' ? 'rgba(255,255,255,0.28)' : 'var(--border)',
                      color: activeChatChannel === 'general' ? '#ffffff' : 'var(--muted)',
                      fontWeight: 700,
                    }}
                  >
                    {countMensajesGenerales}
                  </span>
                )}
              </button>

              {/* CHATS DIRECTOS ACTIVOS (INICIADOS POR CLICK EN 'MENSAJE' O MENSAJES PREVIOS) */}
              {activeDmMembers.map((m) => {
                const isAct = activeChatChannel === m.email.toLowerCase().trim();
                const countDm = countMensajesDirectos(m.email);
                const unreadDm = noLeidosDeMiembro(m.email);
                return (
                  <div
                    key={m.email}
                    onClick={() => setActiveChatChannel(m.email.toLowerCase().trim())}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      borderRadius: 10,
                      border: isAct ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: isAct ? 'rgba(37,99,235,0.12)' : 'rgba(0,0,0,0.02)',
                      color: isAct ? 'var(--accent)' : 'var(--text)',
                      fontWeight: isAct ? 800 : 600,
                      fontSize: '0.80rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: isAct ? '0 2px 6px rgba(37,99,235,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <img
                      src={getAvatarSrc(m.avatarId)}
                      alt={m.nombre}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: isAct ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      }}
                      referrerPolicy="no-referrer"
                    />
                    <span>{m.nombre}</span>
                    {unreadDm > 0 ? (
                      <span
                        className="badge-unread-pulse"
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: '#ef4444',
                          color: '#ffffff',
                          fontWeight: 900,
                          boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)',
                        }}
                      >
                        {unreadDm}
                      </span>
                    ) : countDm > 0 ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 5px',
                          borderRadius: 8,
                          background: isAct ? 'var(--accent)' : 'var(--border)',
                          color: isAct ? '#ffffff' : 'var(--muted)',
                          fontWeight: 700,
                        }}
                      >
                        {countDm}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => handleCerrarChatDirecto(m.email, e)}
                      title={`Cerrar conversación con ${m.nombre}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isAct ? 'var(--accent)' : 'var(--muted)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        opacity: 0.7,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {/* BOTÓN RÁPIDO PARA ABRIR EL DIRECTORIO DE MIEMBROS */}
              <button
                type="button"
                className="btn-ghost"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.76rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  border: '1px dashed var(--border)',
                }}
                onClick={() => setSubVista('miembros')}
                title="Ir al directorio de miembros para iniciar un nuevo chat"
              >
                <span>➕</span> Iniciar con otro miembro
              </button>
            </div>
          </div>

          {/* BANNER CONTEXTUAL: SEGÚN CANAL GENERAL O CHAT DIRECTO */}
          {isDirectChat ? (
            <div
              className="card"
              style={{
                padding: '12px 16px',
                margin: 0,
                background: 'linear-gradient(135deg, rgba(37,99,235,0.09) 0%, rgba(6,182,212,0.05) 100%)',
                borderLeft: '4px solid var(--accent)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 240 }}>
                <img
                  src={getAvatarSrc(targetDmMember?.avatarId)}
                  alt={targetDmMember?.nombre || 'Miembro'}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--accent)',
                    boxShadow: '0 0 8px rgba(37,99,235,0.3)',
                    flexShrink: 0,
                  }}
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.96rem' }}>
                      {targetDmMember?.nombre || targetDmEmail}
                    </span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        background: 'var(--accent)',
                        color: '#fff',
                        padding: '1px 6px',
                        borderRadius: 4,
                        letterSpacing: '0.5px',
                      }}
                    >
                      🔒 CHAT PRIVADO 1 A 1
                    </span>
                    {targetDmMember?.isAdmin && (
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          background: '#f59e0b',
                          color: '#fff',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        👑 ADMIN
                      </span>
                    )}
                  </div>
                  <div className="sub" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                    {targetDmMember?.rol || 'Miembro del Equipo'} • {targetDmMember?.sucursal || 'Ventas'}
                  </div>
                  <div className="sub" style={{ fontSize: '0.72rem', marginTop: 1, color: 'var(--muted)' }}>
                    ✉️ {targetDmMember?.email || targetDmEmail}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {targetDmMember?.telefono && (
                  <a
                    href={`https://wa.me/${targetDmMember.telefono.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-green"
                    style={{
                      padding: '5px 10px',
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
                  style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => setActiveChatChannel('general')}
                  title="Volver a los anuncios corporativos para todo el equipo"
                >
                  📢 Ir a Anuncios
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.78rem', padding: '5px 8px', color: 'var(--muted)' }}
                  onClick={(e) => targetDmEmail && handleCerrarChatDirecto(targetDmEmail, e)}
                  title="Cerrar esta conversación privada de la barra"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>
          ) : (
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
                📢 Canal Corporativo de Anuncios e Indicaciones (Fijo #1)
              </div>
              <div className="sub" style={{ fontSize: '0.8rem' }}>
                Espacio oficial para que la administración (Benjamín) comunique metas, cambios de ruta, alertas de stock y para que el equipo reporte novedades en tiempo real a todos los miembros.
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
          )}

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
                    Recibe alertas y sonido cuando un compañero o la administración te envíe un mensaje.
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
            {mensajesFiltrados.length === 0 ? (
              <div
                className="sub"
                style={{
                  textAlign: 'center',
                  margin: 'auto',
                  padding: 24,
                  fontStyle: 'italic',
                }}
              >
                {isDirectChat ? (
                  <>
                    <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>🔒</div>
                    <div>
                      Aún no hay mensajes en esta conversación privada con <b>{targetDmMember?.nombre || targetDmEmail}</b>.
                    </div>
                    <div style={{ marginTop: 6, fontSize: '0.78rem' }}>
                      Escribe tu primer mensaje abajo para coordinar directamente.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>📢</div>
                    <div>No hay anuncios aún en el canal corporativo.</div>
                    <div style={{ marginTop: 6, fontSize: '0.78rem' }}>
                      ¡Escribe el primer mensaje para todo el equipo de ventas!
                    </div>
                  </>
                )}
              </div>
            ) : (
              mensajesFiltrados.map((msg, idx) => {
                const esMio = msg.deEmail?.toLowerCase() === myEmail;
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
                          {esMio ? 'Tú' : msg.deNombre}
                        </span>
                        {isDirectChat && (
                          <span
                            style={{
                              fontSize: '0.60rem',
                              fontWeight: 700,
                              background: 'rgba(37,99,235,0.15)',
                              color: 'var(--accent)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            🔒 DIRECTO
                          </span>
                        )}
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
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="sub" style={{ fontSize: '0.68rem' }}>
                            {fTs(msg.ts)}
                          </span>
                          {esMio ? (
                            (() => {
                              const isMsgRead = Boolean(
                                msg.leido ||
                                (isDirectChat
                                  ? targetDmEmail && msg.leidoPor?.map((e) => e.toLowerCase().trim()).includes(targetDmEmail)
                                  : (msg.leidoPor || []).some((e) => e.toLowerCase().trim() !== myEmail))
                              );
                              return (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    fontWeight: 800,
                                    fontSize: '0.78rem',
                                    color: isMsgRead ? '#0284c7' : 'var(--muted)',
                                  }}
                                  title={
                                    isMsgRead
                                      ? isDirectChat
                                        ? `Leído por ${targetDmMember?.nombre || 'destinatario'}`
                                        : 'Leído en el equipo'
                                      : 'Enviado (pendiente de lectura)'
                                  }
                                >
                                  {isMsgRead ? '✓✓' : '✓'}
                                </span>
                              );
                            })()
                          ) : esMensajeNoLeido(msg) ? (
                            <span
                              style={{
                                background: '#ef4444',
                                color: '#ffffff',
                                fontSize: '0.58rem',
                                fontWeight: 900,
                                padding: '1px 4px',
                                borderRadius: 4,
                                letterSpacing: '0.5px',
                              }}
                            >
                              NUEVO
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Adjunto si existe (Foto o Archivo) */}
                      {msg.adjunto && (
                        <div style={{ marginBottom: msg.texto ? 8 : 0 }}>
                          {msg.adjunto.tipo === 'imagen' ? (
                            <div
                              style={{
                                position: 'relative',
                                display: 'inline-block',
                                borderRadius: 10,
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: '#000',
                              }}
                              onClick={() => setFotoFullscreen(msg.adjunto!)}
                              title="Haz clic para ver en pantalla completa"
                            >
                              <img
                                src={msg.adjunto.url}
                                alt={msg.adjunto.nombre || 'Foto'}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: 240,
                                  display: 'block',
                                  objectFit: 'cover',
                                  transition: 'transform 0.2s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 6,
                                  right: 6,
                                  background: 'rgba(0,0,0,0.7)',
                                  color: '#fff',
                                  borderRadius: 6,
                                  padding: '2px 7px',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  pointerEvents: 'none',
                                }}
                              >
                                🔍 Ampliar
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: esMio ? 'rgba(255,255,255,0.75)' : 'var(--card)',
                                border: '1px solid var(--border)',
                                minWidth: 200,
                                maxWidth: '100%',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{ fontSize: '1.4rem' }}>{getFileIcon(msg.adjunto.nombre)}</span>
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: '0.82rem',
                                      fontWeight: 700,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: 180,
                                    }}
                                  >
                                    {msg.adjunto.nombre}
                                  </div>
                                  <div className="sub" style={{ fontSize: '0.68rem' }}>
                                    {formatFileSize(msg.adjunto.tamano)}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => descargarAdjunto(msg.adjunto!.url, msg.adjunto!.nombre)}
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '4px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  whiteSpace: 'nowrap',
                                  border: '1px solid var(--border)',
                                }}
                                title="Descargar archivo"
                              >
                                ⬇️ Descargar
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Texto del mensaje */}
                      {msg.texto && (
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
                      )}
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
            style={{ padding: '10px 12px', margin: 0, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}
          >
            {/* Input oculto para fotos */}
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleSelectFoto}
            />

            {/* Input oculto para archivos y documentos */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
              style={{ display: 'none' }}
              onChange={handleSelectArchivo}
            />

            {/* Si es chat directo, indicamos el destinatario privado */}
            {isDirectChat ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.78rem',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  padding: '2px 0',
                }}
              >
                <span>🔒 Conversación privada con:</span>
                <span style={{ textDecoration: 'underline' }}>{targetDmMember?.nombre || targetDmEmail}</span>
              </div>
            ) : (
              /* Si es Admin en canal general, puede marcar la categoría de la indicación */
              isAdmin && (
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
              )
            )}

            {/* PREVIEW DE ADJUNTO PENDIENTE (FOTO O ARCHIVO) */}
            {adjuntoPendiente && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: adjuntoPendiente.tipo === 'imagen' ? 'rgba(37,99,235,0.08)' : 'rgba(0,0,0,0.04)',
                  border: '1px solid var(--accent)',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {adjuntoPendiente.tipo === 'imagen' ? (
                    <img
                      src={adjuntoPendiente.url}
                      alt="Preview"
                      style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.3rem' }}>{getFileIcon(adjuntoPendiente.nombre)}</span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.80rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                      {adjuntoPendiente.nombre}
                    </div>
                    <div className="sub" style={{ fontSize: '0.70rem' }}>
                      {adjuntoPendiente.tipo === 'imagen' ? '📷 Foto adjunta' : '📎 Archivo adjunto'} • {formatFileSize(adjuntoPendiente.tamano)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleRemoverAdjunto}
                  style={{ color: '#ef4444', border: 'none', background: 'transparent', padding: '4px 8px', fontSize: '0.9rem', cursor: 'pointer' }}
                  title="Quitar adjunto"
                >
                  ✕
                </button>
              </div>
            )}

            {/* POPUP SELECTOR DE EMOJIS */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="card"
                style={{
                  padding: '10px 12px',
                  margin: 0,
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  border: '1.5px solid var(--accent)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 250,
                  overflowY: 'auto',
                  background: 'var(--card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)' }}>
                    😀 Selector de Emojis
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(false)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--muted)' }}
                  >
                    ✕
                  </button>
                </div>

                {EMOJI_CATEGORIAS.map((cat) => (
                  <div key={cat.nombre}>
                    <div className="sub" style={{ fontSize: '0.68rem', fontWeight: 700, marginBottom: 4 }}>
                      {cat.nombre}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cat.emojis.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => handleInsertEmoji(em)}
                          style={{
                            background: 'rgba(0,0,0,0.03)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: '1.15rem',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            lineHeight: 1,
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BARRA DE HERRAMIENTAS: BOTONES DE FOTO, ARCHIVO Y EMOJIS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  style={{
                    fontSize: '0.80rem',
                    padding: '4px 9px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 8,
                    border: showEmojiPicker ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: showEmojiPicker ? 'rgba(37,99,235,0.08)' : 'transparent',
                  }}
                  title="Insertar emojis"
                >
                  <span>😀</span> <span>Emojis</span>
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={procesandoAdjunto}
                  style={{
                    fontSize: '0.80rem',
                    padding: '4px 9px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                  title="Tomar o seleccionar foto"
                >
                  <span>📷</span> <span>Foto</span>
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={procesandoAdjunto}
                  style={{
                    fontSize: '0.80rem',
                    padding: '4px 9px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                  title="Adjuntar documento o archivo (PDF, Excel, Word)"
                >
                  <span>📎</span> <span>Archivo</span>
                </button>

                {procesandoAdjunto && (
                  <span className="sub" style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: 600 }}>
                    ⏳ Procesando adjunto...
                  </span>
                )}
              </div>

              {/* BARRA DE EMOJIS RÁPIDOS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
                {['👍', '❤️', '🔥', '👏', '😂', '🙏', '🚀', '⚡', '📦', '💰', '✅'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleInsertEmoji(em)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.05rem',
                      padding: '2px 3px',
                      borderRadius: 4,
                      lineHeight: 1,
                    }}
                    title={`Insertar ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* FILA DE TEXTO Y BOTÓN ENVIAR */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={mensajeInputRef}
                type="text"
                placeholder={
                  isDirectChat
                    ? `Escribe un mensaje privado para ${targetDmMember?.nombre || targetDmEmail}...`
                    : isAdmin
                    ? 'Escribe un anuncio o indicación para todo el equipo de ventas...'
                    : 'Escribe un mensaje para Benjamín y todo el equipo...'
                }
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={(!nuevoMensaje.trim() && !adjuntoPendiente) || enviando || procesandoAdjunto}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                {enviando ? 'Enviando...' : isDirectChat ? 'Enviar Directo ➤' : 'Enviar ➤'}
              </button>
            </div>
          </form>

          {/* LIGHTBOX MODAL PARA VER FOTO FULLSCREEN */}
          {fotoFullscreen && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.88)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                backdropFilter: 'blur(5px)',
              }}
              onClick={() => setFotoFullscreen(null)}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  maxWidth: 800,
                  marginBottom: 10,
                  color: '#fff',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: '0.88rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📷 {fotoFullscreen.nombre}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '0.80rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => descargarAdjunto(fotoFullscreen.url, fotoFullscreen.nombre)}
                  >
                    ⬇️ Descargar
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ color: '#fff', fontSize: '1rem', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.3)' }}
                    onClick={() => setFotoFullscreen(null)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <img
                src={fotoFullscreen.url}
                alt={fotoFullscreen.nombre}
                style={{
                  maxWidth: '92vw',
                  maxHeight: '82vh',
                  objectFit: 'contain',
                  borderRadius: 10,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
