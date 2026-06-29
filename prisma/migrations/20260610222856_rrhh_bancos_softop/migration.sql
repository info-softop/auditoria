/*
  Warnings:

  - You are about to drop the column `activo` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `cargo` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `documento` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `fechaIngreso` on the `Empleado` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Empleado_activo_idx";

-- AlterTable
ALTER TABLE "Empleado" DROP COLUMN "activo",
DROP COLUMN "cargo",
DROP COLUMN "documento",
DROP COLUMN "email",
DROP COLUMN "fechaIngreso",
ADD COLUMN     "bancoNombre" TEXT,
ADD COLUMN     "cargoId" TEXT,
ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "correo" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'activo',
ADD COLUMN     "fechaAdmision" TIMESTAMP(3),
ADD COLUMN     "fechaRetiro" TIMESTAMP(3),
ADD COLUMN     "metodoPago" TEXT NOT NULL DEFAULT 'transferencia_debito',
ADD COLUMN     "motivoRetiro" TEXT,
ADD COLUMN     "municipalidad" TEXT,
ADD COLUMN     "notas" TEXT,
ADD COLUMN     "numeroCuenta" TEXT,
ADD COLUMN     "numeroIdentificacion" TEXT,
ADD COLUMN     "pensionAltoRiesgo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primerApellido" TEXT,
ADD COLUMN     "salarioIntegral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "segundoApellido" TEXT,
ADD COLUMN     "subsidioTransporte" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subsidioTransporteValor" DOUBLE PRECISION,
ADD COLUMN     "tipoContrato" TEXT NOT NULL DEFAULT 'indefinido',
ADD COLUMN     "tipoCuenta" TEXT,
ADD COLUMN     "tipoEmpleado" TEXT NOT NULL DEFAULT 'dependiente',
ADD COLUMN     "tipoIdentificacion" TEXT NOT NULL DEFAULT 'CC';

-- CreateTable
CREATE TABLE "CuentaBancaria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "bankCode" TEXT,
    "tipoCuenta" TEXT NOT NULL DEFAULT 'bank',
    "numeroCuenta" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "saldoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoInicialFecha" TIMESTAMP(3),
    "opticaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoBancario" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "direccion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoBancario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "area" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuentaBancaria_opticaId_idx" ON "CuentaBancaria"("opticaId");

-- CreateIndex
CREATE INDEX "MovimientoBancario_cuentaId_fecha_idx" ON "MovimientoBancario"("cuentaId", "fecha");

-- CreateIndex
CREATE INDEX "Empleado_estado_idx" ON "Empleado"("estado");

-- CreateIndex
CREATE INDEX "Empleado_cargoId_idx" ON "Empleado"("cargoId");

-- AddForeignKey
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_opticaId_fkey" FOREIGN KEY ("opticaId") REFERENCES "Optica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoBancario" ADD CONSTRAINT "MovimientoBancario_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
