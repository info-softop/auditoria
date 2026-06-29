# Auditoría Softop — Ópticas

Plataforma web de auditoría para ópticas. Carga reportes Excel exportados de Softop,
detecta anomalías mediante validación de campos y cruces entre reportes, mide rendimiento
contra metas, verifica consignaciones con foto y prepara la conciliación bancaria.

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 6 (PostgreSQL) ·
NextAuth v5 (Credentials) · shadcn/ui · TanStack Table · Recharts · SheetJS (xlsx).

## Puesta en marcha

```bash
# 1. Base de datos (PostgreSQL local ya configurada en .env)
#    DATABASE_URL=postgresql://USUARIO@localhost:5432/auditoria_opticas
npx prisma migrate dev      # aplica el esquema
npm run db:seed             # crea admin + 3 ópticas demo

# 2. Desarrollo
npm run dev                 # http://localhost:3000

# 3. Verificación
npm run typecheck           # tsc --noEmit
npm test                    # tests de los parsers
npm run build               # build de producción
```

### Credenciales demo
- Admin:   `admin@softop.la` / `admin123`
- Auditor: `auditor@softop.la` / `auditor123`

## Cómo funciona

1. **Cargar** (`/cargar`): arrastra un Excel de Softop. La app detecta el tipo de
   reporte por sus encabezados, lo valida y muestra una vista previa antes de confirmar.
2. **Auditorías** (`/auditorias`): historial de cargas; el detalle muestra cada fila con
   sus alertas (severidad ALTA/MEDIA/BAJA) resaltadas.
3. **Alertas** (`/alertas`): vista consolidada de alertas de campo + cruces entre reportes.
4. **Metas** (`/metas`): metas por óptica/período vs. rendimiento real.
5. **Consignaciones** (`/consignaciones`): traslados de dinero + foto de comprobante.
6. **Conciliación** (`/conciliacion`): ingresos/egresos vs. extracto bancario (pendiente
   de definir el formato del extracto — ver `src/lib/bank-statement.ts`).
7. **Proveedores** (`/proveedores`): cuentas por pagar (comprado − pagado).

## Reportes soportados (6)
Venta Detallada · Pedido de Lentes · Gastos Operativos · Comprobantes/Traslados ·
Pagos a Proveedores · Cuentas por Pagar.

## Cruces de auditoría
- **B** — Lentes con costo 0 en Venta vs. costo real en Pedido de Lentes.
- **C** — Cuentas por pagar vs. pagos a proveedores (saldo, dobles, descuadres).
- **D** — Pago a laboratorio vs. costo de lentes pedidos.

Especificación completa de columnas y reglas: ver `PROMPT.md`.

## Exportación
- Detalle de auditoría → Excel (incluye columna de alertas): botón en `/auditorias/[id]`.
- Alertas (cruces + por reporte) → Excel: botón en `/alertas`.

## Conciliación bancaria
Funcional con parser heurístico (`src/lib/bank-statement.ts`) que auto-detecta columnas
(fecha, descripción, débito/crédito o valor con signo) en exportaciones Excel/CSV de banco.
El motor (`src/lib/reconcile.ts`) cruza consignaciones y pagos a banco contra el extracto
y reporta conciliados / solo-Softop / solo-banco. Si un banco trae un formato muy particular,
se ajustan las pistas de columnas en `bank-statement.ts`.

## Pendientes (producción)
- Almacenamiento de fotos: cambiar `LocalStorageProvider` por S3/Vercel Blob (`src/lib/storage.ts`).
- Validar el parser de extracto contra exportaciones reales de cada banco (Bogotá, Bancolombia, Aval).
