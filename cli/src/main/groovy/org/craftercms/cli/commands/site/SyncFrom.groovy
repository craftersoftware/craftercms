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

import org.craftercms.cli.commands.AbstractSyncCommand
import picocli.CommandLine

@CommandLine.Command(name = 'sync-from', description = 'Sync the content of a project from a remote repository')
class SyncFrom extends AbstractSyncCommand {

	@CommandLine.Option(names = ['-m', '--mergeStrategy'], description = 'The merge strategy to use', paramLabel = 'none|ours|theirs')
	String mergeStrategy

	def run(client) {
		def params = [
			remoteName  : remoteOptions.remoteName,
			remoteBranch: remoteOptions.remoteBranch
		]
		if (mergeStrategy) {
			params.mergeStrategy = mergeStrategy
		}

		def path = "/studio/api/2/repository/${siteOptions.siteId}/pull_from_remote.json"
		def result = client.post(path, params)
		if (result) {
			println result.response.message
		}
	}

}
