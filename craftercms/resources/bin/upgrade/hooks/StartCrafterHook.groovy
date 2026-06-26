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

import org.apache.commons.lang3.BooleanUtils

import java.nio.file.Path

import static utils.ScriptUtils.executeCommand

class StartCrafterHook implements PostUpgradeHook {

	private List<String> flags

	StartCrafterHook() {
		this.flags = []
	}

	StartCrafterHook(List<String> flags) {
		this.flags = flags
	}

	@Override
	void execute(Path binFolder, Path dataFolder, String environment) {
		println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
		println "Starting up Crafter"
		println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

		def setupCallback = { pb ->
			def env = pb.environment()
			env.remove("CRAFTER_HOME")
			env.remove("DEPLOYER_HOME")
			env.remove("CRAFTER_BIN_DIR")
			env.remove("CRAFTER_DATA_DIR")
			env.remove("CRAFTER_LOGS_DIR")
		}

		executeCommand(["./startup.sh"] + flags, binFolder, setupCallback)

		// Wait for OpenSearch to start so its output don't get mixed with this script's
		sleep 5000
		println ''
		println 'Please make sure Crafter has started successfully before continuing'

		def cont = System.console().readLine '> Continue? [(Y)es/(N)o]: '
		cont = BooleanUtils.toBoolean(cont)

		if (!cont) {
			System.exit(0)
		}
	}

}
