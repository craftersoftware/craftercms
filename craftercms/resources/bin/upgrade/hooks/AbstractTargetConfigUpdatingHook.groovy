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

import org.apache.commons.configuration2.YAMLConfiguration
import org.apache.commons.configuration2.builder.FileBasedConfigurationBuilder
import org.apache.commons.configuration2.builder.fluent.Parameters
import upgrade.exceptions.UpgradeException

import java.nio.file.Files
import java.nio.file.Path

abstract class AbstractTargetConfigUpdatingHook implements PostUpgradeHook {

	@Override
	void execute(Path binFolder, Path dataFolder, String environment) {
		Path targetsFolder = dataFolder.resolve("deployer/targets")

		if (Files.exists(targetsFolder)) {
			Files.walk(targetsFolder).withCloseable { files ->
				files.filter { file -> shouldBeUpdated(file) }
					.each { file -> updateTargetConfigFile(file) }
			}
		}
	}

	protected void updateTargetConfigFile(Path configFile) {
		Parameters params = new Parameters()
		FileBasedConfigurationBuilder<YAMLConfiguration> builder = new FileBasedConfigurationBuilder<>(
			YAMLConfiguration.class).configure(params.hierarchical().setFile(configFile.toFile()))
		YAMLConfiguration config

		try {
			config = builder.getConfiguration()
		} catch (e) {
			throw new UpgradeException("Unable to read target config ${configFile}", e)
		}

		println "Updating target config ${configFile}"

		doTargetConfigUpdate(config)

		try {
			builder.save()
		} catch (e) {
			throw new UpgradeException("Unable to save target config ${configFile}", e)
		}
	}

	protected abstract shouldBeUpdated(Path configFile)

	protected abstract void doTargetConfigUpdate(YAMLConfiguration config)

}
