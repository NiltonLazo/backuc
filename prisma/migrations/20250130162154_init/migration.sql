/*
  Warnings:

  - Added the required column `citasAtendidas` to the `Reporte` table without a default value. This is not possible if the table is not empty.
  - Added the required column `citasPresenciales` to the `Reporte` table without a default value. This is not possible if the table is not empty.
  - Added the required column `citasVirtuales` to the `Reporte` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Reporte` ADD COLUMN `citasAtendidas` INTEGER NOT NULL,
    ADD COLUMN `citasPresenciales` INTEGER NOT NULL,
    ADD COLUMN `citasVirtuales` INTEGER NOT NULL;
