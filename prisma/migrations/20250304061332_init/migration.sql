-- CreateTable
CREATE TABLE `AllowedEmail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('psicologo', 'administrador') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AllowedEmail_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Estudiante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `foto` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `sede` VARCHAR(191) NULL,
    `ciclo` INTEGER NULL,
    `carrera` VARCHAR(191) NULL,
    `modalidad` ENUM('presencial', 'semipresencial', 'a_distancia') NULL,
    `calendarAccessToken` TEXT NULL,
    `calendarRefreshToken` VARCHAR(191) NULL,
    `calendarTokenExpiry` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Estudiante_correo_key`(`correo`),
    UNIQUE INDEX `Estudiante_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Psicologo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `foto` VARCHAR(191) NULL,
    `sede` VARCHAR(191) NULL,
    `calendarAccessToken` TEXT NULL,
    `calendarRefreshToken` VARCHAR(191) NULL,
    `calendarTokenExpiry` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Psicologo_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Administrador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `foto` VARCHAR(191) NULL,
    `calendarAccessToken` TEXT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Administrador_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Horario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `psicologoId` INTEGER NOT NULL,
    `dia` ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo') NOT NULL,
    `horaInicio` VARCHAR(191) NOT NULL,
    `horaFin` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BloqueoHorario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `psicologoId` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estudiante_id` INTEGER NOT NULL,
    `psicologo_id` INTEGER NOT NULL,
    `motivo` VARCHAR(191) NOT NULL,
    `fecha` DATE NOT NULL,
    `hora` VARCHAR(5) NOT NULL,
    `tipo` ENUM('virtual', 'presencial') NOT NULL,
    `estado` ENUM('pendiente', 'atendida', 'no_asistio', 'cancelada', 'reprogramada') NOT NULL,
    `meetLink` VARCHAR(191) NULL,
    `calendarEventId` VARCHAR(191) NULL,
    `citaPreviaId` INTEGER NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Cita_psicologo_id_fecha_hora_key`(`psicologo_id`, `fecha`, `hora`),
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
    `estudianteId` INTEGER NULL,
    `psicologoId` INTEGER NULL,
    `administradorId` INTEGER NULL,
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

-- CreateTable
CREATE TABLE `HistoriaClinica` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `citaId` INTEGER NOT NULL,
    `diagnostico` VARCHAR(191) NOT NULL,
    `recomendaciones` TEXT NULL,
    `observaciones` TEXT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `HistoriaClinica_citaId_key`(`citaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AtencionCita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `citaId` INTEGER NOT NULL,
    `areaDerivacion` ENUM('tutoria', 'mentoria', 'topico', 'personal', 'CAS', 'defensoria_universitaria', 'vinculacion_internacional', 'docente', 'protocolo_de_salud_mental', 'servicio_social') NULL,
    `diagnosticoPresuntivo` ENUM('familiar', 'academico', 'agresivo_pasivo', 'ansiedad', 'antisocial', 'autoestima', 'bipolar', 'borderline', 'compulsivo_autocontrol', 'dependencia_videojuegos_internet', 'dependencia_alcohol_drogas', 'relacion_afectiva', 'depresion', 'desorden_alimenticio', 'duelo_fallecimiento', 'distimia', 'esquizoide', 'esquizotipico', 'estres', 'histrionico', 'ludopatia', 'narcisista', 'orientacion_vocacional', 'paranoide', 'servicio_social', 'somatoformo', 'trabajo_o_laboral') NULL,
    `medioContacto` ENUM('boca_a_boca', 'protocolo_de_salud_mental', 'entrevistas_de_vinculacion', 'correo_electronico', 'talleres_preventivos', 'citas_automatizadas', 'onboarding', 'app_movil') NULL,
    `recomendaciones` TEXT NULL,
    `observaciones` TEXT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AtencionCita_citaId_key`(`citaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Indicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sede` VARCHAR(191) NOT NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Indicacion_sede_key`(`sede`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Encuesta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `citaId` INTEGER NOT NULL,
    `pregunta1` INTEGER NOT NULL,
    `pregunta2` INTEGER NOT NULL,
    `pregunta3` INTEGER NOT NULL,
    `comentarios` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Encuesta_citaId_key`(`citaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Horario` ADD CONSTRAINT `Horario_psicologoId_fkey` FOREIGN KEY (`psicologoId`) REFERENCES `Psicologo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BloqueoHorario` ADD CONSTRAINT `BloqueoHorario_psicologoId_fkey` FOREIGN KEY (`psicologoId`) REFERENCES `Psicologo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_estudiante_id_fkey` FOREIGN KEY (`estudiante_id`) REFERENCES `Estudiante`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_psicologo_id_fkey` FOREIGN KEY (`psicologo_id`) REFERENCES `Psicologo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_citaPreviaId_fkey` FOREIGN KEY (`citaPreviaId`) REFERENCES `Cita`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reprogramacion` ADD CONSTRAINT `Reprogramacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_estudianteId_fkey` FOREIGN KEY (`estudianteId`) REFERENCES `Estudiante`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_psicologoId_fkey` FOREIGN KEY (`psicologoId`) REFERENCES `Psicologo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_administradorId_fkey` FOREIGN KEY (`administradorId`) REFERENCES `Administrador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notificacion` ADD CONSTRAINT `Notificacion_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoriaClinica` ADD CONSTRAINT `HistoriaClinica_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AtencionCita` ADD CONSTRAINT `AtencionCita_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Encuesta` ADD CONSTRAINT `Encuesta_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
