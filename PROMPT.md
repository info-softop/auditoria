# Proyecto: Plataforma de Auditoría para Ópticas (Softop)

> Prompt de desarrollo para Claude Code. Pegar en una sesión nueva dentro de la carpeta del proyecto.

Construye una plataforma web de auditoría para ópticas. Softop (softop.la) es el sistema
administrativo de las ópticas; el equipo auditor exporta reportes en Excel desde Softop y
necesita cargarlos en esta plataforma para: validar **todos los campos** de cada reporte,
detectar anomalías mediante cruces entre reportes, medir rendimiento contra metas, verificar
consignaciones con evidencia fotográfica y conciliar bancos.

El idioma de toda la UI es ESPAÑOL. Mercado: Colombia (montos en COP). No implementar i18n.

## Stack
- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- Shadcn/ui + Tailwind CSS
- NextAuth.js v5 (email + password)
- SheetJS (xlsx) para parsear Excel
- TanStack Table para tablas interactivas
- Recharts para gráficas
- Almacenamiento de imágenes para fotos de consignación: sistema de archivos local en
  `/uploads` en desarrollo, abstraído tras una interfaz `StorageProvider` para poder cambiar
  a S3 / Vercel Blob / Supabase Storage en producción.
- Zod para validación.

## Concepto central
Cada óptica sube periódicamente 6 reportes de Softop. La plataforma los almacena por
ÓPTICA + PERÍODO (mes/año) y ejecuta validaciones de campo y CRUCES entre reportes para
producir alertas de auditoría. Un mismo archivo Excel puede contener varias ópticas
(columna ÓPTICA) — tratarlas como entidades separadas. El reporte de Gastos NO trae columna
ÓPTICA, así que al cargarlo el auditor debe seleccionar la óptica manualmente.

---

# LOS 6 REPORTES DE SOFTOP (estructuras exactas)

Regla general del parser: fila 1 = encabezados, datos desde fila 2. Ignorar filas vacías y
filas de totales (ej. "VALOR TOTAL") al final. IMPORTANTE: varios archivos comparten el
nombre de hoja "ReportePagos" — distinguir el tipo de reporte por sus **ENCABEZADOS**, no por
el nombre de la hoja. Implementar `detectReportType(headers)`.

## 1. VENTA DETALLADA — hoja "Reporte Caja Detallado" — 36 columnas
Ventas línea por línea. Llave: CONSECUTIVO (= "Orden de Venta" en Softop).
Orden exacto de columnas: ÓPTICA, GRUPO, FECHA, HORA, TIPO DOCUMENTO, CONSECUTIVO,
TIPO MOVIMIENTO, ATENDIDO POR, OPTOMETRA, ESTADO, CODIGO DE SUCURSAL, DOCUMENTO,
NOMBRES Y APELLIDOS, TELEFONO, MOTIVO DE VISITA, ID PRODUCTO, TIPO PRODUCTO, CATEGORIA,
REFERENCIA, MARCA, CANTIDAD, PRECIO DE LISTA, COSTO DE COMPRA PRODUCTO, DESCUENTO,
PRECIO DE VENTA PRODUCTO, METODO DE PAGO, AUTORIZACION, FACTURA, VENTAS TOTALES,
SALDO ANTERIOR, ABONO, ABONO RECIBO DE CAJA, ABONO RECIBO DE CAJA EMPRESARIAL,
TOTAL RECAUDO, VALOR CANJE RECIBO DE CAJA, SALDO ACTUAL.

Catálogos:
- TIPO PRODUCTO: Lentes Oftalmicos, Monturas, Lentes de Contacto, Soluciones, Lubricantes,
  Accesorios, Servicios.
- TIPO MOVIMIENTO: Venta, Abono.
- ESTADO: Por Cancelar, Cerrada.
- METODO DE PAGO: EFECTIVO, TARJETA CREDITO, TARJETA DEBITO, TRANSFERENCIA AVAL,
  TRANSFERENCIA BOGOTA, BANCOLOMBIA, BANCOLOMBIA 0457_OPTICA, CREDITO ADDI.

### GRANULARIDAD MIXTA (crítico — validado contra datos reales)
Esta tabla mezcla dos niveles:
- **Campos por LÍNEA**: ID PRODUCTO, TIPO PRODUCTO, CATEGORIA, REFERENCIA, MARCA, CANTIDAD,
  PRECIO DE LISTA, COSTO DE COMPRA, DESCUENTO, PRECIO DE VENTA PRODUCTO.
- **Campos por ORDEN** (aparecen en UNA sola línea de la orden, 0 en las demás):
  VENTAS TOTALES, SALDO ANTERIOR, ABONO, TOTAL RECAUDO, SALDO ACTUAL.

Reglas derivadas:
- Al agregar ventas/recaudo, sumar **una vez por orden** (CONSECUTIVO), NO por línea.
- PRECIO DE LISTA **no** es el precio de venta (la óptica fija precio propio). NO validar
  "venta = lista − descuento" (genera falsos positivos).
- Cuadre de orden (validado): `SALDO ACTUAL = SALDO ANTERIOR + VENTAS TOTALES − TOTAL RECAUDO`
  (los movimientos "Abono" tienen VENTAS TOTALES = 0).
- Cuadre clave (validado): la suma de `PRECIO DE VENTA PRODUCTO` de las líneas de una orden
  debe igualar `VENTAS TOTALES` de la orden. Si es múltiplo (~2×) → **líneas DUPLICADAS**
  (caso real en órdenes 28994 y 28983). Excluir movimientos "Abono" (VENTAS TOTALES = 0).

## 2. PEDIDO DE LENTES — hoja "PedidoLentes" — 10 columnas
Lentes enviados a fabricar. VALOR = COSTO REAL del lente. Llave: ORDEN.
Columnas: ID, ORDEN, FECHA ENTREGA, PRODUCTO, LABORATORIO, ORDEN DE LABORATORIO, FACTURA,
FECHA ORDEN, VALOR, ESTADO.
- ORDEN == CONSECUTIVO de Venta Detallada.
- PRODUCTO con formato "ID - Nombre" (ej. "23 - Bifocal invisible Tallado sencillo"); el ID
  antes del guion == ID PRODUCTO de Venta Detallada.
- LABORATORIO = proveedor (DURALENS, QARZO, GRUPO EMPRESARIAL OPTICAL, SOL DE ORO,
  CARL ZEISS VISION).
- FECHA ENTREGA puede ser "NO" (no entregado).
- Ignorar la última fila "VALOR TOTAL".

## 3. GASTOS OPERATIVOS — archivo reporteGastosSoftop, hoja "ReportePagos" — 13 columnas
Gastos operativos. PARTIDA DOBLE. **NO trae columna ÓPTICA** (pedirla al cargar).
Columnas: NO GASTOS, FACTURA, FECHA, ESTADO, CUENTA, DESCRIPCION, DESCRIPCION DE LA CUENTA,
TERCERO, VALOR, D/C, TOTAL, ABONO, SALDO.
- Cada gasto = 2 filas: D (cuenta de gasto real) + C (CUENTAS POR PAGAR).
- GASTO REAL = sumar SOLO filas con D/C = 'D'. No sumar toda la columna VALOR.

## 4. COMPROBANTES / TRASLADOS — archivo reporteComprobantesSoftop, hoja "ReporteComprobantes" — 12 columnas
Traslados CAJA MENOR → BANCO (consignaciones). PARTIDA DOBLE. Llave: NO COMPROBANTE.
Columnas: NO COMPROBANTE, FACTURA, FECHA, TIPO COMPROBANTE, FORMA DE PAGO, CUENTA,
DESCRIPCION, SUC, TERCERO, DEBITO, CREDITO, TOTAL.
- Cada comprobante = 2 filas: CRÉDITO a CAJA MENOR (cuenta 11050500) + DÉBITO a
  "banco de Bogotá corriente" (cuenta 11100507).
- MONTO del traslado = columna TOTAL (fila del banco). No sumar ambas filas.
- Cada traslado se vincula a una FOTO de consignación (ver feature).

## 5. PAGOS A PROVEEDORES — archivo reportePagos, hoja "ReportePagos" — 11 columnas
DISTINTO del reporte de Gastos. PARTIDA DOBLE. Llave: PAGO.
Columnas: PAGO, FECHA, OBSERVACIONES, COMPROBANTE, NO.FACTURA, PROVEEDOR, CUENTA,
DESCRIPCION, Debito, Credito, Usuario.
- Cada PAGO = N filas débito (facturas pagadas: COMPROBANTE de la compra + NO.FACTURA del
  proveedor) + 1 fila crédito (salida de CAJA MENOR o banco; ahí COMPROBANTE = el PAGO,
  NO.FACTURA vacío).
- Débito total = Crédito total.

## 6. CUÁNTO DEBO / CUENTAS POR PAGAR — archivo reporteCuantoDebo, hoja "ReportePagos" — 7 columnas
Saldo vivo de deuda a proveedores. Llave: COMPROBANTE ("Compra - N").
Columnas: COMPROBANTE, FECHA, NO.FACTURA, PROVEEDOR, CUENTA, DESCRIPCION, TOTAL.
- El N de "Compra - N" cruza con COMPROBANTE de Pagos a Proveedores.
- Cuando una factura se paga, sale de este reporte.

---

# AUDITORÍA CAMPO POR CAMPO (validar TODOS los campos)

Para cada reporte, al parsear, evaluar reglas y adjuntar a cada fila/registro la lista de
alertas con: `{ campo, severidad[ALTA|MEDIA|BAJA], tipo, mensaje }`. Severidad ALTA = posible
fraude/pérdida; MEDIA = inconsistencia; BAJA = calidad de datos.

## Venta Detallada
**Completitud (BAJA salvo indicado):** ÓPTICA vacío (ALTA), GRUPO vacío, FECHA vacía (ALTA),
TIPO DOCUMENTO vacío, CONSECUTIVO vacío (ALTA), ATENDIDO POR vacío, DOCUMENTO cliente vacío,
NOMBRES Y APELLIDOS vacío, TELEFONO vacío, MOTIVO DE VISITA vacío, REFERENCIA/MARCA vacías.
**Catálogo/consistencia (MEDIA):** ÓPTICA no existe en catálogo; TIPO MOVIMIENTO fuera de
{Venta, Abono}; ESTADO fuera de {Por Cancelar, Cerrada}; TIPO PRODUCTO fuera de catálogo;
METODO DE PAGO fuera de catálogo; FECHA futura o fuera del período declarado; HORA con formato
inválido; CODIGO DE SUCURSAL = 0 (sin sucursal); OPTOMETRA vacío cuando TIPO PRODUCTO es
Lentes Oftalmicos o Lentes de Contacto; MOTIVO DE VISITA con capitalización inconsistente
(normalizar con toLowerCase().trim() antes de comparar).
**Lógica financiera (ALTA):** CANTIDAD ≤ 0; PRECIO DE LISTA ≤ 0; PRECIO DE VENTA PRODUCTO ≤ 0;
PRECIO DE VENTA < COSTO DE COMPRA (venta a pérdida); DESCUENTO > 30% de (PRECIO DE LISTA ×
CANTIDAD); DESCUENTO > PRECIO DE LISTA × CANTIDAD (descuento imposible); COSTO DE COMPRA = 0 en
Lentes Oftalmicos/Lentes de Contacto (ver cruce B); ESTADO "Por Cancelar" con SALDO ACTUAL > 0
(cartera pendiente).
**Cuadre por orden (ALTA):** suma de PRECIO DE VENTA de líneas ≠ VENTAS TOTALES (excluir Abono);
si suma ≈ k×VENTAS TOTALES con k entero ≥ 2 → líneas duplicadas; SALDO ACTUAL ≠ SALDO ANTERIOR
+ VENTAS TOTALES − TOTAL RECAUDO.

## Pedido de Lentes
Completitud: ORDEN/PRODUCTO/LABORATORIO/VALOR vacíos. Consistencia: LABORATORIO fuera de
catálogo de proveedores; PRODUCTO sin formato "ID - Nombre"; FECHA ENTREGA = "NO" con FECHA
ORDEN antigua (> N días sin entregar) → alerta de retraso. Financiera (ALTA): VALOR ≤ 0; ORDEN
no existe en Venta Detallada (lente sin venta asociada).

## Gastos Operativos
Partida doble: cada NO GASTOS debe tener exactamente una D y una C; descuadre D≠C (ALTA).
Completitud: TERCERO, DESCRIPCION, FECHA, VALOR vacíos. Consistencia: ESTADO; FECHA fuera de
período; CUENTA/DESCRIPCION desconocida. Financiera: VALOR ≤ 0; SALDO ≠ 0 en la fila C (gasto
no saldado).

## Comprobantes / Traslados
Partida doble: cada NO COMPROBANTE con una fila CAJA MENOR (crédito) y una banco (débito);
DEBITO banco ≠ CREDITO caja (ALTA). Financiera: TOTAL ≤ 0; FECHA fuera de período.
Verificación (ALTA): traslado sin FOTO de consignación (ver feature).

## Pagos a Proveedores
Partida doble: por PAGO, suma débitos = suma créditos (ALTA si descuadra). Completitud:
PROVEEDOR, COMPROBANTE, NO.FACTURA (en filas débito), Usuario. Consistencia: PROVEEDOR fuera de
catálogo; FECHA fuera de período. Cruce (ver C/D).

## Cuánto Debo
Completitud: COMPROBANTE, NO.FACTURA, PROVEEDOR, TOTAL. Consistencia: COMPROBANTE sin formato
"Compra - N"; PROVEEDOR fuera de catálogo. Financiera: TOTAL ≤ 0. Cruce (ver C).

---

# CRUCES ENTRE REPORTES

## A. Intra Venta Detallada — ya cubierto arriba (reglas por fila + cuadre por orden).

## B. Venta Detallada ↔ Pedido de Lentes (costo cero en lentes)
Llave: `VentaDetallada.CONSECUTIVO == PedidoLentes.ORDEN` **Y**
`VentaDetallada.ID_PRODUCTO == int(PedidoLentes.PRODUCTO.split(" - ")[0])`.
Regla: si TIPO PRODUCTO ∈ {Lentes Oftalmicos, Lentes de Contacto} y COSTO DE COMPRA = 0 → ALERTA.
- Con pedido asociado → mostrar VALOR real del laboratorio y permitir actualizar/sugerir el costo.
- Sin pedido asociado → "costo faltante sin pedido de laboratorio".
(En datos reales el 44% de las líneas de lentes tienen costo 0.)

## C. Cuánto Debo ↔ Pagos a Proveedores (cuentas por pagar)
Llave: número de comprobante (quitar prefijo "Compra - ") + NO.FACTURA + PROVEEDOR.
Alertas: compra pendiente cuyo comprobante ya está en Pagos (doble registro); pago a factura
sin compra origen; monto pagado ≠ monto de la compra (parcial/sobrepago).
Vista: saldo por proveedor = total comprado − total pagado.

## D. Pagos a Proveedores ↔ Pedido de Lentes
Lo pagado a un laboratorio debe corresponder al costo (VALOR) de los lentes pedidos a ese
proveedor/factura.

---

# FEATURE: Metas y rendimiento
- Configurar METAS por óptica y período (solo ADMIN). Métricas: meta de ventas ($),
  meta de # órdenes, meta de ticket promedio, meta de margen %, meta de recaudo. Opcional:
  meta por vendedor (ATENDIDO POR).
- Calcular rendimiento REAL desde Venta Detallada agregando a nivel ORDEN (respetar
  granularidad mixta).
- Mostrar % de cumplimiento (real / meta) con semáforo rojo/amarillo/verde y alerta cuando
  esté bajo umbral configurable.
- Vistas: rendimiento por óptica, por vendedor, comparativa entre ópticas y entre períodos.

# FEATURE: Verificación de consignaciones con foto
- Cada traslado (NO COMPROBANTE de Comprobantes) representa una consignación CAJA MENOR → banco.
- Las asesoras suben una FOTO del comprobante bancario; se asocia al traslado.
- Conciliación: traslados con/sin foto; alerta "traslado sin comprobante de consignación".

# FEATURE: Conciliación bancaria
- INGRESOS al banco = pagos con tarjeta/transferencia de Venta Detallada (METODO DE PAGO no
  efectivo) + consignaciones de efectivo (traslados de Comprobantes).
- EGRESOS del banco = filas crédito a "banco de Bogotá corriente" en Pagos a Proveedores y Gastos.
- El usuario sube el EXTRACTO BANCARIO (Excel/PDF). **El formato exacto del extracto aún no está
  definido**: implementar el parser tras una interfaz `BankStatementParser` y dejar un TODO
  claro para mapear columnas cuando se tenga una muestra.
- Detecta: movimiento en Softop ausente en el extracto; movimiento en el extracto ausente en
  Softop; diferencias de monto.

---

# Modelo de datos (Prisma) — punto de partida
- `User(id, email, name, password, role[ADMIN|AUDITOR|VIEWER], createdAt)`
- `Optica(id, nombre, grupo, activa)`
- `Importacion(id, opticaId, periodo "YYYY-MM", tipoReporte[enum], fileName, uploadedBy,
  uploadedAt, totalFilas, filasConAlerta)`
- Una tabla por tipo de reporte con campos tipados + `raw Json` (fila completa) +
  `alerts Json[]` (`{campo, severidad, tipo, mensaje}`): `VentaDetalladaRow`, `PedidoLenteRow`,
  `GastoRow`, `ComprobanteRow` (con `fotoUrl`, `verificado`), `PagoProveedorRow`, `CuentaPorPagarRow`.
- `Meta(id, opticaId, periodo, metaVentas, metaOrdenes, metaTicketPromedio, metaMargenPct, metaRecaudo)`
- `ConsignacionFoto(id, comprobanteId, fileUrl, uploadedBy, uploadedAt)`
- `AlertaCruce(id, opticaId, periodo, tipoCruce[B|C|D], severidad, mensaje, refs Json)`
Índices sobre llaves de cruce: consecutivo, idProducto, comprobante, noFactura, proveedor.

# Páginas
- `/login`
- `/` dashboard: KPIs del período por óptica (ventas, recaudo, cartera pendiente, deuda a
  proveedores, # alertas por severidad), cumplimiento de meta con semáforo, gráficas (ventas por
  óptica, distribución por tipo de producto, tendencia diaria).
- `/cargar`: drag&drop; `detectReportType` por encabezados; si es Gastos pedir óptica; preview de
  10 filas → confirmar → parsear + validar + guardar.
- `/auditorias` y `/auditorias/[id]`: historial + tabla TanStack con filtros/búsqueda/paginación,
  filas con alerta en rojo (tooltip con motivos y severidad), panel de KPIs, exportar a Excel.
- `/alertas`: alertas consolidadas (campo + cruces A–D) del período, agrupadas por
  severidad/tipo, con drill-down.
- `/metas`: configurar metas (ADMIN) y ver rendimiento vs meta.
- `/consignaciones`: traslados con estado de foto (subir/ver); alertas de faltantes.
- `/conciliacion`: subir extracto y ver cruce.
- `/proveedores`: saldo por proveedor (comprado − pagado).
- `/opticas` y `/usuarios`: CRUD (ADMIN).

# Arquitectura
- `lib/parsers/`: un parser por reporte + `detectReportType(headers)`. Cada parser maneja filas
  vacías/totales, partida doble (sumar solo D), granularidad mixta, normalización y devuelve
  filas tipadas + alertas.
- `lib/audits/`: reglas de validación campo por campo por reporte (catálogos, completitud,
  lógica financiera, cuadres).
- `lib/cross-checks/`: una función por cruce (B, C, D) → alertas.
- `lib/storage/`: interfaz `StorageProvider` (local en dev).

# Criterios de aceptación
1. Subir los 6 reportes; `detectReportType` los identifica por encabezados y los parsea bien
   (partida doble, granularidad mixta, formatos "ID - Nombre" y "Compra - N").
2. La auditoría campo por campo produce alertas con severidad para cada reporte.
3. Cruce B marca lentes con costo 0 y muestra el costo real cuando existe.
4. Cruce C lista saldo por proveedor e inconsistencias de pago.
5. Detección de líneas duplicadas por descuadre suma-líneas vs VENTAS TOTALES.
6. Configurar metas y ver % de cumplimiento con semáforo.
7. Subir foto de consignación y vincularla a un traslado; faltantes como alerta.
8. Conciliación acepta extracto (parser adaptable + TODO de mapeo).
9. `npm run dev` tras `npx prisma migrate dev` + seed (1 admin + 3 ópticas: Óptica Medica,
   Óptica Popular, Vista Óptica — grupo Cali).

# Orden de implementación
1. Scaffold Next.js + Prisma + Shadcn + NextAuth + schema + seed.
2. `detectReportType` + parsers de los 6 reportes, con **tests unitarios** usando filas de
   ejemplo de este documento (partida doble, granularidad mixta, splits).
3. Carga + preview + persistencia + auditoría campo por campo (con severidad).
4. Tabla de auditoría con resaltado y exportación.
5. Cruces B, C, D + `/alertas` + `/proveedores`.
6. Metas y rendimiento.
7. Consignaciones con foto (storage abstraído).
8. Dashboard con KPIs y gráficas.
9. Conciliación bancaria (parser adaptable + TODO de extracto).

Empieza con:
`npx create-next-app@latest auditoria-softop --typescript --tailwind --app --eslint`
