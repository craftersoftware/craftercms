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

import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_SCHEMA;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class DatabaseCollationUpgradeOperationTest {

	@Mock
	private StudioConfiguration studioConfiguration;
	@Mock
	private StudioUpgradeContext context;
	@Mock
	private Connection connection;
	@Mock
	private Statement statement;
	@Mock
	private PreparedStatement siteStatement;
	@Mock
	private PreparedStatement tablesStatement;
	@Mock
	private ResultSet siteResultSet;
	@Mock
	private ResultSet tablesResultSet;

	@Test
	public void alignsDatabaseAndOtherTablesWithSite() throws Exception {
		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn("crafter");
		when(context.getConnection()).thenReturn(connection);
		when(connection.createStatement()).thenReturn(statement);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_SITE_COLLATION_SQL)).thenReturn(siteStatement);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_TABLES_SQL)).thenReturn(tablesStatement);
		when(siteStatement.executeQuery()).thenReturn(siteResultSet);
		when(tablesStatement.executeQuery()).thenReturn(tablesResultSet);
		when(siteResultSet.next()).thenReturn(true);
		when(siteResultSet.getString(1)).thenReturn("utf8mb3");
		when(siteResultSet.getString(2)).thenReturn("utf8mb3_general_ci");
		when(tablesResultSet.next()).thenReturn(true, true, false);
		when(tablesResultSet.getString(1)).thenReturn("workflow", "item");

		operation.doExecute(context);

		verify(siteStatement).setString(1, "crafter");
		verify(tablesStatement).setString(1, "crafter");
		verify(tablesStatement).setString(2, "utf8mb3_general_ci");

		InOrder statements = inOrder(statement);
		statements.verify(statement).execute("ALTER DATABASE `crafter` CHARACTER SET `utf8mb3` COLLATE `utf8mb3_general_ci`");
		statements.verify(statement).execute("ALTER TABLE `crafter`.`workflow` CONVERT TO CHARACTER SET `utf8mb3` COLLATE `utf8mb3_general_ci`");
		statements.verify(statement).execute("ALTER TABLE `crafter`.`item` CONVERT TO CHARACTER SET `utf8mb3` COLLATE `utf8mb3_general_ci`");
	}

	@Test
	public void namesTableAndKeyWhenConvertViolatesUniqueKey() throws Exception {
		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn("crafter");
		when(context.getConnection()).thenReturn(connection);
		when(connection.createStatement()).thenReturn(statement);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_SITE_COLLATION_SQL)).thenReturn(siteStatement);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_TABLES_SQL)).thenReturn(tablesStatement);
		when(siteStatement.executeQuery()).thenReturn(siteResultSet);
		when(tablesStatement.executeQuery()).thenReturn(tablesResultSet);
		when(siteResultSet.next()).thenReturn(true);
		when(siteResultSet.getString(1)).thenReturn("utf8mb4");
		when(siteResultSet.getString(2)).thenReturn("utf8mb4_uca1400_ai_ci");
		when(tablesResultSet.next()).thenReturn(true, false);
		when(tablesResultSet.getString(1)).thenReturn("user");
		SQLException duplicate = new SQLException(
			"(conn=7) Duplicate entry 'ss' for key 'user.user_ix_username'", "23000", 1062);
		when(statement.execute(contains("ALTER TABLE"))).thenThrow(duplicate);

		try {
			operation.doExecute(context);
			Assert.fail("expected a unique-key failure");
		} catch (UpgradeException e) {
			Assert.assertEquals("Failed to convert table 'crafter.user' to collation 'utf8mb4_uca1400_ai_ci' " +
				"because unique key 'user_ix_username' would contain duplicate values", e.getMessage());
			Assert.assertSame(duplicate, e.getCause());
		}
	}

	@Test
	public void namesTableWhenConstraintViolationDoesNotNameAKey() throws Exception {
		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn("crafter");
		when(context.getConnection()).thenReturn(connection);
		when(connection.createStatement()).thenReturn(statement);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_SITE_COLLATION_SQL)).thenReturn(siteStatement);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_TABLES_SQL)).thenReturn(tablesStatement);
		when(siteStatement.executeQuery()).thenReturn(siteResultSet);
		when(tablesStatement.executeQuery()).thenReturn(tablesResultSet);
		when(siteResultSet.next()).thenReturn(true);
		when(siteResultSet.getString(1)).thenReturn("utf8mb4");
		when(siteResultSet.getString(2)).thenReturn("utf8mb4_uca1400_ai_ci");
		when(tablesResultSet.next()).thenReturn(true, false);
		when(tablesResultSet.getString(1)).thenReturn("item");
		SQLException violation = new SQLException("Cannot add or update a child row", "23000", 1452);
		when(statement.execute(contains("ALTER TABLE"))).thenThrow(violation);

		try {
			operation.doExecute(context);
			Assert.fail("expected an integrity-constraint failure");
		} catch (UpgradeException e) {
			Assert.assertEquals("Failed to convert table 'crafter.item' to collation 'utf8mb4_uca1400_ai_ci' " +
				"because of an integrity constraint violation", e.getMessage());
			Assert.assertSame(violation, e.getCause());
		}
	}

	@Test
	public void keepsGenericMessageWhenConvertFailsForAnotherReason() throws Exception {
		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn("crafter");
		when(context.getConnection()).thenReturn(connection);
		when(connection.createStatement()).thenReturn(statement);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_SITE_COLLATION_SQL)).thenReturn(siteStatement);
		when(siteStatement.executeQuery()).thenReturn(siteResultSet);
		when(siteResultSet.next()).thenReturn(true);
		when(siteResultSet.getString(1)).thenReturn("utf8mb4");
		when(siteResultSet.getString(2)).thenReturn("utf8mb4_uca1400_ai_ci");
		SQLException failure = new SQLException("You have an error in your SQL syntax", "42000", 1064);
		when(statement.execute(contains("ALTER DATABASE"))).thenThrow(failure);

		try {
			operation.doExecute(context);
			Assert.fail("expected the generic alignment failure");
		} catch (UpgradeException e) {
			Assert.assertEquals("Failed to align database 'crafter' with the collation of table 'site'", e.getMessage());
			Assert.assertSame(failure, e.getCause());
		}
	}

	@Test
	public void readsUniqueKeyFromDuplicateEntryMessage() {
		Assert.assertEquals("uq_i_site_path", DatabaseCollationUpgradeOperation.uniqueKeyName(
			duplicateEntry("item.uq_i_site_path"), "item"));
		Assert.assertEquals("user_ix_username", DatabaseCollationUpgradeOperation.uniqueKeyName(
			duplicateEntry("user.user_ix_username"), "user"));
		Assert.assertEquals("group_ix_group_name", DatabaseCollationUpgradeOperation.uniqueKeyName(
			duplicateEntry("group_ix_group_name"), "group"));
		Assert.assertEquals("user_ix_username", DatabaseCollationUpgradeOperation.uniqueKeyName(
			new SQLException("Duplicate entry 'O''Brien' for key 'user.user_ix_username'", "23000", 1062), "user"));
		Assert.assertNull(DatabaseCollationUpgradeOperation.uniqueKeyName(
			new SQLException("Cannot add or update a child row", "23000", 1452), "item"));
		Assert.assertNull(DatabaseCollationUpgradeOperation.uniqueKeyName(new SQLException((String) null), "item"));
	}

	private static SQLException duplicateEntry(String key) {
		return new SQLException("(conn=4) Duplicate entry 'ss' for key '" + key + "'", "23000", 1062);
	}

	@Test(expected = UpgradeException.class)
	public void failsWhenSiteTableIsMissing() throws Exception {
		DatabaseCollationUpgradeOperation operation = new DatabaseCollationUpgradeOperation(studioConfiguration);
		when(studioConfiguration.getProperty(DB_SCHEMA)).thenReturn("crafter");
		when(context.getConnection()).thenReturn(connection);
		when(connection.prepareStatement(DatabaseCollationUpgradeOperation.FIND_SITE_COLLATION_SQL)).thenReturn(siteStatement);
		when(siteStatement.executeQuery()).thenReturn(siteResultSet);
		when(siteResultSet.next()).thenReturn(false);

		operation.doExecute(context);
	}

	@Test
	public void quotesBackticksInIdentifiers() {
		Assert.assertEquals("`cra``fter`", DatabaseCollationUpgradeOperation.quoteIdentifier("cra`fter"));
	}
}
