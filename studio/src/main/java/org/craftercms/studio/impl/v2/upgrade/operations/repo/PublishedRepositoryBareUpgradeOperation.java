/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.impl.v2.upgrade.operations.repo;

import static java.lang.String.format;
import static org.craftercms.studio.api.v1.constant.GitRepositories.PUBLISHED;
import static org.craftercms.studio.api.v2.dal.Site.State.READY;
import static org.eclipse.jgit.lib.Constants.DOT_GIT;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.craftercms.studio.impl.v2.upgrade.operations.AbstractUpgradeOperation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.commons.io.FileUtils;
import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;

/**
 * Upgrade operation that updates the published repository to be a bare
 * repository.
 */
public class PublishedRepositoryBareUpgradeOperation extends AbstractUpgradeOperation {

	private static final Logger logger = LoggerFactory.getLogger(PublishedRepositoryBareUpgradeOperation.class);

	protected static final String PUBLISHED_TMP = "published-tmp";

	protected final GitRepositoryHelper gitRepositoryHelper;
	protected final SitesService siteService;
	protected final GeneralLockService generalLockService;

	@ConstructorProperties({ "studioConfiguration", "gitRepositoryHelper",
			"siteService", "generalLockService" })
	public PublishedRepositoryBareUpgradeOperation(StudioConfiguration studioConfiguration,
			GitRepositoryHelper gitRepositoryHelper,
			SitesService siteService,
			GeneralLockService generalLockService) {
		super(studioConfiguration);
		this.gitRepositoryHelper = gitRepositoryHelper;
		this.siteService = siteService;
		this.generalLockService = generalLockService;
	}

	@Override
	protected void doExecute(StudioUpgradeContext context) throws Exception {
		for (Site site : siteService.getSitesByState(READY)) {
			if (site.getPublishedRepoCreated()) {
				upgradeSite(site.getSiteId());
			}
		}
	}

	protected void upgradeSite(String siteId) throws Exception {
		Path publishedPath = gitRepositoryHelper.buildRepoPath(PUBLISHED, siteId);
		Path tmpPath = publishedPath.resolveSibling(PUBLISHED_TMP);
		logger.info("Processing repository for site: {}", siteId);

		String lockKey = gitRepositoryHelper.getPublishedRepoLockKey(siteId);
		generalLockService.lock(lockKey);
		try {
			if (!Files.exists(publishedPath) && !Files.exists(tmpPath)) {
				throw new UpgradeException(format("No published repository found for site '%s'", siteId));
			}

			if (Files.exists(publishedPath)) {
				if (!Files.exists(tmpPath)) {
					// published exists, and tmp does not
					// If published/.git exists, it means we just started the upgrade operation
					if (Files.exists(publishedPath.resolve(DOT_GIT))) {
						setPublishedRepositoryBare(siteId);
						return;
					}

					// published_tmp does not exist and published/.git does not exist
					// It means we are done
					ensureBareRepository(siteId);
					return;
				}
				// Both published and tmp directories exist
				if (Files.exists(publishedPath.resolve(DOT_GIT))) {
					// If published/.git exists, it means a partial move in a previous upgrade
					// attempt
					logger.error(
							"Inconsistent state found for site '{}', published directory contains a .git directory, but tmp directory already exists. Partial move in previous upgrade attempt?",
							siteId);
					throw new UpgradeException(format(
							"Unable to update published repository for site '%s', published directory contains a .git directory, but tmp directory already exists",
							siteId));
				}
				if (Files.exists(tmpPath.resolve(DOT_GIT))) {
					// If published_tmp/.git and published directory both exist, it means a partial
					// move in a previous upgrade attempt
					logger.error(
							"Inconsistent state found for site '{}', published_tmp contains a .git directory, but published directory exists as well. Partial move in previous upgrade attempt?",
							siteId);
					throw new UpgradeException(format(
							"Unable to update published repository for site '%s', published_tmp contains a .git directory, but published directory exists as well",
							siteId));
				}
				gitRepositoryHelper.setBareRepository(siteId);
				FileUtils.deleteDirectory(tmpPath.toFile());
				logger.info("published repository for site '{}' is now bare", siteId);
				return;
			}

			// Here the published_temp exists but published does not
			if (Files.exists(tmpPath.resolve(DOT_GIT))) {
				// The tmp directory contains a .git directory, so we need to move it to the
				// published directory
				moveDirectory(tmpPath.resolve(DOT_GIT), publishedPath);
				gitRepositoryHelper.setBareRepository(siteId);
				FileUtils.deleteDirectory(tmpPath.toFile());
				logger.info("published repository for site '{}' is now bare", siteId);
				return;
			}

			throw new UpgradeException(format(
					"Unable to update published repository for site '%s', published does not exist and published_temp directory does not contain the .git directory",
					siteId));
		} finally {
			generalLockService.unlock(lockKey);
		}
	}

	/**
	 * Ensure that the published repository is a bare repository.
	 *
	 * @param siteId the site id
	 * @throws UpgradeException if the published repository is not a bare repository and an error occurs while setting it to be bare
	 */
	protected void ensureBareRepository(String siteId) throws UpgradeException {
		try {
			if (!gitRepositoryHelper.isPublishedRepositoryBare(siteId)) {
				gitRepositoryHelper.setBareRepository(siteId);
				logger.info("published repository for site '{}' is now bare", siteId);
				return;
			}
			logger.info("published repository for site '{}' is already bare", siteId);
		} catch (RepositoryException | IOException e) {
			logger.error("Error trying to make sure that the published repository for site '{}' is a bare repository", siteId, e);
			throw new UpgradeException(format("Error trying to make sure that the published repository for site '%s' is a bare repository", siteId), e);
		}
	}

	/**
	 * Default path to convert the published repository to be a bare repository.
	 *
	 * @param siteId
	 * @throws RepositoryException
	 * @throws IOException
	 */
	protected void setPublishedRepositoryBare(String siteId) throws RepositoryException, IOException {
		Path publishedPath = gitRepositoryHelper.buildRepoPath(PUBLISHED, siteId);
		Path tmpPath = publishedPath.getParent().resolve(PUBLISHED_TMP);

		// Move the published repository to the tmp directory
		moveDirectory(publishedPath, tmpPath);

		// Move the .git directory from the tmp directory to the published directory
		moveDirectory(tmpPath.resolve(DOT_GIT), publishedPath);

		// Set the published repository to be a bare repository in the config
		gitRepositoryHelper.setBareRepository(siteId);

		// Delete the tmp directory
		FileUtils.deleteDirectory(tmpPath.toFile());

		logger.debug("Deleted temporary directory: {}", tmpPath);
		logger.info("published repository for site '{}' is now bare", siteId);
	}

	protected void moveDirectory(Path source, Path target) throws IOException {
		try {
			Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
		} catch (AtomicMoveNotSupportedException e) {
			logger.warn("Atomic move not supported, falling back to non-atomic move from '{}' to '{}'",
					source, target, e);
			Files.move(source, target);
		}
	}
}
