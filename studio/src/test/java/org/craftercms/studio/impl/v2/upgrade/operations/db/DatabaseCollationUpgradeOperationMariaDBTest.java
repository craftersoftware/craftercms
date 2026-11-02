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

package org.craftercms.studio.impl.v2.upgrade.operations.db;

import ch.vorburger.mariadb4j.DB;
import ch.vorburger.mariadb4j.DBConfigurationBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_SCHEMA;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Exercises {@link DatabaseCollationUpgradeOperation} against embedded MariaDB.
 * <p>
 * The database default starts as {@code utf8mb3_uca1400_ai_ci}. {@code site} and
 * {@code publish_request.package_id} are {@code utf8mb3_general_ci}, while
 * {@code publish_package.old_package_id} is {@code utf8mb3_uca1400_ai_ci}. That mix rejects
 * {@code old_package_id = package_id}. The operation makes the database default and every table
 * match {@code site}, and a table created afterwards with no character set inherits that collation.
 * <p>
 * A second schema stores {@code site} as {@code utf8mb3_uca1400_ai_ci}. The upgrade must resolve
 * that full name to character set {@code utf8mb3} and apply it.
 * <p>
 * A third schema stores {@code site} as {@code utf8mb3_uca1400_ai_ci} and {@code user.username} as
 * {@code utf8mb3_general_ci}, with {@code ß} and {@code ss} both present. Those values are distinct
 * under {@code general_ci} and equal under {@code uca1400}, so converting the unique key fails and
 * the error names that table and key.
 */
public class DatabaseCollationUpgradeOperationMariaDBTest {

	private static final String DATABASE = "collation_upgrade_test";
	private static final String UCA_SITE_DATABASE = "collation_upgrade_uca_site";
	private static final String DUPLICATE_KEY_DATABASE = "collation_upgrade_duplicate_key";
	private static final String CHARACTER_SET = "utf8mb3";
	private static final String SITE_COLLATION = "utf8mb3_general_ci";
	private static final String OTHER_COLLATION = "utf8mb3_uca1400_ai_ci";
	private static final String PACKAGE_ID = "pkg-1";
	private static final String JOIN_SQL = """
		SELECT pr.package_id
		FROM publish_request pr
		INNER JOIN publish_package pp ON pp.old_package_id = pr.package_id
		""";
	private static final String SCHEMA_CHARSET_SQL = """
		SELECT default_character_set_name
		FROM information_schema.schemata
		WHERE schema_name = ?
		""";
	private static final String SCHEMA_COLLATION_SQL = """
		SELECT default_collation_name
		FROM information_schema.schemata
		WHERE schema_name = ?
		""";
	private static final String TABLE_COLLATION_SQL = """
		SELECT table_collation
		FROM information_schema.tables
		WHERE table_schema = ?
		  AND table_type = 'BASE TABLE'
		""";
	private static final String COLUMN_CHARSET_SQL = """
		SELECT character_set_name
		FROM information_schema.columns
		WHERE table_schema = ?
		  AND character_set_name IS NOT NULL
		""";
	private static final String COLUMN_COLLATION_SQL = """
		SELECT collation_name
		FROM information_schema.columns
		WHERE table_schema = ?
		  AND collation_name IS NOT NULL
		""";

	private static DB database;
	private static DataSource dataSource;

	@BeforeClass
	public static void startDatabase() throws Exception {
		DBConfigurationBuilder config = DBConfigurationBuilder.newBuilder();
		config.setPort(0);
		config.setSecurityDisabled(true);
		config.setDeletingTemporaryBaseAndDataDirsOnShutdown(true);
		database = DB.newEmbeddedDB(config.build());
		database.start();
		database.createDB(DATABASE);
		database.createDB(UCA_SITE_DATABASE);
		database.createDB(DUPLICATE_KEY_DATABASE);

		UnpooledDataSource unpooled = new UnpooledDataSource();
		unpooled.setDriver("org.mariadb.jdbc.Driver");
		unpooled.setUrl(config.getURL(DATABASE));
		unpooled.setUsername("root");
		unpooled.setPassword("");
		dataSource = unpooled;

		try (Connection connection = dataSource.getConnection();
		     Statement statement = connection.createStatement()) {
			connection.setAutoCommit(true);
			statement.execute("ALTER DATABASE `" + DATABASE + "` CHARACTER SET " + CHARACTER_SET
				+ " COLLATE " + OTHER_COLLATION);
			statement.execute("""
				CREATE TABLE site (
					site_id VARCHAR(50) NOT NULL
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci
				""");
			statement.execute("""
				CREATE TABLE publish_request (
					package_id VARCHAR(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci
				""");
			statement.execute("""
				CREATE TABLE publish_package (
					old_package_id VARCHAR(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_uca1400_ai_ci
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci
				""");
			insertPackageId(connection, "INSERT INTO publish_request (package_id) VALUES (?)");
			insertPackageId(connection, "INSERT INTO publish_package (old_package_id) VALUES (?)");

			statement.execute("ALTER DATABASE `" + UCA_SITE_DATABASE + "` CHARACTER SET " + CHARACTER_SET
				+ " COLLATE " + SITE_COLLATION);
			statement.execute("CREATE TABLE `" + UCA_SITE_DATABASE + "`.site ("
				+ " site_id VARCHAR(50) NOT NULL"
				+ " ) ENGINE=InnoDB DEFAULT CHARSET=" + CHARACTER_SET + " COLLATE " + OTHER_COLLATION);
			statement.execute("CREATE TABLE `" + UCA_SITE_DATABASE + "`.workflow ("
				+ " name VARCHAR(50) NOT NULL"
				+ " ) ENGINE=InnoDB DEFAULT CHARSET=" + CHARACTER_SET + " COLLATE " + SITE_COLLATION);

			statement.execute("ALTER DATABASE `" + DUPLICATE_KEY_DATABASE + "` CHARACTER SET " + CHARACTER_SET
				+ " COLLATE " + SITE_COLLATION);
			statement.execute("CREATE TABLE `" + DUPLICATE_KEY_DATABASE + "`.site ("
				+ " site_id VARCHAR(50) NOT NULL"
				+ " ) ENGINE=InnoDB DEFAULT CHARSET=" + CHARACTER_SET + " COLLATE " + OTHER_COLLATION);
			statement.execute("CREATE TABLE `" + DUPLICATE_KEY_DATABASE + "`.`user` ("
				+ " username VARCHAR(255) NOT NULL,"
				+ " UNIQUE INDEX user_ix_username (username)"
				+ " ) ENGINE=InnoDB DEFAULT CHARSET=" + CHARACTER_SET + " COLLATE " + SITE_COLLATION);
			insertUsername(connection, "\u00df");
			insertUsername(connection, "ss");
		}
	}

	@AfterClass
	public static void stopDatabase() throws Exception {
		if (database != null) {
			database.stop();
		}
	}

	@Test
	public void alignsDatabaseWithSiteSoPackageIdJoinWorks() throws Exception {
		assertEquals(Set.of(OTHER_COLLATION), queryStrings(SCHEMA_COLLATION_SQL));
		assertEquals(Set.of(SITE_COLLATION, OTHER_COLLATION), queryStrings(TABLE_COLLATION_SQL));
		assertEquals(Set.of(SITE_COLLATION, OTHER_COLLATION), queryStrings(COLUMN_COLLATION_SQL));
		assertPackageIdJoinRejected();

		StudioConfiguration studioConfiguration = mock(StudioConfiguration.class);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn(DATABASE);

		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		operation.doExecute(new StudioUpgradeContext(DATABASE, studioConfiguration, dataSource, null, null));

		try (Connection connection = dataSource.getConnection();
		     Statement statement = connection.createStatement()) {
			statement.execute("""
				CREATE TABLE inherited_table (
					name VARCHAR(50) NOT NULL
				) ENGINE=InnoDB
				""");
		}

		assertEquals(Set.of(SITE_COLLATION), queryStrings(SCHEMA_COLLATION_SQL));
		assertEquals(Set.of(SITE_COLLATION), queryStrings(TABLE_COLLATION_SQL));
		assertEquals(Set.of(SITE_COLLATION), queryStrings(COLUMN_COLLATION_SQL));
		assertEquals(PACKAGE_ID, joinedPackageId());
	}

	@Test
	public void readsUca14SiteDefaults() throws Exception {
		assertEquals(Set.of(CHARACTER_SET), queryStrings(UCA_SITE_DATABASE, SCHEMA_CHARSET_SQL));
		assertEquals(Set.of(SITE_COLLATION), queryStrings(UCA_SITE_DATABASE, SCHEMA_COLLATION_SQL));
		assertEquals(Set.of(OTHER_COLLATION, SITE_COLLATION), queryStrings(UCA_SITE_DATABASE, TABLE_COLLATION_SQL));
		assertEquals(Set.of(CHARACTER_SET), queryStrings(UCA_SITE_DATABASE, COLUMN_CHARSET_SQL));
		assertEquals(Set.of(OTHER_COLLATION, SITE_COLLATION), queryStrings(UCA_SITE_DATABASE, COLUMN_COLLATION_SQL));

		StudioConfiguration studioConfiguration = mock(StudioConfiguration.class);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn(UCA_SITE_DATABASE);

		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		operation.doExecute(new StudioUpgradeContext(UCA_SITE_DATABASE, studioConfiguration, dataSource, null, null));

		try (Connection connection = dataSource.getConnection();
		     Statement statement = connection.createStatement()) {
			statement.execute("CREATE TABLE `" + UCA_SITE_DATABASE + "`.inherited_table ("
				+ " name VARCHAR(50) NOT NULL"
				+ " ) ENGINE=InnoDB");
		}

		assertEquals(Set.of(CHARACTER_SET), queryStrings(UCA_SITE_DATABASE, SCHEMA_CHARSET_SQL));
		assertEquals(Set.of(OTHER_COLLATION), queryStrings(UCA_SITE_DATABASE, SCHEMA_COLLATION_SQL));
		assertEquals(Set.of(OTHER_COLLATION), queryStrings(UCA_SITE_DATABASE, TABLE_COLLATION_SQL));
		assertEquals(Set.of(CHARACTER_SET), queryStrings(UCA_SITE_DATABASE, COLUMN_CHARSET_SQL));
		assertEquals(Set.of(OTHER_COLLATION), queryStrings(UCA_SITE_DATABASE, COLUMN_COLLATION_SQL));
	}

	@Test
	public void namesUniqueKeyWhenUca1400CollapsesDistinctValues() throws Exception {
		StudioConfiguration studioConfiguration = mock(StudioConfiguration.class);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn(DUPLICATE_KEY_DATABASE);

		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		try {
			operation.doExecute(new StudioUpgradeContext(DUPLICATE_KEY_DATABASE, studioConfiguration, dataSource, null, null));
			fail("converting user.username from general_ci to uca1400 should reject ß and ss");
		} catch (UpgradeException e) {
			assertEquals("Failed to convert table '" + DUPLICATE_KEY_DATABASE + ".user' to collation '" + OTHER_COLLATION
				+ "' because unique key 'user_ix_username' would contain duplicate values", e.getMessage());
			assertTrue(e.getCause() instanceof SQLException);
			assertEquals("23000", ((SQLException) e.getCause()).getSQLState());
		}
	}

	private static void insertUsername(Connection connection, String username) throws SQLException {
		try (PreparedStatement statement = connection.prepareStatement(
			"INSERT INTO `" + DUPLICATE_KEY_DATABASE + "`.`user` (username) VALUES (?)")) {
			statement.setString(1, username);
			statement.executeUpdate();
		}
	}

	private static void insertPackageId(Connection connection, String sql) throws SQLException {
		try (PreparedStatement statement = connection.prepareStatement(sql)) {
			statement.setString(1, PACKAGE_ID);
			statement.executeUpdate();
		}
	}

	private static void assertPackageIdJoinRejected() throws SQLException {
		try (Connection connection = dataSource.getConnection();
		     Statement statement = connection.createStatement();
		     ResultSet resultSet = statement.executeQuery(JOIN_SQL)) {
			resultSet.next();
			fail("old_package_id = package_id should fail while the columns use different collations");
		} catch (SQLException e) {
			assertTrue(e.getMessage(), e.getMessage().contains("Illegal mix of collations"));
		}
	}

	private static String joinedPackageId() throws SQLException {
		try (Connection connection = dataSource.getConnection();
		     Statement statement = connection.createStatement();
		     ResultSet resultSet = statement.executeQuery(JOIN_SQL)) {
			assertTrue(resultSet.next());
			String packageId = resultSet.getString(1);
			assertFalse(resultSet.next());
			return packageId;
		}
	}

	private static Set<String> queryStrings(String sql) throws SQLException {
		return queryStrings(DATABASE, sql);
	}

	private static Set<String> queryStrings(String schema, String sql) throws SQLException {
		Set<String> values = new HashSet<>();
		try (Connection connection = dataSource.getConnection();
		     PreparedStatement statement = connection.prepareStatement(sql)) {
			statement.setString(1, schema);
			try (ResultSet resultSet = statement.executeQuery()) {
				while (resultSet.next()) {
					values.add(resultSet.getString(1));
				}
			}
		}
		return values;
	}
}
