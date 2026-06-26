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
package upgrade.hooks


import upgrade.exceptions.UpgradeException

import java.nio.file.Files
import java.nio.file.Path

import static utils.EnvironmentUtils.getMariaDbDataFolder
import static utils.ScriptUtils.executeCommand

class UpgradeEmbeddedDbHook implements PostUpgradeHook {

	@Override
	void execute(Path binFolder, Path dataFolder, String environment) {
		def dbData = getMariaDbDataFolder()
		if (Files.exists(dbData)) {
			Files.list(dbData).withCloseable { files ->
				if (files.count() > 0) {
					println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
					println "Upgrading embedded DB"
					println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

					def setupCallback = { pb ->
						def env = pb.environment()
						env.remove("CRAFTER_HOME")
						env.remove("DEPLOYER_HOME")
						env.remove("CRAFTER_BIN_DIR")
						env.remove("CRAFTER_DATA_DIR")
						env.remove("CRAFTER_LOGS_DIR")
						env.remove("MARIADB_HOME")
						env.remove("MARIADB_DATA_DIR")
					}

					try {
						executeCommand(["./crafter.sh", "upgradedb"], binFolder, setupCallback)
					} catch (e) {
						throw new UpgradeException('Unable to upgrade the embedded DB', e)
					}
				}
			}
		}
	}

}
