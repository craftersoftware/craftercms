/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

package utils

import java.nio.file.Path
import java.nio.file.Paths

class EnvironmentUtils {

	/**
	 * Returns the value of an environment variable.
	 */
	static String getEnv(varName) {
		def env = System.getenv()

		return env[varName]
	}

	/**
	 * Returns the URL of the Tomcat.
	 */
	static String getTomcatUrl() {
		def host = getEnv('TOMCAT_HOST')
		def port = getEnv('TOMCAT_HTTP_PORT')
		def url = "http://${host}:${port}"

		return url
	}

	/**
	 * Returns the URL of the Deployer.
	 */
	static String getDeployerUrl() {
		def host = getEnv('DEPLOYER_HOST')
		def port = getEnv('DEPLOYER_PORT')
		def url = "http://${host}:${port}"

		return url
	}

	/**
	 * Returns the environment name (either authoring or delivery).
	 */
	static String getEnvironmentName() {
		return getEnv("ENVIRONMENT_NAME")
	}

	/**
	 * Returns the home folder for the Crafter installation.
	 */
	static Path getCrafterHomeFolder() {
		return Paths.get(getEnv("CRAFTER_HOME"))
	}

	/**
	 * Returns the bin folder for the Crafter installation.
	 */
	static Path getCrafterBinFolder() {
		return Paths.get(getEnv("CRAFTER_BIN_DIR"))
	}

	/**
	 * Returns the data folder for the Crafter installation.
	 */
	static Path getCrafterDataFolder() {
		return Paths.get(getEnv("CRAFTER_DATA_DIR"))
	}

	/**
	 * Returns the data folder for the embedded MariaDB.
	 */
	static Path getMariaDbDataFolder() {
		return Paths.get(getEnv("MARIADB_DATA_DIR"))
	}

	/**
	 * Returns the backups folder for the Crafter installation.
	 */
	static Path getCrafterBackupsFolder() {
		return getCrafterHomeFolder().resolve("backups")
	}

	/**
	 * Returns the home folder for the upgrade
	 */
	static Path getUpgradeHomeFolder() {
		return Paths.get(getEnv("UPGRADE_HOME"))
	}

	/**
	 * Returns the tmp folder used for the upgrade
	 */
	static Path getUpgradeTmpFolder() {
		return Paths.get(getEnv("UPGRADE_TMP_DIR"))
	}

	/**
	 * Return true if the script should run in download grapes only mode.
	 */
	static boolean isDownloadGrapesOnlyMode() {
		def downloadGrapesOnly = System.getProperty("mode.downloadGrapesOnly")
		if (downloadGrapesOnly) {
			return Boolean.parseBoolean(downloadGrapesOnly)
		} else {
			return false
		}
	}

}
