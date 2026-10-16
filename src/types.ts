export interface Producto {
  id: string;
  nombre: string;
  precio?: number;
}

export type TipoMovimiento = 'entrada' | 'venta' | 'deuda' | 'pago';

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
}

export interface Deudor {
  nombre: string;
  deuda: number;
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
}

