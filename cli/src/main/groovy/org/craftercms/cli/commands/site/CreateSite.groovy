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

package org.craftercms.cli.commands.site

import org.craftercms.cli.commands.AbstractCommand
import org.craftercms.cli.options.AuthOptions
import org.craftercms.cli.options.GitOptions
import org.craftercms.cli.options.SiteOptions
import picocli.CommandLine

@CommandLine.Command(name = 'create-site', description = 'Creates a project from a blueprint or a remote repository')
class CreateSite extends AbstractCommand {

	@CommandLine.Mixin
	SiteOptions siteOptions

	@CommandLine.Mixin
	AuthOptions authAware

	@CommandLine.Mixin
	GitOptions gitOptions

	@CommandLine.Option(names = ['-d', '--description'], description = 'The description for the project')
	String description

	@CommandLine.Option(names = '--blueprint', description = 'The id of the project blueprint')
	String blueprint

	@CommandLine.Option(names = ['-o', '--orphan'], description = 'Discards the history from the remote repository')
	boolean orphan

	@CommandLine.Option(names = '--singleBranch', description = 'Fetch only the given branch from the remote repository')
	Boolean singleBranch

	@CommandLine.Option(names = '--sandboxBranch', description = 'The name of the branch for the local repository')
	String sandboxBranch

	@CommandLine.Option(names = '--enableStaging', description = 'Enable staging for the new project. Staging cannot be disabled later.')
	boolean enableStaging

	@CommandLine.Option(names = ['--siteParam'], description = "Parameter for the blueprint")
	Map<String, String> siteParams


	@CommandLine.Option(names = ['-sn', '--siteName'], required = false, description = 'The name of the project')
	String siteName

	def additionalValidations() {
		if (gitOptions.url && blueprint) {
			throw new CommandLine.ParameterException(commandSpec.commandLine(), 'Cannot specify both --blueprint and --url')
		}
		if (!gitOptions.url && !blueprint) {
			throw new CommandLine.ParameterException(commandSpec.commandLine(), 'Missing required option blueprint or url')
		}
	}

	def run(client) {
		def params = [
			siteId         : siteOptions.siteId,
			name           : siteName ?: siteOptions.siteId,
			authentication : [type: 'none']
		]
		if (blueprint) {
			params.sourceType = 'blueprint'
			params.blueprintId = blueprint
		} else {
			// No blueprint, so we are creating a site from a remote repository
			params.sourceType = 'remote'
			params.remoteUrl = gitOptions.url

			if (gitOptions.remoteName) {
				params.remoteName = gitOptions.remoteName
			}
			if (gitOptions.remoteBranch) {
				params.remoteBranch = gitOptions.remoteBranch
			}
			if (singleBranch) {
				params.singleBranch = singleBranch
			}
			if (orphan) {
				params.createAsOrphan = orphan
			}

			if (authAware.token) {
				params.authentication = [type: 'token', token: authAware.token]
			} else if (authAware.username && authAware.password) {
				params.authentication = [type: 'basic', username: authAware.username, password: authAware.password]
			} else if (authAware.privateKey) {
				params.authentication = [type: 'key', privateKey: authAware.privateKey.text.trim()]
			}
		}
		if (sandboxBranch) {
			params.sandboxBranch = sandboxBranch
		}
		if (enableStaging) {
			params.enableStaging = true
		}
		if (description) {
			params.description = description
		}
		if (siteParams) {
			params.siteParams = siteParams
		}

		def path = '/studio/api/2/sites'
		def result = client.post(path, params)
		if (result) {
			println result.response.message
		}
	}

}
