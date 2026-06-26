/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

@Grapes([
		@Grab(group = 'org.slf4j', module = 'slf4j-nop', version = '1.7.36'),
		@Grab(group = 'org.apache.commons', module = 'commons-lang3', version = '3.20.0'),
		@Grab(group = 'org.apache.commons', module = 'commons-collections4', version = '4.5.0'),
		@Grab(group = 'commons-io', module = 'commons-io', version = '2.21.0'),
		@Grab(group = 'com.squareup.okhttp3', module = 'okhttp-jvm', version = '5.3.2')
])

import groovy.cli.commons.CliBuilder

import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

import org.apache.commons.collections4.CollectionUtils
import org.apache.commons.io.FileUtils
import org.apache.commons.io.FilenameUtils

import okhttp3.*

import static utils.EnvironmentUtils.*
import static utils.ScriptUtils.*

/**
 * Returns the delivery repo path.
 */
def getRepoPath(siteName) {
	def deliveryHome = getEnv('DELIVERY_HOME')
	def repoPath = FilenameUtils.normalize("${deliveryHome}/../data/repos/sites/${siteName}")

	// Fix separators in case of being run on Windows
	repoPath = FilenameUtils.separatorsToSystem(repoPath)

	return repoPath
}

/**
 * Exits the script with an error message, the usage and an error status.
 */
def exitWithError(cli, msg) {
	println msg
	println ''

	printHelp(cli)

	System.exit(1)
}

/**
 * Builds the CLI and adds the possible options
 */
def buildCli(cli) {
	cli.h(longOpt: 'help', 'Show usage information')
}

/**
 * Prints the help message
 */
def printHelp(cli) {
	cli.usage()
}

/**
 * Calls the Deployer API to create the Deployer Target.
 */
def deleteDeployerTarget(siteName) {
	println 'Deleting Deployer Target...'

	OkHttpClient client = new OkHttpClient()
	MediaType mediaType = MediaType.parse('application/json')
	RequestBody body = RequestBody.create('', mediaType)
	Request request = new Request.Builder()
		.url("${getDeployerUrl()}/api/1/target/delete/default/${siteName}")
		.post(body)
		.addHeader('Content-Type', 'application/json')
		.build()
	try {
		Response response = client.newCall(request).execute()
		if (response.successful) {
			println 'Target deleted successfully'
		} else {
			println "Error while deleting Target: ${response.message()}"
		}
	} catch (IOException e) {
		e.printStackTrace()
	}
}

/**
 * Deletes the delivery repository folder
 */
def deleteRepoFolder(repoPath) {
	File repoFolder = new File(repoPath)
	if (repoFolder.exists()) {
		println "Deleting repo folder ${repoPath}..."

		FileUtils.forceDelete(repoFolder)

		println "Repo folder deleted successfully"
	}
}

/**
 * Deletes the delivery site
 */
def deleteSite(siteName, repoPath) {
	deleteDeployerTarget(siteName)
	deleteRepoFolder(repoPath)
}

checkDownloadGrapesOnlyMode(getClass())

def cli = new CliBuilder(usage: 'remove-site [options] <site>')
buildCli(cli)

def options = cli.parse(args)
if (options) {
	// Show usage text when -h or --help option is used.
	if (options.help) {
		printHelp(cli)
		return
	}

	// Parse the options and arguments
	def extraArguments = options.arguments();
	if (CollectionUtils.isNotEmpty(extraArguments)) {
		def siteName = extraArguments[0]
		def repoPath = getRepoPath(siteName)

		if (!Files.exists(Paths.get(repoPath))) {
			exitWithError(cli, "Repository path ${repoPath} does not exist or cannot be read");
		}

		deleteSite(siteName, repoPath)
	} else {
		exitWithError(cli, '<site> was not specified')
	}
}
