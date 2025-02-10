-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `rol` ENUM('estudiante', 'usuario', 'administrador', 'medico') NOT NULL,
    `sede` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `foto` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `ciclo` INTEGER NULL,
    `carrera` VARCHAR(191) NULL,
    `modalidad` ENUM('presencial', 'semipresencial', 'a_distancia') NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Usuario_correo_key`(`correo`),
    UNIQUE INDEX `Usuario_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HorarioMedico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `medicoId` INTEGER NOT NULL,
    `dia` ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo') NOT NULL,
    `horaInicio` VARCHAR(191) NOT NULL,
    `horaFin` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BloqueoHorario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `medicoId` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estudiante_id` INTEGER NOT NULL,
    `medico_id` INTEGER NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora` VARCHAR(5) NOT NULL,
    `tipo` ENUM('virtual', 'presencial') NOT NULL,
    `estado` ENUM('pendiente', 'confirmada', 'cancelada', 'reprogramada') NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Cita_medico_id_fecha_hora_key`(`medico_id`, `fecha`, `hora`),
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
    `citasAtendidas` INTEGER NOT NULL,
    `citasCanceladas` INTEGER NOT NULL,
    `citasReprogramadas` INTEGER NOT NULL,
    `citasVirtuales` INTEGER NOT NULL,
    `citasPresenciales` INTEGER NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HorarioMedico` ADD CONSTRAINT `HorarioMedico_medicoId_fkey` FOREIGN KEY (`medicoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BloqueoHorario` ADD CONSTRAINT `BloqueoHorario_medicoId_fkey` FOREIGN KEY (`medicoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `fk_cita_estudiante` FOREIGN KEY (`estudiante_id`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `fk_cita_medico` FOREIGN KEY (`medico_id`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recomendacion` ADD CONSTRAINT `Recomendacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recomendacion` ADD CONSTRAINT `Recomendacion_medicoId_fkey` FOREIGN KEY (`medicoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reprogramacion` ADD CONSTRAINT `Reprogramacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
