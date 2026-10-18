import * as XLSX from 'xlsx';
import { Producto, Movimiento, CierreCaja } from '../types';
import { getDeudores, stockDe, calcResumen, porCobrarTotal } from './formatters';

export function exportExcel(
  productos: Producto[],
  movs: Movimiento[],
  cierres: CierreCaja[]
): void {
  try {
    const wb = XLSX.utils.book_new();
    const ds = getDeudores(movs);

    // Deudores
    const deudoresData = [
      ...ds.map((d) => ({ Nombre: d.nombre, Deuda: d.deuda })),
      {
        Nombre: 'TOTAL',
        Deuda: ds.reduce((s, d) => s + Math.max(0, d.deuda), 0),
      },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(deudoresData),
      'Deudores'
    );

    // Stock
    const stockData = productos.map((p) => ({
      Producto: p.nombre,
      Stock: stockDe(p.id, movs),
      Precio: p.precio || '',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(stockData),
      'Stock'
    );

    // Ventas
    const ventasData = movs
      .filter((m) => m.tipo === 'venta')
      .sort((a, b) => b.ts - a.ts)
      .map((m) => ({
        Fecha: m.fecha || '',
        Producto: m.producto || '',
        Cantidad: m.cant ?? 0,
        Total: m.total,
        Tipo: m.fiado ? `Fiado - ${m.cliente}` : 'Pagado',
        Vendedor: m.por || '',
      }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(ventasData),
      'Ventas'
    );

    // Resumen
    const r = calcResumen(movs, productos);
    const resumenData = [
      ['Inversión total', r.inv],
      ['Total ingresado', r.ingresado],
      ['En cuenta (ingresado - inversión)', r.ingresado - r.inv],
      ['Te deben', porCobrarTotal(movs)],
      ['Ganancia de lo vendido', r.ganancia],
    ].map(([Concepto, Monto]) => ({ Concepto, Monto }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumenData),
      'Resumen'
    );

    // Cierres
    const cierresData = cierres.map((c) => ({
      Cierre: c.nombre,
      Desde: c.desdeTxt,
      Hasta: c.hastaTxt,
      Responsable: c.por || 'N/A',
      Ventas: c.vend,
      Ingresado: c.ingresado,
      'Efectivo Esperado': c.efectivoEsperado ?? 'N/A',
      'Efectivo Real': c.efectivoReal ?? 'N/A',
      'Transferencia Real': c.transferenciaReal ?? 'N/A',
      'Débito Real': c.debitoReal ?? 'N/A',
      'Fiado Total': c.fiadoTotal ?? 'N/A',
      'Diferencia Arqueo': c.diferenciaTotal ?? 0,
      'Estado Arqueo':
        c.estadoArqueo ||
        (c.diferenciaTotal !== undefined
          ? c.diferenciaTotal === 0
            ? 'Cuadrada'
            : c.diferenciaTotal > 0
            ? 'Sobrante'
            : 'Faltante'
          : 'Histórico'),
      Compras: c.inv,
      'Costo vendido': c.costoV,
      Ganancia: c.ganancia,
      'Te debían': c.porCobrar,
      'En cuenta': c.enCuenta,
      Observaciones: c.observaciones || '',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(cierresData),
      'Cierres'
    );

    XLSX.writeFile(wb, 'ventas_score.xlsx');
  } catch (e: any) {
    if (!e || e.code !== 'cancelled') {
      alert('No se pudo exportar: ' + (e?.message || e));
    }
  }
}
