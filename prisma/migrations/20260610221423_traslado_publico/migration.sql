-- CreateTable
CREATE TABLE "TrasladoPublico" (
    "id" TEXT NOT NULL,
    "opticaId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fecha" TIMESTAMP(3),
    "registradoPor" TEXT,
    "observacion" TEXT,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "comprobanteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrasladoPublico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrasladoPublico_opticaId_idx" ON "TrasladoPublico"("opticaId");

-- CreateIndex
CREATE INDEX "TrasladoPublico_revisado_idx" ON "TrasladoPublico"("revisado");

-- AddForeignKey
ALTER TABLE "TrasladoPublico" ADD CONSTRAINT "TrasladoPublico_opticaId_fkey" FOREIGN KEY ("opticaId") REFERENCES "Optica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
