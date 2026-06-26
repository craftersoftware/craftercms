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

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path

import static java.nio.file.StandardCopyOption.*

class NioUtils {

	/**
	 * Read file and return it as a string.
	 */
	static String fileToString(Path file) {
		return new String(Files.readAllBytes(file), StandardCharsets.UTF_8)
	}

	/**
	 * Writes the string to the specified file, truncating existing content.
	 */
	static void stringToFile(String str, Path file) {
		Files.write(file, str.getBytes(StandardCharsets.UTF_8))
	}

	/**
	 * Does simple string replacement in a directory, recursively
	 */
	static void findAndReplaceInDir(String target, String replacement, Path directory) {
		Files.walk(directory).withCloseable { files ->
			files.filter { file ->
				return !Files.isDirectory(file)
			}.each { file ->
				String content = fileToString(file).replace(target, replacement)
				stringToFile(content, file)
			}
		}
	}

	/**
	 * Recursively copies a directory to another path, preserving the file attributes.
	 */
	static void copyDirectory(Path srcDir, Path destDir) {
		Files.walk(srcDir).withCloseable { files ->
			files.each { srcFile ->
				def destFile = destDir.resolve(srcDir.relativize(srcFile))

				Files.copy(srcFile, destFile, COPY_ATTRIBUTES)
			}
		}
	}

}
