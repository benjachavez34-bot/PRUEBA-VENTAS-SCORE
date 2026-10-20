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
  DistribucionHorariaItem,
  DesgloseMediosPagoItem,
  ProductoRentabilidadItem,
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

export interface EstadoMorosidad {
  estado: 'aldia' | 'atencion' | 'critico';
  diasMora: number; // días transcurridos desde el 21 (0 si no ha vencido)
  label: string;
  fechaVencimiento: Date;
}

/**
 * Calcula el estado de morosidad con corte los días 21 de cada mes:
 * - Si la deuda se originó antes del 21, vence el 21 de ese mismo mes.
 * - Si se originó el 21 o después, vence el 21 del mes siguiente.
 * - Antes del 21: Al día (Vence el 21).
 * - Del 21 al 28 (1 a 7 días): En Atención (desde el 21).
 * - Más de 7 días pasados del 21: Vencido.
 */
export function calcularEstadoMorosidad(primerDeudaTs?: number, now = Date.now()): EstadoMorosidad {
  if (!primerDeudaTs) {
    return {
      estado: 'aldia',
      diasMora: 0,
      label: 'Al día (Vence el 21)',
      fechaVencimiento: new Date(),
    };
  }

  const d = new Date(primerDeudaTs);
  let vYear = d.getFullYear();
  let vMonth = d.getMonth();
  if (d.getDate() >= 21) {
    vMonth += 1;
    if (vMonth > 11) {
      vMonth = 0;
      vYear += 1;
    }
  }
  const fechaVencimiento = new Date(vYear, vMonth, 21, 0, 0, 0, 0);
  const venceTs = fechaVencimiento.getTime();

  if (now < venceTs) {
    return {
      estado: 'aldia',
      diasMora: 0,
      label: 'Al día (Vence el 21)',
      fechaVencimiento,
    };
  }

  const diasMora = Math.floor((now - venceTs) / (1000 * 60 * 60 * 24));
  if (diasMora <= 7) {
    return {
      estado: 'atencion',
      diasMora,
      label: diasMora === 0 ? 'En Atención (Desde hoy 21)' : `En Atención (${diasMora}d desde el 21)`,
      fechaVencimiento,
    };
  } else {
    return {
      estado: 'critico',
      diasMora,
      label: `Vencido (${diasMora}d desde el 21)`,
      fechaVencimiento,
    };
  }
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

  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  movs.forEach((m) => {
    if (!m.cliente) return;
    const k = normalize(m.cliente);
    if (!k) return;

    const isDebt = (m.tipo === 'venta' && m.fiado) || m.tipo === 'deuda';
    const isPay = m.tipo === 'pago';

    if (!map[k]) {
      map[k] = { nombre: m.cliente.trim(), deuda: 0 };
    }

    if (isDebt) {
      map[k].deuda += m.total || 0;
      if (m.ts && (!map[k].primerDeudaTs || m.ts < map[k].primerDeudaTs!)) {
        map[k].primerDeudaTs = m.ts;
      }
    } else if (isPay) {
      map[k].deuda -= m.total || 0;
    }

    if (m.ts) {
      if (!map[k].ultimoMovimientoTs || m.ts > map[k].ultimoMovimientoTs!) {
        map[k].ultimoMovimientoTs = m.ts;
      }
    }
  });

  // Incorporar clientes del directorio aunque hayan pagado al contado o no tengan deuda pendiente
  if (clientesMap) {
    Object.values(clientesMap).forEach((c) => {
      if (!c.nombre) return;
      const k = normalize(c.nombre);
      if (!k) return;
      if (!map[k]) {
        map[k] = {
          nombre: c.nombre.trim(),
          deuda: 0,
          ultimoMovimientoTs: c.actualizadoEn || c.creadoEn,
        };
      }
    });
  }

  const now = Date.now();

  return Object.values(map)
    .map((item) => {
      const normKey = normalize(item.nombre);

      let clienteInfo = clientesMap
        ? Object.values(clientesMap).find(
            (c) => normalize(c.nombre) === normKey || (c.id ? normalize(c.id) === normKey : false)
          )
        : undefined;

      // Si aún no hay teléfono en el directorio, buscar en movimientos previos
      let telEncontrado = clienteInfo?.telefono;
      if (!telEncontrado) {
        const mConTel = movs.find(
          (m) => m.cliente && normalize(m.cliente) === normKey && m.telefono
        );
        if (mConTel?.telefono) {
          telEncontrado = mConTel.telefono;
        }
      }

      const tieneDeuda = item.deuda > 0.5;
      const estadoInfo = tieneDeuda
        ? calcularEstadoMorosidad(item.primerDeudaTs, now)
        : {
            estado: 'aldia' as const,
            diasMora: 0,
            label: 'Al día (Sin deuda)',
            fechaVencimiento: new Date(),
          };

      const diasAntiguedad = item.primerDeudaTs
        ? Math.max(0, Math.floor((now - item.primerDeudaTs) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        nombre: item.nombre,
        deuda: Math.max(0, item.deuda),
        telefono: telEncontrado,
        limiteCredito: clienteInfo?.limiteCredito,
        primerDeudaTs: tieneDeuda ? item.primerDeudaTs : undefined,
        ultimoMovimientoTs: item.ultimoMovimientoTs,
        diasAntiguedad,
        estadoMorosidad: estadoInfo.estado,
        diasMora: estadoInfo.diasMora,
        labelMorosidad: estadoInfo.label,
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
  let totalFiadoPeriodo = 0;
  let totalMermasPeriodo = 0;

  // Medios de pago
  const mediosContador: Record<string, { total: number; transacciones: number }> = {
    efectivo: { total: 0, transacciones: 0 },
    transferencia: { total: 0, transacciones: 0 },
    debito: { total: 0, transacciones: 0 },
    fiado: { total: 0, transacciones: 0 },
  };

  // Horas del día 0 a 23
  const horasMap: Record<number, DistribucionHorariaItem> = {};
  for (let h = 0; h < 24; h++) {
    horasMap[h] = {
      hora: h,
      horaLabel: `${String(h).padStart(2, '0')}:00`,
      total: 0,
      transacciones: 0,
      unidades: 0,
    };
  }

  const diasMap: Record<
    string,
    { fechaStr: string; fechaCompleta: string; total: number; unidades: number }
  > = {};
  const prodsMap: Record<
    string,
    { productoId: string; nombre: string; unidades: number; total: number }
  > = {};

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

      // Medios de pago
      if (m.fiado) {
        totalFiadoPeriodo += totalVenta;
        mediosContador.fiado.total += totalVenta;
        mediosContador.fiado.transacciones++;
      } else {
        ventasPag += totalVenta;
        const mp = m.medioPago || 'efectivo';
        if (mp === 'transferencia') {
          mediosContador.transferencia.total += totalVenta;
          mediosContador.transferencia.transacciones++;
        } else if (mp === 'debito') {
          mediosContador.debito.total += totalVenta;
          mediosContador.debito.transacciones++;
        } else {
          mediosContador.efectivo.total += totalVenta;
          mediosContador.efectivo.transacciones++;
        }
      }

      const pid = m.productoId || '';
      const unitCost = cu[pid] || 0;
      costoTotal += cant * unitCost;

      // Agrupación horaria
      const dObj = new Date(m.ts);
      const hora = dObj.getHours();
      if (horasMap[hora]) {
        horasMap[hora].total += totalVenta;
        horasMap[hora].transacciones++;
        horasMap[hora].unidades += cant;
      }

      // Agrupación por día
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
    } else if (m.tipo === 'merma') {
      const pid = m.productoId || '';
      const unitCost = cu[pid] || 0;
      totalMermasPeriodo += (m.cant || 0) * unitCost;
    }
  });

  const ventasPorDia: VentaPorDiaItem[] = Object.keys(diasMap)
    .sort()
    .map((k) => diasMap[k]);

  const topProductos: TopProductoItem[] = Object.values(prodsMap).sort(
    (a, b) => b.unidades - a.unidades || b.total - a.total
  );

  const distribucionHoraria: DistribucionHorariaItem[] = Object.values(horasMap).sort(
    (a, b) => a.hora - b.hora
  );

  // Determinar hora pico
  let horaPico: { hora: number; horaLabel: string; total: number; transacciones: number } | null =
    null;
  distribucionHoraria.forEach((dh) => {
    if (dh.total > 0 && (!horaPico || dh.total > horaPico.total)) {
      horaPico = {
        hora: dh.hora,
        horaLabel: dh.horaLabel,
        total: dh.total,
        transacciones: dh.transacciones,
      };
    }
  });

  // Desglose de medios de pago
  const mediosLabels: Record<string, string> = {
    efectivo: '💵 Efectivo',
    transferencia: '🏦 Transferencia',
    debito: '💳 Débito / POS',
    fiado: '🏷️ Fiado (Crédito)',
  };

  const desgloseMedios: DesgloseMediosPagoItem[] = Object.keys(mediosContador).map((k) => {
    const item = mediosContador[k];
    const pct = ventasTotal > 0 ? Math.round((item.total / ventasTotal) * 100) : 0;
    return {
      medio: k,
      label: mediosLabels[k] || k,
      total: item.total,
      porcentaje: pct,
      transacciones: item.transacciones,
    };
  });

  // Matriz de rentabilidad y rotación por producto
  const diasPeriodo = Math.max(1, Math.round((hasta - desde) / (24 * 60 * 60 * 1000)));
  const rentabilidadProductos: ProductoRentabilidadItem[] = productos
    .map((p) => {
      const pv =
        prodsMap[p.id] ||
        Object.values(prodsMap).find(
          (x) => x.nombre.toLowerCase() === p.nombre.toLowerCase()
        );
      const unVend = pv?.unidades || 0;
      const vTot = pv?.total || 0;
      const unitCost = cu[p.id] || 0;
      const precioVenta = p.precio || (unVend > 0 ? Math.round(vTot / unVend) : 0);
      const margenUnit = precioVenta - unitCost;
      const margenPct = precioVenta > 0 ? Math.round((margenUnit / precioVenta) * 100) : 0;
      const gananciaTotal = unVend * margenUnit;
      const stockActual = stockDe(p.id, movs);
      const velVentasDiarias = unVend / diasPeriodo;
      const diasInventario =
        velVentasDiarias > 0 ? Math.round(stockActual / velVentasDiarias) : null;
      const alertaAgotamiento =
        stockActual > 0 && diasInventario !== null && diasInventario <= 3;

      let clasificacion: 'estrella' | 'rentable' | 'volumen' | 'estancado' | 'estandar' =
        'estandar';
      if (stockActual > 0 && unVend === 0) {
        clasificacion = 'estancado';
      } else if (margenPct >= 35 && unVend >= 5) {
        clasificacion = 'estrella';
      } else if (margenPct >= 35) {
        clasificacion = 'rentable';
      } else if (unVend >= 5) {
        clasificacion = 'volumen';
      }

      return {
        productoId: p.id,
        nombre: p.nombre,
        precioVenta,
        costoUnit: unitCost,
        margenUnit,
        margenPct,
        unidadesVendidas: unVend,
        ventasTotal: vTot,
        gananciaTotal,
        stockActual,
        diasInventarioRestante: diasInventario,
        clasificacion,
        alertaAgotamiento,
      };
    })
    .sort(
      (a, b) => b.gananciaTotal - a.gananciaTotal || b.unidadesVendidas - a.unidadesVendidas
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
    distribucionHoraria,
    horaPico,
    desgloseMedios,
    rentabilidadProductos,
    totalFiadoPeriodo,
    totalMermasPeriodo,
  };
}

export function generarReporteEjecutivoWhatsApp(
  stats: EstadisticasPeriodo,
  nombreTienda = 'Ventas Score'
): string {
  const margenGlobal =
    stats.ventasTotal > 0
      ? Math.round((stats.gananciaTotal / stats.ventasTotal) * 100)
      : 0;

  const top3 = stats.topProductos
    .slice(0, 3)
    .map((p, i) => `${i + 1}. ${p.nombre} - ${p.unidades} un. (${fmt(p.total)})`)
    .join('\n');

  const mediosStr = stats.desgloseMedios
    ? stats.desgloseMedios
        .map((m) => `• ${m.label}: ${fmt(m.total)} (${m.porcentaje}%)`)
        .join('\n')
    : '';

  const agotando = stats.rentabilidadProductos
    ? stats.rentabilidadProductos.filter((p) => p.alertaAgotamiento)
    : [];

  const lines = [
    `📊 INFORME EJECUTIVO - ${nombreTienda}`,
    `Período: ${stats.etiqueta}`,
    `Fecha emisión: ${fTs(Date.now())}`,
    `----------------------------------------`,
    `RESUMEN COMERCIAL`,
    `• Ventas Totales: ${fmt(stats.ventasTotal)} (${stats.transaccionesCount} operaciones)`,
    `• Unidades Vendidas: ${stats.unidadesVendidas} un.`,
    `• Dinero Ingresado: ${fmt(stats.ingresosTotal)}`,
    `• Ganancia Bruta Estimada: ${fmt(stats.gananciaTotal)} (${margenGlobal}% margen)`,
    `• Ticket Promedio: ${fmt(stats.ticketPromedio)}`,
    stats.totalFiadoPeriodo
      ? `• Crédito / Fiados Otorgados: ${fmt(stats.totalFiadoPeriodo)}`
      : null,
    stats.totalMermasPeriodo
      ? `• Pérdidas por Mermas: ${fmt(stats.totalMermasPeriodo)}`
      : null,
    `----------------------------------------`,
    `MEDIOS DE PAGO`,
    mediosStr,
    `----------------------------------------`,
    stats.horaPico
      ? `HORA PICO DE VENTA: ⏰ ${stats.horaPico.horaLabel} hrs (${fmt(stats.horaPico.total)})`
      : null,
    top3 ? `----------------------------------------\nTOP PRODUCTOS:\n${top3}` : null,
    agotando.length > 0
      ? `----------------------------------------\n🚨 ALERTA INVENTARIO (Por agotar en <= 3 días):\n${agotando
          .slice(0, 3)
          .map((p) => `• ${p.nombre}: ${p.stockActual} un. restantes`)
          .join('\n')}`
      : null,
    `----------------------------------------`,
    `Sistema de Gestión Ventas Score`,
  ].filter(Boolean);

  return lines.join('\n');
}

export interface ConciliacionCierre {
  desde: number;
  hasta: number;
  ventasEfectivo: number;
  pagosEfectivo: number;
  comprasStock: number;
  efectivoEsperado: number;
  transferenciaEsperado: number;
  debitoEsperado: number;
  fiadoTotal: number;
  costoMerma: number;
  mermasCant: number;
  totalEsperado: number;
  totalVentas: number;
  unidadesVendidas: number;
  transacciones: number;
}

export function calcConciliacionCierre(
  movs: Movimiento[],
  productos: Producto[],
  desde: number,
  hasta: number
): ConciliacionCierre {
  const cu: Record<string, number> = {};
  productos.forEach((p) => {
    cu[p.id] = costoUnit(p.id, movs);
  });

  let ventasEfectivo = 0;
  let pagosEfectivo = 0;
  let comprasStock = 0;
  let transferenciaEsperado = 0;
  let debitoEsperado = 0;
  let fiadoTotal = 0;
  let costoMerma = 0;
  let mermasCant = 0;
  let totalVentas = 0;
  let unidadesVendidas = 0;
  let transacciones = 0;

  movs.forEach((m) => {
    if (!(m.ts > desde && m.ts <= hasta)) return;
    const pid = m.productoId || '';

    if (m.tipo === 'entrada') {
      comprasStock += m.costoTotal || 0;
    } else if (m.tipo === 'venta') {
      transacciones++;
      totalVentas += m.total || 0;
      unidadesVendidas += m.cant || 0;

      if (m.fiado) {
        fiadoTotal += m.total || 0;
      } else {
        const mp = m.medioPago || 'efectivo';
        if (mp === 'transferencia') {
          transferenciaEsperado += m.total || 0;
        } else if (mp === 'debito') {
          debitoEsperado += m.total || 0;
        } else {
          // 'efectivo' o no especificado
          ventasEfectivo += m.total || 0;
        }
      }
    } else if (m.tipo === 'pago') {
      pagosEfectivo += m.total || 0;
    } else if (m.tipo === 'merma') {
      const c = (m.cant || 0) * (cu[pid] || 0);
      costoMerma += c;
      mermasCant += m.cant || 0;
    }
  });

  // El efectivo esperado descuenta las compras de stock realizadas con dinero generado en caja
  const efectivoEsperado = (ventasEfectivo + pagosEfectivo) - comprasStock;
  const totalEsperado = efectivoEsperado + transferenciaEsperado + debitoEsperado;

  return {
    desde,
    hasta,
    ventasEfectivo,
    pagosEfectivo,
    comprasStock,
    efectivoEsperado,
    transferenciaEsperado,
    debitoEsperado,
    fiadoTotal,
    costoMerma,
    mermasCant,
    totalEsperado,
    totalVentas,
    unidadesVendidas,
    transacciones,
  };
}

export function generarMensajeWhatsAppCierre(
  cierre: CierreCaja,
  nombreTienda = 'Ventas Score'
): string {
  const efEsp = cierre.efectivoEsperado ?? 0;
  const efReal = cierre.efectivoReal ?? efEsp;
  const difEf = efReal - efEsp;

  const trEsp = cierre.transferenciaEsperado ?? 0;
  const trReal = cierre.transferenciaReal ?? trEsp;
  const difTr = trReal - trEsp;

  const debEsp = cierre.debitoEsperado ?? 0;
  const debReal = cierre.debitoReal ?? debEsp;
  const difDeb = debReal - debEsp;

  const totalEsperado = efEsp + trEsp + debEsp;
  const totalReal = efReal + trReal + debReal;
  const difTotal =
    cierre.diferenciaTotal !== undefined
      ? cierre.diferenciaTotal
      : totalReal - totalEsperado;

  let estadoTexto = 'CAJA CUADRADA ($0)';
  let estadoIcono = '🟢';
  if (difTotal > 0) {
    estadoTexto = `SOBRANTE (+${fmt(difTotal)})`;
    estadoIcono = '🟡';
  } else if (difTotal < 0) {
    estadoTexto = `FALTANTE (-${fmt(Math.abs(difTotal))})`;
    estadoIcono = '🔴';
  }

  const lines = [
    `🔒 REPORTE DE CIERRE DE CAJA`,
    `Negocio: ${nombreTienda}`,
    `Turno: ${cierre.nombre}`,
    `Responsable: ${cierre.por || 'Cajero de turno'}`,
    `Período: ${cierre.desdeTxt} -> ${cierre.hastaTxt}`,
    `----------------------------------------`,
    `RESUMEN OPERATIVO`,
    `• Ventas totales: ${fmt(cierre.vend)} (${cierre.ventas} ventas)`,
    `• Dinero ingresado: ${fmt(cierre.ingresado)}`,
    cierre.comprasStock ? `• Compras de stock (caja): -${fmt(cierre.comprasStock)}` : null,
    `• Ganancia calculada: ${fmt(cierre.ganancia)}`,
    cierre.fiadoTotal ? `• Fiados otorgados: ${fmt(cierre.fiadoTotal)}` : null,
    cierre.mermasTotal ? `• Mermas/Desperdicio: ${fmt(cierre.mermasTotal)}` : null,
    `----------------------------------------`,
    `DESGLOSE POR MEDIO DE PAGO`,
    `• Efectivo:`,
    `  - Esperado: ${fmt(efEsp)}${cierre.comprasStock ? ` (desc. stock: -${fmt(cierre.comprasStock)})` : ''}`,
    `  - Real en mano: ${fmt(efReal)}`,
    `  - Dif: ${difEf === 0 ? '$0' : difEf > 0 ? `+${fmt(difEf)}` : `-${fmt(Math.abs(difEf))}`}`,
    `• Transferencias:`,
    `  - Esperado: ${fmt(trEsp)}`,
    `  - Real confirmado: ${fmt(trReal)}`,
    `  - Dif: ${difTr === 0 ? '$0' : difTr > 0 ? `+${fmt(difTr)}` : `-${fmt(Math.abs(difTr))}`}`,
    `• Tarjetas Débito / POS:`,
    `  - Esperado: ${fmt(debEsp)}`,
    `  - Real comprobantes: ${fmt(debReal)}`,
    `  - Dif: ${difDeb === 0 ? '$0' : difDeb > 0 ? `+${fmt(difDeb)}` : `-${fmt(Math.abs(difDeb))}`}`,
    `----------------------------------------`,
    `AUDITORIA Y ARQUEO`,
    `• Total Esperado: ${fmt(totalEsperado)}`,
    `• Total Real Declarado: ${fmt(totalReal)}`,
    `• Estado: ${estadoIcono} ${estadoTexto}`,
    cierre.observaciones
      ? `• Observaciones: ${cierre.observaciones}`
      : `• Observaciones: Sin observaciones`,
    `----------------------------------------`,
    `Generado por Sistema Ventas Score`,
  ].filter(Boolean);

  return lines.join('\n');
}

