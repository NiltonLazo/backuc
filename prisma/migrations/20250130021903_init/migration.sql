-- DropForeignKey
ALTER TABLE `Medico` DROP FOREIGN KEY `Medico_usuarioId_fkey`;

-- AlterTable
ALTER TABLE `Usuario` MODIFY `rol` ENUM('estudiante', 'usuario', 'medico', 'administrador') NOT NULL;
