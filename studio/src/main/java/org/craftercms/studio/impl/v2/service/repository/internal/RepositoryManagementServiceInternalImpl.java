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

package org.craftercms.studio.impl.v2.service.repository.internal;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.MapUtils;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.crypto.CryptoException;
import org.craftercms.commons.crypto.TextEncryptor;
import org.craftercms.studio.api.v1.constant.GitRepositories;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.*;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.*;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepository;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepositoryDAO;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepositoryInfo;
import org.craftercms.studio.api.v2.dal.repository.RepositoryStatus;
import org.craftercms.studio.api.v2.event.site.SyncFromRepoEvent;
import org.craftercms.studio.api.v2.exception.PullFromRemoteConflictException;
import org.craftercms.studio.api.v2.exception.content.ContentInPublishQueueException;
import org.craftercms.studio.api.v2.exception.git.NoMergeStateException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryNotFoundException;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.repository.RetryingRepositoryOperationFacade;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.notification.NotificationService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.repository.ConflictResolution;
import org.craftercms.studio.api.v2.service.repository.MergeResult;
import org.craftercms.studio.api.v2.service.repository.RepositoryManagementService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.utils.GitUtils;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.eclipse.jgit.api.*;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.api.errors.InvalidRemoteException;
import org.eclipse.jgit.api.errors.JGitInternalException;
import org.eclipse.jgit.api.errors.TransportException;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.errors.CorruptObjectException;
import org.eclipse.jgit.errors.NoRemoteRepositoryException;
import org.eclipse.jgit.lib.*;
import org.eclipse.jgit.merge.MergeStrategy;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.revwalk.filter.RevFilter;
import org.eclipse.jgit.transport.*;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.eclipse.jgit.treewalk.filter.PathFilter;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;

import java.io.*;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static java.lang.String.format;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.apache.commons.collections4.CollectionUtils.isEmpty;
import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.craftercms.studio.api.v1.constant.GitRepositories.SANDBOX;
import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.*;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getSandboxRepoLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getStudioTemporaryFilesRoot;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.LOCK_FILE;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUsername;
import static org.eclipse.jgit.lib.IndexDiff.StageState.DELETED_BY_THEM;
import static org.eclipse.jgit.lib.IndexDiff.StageState.DELETED_BY_US;

public class RepositoryManagementServiceInternalImpl implements RepositoryManagementService, ApplicationContextAware {

	private static final Logger logger = LoggerFactory.getLogger(RepositoryManagementServiceInternalImpl.class);

	private static final String THEIRS = "theirs";
	private static final String OURS = "ours";

	private RemoteRepositoryDAO remoteRepositoryDao;
	private StudioConfiguration studioConfiguration;
	private NotificationService notificationService;
	private UserService userService;
	private TextEncryptor encryptor;
	private GeneralLockService generalLockService;
	private GitRepositoryHelper gitRepositoryHelper;
	private GitContentRepository contentRepository;
	private PublishService publishService;
	private SitesService siteService;
	private AuditService auditService;
	private RetryingRepositoryOperationFacade retryingRepositoryOperationFacade;
	private RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private ApplicationContext applicationContext;

	@Override
	public void addRemote(final String siteId, final RemoteRepository remoteRepository)
		throws ServiceLayerException, InvalidRemoteUrlException {
		doAddRemote(siteId, remoteRepository);
		insertRemoteAuditLog(siteId, OPERATION_ADD_REMOTE, remoteRepository.getRemoteName(),
			remoteRepository.getRemoteName());
	}

	/**
	 * Add a remote repository to the sandbox repository in the site.
	 */
	private void doAddRemote(final String siteId, final RemoteRepository remoteRepository)
		throws InvalidRemoteUrlException, ServiceLayerException {
		boolean isValid = false;
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try {
			logger.debug("Add the remote '{}' to the sandbox repository in site '{}'",
				remoteRepository.getRemoteName(), siteId);
			Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
			try (Git git = new Git(repo)) {

				Config storedConfig = repo.getConfig();
				Set<String> remotes = storedConfig.getSubsections("remote");

				if (remotes.contains(remoteRepository.getRemoteName())) {
					throw new RemoteAlreadyExistsException(remoteRepository.getRemoteName());
				}

				RemoteAddCommand remoteAddCommand = git.remoteAdd();
				remoteAddCommand.setName(remoteRepository.getRemoteName());
				remoteAddCommand.setUri(new URIish(remoteRepository.getRemoteUrl()));
				retryingRepositoryOperationFacade.call(remoteAddCommand);

				try {
					isValid = gitRepositoryHelper.isRemoteValid(git, remoteRepository.getRemoteName(),
						remoteRepository.getAuthenticationType(), remoteRepository.getRemoteUsername(),
						remoteRepository.getRemotePassword(), remoteRepository.getRemoteToken(),
						remoteRepository.getRemotePrivateKey());
				} catch (Exception e) {
					throw new org.craftercms.studio.api.v2.exception.repository.
						InvalidRemoteException("Failed to add the remote '{}' URL '{}' to site '{}' because it is invalid", e);
				} finally {
					if (!isValid) {
						RemoteRemoveCommand remoteRemoveCommand = git.remoteRemove();
						remoteRemoveCommand.setRemoteName(remoteRepository.getRemoteName());
						retryingRepositoryOperationFacade.call(remoteRemoveCommand);

						ListBranchCommand listBranchCommand = git.branchList()
							.setListMode(ListBranchCommand.ListMode.REMOTE);
						List<Ref> resultRemoteBranches = retryingRepositoryOperationFacade.call(listBranchCommand);

						List<String> branchesToDelete = new ArrayList<>();
						for (Ref remoteBranchRef : resultRemoteBranches) {
							if (remoteBranchRef.getName().startsWith(Constants.R_REMOTES +
								remoteRepository.getRemoteName())) {
								branchesToDelete.add(remoteBranchRef.getName());
							}
						}
						if (isNotEmpty(branchesToDelete)) {
							DeleteBranchCommand delBranch = git.branchDelete();
							String[] array = new String[branchesToDelete.size()];
							delBranch.setBranchNames(branchesToDelete.toArray(array));
							delBranch.setForce(true);
							retryingRepositoryOperationFacade.call(delBranch);
						}
					}
				}
			} catch (URISyntaxException e) {
				logger.error("Failed to add the remote '{}' URL '{}' to site '{}' because the URL is invalid",
					remoteRepository.getRemoteName(), remoteRepository.getRemoteUrl(), siteId, e);
				throw new InvalidRemoteUrlException(e);
			} catch (GitAPIException e) {
				if (e.getCause() instanceof NoRemoteRepositoryException) {
					logger.error("Failed to add the remote '{}' URL '{}' to site '{}' because the remote repository " +
							"was not found",
						remoteRepository.getRemoteName(), remoteRepository.getRemoteUrl(), siteId, e);
					throw new RemoteRepositoryNotFoundException(format("Failed to add the remote '%s' URL '%s'" +
							" to site '%s' because the remote repository was not found",
						remoteRepository.getRemoteName(), remoteRepository.getRemoteUrl(), siteId), e);
				}
				logger.error("Failed to add the remote '{}' URL '{}' to site '{}'",
					remoteRepository.getRemoteName(), remoteRepository.getRemoteUrl(), siteId, e);
				throw new ServiceLayerException(format("Failed to add the remote '%s' URL '%s'" +
						" to site '%s'",
					remoteRepository.getRemoteName(), remoteRepository.getRemoteUrl(), siteId), e);
			}

			if (isValid) {
				insertRemoteToDb(siteId, remoteRepository);
			}
		} catch (CryptoException | RemoteRepositoryNotFoundException e) {
			throw new ServiceLayerException(e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	private void insertRemoteToDb(String siteId, RemoteRepository remoteRepository) throws CryptoException {
		// TODO: SJ: Avoid using string literals
		logger.debug("Insert the remote repository '{}' from site '{}' into the database",
			remoteRepository.getRemoteName(), siteId);
		if (isNotEmpty(remoteRepository.getRemotePassword())) {
			logger.trace("Encrypt the password before inserting into the database for site '{}'", siteId);
			String hashedPassword = encryptor.encrypt(remoteRepository.getRemotePassword());
			remoteRepository.setRemotePassword(hashedPassword);
		}
		if (isNotEmpty(remoteRepository.getRemoteToken())) {
			logger.trace("Encrypt the token before inserting into the database for site '{}'", siteId);
			String hashedToken = encryptor.encrypt(remoteRepository.getRemoteToken());
			remoteRepository.setRemoteToken(hashedToken);
		}
		if (isNotEmpty(remoteRepository.getRemotePrivateKey())) {
			logger.trace("Encrypt the private key before inserting into the database for site '{}'", siteId);
			String hashedPrivateKey = encryptor.encrypt(remoteRepository.getRemotePrivateKey());
			remoteRepository.setRemotePrivateKey(hashedPrivateKey);
		}

		logger.debug("Insert the site remote record into database for site '{}'", siteId);
		retryingDatabaseOperationFacade.retry(() -> remoteRepositoryDao.insertRemoteRepository(siteId, remoteRepository));
	}

	@Override
	public MergeResult pullFromRemote(@SiteId String siteId, String remoteName,
									  String remoteBranch, String mergeStrategy) throws ServiceLayerException,
			InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException, InvalidRemoteUrlException {
		MergeResult mergeResult = doPullFromRemote(siteId, remoteName, remoteBranch,
			mergeStrategy);
		insertRemoteAuditLog(siteId, OPERATION_PULL_FROM_REMOTE, remoteName + "/" + remoteBranch,
			remoteName + "/" + remoteBranch);

		if (!mergeResult.isSuccessful()) {
			throw new PullFromRemoteConflictException("Pull from remote result is merge conflict.");
		}
		return mergeResult;
	}

	@Override
	public List<RemoteRepositoryInfo> listRemotes(String siteId) throws SiteNotFoundException, RepositoryException {
		Site site = siteService.getSite(siteId);
		String sandboxBranch = site.getSandboxBranch();
		List<RemoteRepositoryInfo> res = new ArrayList<>();
		Map<String, String> unreachableRemotes = new HashMap<>();
		try (Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX)) {
			try (Git git = new Git(repo)) {
				RemoteListCommand remoteListCommand = git.remoteList();
				List<RemoteConfig> resultRemotes = retryingRepositoryOperationFacade.call(remoteListCommand);
				if (isNotEmpty(resultRemotes)) {
					for (RemoteConfig conf : resultRemotes) {
						try {
							fetchRemote(siteId, git, conf);
						} catch (Exception e) {
							logger.warn("Failed to fetch from the remote repository '{}' in site '{}'",
								conf.getName(), siteId, e);
							unreachableRemotes.put(conf.getName(), e.getMessage());
						}
					}
					Map<String, List<String>> remoteBranches = getRemoteBranches(git);
					String sandboxBranchName = sandboxBranch;
					if (StringUtils.isEmpty(sandboxBranchName)) {
						sandboxBranchName = studioConfiguration.getProperty(REPO_SANDBOX_BRANCH);
					}
					res = getRemoteRepositoryInfo(resultRemotes, remoteBranches, unreachableRemotes, sandboxBranchName);
				}
			} catch (GitAPIException e) {
				logger.error("Failed to get the remote repositories for site '{}'", siteId, e);
			}
		}
		return res;
	}

	private void fetchRemote(String siteId, Git git, RemoteConfig conf)
		throws CryptoException, IOException, ServiceLayerException, GitAPIException {
		RemoteRepository remoteRepository = getRemoteRepository(siteId, conf.getName());
		if (remoteRepository != null) {
			Path tempKey = Files.createTempFile(getStudioTemporaryFilesRoot(), UUID.randomUUID().toString(), TMP_FILE_SUFFIX);
			FetchCommand fetchCommand = git.fetch().setRemote(conf.getName());
			gitRepositoryHelper.setAuthenticationForCommand(fetchCommand,
				remoteRepository.getAuthenticationType(), remoteRepository.getRemoteUsername(),
				remoteRepository.getRemotePassword(), remoteRepository.getRemoteToken(),
				remoteRepository.getRemotePrivateKey(), tempKey, true);
			retryingRepositoryOperationFacade.call(fetchCommand);
		}
	}

	private RemoteRepository getRemoteRepository(String siteId, String remoteName) {
		Map<String, String> params = new HashMap<>();
		params.put("siteId", siteId);
		params.put("remoteName", remoteName);
		return remoteRepositoryDao.getRemoteRepository(params);
	}

	private Map<String, List<String>> getRemoteBranches(Git git) throws GitAPIException {
		ListBranchCommand listBranchCommand = git.branchList()
			.setListMode(ListBranchCommand.ListMode.REMOTE);
		List<Ref> resultRemoteBranches = retryingRepositoryOperationFacade.call(listBranchCommand);
		Map<String, List<String>> remoteBranches = new HashMap<>();
		for (Ref remoteBranchRef : resultRemoteBranches) {
			String branchFullName = remoteBranchRef.getName().replace(Constants.R_REMOTES, "");
			String remotePart = StringUtils.EMPTY;
			String branchNamePart = StringUtils.EMPTY;
			int slashIndex = branchFullName.indexOf("/");
			if (slashIndex > 0) {
				remotePart = branchFullName.substring(0, slashIndex);
				branchNamePart = branchFullName.substring(slashIndex + 1);
			}

			if (!remoteBranches.containsKey(remotePart)) {
				remoteBranches.put(remotePart, new ArrayList<>());
			}
			remoteBranches.get(remotePart).add(branchNamePart);
		}
		return remoteBranches;
	}

	private List<RemoteRepositoryInfo> getRemoteRepositoryInfo(List<RemoteConfig> resultRemotes,
								   Map<String, List<String>> remoteBranches,
								   Map<String, String> unreachableRemotes,
								   String sandboxBranchName) {
		List<RemoteRepositoryInfo> res = new ArrayList<>();
		for (RemoteConfig conf : resultRemotes) {
			RemoteRepositoryInfo rri = new RemoteRepositoryInfo();
			rri.setName(conf.getName());
			if (MapUtils.isNotEmpty(unreachableRemotes) && unreachableRemotes.containsKey(conf.getName())) {
				rri.setReachable(false);
				rri.setUnreachableReason(unreachableRemotes.get(conf.getName()));
			}
			List<String> branches = remoteBranches.get(rri.getName());
			if (CollectionUtils.isEmpty(branches)) {
				branches = new ArrayList<>();
				branches.add(sandboxBranchName);
			}
			rri.setBranches(branches);

			StringBuilder sbUrl = new StringBuilder();
			if (isNotEmpty(conf.getURIs())) {
				for (int i = 0; i < conf.getURIs().size(); i++) {
					sbUrl.append(conf.getURIs().get(i).toString());
					if (i < conf.getURIs().size() - 1) {
						sbUrl.append(":");
					}
				}
			}
			rri.setUrl(sbUrl.toString());

			StringBuilder sbFetch = new StringBuilder();
			if (isNotEmpty(conf.getFetchRefSpecs())) {
				for (int i = 0; i < conf.getFetchRefSpecs().size(); i++) {
					sbFetch.append(conf.getFetchRefSpecs().get(i).toString());
					if (i < conf.getFetchRefSpecs().size() - 1) {
						sbFetch.append(":");
					}
				}
			}
			rri.setFetch(sbFetch.toString());

			StringBuilder sbPushUrl = new StringBuilder();
			if (isNotEmpty(conf.getPushURIs())) {
				for (int i = 0; i < conf.getPushURIs().size(); i++) {
					sbPushUrl.append(conf.getPushURIs().get(i).toString());
					if (i < conf.getPushURIs().size() - 1) {
						sbPushUrl.append(":");
					}
				}
			} else {
				sbPushUrl.append(rri.getUrl());
			}
			rri.setPushUrl(sbPushUrl.toString());
			res.add(rri);
		}
		return res;
	}

	/**
	 * Get a list of changes that would be merged into the sandbox branch of the repository if the given commit is merged.
	 * <p>
	 * This should be equivalent to <code>git diff ...COMMIT_ID --name-status</code>
	 *
	 * @param git         The git instance
	 * @param newCommitId The commit id that is intended to be merged into HEAD
	 * @return The list of changes that would be merged
	 */
	private List<DiffEntry> getMergeChanges(Git git, ObjectId newCommitId) throws IOException, GitAPIException {
		Repository repo = git.getRepository();
		try (RevWalk walk = new RevWalk(repo)) {
			RevCommit headCommit = walk.parseCommit(repo.resolve(Constants.HEAD));
			RevCommit newCommit = walk.parseCommit(newCommitId);

			walk.setRevFilter(RevFilter.MERGE_BASE);
			walk.markStart(headCommit);
			walk.markStart(newCommit);
			RevCommit mergeBase = walk.next();

			walk.reset();

			RevTree newCommitTree = walk.parseTree(newCommit.getTree().getId());
			CanonicalTreeParser newCommitTreeParser = new CanonicalTreeParser();
			try (ObjectReader reader = repo.newObjectReader()) {
				newCommitTreeParser.reset(reader, newCommitTree.getId());
			}

			RevTree mergeBaseTree = walk.parseTree(mergeBase.getTree().getId());
			CanonicalTreeParser mergeBaseTreeParser = new CanonicalTreeParser();
			try (ObjectReader reader = repo.newObjectReader()) {
				mergeBaseTreeParser.reset(reader, mergeBaseTree.getId());
			}

			DiffCommand diffCommand = git.diff()
				.setOldTree(mergeBaseTreeParser)
				.setNewTree(newCommitTreeParser);
			List<DiffEntry> diffEntries = retryingRepositoryOperationFacade.call(diffCommand);

			walk.dispose();
			return diffEntries;
		}
	}

	/**
	 * Asserts that the changes in the fetched commit are not part of any active publish package,
	 * otherwise throws a {@link ContentInPublishQueueException}.
	 *
	 * @param siteId      The site id
	 * @param git         The git instance
	 * @param newCommitId The commit id that is intended to be merged into HEAD
	 * @throws IOException                    if an error occurs while trying to calculate the changes
	 * @throws GitAPIException                if an error occurs while trying to calculate the changes
	 * @throws ContentInPublishQueueException if the changes contains paths included in active (SUBMITTED or APPROVED ready packages) publish packages
	 */
	private void assertChangesNotInPublishQueue(final String siteId, final Git git, final ObjectId newCommitId) throws IOException, GitAPIException, ServiceLayerException {
		logger.debug("Checking if the fetched changes are in the publish queue");
		List<DiffEntry> diffEntries = getMergeChanges(git, newCommitId);
		List<String> removedPaths = new LinkedList<>();
		List<String> updatedPaths = new LinkedList<>();
		for (DiffEntry diffEntry : diffEntries) {
			switch (diffEntry.getChangeType()) {
				case DELETE:
					removedPaths.add(FILE_SEPARATOR + gitRepositoryHelper.getGitPath(diffEntry.getOldPath()));
					break;
				case RENAME:
					removedPaths.add(FILE_SEPARATOR + diffEntry.getOldPath());
					updatedPaths.add(FILE_SEPARATOR + diffEntry.getNewPath());
					break;
				default:
					updatedPaths.add(FILE_SEPARATOR + diffEntry.getNewPath());
					break;
			}
		}
		Map<Long, PublishPackage> publishPackages = new HashMap<>();
		if (isNotEmpty(removedPaths)) {
			// Removed paths would affect children as well
			publishService.getActivePackagesForItems(siteId, removedPaths, true)
				.forEach(p -> publishPackages.put(p.getId(), p));
		}
		if (isNotEmpty(updatedPaths)) {
			publishService.getActivePackagesForItems(siteId, updatedPaths, false)
				.forEach(p -> publishPackages.put(p.getId(), p));
		}
		if (MapUtils.isNotEmpty(publishPackages)) {
			throw new ContentInPublishQueueException("Unable to pull changes from remote. Affected items are part of a publish package.",
				publishPackages.values());
		}
	}

	/**
	 * Merge the changes from a commit into the HEAD of the sandbox repository.
	 *
	 * @param siteId        The site id
	 * @param git           The git instance
	 * @param commitId      The commit id to try to merge
	 * @param mergeStrategy The merge strategy to use
	 * @return The result of the merge operation
	 */
	private MergeResult merge(final String siteId, final Git git, final ObjectId commitId, String mergeStrategy)
		throws GitAPIException, IOException {
		logger.debug("Merging the changes from commit '{}' in site '{}'", commitId.getName(), siteId);
		MergeCommand mergeCommand = git.merge()
			.include(commitId);
		logger.debug("Set the merge strategy in merge command to '{}'", mergeStrategy);
		switch (mergeStrategy) {
			case THEIRS -> mergeCommand.setStrategy(MergeStrategy.THEIRS);
			case OURS -> mergeCommand.setStrategy(MergeStrategy.OURS);
			default -> {
			}
		}
		mergeCommand.setFastForward(MergeCommand.FastForwardMode.NO_FF);
		org.eclipse.jgit.api.MergeResult mergeResult = retryingRepositoryOperationFacade.call(mergeCommand);

		if (mergeResult.getMergeStatus().isSuccessful()) {
			applicationContext.publishEvent(new SyncFromRepoEvent(siteId));
			List<String> newMergedCommits = extractCommitIdsFromPullResult(git.getRepository(), mergeResult);
			logger.debug("Commits pulled for site '{}': {}", siteId, newMergedCommits);
			return MergeResult.from(mergeResult, newMergedCommits);
		}
		if (conflictNotificationEnabled()) {
			List<String> conflictFiles = new LinkedList<>(mergeResult.getConflicts().keySet());
			notificationService.notifyRepositoryMergeConflict(siteId, conflictFiles);
		}
		return MergeResult.failed();
	}

	/**
	 * Fetch a branch from a remote repository.
	 *
	 * @param siteId           The site id
	 * @param git              The git instance
	 * @param remoteRepository The db-stored remote repository information
	 * @param remoteName       The remote name
	 * @param remoteBranch     The remote branch
	 */
	private void fetchRemoteBranch(final String siteId, final Git git, final RemoteRepository remoteRepository,
				       final String remoteName, final String remoteBranch)
		throws IOException, GitAPIException, CryptoException, ServiceLayerException {
		logger.trace("Fetch '{}' branch from remote '{}' in site '{}'", remoteBranch, remoteName, siteId);
		Path tempKey = null;
		try {
			FetchCommand fetchCommand = git.fetch()
				.setRemote(remoteName)
				.setInitialBranch(remoteBranch);
			tempKey = Files.createTempFile(getStudioTemporaryFilesRoot(), UUID.randomUUID().toString(), TMP_FILE_SUFFIX);
			gitRepositoryHelper.setAuthenticationForCommand(fetchCommand, remoteRepository, tempKey, true);
			FetchResult fetchResult = retryingRepositoryOperationFacade.call(fetchCommand);
			if (isNotEmpty(fetchResult.getMessages())) {
				logger.info("Git fetch from remote '{}' in site '{}' returned: '{}'", remoteName, siteId, fetchResult.getMessages());
			}
		} finally {
			if (tempKey != null) {
				FileUtils.deleteQuietly(tempKey.toFile());
			}
		}
	}

	private MergeResult doPullFromRemote(String siteId, String remoteName, String remoteBranch, String mergeStrategy)
		throws InvalidRemoteUrlException, ServiceLayerException, InvalidRemoteRepositoryCredentialsException,
		RemoteRepositoryNotFoundException {
		logger.debug("Pull from remote. Get the git remote repository information from the database for remote '{}' in site '{}'",
			remoteName, siteId);
		RemoteRepository remoteRepository = getRemoteRepository(siteId, remoteName);
		if (remoteRepository == null) {
			throw new RemoteRepositoryNotFoundException(format("Remote repository '%s' does not exist in site '%s'", remoteName, siteId));
		}
		logger.trace("Prepare the JGit pull command in site '{}'", siteId);
		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		String gitLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(gitLockKey);
		try (Git git = new Git(repo)) {
			fetchRemoteBranch(siteId, git, remoteRepository, remoteName, remoteBranch);
			ObjectId mergeCommitId = repo.resolve(gitRepositoryHelper.getRemoteBranchRefName(remoteName, remoteBranch));
			assertChangesNotInPublishQueue(siteId, git, mergeCommitId);
			logger.debug("Merge the changes from remote '{}' branch '{}' in site '{}'", remoteName, remoteBranch, siteId);
			return merge(siteId, git, mergeCommitId, mergeStrategy);
		} catch (InvalidRemoteException e) {
			logger.error("Failed to pull from the remote '{}' in site '{}' because the remote is invalid",
				remoteName, siteId, e);
			throw new InvalidRemoteUrlException(e);
		} catch (TransportException e) {
			// TODO: SJ: Seems like the actual logging is being done inside the util, not great, need to fix
			GitUtils.translateException(e, logger, remoteName, remoteRepository.getRemoteUrl());
		} catch (GitAPIException e) {
			logger.error("Failed to pull from remote '{}' branch '{}' in site '{}'",
				remoteName, remoteBranch, siteId, e);
			throw new ServiceLayerException(format("Failed to pull from remote '%s' branch '%s' in site '%s'",
				remoteName, remoteBranch, siteId), e);
		} catch (CryptoException | IOException e) {
			throw new ServiceLayerException(e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
		return MergeResult.failed();
	}

	private List<String> extractCommitIdsFromPullResult(Repository repo, org.eclipse.jgit.api.MergeResult mergeResult) {
		List<String> commitIds = new LinkedList<>();
		ObjectId[] mergedCommits = mergeResult.getMergedCommits();
		for (ObjectId mergedCommit : mergedCommits) {
			try {
				RevCommit revCommit = repo.parseCommit(mergedCommit);
				commitIds.add(revCommit.getName());
			} catch (IOException e) {
				logger.error("Failed to parse commit '{}'", mergedCommit.getName(), e);
			}
		}
		return commitIds;
	}

	@Override
	public boolean pushToRemote(@SiteId String siteId, String remoteName,
								String remoteBranch, boolean force)
		throws InvalidRemoteUrlException, ServiceLayerException,
		InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException {
		boolean toRet = doPushToRemote(siteId, remoteName, remoteBranch, force);
		insertRemoteAuditLog(siteId, OPERATION_PUSH_TO_REMOTE, remoteName + "/" + remoteBranch,
			remoteName + "/" + remoteBranch);
		return toRet;
	}

	@Override
	public boolean removeRemote(@SiteId String siteId, String remoteName)
			throws SiteNotFoundException, RemoteNotRemovableException {
		// TODO: make this throw an exception instead of returning a boolean
		try {
			doRemoveRemote(siteId, remoteName);
			return true;
		} catch (ServiceLayerException e) {
			logger.error("Failed to remove remote '{}' from site '{}'", remoteName, siteId, e);
			return false;
		} finally {
			insertRemoteAuditLog(siteId, OPERATION_REMOVE_REMOTE, remoteName, remoteName);
		}
	}

	private boolean doPushToRemote(String siteId, String remoteName, String remoteBranch, boolean force)
		throws ServiceLayerException, InvalidRemoteUrlException, InvalidRemoteRepositoryCredentialsException,
		RemoteRepositoryNotFoundException {
		logger.debug("Push to remote. Get the git remote repository information from the database for remote '{}' in site '{}'",
			remoteName, siteId);
		RemoteRepository remoteRepository = getRemoteRepository(siteId, remoteName);

		logger.trace("Prepare the JGit push command in site '{}'", siteId);
		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		try (Git git = new Git(repo)) {
			Iterable<PushResult> pushResultIterable;
			PushCommand pushCommand = git.push();
			logger.trace("Set the JGit push command remote to '{}' in site '{}'", remoteName, siteId);
			pushCommand.setRemote(remoteRepository.getRemoteName());
			logger.trace("Set the JGit push command branch to '{}' in site '{}'", remoteBranch, siteId);
			RefSpec r = new RefSpec();
			r = r.setSourceDestination(Constants.R_HEADS + repo.getBranch(),
				Constants.R_HEADS + remoteBranch);
			pushCommand.setRefSpecs(r);
			Path tempKey = Files.createTempFile(getStudioTemporaryFilesRoot(), UUID.randomUUID().toString(), TMP_FILE_SUFFIX);
			gitRepositoryHelper.setAuthenticationForCommand(pushCommand, remoteRepository.getAuthenticationType(),
				remoteRepository.getRemoteUsername(), remoteRepository.getRemotePassword(),
				remoteRepository.getRemoteToken(), remoteRepository.getRemotePrivateKey(), tempKey, true);
			pushCommand.setForce(force);
			pushResultIterable = retryingRepositoryOperationFacade.call(pushCommand);
			Files.delete(tempKey);

			boolean toRet = true;
			for (PushResult pushResult : pushResultIterable) {
				String pushResultMessage = pushResult.getMessages();
				if (isNotEmpty(pushResultMessage)) {
					logger.info("Git push in site '{}' returned '{}'", siteId, pushResultMessage);
				}
				Collection<RemoteRefUpdate> updates = pushResult.getRemoteUpdates();
				for (RemoteRefUpdate remoteRefUpdate : updates) {
					switch (remoteRefUpdate.getStatus()) {
						case REJECTED_NODELETE:
							toRet = false;
							logger.error("Failed to push to remote '{}' ref '{}' from site '{}'. Remote side " +
									"doesn't support/allow deleting refs\n'{}'",
								remoteName, remoteRefUpdate.getSrcRef(), siteId, remoteRefUpdate.getMessage());
							break;
						case REJECTED_NONFASTFORWARD:
							toRet = false;
							logger.error("Failed to push to remote '{}' ref '{}' from site '{}'. Push would " +
									"cause a non-fast-forward update\n'{}'",
								remoteName, remoteRefUpdate.getSrcRef(), siteId, remoteRefUpdate.getMessage());
							break;
						case REJECTED_REMOTE_CHANGED:
							toRet = false;
							logger.error("Failed to push to remote '{}' ref '{}' from site '{}'. The remote " +
									"has changed\n'{}'",
								remoteName, remoteRefUpdate.getSrcRef(), siteId, remoteRefUpdate.getMessage());
							break;
						case REJECTED_OTHER_REASON:
							toRet = false;
							logger.error("Failed to push to remote '{}' ref '{}' from site '{}'. Message:\n'{}'",
								remoteName, remoteRefUpdate.getSrcRef(), siteId, remoteRefUpdate.getMessage());
						default:
							break;
					}
				}
			}
			return toRet;
		} catch (InvalidRemoteException e) {
			logger.error("Failed to push to the remote '{}' from site '{}', the remote is invalid. ",
				remoteName, siteId, e);
			throw new InvalidRemoteUrlException();
		} catch (TransportException e) {
			GitUtils.translateException(e, logger, remoteName, remoteRepository.getRemoteUrl());
			return false;
		} catch (IOException | JGitInternalException | GitAPIException | CryptoException e) {
			logger.error("Failed to push to the remote '{}' branch '{}' from site '{}'",
				remoteName, remoteBranch, siteId, e);
			throw new ServiceLayerException(format("Failed to push to the remote '%s' branch '%s' from site '%s'",
				remoteName, remoteBranch, siteId), e);
		}
	}

	private void doRemoveRemote(String siteId, String remoteName) throws RemoteNotRemovableException, ServiceLayerException {
		if (!isRemovableRemote(siteId, remoteName)) {
			throw new RemoteNotRemovableException("Remote repository " + remoteName + " is not removable");
		}
		logger.debug("Remove the remote '{}' from the sandbox repository in site '{}'", remoteName, siteId);

		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try (Git git = new Git(repo)) {
			RemoteRemoveCommand remoteRemoveCommand = git.remoteRemove();
			remoteRemoveCommand.setRemoteName(remoteName);
			retryingRepositoryOperationFacade.call(remoteRemoveCommand);

			ListBranchCommand listBranchCommand = git.branchList().setListMode(ListBranchCommand.ListMode.REMOTE);
			List<Ref> resultRemoteBranches = retryingRepositoryOperationFacade.call(listBranchCommand);

			List<String> branchesToDelete = new ArrayList<>();
			for (Ref remoteBranchRef : resultRemoteBranches) {
				if (remoteBranchRef.getName().startsWith(Constants.R_REMOTES + remoteName)) {
					branchesToDelete.add(remoteBranchRef.getName());
				}
			}
			if (isNotEmpty(branchesToDelete)) {
				DeleteBranchCommand delBranch = git.branchDelete();
				String[] array = new String[branchesToDelete.size()];
				delBranch.setBranchNames(branchesToDelete.toArray(array));
				delBranch.setForce(true);
				retryingRepositoryOperationFacade.call(delBranch);
			}
		} catch (GitAPIException e) {
			throw new ServiceLayerException(format("Failed to remove the remote '%s' from site '%s'", remoteName, siteId), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}

		logger.debug("Remove the database record for remote '{}' from site '{}'", remoteName, siteId);
		Map<String, String> params = new HashMap<>();

		// TODO: SJ: Avoid using string literals
		params.put("siteId", siteId);
		params.put("remoteName", remoteName);
		retryingDatabaseOperationFacade.retry(() -> remoteRepositoryDao.deleteRemoteRepository(params));
	}

	@SuppressWarnings("unused")
	private boolean isRemovableRemote(String siteId, String remoteName) {
		return true;
	}

	@Override
	public RepositoryStatus getRepositoryStatus(String siteId)
		throws ServiceLayerException {
		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		RepositoryStatus repositoryStatus = new RepositoryStatus();
		logger.trace("Execute git status in site '{}' and return any conflicting paths and uncommitted changes",
			siteId);
		try (Git git = new Git(repo)) {
			StatusCommand statusCommand = git.status();
			Status status = retryingRepositoryOperationFacade.call(statusCommand);
			repositoryStatus.setClean(status.isClean());
			repositoryStatus.setConflicting(status.getConflicting());
			repositoryStatus.setUncommittedChanges(status.getUncommittedChanges());
			repositoryStatus.setUntracked(status.getUntracked());
		} catch (GitAPIException e) {
			logger.error("Failed to execute git status in site '{}'", siteId, e);
			throw new ServiceLayerException(format("Failed to execute git status in site '%s'", siteId), e);
		}
		return repositoryStatus;
	}

	@Override
	public RepositoryStatus resolveConflict(String siteId, String path, ConflictResolution resolution)
			throws ServiceLayerException {
		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try (Git git = new Git(repo)) {
			if (repo.resolve(Constants.MERGE_HEAD) == null) {
				throw new NoMergeStateException(format("Repository for site '%s' is not in a merge state. No conflict to resolve", siteId));
			}
			String mergeCommitId = Constants.HEAD;
			if (resolution == ConflictResolution.theirs) {
				List<ObjectId> mergeHeads = repo.readMergeHeads();
				mergeCommitId = mergeHeads.getFirst().getName();
			}
			logger.debug("Resolve conflicts using _{}_ strategy for site '{}' path '{}'", resolution.name(), siteId, path);
			logger.trace("Reset merge conflict in git index in site '{}' strategy '{}'", siteId, resolution.name());

			String gitPath = gitRepositoryHelper.getGitPath(path);
			if (resolutionIsDelete(git, resolution, gitPath)) {
				retryingRepositoryOperationFacade.call(git.rm().addFilepattern(gitPath));
			} else {
				retryingRepositoryOperationFacade.call(git.reset().addPath(gitPath));
				logger.trace("Checkout the content from merge HEAD '{}' in site '{}'", resolution, siteId);
				retryingRepositoryOperationFacade.call(git.checkout().addPath(gitPath).setStartPoint(mergeCommitId));
			}
			if (repo.getRepositoryState() == RepositoryState.MERGING_RESOLVED) {
				logger.debug("Check for any uncommitted changes and make sure the repo is clean in site '{}'.",
						siteId);
				StatusCommand statusCommand = git.status();
				Status status = retryingRepositoryOperationFacade.call(statusCommand);
				if (!status.hasUncommittedChanges()) {
					logger.debug("The repository is clean. Commit to complete the merge in site '{}'.", siteId);
					String userName = getCurrentUsername();
					User user = userService.getUserByIdOrUsername(-1, userName);
					PersonIdent personIdent = gitRepositoryHelper.getAuthorIdent(user);
					CommitCommand commitCommand = git.commit()
							.setAllowEmpty(true)
							.setMessage("Merge resolved. Repo is clean (no changes)")
							.setAuthor(personIdent);
					retryingRepositoryOperationFacade.call(commitCommand);
				}
			}
		} catch (GitAPIException | IOException | UserNotFoundException e) {
			logger.error("Failed to resolve conflicts in site '{}' using the resolution strategy '{}'",
					siteId, resolution, e);
			throw new ServiceLayerException(format("Failed to resolve conflicts in site '%s' using the resolution " +
					"strategy '%s'", siteId, resolution), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
		return getRepositoryStatus(siteId);
	}

	/**
	 * Check if solving a conflict with the resolution strategy would result in a delete operation.
	 * A delete would happen if the resolution strategy is "theirs" and the file was deleted in the remote branch,
	 * or if the resolution strategy is "ours" and the file was deleted in the local branch.
	 *
	 * @param git        the git instance
	 * @param resolution the resolution strategy
	 * @param gitPath    the git path of the conflicted file
	 * @return true if the resolution would result in a delete operation, false otherwise
	 * @throws GitAPIException if an error occurs while checking the git status
	 */
	protected boolean resolutionIsDelete(Git git, ConflictResolution resolution, String gitPath) throws GitAPIException {
		Status status = git.status().call();
		IndexDiff.StageState stageState = status.getConflictingStageState().get(gitPath);

		if (resolution == ConflictResolution.theirs && stageState == IndexDiff.StageState.DELETED_BY_THEM) {
			return true;
		}
		return resolution == ConflictResolution.ours && stageState == DELETED_BY_US;
	}

	@Override
	public DiffConflictedFile getDiffForConflictedFile(String siteId, String path)
			throws ServiceLayerException {
		DiffConflictedFile diffResult = new DiffConflictedFile();
		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		try (Git git = new Git(repo)) {
			List<ObjectId> mergeHeads = repo.readMergeHeads();
			if (isEmpty(mergeHeads)) {
				// No merge head
				throw new NoMergeStateException(format("Repository for site '%s' is not in a merge state. No conflict to diff", siteId));
			}
			String gitPath = gitRepositoryHelper.getGitPath(path);

			Status status = git.status().call();
			Map<String, IndexDiff.StageState> conflictingStageState = status.getConflictingStageState();
			IndexDiff.StageState conflictState = conflictingStageState.get(gitPath);

			logger.debug("Get the local content of the conflicting file from site '{}' path '{}'", siteId, path);
			if (conflictState.equals(DELETED_BY_US)) {
				diffResult.setStudioVersion(null);
			} else {
				try (InputStream localVersionIs = contentRepository.getContentByCommitId(siteId, path, Constants.HEAD)
						.orElseThrow()
						.getInputStream()) {
					diffResult.setStudioVersion(IOUtils.toString(localVersionIs, UTF_8));
				}
			}

			logger.debug("Get the remote content of the conflicting file from site '{}' path '{}'", siteId, path);
			String mergeCommitId = mergeHeads.getFirst().getName();
			if (conflictState.equals(DELETED_BY_THEM)) {
				diffResult.setRemoteVersion(null);
			} else {
				try (InputStream remoteVersionIs = contentRepository.getContentByCommitId(siteId, path, mergeCommitId)
						.orElseThrow()
						.getInputStream()) {
					diffResult.setRemoteVersion(IOUtils.toString(remoteVersionIs, UTF_8));
				}
			}

			logger.debug("Diff the local and remote versions of the conflicting file in site '{}' path '{}'", siteId, path);
			RevTree headTree = gitRepositoryHelper.getTreeForCommit(repo, Constants.HEAD);
			RevTree remoteTree = gitRepositoryHelper.getTreeForCommit(repo, mergeCommitId);

			try (ObjectReader reader = repo.newObjectReader()) {
				CanonicalTreeParser headCommitTreeParser = new CanonicalTreeParser();
				CanonicalTreeParser remoteCommitTreeParser = new CanonicalTreeParser();
				headCommitTreeParser.reset(reader, headTree.getId());
				remoteCommitTreeParser.reset(reader, remoteTree.getId());

				// Diff the two commit Ids
				ByteArrayOutputStream baos = new ByteArrayOutputStream();
				DiffCommand diffCommand = git.diff()
						.setPathFilter(PathFilter.create(gitRepositoryHelper.getGitPath(path)))
						.setOldTree(headCommitTreeParser)
						.setNewTree(remoteCommitTreeParser)
						.setOutputStream(baos);
				retryingRepositoryOperationFacade.call(diffCommand);
				diffResult.setDiff(baos.toString());
			}
		} catch (IOException | GitAPIException e) {
			logger.error("Failed to diff the conflicting file in site '{}' path '{}'", siteId, path, e);
			throw new ServiceLayerException(format("Failed to diff the conflicting file in site '%s' path '%s'",
					siteId, path), e);
		}
		return diffResult;
	}

	@Override
	public RepositoryStatus commitResolution(String siteId, String commitMessage)
		throws ServiceLayerException {
		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		logger.trace("Commit after resolving the merge conflicts in site '{}'", siteId);
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try (Git git = new Git(repo)) {
			StatusCommand statusCommand = git.status();
			Status status = retryingRepositoryOperationFacade.call(statusCommand);
			if (!status.hasUncommittedChanges()) {
				logger.trace("Git repository is clean. No uncommited files in site '{}'.", siteId);
			} else {
				Set<String> missingFiles = status.getMissing();
				gitRemove(git, siteId, missingFiles);

				Set<String> uncommittedChanges = status.getUncommittedChanges();
				uncommittedChanges.removeAll(missingFiles);
				gitAdd(git, siteId, uncommittedChanges);

				gitCommit(git, siteId, commitMessage);
			}
			return getRepositoryStatus(siteId);
		} catch (GitAPIException | UserNotFoundException | ServiceLayerException e) {
			logger.error("Failed to commit the conflict resolution in site '{}'", siteId, e);
			throw new ServiceLayerException(format("Failed to commit the conflict resolution in site '%s'",
				siteId), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Insert an audit log entry for a remote repository operation
	 */
	private void insertRemoteAuditLog(String siteId, String operation, String primaryTargetId,
										 String primaryTargetValue) throws SiteNotFoundException {
		Site site = siteService.getSite(siteId);
		String user = SecurityUtils.getCurrentUsername();
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(operation);
		auditLog.setSiteId(site.getId());
		auditLog.setActorId(user);
		auditLog.setPrimaryTargetId(primaryTargetId);
		auditLog.setPrimaryTargetType(TARGET_TYPE_REMOTE_REPOSITORY);
		auditLog.setPrimaryTargetValue(primaryTargetValue);
		auditService.insertAuditLog(auditLog);
	}

	/**
	 * Git operation to remove all missing files
	 *
	 * @param git    the git client
	 * @param siteId the site identifier
	 * @param files  set of files to remove
	 * @throws GitAPIException if the operation fails while calling the remove command
	 */
	protected void gitRemove(Git git, String siteId, Set<String> files) throws GitAPIException {
		if (isEmpty(files)) {
			return;
		}

		logger.trace("Remove all missing files in site '{}'", siteId);
		RmCommand rmCommand = git.rm();
		for (String missingFile : files) {
			rmCommand.addFilepattern(missingFile);
		}
		retryingRepositoryOperationFacade.call(rmCommand);
	}

	/**
	 * Git operation to add all modified files
	 *
	 * @param git    the git client
	 * @param siteId the site identifier
	 * @param files  set of files to add
	 * @throws GitAPIException if the operation fails while calling the add command
	 */
	protected void gitAdd(Git git, String siteId, Set<String> files) throws GitAPIException {
		if (isEmpty(files)) {
			return;
		}

		logger.trace("Add all uncommitted files in site '{}'", siteId);
		AddCommand addCommand = git.add();
		for (String file : files) {
			addCommand.addFilepattern(file);
		}
		retryingRepositoryOperationFacade.call(addCommand);
	}

	/**
	 * Git operation to commit all pending changes
	 *
	 * @param git           the git client
	 * @param siteId        the site identifier
	 * @param commitMessage commit message
	 * @throws UserNotFoundException if the current user is not found
	 * @throws ServiceLayerException if an error occurs while trying to retrieve the current user
	 * @throws GitAPIException       if the operation fails while calling the commit command
	 */
	protected void gitCommit(Git git, String siteId, String commitMessage) throws UserNotFoundException, ServiceLayerException, GitAPIException {
		logger.trace("Commit the changes in site '{}'", siteId);
		CommitCommand commitCommand = git.commit();
		String userName = getCurrentUsername();
		User user = userService.getUserByIdOrUsername(-1, userName);
		PersonIdent personIdent = gitRepositoryHelper.getAuthorIdent(user);
		String prologue = studioConfiguration.getProperty(REPO_COMMIT_MESSAGE_PROLOGUE);
		String postscript = studioConfiguration.getProperty(REPO_COMMIT_MESSAGE_POSTSCRIPT);

		StringBuilder sbMessage = new StringBuilder();
		if (isNotEmpty(prologue)) {
			sbMessage.append(prologue).append("\n\n");
		}
		sbMessage.append(commitMessage);
		if (isNotEmpty(postscript)) {
			sbMessage.append("\n\n").append(postscript);
		}
		commitCommand.setCommitter(personIdent).setAuthor(personIdent).setMessage(sbMessage.toString());
		retryingRepositoryOperationFacade.call(commitCommand);
	}

	@Override
	public RepositoryStatus cancelFailedPull(String siteId) throws ServiceLayerException {
		logger.debug("Cancel the failed pull operation by performing a 'reset --hard' in site '{}'", siteId);
		Repository repo = gitRepositoryHelper.getRepository(siteId, SANDBOX);
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try (Git git = new Git(repo)) {
			ResetCommand resetCommand = git.reset().setMode(ResetCommand.ResetType.HARD);
			retryingRepositoryOperationFacade.call(resetCommand);
		} catch (GitAPIException e) {
			logger.error("Failed to cancel the pull operation in site '{}'", siteId, e);
			throw new ServiceLayerException(format("Failed to cancel the pull operation in site '%s'", siteId), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
		return getRepositoryStatus(siteId);
	}

	@Override
	public void unlockRepository(String siteId, GitRepositories repositoryType) throws ServiceLayerException {
		Repository repo = gitRepositoryHelper.getRepository(siteId, repositoryType);
		if (!Objects.nonNull(repo)) {
			throw new RepositoryNotFoundException(siteId, repositoryType);
		}
		File lockFile = Paths.get(repo.getDirectory().getAbsolutePath(), LOCK_FILE).toFile();
		if (!lockFile.exists()) {
			logger.debug("Lock file does not exist, nothing to unlock for site '{}' repository type '{}'", siteId, repositoryType);
			return;
		}
		logger.debug("Unlocking repository for site '{}' repository type '{}'", siteId, repositoryType);
		if (!FileUtils.deleteQuietly(lockFile) && lockFile.exists()) {
			throw new ServiceLayerException("Failed to delete lock file: " + lockFile);
		}
	}

	@Override
	public boolean isCorrupted(String siteId, GitRepositories repositoryType) throws ServiceLayerException {
		Repository repository = gitRepositoryHelper.getRepository(siteId, repositoryType);
		if (repository == null) {
			throw new SiteNotFoundException();
		}
		try (Git git = Git.wrap(repository)) {
			git.status().call();
		} catch (JGitInternalException e) {
			Throwable cause = e.getCause();
			if (cause instanceof CorruptObjectException || cause instanceof EOFException) {
				return true;
			}
		} catch (Exception e) {
			throw new ServiceLayerException("Unknown error checking repository", e);
		}
		return false;
	}

	@Override
	public void repairCorrupted(String siteId, GitRepositories repositoryType) throws ServiceLayerException {
		Repository repository = gitRepositoryHelper.getRepository(siteId, repositoryType);
		if (repository == null) {
			throw new SiteNotFoundException();
		}
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try (Git git = Git.wrap(repository)) {
			FileUtils.forceDelete(repository.getIndexFile());
			ResetCommand resetCommand = git.reset().setMode(ResetCommand.ResetType.HARD);
			retryingRepositoryOperationFacade.call(resetCommand);
		} catch (Exception e) {
			throw new ServiceLayerException("Error repairing corrupted repository for site " + siteId, e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	private boolean conflictNotificationEnabled() {
		return Boolean.parseBoolean(
			studioConfiguration.getProperty(REPO_PULL_FROM_REMOTE_CONFLICT_NOTIFICATION_ENABLED));
	}

	@SuppressWarnings("unused")
	public void setRemoteRepositoryDao(RemoteRepositoryDAO remoteRepositoryDao) {
		this.remoteRepositoryDao = remoteRepositoryDao;
	}

	public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	@SuppressWarnings("unused")
	public void setNotificationService(NotificationService notificationService) {
		this.notificationService = notificationService;
	}

	public void setUserService(UserService userService) {
		this.userService = userService;
	}

	@SuppressWarnings("unused")
	public void setEncryptor(TextEncryptor encryptor) {
		this.encryptor = encryptor;
	}

	public void setGeneralLockService(GeneralLockService generalLockService) {
		this.generalLockService = generalLockService;
	}

	@SuppressWarnings("unused")
	public void setGitRepositoryHelper(GitRepositoryHelper gitRepositoryHelper) {
		this.gitRepositoryHelper = gitRepositoryHelper;
	}

	@SuppressWarnings("unused")
	public void setContentRepository(GitContentRepository contentRepository) {
		this.contentRepository = contentRepository;
	}

	@SuppressWarnings("unused")
	public void setPublishService(final PublishService publishService) {
		this.publishService = publishService;
	}
	@SuppressWarnings("unused")
	public void setSiteService(SitesService siteService) {
		this.siteService = siteService;
	}

	@SuppressWarnings("unused")
	public void setAuditService(AuditService auditService) {
		this.auditService = auditService;
	}

	public void setRetryingRepositoryOperationFacade(RetryingRepositoryOperationFacade retryingRepositoryOperationFacade) {
		this.retryingRepositoryOperationFacade = retryingRepositoryOperationFacade;
	}

	public void setRetryingDatabaseOperationFacade(RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}

	@Override
	public void setApplicationContext(@NonNull ApplicationContext applicationContext) throws BeansException {
		this.applicationContext = applicationContext;
	}
}
