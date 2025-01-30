/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `User`;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `rol` ENUM('estudiante', 'medico', 'administrador') NOT NULL,
    `carrera` VARCHAR(191) NULL,
    `sede` VARCHAR(191) NULL,
    `modalidad` ENUM('presencial', 'semipresencial', 'a_distancia') NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Medico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `especialidad` VARCHAR(191) NOT NULL,
    `horarioInicio` VARCHAR(191) NOT NULL,
    `horarioFin` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Medico_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estudianteId` INTEGER NOT NULL,
    `medicoId` INTEGER NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `modalidad` ENUM('presencial', 'semipresencial', 'a_distancia') NOT NULL,
    `estado` ENUM('pendiente', 'confirmada', 'cancelada', 'reprogramada') NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Recomendacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `citaId` INTEGER NOT NULL,
    `medicoId` INTEGER NOT NULL,
    `contenido` VARCHAR(191) NOT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reprogramacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `citaId` INTEGER NOT NULL,
    `nuevaFecha` DATETIME(3) NOT NULL,
    `nuevaHora` VARCHAR(191) NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notificacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `citaId` INTEGER NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `tipo` ENUM('recordatorio', 'confirmacion', 'cancelacion', 'otro') NOT NULL,
    `estado` ENUM('pendiente', 'enviado', 'leido') NOT NULL,
    `enviadoEn` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reporte` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periodo` VARCHAR(191) NOT NULL,
    `totalCitas` INTEGER NOT NULL,
    `citasCanceladas` INTEGER NOT NULL,
    `citasReprogramadas` INTEGER NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Medico` ADD CONSTRAINT `Medico_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_estudianteId_fkey` FOREIGN KEY (`estudianteId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_medicoId_fkey` FOREIGN KEY (`medicoId`) REFERENCES `Medico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recomendacion` ADD CONSTRAINT `Recomendacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recomendacion` ADD CONSTRAINT `Recomendacion_medicoId_fkey` FOREIGN KEY (`medicoId`) REFERENCES `Medico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reprogramacion` ADD CONSTRAINT `Reprogramacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
