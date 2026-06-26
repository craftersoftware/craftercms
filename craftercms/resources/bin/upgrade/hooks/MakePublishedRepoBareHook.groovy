/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import org.apache.commons.io.FileUtils
import upgrade.exceptions.UpgradeException

import java.nio.file.Files
import java.nio.file.Path

/**
 * Hook to make the published repository bare for all sites.
 */
class MakePublishedRepoBareHook implements PostUpgradeHook {
	private static final String REPOS_DIR = "repos/sites"
	private static final String PUBLISHED = "published"
	private static final String PUBLISHED_TMP = "published-tmp"
	private static final String GIT_DIR = ".git"

	@Override
	void execute(Path binFolder, Path dataFolder, String environment) {
		println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
		println "Make published repo bare for all sites"
		println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

		Path sitesRoot = dataFolder.resolve(REPOS_DIR)
		if (!Files.isDirectory(sitesRoot)) {
			println "No sites directory at ${sitesRoot}. Skipping published repo conversion."
			return
		}
		Files.list(sitesRoot).withCloseable { stream ->
			stream.filter(Files.&isDirectory).forEach { upgradeRepo(it) }
		}

		println "\nAll published repositories are now bare"
	}

	/**
	 * Upgrade the published repository at the given path to make it bare.
	 * @param repositoryPath the path to the site (e.g. repos/sites/<site-name>)
	 */
	void upgradeRepo(Path repositoryPath) {
		String siteName = repositoryPath.getFileName()
		println "\nProcessing repository for site: ${siteName}"
		Path publishedPath = repositoryPath.resolve(PUBLISHED)
		if (!Files.exists(publishedPath)) {
			println "No published repository found at $publishedPath, skipping..."
			return
		} else if (!Files.exists(publishedPath.resolve(GIT_DIR))) {
			println "No .git directory found in $publishedPath. Already bare? Skipping..."
			return
		}
		// Move published to a published-tmp directory
		Path tmpPath = repositoryPath.resolve(PUBLISHED_TMP)
		Files.move(publishedPath, tmpPath)
		// Move the .git directory from the tmpPath to published
		Files.move(tmpPath.resolve(GIT_DIR), publishedPath)

		// Configure git to make the repository bare
		// git config --bool core.bare true
		ProcessBuilder pb = new ProcessBuilder("git", "config", "--bool", "core.bare", "true")
		pb.directory(publishedPath.toFile())
		pb.inheritIO()
		Process process = pb.start()
		int exitCode = process.waitFor()
		if (exitCode != 0) {
			println "Failed to set repository as bare: $repositoryPath"
			throw new UpgradeException("Failed to set repository as bare: $repositoryPath")
		}
		// Remove the tmp directory
		FileUtils.deleteDirectory(tmpPath.toFile())

		println "published repository for site $siteName is now bare"
	}
}
