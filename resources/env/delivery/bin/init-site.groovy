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

@Grapes([
    @Grab(group='org.slf4j', module='slf4j-nop', version='1.7.36'),
    @Grab(group='org.apache.commons', module='commons-lang3', version='3.18.0'),
    @Grab(group='org.apache.commons', module='commons-collections4', version='4.5.0'),
    @Grab(group='commons-io', module='commons-io', version='2.19.0'),
    @Grab(group='com.squareup.okhttp3', module='okhttp', version='4.12.0')
])

import groovy.cli.commons.CliBuilder
import groovy.json.JsonBuilder

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

import org.apache.commons.collections4.CollectionUtils
import org.apache.commons.lang3.StringUtils
import org.apache.commons.io.FilenameUtils

import okhttp3.*

import static utils.EnvironmentUtils.*
import static utils.ScriptUtils.*

/**
 * Infers the repo path assuming a developer installation of CrafterCMS (both Crafter Authoring and Delivery at the
 * same location).
 */
def getDefaultRepoPath(siteName) {
    def deliveryHome = getEnv('DELIVERY_HOME')
    def authoringRoot = FilenameUtils.normalize("${deliveryHome}/../../crafter-authoring")
    def repoPath = "${authoringRoot}/data/repos/sites/${siteName}/published"

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
    cli.b(longOpt: 'branch', args: 1, argName: 'branch', 'The name of the branch to clone (live by default)')
    cli.u(longOpt: 'username', args: 1, argName: 'username', 'The username for the remote Git repo, when using basic ' +
            'authentication')
    cli.p(longOpt: 'password', args: 1, argName: 'password', 'The password for the remote Git repo, when using basic ' +
            'authentication')
    cli.k(longOpt: 'private-key', args: 1, argName: 'path', 'The path to the private key, when using private-key ' +
            'authentication through SSH to the remote Git repo')
    cli.f(longOpt: 'passphrase', args: 1, argName: 'passphrase', 'The passphrase of the private key (when the key is ' +
            'passphrase protected)')
    cli.a(longOpt: 'notification-addresses', args: 1, argName: 'addresses', 'A comma-separated list of email ' +
            'addresses that should receive deployment notifications')
}

/**
 * Prints the help info
 */
def printHelp(cli) {
    cli.usage()

    println 'EXAMPLES:'
    println ' Init a site from the default repo path (../../crafter-authoring/data/repos/sites/{sitename}/published)'
    println '     init-site mysite'
    println ' Init a site from a specific local repo path'
    println '     init-site mysite /opt/crafter/authoring/data/repos/sites/mysite/published'
    println ' Init a site from a specific local repo path, cloning a specific branch of the repo'
    println '     init-site -b master mysite /opt/crafter/authoring/data/repos/sites/mysite/published'
    println ' Init a site that is in a remote HTTPS repo with username/password authentication'
    println '     init-site -u jdoe -p jdoe1234 mysite https://github.com/jdoe/mysite.git'
    println ' Init a site that is in a remote SSH repo with public/private key authentication (private key path '
    println '     with no passphrase)'
    println '     init-site -k ~/.ssh/jdoe_key mysite ssh://myserver/opt/crater/sites/mysite'
    println ' Init a site that is in a remote SSH repo with public/private key authentication (specific private key path '
    println '     with passphrase)'
    println '     init-site -k ~/.ssh/jdoe_key -f jdoe123 mysite ssh://myserver/opt/crater/sites/mysite'
}

/**
 * Validate repo path
 */
def validateRepoPath(cli, repoPath) {
    if (!repoPath.matches('^((git|http|https|ssh)://.+)|([a-zA-Z0-9._-]+.+@)$')) {
        Path localPath

        if (repoPath.startsWith('file://')) {
            localPath = Paths.get(StringUtils.substringAfter(repoPath, 'file://'))
        } else {
            localPath = Paths.get(repoPath);
        }

        if (!Files.exists(localPath)) {
            exitWithError(cli, "Repository path ${repoPath} is supposed to be a local filesystem path but it does not exist");
        }
    }
}

/**
 * Calls the Deployer API to create the Deployer Target.
 */
def createDeployerTarget(siteName, repoPath, targetParams) {
    println 'Creating Deployer Target...'

    OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    MediaType mediaType = MediaType.parse('application/json')
    RequestBody body = RequestBody.create(new JsonBuilder(targetParams).toString(), mediaType)
    Request request = new Request.Builder()
            .url("${getDeployerUrl()}/api/1/target/create")
            .post(body)
            .addHeader('Content-Type', 'application/json')
            .build()
    try {
        Response response = client.newCall(request).execute()
        if (response.successful) {
            println 'Target created successfully'
        } else {
            println "Error while creating Target: ${response.message()}"
        }
    } catch (IOException e) {
        e.printStackTrace()
    }
}

/**
 * Initializes the delivery site
 */
def initSite(siteName, repoPath, targetParams) {
    createDeployerTarget(siteName, repoPath, targetParams)
}

checkDownloadGrapesOnlyMode(getClass())

def cli = new CliBuilder(usage: 'init-site [options] <site> [repo-path]')
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
        def repoPath

        if (extraArguments.size() >= 2) {
            repoPath = extraArguments[1]
        } else {
            repoPath = getDefaultRepoPath(siteName)
        }

        validateRepoPath(cli, repoPath)

        def targetParams = [
            env: 'default',
            site_name: siteName,
            template_name: 'remote',
            repo_url: repoPath,
            repo_branch: 'live',
            engine_url: getTomcatUrl()
        ];

        if (options.branch) {
            targetParams.repo_branch = options.branch
        }

        if (options.username) {
            targetParams.repo_username = options.username
            if (options.password) {
                targetParams.repo_password = options.password
            } else {
                exitWithError(cli, 'When specifying the [username] please include a [password] also')
            }
        } else if (repoPath.startsWith('ssh:') || repoPath.matches('[a-zA-Z0-9._-]+@.+')) {
            if (options.'private-key') {
                targetParams.ssh_private_key_path = options.'private-key'
            }
            if (options.passphrase) {
                targetParams.ssh_private_key_passphrase = options.passphrase
            }
        }

        if (options.'notification-addresses') {
            targetParams.notification_addresses = StringUtils.split(options.'notification-addresses', ',')
        }

        initSite(siteName, repoPath, targetParams)
    } else {
        exitWithError(cli, 'Neither <site> nor [repo-path] where specified')
    }
}
