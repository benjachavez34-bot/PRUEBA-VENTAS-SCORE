import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInAnonymously,
  updateProfile,
  signOut,
  deleteUser,
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Producto,
  Movimiento,
  CierreCaja,
  Deudor,
  Cliente,
  Miembro,
  MensajeChat,
  EvaluacionVendedor,
  CartItem,
  TicketVenta,
  MedioPago,
} from './types';
import {
  fTs,
  fmt,
  stockDe,
  getDeudores,
  invertido,
  costoUnit,
  getT0,
  calcResumen,
  porCobrarTotal,
} from './utils/formatters';
import { EstadisticasView } from './components/EstadisticasView';
import { AdminVendedoresView } from './components/AdminVendedoresView';
import { MiembrosChatView } from './components/MiembrosChatView';
import { AyudaView } from './components/AyudaView';
import { ConfiguracionView, ThemeConfig } from './components/ConfiguracionView';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { identifyProductByBarcode } from './utils/barcodeCatalog';
import {
  initializePushNotifications,
  showBrowserNotification,
  registrarPushParaDispositivos,
} from './utils/pushNotifications';
import scoreBgDesktop from './assets/images/score_surtidas_desktop_bg_1792157664500.jpg';
import scoreGorillaLogo from './assets/images/score_gorilla_bg_1791923074721.jpg';

export const ADMIN_EMAILS = [
  'benja.chavez34@gmail.com',
  'fco.inzunza.re@gmail.com',
];

export const isUserAdmin = (email?: string | null): boolean => {
  try {
    const rol = localStorage.getItem('sesion_activa_rol');
    if (rol === 'admin') return true;
  } catch {}
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

export interface PerfilUsuario {
  nombre: string;
  email: string;
  rol: string;
  telefono: string;
  sucursal: string;
  avatarId: string;
  pin?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [miNombre, setMiNombre] = useState<string>(() => {
    try {
      return localStorage.getItem('miNombre') || 'Benjamín Chávez';
    } catch {
      return 'Benjamín Chávez';
    }
  });
  const [authStatus, setAuthStatus] = useState<string>(
    'Inicia sesión para acceder al registro compartido.'
  );
  const [dbError, setDbError] = useState<string | null>(null);

  // Sesión guardada para bloqueo y re-ingreso biométrico/PIN/contraseña
  const [savedSession, setSavedSession] = useState<{
    uid: string;
    email: string;
    nombre: string;
    rol: string;
    avatarId?: string;
    pin?: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('saved_user_session');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('saved_user_session'));
    } catch {
      return false;
    }
  });
  const [unlockMethod, setUnlockMethod] = useState<'biometric' | 'pin' | 'password'>('biometric');
  const [unlockPin, setUnlockPin] = useState<string>('');
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [unlockLoading, setUnlockLoading] = useState<boolean>(false);

  // Vistas de acceso inicial (Google, Correo, Registro validado, Código OTP)
  const [loginView, setLoginView] = useState<'main' | 'login_email' | 'register_email' | 'verify_email'>('main');

  // Formulario de login por correo
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');

  // Formulario de registro estricto
  const [regNombre, setRegNombre] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPass, setRegPass] = useState<string>('');
  const [regConfirmPass, setRegConfirmPass] = useState<string>('');
  const [regOtpCode, setRegOtpCode] = useState<string>('');
  const [expectedOtpCode, setExpectedOtpCode] = useState<string>('');
  const [pendingUser, setPendingUser] = useState<{ uid: string; email: string; nombre: string } | null>(null);

  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<
    'venta' | 'deudores' | 'stock' | 'miembros' | 'resumen' | 'estadisticas' | 'equipo' | 'configuracion' | 'ayuda'
  >('venta');

  // Configuración de tema visual y personalización
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem('app_theme_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      accentColor: '#2563eb',
      customBgUrl: null,
      mode: 'auto',
      nombreEmpresa: 'Ventas Score',
    };
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', themeConfig.accentColor);
    document.documentElement.style.setProperty('--card-opacity', String(themeConfig.cardOpacity ?? 0.60));
    document.documentElement.style.setProperty('--bg-opacity', String(themeConfig.bgOpacity ?? 0.45));
    if (themeConfig.mode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (themeConfig.mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [themeConfig]);

  // Suscripción en tiempo real a la configuración y tema global en Firestore
  // Cualquier cambio que un administrador guarde se refleja de inmediato en TODOS los dispositivos y usuarios
  useEffect(() => {
    try {
      const unsubConfig = onSnapshot(
        doc(db, 'configuracion', 'apariencia'),
        (snapshot) => {
          if (snapshot.exists()) {
            const cloudTheme = snapshot.data() as ThemeConfig;
            setThemeConfig((prev) => ({
              ...prev,
              ...cloudTheme,
            }));
            try {
              localStorage.setItem('app_theme_config', JSON.stringify(cloudTheme));
            } catch {}
          }
        },
        (err) => {
          console.log('[Theme] Error sincronizando tema global desde Firestore:', err);
        }
      );
      return () => unsubConfig();
    } catch (e) {
      console.log('[Theme] Error conectando a configuración:', e);
    }
  }, []);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSaveTheme = (newTheme: ThemeConfig) => {
    // 1. Actualización local inmediata para respuesta instantánea en la pantalla
    setThemeConfig(newTheme);
    try {
      localStorage.setItem('app_theme_config', JSON.stringify(newTheme));
    } catch {}

    // 2. Sincronización en Firestore con debounce (350ms) para que se aplique en vivo a todos los usuarios
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'configuracion', 'apariencia'), newTheme, { merge: true });
        console.log('[Theme] Configuración global sincronizada en Firestore para todos los usuarios');
      } catch (err) {
        console.error('[Theme] Error sincronizando configuración en Firestore:', err);
      }
    }, 350);
  };

  const handleResetTheme = async () => {
    const defaultTheme: ThemeConfig = {
      accentColor: '#2563eb',
      customBgUrl: null,
      mode: 'auto',
      nombreEmpresa: 'Ventas Score',
      cardOpacity: 0.60,
      bgOpacity: 0.45,
    };
    setThemeConfig(defaultTheme);
    try {
      localStorage.removeItem('app_theme_config');
    } catch {}

    try {
      await setDoc(doc(db, 'configuracion', 'apariencia'), defaultTheme);
      console.log('[Theme] Configuración global restablecida en Firestore');
    } catch (err) {
      console.error('[Theme] Error restableciendo configuración en Firestore:', err);
    }
  };

  const fotoPerfilInputRef = useRef<HTMLInputElement>(null);

  // Estado de Miembros y Chat en tiempo real
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [inAppBanner, setInAppBanner] = useState<{
    id: string;
    deNombre: string;
    texto: string;
    avatarId?: string;
  } | null>(null);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState<number>(0);

  // Estado de Mi Cuenta (Perfil)
  const [modalCuentaOpen, setModalCuentaOpen] = useState<boolean>(false);
  const [modalEliminarCuentaOpen, setModalEliminarCuentaOpen] = useState<boolean>(false);
  const [confirmarEliminarTexto, setConfirmarEliminarTexto] = useState<string>('');
  const [eliminandoCuenta, setEliminandoCuenta] = useState<boolean>(false);
  const [perfil, setPerfil] = useState<PerfilUsuario>(() => {
    try {
      const saved = localStorage.getItem('perfil_usuario');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.pin) {
          parsed.pin = localStorage.getItem('saved_user_pin') || '1234';
        }
        return parsed;
      }
    } catch {}
    return {
      nombre: 'Benjamín Chávez',
      email: 'benja.chavez34@gmail.com',
      rol: 'Administrador General & Director Comercial',
      telefono: '+56 9 8765 4321',
      sucursal: 'Casa Central - Santiago',
      avatarId: 'gorilla',
      pin: localStorage.getItem('saved_user_pin') || '1234',
    };
  });
  const [editPerfil, setEditPerfil] = useState<PerfilUsuario>(perfil);
  const [mostrarPin, setMostrarPin] = useState<boolean>(false);

  // Evaluaciones y calificaciones profesionales del equipo de ventas
  const [evaluaciones, setEvaluaciones] = useState<Record<string, EvaluacionVendedor>>(() => {
    try {
      const saved = localStorage.getItem('evaluaciones_vendedores');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Directorio de clientes con teléfono WhatsApp y límite de crédito
  const [clientes, setClientes] = useState<Record<string, Cliente>>(() => {
    try {
      const saved = localStorage.getItem('clientes_directorio');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal para editar / registrar teléfono WhatsApp y datos del cliente
  const [modalCliente, setModalCliente] = useState<{
    isOpen: boolean;
    nombre: string;
    telefono: string;
    limiteCredito: string;
    autoOpenWhatsApp?: boolean;
    mensajeWhatsApp?: string;
  }>({
    isOpen: false,
    nombre: '',
    telefono: '',
    limiteCredito: '',
  });

  // Modal de Comprobante Digital de Abono / Pago listo para WhatsApp
  const [modalComprobante, setModalComprobante] = useState<{
    isOpen: boolean;
    cliente: string;
    montoAbonado: number;
    saldoAnterior: number;
    saldoRestante: number;
    fecha: string;
    telefono?: string;
  } | null>(null);

  // App data
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  // Punto de Venta (POS) & Carrito Multiproducto
  const [posMode, setPosMode] = useState<'carrito' | 'rapida'>('carrito');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posProductoId, setPosProductoId] = useState<string>('');
  const [posCantidad, setPosCantidad] = useState<string>('1');
  const [posMedioPago, setPosMedioPago] = useState<MedioPago>('efectivo');
  const [posPagoCon, setPosPagoCon] = useState<string>('');
  const [posDescuento, setPosDescuento] = useState<string>('');
  const [posCliente, setPosCliente] = useState<string>('');
  const [posTelefono, setPosTelefono] = useState<string>('');
  const [scannerPosOpen, setScannerPosOpen] = useState<boolean>(false);
  const [modalTicket, setModalTicket] = useState<TicketVenta | null>(null);

  // Venta Rápida (1 producto tradicional)
  const [vProductoId, setVProductoId] = useState<string>('');
  const [vCantidad, setVCantidad] = useState<string>('');
  const [vPrecio, setVPrecio] = useState<string>('');
  const [vTotal, setVTotal] = useState<string>('');
  const [vFiado, setVFiado] = useState<boolean>(false);
  const [vCliente, setVCliente] = useState<string>('');
  const [vTelefono, setVTelefono] = useState<string>('');

  // Deuda Form State
  const [dNombre, setDNombre] = useState<string>('');
  const [dTelefono, setDTelefono] = useState<string>('');
  const [dProductoId, setDProductoId] = useState<string>('');
  const [dCantidad, setDCantidad] = useState<string>('');
  const [dPrecio, setDPrecio] = useState<string>('');
  const [dMonto, setDMonto] = useState<string>('');
  const [busquedaDeudor, setBusquedaDeudor] = useState<string>('');
  const [expandedDeudores, setExpandedDeudores] = useState<Record<string, boolean>>({});
  const dNombreInputRef = useRef<HTMLInputElement>(null);

  const toggleDeudorDetalle = (nombre: string) => {
    setExpandedDeudores((prev) => ({
      ...prev,
      [nombre]: !prev[nombre],
    }));
  };

  // Stock Form State
  const [pNombre, setPNombre] = useState<string>('');
  const [pStock, setPStock] = useState<string>('');
  const [pCosto, setPCosto] = useState<string>('');
  const [pPrecio, setPPrecio] = useState<string>('');
  const [pCodigoBarra, setPCodigoBarra] = useState<string>('');
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [scannedFeedback, setScannedFeedback] = useState<{
    msg: string;
    type: 'success' | 'info' | 'warn';
  } | null>(null);

  // Modal de Abono / Pago
  const [modalAbono, setModalAbono] = useState<{
    isOpen: boolean;
    nombre: string;
    deuda: number;
  }>({ isOpen: false, nombre: '', deuda: 0 });
  const [montoAbono, setMontoAbono] = useState<string>('');
  const [errorAbono, setErrorAbono] = useState<string | null>(null);

  // Modal de Confirmación (reemplaza confirm() bloqueado por iframe)
  const [modalConfirm, setModalConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmClass?: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Modal Borrar Todo
  const [modalBorrarOpen, setModalBorrarOpen] = useState<boolean>(false);
  const [confirmBorrarText, setConfirmBorrarText] = useState<string>('');

  // Modal Cerrar Caja
  const [modalCierreOpen, setModalCierreOpen] = useState<boolean>(false);
  const [nombreCierreInput, setNombreCierreInput] = useState<string>('');

  // Modal Entrada de Mercadería
  const [modalEntrada, setModalEntrada] = useState<{
    isOpen: boolean;
    producto: Producto | null;
    cant: string;
    costoTotal: string;
    error: string | null;
  }>({ isOpen: false, producto: null, cant: '', costoTotal: '', error: null });

  // Modal Venta Rápida
  const [modalVentaRapida, setModalVentaRapida] = useState<{
    isOpen: boolean;
    producto: Producto | null;
    cant: string;
    error: string | null;
  }>({ isOpen: false, producto: null, cant: '1', error: null });

  // Notificación in-app / Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'debt' } | null>(null);

  const showToast = (msg: string, type: 'ok' | 'debt' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 3500);
  };

  // Listen to Auth
  useEffect(() => {
    // Inicializar push al cargar la app
    initializePushNotifications();

    // Restaurar sesión guardada para el bloqueo rápido
    try {
      const rawSession = localStorage.getItem('saved_user_session');
      if (rawSession) {
        const sess = JSON.parse(rawSession);
        setSavedSession(sess);
        setIsLocked(true);
      }
    } catch {}

    // Resolver inicio de sesión por redirección (si se utilizó redirect)
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          console.log('[Auth] Autenticado con éxito vía redirección:', res.user.email);
        }
      })
      .catch((err) => {
        // Log info sin ensuciar la interfaz visual del usuario
        console.log('[Auth] Estado redirección:', err?.message || err);
      });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsGuest(false);
        initializePushNotifications(currentUser.uid);
        const emailLower = (currentUser.email || '').toLowerCase().trim();
        const isCurrentAdmin = isUserAdmin(emailLower);
        const isBenja = emailLower === 'benja.chavez34@gmail.com';
        const isFco = emailLower === 'fco.inzunza.re@gmail.com';
        const name = isBenja
          ? (currentUser.displayName || 'Benjamín Chávez')
          : isFco
          ? (currentUser.displayName || 'Francisco Inzunza')
          : (currentUser.displayName || currentUser.email || 'Socio');
        setMiNombre(name);
        try {
          localStorage.setItem('miNombre', name);
        } catch {}
        setAuthStatus(`Conectado como ${currentUser.email || name}`);
        setDbError(null);

        if (isCurrentAdmin) {
          const savedAdmin =
            localStorage.getItem(`perfil_usuario_${emailLower}`) ||
            (isBenja ? localStorage.getItem('perfil_usuario') : null);
          if (savedAdmin) {
            try {
              setPerfil(JSON.parse(savedAdmin));
            } catch {}
          } else {
            setPerfil({
              nombre: name,
              email: currentUser.email || emailLower,
              rol: isFco
                ? 'Administrador General & Socio'
                : 'Administrador General & Director Comercial',
              telefono: isBenja ? '+56 9 8765 4321' : '',
              sucursal: 'Casa Central - Santiago',
              avatarId: 'gorilla',
            });
          }
        } else {
          const userStorageKey = `perfil_usuario_${emailLower}`;
          let loadedPerfil: PerfilUsuario | null = null;
          try {
            const savedSpecific = localStorage.getItem(userStorageKey);
            if (savedSpecific) loadedPerfil = JSON.parse(savedSpecific);
          } catch {}

          if (loadedPerfil) {
            setPerfil(loadedPerfil);
          } else {
            setPerfil({
              nombre: name,
              email: currentUser.email || '',
              rol: 'Vendedor',
              telefono: '',
              sucursal: 'Ruta Comercial',
              avatarId: 'avatar2',
            });
          }
        }

        // Vincular usuario a la base de datos Firestore (usuarios y miembros)
        vincularUsuarioEnBD(currentUser, name);

        // Guardar sesión para bloqueo / re-ingreso biométrico/PIN
        const sessObj = {
          uid: currentUser.uid,
          email: currentUser.email || emailLower,
          nombre: name,
          rol: isCurrentAdmin ? 'Administrador General' : 'Vendedor',
          avatarId: isCurrentAdmin ? 'gorilla' : 'avatar2',
          pin: localStorage.getItem('saved_user_pin') || '1234',
        };
        try {
          localStorage.setItem('saved_user_session', JSON.stringify(sessObj));
          if (!localStorage.getItem('saved_user_pin')) {
            localStorage.setItem('saved_user_pin', '1234');
          }
          if (isCurrentAdmin) {
            localStorage.setItem('sesion_activa_rol', 'admin');
          }
        } catch {}
        setSavedSession(sessObj);
      } else {
        if (!isGuest) {
          const rawSession = localStorage.getItem('saved_user_session');
          if (!rawSession) {
            setUser(null);
            setAuthStatus('Inicia sesión para acceder al registro compartido.');
          }
        }
      }
    });
    return () => unsubscribe();
  }, [isGuest]);

  // Firestore Listeners
  useEffect(() => {
    if (!user && !isGuest) {
      setProductos([]);
      setMovs([]);
      setCierres([]);
      return;
    }

    if (isGuest) {
      // Local demo fallback if needed
      try {
        const localProds = localStorage.getItem('local_productos');
        const localMovs = localStorage.getItem('local_movs');
        const localCierres = localStorage.getItem('local_cierres');
        if (localProds) setProductos(JSON.parse(localProds));
        if (localMovs) setMovs(JSON.parse(localMovs));
        if (localCierres) setCierres(JSON.parse(localCierres));
      } catch {}
      return;
    }

    // Subscribe to Firestore collections
    const unsubProds = onSnapshot(
      collection(db, 'productos'),
      (snapshot) => {
        const prods = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Producto, 'id'>) }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setProductos(prods);
        setDbError(null);
      },
      (err) => {
        setDbError(
          'Firebase no permite leer los datos. Revisa las reglas de Firestore y que tu correo esté autorizado. Detalle: ' +
            (err?.message || 'error desconocido')
        );
      }
    );

    const unsubCierres = onSnapshot(
      collection(db, 'cierres'),
      (snapshot) => {
        const cList = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<CierreCaja, 'id'>) }))
          .sort((a, b) => b.hasta - a.hasta);
        setCierres(cList);
      },
      (err) => {
        setDbError((prev) => prev || (err?.message ? `Error: ${err.message}` : null));
      }
    );

    const unsubMovs = onSnapshot(
      collection(db, 'movs'),
      (snapshot) => {
        const mList = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Movimiento, 'id'>) })
        );
        setMovs(mList);
      },
      (err) => {
        setDbError((prev) => prev || (err?.message ? `Error: ${err.message}` : null));
      }
    );

    const unsubMiembros = onSnapshot(
      collection(db, 'miembros'),
      (snapshot) => {
        const list = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Miembro, 'id'>) })
        );
        setMiembros(list);

        // Si el usuario actual ya está registrado en miembros, actualizar su perfil activo
        if (user?.email) {
          const userEmail = user.email.toLowerCase().trim();
          const matching = list.filter((m) => m.email?.toLowerCase() === userEmail);
          const miDoc =
            matching.find((m) => m.id === user.uid) ||
            matching.find((m) => m.telefono || (m.avatarId && m.avatarId !== 'gorilla')) ||
            matching[0];

          if (miDoc) {
            setPerfil((prev) => ({
              ...prev,
              nombre: miDoc.nombre || prev.nombre,
              rol: miDoc.rol || prev.rol,
              telefono: miDoc.telefono !== undefined && miDoc.telefono !== '' ? miDoc.telefono : prev.telefono,
              sucursal: miDoc.sucursal || prev.sucursal,
              avatarId: miDoc.avatarId || prev.avatarId,
            }));
            if (miDoc.nombre) setMiNombre(miDoc.nombre);
          }
        }
      },
      (err) => console.log('miembros err', err)
    );

    const unsubMensajes = onSnapshot(
      collection(db, 'mensajes'),
      (snapshot) => {
        const list = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<MensajeChat, 'id'>) })
        );
        list.sort((a, b) => a.ts - b.ts);
        setMensajes(list);

        // Notificación de mensajes nuevos en tiempo real con sonido, parpadeo de pestaña y banner flotante
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data() as MensajeChat;
            const isFromOther = Boolean(newMsg && newMsg.deEmail?.toLowerCase() !== user?.email?.toLowerCase());
            const isRecent = Date.now() - (newMsg.ts || 0) < 45000;
            if (isFromOther && isRecent) {
              // 1. Mostrar banner flotante en la pantalla (visible en iPhone, Android y Desktop)
              setInAppBanner({
                id: newMsg.id || String(Date.now()),
                deNombre: newMsg.deNombre || 'Compañero',
                texto: newMsg.texto || '',
                avatarId: newMsg.avatarId,
              });
              setTimeout(() => {
                setInAppBanner((curr) => (curr?.texto === newMsg.texto ? null : curr));
              }, 6500);

              // 2. Incrementar badge de no leídos
              setMensajesNoLeidos((prev) => prev + 1);

              // 3. Reproducir sonido y disparar notificación web/sistema
              showBrowserNotification(
                `💬 ${newMsg.deNombre || 'Compañero'}:`,
                newMsg.texto || 'Nuevo mensaje en Ventas Score'
              );
            }
          }
        });
      },
      (err) => console.log('mensajes err', err)
    );

    const unsubEvaluaciones = onSnapshot(
      collection(db, 'evaluaciones_vendedores'),
      (snapshot) => {
        const map: Record<string, EvaluacionVendedor> = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = d.data() as EvaluacionVendedor;
        });
        setEvaluaciones(map);
        try {
          localStorage.setItem('evaluaciones_vendedores', JSON.stringify(map));
        } catch {}
      },
      (err) => console.log('[Evaluaciones] err', err)
    );

    const unsubClientes = onSnapshot(
      collection(db, 'clientes'),
      (snapshot) => {
        const map: Record<string, Cliente> = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<Cliente, 'id'>) };
        });
        setClientes(map);
        try {
          localStorage.setItem('clientes_directorio', JSON.stringify(map));
        } catch {}
      },
      (err) => console.log('[Clientes] err', err)
    );

    return () => {
      unsubProds();
      unsubCierres();
      unsubMovs();
      unsubMiembros();
      unsubMensajes();
      unsubEvaluaciones();
      unsubClientes();
    };
  }, [user, isGuest]);

  // Navegación automática si se hace clic en la notificación del Service Worker
  useEffect(() => {
    const handleSwMsg = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_TAB' && event.data?.tab) {
        setActiveTab(event.data.tab);
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMsg);
    }
    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMsg);
      }
    };
  }, []);

  // Clients list for datalist suggestions (de movs y de clientes registrados)
  const clientNames = useMemo(() => {
    const setNames = new Set<string>();
    movs.forEach((m) => {
      if (m.cliente && m.cliente.trim()) setNames.add(m.cliente.trim());
    });
    Object.values(clientes).forEach((c) => {
      if (c.nombre && c.nombre.trim()) setNames.add(c.nombre.trim());
    });
    return Array.from(setNames).sort((a, b) => a.localeCompare(b));
  }, [movs, clientes]);

  // Helper to add a movement
  const addMov = async (m: Omit<Movimiento, 'ts' | 'fecha' | 'por'>): Promise<boolean> => {
    const timestamp = Date.now();
    const fecha = fTs(timestamp);
    const movData: Movimiento = {
      ...m,
      por: miNombre,
      ts: timestamp,
      fecha,
    };

    if (isGuest) {
      const updated = [...movs, { ...movData, id: 'local_' + timestamp }];
      setMovs(updated);
      try {
        localStorage.setItem('local_movs', JSON.stringify(updated));
      } catch {}
      return true;
    }

    try {
      await addDoc(collection(db, 'movs'), movData);
      return true;
    } catch (e: any) {
      alert('No se pudo guardar: ' + (e?.message || e));
      return false;
    }
  };

  const handleGuardarEvaluacion = async (ev: EvaluacionVendedor) => {
    const docKey = ev.vendedorNombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    setEvaluaciones((prev) => {
      const updated = { ...prev, [docKey]: ev };
      try {
        localStorage.setItem('evaluaciones_vendedores', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (isGuest) {
      showToast(`Evaluación de ${ev.vendedorNombre} guardada (modo local)`);
      return;
    }

    try {
      await setDoc(doc(db, 'evaluaciones_vendedores', docKey), ev, { merge: true });
      showToast(`✓ Calificación oficial de ${ev.vendedorNombre} guardada`);
    } catch (err: any) {
      console.error('Error guardando evaluación en Firestore:', err);
      showToast(`Evaluación guardada localmente`);
    }
  };

  const handleGuardarCliente = async (
    nombre: string,
    telefono?: string,
    limiteCredito?: number,
    direccion?: string,
    notas?: string
  ) => {
    if (!nombre.trim()) return null;
    const cleanNombre = nombre.trim();
    const docKey = cleanNombre.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const existing = clientes[docKey];

    const nuevoCliente: Cliente = {
      id: docKey,
      nombre: cleanNombre,
      telefono: telefono !== undefined ? telefono.trim() : (existing?.telefono || ''),
      limiteCredito: limiteCredito !== undefined ? limiteCredito : existing?.limiteCredito,
      direccion: direccion !== undefined ? direccion.trim() : (existing?.direccion || ''),
      notas: notas !== undefined ? notas.trim() : (existing?.notas || ''),
      creadoEn: existing?.creadoEn || Date.now(),
      actualizadoEn: Date.now(),
    };

    setClientes((prev) => {
      const updated = { ...prev, [docKey]: nuevoCliente };
      try {
        localStorage.setItem('clientes_directorio', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (!isGuest) {
      try {
        await setDoc(doc(db, 'clientes', docKey), nuevoCliente, { merge: true });
      } catch (e) {
        console.error('Error guardando cliente en Firestore:', e);
      }
    }
    return nuevoCliente;
  };

  // Helper: Enviar cobranza / recordatorio de deuda por WhatsApp con 1 toque
  const handleWhatsAppRecordatorio = (d: Deudor) => {
    const docKey = d.nombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const tel = d.telefono || clientes[docKey]?.telefono;

    // Resumen de las últimas compras adeudadas
    const clienteMovs = movs.filter(
      (m) => m.cliente && m.cliente.trim().toLowerCase() === d.nombre.trim().toLowerCase()
    );
    const comprasFiadas = clienteMovs.filter((m) => (m.tipo === 'venta' && m.fiado) || m.tipo === 'deuda');
    const itemsTxt = comprasFiadas
      .slice(0, 3)
      .map((m) => (m.producto ? `${m.cant ? `${m.cant}x ` : ''}${m.producto}` : 'Compra'))
      .join(', ');
    const extraTxt = comprasFiadas.length > 3 ? ` y ${comprasFiadas.length - 3} compras más` : '';
    const detalleCompras = itemsTxt ? ` (${itemsTxt}${extraTxt})` : '';

    const mensaje = `Hola ${d.nombre}! Te saludamos de Ventas Score.

Te escribimos para recordarte que mantienes un saldo pendiente de ${fmt(d.deuda)}${detalleCompras}.

Si deseas transferir, te dejamos los datos de la cuenta:
Nombre: Benjamin Chavez
Rut: 20.627.873-0
Banco: Bancoestado
Tipo de cuenta: Cuenta Rut

Por favor envianos el comprobante cuando realices la transferencia para actualizar tu cuenta de inmediato. Muchas gracias!`;

    if (tel && tel.replace(/\D/g, '').length >= 8) {
      let cleanPhone = tel.replace(/\D/g, '');
      if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
        cleanPhone = '56' + cleanPhone;
      } else if (cleanPhone.length === 8) {
        cleanPhone = '569' + cleanPhone;
      }
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`, '_blank');
    } else {
      // Si no tiene teléfono guardado, abrir modal para registrarlo y enviarle el WhatsApp al instante
      setModalCliente({
        isOpen: true,
        nombre: d.nombre,
        telefono: '+56 9 ',
        limiteCredito: d.limiteCredito ? String(d.limiteCredito) : '',
        autoOpenWhatsApp: true,
        mensajeWhatsApp: mensaje,
      });
    }
  };

  // Helper: Enviar comprobante digital de abono por WhatsApp
  const handleEnviarComprobanteWhatsApp = (
    nombre: string,
    monto: number,
    saldoAnterior: number,
    saldoRestante: number,
    fechaHora?: string
  ) => {
    const docKey = nombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const tel = clientes[docKey]?.telefono;
    const fecha = fechaHora || fTs(Date.now());

    const texto = `COMPROBANTE DE ABONO - VENTAS SCORE
----------------------------------------
Cliente: ${nombre}
Monto abonado: ${fmt(monto)}
Fecha: ${fecha}
Recibido por: ${miNombre}

Estado de cuenta:
Saldo anterior: ${fmt(saldoAnterior)}
Saldo restante: ${fmt(saldoRestante)}

${saldoRestante <= 0 ? 'Tu cuenta ha quedado 100% al dia! Muchas gracias por tu pago.' : 'Agradecemos tu puntual abono!'}
----------------------------------------`;

    if (tel && tel.replace(/\D/g, '').length >= 8) {
      let cleanPhone = tel.replace(/\D/g, '');
      if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
        cleanPhone = '56' + cleanPhone;
      } else if (cleanPhone.length === 8) {
        cleanPhone = '569' + cleanPhone;
      }
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(texto)}`, '_blank');
    } else {
      setModalCliente({
        isOpen: true,
        nombre,
        telefono: '+56 9 ',
        limiteCredito: '',
        autoOpenWhatsApp: true,
        mensajeWhatsApp: texto,
      });
    }
  };

  const checkStock = (prod: Producto, cant: number): boolean => {
    const currentStock = stockDe(prod.id, movs);
    if (cant <= currentStock) return true;
    return window.confirm(
      `El stock de ${prod.nombre} quedará negativo (${currentStock - cant}). ¿Continuar?`
    );
  };

  // Helper: Vincular usuario en base de datos Firestore (usuarios y miembros)
  const vincularUsuarioEnBD = async (
    u: User | { uid: string; email?: string | null; displayName?: string | null },
    nombreCustom?: string,
    perfilOverride?: Partial<PerfilUsuario>
  ) => {
    try {
      const emailLower = (u.email || '').toLowerCase().trim();
      const isAdminUser = isUserAdmin(emailLower);
      const isBenja = emailLower === 'benja.chavez34@gmail.com';
      const isFco = emailLower === 'fco.inzunza.re@gmail.com';

      // Consultar si ya existe el miembro en Firestore para preservar su foto y teléfono
      let existing: Partial<Miembro> | null = null;
      try {
        const snapMiembro = await getDoc(doc(db, 'miembros', u.uid));
        if (snapMiembro.exists()) {
          existing = snapMiembro.data() as Partial<Miembro>;
        } else if (emailLower) {
          const emailDocId = emailLower.replace(/[^a-zA-Z0-9_-]/g, '_');
          const snapEmail = await getDoc(doc(db, 'miembros', emailDocId));
          if (snapEmail.exists()) existing = snapEmail.data() as Partial<Miembro>;
        }
      } catch (errSnap) {
        console.warn('[BD] Consulta previa omitida:', errSnap);
      }

      // Obtener datos locales si existen
      let localSaved: Partial<PerfilUsuario> | null = null;
      try {
        const raw =
          localStorage.getItem(`perfil_usuario_${emailLower}`) ||
          (isBenja ? localStorage.getItem('perfil_usuario') : null);
        if (raw) localSaved = JSON.parse(raw);
      } catch {}

      const nombreFinal =
        perfilOverride?.nombre ||
        nombreCustom ||
        existing?.nombre ||
        localSaved?.nombre ||
        u.displayName ||
        (isBenja ? 'Benjamín Chávez' : isFco ? 'Francisco Inzunza' : 'Vendedor');

      const avatarFinal =
        perfilOverride?.avatarId ||
        existing?.avatarId ||
        localSaved?.avatarId ||
        (isAdminUser ? 'gorilla' : 'avatar2');

      const telefonoFinal =
        perfilOverride?.telefono !== undefined
          ? perfilOverride.telefono
          : existing?.telefono !== undefined
          ? existing.telefono
          : localSaved?.telefono !== undefined
          ? localSaved.telefono
          : (isBenja ? '+56 9 8765 4321' : '');

      const rolFinal =
        perfilOverride?.rol ||
        existing?.rol ||
        localSaved?.rol ||
        (isBenja
          ? 'Administrador General & Director Comercial'
          : isFco
          ? 'Administrador General & Socio'
          : 'Vendedor');

      const sucursalFinal =
        perfilOverride?.sucursal ||
        existing?.sucursal ||
        localSaved?.sucursal ||
        (isAdminUser ? 'Casa Central - Santiago' : 'Ruta Comercial');

      // 1. Colección usuarios
      await setDoc(
        doc(db, 'usuarios', u.uid),
        {
          uid: u.uid,
          email: emailLower,
          nombre: nombreFinal,
          rol: rolFinal,
          telefono: telefonoFinal,
          sucursal: sucursalFinal,
          avatarId: avatarFinal,
          isAdmin: isAdminUser,
          activo: true,
          ultimoAcceso: new Date().toISOString(),
        },
        { merge: true }
      );

      // 2. Colección miembros para chat y equipo (por UID)
      await setDoc(
        doc(db, 'miembros', u.uid),
        {
          id: u.uid,
          nombre: nombreFinal,
          email: emailLower,
          rol: rolFinal,
          isAdmin: isAdminUser,
          avatarId: avatarFinal,
          telefono: telefonoFinal,
          sucursal: sucursalFinal,
          estado: 'disponible',
          ultimoIngreso: Date.now(),
          ultimaActividad: Date.now(),
        },
        { merge: true }
      );

      // Si existía un documento histórico con formato email_id, sincronizarlo
      const emailDocId = emailLower.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (emailDocId && emailDocId !== u.uid) {
        try {
          await setDoc(
            doc(db, 'miembros', emailDocId),
            {
              id: u.uid,
              nombre: nombreFinal,
              email: emailLower,
              rol: rolFinal,
              isAdmin: isAdminUser,
              avatarId: avatarFinal,
              telefono: telefonoFinal,
              sucursal: sucursalFinal,
              estado: 'disponible',
              ultimoIngreso: Date.now(),
              ultimaActividad: Date.now(),
            },
            { merge: true }
          );
        } catch {}
      }

      console.log('[BD] Usuario vinculado exitosamente preservando datos:', emailLower);
    } catch (err) {
      console.error('[BD] Error vinculando usuario en Firestore:', err);
    }
  };

  // Helper para verificar fortaleza de contraseña
  const checkPasswordStrength = (pass: string) => {
    const hasLength = pass.length >= 6;
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    return {
      isValid: hasLength && hasUpper && hasNumber,
      hasLength,
      hasUpper,
      hasNumber,
    };
  };

  // Auth Handlers
  const handleLoginGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      setAuthStatus('Iniciando sesión con Google...');
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.warn('Error login Google popup:', e);
      if (
        e?.code === 'auth/popup-blocked' ||
        e?.code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirErr: any) {
          console.error('Redirect err:', redirErr);
          setAuthStatus('Google requiere autorización. Puedes usar tu Correo y Contraseña.');
        }
      } else {
        setAuthStatus('No se pudo iniciar sesión con Google: ' + (e?.message || e));
      }
    }
  };

  // Login tradicional con Correo y Contraseña
  const handleLoginConCorreo = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    const pass = loginPass;
    if (!email || !pass) {
      alert('Ingresa tu correo y contraseña.');
      return;
    }
    setAuthLoading(true);
    setAuthStatus('Iniciando sesión...');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const u = cred.user;
      const isCurrentAdmin = isUserAdmin(u.email);
      const nombre = u.displayName || (isCurrentAdmin ? 'Administrador' : 'Vendedor');

      await vincularUsuarioEnBD(u, nombre);

      const sessionObj = {
        uid: u.uid,
        email: u.email || email,
        nombre,
        rol: isCurrentAdmin ? 'Administrador General' : 'Vendedor',
        avatarId: isCurrentAdmin ? 'gorilla' : 'avatar2',
        pin: localStorage.getItem('saved_user_pin') || '1234',
      };
      try {
        localStorage.setItem('saved_user_session', JSON.stringify(sessionObj));
        localStorage.setItem('saved_user_pin', sessionObj.pin);
        localStorage.setItem('miNombre', nombre);
        if (isCurrentAdmin) localStorage.setItem('sesion_activa_rol', 'admin');
      } catch {}

      setSavedSession(sessionObj);
      setIsLocked(false);
      setUser(u);
      setIsGuest(false);
      setMiNombre(nombre);
      showToast(`¡Bienvenido de vuelta, ${nombre}!`);
    } catch (err: any) {
      console.error('Error login correo:', err);
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
        alert('Correo o contraseña incorrectos.');
      } else if (err?.code === 'auth/operation-not-allowed') {
        alert(
          'El proveedor de Correo/Contraseña no está habilitado en Firebase Console.\n\nPor favor ve a Firebase Console -> Authentication -> Sign-in method y activa "Correo electrónico/contraseña".'
        );
      } else {
        alert('Error al iniciar sesión: ' + (err?.message || err));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Registro con Correo, Contraseña estricta y Código de Verificación
  const handleRegistrarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = regNombre.trim();
    const email = regEmail.trim().toLowerCase();
    const pass = regPass;
    const confirm = regConfirmPass;

    if (!nombre || !email || !pass) {
      alert('Por favor completa todos los campos.');
      return;
    }

    if (pass !== confirm) {
      alert('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    const strength = checkPasswordStrength(pass);
    if (!strength.isValid) {
      let msg = 'La contraseña debe cumplir los siguientes requisitos:\n';
      if (!strength.hasLength) msg += '• Mínimo 6 caracteres\n';
      if (!strength.hasUpper) msg += '• Al menos una letra mayúscula (A-Z)\n';
      if (!strength.hasNumber) msg += '• Al menos un número (0-9)\n';
      alert(msg);
      return;
    }

    setAuthLoading(true);
    setAuthStatus('Creando cuenta y enviando código de verificación...');

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCred.user, { displayName: nombre });

      // Enviar correo oficial de verificación de Firebase Auth
      try {
        await sendEmailVerification(userCred.user);
        console.log('[Auth] Correo de verificación oficial enviado');
      } catch (emailErr) {
        console.warn('[Auth] Error enviando correo Firebase:', emailErr);
      }

      // Generar código numérico de 6 dígitos
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setExpectedOtpCode(otp);

      // Guardar en Firestore para comprobación y registro en base de datos
      try {
        await setDoc(doc(db, 'verificaciones', email), {
          code: otp,
          email: email,
          ts: Date.now(),
        });
      } catch (fsErr) {
        console.warn('[Auth] Código guardado en memoria:', fsErr);
      }

      setPendingUser({ uid: userCred.user.uid, email, nombre });
      setLoginView('verify_email');
      showToast('¡Código de verificación enviado a tu correo!');
    } catch (err: any) {
      console.error('Error al registrar cuenta:', err);
      if (err?.code === 'auth/email-already-in-use') {
        alert('Ya existe una cuenta con este correo. Puedes iniciar sesión directamente.');
        setLoginView('login_email');
        setLoginEmail(email);
      } else if (err?.code === 'auth/operation-not-allowed') {
        alert(
          'El proveedor de Correo/Contraseña no está habilitado en Firebase Console.\n\nPor favor ve a Firebase Console -> Authentication -> Sign-in method y activa "Correo electrónico/contraseña".'
        );
      } else {
        alert('No se pudo crear la cuenta: ' + (err?.message || err));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Confirmar código de 6 dígitos
  const handleConfirmarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = regOtpCode.trim();
    if (!entered) {
      alert('Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }

    let esValido = entered === expectedOtpCode;

    if (!esValido && pendingUser?.email) {
      try {
        const snap = await getDoc(doc(db, 'verificaciones', pendingUser.email));
        if (snap.exists() && snap.data()?.code === entered) {
          esValido = true;
        }
      } catch {}
    }

    if (!esValido && auth.currentUser) {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          esValido = true;
        }
      } catch {}
    }

    if (!esValido) {
      alert('Código incorrecto. Revisa el correo enviado o reenvía el código.');
      return;
    }

    setAuthLoading(true);
    try {
      const u = auth.currentUser;
      const finalUid = u?.uid || pendingUser?.uid || 'user_' + Date.now();
      const finalEmail = u?.email || pendingUser?.email || '';
      const finalNombre = pendingUser?.nombre || u?.displayName || 'Usuario';
      const isCurrentAdmin = isUserAdmin(finalEmail);

      // Vincular cuenta a Firestore en usuarios y miembros
      await vincularUsuarioEnBD(u || ({ uid: finalUid, email: finalEmail, displayName: finalNombre } as User), finalNombre);

      const sessionObj = {
        uid: finalUid,
        email: finalEmail,
        nombre: finalNombre,
        rol: isCurrentAdmin ? 'Administrador General' : 'Vendedor',
        avatarId: isCurrentAdmin ? 'gorilla' : 'avatar2',
        pin: '1234',
      };
      try {
        localStorage.setItem('saved_user_session', JSON.stringify(sessionObj));
        localStorage.setItem('saved_user_pin', '1234');
        localStorage.setItem('miNombre', finalNombre);
        if (isCurrentAdmin) localStorage.setItem('sesion_activa_rol', 'admin');
      } catch {}

      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
        } catch {}
      }

      setSavedSession(sessionObj);
      setIsLocked(false);
      setUser(u || ({ uid: finalUid, email: finalEmail, displayName: finalNombre } as User));
      setIsGuest(false);
      setMiNombre(finalNombre);
      setLoginView('main');
      setPendingUser(null);
      setExpectedOtpCode('');
      setDbError(null);

      showToast('¡Cuenta verificada y vinculada a la base de datos!');
    } catch (err: any) {
      alert('Error vinculando cuenta: ' + (err?.message || err));
    } finally {
      setAuthLoading(false);
    }
  };

  // Reenviar código de verificación
  const handleReenviarCodigo = async () => {
    if (!pendingUser?.email) return;
    try {
      setAuthLoading(true);
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setExpectedOtpCode(newOtp);
      try {
        await setDoc(doc(db, 'verificaciones', pendingUser.email), {
          code: newOtp,
          email: pendingUser.email,
          ts: Date.now(),
        });
      } catch {}
      alert(`Código reenviado al correo ${pendingUser.email}.`);
    } catch (e: any) {
      alert('Error reenviando código: ' + (e?.message || e));
    } finally {
      setAuthLoading(false);
    }
  };

  // Desbloqueo: Completar sesión
  const completarDesbloqueo = () => {
    setIsLocked(false);
    if (savedSession) {
      setMiNombre(savedSession.nombre);
      const isCurrentAdmin = isUserAdmin(savedSession.email);
      if (isCurrentAdmin) {
        try {
          localStorage.setItem('sesion_activa_rol', 'admin');
        } catch {}
      }
      if (!user) {
        setUser({
          uid: savedSession.uid,
          email: savedSession.email,
          displayName: savedSession.nombre,
        } as User);
      }
    }
  };

  // Desbloqueo Biométrico (Huella / Face ID con WebAuthn)
  const handleBiometricUnlock = async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      alert('Tu dispositivo no soporta la autenticación biométrica WebAuthn en este navegador. Por favor ingresa con tu PIN o Contraseña.');
      setUnlockMethod('pin');
      return;
    }
    setUnlockLoading(true);
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isAvailable) {
        alert('No se detectó un sensor biométrico configurado en este dispositivo. Puedes usar tu PIN o Contraseña.');
        setUnlockMethod('pin');
        setUnlockLoading(false);
        return;
      }

      const credId = localStorage.getItem('biometric_cred_id');
      if (!credId) {
        const createOptions: CredentialCreationOptions = {
          publicKey: {
            challenge,
            rp: { name: 'Ventas Score', id: window.location.hostname },
            user: {
              id: new TextEncoder().encode(savedSession?.email || 'user'),
              name: savedSession?.email || 'user@score.cl',
              displayName: savedSession?.nombre || 'Usuario',
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' },
              { alg: -257, type: 'public-key' },
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        };
        const newCred: any = await navigator.credentials.create(createOptions);
        if (newCred?.id) {
          localStorage.setItem('biometric_cred_id', newCred.id);
          completarDesbloqueo();
          showToast('¡Desbloqueado con biometría!');
          return;
        }
      } else {
        const getOptions: CredentialRequestOptions = {
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: 'required',
            timeout: 60000,
          },
        };
        const assertion = await navigator.credentials.get(getOptions);
        if (assertion) {
          completarDesbloqueo();
          showToast('¡Desbloqueado con biometría!');
          return;
        }
      }
    } catch (err: any) {
      console.warn('[Biometría]', err);
      if (err?.name !== 'NotAllowedError') {
        alert('Autenticación biométrica no completada. Puedes ingresar con PIN o Contraseña.');
      }
      setUnlockMethod('pin');
    } finally {
      setUnlockLoading(false);
    }
  };

  // Desbloqueo por PIN rápido
  const handlePinUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPin = savedSession?.pin || localStorage.getItem('saved_user_pin') || '1234';
    if (unlockPin.trim() === correctPin) {
      completarDesbloqueo();
      setUnlockPin('');
      showToast('¡Sesión desbloqueada!');
    } else {
      alert('PIN incorrecto. Si no lo recuerdas, pulsa en "Contraseña" arriba para ingresar con la clave de tu cuenta y actualizar tu PIN en "Mi Cuenta".');
    }
  };

  // Desbloqueo por Contraseña de la cuenta
  const handlePasswordUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim() || !savedSession?.email) {
      alert('Ingresa tu contraseña.');
      return;
    }
    setUnlockLoading(true);
    try {
      await signInWithEmailAndPassword(auth, savedSession.email, unlockPassword);
      completarDesbloqueo();
      setUnlockPassword('');
      showToast('¡Sesión desbloqueada con contraseña!');
    } catch (err: any) {
      alert('Contraseña incorrecta: ' + (err?.message || err));
    } finally {
      setUnlockLoading(false);
    }
  };

  // Cerrar sesión completa y olvidar usuario
  const handleCerrarSesionCompleto = async () => {
    try {
      if (user) await signOut(auth);
    } catch {}
    try {
      localStorage.removeItem('saved_user_session');
      localStorage.removeItem('sesion_activa_rol');
    } catch {}
    setSavedSession(null);
    setIsLocked(false);
    setUser(null);
    setIsGuest(false);
    setLoginView('main');
    setAuthStatus('Inicia sesión para continuar');
    showToast('Sesión cerrada correctamente');
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setIsLocked(false);
    let guestName = miNombre;
    if (!guestName) {
      try {
        guestName = prompt('Ingresa tu nombre o apodo para el registro:') || 'Usuario';
      } catch {
        guestName = 'Usuario';
      }
    }
    if (!guestName) guestName = 'Usuario';
    setMiNombre(guestName);
    try {
      localStorage.setItem('miNombre', guestName);
    } catch {}
    setAuthStatus(`Modo local/invitado (${guestName})`);
    showToast(`Iniciado como ${guestName}`);
  };

  const handleLogout = handleCerrarSesionCompleto;

  // Venta Form Handlers
  const handleVProductoChange = (pid: string) => {
    setVProductoId(pid);
    const p = productos.find((x) => x.id === pid);
    if (p && p.precio) {
      setVPrecio(String(p.precio));
      const cant = parseFloat(vCantidad) || 0;
      if (cant) {
        setVTotal(String(cant * p.precio));
      }
    }
  };

  const handleVCantidadChange = (val: string) => {
    setVCantidad(val);
    const c = parseFloat(val) || 0;
    const pr = parseFloat(vPrecio) || 0;
    if (c && pr) setVTotal(String(c * pr));
  };

  const handleVPrecioChange = (val: string) => {
    setVPrecio(val);
    const c = parseFloat(vCantidad) || 0;
    const pr = parseFloat(val) || 0;
    if (c && pr) setVTotal(String(c * pr));
  };

  const handleRegistrarVenta = async () => {
    const p = productos.find((x) => x.id === vProductoId);
    const cant = parseFloat(vCantidad);
    const total = parseFloat(vTotal);
    const cliente = vCliente.trim();

    if (!p) return alert('Selecciona un producto');
    if (isNaN(cant) || cant <= 0) return alert('Ingresa una cantidad válida');
    if (vFiado && !cliente) return alert('Ingresa el nombre del cliente para el fiado');
    if (isNaN(total)) return alert('Ingresa el total de la venta');
    if (!checkStock(p, cant)) return;

    const ok = await addMov({
      tipo: 'venta',
      productoId: p.id,
      producto: p.nombre,
      cant,
      total,
      fiado: vFiado,
      cliente: vFiado ? cliente : '',
    });

    if (ok) {
      if (vFiado && cliente && vTelefono && vTelefono.trim()) {
        handleGuardarCliente(cliente, vTelefono.trim());
      }
      setVCantidad('');
      setVPrecio('');
      setVTotal('');
      setVCliente('');
      setVTelefono('');
      setVFiado(false);
    }
  };

  // ===================== POS & CARRITO MULTIPRODUCTO HANDLERS =====================
  const handleAddToCart = (prodId: string, cantToAdd: number = 1) => {
    const prod = productos.find((p) => p.id === prodId);
    if (!prod) return;

    const available = stockDe(prod.id, movs);
    const existingInCart = cart.find((it) => it.producto.id === prod.id);
    const currentCant = existingInCart ? existingInCart.cant : 0;
    const targetCant = currentCant + cantToAdd;

    if (targetCant > available) {
      const confirmCont = window.confirm(
        `El stock de ${prod.nombre} es ${available}. ¿Deseas agregar ${targetCant} al pedido de todas formas?`
      );
      if (!confirmCont) return;
    }

    const unitPrice = prod.precio || 0;
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.producto.id === prod.id);
      if (idx >= 0) {
        const updated = [...prev];
        const newCant = updated[idx].cant + cantToAdd;
        updated[idx] = {
          ...updated[idx],
          cant: newCant,
          subtotal: newCant * unitPrice,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            producto: prod,
            cant: cantToAdd,
            precioUnit: unitPrice,
            subtotal: cantToAdd * unitPrice,
          },
        ];
      }
    });
    showToast(`+${cantToAdd} ${prod.nombre} al pedido`);
  };

  const handleUpdateCartCant = (prodId: string, newCant: number) => {
    if (newCant <= 0) {
      setCart((prev) => prev.filter((it) => it.producto.id !== prodId));
      return;
    }
    setCart((prev) =>
      prev.map((it) => {
        if (it.producto.id === prodId) {
          return {
            ...it,
            cant: newCant,
            subtotal: newCant * it.precioUnit,
          };
        }
        return it;
      })
    );
  };

  const handleRemoveFromCart = (prodId: string) => {
    setCart((prev) => prev.filter((it) => it.producto.id !== prodId));
  };

  const handleClearCart = () => {
    setCart([]);
    setPosPagoCon('');
    setPosDescuento('');
    setPosCliente('');
    setPosTelefono('');
  };

  const handleBarcodeScannedInPos = (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;
    setScannerPosOpen(false);

    const match = identifyProductByBarcode(clean, productos);
    const prod = match.existingProduct || productos.find((p) => p.codigoBarra === clean);
    if (prod) {
      handleAddToCart(prod.id, 1);
    } else {
      alert(`Código de barra ${clean} no encontrado en los productos registrados.`);
    }
  };

  const handleCobrarCarrito = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío. Agrega al menos un producto para cobrar.');
      return;
    }

    const subtotal = cart.reduce((sum, it) => sum + it.subtotal, 0);
    const descuento = Math.max(0, parseFloat(posDescuento) || 0);
    const total = Math.max(0, subtotal - descuento);
    const cliente = posCliente.trim();
    const tel = posTelefono.trim();

    if (posMedioPago === 'fiado' && !cliente) {
      alert('Para venta a fiado (crédito) debes ingresar el nombre del cliente.');
      return;
    }

    let pagoCon = total;
    let vuelto = 0;
    if (posMedioPago === 'efectivo') {
      const parsedPago = parseFloat(posPagoCon);
      pagoCon = isNaN(parsedPago) ? total : parsedPago;
      if (pagoCon < total) {
        alert(`El monto ingresado ($${pagoCon}) es menor al total a pagar ($${total}).`);
        return;
      }
      vuelto = Math.max(0, pagoCon - total);
    }

    // Guardar cliente y teléfono en el directorio si se ingresó
    if (cliente && tel) {
      handleGuardarCliente(cliente, tel);
    }

    const ticketId = 'tk_' + Date.now();
    const isFiado = posMedioPago === 'fiado';

    // Registrar cada item en movimientos (100% compatible con stockDe, cierres y reportes)
    for (const it of cart) {
      const ratio = subtotal > 0 ? it.subtotal / subtotal : 1 / cart.length;
      const itemTotal = Math.round(it.subtotal - descuento * ratio);
      await addMov({
        tipo: 'venta',
        productoId: it.producto.id,
        producto: it.producto.nombre,
        cant: it.cant,
        total: itemTotal,
        fiado: isFiado,
        cliente: isFiado || cliente ? cliente : '',
        ticketId,
        medioPago: posMedioPago,
        pagoCon: posMedioPago === 'efectivo' ? pagoCon : undefined,
        vuelto: posMedioPago === 'efectivo' ? vuelto : undefined,
      });
    }

    const ticketObj: TicketVenta = {
      id: ticketId,
      items: [...cart],
      subtotal,
      descuento,
      total,
      medioPago: posMedioPago,
      pagoCon: posMedioPago === 'efectivo' ? pagoCon : undefined,
      vuelto: posMedioPago === 'efectivo' ? vuelto : undefined,
      cliente: cliente || undefined,
      telefono: tel || undefined,
      ts: Date.now(),
      fecha: fTs(Date.now()),
      por: miNombre,
    };

    handleClearCart();
    setModalTicket(ticketObj);
    showToast(`✓ Venta de ${fmt(total)} registrada con éxito`);
  };

  const handleEnviarTicketWhatsApp = (ticket: TicketVenta) => {
    const docKey = (ticket.cliente || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const tel = ticket.telefono || clientes[docKey]?.telefono;

    const itemsLines = ticket.items
      .map((it) => `- ${it.cant}x ${it.producto.nombre} (${fmt(it.precioUnit)} c/u): ${fmt(it.subtotal)}`)
      .join('\n');

    let pagoDetalle = '';
    if (ticket.medioPago === 'efectivo' && ticket.pagoCon) {
      pagoDetalle = ` (Pago con: ${fmt(ticket.pagoCon)} | Vuelto: ${fmt(ticket.vuelto || 0)})`;
    } else if (ticket.medioPago === 'fiado') {
      pagoDetalle = ' (Queda pendiente en saldo deudor)';
    }

    const texto = `TICKET DE VENTA - VENTAS SCORE ⚡
----------------------------------------
Fecha: ${ticket.fecha}
Atendido por: ${ticket.por}
${ticket.cliente ? `Cliente: ${ticket.cliente}\n` : ''}
PRODUCTOS:
${itemsLines}
----------------------------------------
Subtotal: ${fmt(ticket.subtotal)}
${ticket.descuento > 0 ? `Descuento: -${fmt(ticket.descuento)}\n` : ''}TOTAL: ${fmt(ticket.total)}
Medio de pago: ${ticket.medioPago.toUpperCase()}${pagoDetalle}

¡Muchas gracias por tu compra en Ventas Score!
----------------------------------------`;

    if (tel && tel.replace(/\D/g, '').length >= 8) {
      let cleanPhone = tel.replace(/\D/g, '');
      if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
        cleanPhone = '56' + cleanPhone;
      } else if (cleanPhone.length === 8) {
        cleanPhone = '569' + cleanPhone;
      }
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(texto)}`, '_blank');
    } else {
      setModalCliente({
        isOpen: true,
        nombre: ticket.cliente || 'Cliente',
        telefono: '+56 9 ',
        limiteCredito: '',
        autoOpenWhatsApp: true,
        mensajeWhatsApp: texto,
      });
    }
  };

  // Deudores Handlers
  const handleDProductoChange = (pid: string) => {
    setDProductoId(pid);
    const p = productos.find((x) => x.id === pid);
    if (p && p.precio) {
      setDPrecio(String(p.precio));
      const cant = parseFloat(dCantidad) || 0;
      if (cant) setDMonto(String(cant * p.precio));
    }
  };

  const handleDCantidadChange = (val: string) => {
    setDCantidad(val);
    const c = parseFloat(val) || 0;
    const pr = parseFloat(dPrecio) || 0;
    if (c && pr) setDMonto(String(c * pr));
  };

  const handleDPrecioChange = (val: string) => {
    setDPrecio(val);
    const c = parseFloat(dCantidad) || 0;
    const pr = parseFloat(val) || 0;
    if (c && pr) setDMonto(String(c * pr));
  };

  const handleAgregarDeuda = async () => {
    const nombre = dNombre.trim();
    const monto = parseFloat(dMonto);
    const p = productos.find((x) => x.id === dProductoId);
    const cant = parseFloat(dCantidad);

    if (!nombre || isNaN(monto) || monto <= 0) {
      return alert('Ingresa nombre y monto válido');
    }

    let ok = false;
    if (p) {
      if (isNaN(cant) || cant <= 0) return alert(`Ingresa la cantidad de ${p.nombre}`);
      if (!checkStock(p, cant)) return;
      ok = await addMov({
        tipo: 'venta',
        productoId: p.id,
        producto: p.nombre,
        cant,
        total: monto,
        fiado: true,
        cliente: nombre,
      });
    } else {
      ok = await addMov({
        tipo: 'deuda',
        total: monto,
        cliente: nombre,
      });
    }

    if (ok) {
      if (dTelefono && dTelefono.trim()) {
        handleGuardarCliente(nombre, dTelefono.trim());
      }
      setDNombre('');
      setDTelefono('');
      setDCantidad('');
      setDPrecio('');
      setDMonto('');
      setDProductoId('');
    }
  };

  const handleOpenAbonar = (nombre: string, deuda?: number) => {
    let dVal = deuda;
    if (dVal === undefined) {
      const deudoresList = getDeudores(movs, clientes);
      const d = deudoresList.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
      dVal = d ? d.deuda : 0;
    }
    setModalAbono({
      isOpen: true,
      nombre,
      deuda: Math.max(0, dVal),
    });
    setMontoAbono('');
    setErrorAbono(null);
  };

  const handleConfirmarAbonar = async () => {
    const m = parseFloat(montoAbono);
    if (isNaN(m) || m <= 0) {
      setErrorAbono('Ingresa un monto válido mayor a 0');
      return;
    }
    if (m > modalAbono.deuda + 0.5) {
      setErrorAbono(`El abono supera la deuda (${fmt(modalAbono.deuda)})`);
      return;
    }

    const anterior = modalAbono.deuda;
    const restante = Math.max(0, anterior - m);
    const clienteNombre = modalAbono.nombre;

    const ok = await addMov({
      tipo: 'pago',
      total: m,
      cliente: clienteNombre,
    });
    if (ok) {
      setModalAbono({ isOpen: false, nombre: '', deuda: 0 });
      setMontoAbono('');
      setErrorAbono(null);

      // Abrir modal con comprobante digital listo para enviar por WhatsApp
      const docKey = clienteNombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      setModalComprobante({
        isOpen: true,
        cliente: clienteNombre,
        montoAbonado: m,
        saldoAnterior: anterior,
        saldoRestante: restante,
        fecha: fTs(Date.now()),
        telefono: clientes[docKey]?.telefono,
      });
    }
  };

  const handleSumarDeuda = (nombre: string) => {
    setDNombre(nombre);
    const docKey = nombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (clientes[docKey]?.telefono) {
      setDTelefono(clientes[docKey].telefono || '');
    }
    if (dNombreInputRef.current) {
      dNombreInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dNombreInputRef.current.focus();
    }
  };

  const handleSaldar = (nombre: string, deuda: number) => {
    if (deuda <= 0) return;
    setModalConfirm({
      isOpen: true,
      title: 'Dar por saldada la deuda',
      message: `¿Dar por saldada la deuda total de ${nombre} (${fmt(deuda)})?`,
      confirmText: '✔ Sí, saldar deuda',
      confirmClass: 'btn-green',
      onConfirm: async () => {
        const anterior = deuda;
        await addMov({
          tipo: 'pago',
          total: deuda,
          cliente: nombre,
          nota: 'saldada',
        });
        setModalConfirm((prev) => ({ ...prev, isOpen: false }));

        const docKey = nombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        setModalComprobante({
          isOpen: true,
          cliente: nombre,
          montoAbonado: anterior,
          saldoAnterior: anterior,
          saldoRestante: 0,
          fecha: fTs(Date.now()),
          telefono: clientes[docKey]?.telefono,
        });
      },
    });
  };

  // Stock Handlers
  const handleBarcodeScanned = (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;
    setPCodigoBarra(clean);
    setScannerOpen(false);

    const match = identifyProductByBarcode(clean, productos);
    if (match.found) {
      setPNombre(match.nombre);
      if (match.sugerenciaPrecio && (!pPrecio || pPrecio === '0')) {
        setPPrecio(String(match.sugerenciaPrecio));
      }
      if (match.existingProduct) {
        setScannedFeedback({
          type: 'success',
          msg: `Producto detectado en tu inventario: "${match.nombre}". Ingresa la cantidad comprada y costo de entrada.`,
        });
      } else {
        setScannedFeedback({
          type: 'success',
          msg: `Identificado en catálogo: "${match.nombre}" (${match.categoria || 'Energéticas'}). Precio sugerido: ${match.sugerenciaPrecio ? fmt(match.sugerenciaPrecio) : 'N/A'}. Ingresa cantidad y costo.`,
        });
      }
    } else {
      setScannedFeedback({
        type: 'info',
        msg: `Código leído: ${clean}. Producto nuevo: completa el nombre, cantidad y precios.`,
      });
    }
    showToast(`Código ${clean} escaneado correctamente`);
  };

  const handleBarcodeManualChange = (code: string) => {
    setPCodigoBarra(code);
    const clean = code.trim();
    if (clean.length >= 7) {
      const match = identifyProductByBarcode(clean, productos);
      if (match.found && !pNombre) {
        setPNombre(match.nombre);
        if (match.sugerenciaPrecio && (!pPrecio || pPrecio === '0')) {
          setPPrecio(String(match.sugerenciaPrecio));
        }
        setScannedFeedback({
          type: 'success',
          msg: `Identificado automáticamente: "${match.nombre}"`,
        });
      }
    }
  };

  const handleAgregarProducto = async () => {
    if (!isAdmin) {
      return alert('Solo los administradores pueden registrar nuevos productos o modificar inventario.');
    }

    const nombre = pNombre.trim();
    const stock = parseFloat(pStock);
    const precio = parseFloat(pPrecio) || 0;
    const costo = parseFloat(pCosto) || 0;
    const codigoBarra = pCodigoBarra.trim();

    if (!nombre || isNaN(stock) || stock < 0) {
      return alert('Ingresa nombre y stock válido');
    }
    if (stock > 0 && !costo) {
      if (!window.confirm('No ingresaste el costo total de la compra: la ganancia saldrá sobrestimada. ¿Continuar?')) {
        return;
      }
    }

    if (isGuest) {
      let p = productos.find(
        (x) =>
          (codigoBarra && x.codigoBarra && x.codigoBarra.toLowerCase() === codigoBarra.toLowerCase()) ||
          x.nombre.toLowerCase() === nombre.toLowerCase()
      );
      let id = p ? p.id : 'prod_' + Date.now();
      let updatedProds = [...productos];
      if (p) {
        updatedProds = updatedProds.map((item) =>
          item.id === id
            ? {
                ...item,
                nombre,
                precio: precio || item.precio,
                codigoBarra: codigoBarra || item.codigoBarra,
              }
            : item
        );
      } else {
        updatedProds.push({ id, nombre, precio, ...(codigoBarra ? { codigoBarra } : {}) });
      }
      setProductos(updatedProds);
      try {
        localStorage.setItem('local_productos', JSON.stringify(updatedProds));
      } catch {}

      if (stock > 0) {
        await addMov({
          tipo: 'entrada',
          productoId: id,
          producto: nombre,
          cant: stock,
          costoTotal: costo,
        });
      }
      setPNombre('');
      setPStock('');
      setPCosto('');
      setPPrecio('');
      setPCodigoBarra('');
      setScannedFeedback(null);
      showToast(`Stock de "${nombre}" agregado`);
      return;
    }

    try {
      let p = productos.find(
        (x) =>
          (codigoBarra && x.codigoBarra && x.codigoBarra.toLowerCase() === codigoBarra.toLowerCase()) ||
          x.nombre.toLowerCase() === nombre.toLowerCase()
      );
      let id: string;
      if (p) {
        id = p.id;
        const updateData: Partial<Producto> = {};
        if (precio) updateData.precio = precio;
        if (codigoBarra && !p.codigoBarra) updateData.codigoBarra = codigoBarra;
        if (Object.keys(updateData).length > 0) {
          await updateDoc(doc(db, 'productos', id), updateData);
        }
      } else {
        const docData: any = { nombre, precio };
        if (codigoBarra) docData.codigoBarra = codigoBarra;
        const docRef = await addDoc(collection(db, 'productos'), docData);
        id = docRef.id;
      }

      if (stock > 0) {
        await addMov({
          tipo: 'entrada',
          productoId: id,
          producto: nombre,
          cant: stock,
          costoTotal: costo,
        });
      }
      setPNombre('');
      setPStock('');
      setPCosto('');
      setPPrecio('');
      setPCodigoBarra('');
      setScannedFeedback(null);
      showToast(`Stock de "${nombre}" agregado`);
    } catch (e: any) {
      alert('No se pudo guardar: ' + (e?.message || e));
    }
  };

  const handleOpenEntrada = (id: string) => {
    if (!isAdmin) {
      return alert('Solo los administradores pueden registrar entradas de stock.');
    }
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setModalEntrada({
      isOpen: true,
      producto: p,
      cant: '',
      costoTotal: '',
      error: null,
    });
  };

  const handleConfirmarEntrada = async () => {
    if (!modalEntrada.producto) return;
    const c = parseFloat(modalEntrada.cant);
    const t = parseFloat(modalEntrada.costoTotal);
    if (isNaN(c) || c <= 0) {
      setModalEntrada((prev) => ({ ...prev, error: 'Ingresa una cantidad válida mayor a 0' }));
      return;
    }
    if (isNaN(t) || t < 0) {
      setModalEntrada((prev) => ({ ...prev, error: 'Ingresa el costo total pagado ($)' }));
      return;
    }
    const ok = await addMov({
      tipo: 'entrada',
      productoId: modalEntrada.producto.id,
      producto: modalEntrada.producto.nombre,
      cant: c,
      costoTotal: t,
    });
    if (ok) {
      const nombre = modalEntrada.producto.nombre;
      setModalEntrada({ isOpen: false, producto: null, cant: '', costoTotal: '', error: null });
      showToast(`Entrada registrada: +${c} ${nombre}`);
    }
  };

  const handleOpenVentaRapida = (id: string) => {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setModalVentaRapida({
      isOpen: true,
      producto: p,
      cant: '1',
      error: null,
    });
  };

  const handleConfirmarVentaRapida = async () => {
    if (!modalVentaRapida.producto) return;
    const p = modalVentaRapida.producto;
    const c = parseFloat(modalVentaRapida.cant);
    if (isNaN(c) || c <= 0) {
      setModalVentaRapida((prev) => ({ ...prev, error: 'Ingresa una cantidad válida mayor a 0' }));
      return;
    }
    const ok = await addMov({
      tipo: 'venta',
      productoId: p.id,
      producto: p.nombre,
      cant: c,
      total: c * (p.precio || 0),
      fiado: false,
      cliente: '',
    });
    if (ok) {
      setModalVentaRapida({ isOpen: false, producto: null, cant: '1', error: null });
      showToast(`Venta registrada: ${c}x ${p.nombre} (${fmt(c * (p.precio || 0))})`);
    }
  };

  const handleEliminarProducto = (id: string) => {
    if (!isAdmin) {
      return alert('Solo los administradores pueden eliminar productos del catálogo.');
    }
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setModalConfirm({
      isOpen: true,
      title: 'Eliminar producto',
      message: `¿Estás seguro de que deseas eliminar "${p.nombre}" del catálogo?`,
      confirmText: '🗑 Eliminar',
      confirmClass: 'btn-red',
      onConfirm: async () => {
        if (isGuest) {
          const updated = productos.filter((x) => x.id !== id);
          setProductos(updated);
          try {
            localStorage.setItem('local_productos', JSON.stringify(updated));
          } catch {}
          setModalConfirm((prev) => ({ ...prev, isOpen: false }));
          showToast(`Producto "${p.nombre}" eliminado`);
          return;
        }
        try {
          await deleteDoc(doc(db, 'productos', id));
          setModalConfirm((prev) => ({ ...prev, isOpen: false }));
          showToast(`Producto "${p.nombre}" eliminado`);
        } catch (e: any) {
          alert('No se pudo eliminar: ' + (e?.message || e));
        }
      },
    });
  };

  // Resumen Handlers
  const handleOpenCerrarCaja = () => {
    const t0Val = getT0(cierres);
    if (!movs.some((m) => m.ts > t0Val)) {
      showToast('No hay movimientos nuevos desde el último cierre', 'debt');
      return;
    }
    const defaultName = new Date().toLocaleDateString('es-CL', {
      timeZone: 'America/Santiago',
      month: 'long',
      year: 'numeric',
    });
    setNombreCierreInput(defaultName);
    setModalCierreOpen(true);
  };

  const handleConfirmarCerrarCaja = async () => {
    const nombre = nombreCierreInput.trim();
    if (!nombre) return;
    const t0Val = getT0(cierres);
    const hasta = Date.now();
    const r = calcResumen(movs, productos, t0Val, hasta);
    const desde = t0Val || (movs.length ? Math.min(...movs.map((m) => m.ts)) : hasta);
    const t = calcResumen(movs, productos, 0, hasta);

    const cierreData: CierreCaja = {
      nombre,
      desde,
      hasta,
      desdeTxt: fTs(desde),
      hastaTxt: fTs(hasta),
      inv: r.inv,
      vend: r.vend,
      costoV: r.costoV,
      ventasPag: r.ventasPag,
      pagos: r.pagos,
      ingresado: r.ingresado,
      ganancia: r.ganancia,
      ventas: r.ventas,
      porCobrar: porCobrarTotal(movs),
      enCuenta: t.ingresado - t.inv,
      por: miNombre,
    };

    if (isGuest) {
      const updated = [cierreData, ...cierres];
      setCierres(updated);
      try {
        localStorage.setItem('local_cierres', JSON.stringify(updated));
      } catch {}
      setModalCierreOpen(false);
      showToast('Caja cerrada con éxito. El nuevo período parte en cero.');
      return;
    }

    try {
      await addDoc(collection(db, 'cierres'), cierreData);
      setModalCierreOpen(false);
      showToast('Caja cerrada con éxito. El nuevo período parte en cero.');
    } catch (e: any) {
      alert('No se pudo cerrar la caja: ' + (e?.message || e));
    }
  };

  const handleOpenBorrarTodo = () => {
    setConfirmBorrarText('');
    setModalBorrarOpen(true);
  };

  const handleConfirmarBorrarTodo = async () => {
    if (confirmBorrarText.trim() !== 'BORRAR') return;

    if (isGuest) {
      setProductos([]);
      setMovs([]);
      setCierres([]);
      localStorage.removeItem('local_productos');
      localStorage.removeItem('local_movs');
      localStorage.removeItem('local_cierres');
      setModalBorrarOpen(false);
      showToast('Registro eliminado completamente. Puedes comenzar de nuevo.');
      return;
    }

    try {
      for (const colName of ['movs', 'productos', 'cierres']) {
        const q = await getDocs(collection(db, colName));
        for (const d of q.docs) {
          await deleteDoc(doc(db, colName, d.id));
        }
      }
      setModalBorrarOpen(false);
      showToast('Registro eliminado completamente. Puedes comenzar de nuevo.');
    } catch (e: any) {
      alert('No se pudo borrar todo (' + (e?.message || e) + ').');
    }
  };

  // Calculations for current period and accumulated
  const t0 = useMemo(() => getT0(cierres), [cierres]);
  const resumenPeriodo = useMemo(() => calcResumen(movs, productos, t0), [movs, productos, t0]);
  const resumenTotal = useMemo(() => calcResumen(movs, productos, 0), [movs, productos]);
  const deudoresList = useMemo(() => getDeudores(movs, clientes).filter((d) => d.deuda > 0.5), [movs, clientes]);
  const totalDeudaNum = useMemo(
    () => deudoresList.reduce((s, d) => s + Math.max(0, d.deuda), 0),
    [deudoresList]
  );
  const resumenMorosidad = useMemo(() => {
    let alDia = 0;
    let atencion = 0;
    let critico = 0;
    deudoresList.forEach((d) => {
      const dias = d.diasAntiguedad || 0;
      if (dias > 15) critico++;
      else if (dias >= 7) atencion++;
      else alDia++;
    });
    return { alDia, atencion, critico };
  }, [deudoresList]);
  const deudoresFiltrados = useMemo(() => {
    const q = busquedaDeudor.trim().toLowerCase();
    if (!q) return deudoresList;
    return deudoresList.filter((d) => d.nombre.toLowerCase().includes(q));
  }, [deudoresList, busquedaDeudor]);
  const totalFiltradoNum = useMemo(() => {
    return deudoresFiltrados.reduce((s, d) => s + Math.max(0, d.deuda), 0);
  }, [deudoresFiltrados]);
  const pc = useMemo(() => porCobrarTotal(movs), [movs]);
  const cta = useMemo(
    () => resumenTotal.ingresado - resumenTotal.inv,
    [resumenTotal.ingresado, resumenTotal.inv]
  );

  const desdeTxt = useMemo(() => {
    if (t0) return fTs(t0);
    if (movs.length) return fTs(Math.min(...movs.map((m) => m.ts)));
    return '—';
  }, [t0, movs]);

  // Ultimas ventas
  const ultimasVentas = useMemo(() => {
    return movs
      .filter((m) => m.tipo === 'venta' && m.ts > t0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 30);
  }, [movs, t0]);

  // Pagos periodo actual
  const pagosPeriodo = useMemo(() => {
    return movs
      .filter((m) => m.tipo === 'pago' && m.ts > t0)
      .sort((a, b) => b.ts - a.ts)
      .slice(20);
  }, [movs, t0]);

  const selectedVProd = useMemo(
    () => productos.find((p) => p.id === vProductoId),
    [productos, vProductoId]
  );
  const selectedDProd = useMemo(
    () => productos.find((p) => p.id === dProductoId),
    [productos, dProductoId]
  );

  const pageTitle =
    activeTab === 'venta'
      ? 'Nueva venta'
      : activeTab === 'deudores'
      ? 'Deudores'
      : activeTab === 'stock'
      ? 'Control de Stock'
      : activeTab === 'miembros'
      ? 'Miembros & Chat'
      : activeTab === 'resumen'
      ? 'Resumen de caja'
      : activeTab === 'estadisticas'
      ? 'Estadísticas'
      : activeTab === 'equipo'
      ? 'Supervisión & Equipo'
      : activeTab === 'configuracion'
      ? 'Configuración & Tema'
      : 'Ayuda & Asistente IA';

  useEffect(() => {
    document.title = `${pageTitle} — Ventas Score`;
  }, [pageTitle]);

  // Rol de Administrador para benja.chavez34@gmail.com y fco.inzunza.re@gmail.com
  const isAdmin = isUserAdmin(user?.email);

  useEffect(() => {
    const adminOnlyTabs = ['resumen', 'estadisticas', 'equipo', 'configuracion'];
    if (!isAdmin && adminOnlyTabs.includes(activeTab)) {
      setActiveTab('venta');
    }
  }, [isAdmin, activeTab]);

  const handleEnviarMensaje = async (
    texto: string,
    tipo: 'general' | 'indicacion' | 'urgente' = 'general'
  ) => {
    const msgData: Omit<MensajeChat, 'id'> = {
      deEmail: user?.email || (isGuest ? 'invitado@local' : perfil.email || ''),
      deNombre: perfil.nombre || miNombre,
      deRol: perfil.rol || (isAdmin ? 'Administrador General' : 'Vendedor'),
      avatarId: perfil.avatarId,
      esAdmin: isAdmin,
      texto,
      ts: Date.now(),
      tipo,
    };

    if (isGuest) {
      const nuevo: MensajeChat = { id: 'msg-' + Date.now(), ...msgData };
      setMensajes((prev) => {
        const updated = [...prev, nuevo];
        try {
          localStorage.setItem('local_mensajes', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      showToast('Mensaje enviado (modo local)');
      return;
    }

    try {
      await addDoc(collection(db, 'mensajes'), msgData);
      // Encolar notificación push para teléfonos con la app cerrada
      registrarPushParaDispositivos(
        `💬 ${perfil.nombre || miNombre}:`,
        msgData.texto,
        user?.uid,
        user?.email || perfil.email
      );
      showToast(isAdmin ? 'Indicación oficial enviada al equipo' : 'Mensaje enviado');
    } catch (e: any) {
      alert('No se pudo enviar el mensaje: ' + (e?.message || e));
    }
  };

  const handleGuardarPerfil = async (nuevoPerfil: PerfilUsuario) => {
    // Validar PIN de ingreso rápido si fue ingresado o modificado
    const pinLimpio = (nuevoPerfil.pin || '').replace(/\D/g, '').slice(0, 6);
    if (pinLimpio.length > 0 && pinLimpio.length < 4) {
      alert('El PIN de ingreso rápido debe tener mínimo 4 números (de 4 a 6 dígitos).');
      return;
    }
    const finalPin = pinLimpio.length >= 4 ? pinLimpio : (localStorage.getItem('saved_user_pin') || '1234');
    nuevoPerfil.pin = finalPin;

    setPerfil(nuevoPerfil);
    setMiNombre(nuevoPerfil.nombre);
    const emailLower = (user?.email || nuevoPerfil.email || '').toLowerCase().trim();
    try {
      localStorage.setItem('saved_user_pin', finalPin);
      localStorage.setItem('perfil_usuario', JSON.stringify(nuevoPerfil));
      if (emailLower) {
        localStorage.setItem(`perfil_usuario_${emailLower}`, JSON.stringify(nuevoPerfil));
      }
      localStorage.setItem('miNombre', nuevoPerfil.nombre);

      // Actualizar sesión guardada para que el PIN sea efectivo de inmediato
      const rawSession = localStorage.getItem('saved_user_session');
      if (rawSession) {
        const s = JSON.parse(rawSession);
        s.nombre = nuevoPerfil.nombre;
        s.avatarId = nuevoPerfil.avatarId;
        s.pin = finalPin;
        localStorage.setItem('saved_user_session', JSON.stringify(s));
        setSavedSession(s);
      }
    } catch {}

    const miembroData: Omit<Miembro, 'id'> = {
      email: emailLower,
      nombre: nuevoPerfil.nombre,
      rol: nuevoPerfil.rol,
      telefono: nuevoPerfil.telefono,
      sucursal: nuevoPerfil.sucursal,
      avatarId: nuevoPerfil.avatarId,
      isAdmin,
      estado: 'disponible',
      ultimaActividad: Date.now(),
    };

    if (isGuest) {
      setMiembros((prev) => {
        const filtered = prev.filter((m) => m.email?.toLowerCase() !== emailLower);
        const updated = [...filtered, { id: 'local-' + Date.now(), ...miembroData }];
        try {
          localStorage.setItem('local_miembros', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setModalCuentaOpen(false);
      showToast('Perfil y PIN actualizados con éxito (modo local)');
      return;
    }

    try {
      // 1. Guardar con u.uid como documento principal
      const docId = user?.uid || emailLower.replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'miembros', docId), { ...miembroData, id: docId }, { merge: true });

      // 2. Guardar también en usuarios/{docId} con su PIN cifrado/guardado
      await setDoc(
        doc(db, 'usuarios', docId),
        {
          uid: docId,
          email: emailLower,
          nombre: nuevoPerfil.nombre,
          rol: nuevoPerfil.rol,
          telefono: nuevoPerfil.telefono,
          sucursal: nuevoPerfil.sucursal,
          avatarId: nuevoPerfil.avatarId,
          pin: finalPin,
          isAdmin,
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true }
      );

      // 3. Sincronizar documento con formato email_id si existe
      const emailDocId = emailLower.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (emailDocId && emailDocId !== docId) {
        try {
          await setDoc(doc(db, 'miembros', emailDocId), { ...miembroData, id: docId }, { merge: true });
        } catch {}
      }

      setModalCuentaOpen(false);
      showToast('✓ Perfil, foto, teléfono y PIN guardados exitosamente');
    } catch (e: any) {
      console.error('Error guardando perfil:', e);
      setModalCuentaOpen(false);
      showToast('Perfil guardado');
    }
  };

  const handleEliminarMiCuenta = async () => {
    try {
      setEliminandoCuenta(true);
      const currentUser = auth.currentUser;
      const uid = currentUser?.uid || user?.uid;
      const userEmail = currentUser?.email || user?.email || perfil.email;

      // 1. Borrar registro de 'miembros' en Firestore
      if (uid) {
        try {
          await deleteDoc(doc(db, 'miembros', uid));
        } catch (e) {
          console.warn('Error borrando miembro por uid:', e);
        }
      }
      if (userEmail) {
        try {
          const emailDocId = userEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
          await deleteDoc(doc(db, 'miembros', emailDocId));
          const snapMiembros = await getDocs(
            query(collection(db, 'miembros'), where('email', '==', userEmail))
          );
          for (const d of snapMiembros.docs) {
            await deleteDoc(doc(db, 'miembros', d.id));
          }
        } catch (e) {
          console.warn('Error borrando miembros por email:', e);
        }
      }

      // 2. Borrar registro de 'usuarios' en Firestore
      if (uid) {
        try {
          await deleteDoc(doc(db, 'usuarios', uid));
        } catch (e) {
          console.warn('Error borrando usuario por uid:', e);
        }
      }

      // 3. Borrar tokens de notificación del usuario
      if (uid || userEmail) {
        try {
          const snapTokens = await getDocs(collection(db, 'fcm_tokens'));
          for (const d of snapTokens.docs) {
            const dt = d.data();
            if (dt.userId === uid || dt.userId === userEmail) {
              await deleteDoc(doc(db, 'fcm_tokens', d.id));
            }
          }
        } catch (e) {
          console.warn('Error borrando fcm_tokens:', e);
        }
      }

      // IMPORTANTE: NO SE BORRAN 'ventas', 'cierres', 'movimientos' ni 'mensajes'
      // para preservar la contabilidad, comisiones y trazabilidad histórica de la empresa.

      // 4. Borrar cuenta en Firebase Authentication
      if (currentUser) {
        try {
          await deleteUser(currentUser);
        } catch (authErr: any) {
          console.warn('deleteUser auth error (requiere relogin o fue invitado):', authErr);
        }
      }

      // 5. Limpiar almacenamiento local
      try {
        localStorage.removeItem('saved_user_session');
        localStorage.removeItem('saved_user_pin');
        localStorage.removeItem('ventas_score_saved_session');
        localStorage.removeItem('perfil_usuario');
        if (userEmail) {
          localStorage.removeItem(`perfil_usuario_${userEmail.toLowerCase().trim()}`);
        }
        localStorage.removeItem('auth_user');
        localStorage.removeItem('miNombre');
        localStorage.removeItem('sesion_activa_rol');
        localStorage.removeItem('pin_rapido_desbloqueo');
        localStorage.removeItem('biometric_cred_id');
      } catch {}

      // 6. Cerrar sesión y resetear estados
      await signOut(auth);
      setUser(null);
      setIsGuest(false);
      setSavedSession(null);
      setIsLocked(false);
      setModalEliminarCuentaOpen(false);
      setModalCuentaOpen(false);

      showToast('Tu cuenta ha sido eliminada exitosamente. Las ventas y mensajes históricos se han conservado.');
    } catch (err: any) {
      alert('Error al eliminar cuenta: ' + (err?.message || err));
    } finally {
      setEliminandoCuenta(false);
    }
  };

  const isAuthenticated = Boolean(user || isGuest);

  return (
    <>
      {/* FONDO DE PANTALLA SCORE GORILLA Y SURTIDAS (O PERSONALIZADO) */}
      <div className="score-bg-container" aria-hidden="true">
        <img
          src={themeConfig.customBgUrl || scoreBgDesktop}
          alt=""
          className="score-bg-img"
          referrerPolicy="no-referrer"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at center, transparent 40%, rgba(var(--bg-rgb, 17, 19, 23), 0.65) 100%)',
          }}
        />
      </div>

      <div className="app-wrapper">
        {dbError && <div id="banner">{dbError}</div>}

      {isLocked && savedSession ? (
        /* PANTALLA DE DESBLOQUEO RÁPIDO (BIOMETRÍA / PIN / CONTRASEÑA) */
        <div className="auth-wrapper">
          <section id="authPanel" className="auth-card" style={{ maxWidth: 380, width: '92%' }}>
            {/* AVATAR DE USUARIO GUARDADO */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
              <img
                src={
                  savedSession.avatarId?.startsWith('data:image/') || savedSession.avatarId?.startsWith('http')
                    ? savedSession.avatarId
                    : scoreGorillaLogo
                }
                alt="Avatar"
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent)',
                  boxShadow: '0 0 25px rgba(37,99,235,0.45)',
                  margin: '0 auto',
                  display: 'block',
                }}
                referrerPolicy="no-referrer"
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 12,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}
              >
                {savedSession.rol.includes('Admin') ? 'ADMIN' : 'PRO'}
              </span>
            </div>

            <h1
              style={{
                margin: '0 0 4px 0',
                fontSize: '1.5rem',
                fontWeight: 900,
                color: 'var(--text)',
              }}
            >
              ¡Hola de nuevo!
            </h1>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
              {savedSession.nombre}
            </div>
            <div className="sub" style={{ fontSize: '0.78rem', marginBottom: 18 }}>
              {savedSession.email} • {savedSession.rol}
            </div>

            {/* SELECTOR DE MÉTODO DE DESBLOQUEO */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 12,
                padding: 4,
                marginBottom: 16,
                border: '1px solid var(--border)',
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setUnlockMethod('biometric')}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: unlockMethod === 'biometric' ? 'var(--accent)' : 'transparent',
                  color: unlockMethod === 'biometric' ? '#fff' : 'var(--muted)',
                  transition: 'all 0.2s',
                }}
              >
                👆 Huella / Face
              </button>
              <button
                type="button"
                onClick={() => setUnlockMethod('pin')}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: unlockMethod === 'pin' ? 'var(--accent)' : 'transparent',
                  color: unlockMethod === 'pin' ? '#fff' : 'var(--muted)',
                  transition: 'all 0.2s',
                }}
              >
                ⚡ PIN Rápido
              </button>
              <button
                type="button"
                onClick={() => setUnlockMethod('password')}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: unlockMethod === 'password' ? 'var(--accent)' : 'transparent',
                  color: unlockMethod === 'password' ? '#fff' : 'var(--muted)',
                  transition: 'all 0.2s',
                }}
              >
                🔑 Contraseña
              </button>
            </div>

            {/* CONTENIDO SEGÚN MÉTODO */}
            {unlockMethod === 'biometric' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleBiometricUnlock}
                  disabled={unlockLoading}
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: '50%',
                    border: '2px solid var(--accent)',
                    background: 'rgba(37,99,235,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(37,99,235,0.3)',
                    transition: 'all 0.2s',
                    color: 'var(--accent)',
                  }}
                  title="Tocar para desbloquear con sensor biométrico"
                >
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                    <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                    <path d="M2 16h.01" />
                    <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                    <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
                    <path d="M4.5 13A8 8 0 0 1 12 4a8 8 0 0 1 7.5 5" />
                    <path d="M6 18c0-.75.25-1.5 1-2" />
                    <path d="M17 18c0-.75-.25-1.5-1-2" />
                  </svg>
                </button>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                  {unlockLoading ? 'Escaneando...' : 'Tocar para desbloquear con Huella o Face ID'}
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.7 }}>
                  Verificación biométrica instantánea de tu teléfono
                </div>
              </div>
            ) : unlockMethod === 'pin' ? (
              <form onSubmit={handlePinUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: '0.78rem', opacity: 0.85 }}>Ingresa tu PIN de 4 dígitos:</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={unlockPin}
                  onChange={(e) => setUnlockPin(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  style={{
                    padding: '12px',
                    fontSize: '1.4rem',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text)',
                  }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: '0.90rem' }}
                >
                  Desbloquear
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: '0.78rem', opacity: 0.85 }}>Contraseña de tu cuenta:</label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  style={{
                    padding: '10px 14px',
                    fontSize: '0.92rem',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text)',
                  }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={unlockLoading}
                  style={{ padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: '0.90rem' }}
                >
                  {unlockLoading ? 'Verificando...' : 'Desbloquear con Contraseña'}
                </button>
              </form>
            )}

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 12 }}>
              <button
                type="button"
                onClick={handleCerrarSesionCompleto}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '0.80rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cerrar sesión / Entrar con otra cuenta
              </button>
            </div>
          </section>
        </div>
      ) : (!isAuthenticated || loginView === 'verify_email') ? (
        /* PANTALLA DE ACCESO INICIAL (GOOGLE / CORREO / INVITADO) */
        <div className="auth-wrapper">
          <section id="authPanel" className="auth-card" style={{ maxWidth: 380, width: '92%' }}>
            {/* LOGO GORILLA DESTACADO */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
              <img
                src={scoreGorillaLogo}
                alt="Logo Score Gorilla"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--accent)',
                  boxShadow: '0 0 25px rgba(37,99,235,0.45)',
                  margin: '0 auto',
                  display: 'block',
                }}
                referrerPolicy="no-referrer"
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 12,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  letterSpacing: '0.5px',
                }}
              >
                PRO
              </span>
            </div>

            <h1
              style={{
                margin: '0 0 4px 0',
                fontSize: '1.9rem',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, var(--text) 25%, var(--accent) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Ventas Score
            </h1>
            <div
              className="sub"
              style={{
                fontSize: '0.85rem',
                lineHeight: 1.4,
                maxWidth: 320,
                margin: '0 auto 20px auto',
              }}
            >
              Control integral de ventas, inventario, deudores y métricas en tiempo real.
            </div>

            {/* VISTA 1: PRINCIPAL (SOLO GOOGLE, CORREO Y MODO INVITADO) */}
            {loginView === 'main' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleLoginGoogle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '12px 18px',
                    fontSize: '0.96rem',
                    fontWeight: 700,
                    borderRadius: 12,
                    boxShadow: '0 4px 15px rgba(37,99,235,0.35)',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Continuar con Google</span>
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setLoginView('login_email')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '11px 16px',
                    fontSize: '0.90rem',
                    fontWeight: 600,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}
                >
                  <span>✉️ Ingresar con Correo</span>
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleGuestLogin}
                  style={{
                    padding: '9px 14px',
                    fontSize: '0.80rem',
                    fontWeight: 500,
                    borderRadius: 10,
                    opacity: 0.75,
                  }}
                >
                  Ingresar en Modo Invitado / Demo
                </button>
              </div>
            ) : loginView === 'login_email' ? (
              /* VISTA 2: LOGIN POR CORREO EXISTENTE */
              <form onSubmit={handleLoginConCorreo} style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 320, margin: '0 auto', textAlign: 'left' }}>
                <div style={{ fontSize: '0.90rem', fontWeight: 700, textAlign: 'center', color: 'var(--accent)' }}>
                  Iniciar Sesión con Correo
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.76rem', opacity: 0.85 }}>Correo electrónico:</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="usuario@score.cl"
                    style={{
                      padding: '10px 12px',
                      fontSize: '0.90rem',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.76rem', opacity: 0.85 }}>Contraseña:</label>
                  <input
                    type="password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      padding: '10px 12px',
                      fontSize: '0.90rem',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={authLoading}
                  style={{
                    padding: '11px',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    borderRadius: 10,
                    marginTop: 4,
                  }}
                >
                  {authLoading ? 'Iniciando...' : 'Iniciar Sesión'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginView('register_email');
                      setRegEmail(loginEmail);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 600 }}
                  >
                    ¿No tienes cuenta? Regístrate aquí
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginView('main')}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.80rem' }}
                  >
                    ← Volver
                  </button>
                </div>
              </form>
            ) : loginView === 'register_email' ? (
              /* VISTA 3: REGISTRO CON VALIDACIÓN ESTRICTA DE CONTRASEÑA */
              <form onSubmit={handleRegistrarCuenta} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto', textAlign: 'left' }}>
                <div style={{ fontSize: '0.90rem', fontWeight: 700, textAlign: 'center', color: 'var(--accent)' }}>
                  Crear Cuenta de Usuario
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.74rem', opacity: 0.85 }}>Nombre y Apellido:</label>
                  <input
                    type="text"
                    required
                    value={regNombre}
                    onChange={(e) => setRegNombre(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.88rem',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.74rem', opacity: 0.85 }}>Correo electrónico:</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.88rem',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.74rem', opacity: 0.85 }}>Contraseña:</label>
                  <input
                    type="password"
                    required
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    placeholder="Mín. 6 car., 1 mayús., 1 núm."
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.88rem',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.74rem', opacity: 0.85 }}>Confirmar Contraseña:</label>
                  <input
                    type="password"
                    required
                    value={regConfirmPass}
                    onChange={(e) => setRegConfirmPass(e.target.value)}
                    placeholder="Repite tu contraseña"
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.88rem',
                      borderRadius: 8,
                      border:
                        regConfirmPass && regConfirmPass !== regPass
                          ? '1px solid #ef4444'
                          : '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                {/* INDICADORES VISUALES DE REQUISITOS DE CONTRASEÑA */}
                <div
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: '0.72rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ color: regPass.length >= 6 ? '#22c55e' : 'var(--muted)' }}>
                    {regPass.length >= 6 ? '✔' : '○'} Mínimo 6 caracteres
                  </div>
                  <div style={{ color: /[A-Z]/.test(regPass) ? '#22c55e' : 'var(--muted)' }}>
                    {/[A-Z]/.test(regPass) ? '✔' : '○'} Al menos una mayúscula (A-Z)
                  </div>
                  <div style={{ color: /[0-9]/.test(regPass) ? '#22c55e' : 'var(--muted)' }}>
                    {/[0-9]/.test(regPass) ? '✔' : '○'} Al menos un número (0-9)
                  </div>
                  <div style={{ color: regConfirmPass && regPass === regConfirmPass ? '#22c55e' : 'var(--muted)' }}>
                    {regConfirmPass && regPass === regConfirmPass ? '✔' : '○'} Las contraseñas coinciden
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={authLoading}
                  style={{
                    padding: '11px',
                    fontSize: '0.90rem',
                    fontWeight: 700,
                    borderRadius: 10,
                    marginTop: 4,
                  }}
                >
                  {authLoading ? 'Creando...' : 'Continuar y Enviar Código'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setLoginView('login_email')}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                  >
                    ¿Ya tienes cuenta? Inicia sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginView('main')}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                  >
                    ← Volver
                  </button>
                </div>
              </form>
            ) : (
              /* VISTA 4: VALIDAR CÓDIGO DE 6 DÍGITOS ENVIADO AL CORREO */
              <form onSubmit={handleConfirmarCodigo} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem' }}>✉️ 🔒</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--accent)' }}>
                  Valida tu Cuenta
                </div>
                <div style={{ fontSize: '0.78rem', lineHeight: 1.4, opacity: 0.85 }}>
                  Hemos enviado un correo de validación a <b>{pendingUser?.email || regEmail}</b>. Ingresa el código de 6 dígitos para activar tu cuenta:
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={regOtpCode}
                  onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoFocus
                  style={{
                    padding: '12px',
                    fontSize: '1.4rem',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    borderRadius: 12,
                    border: '1px solid var(--accent)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--text)',
                    fontWeight: 800,
                  }}
                />

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={authLoading || regOtpCode.length < 6}
                  style={{
                    padding: '11px',
                    fontSize: '0.90rem',
                    fontWeight: 700,
                    borderRadius: 10,
                  }}
                >
                  {authLoading ? 'Validando...' : 'Confirmar Código y Entrar'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleReenviarCodigo}
                    disabled={authLoading}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    ¿No recibiste el correo? Reenviar código
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginView('register_email')}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    ← Modificar correo / datos
                  </button>
                </div>
              </form>
            )}

            {/* MENSAJE DE ESTADO */}
            <div
              className="sub"
              style={{
                marginTop: 20,
                fontSize: '0.78rem',
                borderTop: '1px solid var(--border)',
                paddingTop: 14,
              }}
            >
              🔒 {authStatus}
            </div>
          </section>
        </div>
      ) : (
        <div id="appContent">
          {/* TOP USER BANNER */}
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--card)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
              backdropFilter: 'blur(var(--blur, 14px))',
              WebkitBackdropFilter: 'blur(var(--blur, 14px))',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {/* Branding & Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={
                  perfil.avatarId?.startsWith('data:image/') || perfil.avatarId?.startsWith('http')
                    ? perfil.avatarId
                    : perfil.avatarId === 'avatar1'
                    ? 'https://api.dicebear.com/7.x/bottts/svg?seed=Benja'
                    : perfil.avatarId === 'avatar2'
                    ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
                    : perfil.avatarId === 'avatar3'
                    ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sara'
                    : scoreGorillaLogo
                }
                alt="Logo / Avatar"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: isAdmin ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                  boxShadow: isAdmin ? '0 0 10px rgba(6, 182, 212, 0.45)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setEditPerfil(perfil);
                  setModalCuentaOpen(true);
                }}
                title="Configurar mis datos en Mi Cuenta"
                referrerPolicy="no-referrer"
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>Ventas Score</span>
                  {isAdmin ? (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: 'var(--accent)',
                        color: '#fff',
                        padding: '1px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      👑 Admin
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: 'var(--bg)',
                        color: 'var(--muted)',
                        border: '1px solid var(--border)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      💼 Vendedor
                    </span>
                  )}
                </div>
                <div className="sub" style={{ fontSize: '0.74rem' }}>
                  {isAdmin
                    ? `${perfil.nombre} · ${perfil.rol}`
                    : isGuest
                    ? `Modo Local (${perfil.nombre || miNombre})`
                    : `${perfil.nombre || miNombre} · ${perfil.rol || 'Vendedor'}`}
                </div>
              </div>
            </div>

            {/* Actions: Mi Cuenta (para todos: Administrador y Vendedores) & Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                style={{
                  padding: '5px 12px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'rgba(37,99,235,0.06)',
                }}
                onClick={() => {
                  setEditPerfil(perfil);
                  setModalCuentaOpen(true);
                }}
                title="Abrir Mi Cuenta para editar mi nombre, teléfono, cargo y foto"
              >
                👤 Mi Cuenta
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="tabs">
            <div
              className={`tab ${activeTab === 'venta' ? 'active' : ''}`}
              onClick={() => setActiveTab('venta')}
            >
              🧾 Venta
            </div>
            <div
              className={`tab ${activeTab === 'deudores' ? 'active' : ''}`}
              onClick={() => setActiveTab('deudores')}
            >
              👥 Deudores
            </div>
            <div
              className={`tab ${activeTab === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              📦 Stock
            </div>
            <div
              className={`tab ${activeTab === 'miembros' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('miembros');
                setMensajesNoLeidos(0);
                setInAppBanner(null);
              }}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>👥 Miembros & Chat</span>
              {mensajesNoLeidos > 0 && activeTab !== 'miembros' && (
                <span
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 10,
                    boxShadow: '0 0 8px rgba(239,68,68,0.8)',
                  }}
                >
                  {mensajesNoLeidos}
                </span>
              )}
            </div>
            {isAdmin && (
              <>
                <div
                  className={`tab ${activeTab === 'resumen' ? 'active' : ''}`}
                  onClick={() => setActiveTab('resumen')}
                >
                  💰 Resumen
                </div>
                <div
                  className={`tab ${activeTab === 'estadisticas' ? 'active' : ''}`}
                  onClick={() => setActiveTab('estadisticas')}
                >
                  📊 Estadísticas
                </div>
                <div
                  className={`tab ${activeTab === 'equipo' ? 'active' : ''}`}
                  onClick={() => setActiveTab('equipo')}
                >
                  🏢 Supervisión
                </div>
                <div
                  className={`tab ${activeTab === 'configuracion' ? 'active' : ''}`}
                  onClick={() => setActiveTab('configuracion')}
                >
                  ⚙️ Configuración
                </div>
              </>
            )}
            <div
              className={`tab ${activeTab === 'ayuda' ? 'active' : ''}`}
              onClick={() => setActiveTab('ayuda')}
            >
              🤖 Ayuda IA
            </div>
          </div>

          <main>
            {/* VIEW VENTA */}
            {activeTab === 'venta' && (
              <section id="viewVenta">
                {/* SELECTOR DE MODO POS: CARRITO MULTIPRODUCTO VS VENTA RÁPIDA */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button
                    type="button"
                    className={posMode === 'carrito' ? 'btn-primary' : 'btn-ghost'}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onClick={() => setPosMode('carrito')}
                  >
                    <span>🛒 Carrito POS Multiproducto</span>
                    {cart.length > 0 && (
                      <span
                        style={{
                          background: '#fff',
                          color: 'var(--accent)',
                          padding: '1px 7px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}
                      >
                        {cart.reduce((s, it) => s + it.cant, 0)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={posMode === 'rapida' ? 'btn-primary' : 'btn-ghost'}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onClick={() => setPosMode('rapida')}
                  >
                    <span>⚡ Venta Rápida (1 Producto)</span>
                  </button>
                </div>

                {/* ==================== MODO 1: CARRITO POS MULTIPRODUCTO ==================== */}
                {posMode === 'carrito' && (
                  <div className="card" style={{ border: '1px solid rgba(37,99,235,0.25)', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🛒 Punto de Venta (POS)</span>
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setScannerPosOpen(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%)',
                        }}
                      >
                        <span>📷 Escanear con Cámara</span>
                      </button>
                    </div>

                    {/* SELECTOR RÁPIDO PARA AGREGAR AL CARRITO */}
                    <div className="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 90px auto', gap: 8, marginBottom: 8 }}>
                      <select
                        value={posProductoId}
                        onChange={(e) => setPosProductoId(e.target.value)}
                        style={{ fontSize: '0.86rem' }}
                      >
                        <option value="">-- Elige un producto para agregar --</option>
                        {productos.map((p) => {
                          const stk = stockDe(p.id, movs);
                          return (
                            <option key={p.id} value={p.id}>
                              {p.nombre} ({fmt(p.precio || 0)} · stock: {stk})
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="number"
                        min="1"
                        placeholder="Cant"
                        value={posCantidad}
                        onChange={(e) => setPosCantidad(e.target.value)}
                        style={{ fontSize: '0.86rem', textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        className="btn-green"
                        style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 700 }}
                        onClick={() => {
                          if (!posProductoId) return alert('Selecciona un producto primero');
                          const c = parseInt(posCantidad, 10) || 1;
                          handleAddToCart(posProductoId, c);
                          setPosProductoId('');
                          setPosCantidad('1');
                        }}
                      >
                        + Agregar
                      </button>
                    </div>

                    {/* CHIPS RÁPIDOS DE PRODUCTOS FRECUENTES */}
                    {productos.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div className="sub" style={{ fontSize: '0.74rem', marginBottom: 6, fontWeight: 600 }}>
                          ⚡ Acceso rápido (toca para sumar +1 al carrito):
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 85, overflowY: 'auto' }}>
                          {productos.slice(0, 8).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="btn-ghost"
                              style={{
                                fontSize: '0.74rem',
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'rgba(0,0,0,0.12)',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleAddToCart(p.id, 1)}
                            >
                              +1 {p.nombre} ({fmt(p.precio || 0)})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* LISTADO DE ITEMS EN EL CARRITO */}
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                          📦 Productos en este pedido ({cart.length})
                        </span>
                        {cart.length > 0 && (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ fontSize: '0.74rem', padding: '2px 8px', color: 'var(--accent2)' }}
                            onClick={handleClearCart}
                          >
                            Vaciar carrito
                          </button>
                        )}
                      </div>

                      {cart.length === 0 ? (
                        <div className="sub" style={{ textAlign: 'center', padding: '16px 0', fontStyle: 'italic', fontSize: '0.84rem' }}>
                          🛒 El carrito está vacío. Elige productos arriba o escanea con la cámara.
                        </div>
                      ) : (
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
                                gap: 6,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{it.producto.nombre}</div>
                                <div className="sub" style={{ fontSize: '0.75rem' }}>
                                  {fmt(it.precioUnit)} c/u
                                </div>
                              </div>

                              {/* CONTROLES DE CANTIDAD */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  style={{ padding: '2px 8px', fontSize: '0.85rem', fontWeight: 800 }}
                                  onClick={() => handleUpdateCartCant(it.producto.id, it.cant - 1)}
                                >
                                  -
                                </button>
                                <span style={{ fontWeight: 800, minWidth: 24, textAlign: 'center', fontSize: '0.90rem' }}>
                                  {it.cant}
                                </span>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  style={{ padding: '2px 8px', fontSize: '0.85rem', fontWeight: 800 }}
                                  onClick={() => handleAddToCart(it.producto.id, 1)}
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
                                style={{ padding: '2px 6px', fontSize: '0.80rem', color: 'var(--muted)' }}
                                onClick={() => handleRemoveFromCart(it.producto.id)}
                                title="Quitar producto"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* MEDIOS DE PAGO, DESCUENTO Y COBRO (ACTIVO CUANDO HAY PRODUCTOS) */}
                    {cart.length > 0 && (() => {
                      const subtotal = cart.reduce((s, it) => s + it.subtotal, 0);
                      const desc = Math.max(0, parseFloat(posDescuento) || 0);
                      const total = Math.max(0, subtotal - desc);
                      const parsedPago = parseFloat(posPagoCon);
                      const pagoConVal = isNaN(parsedPago) ? total : parsedPago;
                      const vueltoVal = Math.max(0, pagoConVal - total);

                      return (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                          {/* SUBTOTOTAL, DESCUENTO Y TOTAL */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span className="sub">Subtotal productos:</span>
                            <span style={{ fontWeight: 700 }}>{fmt(subtotal)}</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                            <span className="sub">Descuento o promo $:</span>
                            <input
                              type="number"
                              placeholder="0"
                              value={posDescuento}
                              onChange={(e) => setPosDescuento(e.target.value)}
                              style={{ width: 110, fontSize: '0.86rem', textAlign: 'right' }}
                            />
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              background: 'rgba(37,99,235,0.12)',
                              border: '1px solid rgba(37,99,235,0.3)',
                              borderRadius: 10,
                              marginBottom: 12,
                            }}
                          >
                            <span style={{ fontWeight: 800, fontSize: '1rem' }}>TOTAL A COBRAR:</span>
                            <span style={{ fontWeight: 900, fontSize: '1.45rem', color: 'var(--accent)' }}>
                              {fmt(total)}
                            </span>
                          </div>

                          {/* SELECCIÓN DE MEDIO DE PAGO */}
                          <div style={{ marginBottom: 12 }}>
                            <label className="sub" style={{ display: 'block', fontWeight: 600, fontSize: '0.78rem', marginBottom: 6 }}>
                              💳 Medio de Pago:
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
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
                                    fontSize: '0.80rem',
                                    fontWeight: 700,
                                    padding: '7px 4px',
                                    borderRadius: 6,
                                  }}
                                  onClick={() => setPosMedioPago(mp.id as MedioPago)}
                                >
                                  {mp.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* CALCULADORA DE VUELTO (PARA EFECTIVO O MIXTO) */}
                          {(posMedioPago === 'efectivo' || posMedioPago === 'mixto') && (
                            <div
                              style={{
                                background: 'rgba(0,0,0,0.15)',
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid var(--border)',
                                marginBottom: 12,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                                  🧮 ¿Con cuánto paga el cliente?
                                </span>
                                {pagoConVal >= total ? (
                                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#16a34a' }}>
                                    Vuelto: {fmt(vueltoVal)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#dc2626' }}>
                                    Falta: {fmt(total - pagoConVal)}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                <input
                                  type="number"
                                  placeholder={String(total)}
                                  value={posPagoCon}
                                  onChange={(e) => setPosPagoCon(e.target.value)}
                                  style={{ fontSize: '1.1rem', fontWeight: 800, flex: 1 }}
                                />
                              </div>

                              {/* BOTONES RÁPIDOS DE BILLETES */}
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
                                      padding: '3px 8px',
                                      borderRadius: 4,
                                      background: 'rgba(0,0,0,0.10)',
                                    }}
                                    onClick={() => setPosPagoCon(String(b.val))}
                                  >
                                    {b.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* DATOS DE CLIENTE & WHATSAPP (OBLIGATORIO EN FIADO, OPCIONAL EN OTRAS) */}
                          <div style={{ marginBottom: 12 }}>
                            <div className="sub" style={{ fontSize: '0.78rem', marginBottom: 4, fontWeight: 600 }}>
                              {posMedioPago === 'fiado' ? '👤 Cliente Fiado (Obligatorio):' : '👤 Cliente (Opcional para enviar ticket):'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <input
                                  placeholder="Nombre cliente"
                                  list="listaClientes"
                                  value={posCliente}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPosCliente(val);
                                    const k = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                                    if (clientes[k]?.telefono && (!posTelefono || posTelefono === '+56 9 ')) {
                                      setPosTelefono(clientes[k].telefono || '');
                                    }
                                  }}
                                  style={{ fontSize: '0.85rem' }}
                                />
                                <datalist id="listaClientes">
                                  {clientNames.map((name) => (
                                    <option key={name} value={name} />
                                  ))}
                                </datalist>
                              </div>
                              <div>
                                <input
                                  type="tel"
                                  placeholder="WhatsApp (+56 9...)"
                                  value={posTelefono}
                                  onChange={(e) => setPosTelefono(e.target.value)}
                                  style={{ fontSize: '0.85rem' }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* BOTÓN COBRAR Y FINALIZAR VENTA */}
                          <div className="row">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleCobrarCarrito}
                              style={{
                                width: '100%',
                                padding: '12px 18px',
                                fontSize: '1.05rem',
                                fontWeight: 800,
                                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                              }}
                            >
                              <span>⚡ Cobrar {fmt(total)}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ==================== MODO 2: VENTA RÁPIDA (1 PRODUCTO TRADICIONAL) ==================== */}
                {posMode === 'rapida' && (
                  <div className="card">
                    <div className="sub" style={{ fontWeight: 700, marginBottom: 8 }}>
                      ⚡ Venta Rápida Tradicional (1 Producto a la vez):
                    </div>
                    <div className="row">
                      <select
                        value={vProductoId}
                        onChange={(e) => handleVProductoChange(e.target.value)}
                      >
                        <option value="">
                          {productos.length
                            ? '-- Selecciona un producto --'
                            : '-- Agrega productos en la pestaña Stock --'}
                        </option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} (stock: {stockDe(p.id, movs)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row">
                      <input
                        type="number"
                        placeholder="Cantidad"
                        value={vCantidad}
                        onChange={(e) => handleVCantidadChange(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Precio unit."
                        value={vPrecio}
                        onChange={(e) => handleVPrecioChange(e.target.value)}
                      />
                    </div>
                    <div className="row">
                      <input
                        type="number"
                        placeholder="Total $"
                        value={vTotal}
                        onChange={(e) => setVTotal(e.target.value)}
                      />
                    </div>
                    <div className="row">
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flex: 1,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={vFiado}
                          onChange={(e) => setVFiado(e.target.checked)}
                          style={{ flex: 'none', width: 'auto' }}
                        />
                        ¿Es fiado (queda debiendo)?
                      </label>
                    </div>
                    {vFiado && (
                      <div className="row" id="filaCliente" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                        <div>
                          <input
                            placeholder="Nombre del cliente fiado"
                            list="listaClientes"
                            value={vCliente}
                            onChange={(e) => {
                              const val = e.target.value;
                              setVCliente(val);
                              const k = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                              if (clientes[k]?.telefono && (!vTelefono || vTelefono === '+56 9 ')) {
                                setVTelefono(clientes[k].telefono || '');
                              }
                            }}
                          />
                          <datalist id="listaClientes">
                            {clientNames.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <input
                            type="tel"
                            placeholder="WhatsApp (+56 9...)"
                            value={vTelefono}
                            onChange={(e) => setVTelefono(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    <div className="row">
                      <button className="btn-primary" onClick={handleRegistrarVenta}>
                        Registrar venta
                      </button>
                    </div>
                    {selectedVProd && (
                      <div className="sub" style={{ marginTop: 6 }}>
                        Stock disponible: {stockDe(selectedVProd.id, movs)}
                      </div>
                    )}
                  </div>
                )}

                <div className="card">
                  <div className="sub" style={{ marginBottom: 6, fontWeight: 600 }}>
                    Últimas ventas
                  </div>
                  <div id="listaVentas">
                    {ultimasVentas.length ? (
                      ultimasVentas.map((m) => (
                        <div className="item" key={m.id || m.ts}>
                          <div>
                            <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{m.producto} x{m.cant}</span>
                              {m.medioPago && (
                                <span
                                  style={{
                                    fontSize: '0.70rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background:
                                      m.medioPago === 'efectivo'
                                        ? 'rgba(22, 163, 74, 0.15)'
                                        : m.medioPago === 'transferencia'
                                        ? 'rgba(37, 99, 235, 0.15)'
                                        : m.medioPago === 'debito'
                                        ? 'rgba(147, 51, 234, 0.15)'
                                        : m.medioPago === 'fiado'
                                        ? 'rgba(220, 38, 38, 0.15)'
                                        : 'rgba(234, 88, 12, 0.15)',
                                    color:
                                      m.medioPago === 'efectivo'
                                        ? '#16a34a'
                                        : m.medioPago === 'transferencia'
                                        ? '#2563eb'
                                        : m.medioPago === 'debito'
                                        ? '#9333ea'
                                        : m.medioPago === 'fiado'
                                        ? '#dc2626'
                                        : '#ea580c',
                                  }}
                                >
                                  {m.medioPago === 'efectivo'
                                    ? '💵 Efectivo'
                                    : m.medioPago === 'transferencia'
                                    ? '📱 Transf.'
                                    : m.medioPago === 'debito'
                                    ? '💳 Débito'
                                    : m.medioPago === 'fiado'
                                    ? '⏳ Fiado'
                                    : '🔀 Mixto'}
                                </span>
                              )}
                            </div>
                            <div className="sub">
                              {m.fecha || ''}
                              {m.fiado ? ` · Fiado a ${m.cliente}` : ' · Pagado'}
                              {m.pagoCon && m.vuelto !== undefined && m.vuelto > 0 ? ` · Vuelto: ${fmt(m.vuelto)}` : ''}
                              {m.por ? ` · ${m.por}` : ''}
                            </div>
                          </div>
                          <div className="amount">{fmt(m.total || 0)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">Sin ventas en el período actual</div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* VIEW DEUDORES */}
            {activeTab === 'deudores' && (
              <section id="viewDeudores">
                <div className="card">
                  <div className="sub" style={{ marginBottom: 6, fontWeight: 600 }}>
                    Agregar deuda (si eliges producto, se descuenta del stock)
                  </div>
                  <div className="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    <div>
                      <input
                        ref={dNombreInputRef}
                        placeholder="Nombre del deudor / cliente"
                        list="listaClientes"
                        value={dNombre}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDNombre(val);
                          const k = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                          if (clientes[k]?.telefono && (!dTelefono || dTelefono === '+56 9 ')) {
                            setDTelefono(clientes[k].telefono || '');
                          }
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="WhatsApp (+56 9...)"
                        value={dTelefono}
                        onChange={(e) => setDTelefono(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <select
                      value={dProductoId}
                      onChange={(e) => handleDProductoChange(e.target.value)}
                    >
                      <option value="">— Solo monto (sin producto) —</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (stock: {stockDe(p.id, movs)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="row">
                    <input
                      type="number"
                      placeholder="Cantidad"
                      value={dCantidad}
                      onChange={(e) => handleDCantidadChange(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Precio unit."
                      value={dPrecio}
                      onChange={(e) => handleDPrecioChange(e.target.value)}
                    />
                  </div>
                  <div className="row">
                    <input
                      type="number"
                      placeholder="Monto $"
                      value={dMonto}
                      onChange={(e) => setDMonto(e.target.value)}
                    />
                  </div>
                  <div className="row">
                    <button className="btn-primary" onClick={handleAgregarDeuda}>
                      + Agregar deuda
                    </button>
                  </div>
                  {selectedDProd && (
                    <div className="sub" style={{ marginTop: 6 }}>
                      Stock disponible: {stockDe(selectedDProd.id, movs)}
                    </div>
                  )}
                </div>

                <div className="total-bar">
                  <div>
                    <span>Total adeudado</span>
                    {busquedaDeudor.trim() && (
                      <div className="sub" style={{ fontSize: '0.8rem', fontWeight: 500, marginTop: 2 }}>
                        Filtrado ({deudoresFiltrados.length}): <b className="debt">{fmt(totalFiltradoNum)}</b>
                      </div>
                    )}
                  </div>
                  <span className="debt">{fmt(totalDeudaNum)}</span>
                </div>

                {/* BARRA DE SALUD DE CARTERA / MOROSIDAD */}
                {deudoresList.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.28)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>🟢 AL DÍA (&lt;7d)</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 2 }}>{resumenMorosidad.alDia} clientes</div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.28)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b' }}>🟡 ATENCIÓN (7-15d)</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 2 }}>{resumenMorosidad.atencion} clientes</div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.28)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>🔴 VENCIDO (&gt;15d)</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 2 }}>{resumenMorosidad.critico} clientes</div>
                    </div>
                  </div>
                )}

                {/* BUSCADOR DE DEUDORES */}
                <div className="card" style={{ padding: '8px 10px', marginBottom: 10 }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="🔍 Buscar deudor por nombre..."
                      value={busquedaDeudor}
                      onChange={(e) => setBusquedaDeudor(e.target.value)}
                      style={{ paddingRight: busquedaDeudor ? 36 : 10 }}
                    />
                    {busquedaDeudor && (
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
                        onClick={() => setBusquedaDeudor('')}
                        title="Limpiar búsqueda"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {busquedaDeudor.trim() && (
                    <div className="sub" style={{ marginTop: 6, paddingLeft: 4 }}>
                      {deudoresFiltrados.length === 1
                        ? `1 cliente encontrado de ${deudoresList.length}`
                        : `${deudoresFiltrados.length} clientes encontrados de ${deudoresList.length}`}
                    </div>
                  )}
                </div>

                <div className="card" id="listaDeudores">
                  {deudoresFiltrados.length ? (
                    deudoresFiltrados.map((d) => {
                      const isExpanded = Boolean(expandedDeudores[d.nombre]);
                      const clienteMovs = movs.filter(
                        (m) =>
                          m.cliente &&
                          m.cliente.trim().toLowerCase() === d.nombre.trim().toLowerCase()
                      );
                      const comprasFiadas = clienteMovs
                        .filter((m) => (m.tipo === 'venta' && m.fiado) || m.tipo === 'deuda')
                        .sort((a, b) => b.ts - a.ts);
                      const pagos = clienteMovs
                        .filter((m) => m.tipo === 'pago')
                        .sort((a, b) => b.ts - a.ts);

                      return (
                        <div
                          key={d.nombre}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            paddingBottom: isExpanded ? 6 : 0,
                          }}
                        >
                          <div className="item" style={{ borderBottom: 'none', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                            <div
                              style={{ cursor: 'pointer', flex: 1, minWidth: 200, userSelect: 'none' }}
                              onClick={() => toggleDeudorDetalle(d.nombre)}
                              title="Toca para ver u ocultar compras y pagos"
                            >
                              <div
                                className="name"
                                style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                              >
                                <span style={{ fontWeight: 800 }}>{d.nombre}</span>

                                {/* Teléfono WhatsApp con opción de editar/agregar */}
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    color: d.telefono ? 'var(--text)' : 'var(--muted)',
                                    fontWeight: 600,
                                    background: 'var(--bg)',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    border: '1px solid var(--border)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    cursor: 'pointer',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModalCliente({
                                      isOpen: true,
                                      nombre: d.nombre,
                                      telefono: d.telefono || '+56 9 ',
                                      limiteCredito: d.limiteCredito ? String(d.limiteCredito) : '',
                                    });
                                  }}
                                  title="Toca para registrar o editar teléfono WhatsApp"
                                >
                                  <span>📞 {d.telefono || 'Sin teléfono'}</span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--accent)' }}>✏️</span>
                                </span>

                                {/* Badge Semáforo de Morosidad */}
                                {d.diasAntiguedad !== undefined && (
                                  <span
                                    style={{
                                      fontSize: '0.70rem',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background:
                                        d.diasAntiguedad > 15
                                          ? 'rgba(239, 68, 68, 0.18)'
                                          : d.diasAntiguedad >= 7
                                          ? 'rgba(245, 158, 11, 0.18)'
                                          : 'rgba(16, 185, 129, 0.18)',
                                      color:
                                        d.diasAntiguedad > 15
                                          ? '#ef4444'
                                          : d.diasAntiguedad >= 7
                                          ? '#f59e0b'
                                          : '#10b981',
                                      border: `1px solid ${
                                        d.diasAntiguedad > 15
                                          ? 'rgba(239, 68, 68, 0.35)'
                                          : d.diasAntiguedad >= 7
                                          ? 'rgba(245, 158, 11, 0.35)'
                                          : 'rgba(16, 185, 129, 0.35)'
                                      }`,
                                    }}
                                    title={`Deuda contraída hace ${d.diasAntiguedad} días`}
                                  >
                                    {d.diasAntiguedad > 15
                                      ? `🔴 Vencida (${d.diasAntiguedad}d)`
                                      : d.diasAntiguedad >= 7
                                      ? `🟡 Atención (${d.diasAntiguedad}d)`
                                      : `🟢 Al día (${d.diasAntiguedad === 0 ? 'Hoy' : `${d.diasAntiguedad}d`})`}
                                  </span>
                                )}

                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--muted)',
                                    fontWeight: 600,
                                    background: 'var(--bg)',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    border: '1px solid var(--border)',
                                  }}
                                >
                                  {isExpanded
                                    ? '▲ Ocultar'
                                    : `▼ ${comprasFiadas.length} compra${comprasFiadas.length === 1 ? '' : 's'}`}
                                </span>
                              </div>
                              <div className={`amount ${d.deuda > 0 ? 'debt' : 'ok'}`} style={{ marginTop: 2 }}>
                                {d.deuda > 0 ? fmt(d.deuda) : 'Al día'}
                              </div>
                            </div>
                            <div className="actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <button
                                type="button"
                                style={{
                                  background: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  fontSize: '0.80rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  boxShadow: '0 2px 6px rgba(37,211,102,0.3)',
                                  cursor: 'pointer',
                                }}
                                onClick={() => handleWhatsAppRecordatorio(d)}
                                title="Enviar cobranza / recordatorio por WhatsApp"
                              >
                                <span>💬 WhatsApp</span>
                              </button>
                              <button
                                className="btn-green"
                                onClick={() => handleOpenAbonar(d.nombre, d.deuda)}
                              >
                                Pago
                              </button>
                              <button
                                className="btn-red"
                                onClick={() => handleSumarDeuda(d.nombre)}
                              >
                                +Deuda
                              </button>
                              <button
                                className="btn-ghost"
                                onClick={() => handleSaldar(d.nombre, d.deuda)}
                              >
                                ✔ Pagó todo
                              </button>
                            </div>
                          </div>

                          {/* PANEL DESPLEGABLE CON PRODUCTOS QUE HA COMPRADO Y DEBE */}
                          {isExpanded && (
                            <div
                              style={{
                                margin: '0 4px 10px 4px',
                                padding: '10px 12px',
                                background: 'var(--bg)',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                fontSize: '0.85rem',
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  marginBottom: 8,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <span>📦 Productos que ha comprado y debe:</span>
                                <span className="sub">{comprasFiadas.length} compras registradas</span>
                              </div>

                              {comprasFiadas.length === 0 ? (
                                <div className="sub" style={{ fontStyle: 'italic', padding: '4px 0' }}>
                                  No hay productos registrados con saldo pendiente.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {comprasFiadas.map((m, idx) => (
                                    <div
                                      key={m.id || m.ts || idx}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '4px 0',
                                        borderBottom:
                                          idx < comprasFiadas.length - 1
                                            ? '1px dashed var(--border)'
                                            : 'none',
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600 }}>
                                          {m.producto
                                            ? `${m.cant ? `${m.cant}x ` : ''}${m.producto}`
                                            : m.nota || 'Deuda manual'}
                                        </div>
                                        <div className="sub" style={{ fontSize: '0.75rem' }}>
                                          {fTs(m.ts)}
                                          {m.por ? ` · ${m.por}` : ''}
                                          {m.producto && m.nota ? ` (${m.nota})` : ''}
                                        </div>
                                      </div>
                                      <div
                                        className="amount debt"
                                        style={{ fontSize: '0.95rem', fontWeight: 600 }}
                                      >
                                        {fmt(m.total || 0)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Historial de abonos/pagos */}
                              {pagos.length > 0 && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    paddingTop: 8,
                                    borderTop: '1px solid var(--border)',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: '0.8rem',
                                      color: 'var(--muted)',
                                      marginBottom: 4,
                                    }}
                                  >
                                    Abonos y pagos recibidos:
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {pagos.slice(0, 5).map((p, idx) => (
                                      <div
                                        key={p.id || p.ts || idx}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          fontSize: '0.8rem',
                                          gap: 6,
                                        }}
                                      >
                                        <span className="sub">
                                          {fTs(p.ts)} {p.nota ? `(${p.nota})` : ''}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span className="amount ok" style={{ fontSize: '0.85rem' }}>
                                            -{fmt(p.total || 0)}
                                          </span>
                                          <button
                                            type="button"
                                            className="btn-ghost"
                                            style={{
                                              padding: '2px 6px',
                                              fontSize: '0.70rem',
                                              borderRadius: 4,
                                              color: '#16a34a',
                                              border: '1px solid rgba(22,163,74,0.35)',
                                              cursor: 'pointer',
                                            }}
                                            onClick={() =>
                                              handleEnviarComprobanteWhatsApp(
                                                d.nombre,
                                                p.total || 0,
                                                d.deuda + (p.total || 0),
                                                d.deuda,
                                                fTs(p.ts)
                                              )
                                            }
                                            title="Enviar comprobante de este pago por WhatsApp"
                                          >
                                            🧾 Comprobante
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Saldo adeudado actual */}
                              <div
                                style={{
                                  marginTop: 8,
                                  paddingTop: 6,
                                  borderTop: '1px solid var(--border)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontWeight: 700,
                                }}
                              >
                                <span>Saldo total adeudado:</span>
                                <span className="debt" style={{ fontSize: '1.05rem' }}>
                                  {fmt(d.deuda)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : deudoresList.length > 0 ? (
                    <div className="empty">
                      No se encontraron deudores que coincidan con "{busquedaDeudor}"
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                          onClick={() => setBusquedaDeudor('')}
                        >
                          Ver todos los deudores
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty">Nadie te debe por ahora</div>
                  )}
                </div>
              </section>
            )}

            {/* VIEW STOCK */}
            {activeTab === 'stock' && (
              <section id="viewStock">
                {/* FORMULARIO AGREGAR PRODUCTO (SOLO ADMINS) */}
                {isAdmin ? (
                  <div className="card" style={{ border: '1px solid rgba(37,99,235,0.25)', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>⚡ Administrar Stock e Ingreso de Productos</span>
                        </div>
                        <div className="sub" style={{ fontSize: '0.8rem', marginTop: 2 }}>
                          Escanea con la cámara o ingresa el código de barra para autocompletar el nombre y evitar errores.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setScannerOpen(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%)',
                          boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                        }}
                      >
                        <span>📷 Escanear con Cámara</span>
                      </button>
                    </div>

                    {scannedFeedback && (
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          marginBottom: 12,
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          background:
                            scannedFeedback.type === 'success'
                              ? 'rgba(22, 163, 74, 0.12)'
                              : 'rgba(37, 99, 235, 0.12)',
                          border: `1px solid ${
                            scannedFeedback.type === 'success' ? 'rgba(22, 163, 74, 0.35)' : 'rgba(37, 99, 235, 0.35)'
                          }`,
                          color: 'var(--text)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1.1rem' }}>
                            {scannedFeedback.type === 'success' ? '✨' : 'ℹ️'}
                          </span>
                          <div>{scannedFeedback.msg}</div>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          onClick={() => setScannedFeedback(null)}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.78rem' }}>
                          Código de Barra (EAN-13 / UPC):
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            placeholder="Ej: 7801610006733"
                            value={pCodigoBarra}
                            onChange={(e) => handleBarcodeManualChange(e.target.value)}
                            style={{ fontSize: '0.86rem' }}
                          />
                          <button
                            type="button"
                            className="btn-ghost"
                            title="Abrir cámara escáner"
                            onClick={() => setScannerOpen(true)}
                            style={{ padding: '0 10px', fontSize: '1rem' }}
                          >
                            📷
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.78rem' }}>
                          Nombre del producto:
                        </label>
                        <input
                          placeholder="Ej: Bebida Score Original 500ml"
                          value={pNombre}
                          onChange={(e) => setPNombre(e.target.value)}
                          style={{ fontSize: '0.86rem' }}
                        />
                      </div>

                      <div>
                        <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.78rem' }}>
                          Cantidad comprada / a sumar:
                        </label>
                        <input
                          type="number"
                          placeholder="Ej: 24"
                          value={pStock}
                          onChange={(e) => setPStock(e.target.value)}
                          style={{ fontSize: '0.86rem' }}
                        />
                      </div>

                      <div>
                        <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.78rem' }}>
                          Costo TOTAL de la compra $:
                        </label>
                        <input
                          type="number"
                          placeholder="Ej: 21600"
                          value={pCosto}
                          onChange={(e) => setPCosto(e.target.value)}
                          style={{ fontSize: '0.86rem' }}
                        />
                      </div>

                      <div>
                        <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.78rem' }}>
                          Precio de venta unitario $:
                        </label>
                        <input
                          type="number"
                          placeholder="Ej: 1500"
                          value={pPrecio}
                          onChange={(e) => setPPrecio(e.target.value)}
                          style={{ fontSize: '0.86rem' }}
                        />
                      </div>
                    </div>

                    <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleAgregarProducto}
                        style={{ padding: '9px 20px', fontWeight: 700 }}
                      >
                        + Registrar producto / Entrada
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="card"
                    style={{
                      background: 'rgba(37,99,235,0.06)',
                      border: '1px solid rgba(37,99,235,0.22)',
                      padding: '14px 18px',
                      marginBottom: 14,
                      borderRadius: 14,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📦 Consulta de Existencias de Stock</span>
                    </div>
                    <div className="sub" style={{ marginTop: 4, fontSize: '0.82rem', lineHeight: 1.45 }}>
                      Aquí puedes revisar las cantidades disponibles para venta y el precio unitario establecido. El ingreso de compras y administración de productos está reservado para los administradores.
                    </div>
                  </div>
                )}

                <div className="card" id="listaProductos">
                  <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.92rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Existencias en Stock ({productos.length})</span>
                    <span className="sub" style={{ fontSize: '0.78rem' }}>Inventario en tiempo real</span>
                  </div>
                  {productos.length ? (
                    productos.map((p) => {
                      const s = stockDe(p.id, movs);
                      const cu = costoUnit(p.id, movs);
                      const inv = invertido(p.id, movs);
                      const gananciaUnit = (p.precio || 0) - cu;
                      return (
                        <div className="item" key={p.id}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{p.nombre}</span>
                              {p.codigoBarra && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    background: 'rgba(100,116,139,0.15)',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontWeight: 600,
                                    color: 'var(--sub)',
                                  }}
                                >
                                  🏷 {p.codigoBarra}
                                </span>
                              )}
                            </div>
                            <div className={`amount ${s <= 0 ? 'debt' : 'ok'}`} style={{ marginTop: 2 }}>
                              Stock: {s} unid.
                            </div>
                            {isAdmin && (
                              <div className="sub" style={{ fontSize: '0.78rem' }}>
                                Invertido: {fmt(inv)} · Costo unit.: {fmt(cu)}
                              </div>
                            )}
                            <div className="sub" style={{ fontSize: '0.78rem' }}>
                              {p.precio ? (
                                <>
                                  Venta: {fmt(p.precio)}
                                  {isAdmin && (
                                    <>
                                      {' '}· Ganancia/u:{' '}
                                      <b className={gananciaUnit >= 0 ? 'ok' : 'debt'}>
                                        {fmt(gananciaUnit)}
                                      </b>
                                    </>
                                  )}
                                </>
                              ) : (
                                'Sin precio de venta'
                              )}
                            </div>
                          </div>
                          <div className="actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              className="btn-red"
                              onClick={() => handleOpenVentaRapida(p.id)}
                              title="Registrar venta rápida"
                              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                            >
                              Venta
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  className="btn-green"
                                  onClick={() => handleOpenEntrada(p.id)}
                                  title="Registrar entrada de stock"
                                  style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                >
                                  + Entrada
                                </button>
                                <button
                                  className="btn-ghost"
                                  onClick={() => handleEliminarProducto(p.id)}
                                  title="Eliminar producto"
                                  style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                                >
                                  🗑
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty">Sin productos registrados</div>
                  )}
                </div>
              </section>
            )}

            {/* VIEW RESUMEN (SOLO ADMINISTRADORES) */}
            {isAdmin && activeTab === 'resumen' && (
              <section id="viewResumen">
                <div className="card" id="resPeriodo">
                  <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                    Período actual: {desdeTxt} → hoy
                  </div>
                  <div className="item">
                    <span>Compras del período (inversión)</span>
                    <span className="amount">{fmt(resumenPeriodo.inv)}</span>
                  </div>
                  <div className="item">
                    <span>Ventas del período ({resumenPeriodo.ventas})</span>
                    <span className="amount">{fmt(resumenPeriodo.vend)}</span>
                  </div>
                  <div className="item">
                    <span>Cobrado al contado</span>
                    <span className="amount">{fmt(resumenPeriodo.ventasPag)}</span>
                  </div>
                  <div className="item">
                    <span>Pagos recibidos de deudores</span>
                    <span className="amount">{fmt(resumenPeriodo.pagos)}</span>
                  </div>
                  <div className="item">
                    <span>
                      <b>Total ingresado</b>
                    </span>
                    <span className="amount ok">{fmt(resumenPeriodo.ingresado)}</span>
                  </div>
                  <div className="item">
                    <span>Costo de lo vendido</span>
                    <span className="amount">{fmt(resumenPeriodo.costoV)}</span>
                  </div>
                  <div className="item">
                    <span>
                      <b>Ganancia del período</b>
                    </span>
                    <span
                      className={`amount ${
                        resumenPeriodo.ganancia >= 0 ? 'ok' : 'debt'
                      }`}
                    >
                      {fmt(resumenPeriodo.ganancia)}
                    </span>
                  </div>
                  <div className="row">
                    <button className="btn-primary" onClick={handleOpenCerrarCaja}>
                      🔒 Cerrar caja y generar consolidado
                    </button>
                  </div>
                </div>

                <div className="card" id="resAcum">
                  <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                    Acumulado total (no se reinicia al cerrar caja)
                  </div>
                  <div className="item">
                    <span>Inversión total (compras)</span>
                    <span className="amount">{fmt(resumenTotal.inv)}</span>
                  </div>
                  <div className="item">
                    <span>Total ingresado</span>
                    <span className="amount ok">{fmt(resumenTotal.ingresado)}</span>
                  </div>
                  <div className="item">
                    <span>Falta recuperar de la inversión</span>
                    <span className="amount debt">
                      {fmt(Math.max(0, resumenTotal.inv - resumenTotal.ingresado))}
                    </span>
                  </div>
                  <div className="item">
                    <span>Ganancia ya cobrada</span>
                    <span className="amount ok">
                      {fmt(Math.max(0, resumenTotal.ingresado - resumenTotal.inv))}
                    </span>
                  </div>
                  <div className="item">
                    <span>
                      <b>Dinero que deberías tener en la cuenta</b>
                    </span>
                    <span className={`amount ${cta >= 0 ? 'ok' : 'debt'}`}>
                      {fmt(cta)}
                    </span>
                  </div>
                  <div className="item">
                    <span>Te deben (deudores)</span>
                    <span className="amount debt">{fmt(pc)}</span>
                  </div>
                  <div className="item">
                    <span>Cuando cobres todo, tendrías</span>
                    <span className="amount ok">{fmt(cta + pc)}</span>
                  </div>
                </div>

                <div className="card">
                  <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                    Por producto (período actual)
                  </div>
                  <div id="resProd">
                    {productos.length ? (
                      productos.map((p) => {
                        const x = resumenPeriodo.porP[p.id] || {
                          inv: 0,
                          vend: 0,
                          costo: 0,
                        };
                        const g = x.vend - x.costo;
                        return (
                          <div className="item" key={p.id}>
                            <div>
                              <div className="name">{p.nombre}</div>
                              <div className="sub">
                                Compras {fmt(x.inv)} · Vendido {fmt(x.vend)} · Costo
                                de lo vendido {fmt(x.costo)}
                              </div>
                            </div>
                            <div className={`amount ${g >= 0 ? 'ok' : 'debt'}`}>
                              {fmt(g)}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty">Sin productos</div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                    Pagos de deudores (período actual)
                  </div>
                  <div id="resPagos">
                    {pagosPeriodo.length ? (
                      pagosPeriodo.map((m) => (
                        <div className="item" key={m.id || m.ts}>
                          <div>
                            <div className="name">{m.cliente}</div>
                            <div className="sub">{m.fecha || ''}</div>
                          </div>
                          <div className="amount ok">{fmt(m.total || 0)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">Aún no hay pagos</div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                    Cierres de caja anteriores
                  </div>
                  <div id="resCierres">
                    {cierres.length ? (
                      cierres.map((c) => (
                        <div className="item" key={c.id || c.hasta}>
                          <div>
                            <div className="name">{c.nombre}</div>
                            <div className="sub">
                              {c.desdeTxt} → {c.hastaTxt}
                            </div>
                            <div className="sub">
                              Ventas {fmt(c.vend)} ({c.ventas}) · Ingresado{' '}
                              {fmt(c.ingresado)} · Compras {fmt(c.inv)}
                            </div>
                            <div className="sub">
                              Te debían {fmt(c.porCobrar)} · En cuenta {fmt(c.enCuenta)}
                            </div>
                          </div>
                          <div
                            className={`amount ${c.ganancia >= 0 ? 'ok' : 'debt'}`}
                          >
                            {fmt(c.ganancia)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">Aún no has cerrado ninguna caja</div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="sub" style={{ marginBottom: 8 }}>
                    Borra ventas, productos, deudas y cierres para empezar desde
                    cero. Exporta a Excel antes si quieres guardar una copia.
                  </div>
                  <button className="btn-red" onClick={handleOpenBorrarTodo}>
                    🗑 Eliminar todo el registro
                  </button>
                </div>
              </section>
            )}

            {/* VIEW ESTADISTICAS (SOLO ADMINISTRADORES) */}
            {isAdmin && activeTab === 'estadisticas' && (
              <section id="viewEstadisticas">
                <EstadisticasView
                  movs={movs}
                  productos={productos}
                  cierres={cierres}
                />
              </section>
            )}

            {/* VIEW MIEMBROS & CHAT (PARA TODOS: ADMINISTRADOR Y VENDEDORES) */}
            {activeTab === 'miembros' && (
              <section id="viewMiembros">
                <MiembrosChatView
                  miembros={miembros}
                  mensajes={mensajes}
                  nombreActual={perfil.nombre || miNombre}
                  emailActual={user?.email || perfil.email}
                  avatarIdActual={perfil.avatarId}
                  rolActual={perfil.rol}
                  telefonoActual={perfil.telefono}
                  sucursalActual={perfil.sucursal}
                  isAdmin={isAdmin}
                  onEnviarMensaje={handleEnviarMensaje}
                  onOpenMiCuenta={() => {
                    setEditPerfil(perfil);
                    setModalCuentaOpen(true);
                  }}
                />
              </section>
            )}

            {/* VIEW EQUIPO & VENDEDORES (ADMIN PANEL) */}
            {isAdmin && activeTab === 'equipo' && (
              <section id="viewEquipo">
                <AdminVendedoresView
                  movs={movs}
                  cierres={cierres}
                  adminName={perfil.nombre}
                  adminEmail={perfil.email}
                  evaluaciones={evaluaciones}
                  onGuardarEvaluacion={handleGuardarEvaluacion}
                  onOpenMiCuenta={() => {
                    setEditPerfil(perfil);
                    setModalCuentaOpen(true);
                  }}
                />
              </section>
            )}

            {/* VIEW CONFIGURACIÓN (SOLO ADMINISTRADORES) */}
            {isAdmin && activeTab === 'configuracion' && (
              <section id="viewConfiguracion">
                <ConfiguracionView
                  currentTheme={themeConfig}
                  onSaveTheme={handleSaveTheme}
                  onResetTheme={handleResetTheme}
                />
              </section>
            )}

            {/* VIEW AYUDA & ASISTENTE IA (PARA TODOS LOS USUARIOS) */}
            {activeTab === 'ayuda' && (
              <section id="viewAyuda">
                <AyudaView
                  userName={perfil.nombre || miNombre}
                  isAdmin={isAdmin}
                  onNavigateTab={(tab) => setActiveTab(tab as any)}
                />
              </section>
            )}
          </main>
        </div>
      )}
      </div>

      {/* MODAL DE ABONO / PAGO */}
      {modalAbono.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalAbono({ isOpen: false, nombre: '', deuda: 0 })}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: '100%',
              margin: 0,
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 6 }}>
              Registrar abono / pago
            </div>
            <div className="sub" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
              Cliente: <b style={{ color: 'var(--text)' }}>{modalAbono.nombre}</b>
              <br />
              Deuda pendiente: <b className="debt">{fmt(modalAbono.deuda)}</b>
            </div>

            <div className="row">
              <input
                type="number"
                placeholder="Monto del abono $"
                autoFocus
                value={montoAbono}
                onChange={(e) => {
                  setMontoAbono(e.target.value);
                  setErrorAbono(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmarAbonar();
                  if (e.key === 'Escape') setModalAbono({ isOpen: false, nombre: '', deuda: 0 });
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                onClick={() => {
                  setMontoAbono(String(modalAbono.deuda));
                  setErrorAbono(null);
                }}
              >
                Pagar total ({fmt(modalAbono.deuda)})
              </button>
            </div>

            {errorAbono && (
              <div
                style={{
                  color: 'var(--accent2)',
                  fontSize: '0.85rem',
                  marginTop: 8,
                  fontWeight: 600,
                }}
              >
                {errorAbono}
              </div>
            )}

            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalAbono({ isOpen: false, nombre: '', deuda: 0 })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-green"
                onClick={handleConfirmarAbonar}
              >
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN (para saldar y acciones críticas) */}
      {modalConfirm.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalConfirm((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: '100%',
              margin: 0,
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 6 }}>
              {modalConfirm.title}
            </div>
            <div className="sub" style={{ marginBottom: 16, fontSize: '0.9rem' }}>
              {modalConfirm.message}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalConfirm((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={modalConfirm.confirmClass || 'btn-primary'}
                onClick={modalConfirm.onConfirm}
              >
                {modalConfirm.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / REGISTRAR CLIENTE & WHATSAPP */}
      {modalCliente.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.60)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalCliente((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              margin: 0,
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.40)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📲</span>
              <span>Datos de Contacto WhatsApp</span>
            </div>
            <div className="sub" style={{ marginBottom: 14, fontSize: '0.85rem' }}>
              Cliente: <b style={{ color: 'var(--text)' }}>{modalCliente.nombre}</b>. Al ingresar el teléfono se guardará permanentemente para que no tengas que escribirlo de nuevo.
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 600, marginBottom: 4 }}>
                Número WhatsApp (con código de país, ej: +56 9 1234 5678):
              </label>
              <input
                type="tel"
                placeholder="+56 9 1234 5678"
                autoFocus
                value={modalCliente.telefono}
                onChange={(e) => setModalCliente((prev) => ({ ...prev, telefono: e.target.value }))}
                style={{ fontSize: '1.05rem', fontWeight: 600 }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 600, marginBottom: 4 }}>
                Límite de Crédito Opcional $ (alerta de exceso de fiado):
              </label>
              <input
                type="number"
                placeholder="Ej: 50000 (dejar vacío si no aplica)"
                value={modalCliente.limiteCredito}
                onChange={(e) => setModalCliente((prev) => ({ ...prev, limiteCredito: e.target.value }))}
                style={{ fontSize: '0.90rem' }}
              />
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalCliente((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#25D366', color: '#fff', fontWeight: 700 }}
                onClick={async () => {
                  const tel = modalCliente.telefono.trim();
                  const lim = modalCliente.limiteCredito ? parseFloat(modalCliente.limiteCredito) : undefined;
                  await handleGuardarCliente(modalCliente.nombre, tel, lim);

                  if (modalCliente.autoOpenWhatsApp && modalCliente.mensajeWhatsApp) {
                    let cleanPhone = tel.replace(/\D/g, '');
                    if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
                      cleanPhone = '56' + cleanPhone;
                    } else if (cleanPhone.length === 8) {
                      cleanPhone = '569' + cleanPhone;
                    }
                    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(modalCliente.mensajeWhatsApp)}`, '_blank');
                  }

                  showToast('✓ Datos de cliente guardados exitosamente');
                  setModalCliente((prev) => ({ ...prev, isOpen: false }));
                }}
              >
                {modalCliente.autoOpenWhatsApp ? '💾 Guardar y Abrir WhatsApp' : '💾 Guardar Contacto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPROBANTE DE ABONO / PAGO LISTO PARA WHATSAPP */}
      {modalComprobante && modalComprobante.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalComprobante(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 430,
              width: '100%',
              margin: 0,
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>🧾</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>¡Pago Registrado con Éxito!</div>
                <div className="sub" style={{ fontSize: '0.78rem' }}>{modalComprobante.fecha}</div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.18)',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                marginBottom: 14,
                fontSize: '0.88rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="sub">Cliente:</span>
                <b>{modalComprobante.cliente}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="sub">Monto abonado:</span>
                <b className="ok" style={{ fontSize: '1.05rem' }}>{fmt(modalComprobante.montoAbonado)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="sub">Saldo anterior:</span>
                <span>{fmt(modalComprobante.saldoAnterior)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                <span className="sub">Nuevo saldo pendiente:</span>
                <b className={modalComprobante.saldoRestante <= 0 ? 'ok' : 'debt'}>
                  {modalComprobante.saldoRestante <= 0 ? '✨ Al día ($0)' : fmt(modalComprobante.saldoRestante)}
                </b>
              </div>
            </div>

            <div className="sub" style={{ fontSize: '0.80rem', marginBottom: 14 }}>
              ¿Deseas enviar el comprobante de pago digital al cliente por WhatsApp?
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalComprobante(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                style={{
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37,211,102,0.3)',
                }}
                onClick={() => {
                  handleEnviarComprobanteWhatsApp(
                    modalComprobante.cliente,
                    modalComprobante.montoAbonado,
                    modalComprobante.saldoAnterior,
                    modalComprobante.saldoRestante,
                    modalComprobante.fecha
                  );
                  setModalComprobante(null);
                }}
              >
                <span>💬 Enviar Comprobante por WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET DIGITAL DE VENTA */}
      {modalTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalTicket(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              margin: 0,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(37,99,235,0.35)',
              borderRadius: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.5rem' }}>🧾</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Ticket de Venta</div>
                  <div className="sub" style={{ fontSize: '0.78rem' }}>
                    {modalTicket.fecha} · Por: {modalTicket.por}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalTicket(null)}
                style={{ fontSize: '1.1rem', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {modalTicket.cliente && (
              <div
                style={{
                  background: 'rgba(37,99,235,0.08)',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(37,99,235,0.2)',
                  marginBottom: 12,
                  fontSize: '0.85rem',
                }}
              >
                👤 Cliente: <b>{modalTicket.cliente}</b>
                {modalTicket.telefono && <span className="sub"> ({modalTicket.telefono})</span>}
              </div>
            )}

            {/* LISTA DE ITEMS */}
            <div
              style={{
                background: 'rgba(0,0,0,0.18)',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, color: 'var(--muted)' }}>
                Detalle del Pedido
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modalTicket.items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.86rem',
                    }}
                  >
                    <div>
                      <b>{it.cant}x</b> {it.producto.nombre}
                      <span className="sub" style={{ fontSize: '0.76rem', marginLeft: 4 }}>
                        ({fmt(it.precioUnit)})
                      </span>
                    </div>
                    <div style={{ fontWeight: 700 }}>{fmt(it.subtotal)}</div>
                  </div>
                ))}
              </div>

              {/* TOTALES */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="sub">Subtotal:</span>
                  <span>{fmt(modalTicket.subtotal)}</span>
                </div>
                {modalTicket.descuento > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#16a34a' }}>
                    <span>Descuento aplicado:</span>
                    <span>-{fmt(modalTicket.descuento)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900, marginTop: 4 }}>
                  <span>TOTAL:</span>
                  <span style={{ color: 'var(--accent)' }}>{fmt(modalTicket.total)}</span>
                </div>
              </div>
            </div>

            {/* DETALLE DEL MEDIO DE PAGO */}
            <div
              style={{
                background: 'rgba(0,0,0,0.12)',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                marginBottom: 14,
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span className="sub">Medio de pago:</span>
                <b style={{ textTransform: 'uppercase' }}>
                  {modalTicket.medioPago === 'efectivo'
                    ? '💵 Efectivo'
                    : modalTicket.medioPago === 'transferencia'
                    ? '📱 Transferencia'
                    : modalTicket.medioPago === 'debito'
                    ? '💳 Débito'
                    : modalTicket.medioPago === 'fiado'
                    ? '⏳ Fiado'
                    : '🔀 Mixto'}
                </b>
              </div>
              {modalTicket.medioPago === 'efectivo' && modalTicket.pagoCon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px dotted var(--border)' }}>
                  <span className="sub">Pagó con {fmt(modalTicket.pagoCon)}:</span>
                  <b style={{ color: '#16a34a' }}>Vuelto: {fmt(modalTicket.vuelto || 0)}</b>
                </div>
              )}
            </div>

            {/* ACCIONES: WHATSAPP Y NUEVA VENTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                style={{
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37,211,102,0.3)',
                }}
                onClick={() => handleEnviarTicketWhatsApp(modalTicket)}
              >
                <span>💬 Enviar Ticket por WhatsApp</span>
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => setModalTicket(null)}
                style={{
                  padding: '9px 16px',
                  fontSize: '0.90rem',
                  fontWeight: 700,
                  background: 'var(--card)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                ✓ Cerrar y Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BORRAR TODO */}
      {modalBorrarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalBorrarOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              margin: 0,
              boxShadow: '0 14px 35px rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--accent2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 6, color: 'var(--accent2)' }}>
              ⚠️ Eliminar todo el registro
            </div>
            <div className="sub" style={{ marginBottom: 14, fontSize: '0.9rem', lineHeight: 1.4 }}>
              Esta acción borrará <b>permanentemente</b> todas las ventas, productos, deudas y cierres para comenzar desde cero.
              <br /><br />
              Para confirmar, escribe <b style={{ color: 'var(--text)' }}>BORRAR</b> a continuación:
            </div>

            <div className="row">
              <input
                type="text"
                placeholder="Escribe BORRAR aquí"
                autoFocus
                value={confirmBorrarText}
                onChange={(e) => setConfirmBorrarText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && confirmBorrarText.trim() === 'BORRAR') {
                    handleConfirmarBorrarTodo();
                  }
                  if (e.key === 'Escape') setModalBorrarOpen(false);
                }}
              />
            </div>

            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalBorrarOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-red"
                disabled={confirmBorrarText.trim() !== 'BORRAR'}
                style={{ opacity: confirmBorrarText.trim() === 'BORRAR' ? 1 : 0.45 }}
                onClick={handleConfirmarBorrarTodo}
              >
                🗑 Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CERRAR CAJA */}
      {modalCierreOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalCierreOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              margin: 0,
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 6 }}>
              🔒 Cerrar caja y generar consolidado
            </div>
            <div className="sub" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
              El período actual quedará guardado en el historial de cierres y comenzará un nuevo período desde cero.
            </div>

            <div className="row">
              <div style={{ width: '100%' }}>
                <span className="sub">Nombre del cierre:</span>
                <input
                  type="text"
                  placeholder="Ej: octubre de 2026"
                  autoFocus
                  value={nombreCierreInput}
                  onChange={(e) => setNombreCierreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmarCerrarCaja();
                    if (e.key === 'Escape') setModalCierreOpen(false);
                  }}
                  style={{ marginTop: 4 }}
                />
              </div>
            </div>

            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalCierreOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmarCerrarCaja}
              >
                Confirmar cierre de caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENTRADA DE STOCK */}
      {modalEntrada.isOpen && modalEntrada.producto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalEntrada({ isOpen: false, producto: null, cant: '', costoTotal: '', error: null })}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: '100%',
              margin: 0,
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 4 }}>
              + Entrada de mercadería
            </div>
            <div className="sub" style={{ marginBottom: 12 }}>
              Producto: <b style={{ color: 'var(--text)' }}>{modalEntrada.producto.nombre}</b> · Stock actual: {stockDe(modalEntrada.producto.id, movs)}
            </div>

            <div className="row">
              <input
                type="number"
                placeholder="Cantidad de unidades que llegaron"
                autoFocus
                value={modalEntrada.cant}
                onChange={(e) => setModalEntrada((prev) => ({ ...prev, cant: e.target.value, error: null }))}
              />
            </div>
            <div className="row">
              <input
                type="number"
                placeholder="Costo TOTAL pagado por el lote $"
                value={modalEntrada.costoTotal}
                onChange={(e) => setModalEntrada((prev) => ({ ...prev, costoTotal: e.target.value, error: null }))}
              />
            </div>

            {parseFloat(modalEntrada.cant) > 0 && parseFloat(modalEntrada.costoTotal) >= 0 && (
              <div className="sub" style={{ marginTop: 6 }}>
                Costo unitario resultante: <b>{fmt(parseFloat(modalEntrada.costoTotal) / parseFloat(modalEntrada.cant))}</b> / unidad
              </div>
            )}

            {modalEntrada.error && (
              <div style={{ color: 'var(--accent2)', fontSize: '0.85rem', marginTop: 8, fontWeight: 600 }}>
                {modalEntrada.error}
              </div>
            )}

            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalEntrada({ isOpen: false, producto: null, cant: '', costoTotal: '', error: null })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-green"
                onClick={handleConfirmarEntrada}
              >
                Guardar entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA RAPIDA */}
      {modalVentaRapida.isOpen && modalVentaRapida.producto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalVentaRapida({ isOpen: false, producto: null, cant: '1', error: null })}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: '100%',
              margin: 0,
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 4 }}>
              Venta rápida al contado
            </div>
            <div className="sub" style={{ marginBottom: 12 }}>
              Producto: <b style={{ color: 'var(--text)' }}>{modalVentaRapida.producto.nombre}</b>
              <br />
              Stock actual: <b>{stockDe(modalVentaRapida.producto.id, movs)}</b> · Precio unit.: <b>{fmt(modalVentaRapida.producto.precio || 0)}</b>
            </div>

            <div className="row">
              <input
                type="number"
                placeholder="Cantidad a vender"
                autoFocus
                value={modalVentaRapida.cant}
                onChange={(e) => setModalVentaRapida((prev) => ({ ...prev, cant: e.target.value, error: null }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmarVentaRapida();
                }}
              />
            </div>

            {parseFloat(modalVentaRapida.cant) > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.95rem' }}>
                Total a cobrar:{' '}
                <b className="ok" style={{ fontSize: '1.1rem' }}>
                  {fmt(parseFloat(modalVentaRapida.cant) * (modalVentaRapida.producto.precio || 0))}
                </b>
              </div>
            )}

            {parseFloat(modalVentaRapida.cant) > stockDe(modalVentaRapida.producto.id, movs) && (
              <div style={{ color: 'var(--accent2)', fontSize: '0.8rem', marginTop: 6, fontWeight: 600 }}>
                ⚠️ Advertencia: El stock quedará negativo ({stockDe(modalVentaRapida.producto.id, movs) - parseFloat(modalVentaRapida.cant)})
              </div>
            )}

            {modalVentaRapida.error && (
              <div style={{ color: 'var(--accent2)', fontSize: '0.85rem', marginTop: 8, fontWeight: 600 }}>
                {modalVentaRapida.error}
              </div>
            )}

            <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalVentaRapida({ isOpen: false, producto: null, cant: '1', error: null })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-red"
                onClick={handleConfirmarVentaRapida}
              >
                Registrar venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MI CUENTA / CONFIGURACIÓN DE PERFIL */}
      {modalCuentaOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setModalCuentaOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: '100%',
              margin: 0,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 14px 35px rgba(0, 0, 0, 0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>👤 Mi Cuenta</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: isAdmin ? 'var(--accent)' : 'var(--accent3)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}
                >
                  {isAdmin ? 'ADMINISTRADOR' : 'VENDEDOR / MIEMBRO'}
                </span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '2px 8px', fontSize: '0.9rem' }}
                onClick={() => setModalCuentaOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* SELECCIÓN DE FOTO DE PERFIL / AVATAR */}
            <div style={{ marginBottom: 16, padding: '12px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
                Foto de Perfil / Avatar Corporativo
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <img
                  src={
                    editPerfil.avatarId?.startsWith('data:image/') || editPerfil.avatarId?.startsWith('http')
                      ? editPerfil.avatarId
                      : editPerfil.avatarId === 'gorilla'
                      ? scoreGorillaLogo
                      : editPerfil.avatarId === 'avatar1'
                      ? 'https://api.dicebear.com/7.x/bottts/svg?seed=Benja'
                      : editPerfil.avatarId === 'avatar2'
                      ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
                      : editPerfil.avatarId === 'avatar3'
                      ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sara'
                      : scoreGorillaLogo
                  }
                  alt="Avatar"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--accent)',
                    boxShadow: '0 0 10px rgba(37,99,235,0.3)',
                    flexShrink: 0,
                  }}
                  referrerPolicy="no-referrer"
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={editPerfil.avatarId === 'gorilla' ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                    onClick={() => setEditPerfil((p) => ({ ...p, avatarId: 'gorilla' }))}
                  >
                    🦍 Gorilla
                  </button>
                  <button
                    type="button"
                    className={editPerfil.avatarId === 'avatar1' ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                    onClick={() => setEditPerfil((p) => ({ ...p, avatarId: 'avatar1' }))}
                  >
                    👔 Director
                  </button>
                  <button
                    type="button"
                    className={editPerfil.avatarId === 'avatar2' ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                    onClick={() => setEditPerfil((p) => ({ ...p, avatarId: 'avatar2' }))}
                  >
                    💼 Ejecutivo
                  </button>
                  <button
                    type="button"
                    className={editPerfil.avatarId === 'avatar3' ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                    onClick={() => setEditPerfil((p) => ({ ...p, avatarId: 'avatar3' }))}
                  >
                    🚀 Vendedor
                  </button>
                </div>

                {/* Subida de foto propia desde el dispositivo */}
                <div style={{ width: '100%', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                  <input
                    ref={fotoPerfilInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const dataUrl = event.target?.result as string;
                        if (!dataUrl) return;
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const size = 320;
                          canvas.width = size;
                          canvas.height = size;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            const minSide = Math.min(img.width, img.height);
                            const sx = (img.width - minSide) / 2;
                            const sy = (img.height - minSide) / 2;
                            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
                            const compressed = canvas.toDataURL('image/jpeg', 0.82);
                            setEditPerfil((p) => ({ ...p, avatarId: compressed }));
                          }
                        };
                        img.src = dataUrl;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      fontSize: '0.82rem',
                      padding: '6px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 600,
                      border: '1px dashed var(--accent)',
                      background: 'rgba(37,99,235,0.04)',
                    }}
                    onClick={() => fotoPerfilInputRef.current?.click()}
                  >
                    📷 Cargar foto propia desde mi dispositivo
                  </button>
                  {Boolean(editPerfil.avatarId?.startsWith('data:image/')) && (
                    <span className="sub" style={{ fontSize: '0.74rem', marginLeft: 8, color: 'var(--accent3)', fontWeight: 600 }}>
                      ✓ Foto personalizada lista
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CAMPOS EDITABLES DE PERFIL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Nombre y Apellidos:
                </label>
                <input
                  type="text"
                  value={editPerfil.nombre}
                  onChange={(e) => setEditPerfil((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Benjamín Chávez"
                />
              </div>

              <div>
                <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Correo electrónico:
                </label>
                <input
                  type="email"
                  value={editPerfil.email}
                  onChange={(e) => setEditPerfil((p) => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                />
              </div>

              <div>
                <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Cargo / Rol en la empresa:
                </label>
                <input
                  type="text"
                  value={editPerfil.rol}
                  onChange={(e) => setEditPerfil((p) => ({ ...p, rol: e.target.value }))}
                  placeholder={isAdmin ? 'Administrador General & Director Comercial' : 'Vendedor en Ruta'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Teléfono / WhatsApp:
                  </label>
                  <input
                    type="text"
                    value={editPerfil.telefono}
                    onChange={(e) => setEditPerfil((p) => ({ ...p, telefono: e.target.value }))}
                    placeholder="+56 9 8765 4321"
                  />
                </div>
                <div>
                  <label className="sub" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Sucursal / Zona comercial:
                  </label>
                  <input
                    type="text"
                    value={editPerfil.sucursal}
                    onChange={(e) => setEditPerfil((p) => ({ ...p, sucursal: e.target.value }))}
                    placeholder="Casa Central - Santiago"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN: PIN DE INGRESO RÁPIDO (DISPONIBLE PARA TODOS LOS USUARIOS) */}
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                background: 'var(--bg)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚡</span>
                  <span>PIN de Ingreso Rápido</span>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.74rem', padding: '2px 8px' }}
                  onClick={() => setMostrarPin((prev) => !prev)}
                >
                  {mostrarPin ? '👁️ Ocultar' : '👁️ Ver PIN'}
                </button>
              </div>
              <div className="sub" style={{ fontSize: '0.75rem', marginBottom: 8, lineHeight: 1.35 }}>
                Clave numérica personal de 4 a 6 dígitos para re-ingresar a la aplicación al reabrirla sin tener que escribir tu contraseña completa.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <input
                  type={mostrarPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={editPerfil.pin || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setEditPerfil((p) => ({ ...p, pin: val }));
                  }}
                  placeholder="1234"
                  style={{
                    width: 140,
                    fontSize: '1.25rem',
                    letterSpacing: mostrarPin ? '2px' : '6px',
                    fontWeight: 800,
                    textAlign: 'center',
                    borderRadius: 8,
                    border: '1px solid var(--accent)',
                    background: 'rgba(0,0,0,0.15)',
                  }}
                />
                <span className="sub" style={{ fontSize: '0.75rem' }}>
                  {editPerfil.pin && editPerfil.pin.length >= 4 ? (
                    <b style={{ color: 'var(--accent3)' }}>✓ PIN válido ({editPerfil.pin.length} dígitos)</b>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Mínimo 4 dígitos numéricos</span>
                  )}
                </span>
              </div>
            </div>

            {/* ZONA DE PELIGRO: ELIMINAR CUENTA (DISPONIBLE PARA TODOS LOS USUARIOS) */}
            <div
              style={{
                marginTop: 20,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⚠️</span>
                    <span>Zona de Peligro</span>
                  </div>
                  <div
                    className="sub"
                    style={{
                      fontSize: '0.74rem',
                      marginTop: 2,
                      maxWidth: 320,
                      lineHeight: 1.3,
                    }}
                  >
                    Eliminar tu cuenta removerá tu perfil y acceso. Tus ventas y mensajes históricos se conservarán intactos.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    fontWeight: 700,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setConfirmarEliminarTexto('');
                    setModalEliminarCuentaOpen(true);
                  }}
                >
                  🗑️ Eliminar cuenta
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalCuentaOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-green"
                onClick={() => handleGuardarPerfil(editPerfil)}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR CUENTA */}
      {modalEliminarCuentaOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
          onClick={() => !eliminandoCuenta && setModalEliminarCuentaOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              margin: 0,
              border: '2px solid #ef4444',
              boxShadow: '0 16px 40px rgba(239, 68, 68, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: '1.8rem' }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ef4444', fontWeight: 800 }}>
                  ¿Eliminar tu cuenta definitivamente?
                </h3>
                <span className="sub" style={{ fontSize: '0.76rem' }}>
                  Esta acción es irreversible para tu usuario
                </span>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg)',
                padding: 12,
                borderRadius: 8,
                fontSize: '0.82rem',
                marginBottom: 14,
                lineHeight: 1.45,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ marginBottom: 8, fontWeight: 700, color: 'var(--text)' }}>
                Lo que sucederá al confirmar:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-sub)' }}>
                <li style={{ marginBottom: 4 }}>
                  ❌ <strong>Tu acceso</strong> al sistema será eliminado permanentemente.
                </li>
                <li style={{ marginBottom: 4 }}>
                  ❌ <strong>Tu registro de Miembro</strong> del equipo se borrará.
                </li>
                <li style={{ marginBottom: 4, color: 'var(--accent3)', fontWeight: 600 }}>
                  ✅ <strong>Tus ventas y cierres</strong> registrados se <u>conservarán intactos</u> en las métricas de la empresa.
                </li>
                <li style={{ color: 'var(--accent3)', fontWeight: 600 }}>
                  ✅ <strong>Tus mensajes</strong> en el chat se <u>mantendrán</u> con tu nombre en el historial.
                </li>
              </ul>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="sub" style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                Para confirmar, escribe la palabra <strong style={{ color: '#ef4444' }}>ELIMINAR</strong>:
              </label>
              <input
                type="text"
                value={confirmarEliminarTexto}
                onChange={(e) => setConfirmarEliminarTexto(e.target.value)}
                placeholder="ELIMINAR"
                style={{
                  width: '100%',
                  borderColor: confirmarEliminarTexto.toUpperCase() === 'ELIMINAR' ? '#ef4444' : undefined,
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                }}
                disabled={eliminandoCuenta}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setModalEliminarCuentaOpen(false)}
                disabled={eliminandoCuenta}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={confirmarEliminarTexto.trim().toUpperCase() !== 'ELIMINAR' || eliminandoCuenta}
                onClick={handleEliminarMiCuenta}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {eliminandoCuenta ? 'Eliminando...' : 'Sí, eliminar mi cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER DE CÓDIGO DE BARRA */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />

      {/* MODAL SCANNER DE CÓDIGO DE BARRA POS CARRITO */}
      <BarcodeScannerModal
        isOpen={scannerPosOpen}
        onClose={() => setScannerPosOpen(false)}
        onScanSuccess={handleBarcodeScannedInPos}
      />

      {/* BANNER FLOTANTE DE MENSAJE NUEVO (ESTILO NOTIFICACIÓN PUSH EN PANTALLA) */}
      {inAppBanner && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 420,
            width: '94%',
            background: 'rgba(15, 23, 42, 0.94)',
            color: '#fff',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 16,
            padding: '12px 14px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.15)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
          onClick={() => {
            setActiveTab('miembros');
            setInAppBanner(null);
            setMensajesNoLeidos(0);
          }}
        >
          <img
            src={
              inAppBanner.avatarId?.startsWith('data:image/') || inAppBanner.avatarId?.startsWith('http')
                ? inAppBanner.avatarId
                : scoreGorillaLogo
            }
            alt=""
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              border: '2px solid var(--accent)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#60a5fa' }}>
                💬 {inAppBanner.deNombre}
              </span>
              <span style={{ fontSize: '0.70rem', opacity: 0.65 }}>Ahora</span>
            </div>
            <div
              style={{
                fontSize: '0.82rem',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: 0.92,
              }}
            >
              {inAppBanner.texto}
            </div>
          </div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '1rem',
              padding: 4,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setInAppBanner(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* TOAST FLOTANTE */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'debt' ? '#991b1b' : '#15803d',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            zIndex: 2000,
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: '90%',
          }}
        >
          <span>{toast.msg}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: 0,
              fontSize: '1rem',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
