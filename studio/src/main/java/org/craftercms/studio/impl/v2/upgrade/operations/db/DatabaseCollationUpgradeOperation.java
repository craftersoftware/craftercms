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
import org.craftercms.studio.impl.v2.upgrade.operations.AbstractUpgradeOperation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.lang.String.format;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_SCHEMA;

/**
 * Sets the database default character set and collation to those of the {@code site} table, then converts any table
 * that still uses a different collation.
 *
 * <p>Runs before new tables are created, so those tables inherit {@code site}'s collation. Tables which already
 * match are not rebuilt, so an interrupted upgrade resumes with the remaining tables.</p>
 *
 * <p>Converting to {@code site}'s collation can make previously distinct values equal, for example {@code ß} and
 * {@code ss} when {@code site} is {@code uca1400} and the other table is {@code general_ci}. A unique key on those
 * values (such as an item path, username, or group name) then fails the conversion. That failure names the table
 * and key.</p>
 */
public class DatabaseCollationUpgradeOperation extends AbstractUpgradeOperation {

	private static final Logger logger = LoggerFactory.getLogger(DatabaseCollationUpgradeOperation.class);

	// COLLATIONS.COLLATION_NAME stores a UCA-14 collation as its short family name (uca1400_ai_ci).
	// TABLES.TABLE_COLLATION stores the full name, which FULL_COLLATION_NAME matches.
	static final String FIND_SITE_COLLATION_SQL = """
		SELECT a.character_set_name, t.table_collation
		FROM information_schema.tables t
		INNER JOIN information_schema.collation_character_set_applicability a
		  ON a.full_collation_name = t.table_collation
		WHERE t.table_schema = ?
		  AND t.table_name = 'site'
		""";
	static final String FIND_TABLES_SQL = """
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = ?
		  AND table_type = 'BASE TABLE'
		  AND table_collation <> ?
		""";
	static final String ALTER_DATABASE_SQL = "ALTER DATABASE %s CHARACTER SET %s COLLATE %s";
	static final String ALTER_TABLE_SQL = "ALTER TABLE %s CONVERT TO CHARACTER SET %s COLLATE %s";
	static final String INTEGRITY_CONSTRAINT_VIOLATION = "23000";

	// MariaDB: Duplicate entry 'ss' for key 'user.user_ix_username'
	private static final Pattern DUPLICATE_KEY_NAME = Pattern.compile("for key '([^']*)'");

	public DatabaseCollationUpgradeOperation(StudioConfiguration studioConfiguration) {
		super(studioConfiguration);
	}

	@Override
	protected void doExecute(StudioUpgradeContext context) throws UpgradeException {
		String schema = studioConfiguration.getProperty(DB_SCHEMA);
		try (Connection connection = context.getConnection()) {
			SchemaDefaults defaults = readSiteDefaults(connection, schema);
			try (Statement statement = connection.createStatement()) {
				logger.info("Set database '{}' default character set to '{}' and collation to '{}', matching table 'site'",
					schema, defaults.characterSet(), defaults.collation());
				statement.execute(format(ALTER_DATABASE_SQL, quoteIdentifier(schema),
					quoteIdentifier(defaults.characterSet()), quoteIdentifier(defaults.collation())));
				for (String table : getTablesToConvert(connection, schema, defaults.collation())) {
					logger.info("Convert table '{}.{}' to collation '{}'", schema, table, defaults.collation());
					try {
						statement.execute(format(ALTER_TABLE_SQL, quoteIdentifier(schema) + "." + quoteIdentifier(table),
							quoteIdentifier(defaults.characterSet()), quoteIdentifier(defaults.collation())));
					} catch (SQLException e) {
						if (INTEGRITY_CONSTRAINT_VIOLATION.equals(e.getSQLState())) {
							throw uniqueKeyConflict(schema, table, defaults.collation(), e);
						}
						throw e;
					}
				}
			}
		} catch (SQLException e) {
			throw new UpgradeException(format("Failed to align database '%s' with the collation of table 'site'", schema), e);
		}
	}

	protected SchemaDefaults readSiteDefaults(Connection connection, String schema) throws SQLException, UpgradeException {
		try (PreparedStatement statement = connection.prepareStatement(FIND_SITE_COLLATION_SQL)) {
			statement.setString(1, schema);
			try (ResultSet resultSet = statement.executeQuery()) {
				if (!resultSet.next()) {
					throw new UpgradeException(format("Could not read the collation of table 'site' in database '%s'", schema));
				}
				return new SchemaDefaults(resultSet.getString(1), resultSet.getString(2));
			}
		}
	}

	protected List<String> getTablesToConvert(Connection connection, String schema, String collation) throws SQLException {
		List<String> tables = new ArrayList<>();
		try (PreparedStatement statement = connection.prepareStatement(FIND_TABLES_SQL)) {
			statement.setString(1, schema);
			statement.setString(2, collation);
			try (ResultSet resultSet = statement.executeQuery()) {
				while (resultSet.next()) {
					tables.add(resultSet.getString(1));
				}
			}
		}
		return tables;
	}

	static String quoteIdentifier(String identifier) {
		return "`" + identifier.replace("`", "``") + "`";
	}

	/**
	 * Key named by a duplicate-entry error, without a leading {@code table.} qualifier.
	 * MariaDB reports either {@code table.key} or {@code key}. Returns null when the message does not name a key.
	 */
	static String uniqueKeyName(SQLException failure, String table) {
		String message = failure.getMessage();
		if (message == null) {
			return null;
		}
		Matcher matcher = DUPLICATE_KEY_NAME.matcher(message);
		String reported = null;
		while (matcher.find()) {
			reported = matcher.group(1);
		}
		if (reported == null || reported.isEmpty()) {
			return null;
		}
		String prefix = table + ".";
		if (reported.startsWith(prefix) && reported.length() > prefix.length()) {
			return reported.substring(prefix.length());
		}
		return reported;
	}

	private static UpgradeException uniqueKeyConflict(String schema, String table, String collation, SQLException failure) {
		String key = uniqueKeyName(failure, table);
		if (key == null) {
			return new UpgradeException(format(
				"Failed to convert table '%s.%s' to collation '%s' because of an integrity constraint violation",
				schema, table, collation), failure);
		}
		return new UpgradeException(format(
			"Failed to convert table '%s.%s' to collation '%s' because unique key '%s' would contain duplicate values",
			schema, table, collation, key), failure);
	}

	private record SchemaDefaults(String characterSet, String collation) {
	}
}
