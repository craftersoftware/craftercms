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
import org.craftercms.cli.options.SiteOptions
import picocli.CommandLine

@CommandLine.Command(name = 'add-remote', description = 'Adds a remote repository to a project')
class AddRemote extends AbstractCommand {

	@CommandLine.Mixin
	SiteOptions siteOptions

	@CommandLine.Mixin
	AuthOptions authAware

	@CommandLine.Option(names = ['-n', '--name'], required = true, description = 'The name of the remote repository')
	String remoteName

	@CommandLine.Option(names = ['-u', '--url'], required = true, description = 'The url of the remote repository')
	String remoteUrl

	def run(client) {
		def params = [
			remoteName        : remoteName,
			remoteUrl         : remoteUrl,
			authenticationType: authAware.authType
		]
		if (authAware.username) {
			params.remoteUsername = authAware.username
		}
		if (authAware.password) {
			params.remotePassword = authAware.password
		}
		if (authAware.token) {
			params.remoteToken = authAware.token
		}
		if (authAware.privateKey) {
			// trim to avoid issues with empty lines
			params.remotePrivateKey = authAware.privateKey.text.trim()
		}

		def path = "/studio/api/2/repository/${siteOptions.siteId}/add_remote.json"
		def result = client.post(path, params)
		if (result) {
			println result.response.message
		}
	}

}
