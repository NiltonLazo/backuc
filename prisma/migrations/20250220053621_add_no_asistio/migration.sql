-- AlterTable
ALTER TABLE `Cita` MODIFY `estado` ENUM('pendiente', 'atendida', 'no_asistio', 'cancelada', 'reprogramada') NOT NULL;
