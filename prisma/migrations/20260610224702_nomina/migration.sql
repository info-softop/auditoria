-- CreateTable
CREATE TABLE "PagoNomina" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "quincena" INTEGER,
    "salarioBase" DOUBLE PRECISION NOT NULL,
    "subsidioTransporte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deducciones" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "neto" DOUBLE PRECISION NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoNomina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoNomina_empleadoId_idx" ON "PagoNomina"("empleadoId");

-- CreateIndex
CREATE INDEX "PagoNomina_periodo_idx" ON "PagoNomina"("periodo");

-- AddForeignKey
ALTER TABLE "PagoNomina" ADD CONSTRAINT "PagoNomina_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
