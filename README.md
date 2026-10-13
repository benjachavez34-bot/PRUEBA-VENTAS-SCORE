# Ventas Score — Deudores y Stock

Aplicación web React + TypeScript para control de ventas, registro de deudores, gestión de stock e inventario, y cierres de caja consolidados en tiempo real.

## Características

- **🧾 Ventas**: Registro rápido de ventas al contado o fiadas, cálculo automático de totales, alerta de stock insuficiente y registro de ventas recientes.
- **👥 Deudores**: Seguimiento de saldos adeudados, amortizaciones / pagos parciales, adición de deuda con descuento de stock opcional y liquidación total ("Pagó todo").
- **📦 Control de Stock**: Gestión de productos con seguimiento de unidades, costo total de compra, costo unitario e inventario valorizado, margen de ganancia por unidad y registro de entradas.
- **💰 Resumen y Cierres de Caja**: Vista del período actual y acumulado total, ganancia neta, saldo en cuenta proyectado, desglose por producto y cierres consolidados numerados.
- **📊 Exportación a Excel**: Exportación completa a libro `.xlsx` con hojas de Deudores, Stock, Ventas, Resumen y Cierres.
- **☁️ Sincronización en Tiempo Real**: Compatible con Firebase Authentication y Firestore, con modo local/invitado integrado para pruebas.

## Tecnologías

- **React 18** + **TypeScript**
- **Vite**
- **Firebase** (Auth & Firestore)
- **SheetJS (xlsx)**
- **CSS3** adaptativo con soporte para modo oscuro
