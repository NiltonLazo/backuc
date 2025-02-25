-- CreateTable
CREATE TABLE `AtencionCita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `citaId` INTEGER NOT NULL,
    `areaDerivacion` ENUM('SALUD_MENTAL', 'TRABAJO_SOCIAL', 'OTRO') NULL,
    `diagnosticoPresuntivo` ENUM('ANSIEDAD', 'DEPRESION', 'OTRO') NULL,
    `medioContacto` ENUM('PRESENCIAL', 'VIRTUAL', 'TELEFONICO') NULL,
    `recomendacion` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AtencionCita_citaId_key`(`citaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AtencionCita` ADD CONSTRAINT `AtencionCita_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
