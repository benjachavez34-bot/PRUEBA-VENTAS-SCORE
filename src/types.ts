export interface Producto {
  id: string;
  nombre: string;
  precio?: number;
  codigoBarra?: string;
  stockMinimo?: number;
  categoria?: string;
}

export type TipoMovimiento = 'entrada' | 'venta' | 'deuda' | 'pago' | 'merma';

export type MotivoMerma =
  | 'rotura'
  | 'vencimiento'
  | 'degustacion'
  | 'consumo_interno'
  | 'perdida'
  | 'otro';

export type MedioPago = 'efectivo' | 'transferencia' | 'debito' | 'fiado' | 'mixto';

export interface CartItem {
  producto: Producto;
  cant: number;
  precioUnit: number;
  subtotal: number;
}

export interface TicketVenta {
  id: string;
  items: CartItem[];
  subtotal: number;
  descuento: number;
  recargo?: number;
  total: number;
  medioPago: MedioPago;
  pagoCon?: number;
  vuelto?: number;
  cliente?: string;
  telefono?: string;
  fiadoMonto?: number;
  efectivoMonto?: number;
  ts: number;
  fecha: string;
  por: string;
}

export interface Movimiento {
  id?: string;
  tipo: TipoMovimiento;
  productoId?: string;
  producto?: string;
  cant?: number;
  total?: number;
  fiado?: boolean;
  cliente?: string;
  costoTotal?: number;
  por?: string;
  ts: number;
  fecha?: string;
  nota?: string;
  ticketId?: string;
  medioPago?: MedioPago;
  pagoCon?: number;
  vuelto?: number;
  telefono?: string;
  motivoMerma?: MotivoMerma;
}

export interface CierreCaja {
  id?: string;
  nombre: string;
  desde: number;
  hasta: number;
  desdeTxt: string;
  hastaTxt: string;
  inv: number;
  vend: number;
  costoV: number;
  ventasPag: number;
  pagos: number;
  ingresado: number;
  ganancia: number;
  ventas: number;
  porCobrar: number;
  enCuenta: number;
  por?: string;
  // Fase 4: Conciliación & Arqueo Ciego
  efectivoEsperado?: number;
  efectivoReal?: number;
  transferenciaEsperado?: number;
  transferenciaReal?: number;
  debitoEsperado?: number;
  debitoReal?: number;
  fiadoTotal?: number;
  mermasTotal?: number;
  diferenciaTotal?: number;
  estadoArqueo?: 'cuadrada' | 'sobrante' | 'faltante';
  observaciones?: string;
  telefonoReporte?: string;
}

export interface Cliente {
  id?: string;
  nombre: string;
  telefono?: string;
  limiteCredito?: number;
  direccion?: string;
  notas?: string;
  creadoEn?: number;
  actualizadoEn?: number;
}

export interface Deudor {
  nombre: string;
  deuda: number;
  telefono?: string;
  diasAntiguedad?: number;
  primerDeudaTs?: number;
  ultimoMovimientoTs?: number;
  limiteCredito?: number;
}

export interface ResumenPeriodo {
  inv: number;
  vend: number;
  costoV: number;
  ventasPag: number;
  pagos: number;
  ingresado: number;
  ganancia: number;
  ventas: number;
  porP: Record<string, { inv: number; vend: number; costo: number }>;
  costoMerma?: number;
  mermasCant?: number;
}

export type FiltroPeriodo = 'dia' | 'semana' | 'mes' | 'personalizado';

export interface VentaPorDiaItem {
  fechaStr: string; // e.g. "12/10"
  fechaCompleta: string; // "YYYY-MM-DD"
  total: number;
  unidades: number;
}

export interface TopProductoItem {
  productoId: string;
  nombre: string;
  unidades: number;
  total: number;
}

export interface DistribucionHorariaItem {
  hora: number; // 0 a 23
  horaLabel: string; // "08:00", "15:00"
  total: number;
  transacciones: number;
  unidades: number;
}

export interface DesgloseMediosPagoItem {
  medio: string; // 'efectivo' | 'transferencia' | 'debito' | 'fiado'
  label: string;
  total: number;
  porcentaje: number;
  transacciones: number;
}

export interface ProductoRentabilidadItem {
  productoId: string;
  nombre: string;
  precioVenta: number;
  costoUnit: number;
  margenUnit: number;
  margenPct: number;
  unidadesVendidas: number;
  ventasTotal: number;
  gananciaTotal: number;
  stockActual: number;
  diasInventarioRestante: number | null;
  clasificacion: 'estrella' | 'rentable' | 'volumen' | 'estancado' | 'estandar';
  alertaAgotamiento: boolean;
}

export interface EstadisticasPeriodo {
  desde: number;
  hasta: number;
  etiqueta: string;
  ventasTotal: number;
  ingresosTotal: number; // ventasPag + pagos de deudores recibidos
  costoTotal: number;
  gananciaTotal: number;
  unidadesVendidas: number;
  transaccionesCount: number;
  ticketPromedio: number;
  ventasPorDia: VentaPorDiaItem[];
  topProductos: TopProductoItem[];
  // Fase 5: Business Intelligence
  distribucionHoraria?: DistribucionHorariaItem[];
  horaPico?: { hora: number; horaLabel: string; total: number; transacciones: number } | null;
  desgloseMedios?: DesgloseMediosPagoItem[];
  rentabilidadProductos?: ProductoRentabilidadItem[];
  totalFiadoPeriodo?: number;
  totalMermasPeriodo?: number;
}

export interface Miembro {
  id?: string;
  email: string;
  nombre: string;
  rol: string;
  telefono: string;
  sucursal: string;
  avatarId: string;
  isAdmin: boolean;
  estado?: 'disponible' | 'en_ruta' | 'ocupado';
  ultimaActividad?: number;
}

export interface MensajeChat {
  id?: string;
  deEmail: string;
  deNombre: string;
  deRol: string;
  avatarId?: string;
  esAdmin: boolean;
  texto: string;
  ts: number;
  tipo?: 'general' | 'indicacion' | 'urgente';
  paraEmail?: string;
  paraNombre?: string;
  canalId?: string;
}

export interface EvaluacionCriterios {
  cumplimientoMetas: number; // 1 a 5
  cobranzaFiado: number;     // 1 a 5
  servicioCliente: number;   // 1 a 5
  cuadraturaStock: number;   // 1 a 5
}

export interface EvaluacionVendedor {
  vendedorNombre: string;
  puntuacionGeneral: number; // 1.0 a 5.0
  criterios: EvaluacionCriterios;
  observacion?: string;
  evaluadoPor: string;
  evaluadoEn: number;
}

