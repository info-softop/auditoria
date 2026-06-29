/*
  Warnings:

  - You are about to drop the column `metaMargenPct` on the `Meta` table. All the data in the column will be lost.
  - You are about to drop the column `metaOrdenes` on the `Meta` table. All the data in the column will be lost.
  - You are about to drop the column `metaRecaudo` on the `Meta` table. All the data in the column will be lost.
  - You are about to drop the column `metaTicketPromedio` on the `Meta` table. All the data in the column will be lost.
  - You are about to drop the column `metaVentas` on the `Meta` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Meta" DROP COLUMN "metaMargenPct",
DROP COLUMN "metaOrdenes",
DROP COLUMN "metaRecaudo",
DROP COLUMN "metaTicketPromedio",
DROP COLUMN "metaVentas",
ADD COLUMN     "recaudoNivel1" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "recaudoNivel2" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "recaudoNivel3" DOUBLE PRECISION NOT NULL DEFAULT 0;
