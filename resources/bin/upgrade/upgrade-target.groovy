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
package upgrade

@Grapes([
    @Grab(group = 'org.slf4j', module = 'slf4j-nop', version = '1.7.36'),
    @Grab(group = 'org.apache.commons', module = 'commons-lang3', version = '3.20.0'),
    @Grab(group = 'org.apache.commons', module = 'commons-collections4', version = '4.5.0'),
    @Grab(group = 'commons-codec', module = 'commons-codec', version = '1.19.0'),
    @Grab(group = 'commons-io', module = 'commons-io', version = '2.21.0'),
    @Grab(group = 'com.vdurmont', module = 'semver4j', version = '3.1.0')
])

import groovy.cli.commons.CliBuilder
import groovy.transform.Field
import org.apache.commons.lang3.StringUtils

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

import org.apache.commons.codec.digest.DigestUtils
import org.apache.commons.collections4.CollectionUtils
import org.apache.commons.io.FileUtils
import org.apache.commons.lang3.BooleanUtils

import com.vdurmont.semver4j.Semver

import utils.NioUtils

import static java.nio.file.StandardCopyOption.*
import static upgrade.utils.UpgradeUtils.*
import static utils.EnvironmentUtils.*
import static utils.ScriptUtils.*

// Files that should not be overwritten automatically. Keys are the file patterns, values indicate if the patterns
// match multiple config files
@Field Map<String, Boolean> configFilePatterns = [
    'crafter-setenv\\.sh': false,
    'apache-tomcat/conf/.+': true,
    'apache-tomcat/shared/classes/.+': true,
    'crafter-deployer/config/.+': true,
    'crafter-deployer/logging\\.xml': false,
    'elasticsearch/config/.+': true
]
// List of patterns for files that shouldn't be deleted
@Field List<String> shouldNotBeDeletedFilePatterns = [
    'install-license\\.(.*)',
    'apache-tomcat/shared/classes/crafter/license(/.+)?'
]
@Field String backupTimestampFormat = "yyyyMMddHHmmss"
@Field List<String> alwaysOverwriteConfigFilePatterns = []

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

/**
 * Backups the data.
 */
def backupData(Path binFolder) {
    def backup = System.console().readLine '> Backup the data folder before upgrade? [(Y)es/(N)o]: '
        backup = BooleanUtils.toBoolean(backup)

    if (backup) {
        println "========================================================================"
        println "Backing up data"
        println "========================================================================"

        def setupCallback = { pb ->
            def env = pb.environment()
                env.remove("CRAFTER_HOME")
                env.remove("DEPLOYER_HOME")
                env.remove("CRAFTER_BIN_DIR")
                env.remove("CRAFTER_DATA_DIR")
                env.remove("CRAFTER_LOGS_DIR")
        }

        executeCommand(["./crafter.sh", "backup"], binFolder, setupCallback)
    }
}

/**
 * Backups the bin folder.
 */
def backupBin(Path binFolder, Path backupsFolder, String environmentName) {
    def backup = System.console().readLine '> Backup the bin folder before upgrade? [(Y)es/(N)o]: '
        backup = BooleanUtils.toBoolean(backup)

    if (backup) {
        println "========================================================================"
        println "Backing up bin"
        println "========================================================================"

        def now = new Date()
        def backupTimestamp = now.format(backupTimestampFormat)

        if (!Files.exists(backupsFolder)) {
            Files.createDirectories(backupsFolder)
        }

        def backupBinFolder = backupsFolder.resolve("crafter-${environmentName}-bin.${backupTimestamp}.bak")

        println "Backing up bin folder to ${backupBinFolder}"

        NioUtils.copyDirectory(binFolder, backupBinFolder)
    }
}

/**
 * Shutdowns Crafter.
 */
def shutdownCrafter(Path binFolder) {
    println "========================================================================"
    println "Shutting down Crafter"
    println "========================================================================"

    def setupCallback = { pb ->
        def env = pb.environment()
            env.remove("CRAFTER_HOME")
            env.remove("DEPLOYER_HOME")
            env.remove("CRAFTER_BIN_DIR")
            env.remove("CRAFTER_DATA_DIR")
            env.remove("CRAFTER_LOGS_DIR")
    }

    executeCommand(["./shutdown.sh"], binFolder, setupCallback)
}

/**
 * Returns the config file pattern that matches the given path.
 */
def matchesConfigFilePatterns(Path path) {
    return configFilePatterns.keySet().find { path.toString().matches(it) }
}

/**
 * Returns true if the given path matches one of the should not delete file patterns.
 */
def shouldNotBeDeleted(Path path) {
    return shouldNotBeDeletedFilePatterns.any { path.toString().matches(it) }
}

/**
 * Returns true if the checksum of both specified fiels is the same, false otherwise.
 */
def compareFiles(Path file1, Path file2) {
    def file1Md5
    def file2Md5

    Files.newInputStream(file1).withCloseable { inputStream ->
        file1Md5 = DigestUtils.md5Hex(inputStream)
    }
    Files.newInputStream(file2).withCloseable { inputStream ->
        file2Md5 = DigestUtils.md5Hex(inputStream)
    }

    return file1Md5 == file2Md5
}

/**
 * Executes the a diff between the specified files.
 */
def diffFiles(Path oldFile, Path newFile) {
    executeCommand(["/bin/sh", "-c", "diff ${oldFile} ${newFile} | less".toString()])
}

/**
 * Opens the default editor, pointed by $EDITOR. If the env variable doesn't exist, nano is used instead.
 */
def openEditor(Path path) {
    def command = System.getenv('EDITOR')
    if (!command) {
        command = 'nano'
    }

    executeCommand([command, "${path}".toString()])
}

/**
 * Overwrites the old file with the new file, backing up the old file first to ${OLD_FILE_PATH}.${TIMESTAMP}.bak.
 */
def overwriteConfigFile(Path binFolder, Path oldFile, Path newFile, Path filePath) {
    def now = new Date()
    def backupTimestamp = now.format(backupTimestampFormat)
    def backupFilePath = "${filePath}.${backupTimestamp}.bak"
    def backupFile = binFolder.resolve(backupFilePath)

    println "[o] Overwriting config file ${filePath} with the new release version (backup of the old one will be at ${backupFilePath})"

    Files.move(oldFile, backupFile)
    Files.copy(newFile, oldFile, REPLACE_EXISTING)
}

/**
 * Prints the border of a menu, using the specified length
 */
def printMenuBorder(int length) {
    for (i = 0; i < length; i++) {
        print '-'
    }

    println ''
}

/**
 * Prints the interactive "menu" that asks for the user input when the new version of a file differs from the old
 * version.
 */
def showSyncFileMenu(Path filePath, String configPattern) {
    def firstLine = "Config file [${filePath}] is different in the new release. Please choose:".toString()
    def matchesMultipleFiles = configFilePatterns[configPattern]

    println ''
    printMenuBorder(firstLine.length())
    println firstLine
    println ' - (D)iff file versions to see what changed'
    println ' - (E)dit the original file (with $EDITOR)'
    println ' - (K)eep the original file'
    println ' - (O)verwrite the file with the new version'

    if (matchesMultipleFiles) {
        println " - (M)atching config files for regex [${configPattern}] should always be overwritten"
    }

    println " - (A)lways overwrite config files and don't ask again"
    println ' - (Q)uit the upgrade script (this will stop the upgrade at this point)'
    printMenuBorder(firstLine.length())

    def option = System.console().readLine '> Enter your choice: '
        option = StringUtils.lowerCase(option)

    println ''

    return option
}

/**
 * Syncs an old file with it's new version.
 */
def syncFile(Path binFolder, Path newBinFolder, Path filePath, boolean alwaysOverwrite) {
    def oldFile = binFolder.resolve(filePath)
    def newFile = newBinFolder.resolve(filePath)

    if (Files.isDirectory(newFile)) {
        if (!Files.exists(oldFile)) {
            println "[+] Creating new folder ${filePath}"

            Files.createDirectories(oldFile)
        }
    } else if (Files.exists(oldFile)) {
        def configPattern = matchesConfigFilePatterns(filePath)
        if (configPattern != null) {
            def done = false

            while (!done) {
                if (compareFiles(oldFile, newFile)) {
                    done = true
                } else if (alwaysOverwrite || alwaysOverwriteConfigFilePatterns.contains(configPattern)) {
                    overwriteConfigFile(binFolder, oldFile, newFile, filePath)
                    done = true
                } else {
                    def selectedOption = showSyncFileMenu(filePath, configPattern)
                    switch (selectedOption) {
                        case 'd':
                            diffFiles(oldFile, newFile)
                            break
                        case 'e':
                            openEditor(oldFile)
                            break
                        case 'k':
                            done = true
                            break
                        case 'o':
                            overwriteConfigFile(binFolder, oldFile, newFile, filePath)
                            done = true
                            break
                        case 'm':
                            overwriteConfigFile(binFolder, oldFile, newFile, filePath)
                            alwaysOverwriteConfigFilePatterns.add(configPattern)
                            done = true
                            break
                        case 'a':
                            overwriteConfigFile(binFolder, oldFile, newFile, filePath)
                            done = true
                            alwaysOverwrite = true
                            break
                        case 'q':
                            println 'Quitting upgrade...'
                            System.exit(0)
                        default:
                            println "[!] Unrecognized option '${selectedOption}'"
                            break
                    }
                }
            }
        } else if (!compareFiles(oldFile, newFile)) {
            println "[o] Overwriting file ${filePath} with the new release version"

            Files.copy(newFile, oldFile, REPLACE_EXISTING)
        }
    } else {
        println "[+] Copying new file ${filePath}"

        def parent = oldFile.parent
        if (!Files.exists(parent)) {
            Files.createDirectories(parent)
        }

        Files.copy(newFile, oldFile)
    }

    return alwaysOverwrite
}

/**
 * Prints the interactive "menu" that asks for the user input when an old file doesn't appear in the new release.
 */
def showDeleteFileMenu(Path filePath) {
    def firstLine = "Config file [${filePath}] doesn't exist in the new release. Delete the file?".toString()

    println ''
    printMenuBorder(firstLine.length())
    println firstLine
    println ' - (N)o'
    println ' - (Y)es'
    println " - (A)lways delete files absent from new release and don't ask again"
    println ' - (Q)uit the upgrade script (this will stop the upgrade at this point)'
    printMenuBorder(firstLine.length())

    def option = System.console().readLine '> Enter your choice: '
        option = StringUtils.lowerCase(option)

    println ''

    return option
}

/**
 * Checks if an old file needs to be deleted if it doesn't appear in the new release.
 */
def deleteFileIfAbsentInNewRelease(Path binFolder, Path newBinFolder, Path filePath, boolean alwaysDelete, ArrayList keepDirectories) {
    def oldFile = binFolder.resolve(filePath)
    def newFile = newBinFolder.resolve(filePath)
    def delete = false

    if (!Files.exists(newFile) && !shouldNotBeDeleted(filePath)) {
        if (!alwaysDelete && !Files.isDirectory(oldFile) && matchesConfigFilePatterns(filePath) != null) {
            def done = false

            while (!done) {
                def selectedOption = showDeleteFileMenu(filePath)
                switch (selectedOption) {
                    case 'n':
                        done = true
                        keepDirectories.add(filePath.getParent().toString())
                        break
                    case 'y':
                        delete = true
                        done = true
                        break
                    case 'a':
                        delete = true
                        alwaysDelete = true
                        done = true
                        break
                    case 'q':
                        println 'Quitting upgrade...'
                        System.exit(0)
                    default:
                        println "[!] Unrecognized option '${selectedOption}'"
                        break
                }
            }
        } else if (Files.isDirectory(oldFile) && keepDirectories.contains(filePath.toString())) {
            println "[k] Keep directory ${filePath} as it contains files should not be deleted."
            delete = false
        } else {
            delete = true
        }
    }

    if (delete) {
        println "[-] Deleting file ${filePath} that doesn't exist in the new release"

        Files.delete(oldFile)
    }

    return alwaysDelete
}

/**
 * Clears Tomcat's temp folders and exploded webapps.
 */
def resetTomcat(Path binFolder) {
    def tempFolder = binFolder.resolve("apache-tomcat/temp")
    def workFolder = binFolder.resolve("apache-tomcat/work")
    def logsFolder = binFolder.resolve("apache-tomcat/logs")
    def webAppsFolder = binFolder.resolve("apache-tomcat/webapps")

    if (Files.exists(tempFolder)) {
        FileUtils.cleanDirectory(tempFolder.toFile())
    }
    if (Files.exists(workFolder)) {
        FileUtils.cleanDirectory(workFolder.toFile())
    }
    if (Files.exists(logsFolder)) {
        FileUtils.cleanDirectory(logsFolder.toFile())
    }
    if (Files.exists(webAppsFolder)) {
        Files.walk(webAppsFolder).withCloseable { files ->
            files
                .filter { file -> return file != webAppsFolder && Files.isDirectory(file) }
                .each { file -> FileUtils.deleteDirectory(file.toFile()) }
        }
    }
}

/**
 * Does the actual upgrade
 */
def doUpgrade(String oldVersion, String newVersion, Path binFolder, Path newBinFolder) {
    println "========================================================================"
    println "Upgrading Crafter ${oldVersion} -> ${newVersion}"
    println "========================================================================"

    resetTomcat(binFolder)
    resetTomcat(newBinFolder)

    println "Synching files from ${newBinFolder} to ${binFolder}..."

    def alwaysOverwrite = false
    def alwaysDelete = false
    def keepDirectories = []

    // Delete files in the old bundle that are absent in the new bundle
    Files.walk(binFolder).withCloseable { files ->
        files
            .sorted(Comparator.reverseOrder())
            .each { file ->
                alwaysDelete = deleteFileIfAbsentInNewRelease(
                    binFolder, newBinFolder, binFolder.relativize(file), alwaysDelete, keepDirectories)
            }
    }

    // Sync the files between the old bundle and the new bundle
    Files.walk(newBinFolder).withCloseable { files ->
        files
            .sorted(Comparator.reverseOrder())
            .each { file ->
                alwaysOverwrite = syncFile(binFolder, newBinFolder, newBinFolder.relativize(file), alwaysOverwrite)
            }
    }
}

def setupPostUpgradeScript(Path upgradeFolder, String oldVersion, String newVersion) {
    def sourceScript = upgradeFolder.resolve("post-upgrade.sh.off")
    def destScript = upgradeFolder.resolve("post-upgrade.sh")

    def content = new String(Files.readAllBytes(sourceScript), StandardCharsets.UTF_8)
        content = content.replace("{{oldVersion}}", oldVersion)
        content = content.replace("{{newVersion}}", newVersion)

    Files.write(destScript, content.getBytes(StandardCharsets.UTF_8))
    Files.delete(sourceScript)

    executeCommand(["chmod", "+x", destScript.toAbsolutePath().toString()])
}

/**
 * Executes the upgrade.
 */
def upgrade(Path targetFolder) {
    def binFolder = targetFolder.resolve("bin")
    def backupsFolder = targetFolder.resolve("backups")
    def newBinFolder = getCrafterBinFolder()
    def oldVersion = readVersionFile(binFolder)
    def newVersion = readVersionFile(newBinFolder)

    shutdownCrafter(binFolder)
    backupData(binFolder)
    backupBin(binFolder, backupsFolder, getEnvironmentName())
    doUpgrade(oldVersion, newVersion, binFolder, newBinFolder)

    setupPostUpgradeScript(binFolder.resolve("upgrade"), oldVersion, newVersion)

    Semver oldSemver = new Semver(oldVersion, Semver.SemverType.NPM).withClearedSuffixAndBuild()
    Semver newSemver = new Semver(newVersion, Semver.SemverType.NPM).withClearedSuffixAndBuild()

    println "========================================================================"
    println "Upgrade completed"
    println "========================================================================"
    println "!!! Please read the release notes and make any necessary manual changes, then run the post upgrade script: ${binFolder.toAbsolutePath()}/upgrade/post-upgrade.sh !!!"

}

checkDownloadGrapesOnlyMode(getClass())

def cli = new CliBuilder(usage: 'upgrade-target [options] <target-installation-path>')
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
    if (CollectionUtils.isNotEmpty(extraArguments)) {
        def targetPath = extraArguments[0]
        def targetFolder = Paths.get(targetPath)

        upgrade(targetFolder)
    } else {
        exitWithError(cli, 'No <target-installation-path> was specified')
    }
}
