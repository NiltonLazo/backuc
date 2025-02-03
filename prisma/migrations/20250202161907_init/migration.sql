/*
  Warnings:

  - The values [medico] on the enum `Usuario_rol` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[codigo]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `ciclo` INTEGER NULL,
    ADD COLUMN `codigo` VARCHAR(191) NULL,
    ADD COLUMN `telefono` VARCHAR(191) NULL,
    MODIFY `rol` ENUM('estudiante', 'usuario', 'administrador') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Usuario_codigo_key` ON `Usuario`(`codigo`);
