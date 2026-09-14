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

UPDATE `audit` SET `operation` = 'APPROVE_PUBLISH_PACKAGE' WHERE `operation` = 'APPROVE' ;

UPDATE `audit` SET `operation` = 'PUBLISH_ITEM_LIST_COMPLETE' WHERE `operation` = 'PUBLISHED' ;

UPDATE `audit` SET `operation` = 'INITIAL_PUBLISH_COMPLETE' WHERE `operation` = 'INITIAL_PUBLISH' ;

UPDATE `audit` SET `operation` = 'PUBLISH_ALL_COMPLETE' WHERE `operation` = 'PUBLISH_ALL' ;

UPDATE `activity_stream` SET `action` = 'APPROVE_PUBLISH_PACKAGE' WHERE `action` = 'APPROVE' ;

UPDATE `activity_stream` SET `action` = 'PUBLISH_ITEM_LIST_COMPLETE' WHERE `action` = 'PUBLISHED' ;

UPDATE `activity_stream` SET `action` = 'INITIAL_PUBLISH_COMPLETE' WHERE `action` = 'INITIAL_PUBLISH' ;

UPDATE `activity_stream` SET `action` = 'PUBLISH_ALL_COMPLETE' WHERE `action` = 'PUBLISH_ALL' ;

