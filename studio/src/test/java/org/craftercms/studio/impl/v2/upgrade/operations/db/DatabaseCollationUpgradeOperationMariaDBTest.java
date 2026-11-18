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
import org.apache.commons.io.IOUtils;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.jdbc.ScriptRunner;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.core.io.ClassPathResource;

import javax.sql.DataSource;
import java.io.StringReader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

import static java.nio.charset.StandardCharsets.UTF_8;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_SCHEMA;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Exercises {@link DatabaseCollationUpgradeOperation} against embedded MariaDB 11.5+.
 * <p>
 * The database stands in for a 4.5.1.2 schema. Its default starts as {@code utf8mb3_uca1400_ai_ci}.
 * {@code site} and {@code publish_request.package_id} are {@code utf8mb3_general_ci}, while
 * {@code workflow.publishing_package_id} is {@code utf8mb3_uca1400_ai_ci} (the collation
 * {@code DEFAULT CHARSET = utf8} picks up on MariaDB 11.5+). That mix rejects
 * {@code publishing_package_id = package_id}, the join in {@code ItemDAO}. The operation makes the
 * database default and every table match {@code site}, and a table created afterwards with no
 * character set inherits that collation.
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
    private static final String PROBE_DATABASE = "collation_upgrade_charset_probe";
    private static final String FRESH_DATABASE = "collation_fresh_install";
    private static final String PREVIOUS_VERSION = "4.5.1.2";
    private static final String CHARACTER_SET = "utf8mb3";
    private static final String SITE_COLLATION = "utf8mb3_general_ci";
    private static final String OTHER_COLLATION = "utf8mb3_uca1400_ai_ci";
    private static final String PACKAGE_ID = "pkg-1";
    private static final String JOIN_SQL = """
        SELECT pr.package_id
        FROM publish_request pr
        INNER JOIN workflow w ON w.publishing_package_id = pr.package_id
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
          AND table_name <> '_meta'
        """;
    private static final String COLUMN_CHARSET_SQL = """
        SELECT character_set_name
        FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name <> '_meta'
          AND character_set_name IS NOT NULL
        """;
    private static final String COLUMN_COLLATION_SQL = """
        SELECT collation_name
        FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name <> '_meta'
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
        database.createDB(PROBE_DATABASE);

        UnpooledDataSource unpooled = new UnpooledDataSource();
        unpooled.setDriver("org.mariadb.jdbc.Driver");
        unpooled.setUrl(config.getURL(DATABASE));
        unpooled.setUsername("root");
        unpooled.setPassword("");
        dataSource = unpooled;

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            connection.setAutoCommit(true);
            assertMariaDb115OrNewer(statement);
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
                CREATE TABLE workflow (
                    publishing_package_id VARCHAR(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_uca1400_ai_ci
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci
                """);
            statement.execute("""
                CREATE TABLE _meta (
                    version VARCHAR(10) NOT NULL,
                    PRIMARY KEY (version)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci
                """);
            statement.execute("INSERT INTO _meta (version) VALUES ('" + PREVIOUS_VERSION + "')");
            insertPackageId(connection, "INSERT INTO publish_request (package_id) VALUES (?)");
            insertPackageId(connection, "INSERT INTO workflow (publishing_package_id) VALUES (?)");

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

            // Old createSchema.sql: CHARACTER SET utf8, no collation. On MariaDB 11.5+ that is uca1400.
            statement.execute("ALTER DATABASE `" + PROBE_DATABASE + "` CHARACTER SET utf8");
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
        assertEquals(PREVIOUS_VERSION, metaVersion());
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
        assertEquals(PREVIOUS_VERSION, metaVersion());
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

    /**
     * MariaDB 11.5+ gives {@code CHARACTER SET utf8} / {@code CHARSET = utf8} the uca1400 collation,
     * even when the database default is still {@code utf8mb3_general_ci}. A table with no character
     * set follows the database default instead.
     */
    @Test
    public void charsetUtf8WithoutCollateDiffersFromDatabaseDefault() throws Exception {
        assertEquals(Set.of(OTHER_COLLATION), queryStrings(PROBE_DATABASE, SCHEMA_COLLATION_SQL));
        assertEquals(Set.of(CHARACTER_SET), queryStrings(PROBE_DATABASE, SCHEMA_CHARSET_SQL));

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("ALTER DATABASE `" + PROBE_DATABASE + "` CHARACTER SET " + CHARACTER_SET
                + " COLLATE " + SITE_COLLATION);
            statement.execute("CREATE TABLE `" + PROBE_DATABASE + "`.charset_only ("
                + " name VARCHAR(50) NOT NULL"
                + " ) ENGINE=InnoDB DEFAULT CHARSET=utf8");
            statement.execute("CREATE TABLE `" + PROBE_DATABASE + "`.inherited ("
                + " name VARCHAR(50) NOT NULL"
                + " ) ENGINE=InnoDB");
        }

        assertEquals(SITE_COLLATION, tableCollation(PROBE_DATABASE, "inherited"));
        assertEquals(OTHER_COLLATION, tableCollation(PROBE_DATABASE, "charset_only"));
    }

    /**
     * createSchema.sql pins utf8mb3 / utf8mb3_uca1400_ai_ci. createDDL.sql no longer names a character
     * set, so every new table, including the workflow and publish_request columns that ItemDAO joins,
     * inherits that collation.
     */
    @Test
    public void freshCreateScriptsInheritDatabaseCollation() throws Exception {
        String createSchema = IOUtils.toString(
            new ClassPathResource("crafter/studio/database/createSchema.sql").getInputStream(), UTF_8);
        createSchema = createSchema.replace("@crafter_schema_name", FRESH_DATABASE)
            .replace("@crafter_user", "crafter")
            .replace("@crafter_password", "crafter");
        // The embedded server is started with skip-grant-tables, so stop before CREATE USER.
        int users = createSchema.indexOf("CREATE USER");
        assertTrue(users > 0);
        createSchema = createSchema.substring(0, users);

        String createDdl = IOUtils.toString(
            new ClassPathResource("crafter/studio/database/createDDL.sql").getInputStream(), UTF_8);
        createDdl = createDdl.replace("@crafter_schema_name", FRESH_DATABASE);

        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(true);
            ScriptRunner runner = new ScriptRunner(connection);
            runner.setDelimiter(" ;");
            runner.setStopOnError(true);
            runner.setLogWriter(null);
            runner.setErrorLogWriter(new java.io.PrintWriter(System.err));
            runner.runScript(new StringReader(createSchema));
            runner.runScript(new StringReader(createDdl));
        }

        assertEquals(Set.of(CHARACTER_SET), queryStrings(FRESH_DATABASE, SCHEMA_CHARSET_SQL));
        assertEquals(Set.of(OTHER_COLLATION), queryStrings(FRESH_DATABASE, SCHEMA_COLLATION_SQL));
        assertEquals(Set.of(OTHER_COLLATION), queryStrings(FRESH_DATABASE, """
            SELECT table_collation
            FROM information_schema.tables
            WHERE table_schema = ?
              AND table_type = 'BASE TABLE'
            """));
        assertEquals(Set.of(OTHER_COLLATION), queryStrings(FRESH_DATABASE, """
            SELECT DISTINCT collation_name
            FROM information_schema.columns
            WHERE table_schema = ?
              AND collation_name IS NOT NULL
            """));
        assertEquals("4.5.1.3", scalar("SELECT version FROM `" + FRESH_DATABASE + "`._meta"));

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("USE `" + FRESH_DATABASE + "`");
            try (ResultSet resultSet = statement.executeQuery("""
                SELECT pr.package_id
                FROM publish_request pr
                INNER JOIN workflow w ON w.publishing_package_id = pr.package_id
                """)) {
                assertFalse(resultSet.next());
            }
        }
    }

    private static String scalar(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            assertTrue(resultSet.next());
            return resultSet.getString(1);
        }
    }

    private static void assertMariaDb115OrNewer(Statement statement) throws SQLException {
        try (ResultSet resultSet = statement.executeQuery("SELECT VERSION()")) {
            assertTrue(resultSet.next());
            String version = resultSet.getString(1);
            System.out.println("MariaDB version: " + version);
            String[] parts = version.split("[^0-9]+");
            int major = Integer.parseInt(parts[0]);
            int minor = parts.length > 1 && !parts[1].isEmpty() ? Integer.parseInt(parts[1]) : 0;
            assertTrue("MariaDB 11.5+ is required to reproduce the utf8mb3 collation change, got " + version,
                major > 11 || (major == 11 && minor >= 5));
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
            fail("publishing_package_id = package_id should fail while the columns use different collations");
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

    private static String metaVersion() throws SQLException {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT version FROM _meta")) {
            assertTrue(resultSet.next());
            return resultSet.getString(1);
        }
    }

    private static String tableCollation(String schema, String table) throws SQLException {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                 SELECT table_collation
                 FROM information_schema.tables
                 WHERE table_schema = ?
                   AND table_name = ?
                 """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet resultSet = statement.executeQuery()) {
                assertTrue(resultSet.next());
                return resultSet.getString(1);
            }
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
