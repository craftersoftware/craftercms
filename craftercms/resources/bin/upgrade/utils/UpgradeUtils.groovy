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

package upgrade.utils

import utils.NioUtils

import java.nio.file.Files
import java.nio.file.Path
import java.util.regex.Pattern

class UpgradeUtils {

	public static final String VERSION_FILENAME = 'version.txt'
	public static final Pattern VERSION_NUMBER_REGEX = ~/((\d{1,3}\.\d{1,3})\.\d{1,3}).*/

	/**
	 * Reads the version file under the install folder.
	 */
	static String readVersionFile(Path binFolder) {
		def versionFile = binFolder.resolve(VERSION_FILENAME)
		if (Files.exists(versionFile)) {
			def version = NioUtils.fileToString(versionFile)
			version = version.trim()

			def versionMatcher = VERSION_NUMBER_REGEX.matcher(version)
			if (versionMatcher.matches()) {
				def majorMinorPatch = versionMatcher.group(1)
				def majorMinor = versionMatcher.group(2)

				if (majorMinor == '3.0') {
					return '3.0.x'
				} else {
					return majorMinorPatch
				}
			} else {
				throw new IllegalStateException("Invalid version number in ${versionFile}")
			}
		} else if (Files.exists(binFolder.resolve('elasticsearch'))) {
			// 3.1.0 didn't have a version number file, but can be recognized by the new elasticsearch folder
			return '3.1.0'
		} else {
			return '3.0.x'
		}
	}

}