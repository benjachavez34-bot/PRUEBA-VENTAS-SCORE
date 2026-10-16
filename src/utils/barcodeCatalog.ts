import { Producto } from '../types';

export interface BarcodeMatch {
  found: boolean;
  nombre: string;
  existingProduct?: Producto;
  sugerenciaPrecio?: number;
  categoria?: string;
  esScoreOriginal?: boolean;
}

// Catálogo de Códigos de Barra conocidos (enfocado en energéticas Score y productos comunes)
export const CATALOGO_CODIGOS: Record<string, { nombre: string; sugerenciaPrecio?: number; categoria: string }> = {
  // SCORE ENERGY DRINKS (Chile y Latinoamérica)
  '7801610006733': { nombre: 'Bebida Energética Score Original 500ml', sugerenciaPrecio: 1500, categoria: 'Energéticas' },
  '7801610006740': { nombre: 'Bebida Energética Score Red / Frutos Rojos 500ml', sugerenciaPrecio: 1500, categoria: 'Energéticas' },
  '7801610006757': { nombre: 'Bebida Energética Score Zero / Sin Azúcar 500ml', sugerenciaPrecio: 1500, categoria: 'Energéticas' },
  '7801610006764': { nombre: 'Bebida Energética Score Green / Manzana 500ml', sugerenciaPrecio: 1500, categoria: 'Energéticas' },
  '7801610006771': { nombre: 'Bebida Energética Score Blue Citrus 500ml', sugerenciaPrecio: 1500, categoria: 'Energéticas' },
  '7801610006788': { nombre: 'Bebida Energética Score Monster Sandia 500ml', sugerenciaPrecio: 1500, categoria: 'Energéticas' },
  '7801610006719': { nombre: 'Bebida Energética Score Lata 250ml', sugerenciaPrecio: 1000, categoria: 'Energéticas' },
  '7801610006726': { nombre: 'Bebida Energética Score Zero Lata 250ml', sugerenciaPrecio: 1000, categoria: 'Energéticas' },

  // OTRAS ENERGÉTICAS COMUNES DEL MERCADO
  '70847811169': { nombre: 'Monster Energy Original 473ml', sugerenciaPrecio: 2000, categoria: 'Energéticas' },
  '070847811169': { nombre: 'Monster Energy Original 473ml', sugerenciaPrecio: 2000, categoria: 'Energéticas' },
  '0070847811169': { nombre: 'Monster Energy Original 473ml', sugerenciaPrecio: 2000, categoria: 'Energéticas' },
  '70847012474': { nombre: 'Monster Energy Ultra White 473ml', sugerenciaPrecio: 2000, categoria: 'Energéticas' },
  '070847012474': { nombre: 'Monster Energy Ultra White 473ml', sugerenciaPrecio: 2000, categoria: 'Energéticas' },
  '9002490100070': { nombre: 'Red Bull Energy Drink 250ml', sugerenciaPrecio: 1800, categoria: 'Energéticas' },
  '9002490205935': { nombre: 'Red Bull Sugarfree 250ml', sugerenciaPrecio: 1800, categoria: 'Energéticas' },
  '7801620002145': { nombre: 'Mr. Big Energy Drink 500ml', sugerenciaPrecio: 1200, categoria: 'Energéticas' },

  // BEBIDAS Y REFRIGERIOS COMUNES
  '7801610000014': { nombre: 'Coca-Cola Original 591ml', sugerenciaPrecio: 1300, categoria: 'Bebidas' },
  '7801610000052': { nombre: 'Coca-Cola Sin Azúcar 591ml', sugerenciaPrecio: 1300, categoria: 'Bebidas' },
  '7801610000106': { nombre: 'Sprite 591ml', sugerenciaPrecio: 1300, categoria: 'Bebidas' },
  '7801610000205': { nombre: 'Fanta Naranja 591ml', sugerenciaPrecio: 1300, categoria: 'Bebidas' },
  '7801610000854': { nombre: 'Agua Mineral Vital Sin Gas 600ml', sugerenciaPrecio: 1000, categoria: 'Aguas' },
  '7801610000861': { nombre: 'Agua Mineral Vital Con Gas 600ml', sugerenciaPrecio: 1000, categoria: 'Aguas' },
};

/**
 * Busca si un código de barra pertenece a un producto ya registrado en la tienda,
 * o si está en el catálogo predefinido de energéticas y bebidas.
 */
export function identifyProductByBarcode(barcode: string, existingProducts: Producto[]): BarcodeMatch {
  const cleanCode = barcode.trim();
  if (!cleanCode) {
    return { found: false, nombre: '' };
  }

  // 1. Primero comprobar si ya existe en la base de datos de productos de la app
  const foundExisting = existingProducts.find(
    (p) => p.codigoBarra && p.codigoBarra.trim().toLowerCase() === cleanCode.toLowerCase()
  );

  if (foundExisting) {
    return {
      found: true,
      nombre: foundExisting.nombre,
      existingProduct: foundExisting,
      sugerenciaPrecio: foundExisting.precio,
      categoria: 'Registrado previamente',
    };
  }

  // 2. Si no está en existentes, buscar en el catálogo maestro predefinido
  const catalogItem = CATALOGO_CODIGOS[cleanCode];
  if (catalogItem) {
    return {
      found: true,
      nombre: catalogItem.nombre,
      sugerenciaPrecio: catalogItem.sugerenciaPrecio,
      categoria: catalogItem.categoria,
      esScoreOriginal: catalogItem.nombre.toLowerCase().includes('score'),
    };
  }

  // 3. Si no coincide exactamente, verificar si el código numérico coincide sin ceros iniciales
  const withoutLeadingZeros = cleanCode.replace(/^0+/, '');
  for (const [key, val] of Object.entries(CATALOGO_CODIGOS)) {
    if (key.replace(/^0+/, '') === withoutLeadingZeros) {
      return {
        found: true,
        nombre: val.nombre,
        sugerenciaPrecio: val.sugerenciaPrecio,
        categoria: val.categoria,
      };
    }
  }

  // 4. No encontrado en catálogo predeterminado
  return {
    found: false,
    nombre: '',
  };
}
