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

/************************* NEW TABLES *************************/
/*
	Package level data for a publish request
*/
CREATE TABLE IF NOT EXISTS `publish_package`
(
	`id`	                        BIGINT(20)      NOT NULL AUTO_INCREMENT,
	`site_id`	                    BIGINT(20)	    NOT NULL,
	`target`	                    VARCHAR(20)	    NOT NULL,
	`title`                         VARCHAR(200)    NOT NULL,
	`schedule`	                    TIMESTAMP,
	`approval_state`	            ENUM ('SUBMITTED', 'APPROVED', 'REJECTED')	NOT NULL,
	`package_state`	                BIGINT          NOT NULL,
	`live_error`	                INT,
	`staging_error`	                INT,
	`submitter_id`	                BIGINT(20),
	`submitter_comment`	            TEXT,
	`submitted_on`	                TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`reviewer_id`	                BIGINT(20),
	`reviewer_comment`          	TEXT,
	`reviewed_on`	                TIMESTAMP,
	`published_on`	                TIMESTAMP,
	`package_type`	                ENUM ('INITIAL_PUBLISH', 'PUBLISH_ALL', 'ITEM_LIST')    NOT NULL,
	`commit_id`	                    CHAR(40),
	`published_staging_commit_id`	CHAR(40),
	`published_live_commit_id`	    CHAR(40),
	`old_package_id`	            VARCHAR(50), -- This is a temporary column to group the publish items of a package
	PRIMARY KEY (`id`),
	FOREIGN KEY `publish_package_site_id`(`site_id`) REFERENCES `site` (`id`) ON DELETE CASCADE,
	FOREIGN KEY `publish_package_submitter_id`(`submitter_id`) REFERENCES `user` (`id`),
	FOREIGN KEY `publish_package_reviewer_id`(`reviewer_id`) REFERENCES `user` (`id`),
	INDEX `publish_package_package_state` (`package_state`)
)
	ENGINE = InnoDB
	ROW_FORMAT = DYNAMIC ;

/*
	An item to be published as part of a package
*/
CREATE TABLE IF NOT EXISTS `publish_item`
(
	`id`                    BIGINT(20)              NOT NULL AUTO_INCREMENT,
	`package_id`            BIGINT(20)	            NOT NULL,
	`path`                  VARCHAR(2048)	        NOT NULL,
	`live_previous_path`    VARCHAR(2048),
	`staging_previous_path` VARCHAR(2048),
	`action`	            ENUM('ADD', 'UPDATE', 'DELETE')   NOT NULL,
	`user_requested`    	BOOLEAN	                NOT NULL,
	`publish_state`         BIGINT      	        NOT NULL,
	`live_error`            INT,
	`staging_error`         INT,
	PRIMARY KEY(`id`),
	FOREIGN KEY `publish_item_package_id`(`package_id`) REFERENCES `publish_package` (`id`) ON DELETE CASCADE
)
	ENGINE = InnoDB
	ROW_FORMAT = DYNAMIC ;

/*
	Allows to link a publish_item to an item if it exists (items can be deleted afterwards)
*/
CREATE TABLE IF NOT EXISTS `item_publish_item`
(
	`publish_item_id`	BIGINT  NOT NULL,
	`item_id`	        BIGINT  NOT NULL,
	FOREIGN KEY `item_publish_item_publish_item_id`(`publish_item_id`) REFERENCES `publish_item` (`id`) ON DELETE CASCADE,
	FOREIGN KEY `item_publish_item_item_id`(`item_id`) REFERENCES `item` (`id`) ON DELETE CASCADE
)
	ENGINE = InnoDB
	ROW_FORMAT = DYNAMIC ;

/*
	Keep track of old paths for published-and-then-renamed content items
*/
CREATE TABLE IF NOT EXISTS `item_target`
(
	`item_id`       	    BIGINT	        NOT NULL,
	`target`	            VARCHAR(20)	    NOT NULL,
	`previous_path`         VARCHAR(2048)   NULL,
	`last_published_on`     TIMESTAMP       NULL,
	`published_commit_id`   VARCHAR(40)     NULL,
	PRIMARY KEY(`item_id`, `target`),
	FOREIGN KEY `item_target_item_id`(`item_id`) REFERENCES `item` (`id`) ON DELETE CASCADE
)
	ENGINE = InnoDB
	ROW_FORMAT = DYNAMIC ;

/********************** PROCEDURE UPDATES **********************/
/* Updated to remove reference to publish_package table */
DROP PROCEDURE IF EXISTS deleteSiteRelatedItems ;

CREATE PROCEDURE deleteSiteRelatedItems(
	IN siteId VARCHAR(50))
BEGIN
	DECLARE id BIGINT(20);

	IF EXISTS (SELECT (1) FROM site WHERE site_id = siteId AND deleted = 0)
	THEN
		SELECT s.id into id
		FROM site s
		WHERE site_id = siteId AND deleted = 0;

		-- Item will cascade delete workflow
		DELETE FROM item WHERE site_id = id;

		-- user_properties
		DELETE FROM user_properties WHERE site_id = id;

		-- dependencies
		DELETE FROM dependency WHERE site = siteId;

		-- sequences
		DELETE FROM navigation_order_sequence WHERE site = siteId;

		-- remote repositories
		DELETE FROM remote_repository WHERE site_id = siteId;

		-- audit log
		DELETE FROM audit WHERE site_id = id;

		-- publish queue
		DELETE FROM publish_package WHERE site_id = id;

		-- processed_commits
		DELETE FROM processed_commits WHERE site_id = id;
	END IF;
END ;

/***************** TEMPORARY PROCEDURE UPDATES *****************/
CREATE PROCEDURE populateItemTarget(
	IN siteId BIGINT,
	IN publishTarget VARCHAR(20),
	IN publishedLastCommit VARCHAR(40))
BEGIN
	INSERT INTO item_target
			(item_id, target, previous_path, last_published_on, published_commit_id)
		SELECT i.id, publishTarget, i.previous_path, i.last_published_on, publishedLastCommit
		FROM item i
		WHERE i.site_id = siteId;
END ;
