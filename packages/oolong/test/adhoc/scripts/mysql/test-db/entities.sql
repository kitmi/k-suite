CREATE TABLE IF NOT EXISTS `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(200) NULL,
  `mobile` VARCHAR(20) NULL,
  `password` VARCHAR(200) NOT NULL DEFAULT "",
  `passwordSalt` CHAR(8) NOT NULL,
  `locale` TEXT NOT NULL,
  `status` ENUM('inactive', 'active', 'disabled', 'forbidden', 'deleted') NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `statusInactiveTimestamp` DATETIME NULL,
  `statusActiveTimestamp` DATETIME NULL,
  `statusDisabledTimestamp` DATETIME NULL,
  `statusForbiddenTimestamp` DATETIME NULL,
  `statusDeletedTimestamp` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`email`),
  UNIQUE KEY (`mobile`)
) AUTO_INCREMENT=100000;

