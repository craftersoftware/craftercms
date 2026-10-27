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
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Properties;
import java.util.Set;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.stream.Collectors.toSet;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_COMPONENT;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_FOLDER;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_PAGE;
import static org.craftercms.studio.api.v2.dal.ItemState.LIVE;
import static org.craftercms.studio.api.v2.dal.ItemState.MODIFIED;
import static org.craftercms.studio.api.v2.dal.ItemState.NEW;
import static org.craftercms.studio.api.v2.dal.ItemState.STAGED;
import static org.junit.Assert.assertEquals;

/**
 * Exercises {@link DependencyDAO#getHardDependenciesForList} against the hard-dependency query.
 * Item-specific dependencies are walked even when they are not modified, and only modified items
 * are returned.
 */
public class DependencyDAOTest {

	private static final String SITE_ID = "site";
	private static final String OTHER_SITE_ID = "other-site";
	private static final String TARGET = "live";
	private static final String STAGING_TARGET = "staging";
	private static final String DATABASE = "dependency_dao_test";
	private static final String DDL_RESOURCE = "crafter/studio/database/createDDL.sql";
	/**
	 * Default {@code studio.configuration.dependency.itemSpecificPatterns}.
	 * A single pattern hides an AND separator: no path can match every pattern at once.
	 */
	private static final List<String> ITEM_SPECIFIC_PATTERNS = List.of(
			"/site/components/page/.*",
			"/static-assets/page/.*",
			"/site/components/item/.*",
			"/static-assets/item/.*");
	private static final List<String> SCHEMA_TABLES = List.of("user", "site", "dependency", "item", "item_target");

	private static final String PAGE = "/site/website/index.xml";
	private static final String UNMODIFIED_COMPONENT = "/site/components/page/header.xml";
	private static final String NESTED_UNMODIFIED_COMPONENT = "/site/components/page/body.xml";
	private static final String MODIFIED_COMPONENT = "/site/components/page/nav.xml";
	private static final String DIRECT_MODIFIED_COMPONENT = "/site/components/page/footer.xml";
	private static final String PUBLISHED_PAGE = "/site/website/about.xml";
	private static final String NEW_PAGE = "/site/website/extra.xml";
	private static final String ALREADY_STAGED_PAGE = "/site/website/staged.xml";
	private static final String RENAMED_PAGE = "/site/website/moved.xml";
	private static final String PUBLISHED_ASSET = "/static-assets/images/logo.png";
	private static final String STAGING_SECTION = "/site/website/staging-section";
	private static final String SECTION_COMPONENT = "/site/components/page/section-nav.xml";
	private static final String LIVE_SECTION = "/site/website/live-section";
	private static final String LIVE_SECTION_PAGE = "/site/website/live-section/index.xml";
	private static final String LIVE_SECTION_COMPONENT = "/site/components/item/live-nav.xml";
	private static final String RENAMED_IN_STAGING = "/site/website/renamed-staging.xml";
	private static final String STAGED_CHILD = "/site/website/renamed-staging/child.xml";
	private static final String LIVE_ONLY_CHILD = "/site/website/renamed-staging/live-child.xml";
	private static final String RENAMED_IN_LIVE = "/site/website/renamed-live.xml";
	private static final String CHILD_OF_LIVE_RENAME = "/site/website/renamed-live/child.xml";
	private static final String COMPONENT_UNDER_LIVE_RENAME = "/static-assets/page/banner.png";
	private static final String CYCLE_COMPONENT_A = "/site/components/item/a.xml";
	private static final String CYCLE_COMPONENT_B = "/site/components/item/b.xml";

	private static final long PUBLISHED = LIVE.value;
	private static final long EDITED = LIVE.value | MODIFIED.value;
	private static final long NEW_AND_MODIFIED = NEW.value | MODIFIED.value;

	private static DB database;
	private static DataSource dataSource;
	private static SqlSessionFactory sqlSessionFactory;
	private static long sitePk;

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
			statement.execute("DELETE FROM dependency");
			statement.execute("DELETE FROM item");
		}
	}

	@Test
	public void includesModifiedItemSpecificDependencyOfUnmodifiedItemSpecificDependency() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(UNMODIFIED_COMPONENT, PUBLISHED, CONTENT_TYPE_COMPONENT);
		insertItem(NESTED_UNMODIFIED_COMPONENT, PUBLISHED, CONTENT_TYPE_COMPONENT);
		insertItem(MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, UNMODIFIED_COMPONENT);
		depend(UNMODIFIED_COMPONENT, NESTED_UNMODIFIED_COMPONENT);
		depend(NESTED_UNMODIFIED_COMPONENT, MODIFIED_COMPONENT);

		assertEquals(Set.of(MODIFIED_COMPONENT), hardDependencies(PAGE));
	}

	@Test
	public void excludesUnmodifiedItemSpecificDependency() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(UNMODIFIED_COMPONENT, PUBLISHED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, UNMODIFIED_COMPONENT);

		assertEquals(Set.of(), hardDependencies(PAGE));
	}

	@Test
	public void includesDirectModifiedItemSpecificDependency() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(DIRECT_MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, DIRECT_MODIFIED_COMPONENT);

		assertEquals(Set.of(DIRECT_MODIFIED_COMPONENT), hardDependencies(PAGE));
	}

	@Test
	public void includesNewDependencyOfUnmodifiedItemSpecificDependency() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(UNMODIFIED_COMPONENT, PUBLISHED, CONTENT_TYPE_COMPONENT);
		insertItem(NEW_PAGE, NEW_AND_MODIFIED, CONTENT_TYPE_PAGE);
		depend(PAGE, UNMODIFIED_COMPONENT);
		depend(UNMODIFIED_COMPONENT, NEW_PAGE);

		assertEquals(Set.of(NEW_PAGE), hardDependencies(PAGE));
	}

	@Test
	public void doesNotTraverseUnmodifiedNonItemSpecificDependency() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(PUBLISHED_PAGE, PUBLISHED, CONTENT_TYPE_PAGE);
		insertItem(MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, PUBLISHED_PAGE);
		depend(PUBLISHED_PAGE, MODIFIED_COMPONENT);

		assertEquals(Set.of(), hardDependencies(PAGE));
	}

	@Test
	public void includesNewModifiedDependency() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(NEW_PAGE, NEW_AND_MODIFIED, CONTENT_TYPE_PAGE);
		depend(PAGE, NEW_PAGE);

		assertEquals(Set.of(NEW_PAGE), hardDependencies(PAGE));
	}

	@Test
	public void includesNewAndModifiedDependencies() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(NEW_PAGE, NEW.value, CONTENT_TYPE_PAGE);
		depend(PAGE, NEW_PAGE);

		assertEquals(Set.of(NEW_PAGE), hardDependencies(PAGE));
	}

	@Test
	public void includesRenamedItemAndItsModifiedItemSpecificDependency() throws Exception {
		// moveItem sets MODIFIED together with previous_path. A live publish clears both.
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		long renamedId = insertItem(RENAMED_PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, RENAMED_PAGE);
		depend(RENAMED_PAGE, MODIFIED_COMPONENT);
		markRenamed(renamedId, "/site/website/old.xml");

		assertEquals(Set.of(RENAMED_PAGE, MODIFIED_COMPONENT), hardDependencies(PAGE));
	}

	@Test
	public void excludesModifiedDependencyThatIsNotItemSpecificOrNew() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(PUBLISHED_ASSET, EDITED, "asset");
		depend(PAGE, PUBLISHED_ASSET);

		assertEquals(Set.of(), hardDependencies(PAGE));
	}

	@Test
	public void doesNotFollowInvalidDependencies() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(UNMODIFIED_COMPONENT, PUBLISHED, CONTENT_TYPE_COMPONENT);
		insertItem(MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, UNMODIFIED_COMPONENT, false);
		depend(UNMODIFIED_COMPONENT, MODIFIED_COMPONENT);

		assertEquals(Set.of(), hardDependencies(PAGE));
	}

	@Test
	public void doesNotReturnTheRequestedPath() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(DIRECT_MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		insertItem(MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, DIRECT_MODIFIED_COMPONENT);
		depend(PAGE, MODIFIED_COMPONENT);

		assertEquals(Set.of(MODIFIED_COMPONENT), hardDependencies(PAGE, DIRECT_MODIFIED_COMPONENT));
	}

	@Test
	public void ignoresDependenciesRecordedForAnotherSite() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(DIRECT_MODIFIED_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(OTHER_SITE_ID, PAGE, DIRECT_MODIFIED_COMPONENT, true);

		assertEquals(Set.of(), hardDependencies(PAGE));
	}

	@Test
	public void stagingTargetUsesStagedMaskAndPerTargetPreviousPath() throws Exception {
		// Ancestor renamed in staging is walked, so its modified item-specific dependency is included.
		// A previous_path recorded only for live must not pull that ancestor in.
		long stagingSectionId = insertItem(STAGING_SECTION, PUBLISHED, CONTENT_TYPE_FOLDER);
		long pageId = insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		setParent(pageId, stagingSectionId);
		insertItem(SECTION_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(STAGING_SECTION, SECTION_COMPONENT);
		markRenamed(stagingSectionId, "/site/website/old-staging-section", STAGING_TARGET);

		long liveSectionId = insertItem(LIVE_SECTION, PUBLISHED, CONTENT_TYPE_FOLDER);
		long liveSectionPageId = insertItem(LIVE_SECTION_PAGE, EDITED, CONTENT_TYPE_PAGE);
		setParent(liveSectionPageId, liveSectionId);
		insertItem(LIVE_SECTION_COMPONENT, EDITED, CONTENT_TYPE_COMPONENT);
		depend(LIVE_SECTION, LIVE_SECTION_COMPONENT);
		markRenamed(liveSectionId, "/site/website/old-live-section", TARGET);

		// NEW with the STAGED bit clear is new in staging. NEW|STAGED is already published there.
		insertItem(NEW_PAGE, NEW.value, CONTENT_TYPE_PAGE);
		insertItem(ALREADY_STAGED_PAGE, NEW.value | STAGED.value, CONTENT_TYPE_PAGE);
		depend(PAGE, NEW_PAGE);
		depend(PAGE, ALREADY_STAGED_PAGE);

		// A staging publish clears the staging previous_path and leaves MODIFIED set, so a page
		// renamed in staging is published with the requesting page. Its child is included when
		// it carries the STAGED bit. A child published only to live is not.
		long renamedInStagingId = insertItem(RENAMED_IN_STAGING, STAGED.value | LIVE.value | MODIFIED.value, CONTENT_TYPE_PAGE);
		markRenamed(renamedInStagingId, "/site/website/old-renamed-staging.xml", STAGING_TARGET);
		depend(PAGE, RENAMED_IN_STAGING);
		setParent(insertItem(STAGED_CHILD, STAGED.value | MODIFIED.value, CONTENT_TYPE_PAGE), renamedInStagingId);
		setParent(insertItem(LIVE_ONLY_CHILD, LIVE.value | MODIFIED.value, CONTENT_TYPE_PAGE), renamedInStagingId);

		// A rename recorded only for live is not a staging dependency, so neither it nor its child is returned.
		long renamedInLiveId = insertItem(RENAMED_IN_LIVE, PUBLISHED, CONTENT_TYPE_PAGE);
		markRenamed(renamedInLiveId, "/site/website/old-renamed-live.xml", TARGET);
		depend(PAGE, RENAMED_IN_LIVE);
		insertItem(COMPONENT_UNDER_LIVE_RENAME, EDITED, CONTENT_TYPE_COMPONENT);
		depend(RENAMED_IN_LIVE, COMPONENT_UNDER_LIVE_RENAME);
		setParent(insertItem(CHILD_OF_LIVE_RENAME, STAGED.value | MODIFIED.value, CONTENT_TYPE_PAGE), renamedInLiveId);

		assertEquals(Set.of(SECTION_COMPONENT, NEW_PAGE, RENAMED_IN_STAGING, STAGED_CHILD),
				hardDependencies(STAGING_TARGET, false, PAGE, LIVE_SECTION_PAGE));
	}

	@Test
	public void terminatesOnCycleBetweenItemSpecificComponents() throws Exception {
		insertItem(PAGE, EDITED, CONTENT_TYPE_PAGE);
		insertItem(CYCLE_COMPONENT_A, EDITED, CONTENT_TYPE_COMPONENT);
		insertItem(CYCLE_COMPONENT_B, PUBLISHED, CONTENT_TYPE_COMPONENT);
		depend(PAGE, CYCLE_COMPONENT_A);
		depend(CYCLE_COMPONENT_A, CYCLE_COMPONENT_B);
		depend(CYCLE_COMPONENT_B, CYCLE_COMPONENT_A);

		assertEquals(Set.of(CYCLE_COMPONENT_A), hardDependencies(PAGE));
	}

	private static Set<String> hardDependencies(String... paths) {
		return hardDependencies(TARGET, true, paths);
	}

	private static Set<String> hardDependencies(String target, boolean isLiveTarget, String... paths) {
		try (SqlSession session = sqlSessionFactory.openSession()) {
			DependencyDAO dao = session.getMapper(DependencyDAO.class);
			return dao.getHardDependenciesForList(SITE_ID, target, List.of(paths), ITEM_SPECIFIC_PATTERNS, isLiveTarget)
					.stream()
					.map(LightItem::getPath)
					.collect(toSet());
		}
	}

	private static long insertItem(String path, long state, String systemType) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO item (site_id, path, state, system_type, label, mime_type) VALUES (?, ?, ?, ?, ?, ?)",
					 Statement.RETURN_GENERATED_KEYS)) {
			statement.setLong(1, sitePk);
			statement.setString(2, path);
			statement.setLong(3, state);
			statement.setString(4, systemType);
			statement.setString(5, path);
			statement.setString(6, "application/xml");
			statement.executeUpdate();
			try (var keys = statement.getGeneratedKeys()) {
				keys.next();
				return keys.getLong(1);
			}
		}
	}

	private static void depend(String sourcePath, String targetPath) throws Exception {
		depend(SITE_ID, sourcePath, targetPath, true);
	}

	private static void depend(String sourcePath, String targetPath, boolean valid) throws Exception {
		depend(SITE_ID, sourcePath, targetPath, valid);
	}

	private static void depend(String siteId, String sourcePath, String targetPath, boolean valid) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO dependency (site, source_path, target_path, type, valid) VALUES (?, ?, ?, ?, ?)")) {
			statement.setString(1, siteId);
			statement.setString(2, sourcePath);
			statement.setString(3, targetPath);
			statement.setString(4, "component");
			statement.setInt(5, valid ? 1 : 0);
			statement.executeUpdate();
		}
	}

	private static void setParent(long itemId, long parentId) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "UPDATE item SET parent_id = ? WHERE id = ?")) {
			statement.setLong(1, parentId);
			statement.setLong(2, itemId);
			statement.executeUpdate();
		}
	}

	private static void markRenamed(long itemId, String previousPath) throws Exception {
		markRenamed(itemId, previousPath, TARGET);
	}

	private static void markRenamed(long itemId, String previousPath, String target) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO item_target (item_id, target, previous_path, published_commit_id) VALUES (?, ?, ?, ?)")) {
			statement.setLong(1, itemId);
			statement.setString(2, target);
			statement.setString(3, previousPath);
			statement.setString(4, "commit");
			statement.executeUpdate();
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
		try (InputStream in = DependencyDAOTest.class.getClassLoader().getResourceAsStream(path)) {
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
		configuration.addMapper(UserDAO.class);
		configuration.addMapper(ItemDAO.class);
		configuration.addMapper(DependencyDAO.class);
		return configuration;
	}

	private static Properties mapperVariables() {
		Properties variables = new Properties();
		variables.setProperty("liveEnvironment", "live");
		variables.setProperty("stagingEnvironment", "staging");
		variables.setProperty("packageReadyState", "1");
		variables.setProperty("packageApprovedState", "APPROVED");
		variables.setProperty("livePublishedState", "4");
		variables.setProperty("stagingPublishedState", "16");
		variables.setProperty("systemTypeFolder", "folder");
		variables.setProperty("systemTypePage", CONTENT_TYPE_PAGE);
		variables.setProperty("systemTypeLevelDescriptor", "levelDescriptor");
		variables.setProperty("systemProcessingState", "16");
		variables.setProperty("blobFilePattern", "%.blob");
		return variables;
	}
}
