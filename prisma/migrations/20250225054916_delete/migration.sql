/*
  Warnings:

  - You are about to drop the column `creadaEn` on the `AtencionCita` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `AtencionCita` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `AtencionCita` DROP COLUMN `creadaEn`,
    DROP COLUMN `updatedAt`;
