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
import org.craftercms.cli.options.SiteOptions
import picocli.CommandLine

@CommandLine.Command(name = 'list-remotes', description = 'List the remote repositories of a project')
class ListRemotes extends AbstractCommand {

	@CommandLine.Mixin
	SiteOptions siteOptions

	def run(client) {
		def path = "/studio/api/2/repository/${siteOptions.siteId}/list_remotes.json"
		def result = client.get(path)
		if (!result) {
			return
		}

		if (result.remotes) {
			result.remotes.each {
				println " ${it.name} (${it.url})"
				it.branches.each {
					println " - ${it}"
				}
			}
		} else {
			println "There are no remote repositories"
		}
	}

}
