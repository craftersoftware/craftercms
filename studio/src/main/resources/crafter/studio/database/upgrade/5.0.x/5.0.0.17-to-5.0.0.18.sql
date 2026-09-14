/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

ALTER TABLE `audit` DROP COLUMN IF EXISTS `organization_id` ;

ALTER TABLE `group`
	DROP FOREIGN KEY IF EXISTS `group_ix_org_id`,
	DROP FOREIGN KEY IF EXISTS `group_ibfk_1`,
	DROP INDEX IF EXISTS `group_ix_org_id`,
	DROP INDEX IF EXISTS `group_ibfk_1`,
	DROP COLUMN IF EXISTS `org_id` ;
DROP TABLE IF EXISTS `organization_user` ;
DROP TABLE IF EXISTS `organization` ;
