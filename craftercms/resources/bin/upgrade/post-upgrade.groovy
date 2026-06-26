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
package upgrade

@Grapes([
	@Grab(group = 'org.slf4j', module = 'slf4j-nop', version = '1.7.36'),
	@Grab(group = 'org.apache.commons', module = 'commons-lang3', version = '3.20.0'),
	@Grab(group = 'org.apache.commons', module = 'commons-collections4', version = '4.5.0'),
	@Grab(group = 'org.apache.commons', module = 'commons-configuration2', version = '2.13.0'),
	@Grab(group = 'org.apache.commons', module = 'commons-text', version = '1.15.0'),
	@Grab(group = 'commons-beanutils', module = 'commons-beanutils', version = '1.11.0'),
	@Grab(group = 'org.yaml', module = 'snakeyaml', version = '2.5')
])

import groovy.cli.commons.CliBuilder

import org.apache.commons.collections4.CollectionUtils
import upgrade.hooks.PostUpgradeHooks

import java.nio.file.Path

import static utils.EnvironmentUtils.*
import static utils.ScriptUtils.*

/**
 * Builds the CLI and adds the possible options
 */
def buildCli(CliBuilder cli) {
	cli.h(longOpt: 'help', 'Show usage information')
}

/**
 * Prints the help info
 */
def printHelp(CliBuilder cli) {
	cli.usage()
}

/**
 * Exits the script with an error message, the usage and an error status.
 */
def exitWithError(CliBuilder cli, String msg) {
	println msg
	println ''

	printHelp(cli)

	System.exit(1)
}

def postUpgrade(String oldVersion, String newVersion, String environment) {
	println "========================================================================"
	println "Post-upgrade ${oldVersion} -> ${newVersion}"
	println "========================================================================"

	Path binFolder = getCrafterBinFolder()
	Path dataFolder = getCrafterDataFolder()
	PostUpgradeHooks hooks = new PostUpgradeHooks(binFolder, dataFolder, oldVersion, newVersion, environment)

	hooks.execute()
}

checkDownloadGrapesOnlyMode(getClass())

def cli = new CliBuilder(usage: 'post-upgrade [options] <old-version> <new-version> <environment>')
buildCli(cli)

def options = cli.parse(args)
if (options) {
	// Show usage text when -h or --help option is used.
	if (options.help) {
		printHelp(cli)
		return
	}

	// Parse the options and arguments
	def extraArguments = options.arguments()
	if (CollectionUtils.isNotEmpty(extraArguments) && extraArguments.size() == 3) {
		def oldVersion = extraArguments[0]
		def newVersion = extraArguments[1]
		def environment = extraArguments[2]

		postUpgrade(oldVersion, newVersion, environment)
	} else {
		exitWithError(cli, 'Invalid list of arguments')
	}
}

