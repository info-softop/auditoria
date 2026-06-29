-- CreateTable
CREATE TABLE "AlertaSeveridad" (
    "id" TEXT NOT NULL,
    "alertaKey" TEXT NOT NULL,
    "severidad" "Severidad" NOT NULL,
    "optica" TEXT,
    "periodo" TEXT,
    "orden" TEXT,
    "tipo" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaSeveridad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertaSeveridad_alertaKey_key" ON "AlertaSeveridad"("alertaKey");

-- CreateIndex
CREATE INDEX "AlertaSeveridad_userId_idx" ON "AlertaSeveridad"("userId");

-- AddForeignKey
ALTER TABLE "AlertaSeveridad" ADD CONSTRAINT "AlertaSeveridad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
