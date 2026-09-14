USE @crafter_schema_name ;

/*
	For each item in a given site, scan the items for a parent item (a page if exists, otherwise the parent folder)
	and update parent_id
 */
CREATE PROCEDURE populateItemParentId(IN siteId BIGINT)
BEGIN
	UPDATE item,
		(SELECT id, max(potential_parent_path) as calculated_parent_path,
						(SELECT p.id FROM item p WHERE (p.path = max(potential_parent_path)) and p.site_id = siteId) AS calculated_parent_id
		FROM
            (SELECT candidates.id, candidates.path, candidates.parent_id, i.id as potential_parent_id,
					candidates.parent_path as potential_parent_path
			FROM (
					SELECT id, parent_id, path,
							reverse(substr(reverse(trim('/index.xml' from path)), locate('/', reverse(trim('/index.xml' from path)))+1)) AS parent_path
					FROM item
					WHERE site_id = siteId
				UNION
					SELECT id, parent_id, path,
							concat(reverse(substr(reverse(trim('/index.xml' from path)), locate('/', reverse(trim('/index.xml' from path)))+1)), '/index.xml') AS parent_path
					FROM item
					WHERE site_id = siteId
				) AS candidates INNER JOIN item i ON candidates.parent_path = i.path AND i.site_id = siteId
				WHERE i.site_id = siteId
			) AS mapped
		GROUP BY id
		) AS updates
	SET item.parent_id = updates.calculated_parent_id
	WHERE item.id = updates.id;
END ;

/**
	Duplicates a site and its data from the tables:
	 - remote_repository
	 - dependency
	 - item

	 Note: this procedure depends on populateItemParentId
**/
CREATE PROCEDURE duplicate_site(IN sourceSiteId VARCHAR(50),
									IN siteId VARCHAR(2000),
									IN name VARCHAR(2000),
									IN description VARCHAR(2000),
									IN sandboxBranch VARCHAR(2000),
									IN uuid VARCHAR(2000))
BEGIN
	INSERT INTO site (id, site_uuid, site_id, name, description, deleted, last_commit_id, system, publishing_enabled, publishing_status, sandbox_branch, published_repo_created, state)
		SELECT null, uuid, siteId, name, description, s.deleted, s.last_commit_id, s.system, 1, 'ready', IFNULL(NULLIF(sandboxBranch, ''), 'master'), s.published_repo_created, 'INITIALIZING' FROM site s WHERE s.site_id = sourceSiteId AND s.deleted = 0;

	INSERT INTO remote_repository (id, site_id, remote_name, remote_url, authentication_type, remote_username, remote_password, remote_token, remote_private_key)
		SELECT null, siteId, r.remote_name, r.remote_url, r.authentication_type, r.remote_username, r.remote_password, r.remote_token, r.remote_private_key FROM remote_repository r WHERE r.site_id = sourceSiteId;

	INSERT INTO dependency (id, site, source_path, target_path, type, valid)
		SELECT null, siteId, d.source_path, d.target_path, d.type, d.valid FROM dependency d WHERE d.site = sourceSiteId;

	INSERT INTO item (id, record_last_updated, site_id, path, preview_url, state, locked_by, created_by, created_on, last_modified_by, last_modified_on, label, content_type_id, system_type, mime_type, locale_code, translation_source_id, size, parent_id, ignored, saved_as_draft)
		SELECT null, i.record_last_updated, (SELECT id FROM site WHERE site_id = siteId AND deleted = 0), i.path, i.preview_url, i.state, i.locked_by, i.created_by, i.created_on, i.last_modified_by, i.last_modified_on, i.label, i.content_type_id, i.system_type, i.mime_type, i.locale_code, i.translation_source_id, i.size, i.parent_id, i.ignored, i.saved_as_draft FROM item i inner join site s ON i.site_id = s.id WHERE s.site_id = sourceSiteId;

	SELECT id FROM site WHERE site_id = siteId AND deleted = 0 INTO @siteNumericId;

	SELECT id FROM site WHERE site_id = sourceSiteId AND deleted = 0 INTO @sourceSiteNumericId;

	INSERT INTO item_target(item_id, target, previous_path, last_published_on, published_commit_id)
	SELECT newItem.id, target, previous_path, last_published_on, published_commit_id
	FROM item_target it
		INNER JOIN item sourceItem ON sourceItem.id = it.item_id
		INNER JOIN item newItem ON sourceItem.path = newItem.path
	WHERE sourceItem.site_id = @sourceSiteNumericId
	AND newItem.site_id = @siteNumericId;

	INSERT INTO processed_commits (id, site_id, commit_id)
		SELECT null, @siteNumericId, pc.commit_id
		FROM processed_commits pc
		WHERE site_id = @sourceSiteNumericId;

	CALL populateItemParentId(@siteNumericId);
END ;

CREATE PROCEDURE addColumnIfNotExists(
	IN schemaName tinytext,
	IN tableName tinytext,
	IN columnName tinytext,
	IN columnDefinition text)
  BEGIN
	IF NOT EXISTS (
			SELECT * FROM information_schema.COLUMNS
			WHERE column_name = columnName
			  AND table_name = tableName
			  AND table_schema = schemaName
		)
	THEN
		SET @addColumn=CONCAT('ALTER TABLE ', schemaName, '.', tableName,
							  ' ADD COLUMN ', columnName, ' ', columnDefinition);
		PREPARE statement FROM @addColumn;
		EXECUTE statement;
	END IF;
  END ;

CREATE PROCEDURE dropColumnIfExists(
	IN schemaName tinytext,
	IN tableName tinytext,
	IN columnName tinytext)
BEGIN
	IF EXISTS (
			SELECT * FROM information_schema.COLUMNS
			WHERE column_name = columnName
			  AND table_name = tableName
			  AND table_schema = schemaName
		)
	THEN
		SET @dropColumn=CONCAT('ALTER TABLE ', schemaName, '.', tableName,
							  ' DROP COLUMN ', columnName);
		PREPARE statement FROM @dropColumn;
		EXECUTE statement;
	END IF;
END ;

CREATE PROCEDURE addUniqueIfNotExists(
	IN schemaName tinytext,
	IN tableName tinytext,
	IN uniqueName tinytext,
	IN uniqueDefinition text)
BEGIN
	IF NOT EXISTS (
			SELECT * FROM information_schema.STATISTICS
			WHERE index_name = uniqueName
			  AND table_name = tableName
			  AND table_schema = schemaName
		)
	THEN
		SET @addUnique=CONCAT('ALTER TABLE ', schemaName, '.', tableName,
							  ' ADD UNIQUE ', uniqueName, ' ', uniqueDefinition);
		PREPARE statement FROM @addUnique;
		EXECUTE statement;
	END IF;
END ;

CREATE PROCEDURE dropIndexIfExists(
	IN schemaName tinytext,
	IN tableName tinytext,
	IN indexName tinytext)
BEGIN
	IF EXISTS (
			SELECT * FROM information_schema.STATISTICS
			WHERE index_name = indexName
			  AND table_name = tableName
			  AND table_schema = schemaName
		)
	THEN
		SET @dropIndex=CONCAT('ALTER TABLE ', schemaName, '.', tableName,
							   ' DROP INDEX ', indexName);
		PREPARE statement FROM @dropIndex;
		EXECUTE statement;
	END IF;
END ;

CREATE PROCEDURE addIndexIfNotExists(
	IN schemaName tinytext,
	IN tableName tinytext,
	IN indexName tinytext,
	IN indexDefinition text)
BEGIN
	IF NOT EXISTS (
			SELECT * FROM information_schema.STATISTICS
			WHERE index_name = indexName
			  AND table_name = tableName
			  AND table_schema = schemaName
		)
	THEN
		SET @addIndex=CONCAT('ALTER TABLE ', schemaName, '.', tableName,
							 ' ADD INDEX ', indexName, ' ', indexDefinition);
		PREPARE statement FROM @addIndex;
		EXECUTE statement;
	END IF;
END ;

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

CREATE TABLE _meta (
	`version` VARCHAR(10) NOT NULL,
	`integrity` BIGINT(10),
	`studio_id` VARCHAR(40) NOT NULL,
	PRIMARY KEY (`version`)
) ;

INSERT INTO _meta (version, studio_id) VALUES ('5.0.0.24', UUID()) ;

CREATE TABLE IF NOT EXISTS `audit` (
	`id`                        BIGINT(20)    NOT NULL AUTO_INCREMENT,
	`site_id`                   BIGINT(20)    NOT NULL,
	`operation`                 VARCHAR(32)   NOT NULL,
	`operation_timestamp`       TIMESTAMP      NOT NULL,
	`origin`                    VARCHAR(16)   NOT NULL,
	`primary_target_id`         VARCHAR(1024)  NOT NULL,
	`primary_target_type`       VARCHAR(32)   NOT NULL,
	`primary_target_subtype`    VARCHAR(32)   NULL,
	`primary_target_value`      VARCHAR(1024)  NOT NULL,
	`actor_id`                  VARCHAR(255)  NOT NULL,
	`actor_details`             VARCHAR(255)  NULL,
	`cluster_node_id`           VARCHAR(255)  NULL,
	`commit_id`                 VARCHAR(50)   NULL,
	PRIMARY KEY (`id`),
	KEY `audit_actor_idx` (`actor_id`),
	KEY `audit_site_idx` (`site_id`),
	KEY `audit_operation_idx` (`operation`),
	KEY `audit_origin_idx` (`origin`),
	KEY `audit_primary_target_value_idx` (`primary_target_value`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `audit_parameters` (
	`id`                BIGINT(20) NOT NULL AUTO_INCREMENT,
	`audit_id`          BIGINT(20) NOT NULL,
	`target_id`         VARCHAR(1024)  NOT NULL,
	`target_type`       VARCHAR(32)   NOT NULL,
	`target_value`      VARCHAR(1024)  NOT NULL,
	PRIMARY KEY (`id`),
	FOREIGN KEY `audit_parameters_ix_audit_id` (`audit_id`) REFERENCES `audit` (`id`)
	   ON DELETE CASCADE,
	KEY `audit_parameters_target_id_idx` (`target_id`),
	KEY `audit_parameters_target_value_idx` (`target_value`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `dependency` (
	`id`          BIGINT(20)  NOT NULL AUTO_INCREMENT,
	`site`        VARCHAR(50) NOT NULL,
	`source_path` TEXT        NOT NULL,
	`target_path` TEXT        NOT NULL,
	`type`        VARCHAR(50) NOT NULL,
	`valid`       BIT         NOT NULL DEFAULT 1,
	PRIMARY KEY (`id`),
	KEY `dependency_site_idx` (`site`),
	KEY `dependency_sourcepath_idx` (`source_path`(1000)),
	KEY `dependency_targetpath_idx` (`target_path`(1000))
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `site` (
	`id`                              BIGINT(20)    NOT NULL AUTO_INCREMENT,
	`site_uuid`                       VARCHAR(50)   NOT NULL,
	`site_id`                         VARCHAR(50)   NOT NULL,
	`name`                            VARCHAR(255)  NOT NULL,
	`description`                     TEXT          NULL,
	`deleted`                         INT           NOT NULL DEFAULT 0,
	`last_commit_id`                  VARCHAR(50)   NULL,
	`system`                          INT           NOT NULL DEFAULT 0,
	`publishing_enabled`              INT           NOT NULL DEFAULT 1,
	`publishing_status`               VARCHAR(20)   NULL,
	`sandbox_branch`                  VARCHAR(255)  NOT NULL DEFAULT 'master',
	`published_repo_created`          INT           NOT NULL DEFAULT 0,
	`state`                           VARCHAR(50)   NOT NULL DEFAULT 'INITIALIZING',
	PRIMARY KEY (`id`),
	UNIQUE INDEX `id_unique` (`id` ASC),
	UNIQUE INDEX `site_uuid_site_id_unique` (`site_uuid` ASC, `site_id` ASC),
	INDEX `site_id_idx` (`site_id` ASC)
)

	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `processed_commits`
(
	`id`        BIGINT(20)      NOT NULL AUTO_INCREMENT,
	`site_id`   BIGINT(20)      NOT NULL,
	`commit_id` CHAR(40)        NOT NULL,
	PRIMARY KEY(`id`),
	UNIQUE INDEX `ingested_commits_commit_id_site_id` (`commit_id`, `site_id`),
	FOREIGN KEY `ingested_commits_site_id` (`site_id`) REFERENCES `site` (`id`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `user`
(
	`id`                    BIGINT(20)   NOT NULL AUTO_INCREMENT,
	`record_last_updated`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`username`              VARCHAR(255)  NOT NULL,
	`password`              VARCHAR(128)  NOT NULL,
	`first_name`             VARCHAR(32)  NOT NULL,
	`last_name`              VARCHAR(32)  NOT NULL,
	`externally_managed`    INT          NOT NULL DEFAULT 0,
	`timezone`              VARCHAR(16)  NULL,
	`locale`                VARCHAR(8)   NULL,
	`email`                 VARCHAR(255) NOT NULL,
	`enabled`               INT          NOT NULL,
	`avatar`                TEXT         NULL, -- TODO: update the user service to include this new field
	PRIMARY KEY (`id`),
	INDEX `user_ix_record_last_updated` (`record_last_updated` DESC),
	UNIQUE INDEX `user_ix_username` (`username`),
	INDEX `user_ix_first_name` (`first_name`),
	INDEX `user_ix_last_name` (`last_name`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `activity_stream` (
	`id`                        BIGINT(20)      NOT NULL AUTO_INCREMENT,
	`site_id`                   BIGINT(20)      NOT NULL,
	`user_id`                   BIGINT(20)      NOT NULL,
	`action`                    VARCHAR(32)     NOT NULL,
	`action_timestamp`          TIMESTAMP       NOT NULL,
	`item_id`                   BIGINT(20)      NULL,
	`item_path`                 VARCHAR(2048)   NULL,
	`item_label`                VARCHAR(256)    NULL,
	`package_id`                VARCHAR(50)     NULL,
	PRIMARY KEY (`id`),
	FOREIGN KEY `activity_user_idx` (`user_id`) REFERENCES `user`(`id`),
	FOREIGN KEY `activity_site_idx` (`site_id`) REFERENCES `site`(`id`),
	INDEX `activity_action_idx` (`action` ASC)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

INSERT IGNORE INTO `user` (id, record_last_updated, username, password, first_name, last_name,
						   externally_managed, timezone, locale, email, enabled)
VALUES (1, CURRENT_TIMESTAMP, 'admin', 'vTwNOJ8GJdyrP7rrvQnpwsd2hCV1xRrJdTX2sb51i+w=|R68ms0Od3AngQMdEeKY6lA==',
		'admin', 'admin', 0, 'EST5EDT', 'en/US', 'evaladmin@example.com', 1) ;

INSERT IGNORE INTO `user` (id, record_last_updated, username, password, first_name, last_name,
						   externally_managed, timezone, locale, email, enabled)
VALUES (2, CURRENT_TIMESTAMP, 'git_repo_user', '',
		   'Git Repo', 'User', 0, 'EST5EDT', 'en/US', 'evalgit@example.com', 1) ;

CREATE TABLE IF NOT EXISTS `user_properties`
(
	`id` BIGINT(20) NOT NULL AUTO_INCREMENT,
	`user_id` BIGINT(20) NOT NULL,
	`site_id` BIGINT(20) NOT NULL,
	`property_key` VARCHAR(255) NOT NULL,
	`property_value` TEXT NOT NULL,
	PRIMARY KEY (`id`),
	FOREIGN KEY `user_property_ix_user_id` (`user_id`) REFERENCES `user` (`id`),
	FOREIGN KEY `user_property_ix_site_id` (`site_id`) REFERENCES `site` (`id`),
	UNIQUE INDEX `user_property_ix_property_key` (`user_id`, `site_id`, `property_key`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `group`
(
	`id`                  BIGINT(20)  NOT NULL AUTO_INCREMENT,
	`record_last_updated` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`group_name`          VARCHAR(512) NOT NULL,
	`group_description`   TEXT,
	`externally_managed`  INT          NOT NULL DEFAULT 0,
	PRIMARY KEY (`id`),
	INDEX `group_ix_record_last_updated` (`record_last_updated` DESC),
	UNIQUE INDEX `group_ix_group_name` (`group_name`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

INSERT IGNORE INTO `group` (id, record_last_updated, group_name, group_description, externally_managed)
VALUES (1, CURRENT_TIMESTAMP, 'system_admin', 'System Administrator group', 0) ;

INSERT IGNORE INTO `group` (id, record_last_updated, group_name, group_description, externally_managed)
VALUES (2, CURRENT_TIMESTAMP, 'site_admin', 'Site Administrator group', 0) ;

INSERT IGNORE INTO `group` (id, record_last_updated, group_name, group_description, externally_managed)
VALUES (3, CURRENT_TIMESTAMP, 'site_author', 'Site Author group', 0) ;

INSERT IGNORE INTO `group` (id, record_last_updated, group_name, group_description, externally_managed)
VALUES (4, CURRENT_TIMESTAMP, 'site_publisher', 'Site Publisher group', 0) ;

INSERT IGNORE INTO `group` (id, record_last_updated, group_name, group_description, externally_managed)
VALUES (5, CURRENT_TIMESTAMP, 'site_developer', 'Site Developer group', 0) ;

INSERT IGNORE INTO `group` (id, record_last_updated, group_name, group_description, externally_managed)
VALUES (6, CURRENT_TIMESTAMP, 'site_reviewer', 'Site Reviewer group', 0) ;

CREATE TABLE IF NOT EXISTS group_user
(
	`user_id`  BIGINT(20) NOT NULL,
	`group_id`  BIGINT(20)       NOT NULL,
	`externally_managed` INT NOT NULL DEFAULT 0,
	`record_last_updated` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`user_id`, `group_id`),
	FOREIGN KEY group_member_ix_user_id(`user_id`) REFERENCES `user` (`id`)
		ON DELETE CASCADE,
	FOREIGN KEY group_member_ix_group_id(`group_id`) REFERENCES `group` (`id`)
		ON DELETE CASCADE,
	INDEX `group_member_ix_record_last_updated` (`record_last_updated` DESC)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `item` (
  `id`                      BIGINT          NOT NULL    AUTO_INCREMENT,
  `record_last_updated`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `site_id`                 BIGINT          NOT NULL,
  `path`                    VARCHAR(2048)   NOT NULL,
  `preview_url`             VARCHAR(2048)   NULL,
  `state`                   BIGINT          NOT NULL,
  `locked_by`               BIGINT          NULL,
  `created_by`              BIGINT          NULL,
  `created_on`              TIMESTAMP       NOT NULL    DEFAULT CURRENT_TIMESTAMP,
  `last_modified_by`        BIGINT          NULL,
  `last_modified_on`        TIMESTAMP       NOT NULL    DEFAULT CURRENT_TIMESTAMP,
  `label`                   VARCHAR(256)    NULL,
  `content_type_id`         VARCHAR(256)    NULL,
  `system_type`             VARCHAR(64)     NULL,
  `mime_type`               VARCHAR(96)     NULL,
  `locale_code`             VARCHAR(16)     NULL,
  `translation_source_id`   BIGINT          NULL,
  `size`                    BIGINT          NULL,
  `parent_id`               BIGINT          NULL,
  `ignored`                 INT             NOT NULL    DEFAULT 0,
  `saved_as_draft`          BOOLEAN         NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY item_ix_created_by(`created_by`) REFERENCES `user` (`id`),
  FOREIGN KEY item_ix_last_modified_by(`last_modified_by`) REFERENCES `user` (`id`),
  FOREIGN KEY item_ix_locked_by(`locked_by`) REFERENCES `user` (`id`),
  FOREIGN KEY item_ix_site_id(`site_id`) REFERENCES `site` (`id`),
  FOREIGN KEY item_ix_parent(`parent_id`) REFERENCES `item` (`id`) ON DELETE CASCADE ,
  UNIQUE uq_i_site_path (`site_id`, `path`(900)),
  INDEX item_i_path (`path` ASC)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `item_translation` (
  `id`                      BIGINT(20) NOT NULL AUTO_INCREMENT,
  `record_last_updated`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `source_id`               BIGINT(20)      NOT NULL,
  `translation_id`          BIGINT(20)      NOT NULL,
  `locale_code`             VARCHAR(16)     NOT NULL,
  `date_translated`         TIMESTAMP       NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY `item_translation_ix_source`(`source_id`) REFERENCES `item` (`id`) ON DELETE CASCADE,
  FOREIGN KEY `item_translation_ix_translation`(`translation_id`) REFERENCES `item` (`id`) ON DELETE CASCADE
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS remote_repository
(
	`id`                    BIGINT(20)    NOT NULL AUTO_INCREMENT,
	`site_id`               VARCHAR(50)   NOT NULL,
	`remote_name`           VARCHAR(50)   NOT NULL,
	`remote_url`            VARCHAR(2000)   NOT NULL,
	`authentication_type`   VARCHAR(16)   NOT NULL,
	`remote_username`       VARCHAR(255)   NULL,
	`remote_password`       VARCHAR(500)   NULL,
	`remote_token`          VARCHAR(255)   NULL,
	`remote_private_key`    TEXT           NULL,
	PRIMARY KEY (`id`),
	UNIQUE `uq_rr_site_remote_name` (`site_id`, `remote_name`),
	INDEX `remoterepository_site_idx` (`site_id` ASC)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS cluster
(
	`id`                  BIGINT(20)    NOT NULL AUTO_INCREMENT,
	`local_address`            VARCHAR(255)   NOT NULL,
	`state`              VARCHAR(50)   NOT NULL,
	`git_url`             VARCHAR(1024)  NOT NULL,
	`git_remote_name`     VARCHAR(255)   NOT NULL,
	`git_auth_type`       VARCHAR(16)   NOT NULL,
	`git_username`        VARCHAR(255)  NULL,
	`git_password`        VARCHAR(255)  NULL,
	`git_token`           VARCHAR(255)  NULL,
	`git_private_key`     TEXT          NULL,
	`heartbeat`           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`available`           INT           NOT NULL DEFAULT 1,
	PRIMARY KEY (`id`),
	UNIQUE `uq_cl_git_url` (`git_url`),
	UNIQUE `uq_cl_git_remote_name` (`git_remote_name`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `refresh_token`
(
	`user_id` BIGINT(20) PRIMARY KEY, -- Add FK
	`token` VARCHAR(50) NOT NULL,
	`last_updated_on` TIMESTAMP,
	`created_on` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `access_token`
(
	`id`      BIGINT(20) PRIMARY KEY AUTO_INCREMENT,
	`user_id` BIGINT(20), -- Add FK,
	`label`   VARCHAR(2550) NOT NULL,
	`enabled` BOOLEAN DEFAULT true,
	`last_updated_on` TIMESTAMP,
	`created_on` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	`expires_at` TIMESTAMP NULL DEFAULT NULL
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

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
	PRIMARY KEY (`id`),
	FOREIGN KEY `publish_package_site_id`(`site_id`) REFERENCES `site` (`id`) ON DELETE CASCADE,
	FOREIGN KEY `publish_package_submitter_id`(`submitter_id`) REFERENCES `user` (`id`),
	FOREIGN KEY `publish_package_reviewer_id`(`reviewer_id`) REFERENCES `user` (`id`),
	INDEX `publish_package_package_state` (`package_state`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
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
	DEFAULT CHARSET = utf8
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
	DEFAULT CHARSET = utf8
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
	`published_commit_id`   VARCHAR(40)     NOT NULL,
	PRIMARY KEY(`item_id`, `target`),
	FOREIGN KEY `item_target_item_id`(`item_id`) REFERENCES `item` (`id`) ON DELETE CASCADE
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

CREATE TABLE IF NOT EXISTS `system_properties`
(
	`id`            BIGINT(20)		NOT NULL AUTO_INCREMENT,
	`property_name`  VARCHAR(50)	NOT NULL,
	`property_value` TEXT			NOT NULL,
	PRIMARY KEY (`id`),
	UNIQUE INDEX `system_properties_ix_property_name` (`property_name`)
)
	ENGINE = InnoDB
	DEFAULT CHARSET = utf8
	ROW_FORMAT = DYNAMIC ;

INSERT IGNORE INTO site (site_id, name, description, system, state)
VALUES ('studio_root', 'Studio Root', 'Studio Root for global permissions', 1, 'READY') ;

INSERT IGNORE INTO group_user (user_id, group_id) VALUES (1, 1) ;

