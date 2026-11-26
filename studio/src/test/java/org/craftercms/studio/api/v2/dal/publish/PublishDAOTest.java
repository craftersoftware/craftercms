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

package org.craftercms.studio.api.v2.dal.publish;

import ch.vorburger.mariadb4j.DB;
import ch.vorburger.mariadb4j.DBConfigurationBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.executor.BatchResult;
import org.apache.ibatis.session.ExecutorType;
import org.apache.ibatis.session.defaults.DefaultSqlSessionFactory;
import org.apache.ibatis.transaction.TransactionFactory;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.apache.ibatis.type.JdbcType;
import org.craftercms.studio.api.v2.dal.DAOUtils;
import org.craftercms.studio.api.v2.dal.ItemDAO;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.UserDAO;
import org.craftercms.studio.api.v2.dal.item.LightItemMetadata;
import org.junit.AfterClass;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.transaction.support.TransactionTemplate;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Collection;
import java.util.List;
import java.util.Properties;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_PAGE;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.UPDATE;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.APPROVED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.COMPLETED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.LIVE_SUCCESS;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageType.ITEM_LIST;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

/**
 * A completed package can contain a publish item with no {@code item_publish_item} row.
 * Metadata queries still match the item by site and path, and the fallback item id loads {@code itemTargets}.
 */
public class PublishDAOTest {

	private static final String SITE_ID = "site";
	private static final String DATABASE = "publish_dao_test";
	private static final String DDL_RESOURCE = "crafter/studio/database/createDDL.sql";
	private static final List<String> SCHEMA_TABLES = List.of(
			"user", "site", "item", "publish_package", "publish_item", "item_publish_item", "item_target");

	private static final String PRESENT_PATH = "/site/website/article.xml";
	private static final String MISSING_PATH = "/site/website/removed.xml";
	private static final String LINKED_PATH = "/site/website/linked.xml";
	private static final String PREVIOUS_PATH = "/site/website/old-article.xml";
	private static final String LIVE_TARGET = "live";
	private static final String LABEL = "Article";
	private static final String MIME_TYPE = "text/xml";

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

		sqlSessionFactory = new SqlSessionFactoryBuilder().build(mybatisConfiguration(dataSource, new JdbcTransactionFactory()));
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
			statement.execute("DELETE FROM item_publish_item");
			statement.execute("DELETE FROM publish_item");
			statement.execute("DELETE FROM publish_package");
			statement.execute("DELETE FROM item");
		}
	}

	@Test
	public void unlinkedItemAtPathReturnsMetadataAndFallbackItemId() throws Exception {
		long packageId = insertCompletedPackage();
		long itemId = insertItem(PRESENT_PATH, LABEL, CONTENT_TYPE_PAGE);
		insertItemTarget(itemId);
		insertPublishItem(packageId, PRESENT_PATH);

		PublishItemWithMetadata item = assertSingleMatch(packageId, null);
		assertEquals(PRESENT_PATH, item.getPath());
		assertEquals(itemId, item.getItemId());
		assertMetadata(item, LABEL, CONTENT_TYPE_PAGE);
		assertTarget(item, itemId);
	}

	@Test
	public void unlinkedItemWithoutMatchingItemReturnsEmptyMetadata() throws Exception {
		long packageId = insertCompletedPackage();
		insertPublishItem(packageId, MISSING_PATH);

		PublishItemWithMetadata item = assertSingleMatch(packageId, null);
		assertEquals(MISSING_PATH, item.getPath());
		assertEquals(0L, item.getItemId());
		assertNull(item.getItemMetadata());
		assertNull(item.getItemTargets());
	}

	@Test
	public void pathFilterMatchesPublishItemPathWithAndWithoutItem() throws Exception {
		long packageId = insertCompletedPackage();
		long itemId = insertItem(PRESENT_PATH, LABEL, CONTENT_TYPE_PAGE);
		insertPublishItem(packageId, PRESENT_PATH);
		insertPublishItem(packageId, MISSING_PATH);

		PublishItemWithMetadata present = assertSingleMatch(packageId, pathRegex(PRESENT_PATH));
		assertEquals(PRESENT_PATH, present.getPath());
		assertEquals(itemId, present.getItemId());
		assertMetadata(present, LABEL, CONTENT_TYPE_PAGE);

		PublishItemWithMetadata missing = assertSingleMatch(packageId, pathRegex(MISSING_PATH));
		assertEquals(MISSING_PATH, missing.getPath());
		assertEquals(0L, missing.getItemId());
		assertNull(missing.getItemMetadata());
	}

	@Test
	public void linkedItemReturnsMetadataAndItemId() throws Exception {
		long packageId = insertCompletedPackage();
		long itemId = insertItem(LINKED_PATH, LABEL, CONTENT_TYPE_PAGE);
		insertItemTarget(itemId);
		long publishItemId = insertPublishItem(packageId, LINKED_PATH);
		linkItem(publishItemId, itemId);

		PublishItemWithMetadata item = assertSingleMatch(packageId, null);
		assertEquals(LINKED_PATH, item.getPath());
		assertEquals(itemId, item.getItemId());
		assertMetadata(item, LABEL, CONTENT_TYPE_PAGE);
		assertTarget(item, itemId);
	}

	/**
	 * A package left {@code PROCESSING} after its live target succeeded is reset to exactly {@code READY}, so the
	 * queue selects it again and the retry republishes every target. Completed packages are not touched.
	 */
	@Test
	public void processingPackageWithLiveSuccessIsResetAndQueuedForRepublish() throws Exception {
		setSiteState(Site.State.READY);
		long processingPackageId = insertPackage(PROCESSING.value | LIVE_SUCCESS.value);
		long completedPackageId = insertPackage(COMPLETED.value | LIVE_SUCCESS.value);
		assertEquals(List.of(), queuedPackageIds());

		resetProcessingPackages();

		assertEquals(READY.value, packageState(processingPackageId));
		assertEquals(COMPLETED.value | LIVE_SUCCESS.value, packageState(completedPackageId));
		assertEquals(List.of(processingPackageId), queuedPackageIds());

		// The republish marks the package PROCESSING again and completes it with the live success bit
		updatePackageState(processingPackageId, PROCESSING.value);
		assertEquals(List.of(), queuedPackageIds());
		updatePackageState(processingPackageId, COMPLETED.value | LIVE_SUCCESS.value);

		// A second reset finds nothing left processing
		resetProcessingPackages();

		assertEquals(COMPLETED.value | LIVE_SUCCESS.value, packageState(processingPackageId));
		assertEquals(COMPLETED.value | LIVE_SUCCESS.value, packageState(completedPackageId));
		assertEquals(List.of(), queuedPackageIds());
	}

	/**
	 * The failed items of an initial publish are inserted through a batch template that joins the package
	 * transaction, next to the default (simple) template that updates the package. The flushed rows are visible in
	 * the transaction, and they are rolled back or committed with the package.
	 */
	@Test
	public void batchInsertedInitialPublishItemsCommitOrRollBackWithThePackage() throws Exception {
		long packageId = insertPackage(PROCESSING.value);
		SqlSessionFactory springSessionFactory = new SqlSessionFactoryBuilder()
				.build(mybatisConfiguration(dataSource, new SpringManagedTransactionFactory()));
		SqlSessionTemplate sqlSessionTemplate = new SqlSessionTemplate(springSessionFactory);
		SqlSessionTemplate batchSqlSessionTemplate = new SqlSessionTemplate(
				new DefaultSqlSessionFactory(springSessionFactory.getConfiguration()), ExecutorType.BATCH);
		TransactionTemplate transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));

		transaction.executeWithoutResult(status -> {
			publishPackageInTransaction(sqlSessionTemplate, batchSqlSessionTemplate, packageId);
			status.setRollbackOnly();
		});

		assertEquals(0, publishItemCount(packageId));
		assertEquals(PROCESSING.value, packageState(packageId));

		transaction.executeWithoutResult(status ->
				publishPackageInTransaction(sqlSessionTemplate, batchSqlSessionTemplate, packageId));

		assertEquals(2, publishItemCount(packageId));
		assertEquals(READY.value, packageState(packageId));
	}

	private static void publishPackageInTransaction(SqlSessionTemplate sqlSessionTemplate,
													SqlSessionTemplate batchSqlSessionTemplate, long packageId) {
		sqlSessionTemplate.getMapper(PublishDAO.class).resetProcessingPackages(READY.value, PROCESSING.value);
		batchSqlSessionTemplate.getMapper(PublishDAO.class).insertInitialPublishItems(packageId,
				List.of(initialPublishItem(packageId, PRESENT_PATH), initialPublishItem(packageId, MISSING_PATH)));
		List<BatchResult> results = batchSqlSessionTemplate.flushStatements();
		assertEquals(1, results.size());
		assertEquals(2, results.get(0).getUpdateCounts().length);
		Connection connection = DataSourceUtils.getConnection(dataSource);
		try (PreparedStatement statement = connection.prepareStatement(
				"SELECT COUNT(*) FROM publish_item WHERE package_id = ?")) {
			statement.setLong(1, packageId);
			try (var result = statement.executeQuery()) {
				assertTrue(result.next());
				assertEquals(2, result.getInt(1));
			}
		} catch (java.sql.SQLException e) {
			throw new IllegalStateException(e);
		} finally {
			DataSourceUtils.releaseConnection(connection, dataSource);
		}
	}

	private static PublishItem initialPublishItem(long packageId, String path) {
		PublishItem item = new PublishItem();
		item.setPackageId(packageId);
		item.setAction(PublishItem.Action.ADD);
		item.setPath(path);
		item.setUserRequested(true);
		return item;
	}

	private static int publishItemCount(long packageId) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "SELECT COUNT(*) FROM publish_item WHERE package_id = ?")) {
			statement.setLong(1, packageId);
			try (var result = statement.executeQuery()) {
				assertTrue(result.next());
				return result.getInt(1);
			}
		}
	}

	private static void resetProcessingPackages() {
		try (SqlSession session = sqlSessionFactory.openSession(true)) {
			session.getMapper(PublishDAO.class).resetProcessingPackages(READY.value, PROCESSING.value);
		}
	}

	private static List<Long> queuedPackageIds() {
		try (SqlSession session = sqlSessionFactory.openSession()) {
			return session.getMapper(PublishDAO.class).getNextPublishPackages().getOrDefault(SITE_ID, List.of())
					.stream().map(PublishPackageId::packageId).toList();
		}
	}

	private static long packageState(long packageId) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "SELECT package_state FROM publish_package WHERE id = ?")) {
			statement.setLong(1, packageId);
			try (var result = statement.executeQuery()) {
				assertTrue(result.next());
				return result.getLong(1);
			}
		}
	}

	private static void updatePackageState(long packageId, long state) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "UPDATE publish_package SET package_state = ? WHERE id = ?")) {
			statement.setLong(1, state);
			statement.setLong(2, packageId);
			assertEquals(1, statement.executeUpdate());
		}
	}

	private static void setSiteState(String state) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement("UPDATE site SET state = ? WHERE id = ?")) {
			statement.setString(1, state);
			statement.setLong(2, sitePk);
			assertEquals(1, statement.executeUpdate());
		}
	}

	/**
	 * List size and {@link PublishDAO#getMatchingPublishItemCount} both equal 1.
	 */
	private static PublishItemWithMetadata assertSingleMatch(long packageId, String path) {
		try (SqlSession session = sqlSessionFactory.openSession()) {
			PublishDAO dao = session.getMapper(PublishDAO.class);
			Collection<PublishItemWithMetadata> items = dao.getPublishItemsWithMetadata(
					SITE_ID, packageId, path, null, null, null, null);
			int count = dao.getMatchingPublishItemCount(SITE_ID, packageId, path, null, null);
			assertEquals(1, count);
			assertEquals(count, items.size());
			PublishItemWithMetadata item = items.iterator().next();
			if (item.getItemTargets() != null) {
				item.getItemTargets().size();
			}
			return item;
		}
	}

	private static void assertMetadata(PublishItemWithMetadata item, String label, String systemType) {
		LightItemMetadata metadata = item.getItemMetadata();
		assertEquals(label, metadata.label());
		assertEquals(systemType, metadata.systemType());
		assertEquals(MIME_TYPE, metadata.mimeType());
	}

	private static void assertTarget(PublishItemWithMetadata item, long itemId) {
		assertEquals(1, item.getItemTargets().size());
		ItemTarget target = item.getItemTargets().get(0);
		assertEquals(itemId, target.getItemId());
		assertEquals(LIVE_TARGET, target.getTarget());
		assertEquals(PREVIOUS_PATH, target.getPreviousPath());
	}

	private static String pathRegex(String path) {
		return "^" + path.replace(".", "\\.") + "$";
	}

	private static long insertCompletedPackage() throws Exception {
		return insertPackage(COMPLETED.value);
	}

	private static long insertPackage(long packageState) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO publish_package (site_id, target, title, approval_state, package_state, package_type) " +
							 "VALUES (?, ?, ?, ?, ?, ?)",
					 Statement.RETURN_GENERATED_KEYS)) {
			statement.setLong(1, sitePk);
			statement.setString(2, LIVE_TARGET);
			statement.setString(3, "Package");
			statement.setString(4, APPROVED.name());
			statement.setLong(5, packageState);
			statement.setString(6, ITEM_LIST.name());
			statement.executeUpdate();
			try (var keys = statement.getGeneratedKeys()) {
				assertTrue(keys.next());
				return keys.getLong(1);
			}
		}
	}

	private static long insertPublishItem(long packageId, String path) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO publish_item (package_id, path, action, user_requested, publish_state) VALUES (?, ?, ?, ?, ?)",
					 Statement.RETURN_GENERATED_KEYS)) {
			statement.setLong(1, packageId);
			statement.setString(2, path);
			statement.setString(3, UPDATE.name());
			statement.setInt(4, 1);
			statement.setLong(5, 0L);
			statement.executeUpdate();
			try (var keys = statement.getGeneratedKeys()) {
				assertTrue(keys.next());
				return keys.getLong(1);
			}
		}
	}

	private static long insertItem(String path, String label, String systemType) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO item (site_id, path, state, label, system_type, mime_type) VALUES (?, ?, 0, ?, ?, ?)",
					 Statement.RETURN_GENERATED_KEYS)) {
			statement.setLong(1, sitePk);
			statement.setString(2, path);
			statement.setString(3, label);
			statement.setString(4, systemType);
			statement.setString(5, MIME_TYPE);
			statement.executeUpdate();
			try (var keys = statement.getGeneratedKeys()) {
				assertTrue(keys.next());
				return keys.getLong(1);
			}
		}
	}

	private static void linkItem(long publishItemId, long itemId) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO item_publish_item (publish_item_id, item_id) VALUES (?, ?)")) {
			statement.setLong(1, publishItemId);
			statement.setLong(2, itemId);
			statement.executeUpdate();
		}
	}

	private static void insertItemTarget(long itemId) throws Exception {
		try (Connection connection = dataSource.getConnection();
			 PreparedStatement statement = connection.prepareStatement(
					 "INSERT INTO item_target (item_id, target, previous_path, published_commit_id) VALUES (?, ?, ?, ?)")) {
			statement.setLong(1, itemId);
			statement.setString(2, LIVE_TARGET);
			statement.setString(3, PREVIOUS_PATH);
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
		try (InputStream in = PublishDAOTest.class.getClassLoader().getResourceAsStream(path)) {
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

	private static Configuration mybatisConfiguration(DataSource dataSource, TransactionFactory transactionFactory) {
		Configuration configuration = new Configuration(new Environment("test", transactionFactory, dataSource));
		configuration.setMapUnderscoreToCamelCase(true);
		configuration.setJdbcTypeForNull(JdbcType.VARCHAR);
		configuration.setVariables(mapperVariables());
		configuration.addMapper(DAOUtils.class);
		configuration.addMapper(UserDAO.class);
		configuration.addMapper(ItemDAO.class);
		configuration.addMapper(ItemTargetDAO.class);
		configuration.addMapper(PublishDAO.class);
		return configuration;
	}

	private static Properties mapperVariables() {
		Properties variables = new Properties();
		variables.setProperty("systemTypeFolder", "folder");
		variables.setProperty("systemTypePage", CONTENT_TYPE_PAGE);
		variables.setProperty("packageReadyState", Long.toString(READY.value));
		return variables;
	}
}
