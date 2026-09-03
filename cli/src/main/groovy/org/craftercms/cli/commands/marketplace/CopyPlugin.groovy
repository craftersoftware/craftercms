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

package org.craftercms.cli.commands.marketplace

import org.craftercms.cli.commands.AbstractCommand
import org.craftercms.cli.options.SiteOptions
import picocli.CommandLine

@CommandLine.Command(name = 'copy-plugin', description = 'Copies a plugin from a Studio local folder into a project')
class CopyPlugin extends AbstractCommand {

	@CommandLine.Mixin
	SiteOptions siteOptions

	@CommandLine.Option(names = '--path', required = true,
		description = 'The plugin source path (must be a local folder to Crafter Studio)')
	String path

	@CommandLine.Option(names = '--param', description = 'Additional parameter for the plugin')
	Map<String, String> parameters

	def run(client) {
		def body = [
			path  : path
		]
		if (parameters) {
			body.parameters = parameters
		}

		def path = "/studio/api/2/marketplace/${siteOptions.siteId}/copy"
		def result = client.post(path, body)
		if (result) {
			println "Copy plugin response"
			println result.response.message
		}
	}

}
