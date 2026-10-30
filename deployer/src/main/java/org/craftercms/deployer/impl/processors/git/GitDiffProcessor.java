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
package org.craftercms.deployer.impl.processors.git;

import org.apache.commons.configuration2.Configuration;
import org.apache.commons.lang3.BooleanUtils;
import org.craftercms.commons.config.ConfigUtils;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.commons.git.utils.GitUtils;
import org.craftercms.deployer.api.ChangeSet;
import org.craftercms.deployer.api.Deployment;
import org.craftercms.deployer.api.ProcessorExecution;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.craftercms.deployer.impl.ProcessedCommitsStore;
import org.craftercms.deployer.impl.processors.AbstractMainDeploymentProcessor;
import org.craftercms.deployer.impl.processors.opensearch.OpenSearchIndexingProcessor;
import org.craftercms.search.batch.UpdateDetail;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.LogCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.revwalk.RevCommit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.*;

import static org.apache.commons.lang3.StringUtils.prependIfMissing;
import static org.apache.commons.lang3.StringUtils.removeEnd;
import static org.craftercms.deployer.impl.DeploymentConstants.*;

/**
 * Processor that, based on a previous processed commit that's stored, does a diff with the current commit of the deployment, to
 * find out the change set. If there is no previous processed commit, then the entire repository becomes the change set. This processor
 * is used basically to create the change set and should be used before other processors that actually process the change set, like
 * {@link OpenSearchIndexingProcessor}.
 *
 * @author avasquez
 */
public class GitDiffProcessor extends AbstractMainDeploymentProcessor {

	private static final Logger logger = LoggerFactory.getLogger(GitDiffProcessor.class);

	protected static final String INCLUDE_GIT_LOG_CONFIG_KEY = "includeGitLog";

	public static final String UPDATE_COMMIT_CONFIG_KEY = "updateCommitStore";

	protected File localRepoFolder;
	protected ProcessedCommitsStore processedCommitsStore;

	// Config properties (populated on init)

	protected boolean includeGitLog;

	protected String blobFileExtension;

	protected boolean updateCommitStore;

	/**
	 * Sets the local filesystem folder the contains the deployed repository.
	 */
	public void setLocalRepoFolder(File localRepoFolder) {
		this.localRepoFolder = localRepoFolder;
	}

	/**
	 * Sets the store for processed commits.
	 */
	public void setProcessedCommitsStore(ProcessedCommitsStore processedCommitsStore) {
		this.processedCommitsStore = processedCommitsStore;
	}

	public void setBlobFileExtension(String blobFileExtension) {
		this.blobFileExtension = blobFileExtension;
	}

	@Override
	protected void doInit(Configuration config) throws ConfigurationException {
		this.includeGitLog = ConfigUtils.getBooleanProperty(config, INCLUDE_GIT_LOG_CONFIG_KEY, false);
		updateCommitStore = ConfigUtils.getBooleanProperty(config, UPDATE_COMMIT_CONFIG_KEY, true);

		// use true as default for backward compatibility
		failDeploymentOnFailure = config.getBoolean(FAIL_DEPLOYMENT_CONFIG_KEY, true);
	}

	@Override
	protected void doDestroy() throws DeployerException {
		// Do nothing
	}

	@Override
	public boolean supportsMode(Deployment.Mode mode) {
		return mode == Deployment.Mode.PUBLISH || mode == Deployment.Mode.SEARCH_INDEX;
	}

	@Override
	protected boolean shouldExecute(Deployment deployment, ChangeSet filteredChangeSet) {
		// Run if the deployment is running
		return deployment.isRunning();
	}

	@Override
	protected ChangeSet doMainProcess(Deployment deployment, ProcessorExecution execution,
					  ChangeSet filteredChangeSet, ChangeSet originalChangeSet) throws DeployerException {
		boolean regularPublish = deployment.getMode() == Deployment.Mode.PUBLISH;
		ObjectId fromCommitId = getFromCommitIdParam(deployment);
		boolean reprocessAllFiles = getReprocessAllFilesParam(deployment);

		if (fromCommitId == null && reprocessAllFiles) {
			if (regularPublish) {
				processedCommitsStore.delete(targetId);
			}

			logger.info("All files from local repo {} will be reprocessed", localRepoFolder);
		}

		try (Git git = openLocalRepository()) {
			ObjectId previousCommitId = null;
			if (fromCommitId == null) {
				if (!reprocessAllFiles) {
					previousCommitId = processedCommitsStore.load(targetId);
				}
			} else {
				previousCommitId = fromCommitId;
			}
			ObjectId latestCommitId = getLatestCommitId(git);

			ChangeSet changeSet = resolveChangeSetFromCommits(git, previousCommitId, latestCommitId);

			if (changeSet != null) {
				if (includeGitLog) {
					updateChangeDetails(changeSet, git, previousCommitId, latestCommitId);
				}
				execution.setStatusDetails("Changes detected and resolved successfully");
			} else {
				execution.setStatusDetails("No changes detected");
			}

			// Make the new commit id available for other processors
			deployment.addParam(LATEST_COMMIT_ID_PARAM_NAME, latestCommitId);
			// Downstream processors can use this to determine whether their existing output
			// represents the repository state before this deployment's changes.
			if (previousCommitId != null) {
				deployment.addParam(PREVIOUS_COMMIT_ID_PARAM_NAME, previousCommitId);
			} else {
				deployment.removeParam(PREVIOUS_COMMIT_ID_PARAM_NAME);
			}

			if (updateCommitStore && regularPublish) {
				processedCommitsStore.store(targetId, latestCommitId);
			}

			return changeSet;
		}
	}

	protected void updateChangeDetails(ChangeSet changeSet, Git git, ObjectId previousCommitId,
					   ObjectId latestCommitId) {
		Map<String, UpdateDetail> changeDetails = new HashMap<>();
		Map<String, String> changeLog = new HashMap<>();

		try {
			LogCommand logCmd = git.log();
			if (previousCommitId != null && latestCommitId != null) {
				logCmd.addRange(git.getRepository().parseCommit(previousCommitId),
					git.getRepository().parseCommit(latestCommitId));
			}

			Iterable<RevCommit> log = logCmd.call();
			for (RevCommit commit : log) {
				UpdateDetail detail = new UpdateDetail();
				detail.setAuthor(commit.getAuthorIdent().getName());
				detail.setDate(Instant.ofEpochSecond(commit.getCommitTime()));
				changeDetails.put(commit.getName(), detail);

				try (ObjectReader reader = git.getRepository().newObjectReader()) {
					RevCommit parent = commit.getParentCount() > 0 ? commit.getParent(0) : null;
					List<DiffEntry> diff = GitUtils.doDiff(git, reader, parent, commit);

					diff.forEach(entry -> {
						if (entry.getChangeType() != DiffEntry.ChangeType.DELETE) {
							changeLog.putIfAbsent(removeEnd(entry.getNewPath(), blobFileExtension), commit.getName());
						}
					});
				}
			}

			changeSet.setUpdateDetails(changeDetails);
			changeSet.setUpdateLog(changeLog);
		} catch (Exception e) {
			logger.error("Error getting git log for commits {} {}", previousCommitId, latestCommitId, e);
		}
	}

	protected Git openLocalRepository() throws DeployerException {
		try {
			logger.debug("Opening local Git repository at {}", localRepoFolder);

			return GitUtils.openRepository(localRepoFolder);
		} catch (IOException e) {
			throw new DeployerException("Failed to open Git repository at " + localRepoFolder, e);
		}
	}

	protected ObjectId getLatestCommitId(Git git) throws DeployerException {
		try {
			return git.getRepository().resolve(Constants.HEAD);
		} catch (IOException e) {
			throw new DeployerException("Unable to retrieve HEAD commit ID", e);
		}
	}

	protected ChangeSet resolveChangeSetFromCommits(Git git, ObjectId fromCommitId,
							ObjectId toCommitId) throws DeployerException {
		String fromCommitIdStr = fromCommitId != null ? fromCommitId.name() : "{empty}";
		String toCommitIdStr = toCommitId != null ? toCommitId.name() : "{empty}";

		if (!Objects.equals(fromCommitId, toCommitId)) {
			logger.info("Calculating change set from commits: {} -> {}", fromCommitIdStr, toCommitIdStr);

			try (ObjectReader reader = git.getRepository().newObjectReader()) {
				return processDiffEntries(GitUtils.doDiff(git, reader, fromCommitId, toCommitId));
			} catch (IOException | GitAPIException e) {
				throw new DeployerException("Failed to calculate change set from commits: " + fromCommitIdStr +
					" -> " + toCommitIdStr, e);
			}
		} else {
			logger.info("Commits are the same. No change set will be calculated");

			return null;
		}
	}

	protected ChangeSet processDiffEntries(List<DiffEntry> diffEntries) {
		List<String> createdFiles = new ArrayList<>();
		List<String> updatedFiles = new ArrayList<>();
		List<String> deletedFiles = new ArrayList<>();
		String newPath;
		String oldPath;

		for (DiffEntry entry : diffEntries) {
			switch (entry.getChangeType()) {
				case MODIFY:
					newPath = asContentStoreUrl(entry.getNewPath());

					updatedFiles.add(newPath);

					logger.debug("Updated file: {}", newPath);
					break;
				case DELETE:
					oldPath = asContentStoreUrl(entry.getOldPath());

					deletedFiles.add(oldPath);

					logger.debug("Deleted file: {}", oldPath);
					break;
				case RENAME:
					oldPath = asContentStoreUrl(entry.getOldPath());
					newPath = asContentStoreUrl(entry.getNewPath());

					deletedFiles.add(oldPath);
					createdFiles.add(newPath);

					logger.debug("Renamed file: {} -> {}", oldPath, newPath);
					break;
				case COPY:
					oldPath = asContentStoreUrl(entry.getOldPath());
					newPath = asContentStoreUrl(entry.getNewPath());

					createdFiles.add(newPath);

					logger.debug("Copied file: {} -> {}", oldPath, newPath);
					break;
				default: // ADD
					newPath = asContentStoreUrl(entry.getNewPath());

					createdFiles.add(newPath);

					logger.debug("New file: {}", newPath);
					break;
			}
		}

		return new ChangeSet(createdFiles, updatedFiles, deletedFiles);
	}

	protected String asContentStoreUrl(String path) {
		return removeEnd(prependIfMissing(path, "/"), blobFileExtension);
	}

	protected boolean getReprocessAllFilesParam(Deployment deployment) {
		Object value = deployment.getParam(REPROCESS_ALL_FILES_PARAM_NAME);
		if (value != null) {
			if (value instanceof Boolean) {
				return (Boolean) value;
			} else {
				return BooleanUtils.toBoolean(value.toString());
			}
		} else {
			return false;
		}
	}

	protected ObjectId getFromCommitIdParam(Deployment deployment) {
		ObjectId objectId = null;
		Object value = deployment.getParam(FROM_COMMIT_ID_PARAM_NAME);
		if (value != null) {
			objectId = ObjectId.fromString((String) value);
		}
		return objectId;
	}

}
