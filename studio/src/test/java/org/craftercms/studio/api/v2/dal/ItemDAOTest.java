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

package org.craftercms.studio.api.v2.dal;

import ch.vorburger.mariadb4j.DB;
import ch.vorburger.mariadb4j.DBConfigurationBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.apache.ibatis.type.JdbcType;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Types;
import java.util.List;
import java.util.Properties;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_FOLDER;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_PAGE;
import static org.craftercms.studio.api.v2.dal.ItemState.DESTINATION;
import static org.craftercms.studio.api.v2.dal.ItemState.IN_WORKFLOW;
import static org.craftercms.studio.api.v2.dal.ItemState.LIVE;
import static org.craftercms.studio.api.v2.dal.ItemState.MODIFIED;
import static org.craftercms.studio.api.v2.dal.ItemState.SCHEDULED;
import static org.craftercms.studio.api.v2.dal.ItemState.SYSTEM_PROCESSING;
import static org.craftercms.studio.api.v2.dal.ItemState.USER_LOCKED;
import static org.craftercms.studio.api.v2.dal.ItemState.isUserLocked;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Rename and move of a locked item keep both the user-lock bit and {@code locked_by}.
 * {@link ItemDAO#moveItem} still turns on modified and clears the other save-off bits.
 */
public class ItemDAOTest {

	private static final String SITE_ID = "site";
	private static final String DATABASE = "item_dao_test";
	private static final String DDL_RESOURCE = "crafter/studio/database/createDDL.sql";
	private static final List<String> SCHEMA_TABLES = List.of("user", "site", "item", "item_target");

	private static final String RENAME_PARENT = "/site/website";
	private static final String RENAME_SOURCE = "/site/website/article.xml";
	private static final String RENAME_TARGET = "/site/website/renamed-article.xml";
	private static final String MOVE_SOURCE_PARENT = "/site/components";
	private static final String MOVE_TARGET_PARENT = "/site/components/shared";
	private static final String MOVE_SOURCE = "/site/components/header.xml";
	private static final String MOVE_TARGET = "/site/components/shared/header.xml";

	/**
	 * Live and locked, plus the bits a save clears. The lock bit is not one of them.
	 */
	private static final long LOCKED = LIVE.value | USER_LOCKED.value | SYSTEM_PROCESSING.value |
			IN_WORKFLOW.value | SCHEDULED.value | DESTINATION.value;
	private static final long LOCKED_AFTER_MOVE = LIVE.value | USER_LOCKED.value | MODIFIED.value;

	private static DB database;
	private static DataSource dataSource;
	private static SqlSessionFactory sqlSessionFactory;
	private static long sitePk;
	private static long lockOwnerId;

	@BeforeClass
	public static void startDatabase() throws Exception {
		DBConfigurationBuilder config = DBConfigurationBuilder.newBuilder();
		config.setPort(0);
		config.setSecurityDisabled(true);
		config.setDeletingTemporaryBaseAndDataDirsOnShutdown(true);
		database = DB.newEmbeddedDB(config.build());
		database.start();
		database.createDB(DATABASE);

		UnpooledDataSource unpooled = new UnpooledDataSource();
		unpooled.setDriver("org.mariadb.jdbc.Driver");
		unpooled.setUrl(config.getURL(DATABASE));
		unpooled.setUsername("root");
		unpooled.setPassword("");
		dataSource = unpooled;

		try (Connection connection = dataSource.getConnection()) {
			connection.setAutoCommit(true);
			loadSchema(connection);
			try (PreparedStatement insertSite = connection.prepareStatement(
					"INSERT INTO site (site_uuid, site_id, name, deleted) VALUES (?, ?, ?, 0)",
					Statement.RETURN_GENERATED_KEYS)) {
				insertSite.setString(1, SITE_ID);
				insertSite.setString(2, SITE_ID);
				insertSite.setString(3, SITE_ID);
				insertSite.executeUpdate();
				try (var keys = insertSite.getGeneratedKeys()) {
					keys.next();
					sitePk = keys.getLong(1);
				}
			}
			try (PreparedStatement insertUser = connection.prepareStatement(
					"INSERT INTO user (username, password, first_name, last_name, email, enabled) VALUES (?, ?, ?, ?, ?, 1)",
					Statement.RETURN_GENERATED_KEYS)) {
				insertUser.setString(1, "author");
				insertUser.setString(2, "password");
				insertUser.setString(3, "Ann");
				insertUser.setString(4, "Author");
				insertUser.setString(5, "author@example.com");
				insertUser.executeUpdate();
				try (var keys = insertUser.getGeneratedKeys()) {
					keys.next();
					lockOwnerId = keys.getLong(1);
				}
			}
		}

		sqlSessionFactory = new SqlSessionFactoryBuilder().build(mybatisConfiguration(dataSource));
	}

	@AfterClass
	public static void stopDatabase() throws Exception {
		if (database != null) {
			database.stop();
		}
	}

	@Before
	public void cleanTables() throws Exception {
		try (Connection connection = dataSource.getConnection();
			 Statement statement = connection.createStatement()) {
			statement.execute("DELETE FROM item_target");
			statement.execute("DELETE FROM item");
		}
	}

	@Test
	public void renameOfLockedItemKeepsLockBitAndLockedBy() throws Exception {
		long parentId = insertItem(RENAME_PARENT, 0L, CONTENT_TYPE_FOLDER, null, null, "website");
		insertItem(RENAME_SOURCE, LOCKED, CONTENT_TYPE_PAGE, parentId, lockOwnerId, "Article");

		moveItem(RENAME_SOURCE, RENAME_TARGET, parentId, "/renamed-article", "Renamed Article");

		assertAbsent(RENAME_SOURCE);
		assertLockedAt(RENAME_TARGET, parentId, "Renamed Article");
	}

	@Test
	public void moveOfLockedItemKeepsLockBitAndLockedBy() throws Exception {
		long sourceParentId = insertItem(MOVE_SOURCE_PARENT, 0L, CONTENT_TYPE_FOLDER, null, null, "components");
		long targetParentId = insertItem(MOVE_TARGET_PARENT, 0L, CONTENT_TYPE_FOLDER, sourceParentId, null, "shared");
		insertItem(MOVE_SOURCE, LOCKED, CONTENT_TYPE_PAGE, sourceParentId, lockOwnerId, "Header");

		moveItem(MOVE_SOURCE, MOVE_TARGET, targetParentId, "/shared/header", null);

		assertAbsent(MOVE_SOURCE);
		assertLockedAt(MOVE_TARGET, targetParentId, "Header");
	}

	private static void moveItem(String previousPath, String newPath, long parentId, String previewUrl, String label) {
		try (SqlSession session = sqlSessionFactory.openSession()) {
			session.getMapper(ItemDAO.class).moveItem(SITE_ID, previousPath, newPath, parentId, previewUrl, label, lockOwnerId);
			session.commit();
		}
	}

	private static void assertLockedAt(String path, long parentId, String label) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "SELECT state, locked_by, parent_id, label FROM item WHERE site_id = ? AND path = ?")) {
			statement.setLong(1, sitePk);
			statement.setString(2, path);
			try (ResultSet result = statement.executeQuery()) {
				assertTrue("item should exist at " + path, result.next());
				long state = result.getLong("state");
				assertTrue("user lock bit should stay set", isUserLocked(state));
				assertEquals(LOCKED_AFTER_MOVE, state);
				long lockedBy = result.getLong("locked_by");
				assertFalse("locked_by should stay set", result.wasNull());
				assertEquals(lockOwnerId, lockedBy);
				assertEquals(parentId, result.getLong("parent_id"));
				assertEquals(label, result.getString("label"));
			}
		}
	}

	private static void assertAbsent(String path) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "SELECT 1 FROM item WHERE site_id = ? AND path = ?")) {
			statement.setLong(1, sitePk);
			statement.setString(2, path);
			try (ResultSet result = statement.executeQuery()) {
				assertFalse("item should no longer exist at " + path, result.next());
			}
		}
	}

	private static long insertItem(String path, long state, String systemType, Long parentId, Long lockedBy, String label)
			throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO item (site_id, path, state, system_type, label, parent_id, locked_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
					 Statement.RETURN_GENERATED_KEYS)) {
			statement.setLong(1, sitePk);
			statement.setString(2, path);
			statement.setLong(3, state);
			statement.setString(4, systemType);
			statement.setString(5, label);
			if (parentId == null) {
				statement.setNull(6, Types.BIGINT);
			} else {
				statement.setLong(6, parentId);
			}
			if (lockedBy == null) {
				statement.setNull(7, Types.BIGINT);
			} else {
				statement.setLong(7, lockedBy);
			}
			statement.executeUpdate();
			try (var keys = statement.getGeneratedKeys()) {
				keys.next();
				return keys.getLong(1);
			}
		}
	}

	private static void loadSchema(Connection connection) throws Exception {
		String ddl = readResource(DDL_RESOURCE);
		try (Statement statement = connection.createStatement()) {
			for (String table : SCHEMA_TABLES) {
				statement.execute(extractCreateTable(ddl, table));
			}
		}
	}

	private static String readResource(String path) throws IOException {
		try (InputStream in = ItemDAOTest.class.getClassLoader().getResourceAsStream(path)) {
			if (in == null) {
				throw new IllegalStateException("Classpath resource not found: " + path);
			}
			return new String(in.readAllBytes(), UTF_8);
		}
	}

	private static String extractCreateTable(String ddl, String table) {
		String marker = "CREATE TABLE IF NOT EXISTS `" + table + "`";
		int start = ddl.indexOf(marker);
		if (start < 0) {
			throw new IllegalStateException("createDDL.sql has no CREATE TABLE for " + table);
		}
		int end = ddl.indexOf(" ;", start);
		if (end < 0) {
			throw new IllegalStateException("createDDL.sql CREATE TABLE for " + table + " has no terminator");
		}
		return ddl.substring(start, end);
	}

	private static Configuration mybatisConfiguration(DataSource dataSource) {
		Configuration configuration = new Configuration(new Environment("test", new JdbcTransactionFactory(), dataSource));
		configuration.setMapUnderscoreToCamelCase(true);
		configuration.setJdbcTypeForNull(JdbcType.VARCHAR);
		configuration.setVariables(mapperVariables());
		configuration.addMapper(ItemDAO.class);
		return configuration;
	}

	private static Properties mapperVariables() {
		Properties variables = new Properties();
		variables.setProperty("systemTypeFolder", CONTENT_TYPE_FOLDER);
		variables.setProperty("systemTypePage", CONTENT_TYPE_PAGE);
		return variables;
	}
}
