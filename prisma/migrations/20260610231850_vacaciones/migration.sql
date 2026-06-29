-- CreateTable
CREATE TABLE "Vacacion" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dias" DOUBLE PRECISION NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vacacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vacacion_empleadoId_idx" ON "Vacacion"("empleadoId");

-- AddForeignKey
ALTER TABLE "Vacacion" ADD CONSTRAINT "Vacacion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
