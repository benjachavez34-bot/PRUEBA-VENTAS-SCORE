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
} from 'firebase/firestore';
import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Producto, Movimiento, CierreCaja, Deudor, Miembro, MensajeChat } from './types';
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
import { initializePushNotifications } from './utils/pushNotifications';
import scoreBgDesktop from './assets/images/score_surtidas_desktop_bg_1792157664500.jpg';
import scoreGorillaLogo from './assets/images/score_gorilla_bg_1791923074721.jpg';

export const ADMIN_EMAILS = [
  'benja.chavez34@gmail.com',
  'fco.inzunza.re@gmail.com',
];

export const isUserAdmin = (email?: string | null): boolean => {
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
    'Inicia sesión con una cuenta Google autorizada para acceder al registro compartido.'
  );
  const [dbError, setDbError] = useState<string | null>(null);

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

  const handleSaveTheme = (newTheme: ThemeConfig) => {
    setThemeConfig(newTheme);
    try {
      localStorage.setItem('app_theme_config', JSON.stringify(newTheme));
    } catch {}
  };

  const handleResetTheme = () => {
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
  };

  const fotoPerfilInputRef = useRef<HTMLInputElement>(null);

  // Estado de Miembros y Chat en tiempo real
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);

  // Estado de Mi Cuenta (Perfil)
  const [modalCuentaOpen, setModalCuentaOpen] = useState<boolean>(false);
  const [perfil, setPerfil] = useState<PerfilUsuario>(() => {
    try {
      const saved = localStorage.getItem('perfil_usuario');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      nombre: 'Benjamín Chávez',
      email: 'benja.chavez34@gmail.com',
      rol: 'Administrador General & Director Comercial',
      telefono: '+56 9 8765 4321',
      sucursal: 'Casa Central - Santiago',
      avatarId: 'gorilla',
    };
  });
  const [editPerfil, setEditPerfil] = useState<PerfilUsuario>(perfil);

  // App data
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  // Venta Form State
  const [vProductoId, setVProductoId] = useState<string>('');
  const [vCantidad, setVCantidad] = useState<string>('');
  const [vPrecio, setVPrecio] = useState<string>('');
  const [vTotal, setVTotal] = useState<string>('');
  const [vFiado, setVFiado] = useState<boolean>(false);
  const [vCliente, setVCliente] = useState<string>('');

  // Deuda Form State
  const [dNombre, setDNombre] = useState<string>('');
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
      } else {
        if (!isGuest) {
          setUser(null);
          setAuthStatus('Inicia sesión con una cuenta Google autorizada para acceder al registro compartido.');
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
          const miDoc = list.find(
            (m) => m.email?.toLowerCase() === user.email?.toLowerCase()
          );
          if (miDoc) {
            setPerfil((prev) => ({
              ...prev,
              nombre: miDoc.nombre || prev.nombre,
              rol: miDoc.rol || prev.rol,
              telefono: miDoc.telefono || prev.telefono,
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
      },
      (err) => console.log('mensajes err', err)
    );

    return () => {
      unsubProds();
      unsubCierres();
      unsubMovs();
      unsubMiembros();
      unsubMensajes();
    };
  }, [user, isGuest]);

  // Clients list for datalist suggestions
  const clientNames = useMemo(() => {
    return Array.from(
      new Set(movs.map((m) => m.cliente).filter((c): c is string => Boolean(c)))
    ).sort();
  }, [movs]);

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

  const checkStock = (prod: Producto, cant: number): boolean => {
    const currentStock = stockDe(prod.id, movs);
    if (cant <= currentStock) return true;
    return window.confirm(
      `El stock de ${prod.nombre} quedará negativo (${currentStock - cant}). ¿Continuar?`
    );
  };

  // Auth Handlers
  const handleLoginGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      setAuthStatus('No se pudo iniciar sesión: ' + (e?.message || e));
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
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

  const handleLogout = async () => {
    try {
      if (user) {
        await signOut(auth);
      }
      setIsGuest(false);
      setUser(null);
    } catch (e: any) {
      alert('No se pudo cerrar sesión: ' + e?.message);
    }
  };

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
      setVCantidad('');
      setVPrecio('');
      setVTotal('');
      setVCliente('');
      setVFiado(false);
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
      setDNombre('');
      setDCantidad('');
      setDPrecio('');
      setDMonto('');
      setDProductoId('');
    }
  };

  const handleOpenAbonar = (nombre: string, deuda?: number) => {
    let dVal = deuda;
    if (dVal === undefined) {
      const deudoresList = getDeudores(movs);
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
    const ok = await addMov({
      tipo: 'pago',
      total: m,
      cliente: modalAbono.nombre,
    });
    if (ok) {
      setModalAbono({ isOpen: false, nombre: '', deuda: 0 });
      setMontoAbono('');
      setErrorAbono(null);
    }
  };

  const handleSumarDeuda = (nombre: string) => {
    setDNombre(nombre);
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
        await addMov({
          tipo: 'pago',
          total: deuda,
          cliente: nombre,
          nota: 'saldada',
        });
        setModalConfirm((prev) => ({ ...prev, isOpen: false }));
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
  const deudoresList = useMemo(() => getDeudores(movs).filter((d) => d.deuda > 0.5), [movs]);
  const totalDeudaNum = useMemo(
    () => deudoresList.reduce((s, d) => s + Math.max(0, d.deuda), 0),
    [deudoresList]
  );
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
      showToast(isAdmin ? 'Indicación oficial enviada al equipo' : 'Mensaje enviado');
    } catch (e: any) {
      alert('No se pudo enviar el mensaje: ' + (e?.message || e));
    }
  };

  const handleGuardarPerfil = async (nuevoPerfil: PerfilUsuario) => {
    setPerfil(nuevoPerfil);
    setMiNombre(nuevoPerfil.nombre);
    try {
      localStorage.setItem('perfil_usuario', JSON.stringify(nuevoPerfil));
      localStorage.setItem('miNombre', nuevoPerfil.nombre);
    } catch {}

    const miembroData: Omit<Miembro, 'id'> = {
      email: user?.email || nuevoPerfil.email || '',
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
        const filtered = prev.filter((m) => m.email !== miembroData.email);
        const updated = [...filtered, { id: 'local-' + Date.now(), ...miembroData }];
        try {
          localStorage.setItem('local_miembros', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setModalCuentaOpen(false);
      showToast('Perfil actualizado con éxito');
      return;
    }

    try {
      const emailDocId = (user?.email || nuevoPerfil.email || 'usuario').replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'miembros', emailDocId), miembroData, { merge: true });
      setModalCuentaOpen(false);
      showToast('Perfil actualizado y sincronizado en Miembros');
    } catch (e: any) {
      setModalCuentaOpen(false);
      showToast('Perfil guardado');
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

      {!isAuthenticated ? (
        <div className="auth-wrapper">
          <section id="authPanel" className="auth-card">
            {/* LOGO GORILLA DESTACADO */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              <img
                src={scoreGorillaLogo}
                alt="Logo Score Gorilla"
                style={{
                  width: 92,
                  height: 92,
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

            {/* TÍTULO LLAMATIVO */}
            <h1
              style={{
                margin: '0 0 6px 0',
                fontSize: '2rem',
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
                fontSize: '0.88rem',
                lineHeight: 1.45,
                maxWidth: 340,
                margin: '0 auto 24px auto',
              }}
            >
              Control integral de ventas, inventario, deudores y métricas en tiempo real.
            </div>

            {/* BOTONES DE ACCIÓN */}
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
                onClick={handleGuestLogin}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                Ingresar en Modo Invitado / Demo
              </button>
            </div>

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
              onClick={() => setActiveTab('miembros')}
            >
              👥 Miembros & Chat
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
                <div className="card">
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
                    <div className="row" id="filaCliente">
                      <input
                        placeholder="Nombre del cliente"
                        list="listaClientes"
                        value={vCliente}
                        onChange={(e) => setVCliente(e.target.value)}
                      />
                      <datalist id="listaClientes">
                        {clientNames.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
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

                <div className="card">
                  <div className="sub" style={{ marginBottom: 6, fontWeight: 600 }}>
                    Últimas ventas
                  </div>
                  <div id="listaVentas">
                    {ultimasVentas.length ? (
                      ultimasVentas.map((m) => (
                        <div className="item" key={m.id || m.ts}>
                          <div>
                            <div className="name">
                              {m.producto} x{m.cant}
                            </div>
                            <div className="sub">
                              {m.fecha || ''}
                              {m.fiado ? ` · Fiado a ${m.cliente}` : ' · Pagado'}
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
                  <div className="row">
                    <input
                      ref={dNombreInputRef}
                      placeholder="Nombre del deudor"
                      list="listaClientes"
                      value={dNombre}
                      onChange={(e) => setDNombre(e.target.value)}
                    />
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
                          <div className="item" style={{ borderBottom: 'none' }}>
                            <div
                              style={{ cursor: 'pointer', flex: 1, userSelect: 'none' }}
                              onClick={() => toggleDeudorDetalle(d.nombre)}
                              title="Toca para ver u ocultar productos que debe"
                            >
                              <div
                                className="name"
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                              >
                                <span>{d.nombre}</span>
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
                              <div className={`amount ${d.deuda > 0 ? 'debt' : 'ok'}`}>
                                {d.deuda > 0 ? fmt(d.deuda) : 'Al día'}
                              </div>
                            </div>
                            <div className="actions">
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
                                          fontSize: '0.8rem',
                                        }}
                                      >
                                        <span className="sub">
                                          {fTs(p.ts)} {p.nota ? `(${p.nota})` : ''}
                                        </span>
                                        <span className="amount ok" style={{ fontSize: '0.85rem' }}>
                                          -{fmt(p.total || 0)}
                                        </span>
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

      {/* MODAL SCANNER DE CÓDIGO DE BARRA */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />

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
