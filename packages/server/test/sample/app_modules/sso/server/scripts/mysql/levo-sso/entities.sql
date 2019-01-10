CREATE TABLE IF NOT EXISTS `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(200) NULL,
  `mobile` VARCHAR(20) NULL,
  `password` VARCHAR(200) NOT NULL DEFAULT "",
  `passwordSalt` CHAR(8) NOT NULL,
  `locale` TEXT NOT NULL,
  `isEmailVerified` TINYINT(1) NOT NULL,
  `isMobileVerified` TINYINT(1) NOT NULL,
  `status` ENUM('inactive', 'active', 'disabled', 'forbidden', 'deleted') NOT NULL,
  `tag` TEXT NULL,
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

CREATE TABLE IF NOT EXISTS `profile` (
  `firstName` VARCHAR(40) NULL,
  `middleName` VARCHAR(40) NULL,
  `surName` VARCHAR(40) NULL,
  `dob` DATETIME NULL,
  `avatar` VARCHAR(2000) NULL,
  `email` VARCHAR(200) NULL,
  `mobile` VARCHAR(20) NULL,
  `provider` VARCHAR(40) NULL,
  `providerId` VARCHAR(100) NULL,
  `owner` INT NOT NULL,
  `gender` VARCHAR(1) NOT NULL DEFAULT "",
  PRIMARY KEY (`owner`)
);

CREATE TABLE IF NOT EXISTS `gender` (
  `code` VARCHAR(1) NOT NULL DEFAULT "",
  `name` VARCHAR(20) NULL,
  PRIMARY KEY (`code`)
);

