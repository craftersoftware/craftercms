/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import java.nio.file.Files
import java.nio.file.Path
import org.apache.commons.io.FileUtils
import static utils.EnvironmentUtils.getEnv


class RemoveOldSearchIndexesDirHook implements PostUpgradeHook {
	@Override
	void execute(Path binFolder, Path dataFolder, String environment) {
		println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
		println "Remove old search indexes directory"
		println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
		String indexesDir = getEnv('SEARCH_INDEXES_DIR')
		Path indexesDirPath = Path.of(indexesDir)
		println "SEARCH_INDEXES_DIR: ${indexesDirPath}"
		if (!Files.exists(indexesDirPath)) {
			println "Directory does not exist."
			return
		}
		FileUtils.deleteDirectory(indexesDirPath.toFile())
		println "Removed directory: ${indexesDirPath}"
	}
}
