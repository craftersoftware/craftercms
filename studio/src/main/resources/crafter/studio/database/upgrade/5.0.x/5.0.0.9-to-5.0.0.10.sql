/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

CREATE TABLE IF NOT EXISTS `system_properties`
(
	`id`            BIGINT(20)		NOT NULL AUTO_INCREMENT,
	`property_name`  VARCHAR(50)	NOT NULL,
	`property_value` TEXT			NOT NULL,
	PRIMARY KEY (`id`),
	UNIQUE INDEX `system_properties_ix_property_name` (`property_name`)
)
	ENGINE = InnoDB
	ROW_FORMAT = DYNAMIC ;
