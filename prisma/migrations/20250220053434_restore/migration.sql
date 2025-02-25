/*
  Warnings:

  - The values [no_asistio] on the enum `Cita_estado` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Cita` MODIFY `estado` ENUM('pendiente', 'atendida', 'cancelada', 'reprogramada') NOT NULL;
