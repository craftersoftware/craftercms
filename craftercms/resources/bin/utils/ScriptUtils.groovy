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

@Grapes([
	@Grab(group = 'org.apache.commons', module = 'commons-lang3', version = '3.20.0'),
	@Grab(group = 'commons-io', module = 'commons-io', version = '2.21.0')
])

import org.apache.commons.lang3.SystemUtils
import org.apache.commons.io.FilenameUtils

import java.nio.file.Path

import static utils.EnvironmentUtils.*

class ScriptUtils {

	/**
	 * Returns the filename of the current script
	 */
	static String getScriptName(Class<?> scriptClass) {
		return FilenameUtils.getName(scriptClass.protectionDomain.codeSource.location.path)
	}

	/**
	 * Checks if the current script is currently in download grapes only mode. If it is, it prints a message and exits.
	 */
	static void checkDownloadGrapesOnlyMode(Class<?> scriptClass) {
		if (isDownloadGrapesOnlyMode()) {
			println "Downloading grapes for ${getScriptName(scriptClass)}..."

			System.exit(0)
		}
	}

	/**
	 * Executes a command line process.
	 */
	static executeCommand(List<String> command, Path workingDir = null, Closure<?> setupCallback = null,
			      List<Integer> successExitValues = [0], boolean waitFor = true) {
		if (SystemUtils.IS_OS_WINDOWS) {
			command = ["cmd", "/c"] + command
		}

		def processBuilder = new ProcessBuilder(command)
		processBuilder.redirectInput(ProcessBuilder.Redirect.INHERIT)
		processBuilder.redirectOutput(ProcessBuilder.Redirect.INHERIT)
		processBuilder.redirectError(ProcessBuilder.Redirect.INHERIT)

		if (workingDir) {
			processBuilder.directory(workingDir.toFile())
		}

		if (setupCallback) {
			setupCallback(processBuilder)
		}

		def process = processBuilder.start()
		if (waitFor) {
			process.waitFor()
			def exitValue = process.exitValue()
			if (!successExitValues.contains(exitValue)) {
				throw new RuntimeException("Process '${command}' exited with non-successful value ${exitValue}")
			}
		} else {
			return process
		}
	}

}
