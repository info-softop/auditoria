-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "cargo" TEXT,
    "opticaId" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "fechaIngreso" TIMESTAMP(3),
    "salario" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Empleado_opticaId_idx" ON "Empleado"("opticaId");

-- CreateIndex
CREATE INDEX "Empleado_activo_idx" ON "Empleado"("activo");

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_opticaId_fkey" FOREIGN KEY ("opticaId") REFERENCES "Optica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
