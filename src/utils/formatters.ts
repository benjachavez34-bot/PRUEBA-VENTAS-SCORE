import {
  Movimiento,
  Producto,
  CierreCaja,
  Deudor,
  Cliente,
  ResumenPeriodo,
  FiltroPeriodo,
  EstadisticasPeriodo,
  VentaPorDiaItem,
  TopProductoItem,
} from '../types';

export const fTs = (t: number): string => {
  try {
    return new Date(t).toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return new Date(t).toLocaleString('es-CL');
  }
};

export const fmt = (n: number): string => {
  if (isNaN(n) || !isFinite(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('es-CL');
};

export function stockDe(pid: string, movs: Movimiento[]): number {
  return movs.reduce((s, m) => {
    if (m.productoId !== pid) return s;
    if (m.tipo === 'entrada') return s + (m.cant || 0);
    if (m.tipo === 'venta' || m.tipo === 'merma') return s - (m.cant || 0);
    return s;
  }, 0);
}

export function getDeudores(
  movs: Movimiento[],
  clientesMap?: Record<string, Cliente>
): Deudor[] {
  const map: Record<
    string,
    {
      nombre: string;
      deuda: number;
      primerDeudaTs?: number;
      ultimoMovimientoTs?: number;
    }
  > = {};

  movs.forEach((m) => {
    if (!m.cliente) return;
    const isDebt = (m.tipo === 'venta' && m.fiado) || m.tipo === 'deuda';
    const isPay = m.tipo === 'pago';
    if (!isDebt && !isPay) return;
    const k = m.cliente.trim().toLowerCase();
    if (!map[k]) {
      map[k] = { nombre: m.cliente.trim(), deuda: 0 };
    }
    map[k].deuda += isDebt ? m.total || 0 : -(m.total || 0);

    // Registrar antigüedad de deuda
    if (isDebt && m.ts) {
      if (!map[k].primerDeudaTs || m.ts < map[k].primerDeudaTs!) {
        map[k].primerDeudaTs = m.ts;
      }
    }
    if (m.ts) {
      if (!map[k].ultimoMovimientoTs || m.ts > map[k].ultimoMovimientoTs!) {
        map[k].ultimoMovimientoTs = m.ts;
      }
    }
  });

  const now = Date.now();
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  return Object.values(map)
    .map((item) => {
      const k = item.nombre.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const normKey = normalize(item.nombre);

      let clienteInfo = clientesMap ? clientesMap[k] : undefined;
      if (!clienteInfo && clientesMap) {
        clienteInfo = Object.values(clientesMap).find(
          (c) => normalize(c.nombre) === normKey || (c.id ? normalize(c.id) === normKey : false)
        );
      }

      // Si aún no hay teléfono en el directorio, buscar si vino guardado en algún movimiento previo del cliente
      let telEncontrado = clienteInfo?.telefono;
      if (!telEncontrado) {
        const mConTel = movs.find(
          (m) => m.cliente && normalize(m.cliente) === normKey && m.telefono
        );
        if (mConTel?.telefono) {
          telEncontrado = mConTel.telefono;
        }
      }

      const diasAntiguedad = item.primerDeudaTs
        ? Math.max(0, Math.floor((now - item.primerDeudaTs) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        nombre: item.nombre,
        deuda: item.deuda,
        telefono: telEncontrado,
        limiteCredito: clienteInfo?.limiteCredito,
        primerDeudaTs: item.primerDeudaTs,
        ultimoMovimientoTs: item.ultimoMovimientoTs,
        diasAntiguedad,
      };
    })
    .sort((a, b) => b.deuda - a.deuda || a.nombre.localeCompare(b.nombre));
}

export function invertido(pid: string, movs: Movimiento[]): number {
  return movs.reduce(
    (s, m) => s + (m.tipo === 'entrada' && m.productoId === pid ? m.costoTotal || 0 : 0),
    0
  );
}

export function costoUnit(pid: string, movs: Movimiento[]): number {
  const c = movs.reduce(
    (s, m) => s + (m.tipo === 'entrada' && m.productoId === pid ? m.cant || 0 : 0),
    0
  );
  return c ? invertido(pid, movs) / c : 0;
}

export function getT0(cierres: CierreCaja[]): number {
  if (!cierres.length) return 0;
  return Math.max(0, ...cierres.map((c) => c.hasta));
}

export function porCobrarTotal(movs: Movimiento[]): number {
  return getDeudores(movs).reduce((s, x) => s + Math.max(0, x.deuda), 0);
}

export function calcResumen(
  movs: Movimiento[],
  productos: Producto[],
  d: number = 0,
  h: number = Infinity
): ResumenPeriodo {
  const cu: Record<string, number> = {};
  productos.forEach((p) => {
    cu[p.id] = costoUnit(p.id, movs);
  });

  let inv = 0;
  let vend = 0;
  let costoV = 0;
  let ventasPag = 0;
  let pagos = 0;
  let n = 0;
  let costoMerma = 0;
  let mermasCant = 0;
  const porP: Record<string, { inv: number; vend: number; costo: number }> = {};

  movs.forEach((m) => {
    if (!(m.ts > d && m.ts <= h)) return;
    const pid = m.productoId || '';
    if (pid && !porP[pid]) {
      porP[pid] = { inv: 0, vend: 0, costo: 0 };
    }

    if (m.tipo === 'entrada') {
      inv += m.costoTotal || 0;
      if (pid) porP[pid].inv += m.costoTotal || 0;
    } else if (m.tipo === 'venta') {
      const c = (m.cant || 0) * (cu[pid] || 0);
      n++;
      vend += m.total || 0;
      costoV += c;
      if (pid) {
        porP[pid].vend += m.total || 0;
        porP[pid].costo += c;
      }
      if (!m.fiado) ventasPag += m.total || 0;
    } else if (m.tipo === 'merma') {
      const c = (m.cant || 0) * (cu[pid] || 0);
      costoMerma += c;
      mermasCant += m.cant || 0;
    } else if (m.tipo === 'pago') {
      pagos += m.total || 0;
    }
  });

  return {
    inv,
    vend,
    costoV,
    ventasPag,
    pagos,
    ingresado: ventasPag + pagos,
    ganancia: vend - costoV,
    ventas: n,
    porP,
    costoMerma,
    mermasCant,
  };
}

export function getPeriodRange(
  tipo: FiltroPeriodo,
  refDate: Date,
  customDesde?: string,
  customHasta?: string
): { desde: number; hasta: number; etiqueta: string } {
  const d = new Date(refDate);

  if (tipo === 'dia') {
    const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
    const etiqueta = d.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return { desde: inicio, hasta: fin, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) };
  }

  if (tipo === 'semana') {
    // Lunes a Domingo
    const day = d.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday, 0, 0, 0, 0);
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6, 23, 59, 59, 999);
    const etiqueta = `Semana del ${lunes.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} al ${domingo.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return { desde: lunes.getTime(), hasta: domingo.getTime(), etiqueta };
  }

  if (tipo === 'mes') {
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const mesNombre = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    return { desde: inicio, hasta: fin, etiqueta: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1) };
  }

  // Personalizado
  if (customDesde && customHasta) {
    const [y1, m1, d1] = customDesde.split('-').map(Number);
    const [y2, m2, d2] = customHasta.split('-').map(Number);
    const inicio = new Date(y1, m1 - 1, d1, 0, 0, 0, 0).getTime();
    const fin = new Date(y2, m2 - 1, d2, 23, 59, 59, 999).getTime();
    return {
      desde: inicio,
      hasta: fin,
      etiqueta: `${customDesde} al ${customHasta}`,
    };
  }

  // Fallback a los últimos 30 días
  const ahora = Date.now();
  const hace30 = ahora - 30 * 24 * 60 * 60 * 1000;
  return { desde: hace30, hasta: ahora, etiqueta: 'Últimos 30 días' };
}

export function getEquivalentPreviousRange(
  tipo: FiltroPeriodo,
  desde: number,
  hasta: number,
  refDate: Date
): { prevDesde: number; prevHasta: number; prevEtiqueta: string } {
  if (tipo === 'dia') {
    const d = new Date(refDate);
    const prevDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    const prev = getPeriodRange('dia', prevDay);
    return { prevDesde: prev.desde, prevHasta: prev.hasta, prevEtiqueta: 'Día anterior' };
  }

  if (tipo === 'semana') {
    const d = new Date(refDate);
    const prevWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
    const prev = getPeriodRange('semana', prevWeek);
    return { prevDesde: prev.desde, prevHasta: prev.hasta, prevEtiqueta: 'Semana anterior' };
  }

  if (tipo === 'mes') {
    const d = new Date(refDate);
    const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const prev = getPeriodRange('mes', prevMonth);
    return { prevDesde: prev.desde, prevHasta: prev.hasta, prevEtiqueta: 'Mes anterior' };
  }

  // Para rango personalizado: misma duración hacia atrás
  const duracion = hasta - desde;
  const prevHasta = desde - 1;
  const prevDesde = prevHasta - duracion;
  return { prevDesde, prevHasta, prevEtiqueta: 'Período anterior equivalente' };
}

export function calcEstadisticas(
  movs: Movimiento[],
  productos: Producto[],
  desde: number,
  hasta: number,
  etiqueta: string
): EstadisticasPeriodo {
  const cu: Record<string, number> = {};
  productos.forEach((p) => {
    cu[p.id] = costoUnit(p.id, movs);
  });

  let ventasTotal = 0;
  let unidadesVendidas = 0;
  let transaccionesCount = 0;
  let ventasPag = 0;
  let pagos = 0;
  let costoTotal = 0;

  const diasMap: Record<string, { fechaStr: string; fechaCompleta: string; total: number; unidades: number }> = {};
  const prodsMap: Record<string, { productoId: string; nombre: string; unidades: number; total: number }> = {};

  // Si el rango es menor o igual a 31 días, prellenamos los días intermedios con 0
  const totalDias = Math.round((hasta - desde) / (24 * 60 * 60 * 1000));
  if (totalDias >= 1 && totalDias <= 32) {
    const curr = new Date(desde);
    const end = new Date(hasta);
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      diasMap[key] = {
        fechaStr: `${d}/${m}`,
        fechaCompleta: key,
        total: 0,
        unidades: 0,
      };
      curr.setDate(curr.getDate() + 1);
    }
  }

  movs.forEach((m) => {
    if (m.ts < desde || m.ts > hasta) return;

    if (m.tipo === 'venta') {
      const totalVenta = m.total || 0;
      const cant = m.cant || 0;
      ventasTotal += totalVenta;
      unidadesVendidas += cant;
      transaccionesCount++;
      if (!m.fiado) ventasPag += totalVenta;

      const pid = m.productoId || '';
      const unitCost = cu[pid] || 0;
      costoTotal += cant * unitCost;

      // Agrupación por día
      const dObj = new Date(m.ts);
      const y = dObj.getFullYear();
      const mon = String(dObj.getMonth() + 1).padStart(2, '0');
      const day = String(dObj.getDate()).padStart(2, '0');
      const key = `${y}-${mon}-${day}`;
      if (!diasMap[key]) {
        diasMap[key] = {
          fechaStr: `${day}/${mon}`,
          fechaCompleta: key,
          total: 0,
          unidades: 0,
        };
      }
      diasMap[key].total += totalVenta;
      diasMap[key].unidades += cant;

      // Agrupación por producto
      const prodKey = pid || m.producto || 'desconocido';
      const prodNombre = m.producto || 'Producto';
      if (!prodsMap[prodKey]) {
        prodsMap[prodKey] = {
          productoId: pid,
          nombre: prodNombre,
          unidades: 0,
          total: 0,
        };
      }
      prodsMap[prodKey].unidades += cant;
      prodsMap[prodKey].total += totalVenta;
    } else if (m.tipo === 'pago') {
      pagos += m.total || 0;
    }
  });

  const ventasPorDia: VentaPorDiaItem[] = Object.keys(diasMap)
    .sort()
    .map((k) => diasMap[k]);

  const topProductos: TopProductoItem[] = Object.values(prodsMap).sort(
    (a, b) => b.unidades - a.unidades || b.total - a.total
  );

  return {
    desde,
    hasta,
    etiqueta,
    ventasTotal,
    ingresosTotal: ventasPag + pagos,
    costoTotal,
    gananciaTotal: ventasTotal - costoTotal,
    unidadesVendidas,
    transaccionesCount,
    ticketPromedio: transaccionesCount > 0 ? ventasTotal / transaccionesCount : 0,
    ventasPorDia,
    topProductos,
  };
}

