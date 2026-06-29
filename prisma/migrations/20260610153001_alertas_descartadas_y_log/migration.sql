-- CreateTable
CREATE TABLE "AlertaDescartada" (
    "id" TEXT NOT NULL,
    "alertaKey" TEXT NOT NULL,
    "optica" TEXT,
    "periodo" TEXT,
    "orden" TEXT,
    "tipo" TEXT,
    "mensaje" TEXT,
    "motivo" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaDescartada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertaDescartada_alertaKey_key" ON "AlertaDescartada"("alertaKey");

-- CreateIndex
CREATE INDEX "AlertaDescartada_userId_idx" ON "AlertaDescartada"("userId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_createdAt_idx" ON "RegistroAuditoria"("createdAt");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_userId_idx" ON "RegistroAuditoria"("userId");

-- AddForeignKey
ALTER TABLE "AlertaDescartada" ADD CONSTRAINT "AlertaDescartada_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
