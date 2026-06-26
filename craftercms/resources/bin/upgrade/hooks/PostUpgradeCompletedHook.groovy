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
package upgrade.hooks

import java.nio.file.Path

class PostUpgradeCompletedHook implements PostUpgradeHook {

	private boolean crafterStarted

	PostUpgradeCompletedHook(boolean crafterStarted) {
		this.crafterStarted = crafterStarted
	}

	@Override
	void execute(Path binFolder, Path dataFolder, String environment) {
		println "========================================================================"
		println "Post-upgrade completed"
		println "========================================================================"

		if (crafterStarted) {
			println 'Crafter has already been started, you can use the system again'
		} else {
			println "!!! Crafter has not been started, please run ${binFolder.resolve('startup.sh')} to start it !!!"
		}
	}

}
