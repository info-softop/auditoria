-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AUDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TipoReporte" AS ENUM ('VENTA_DETALLADA', 'PEDIDO_LENTES', 'GASTOS', 'COMPROBANTES', 'PAGOS_PROVEEDORES', 'CUENTAS_POR_PAGAR');

-- CreateEnum
CREATE TYPE "Severidad" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoCruce" AS ENUM ('B_COSTO_LENTE', 'C_CUENTAS_PAGAR', 'D_PAGO_LABORATORIO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AUDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Optica" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Optica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Importacion" (
    "id" TEXT NOT NULL,
    "opticaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipoReporte" "TipoReporte" NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalFilas" INTEGER NOT NULL DEFAULT 0,
    "filasConAlerta" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Importacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaDetalladaRow" (
    "id" TEXT NOT NULL,
    "importacionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "optica" TEXT NOT NULL,
    "grupo" TEXT,
    "fecha" TIMESTAMP(3),
    "hora" TEXT,
    "tipoDocumento" TEXT,
    "consecutivo" TEXT,
    "tipoMovimiento" TEXT,
    "atendidoPor" TEXT,
    "optometra" TEXT,
    "estado" TEXT,
    "codigoSucursal" TEXT,
    "documento" TEXT,
    "nombres" TEXT,
    "telefono" TEXT,
    "motivoVisita" TEXT,
    "idProducto" TEXT,
    "tipoProducto" TEXT,
    "categoria" TEXT,
    "referencia" TEXT,
    "marca" TEXT,
    "cantidad" DOUBLE PRECISION,
    "precioLista" DOUBLE PRECISION,
    "costoCompra" DOUBLE PRECISION,
    "descuento" DOUBLE PRECISION,
    "precioVenta" DOUBLE PRECISION,
    "metodoPago" TEXT,
    "autorizacion" TEXT,
    "factura" TEXT,
    "ventasTotales" DOUBLE PRECISION,
    "saldoAnterior" DOUBLE PRECISION,
    "abono" DOUBLE PRECISION,
    "abonoReciboCaja" DOUBLE PRECISION,
    "abonoReciboCajaEmp" DOUBLE PRECISION,
    "totalRecaudo" DOUBLE PRECISION,
    "valorCanje" DOUBLE PRECISION,
    "saldoActual" DOUBLE PRECISION,
    "raw" JSONB NOT NULL,
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "hasAlert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VentaDetalladaRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoLenteRow" (
    "id" TEXT NOT NULL,
    "importacionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "pedidoId" TEXT,
    "orden" TEXT,
    "fechaEntrega" TEXT,
    "producto" TEXT,
    "productoId" TEXT,
    "laboratorio" TEXT,
    "ordenLaboratorio" TEXT,
    "factura" TEXT,
    "fechaOrden" TIMESTAMP(3),
    "valor" DOUBLE PRECISION,
    "estado" TEXT,
    "raw" JSONB NOT NULL,
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "hasAlert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PedidoLenteRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoRow" (
    "id" TEXT NOT NULL,
    "importacionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "noGastos" TEXT,
    "factura" TEXT,
    "fecha" TIMESTAMP(3),
    "estado" TEXT,
    "cuenta" TEXT,
    "descripcion" TEXT,
    "descripcionCuenta" TEXT,
    "tercero" TEXT,
    "valor" DOUBLE PRECISION,
    "dc" TEXT,
    "total" DOUBLE PRECISION,
    "abono" DOUBLE PRECISION,
    "saldo" DOUBLE PRECISION,
    "raw" JSONB NOT NULL,
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "hasAlert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GastoRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprobanteRow" (
    "id" TEXT NOT NULL,
    "importacionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "noComprobante" TEXT,
    "factura" TEXT,
    "fecha" TIMESTAMP(3),
    "tipoComprobante" TEXT,
    "formaPago" TEXT,
    "cuenta" TEXT,
    "descripcion" TEXT,
    "suc" TEXT,
    "tercero" TEXT,
    "debito" DOUBLE PRECISION,
    "credito" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "raw" JSONB NOT NULL,
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "hasAlert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ComprobanteRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoProveedorRow" (
    "id" TEXT NOT NULL,
    "importacionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "pago" TEXT,
    "fecha" TIMESTAMP(3),
    "observaciones" TEXT,
    "comprobante" TEXT,
    "noFactura" TEXT,
    "proveedor" TEXT,
    "cuenta" TEXT,
    "descripcion" TEXT,
    "debito" DOUBLE PRECISION,
    "credito" DOUBLE PRECISION,
    "usuario" TEXT,
    "raw" JSONB NOT NULL,
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "hasAlert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PagoProveedorRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaPorPagarRow" (
    "id" TEXT NOT NULL,
    "importacionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "comprobante" TEXT,
    "comprobanteNum" TEXT,
    "fecha" TIMESTAMP(3),
    "noFactura" TEXT,
    "proveedor" TEXT,
    "cuenta" TEXT,
    "descripcion" TEXT,
    "total" DOUBLE PRECISION,
    "raw" JSONB NOT NULL,
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "hasAlert" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CuentaPorPagarRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaCruce" (
    "id" TEXT NOT NULL,
    "opticaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipoCruce" "TipoCruce" NOT NULL,
    "severidad" "Severidad" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "refs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaCruce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "opticaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "metaVentas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metaOrdenes" INTEGER NOT NULL DEFAULT 0,
    "metaTicketPromedio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metaMargenPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metaRecaudo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignacionFoto" (
    "id" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsignacionFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Optica_nombre_key" ON "Optica"("nombre");

-- CreateIndex
CREATE INDEX "Importacion_opticaId_periodo_tipoReporte_idx" ON "Importacion"("opticaId", "periodo", "tipoReporte");

-- CreateIndex
CREATE INDEX "VentaDetalladaRow_importacionId_idx" ON "VentaDetalladaRow"("importacionId");

-- CreateIndex
CREATE INDEX "VentaDetalladaRow_consecutivo_idProducto_idx" ON "VentaDetalladaRow"("consecutivo", "idProducto");

-- CreateIndex
CREATE INDEX "PedidoLenteRow_importacionId_idx" ON "PedidoLenteRow"("importacionId");

-- CreateIndex
CREATE INDEX "PedidoLenteRow_orden_productoId_idx" ON "PedidoLenteRow"("orden", "productoId");

-- CreateIndex
CREATE INDEX "GastoRow_importacionId_idx" ON "GastoRow"("importacionId");

-- CreateIndex
CREATE INDEX "ComprobanteRow_importacionId_idx" ON "ComprobanteRow"("importacionId");

-- CreateIndex
CREATE INDEX "ComprobanteRow_noComprobante_idx" ON "ComprobanteRow"("noComprobante");

-- CreateIndex
CREATE INDEX "PagoProveedorRow_importacionId_idx" ON "PagoProveedorRow"("importacionId");

-- CreateIndex
CREATE INDEX "PagoProveedorRow_comprobante_noFactura_proveedor_idx" ON "PagoProveedorRow"("comprobante", "noFactura", "proveedor");

-- CreateIndex
CREATE INDEX "CuentaPorPagarRow_importacionId_idx" ON "CuentaPorPagarRow"("importacionId");

-- CreateIndex
CREATE INDEX "CuentaPorPagarRow_comprobanteNum_noFactura_proveedor_idx" ON "CuentaPorPagarRow"("comprobanteNum", "noFactura", "proveedor");

-- CreateIndex
CREATE INDEX "AlertaCruce_opticaId_periodo_idx" ON "AlertaCruce"("opticaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "Meta_opticaId_periodo_key" ON "Meta"("opticaId", "periodo");

-- CreateIndex
CREATE INDEX "ConsignacionFoto_comprobanteId_idx" ON "ConsignacionFoto"("comprobanteId");

-- AddForeignKey
ALTER TABLE "Importacion" ADD CONSTRAINT "Importacion_opticaId_fkey" FOREIGN KEY ("opticaId") REFERENCES "Optica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Importacion" ADD CONSTRAINT "Importacion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalladaRow" ADD CONSTRAINT "VentaDetalladaRow_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "Importacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoLenteRow" ADD CONSTRAINT "PedidoLenteRow_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "Importacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRow" ADD CONSTRAINT "GastoRow_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "Importacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobanteRow" ADD CONSTRAINT "ComprobanteRow_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "Importacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoProveedorRow" ADD CONSTRAINT "PagoProveedorRow_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "Importacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorPagarRow" ADD CONSTRAINT "CuentaPorPagarRow_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "Importacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaCruce" ADD CONSTRAINT "AlertaCruce_opticaId_fkey" FOREIGN KEY ("opticaId") REFERENCES "Optica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_opticaId_fkey" FOREIGN KEY ("opticaId") REFERENCES "Optica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignacionFoto" ADD CONSTRAINT "ConsignacionFoto_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "ComprobanteRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignacionFoto" ADD CONSTRAINT "ConsignacionFoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
