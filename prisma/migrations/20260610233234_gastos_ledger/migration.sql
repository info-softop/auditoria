-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "fechaVence" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "concepto" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "subcategoria" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "tercero" TEXT,
    "terceroId" TEXT,
    "empleadoId" TEXT,
    "opticaId" TEXT,
    "cuentaBancariaId" TEXT,
    "movimientoId" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gasto_estado_idx" ON "Gasto"("estado");

-- CreateIndex
CREATE INDEX "Gasto_categoria_idx" ON "Gasto"("categoria");

-- CreateIndex
CREATE INDEX "Gasto_empleadoId_idx" ON "Gasto"("empleadoId");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_opticaId_fkey" FOREIGN KEY ("opticaId") REFERENCES "Optica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
