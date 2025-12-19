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

@Grapes([
	@Grab(group = 'org.slf4j', module = 'slf4j-nop', version = '1.7.36'),
	@Grab(group = 'org.apache.commons', module = 'commons-lang3', version = '3.20.0'),
	@Grab(group = 'commons-codec', module = 'commons-codec', version = '1.19.0'),
	@Grab(group = 'commons-io', module = 'commons-io', version = '2.21.0')
])

import groovy.cli.commons.CliBuilder

import java.nio.file.Files
import java.nio.file.Paths

import org.apache.commons.codec.digest.DigestUtils
import org.apache.commons.lang3.StringUtils
import org.apache.commons.io.FilenameUtils
import org.apache.commons.io.FileUtils

import static java.nio.file.StandardCopyOption.*
import static utils.EnvironmentUtils.*
import static utils.ScriptUtils.*

/**
 * Builds the CLI and adds the possible options
 */
def buildCli(cli) {
	cli.h(longOpt: 'help', 'Show usage information')
	cli.v(longOpt: 'version', args: 1, argName: 'version', 'The community version of the Crafter bundle to download')
	cli.u(longOpt: 'bundle-url', args: 1, argName: 'url', 'The URL of the Crafter bundle to download. If you specify ' +
		'this URL the version parameter will be ignored')
	cli.p(longOpt: 'bundle-path', args: 1, argName: 'path', 'The path of the Crafter bundle in the filesystem. If you ' +
		'specify this path the URL and version parameter will be ' +
		'ignored')
}

/**
 * Returns the based url for bundle downloads.
 */
static def getDownloadsBaseUrl() {
	return getEnv("DOWNLOADS_BASE_URL")
}

/**
 * Prints the help info
 */
def printHelp(cli) {
	cli.usage()
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
 * Downloads the file from the URL into the target folder.
 */
def downloadFile(sourceUrl, targetFolder) {
	def url = sourceUrl.toURL()
	def filename = FilenameUtils.getName(url.path)
	def targetFile = targetFolder.resolve(filename)

	Files.deleteIfExists(targetFile)

	url.withInputStream { is ->
		Files.copy(is, targetFile)
	}

	return targetFile
}

/**
 * Computes an md5sum and compares it against an md5sum file.
 */
def checksum(file, downloadedMd5SumFile) {
	def computedMd5Sum = DigestUtils.md5Hex(Files.newInputStream(file))
	def downloadedMd5SumFileContent = new String(Files.readAllBytes(downloadedMd5SumFile), "UTF-8")
	def downloadedMd5Sum = StringUtils.substringBefore(downloadedMd5SumFileContent, " ")

	if (!computedMd5Sum.equals(downloadedMd5Sum)) {
		throw new RuntimeException("The md5sum for file ${file} doesn't match the downloaded md5sum")
	}
}

/**
 * Extract the bundle file into the target folder.
 */
def extractBundle(bundleFile, targetFolder) {
	println "============================================================"
	println "Extracting Bundle"
	println "============================================================"

	println "Extracting bundle to folder ${targetFolder}"

	// Extract tar.gz
	executeCommand(["tar", "xzf", bundleFile.toAbsolutePath().toString()], targetFolder)
}

/**
 * Downloads a Crafter Authoring/Delivery bundle, performs an md5sum to check if it was downloaded correctly, and
 * unzips the bundle
 */
def downloadBundle(cli, targetFolder, downloadsBaseUrl, version, bundleUrl, envSuffix) {
	println "============================================================"
	println "Downloading Bundle"
	println "============================================================"

	if (!bundleUrl) {
		if (version) {
			bundleUrl = "${downloadsBaseUrl}/${version}/crafter-cms-${envSuffix}-${version}.tar.gz"
		} else {
			exitWithError(cli, 'No [bundle-url] or [version] specified')
		}
	}

	def md5SumUrl = "${bundleUrl}.md5"

	println "Downloading bundle @ ${bundleUrl}..."
	def bundleFile = downloadFile(bundleUrl, targetFolder)

	println "Downloading md5sum @ ${md5SumUrl}..."
	def md5SumFile = downloadFile(md5SumUrl, targetFolder)

	println "Doing checksum..."
	checksum(bundleFile, md5SumFile)

	return bundleFile
}

/**
 * Sets up the actual upgrade script.
 */
def setupUpgradeScript(upgradeBinFolder, upgradeTmpFolder) {
	println "============================================================"
	println "Setting up upgrade script"
	println "============================================================"

	def sourceScript
	def targetScript

	sourceScript = upgradeBinFolder.resolve("upgrade.sh.off")
	targetScript = upgradeTmpFolder.resolve("upgrade.sh")

	Files.copy(sourceScript, targetScript, REPLACE_EXISTING)

	executeCommand(["chmod", "+x", targetScript.toAbsolutePath().toString()])

	println "========================================================================"
	println "Start upgrade completed"
	println "========================================================================"
	println "!!! Please execute ${targetScript} to continue with upgrade !!!"
}

/**
 * Starts the upgrade process.
 */
def startUpgrade(cli, upgradeBinFolder, upgradeTmpFolder, downloadsBaseUrl, version, bundleUrl, bundlePath,
		 environmentName) {
	def bundleFile

	if (Files.exists(upgradeTmpFolder)) {
		FileUtils.deleteDirectory(upgradeTmpFolder.toFile())
		Files.createDirectory(upgradeTmpFolder)
	} else {
		Files.createDirectories(upgradeTmpFolder)
	}

	if (bundlePath) {
		bundleFile = Paths.get(bundlePath)
	} else if (bundleUrl || version) {
		bundleFile = downloadBundle(cli, upgradeTmpFolder, downloadsBaseUrl, version, bundleUrl, environmentName)
	} else {
		exitWithError(cli, 'No [bundle-path], [bundle-url] or [version] specified')
	}

	extractBundle(bundleFile, upgradeTmpFolder)
	setupUpgradeScript(upgradeBinFolder, upgradeTmpFolder)
}

checkDownloadGrapesOnlyMode(getClass())

def cli = new CliBuilder(usage: 'start-upgrade [options]')
buildCli(cli)

def options = cli.parse(args)
if (options) {
	// Show usage text when -h or --help option is used.
	if (options.help) {
		printHelp(cli)
		return
	}

	startUpgrade(cli, getUpgradeHomeFolder(), getUpgradeTmpFolder(), getDownloadsBaseUrl(), options.version,
		options.'bundle-url', options.'bundle-path', getEnvironmentName())
}
