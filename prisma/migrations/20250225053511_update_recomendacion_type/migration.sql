/*
  Warnings:

  - You are about to drop the column `recomendacion` on the `AtencionCita` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `AtencionCita` DROP COLUMN `recomendacion`,
    ADD COLUMN `recomendaciones` TEXT NULL,
    MODIFY `observaciones` TEXT NULL;

-- AlterTable
ALTER TABLE `HistoriaClinica` MODIFY `recomendaciones` TEXT NULL,
    MODIFY `observaciones` TEXT NULL;
