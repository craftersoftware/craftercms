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

package org.craftercms.studio.impl.v2.repository;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import static java.lang.String.format;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import static java.time.ZoneOffset.UTC;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import static java.util.Collections.emptyList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.SequencedCollection;
import java.util.Set;
import java.util.function.Function;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;
import java.util.stream.Stream;

import org.apache.commons.collections4.CollectionUtils;
import static org.apache.commons.collections4.CollectionUtils.isEmpty;
import static org.apache.commons.collections4.CollectionUtils.subtract;
import org.apache.commons.io.FileUtils;
import static org.apache.commons.lang.StringUtils.defaultIfEmpty;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import static org.apache.commons.lang3.StringUtils.EMPTY;
import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.apache.commons.lang3.Strings.CS;
import org.craftercms.commons.crypto.CryptoException;
import org.craftercms.commons.crypto.TextEncryptor;
import org.craftercms.commons.git.utils.AuthenticationType;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.service.Item;
import org.craftercms.studio.api.v1.constant.GitRepositories;
import static org.craftercms.studio.api.v1.constant.GitRepositories.GLOBAL;
import static org.craftercms.studio.api.v1.constant.GitRepositories.PUBLISHED;
import static org.craftercms.studio.api.v1.constant.GitRepositories.SANDBOX;
import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import static org.craftercms.studio.api.v1.constant.StudioConstants.GLOBAL_REPOSITORY_GIT_LOCK;
import static org.craftercms.studio.api.v1.constant.StudioConstants.INDEX_FILE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.PATTERN_FROM_PATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.PATTERN_PATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.PATTERN_SITE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.PATTERN_TO_PATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.REPO_COMMIT_MESSAGE_PATH_VAR;
import static org.craftercms.studio.api.v1.constant.StudioConstants.REPO_COMMIT_MESSAGE_USERNAME_VAR;
import static org.craftercms.studio.api.v1.constant.StudioConstants.REPO_COMMIT_MESSAGE_USER_COMMENT_VAR;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.core.ContextManager;
import org.craftercms.studio.api.v2.dal.ProcessedCommitsDAO;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.publish.PublishItem.Action;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.ADD;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.DELETE;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepository;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepositoryDAO;
import org.craftercms.studio.api.v2.dal.repository.RepoOperation;
import static org.craftercms.studio.api.v2.dal.repository.RepoOperation.Action.COPY;
import static org.craftercms.studio.api.v2.dal.repository.RepoOperation.Action.CREATE;
import static org.craftercms.studio.api.v2.dal.repository.RepoOperation.Action.MOVE;
import static org.craftercms.studio.api.v2.dal.repository.RepoOperation.Action.UPDATE;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.PublishedRepositoryNotFoundException;
import org.craftercms.studio.api.v2.exception.git.NoChangesForPathException;
import org.craftercms.studio.api.v2.exception.publish.PublishException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.repository.ContentWriteItem;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.repository.GitPublishCapableRepository;
import org.craftercms.studio.api.v2.repository.PublishItemTO;
import org.craftercms.studio.api.v2.repository.RepositoryItem;
import org.craftercms.studio.api.v2.repository.RetryingRepositoryOperationFacade;
import org.craftercms.studio.api.v2.repository.publish.GitPublishChangeSet;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.task.TaskManager;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_COPY_CONTENT_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_CREATE_EMPTY_FILE_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_CREATE_FOLDER_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_DELETE_CONTENT_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_INITIAL_COMMIT_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_INITIAL_PUBLISH_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_MOVE_CONTENT_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_PUBLISHED_COMMIT_MESSAGE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_SANDBOX_WRITE_COMMIT_MESSAGE;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.EMPTY_FILE;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.GIT_REPO_USER_USERNAME;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.IGNORE_FILES;
import org.craftercms.studio.impl.v2.utils.DateUtils;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.history.ItemVersion;
import org.craftercms.studio.model.history.RepositoryVersion;
import org.craftercms.studio.model.task.PublishTask.PublishTaskId;
import org.eclipse.jgit.api.CreateBranchCommand;
import org.eclipse.jgit.api.DeleteBranchCommand;
import org.eclipse.jgit.api.DiffCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ListBranchCommand;
import org.eclipse.jgit.api.LogCommand;
import org.eclipse.jgit.api.RemoteRemoveCommand;
import org.eclipse.jgit.api.RmCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.diff.DiffConfig;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.errors.IncorrectObjectTypeException;
import org.eclipse.jgit.errors.StopWalkException;
import org.eclipse.jgit.internal.storage.file.LockFile;
import org.eclipse.jgit.lib.Constants;
import static org.eclipse.jgit.lib.Constants.HEAD;
import static org.eclipse.jgit.lib.Constants.OBJ_BLOB;
import static org.eclipse.jgit.lib.Constants.OBJ_TREE;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectLoader;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.lib.RefUpdate;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.FollowFilter;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevSort;
import static org.eclipse.jgit.revwalk.RevSort.REVERSE;
import static org.eclipse.jgit.revwalk.RevSort.TOPO;
import static org.eclipse.jgit.revwalk.RevSort.TOPO_KEEP_BRANCH_TOGETHER;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.revwalk.filter.RevFilter;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.eclipse.jgit.treewalk.TreeWalk;
import org.eclipse.jgit.treewalk.filter.PathFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.util.function.ThrowingConsumer;

/**
 * Implementation of the GitContentRepositoryImpl interface.
 */
public class GitContentRepositoryImpl implements GitContentRepository, GitPublishCapableRepository {

	private static final Logger logger = LoggerFactory.getLogger(GitContentRepositoryImpl.class);

	private GitRepositoryHelper helper;
	private StudioConfiguration studioConfiguration;
	private UserService userService;
	private RemoteRepositoryDAO remoteRepositoryDAO;
	private SiteDAO siteDao;
	private ProcessedCommitsDAO processedCommitsDao;
	private TextEncryptor encryptor;
	private ContextManager contextManager;
	private ContentStoreService contentStoreService;
	private GeneralLockService generalLockService;
	private RetryingRepositoryOperationFacade retryingRepositoryOperationFacade;
	private RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;

	private ServicesConfig servicesConfig;

	private TaskManager taskManager;

	@Override
	public List<String> getSubtreeItems(String site, String path, GitRepositories repoType, String branch) throws RepositoryException {
		final List<String> retItems = new ArrayList<>();
		String rootPath;
		if (path.endsWith(FILE_SEPARATOR + INDEX_FILE)) {
			int lastIdx = path.lastIndexOf(FILE_SEPARATOR + INDEX_FILE);
			rootPath = path.substring(0, lastIdx);
		} else {
			rootPath = path;
		}
		try {
			Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : repoType);

			RevTree tree = helper.getTreeForCommit(repo, branch);
			try (TreeWalk tw = TreeWalk.forPath(repo, helper.getGitPath(rootPath), tree)) {

				if (tw != null) {
					// Loop for all children and gather path of item excluding the item, file/folder name, and
					// whether it's a folder
					ObjectLoader loader = repo.open(tw.getObjectId(0));
					if (loader.getType() == OBJ_TREE) {
						tw.enterSubtree();
						tw.setRecursive(true);
						while (tw.next()) {
							String name = tw.getNameString();
							String childPath = FILE_SEPARATOR + tw.getPathString();

							if (!ArrayUtils.contains(IGNORE_FILES, name) && !childPath.equals(path)) {
								retItems.add(childPath);
							}

						}
					} else {
						logger.debug("Item at site '{}' path '{}' does not have children", site, path);
					}
				} else {
					String gitPath = helper.getGitPath(rootPath);
					if (isEmpty(gitPath) || gitPath.equals(".")) {
						try (TreeWalk treeWalk = new TreeWalk(repo)) {
							treeWalk.addTree(tree);
							treeWalk.setRecursive(true);
							while (treeWalk.next()) {
								String name = treeWalk.getNameString();
								String childPath = FILE_SEPARATOR + treeWalk.getPathString();

								if (!ArrayUtils.contains(IGNORE_FILES, name) && !childPath.equals(path)) {
									retItems.add(childPath);
								}
							}

						}
					}
				}
			}
		} catch (IOException e) {
			logger.error("Failed to get children at site '{}' path '{}'", site, path, e);
		}
		return retItems;
	}

	/**
	 * Diff two repository trees and return a list of RepoOperations.
	 * toTree is required, fromTree is optional. If fromTree is null, the diff will be calculated
	 * from an empty tree.
	 */
	private List<RepoOperation> diffTrees(final Repository repo, final RevTree fromTree, RevTree toTree, ObjectId toCommitId)
		throws IOException, GitAPIException {
		long startDiffMark = logger.isDebugEnabled() ?
			System.currentTimeMillis() : 0;
		List<RepoOperation> result;
		try (Git git = new Git(repo)) {
			try (ObjectReader reader = repo.newObjectReader()) {
				CanonicalTreeParser toCommitTreeParser = new CanonicalTreeParser();
				toCommitTreeParser.reset(reader, toTree.getId());
				CanonicalTreeParser fromCommitTreeParser = new CanonicalTreeParser();
				if (fromTree != null) {
					fromCommitTreeParser.reset(reader, fromTree.getId());
				}

				// Diff the two commit Ids
				DiffCommand diffCommand = git.diff()
					.setOldTree(fromCommitTreeParser)
					.setNewTree(toCommitTreeParser);
				List<DiffEntry> diffEntries = retryingRepositoryOperationFacade.call(diffCommand);

				if (logger.isDebugEnabled()) {
					logger.debug("Git diff from '{}' to '{}' finished in '{}' seconds",
						fromTree.getName(),
						toTree.getName(),
						((System.currentTimeMillis() - startDiffMark) / 1000));
					logger.debug("Number of diff entries '{}'", diffEntries.size());
				}

				// Now that we have a diff, let's itemize the file changes, pack them into a TO
				// and add them to the list of RepoOperations to return to the caller
				// also include date/time of commit by taking number of seconds and multiply by 1000 and
				// convert to java date before sending over
				result = processDiffEntry(git, diffEntries, toCommitId);
			}
		}
		if (logger.isDebugEnabled()) {
			logger.debug("Git diff from '{}' to '{}' finished in '{}' seconds",
				fromTree.getName(),
				toTree.getName(),
				((System.currentTimeMillis() - startDiffMark) / 1000));
			logger.debug("Number of diff entries '{}'", result.size());
		}
		return result;
	}

	@Override
	public List<RepoOperation> getOperationsFromDelta(String site, String commitIdFrom, String commitIdTo) throws ServiceLayerException {
		Repository repository = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
		if (repository == null) {
			return emptyList();
		}
		try {
			// Get the sandbox repo, and then get a reference to the commit ids we are going to compare
			Repository repo = helper.getRepository(site, SANDBOX);
			ObjectId objCommitIdFrom = repo.resolve(commitIdFrom);
			ObjectId objCommitIdTo = repo.resolve(commitIdTo);

			if (Objects.isNull(objCommitIdTo)) {
				throw new ServiceLayerException(format("Failed to get operations in site '%s' from commit ID '%s' to invalid commit ID '%s'", site, commitIdFrom, commitIdTo));
			}
			// If the commitIdFrom is the same as commitIdTo, there is nothing to calculate, otherwise,
			// let's do it
			if (objCommitIdTo.equals(objCommitIdFrom)) {
				return emptyList();
			}

			RevTree toTree = helper.getTreeForCommit(repo, objCommitIdTo.getName());
			if (toTree == null) {
				logger.warn("Failed to retrieve operations between commits. Unable to get tree for commit ID '{}'", objCommitIdTo);
				throw new ServiceLayerException("Failed to retrieve operations between commits. Unable to get tree for commit ID '" + commitIdFrom + "' or '" + commitIdTo + "'");
			}

			RevTree fromTree = null;
			if (objCommitIdFrom != null) {
				fromTree = helper.getTreeForCommit(repo, objCommitIdFrom.getName());
				if (fromTree == null) {
					logger.warn("Failed to retrieve operations between commits. Unable to get tree for commit ID '{}'", commitIdFrom);
					throw new ServiceLayerException("Failed to retrieve operations between commits. Unable to get tree for commit ID '" + commitIdFrom + "' or '" + commitIdTo + "'");
				}
			}
			return diffTrees(repo, fromTree, toTree, objCommitIdTo);
		} catch (IOException | GitAPIException e) {
			logger.error("Failed to get operations in site '{}' from commit ID '{}' to commit ID '{}'",
				site, commitIdFrom, commitIdTo, e);
			throw new ServiceLayerException(format("Failed to get operations in site '%s' from commit ID '%s' to commit ID '%s'", site, commitIdFrom, commitIdTo), e);
		}
	}

	private List<RepoOperation> processDiffEntry(Git git, List<DiffEntry> diffEntries, ObjectId commitId)
		throws GitAPIException, IOException {
		int size = diffEntries.size();
		logger.debug("Process '{}' diff entries", size);
		long startMark = logger.isDebugEnabled() ? System.currentTimeMillis() : 0;
		List<RepoOperation> toReturn = new ArrayList<>();

		for (DiffEntry diffEntry : diffEntries) {
			// Update the paths to have a preceding separator
			String pathNew = FILE_SEPARATOR + diffEntry.getNewPath();
			String pathOld = FILE_SEPARATOR + diffEntry.getOldPath();

			RepoOperation repoOperation = null;
			Iterable<RevCommit> iterable;
			RevCommit revCommit;
			ZonedDateTime commitTime;
			String author;

			try (Repository repo = git.getRepository()) {
				try (RevWalk revWalk = new RevWalk(repo)) {
					revCommit = revWalk.parseCommit(commitId);
				}
			}
			if (revCommit == null) {
				LogCommand logCommand = git.log().setMaxCount(1);
				iterable = retryingRepositoryOperationFacade.call(logCommand);
				revCommit = iterable.iterator().next();
			}
			commitTime = Instant.ofEpochSecond(revCommit.getCommitTime()).atZone(UTC);
			author = revCommit.getAuthorIdent().getName();

			switch (diffEntry.getChangeType()) {
				case ADD:
					repoOperation = new RepoOperation(CREATE, pathNew, commitTime, null,
						revCommit.getId().getName());
					break;
				case MODIFY:
					repoOperation = new RepoOperation(UPDATE, pathNew, commitTime, null,
						revCommit.getId().getName());
					break;
				case DELETE:
					repoOperation = new RepoOperation(RepoOperation.Action.DELETE, pathOld, commitTime, null,
						revCommit.getId().getName());
					break;
				case RENAME:
					repoOperation = new RepoOperation(MOVE, pathOld, commitTime, pathNew, commitId.getName());
					break;
				case COPY:
					repoOperation = new RepoOperation(COPY, pathNew, commitTime, null, commitId.getName());
					break;
				default:
					logger.error("Unknown git operation '{}'", diffEntry.getChangeType());
					break;
			}
			if (repoOperation != null) {
				repoOperation.setAuthor(isEmpty(author) ? "N/A" : author);
				toReturn.add(repoOperation);
			}
		}

		if (logger.isDebugEnabled()) {
			logger.debug("Finished processing '{}' diff entries in '{}' seconds",
				size, ((System.currentTimeMillis() - startMark) / 1000));
		}
		return toReturn;
	}

	@Override
	public void createSiteFromBlueprint(String blueprintLocation, String site, String sandboxBranch,
										  Map<String, String> params, String creator) throws ServiceLayerException {
		String gitLockKey = helper.getSandboxRepoLockKey(site);
		generalLockService.lock(gitLockKey);
		try {
			// create git repository for site content
			helper.createSandboxRepository(site, sandboxBranch);

			// copy files from blueprint
			helper.copyContentFromBlueprint(blueprintLocation, site);

			// update site name variable inside config files
			helper.updateSiteNameConfigVar(site);

			helper.replaceParameters(site, params);

			helper.addGitIgnoreFiles(site);

			// commit everything so it is visible
			helper.performInitialCommit(site, helper.getCommitMessage(REPO_INITIAL_COMMIT_COMMIT_MESSAGE),
					sandboxBranch, creator);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Creates environment branch if it does not exist.
	 * This method will create a branch in the given repository.
	 * The starting point of the new branch will be chosen from the following rules:
	 * <ul>
	 *     <li>If the environment is live, the sandbox branch will be used</li>
	 *     <li>If the environment is not live (staging), the live branch will be used if it exists. Otherwise it will use the sandbox branch</li>
	 * </ul>
	 *
	 * @param site              the site id
	 * @param environment       the publishing target
	 * @param repo              git repo
	 * @param sandboxBranchName sandbox repository branch name
	 * @throws IOException if an I/O error occurs while verifying branch existence
	 */
	private void ensureEnvironmentBranch(String site, String environment, Repository repo, String sandboxBranchName) throws IOException, SiteNotFoundException, RepositoryException {
		if (branchExists(repo, environment)) {
			return;
		}
		String liveEnvironment = servicesConfig.getLiveEnvironment(site);
		boolean liveExists = branchExists(repo, liveEnvironment);
		String baseBranch = liveExists ? liveEnvironment : sandboxBranchName;
		createEnvironmentBranch(site, baseBranch, environment);
	}

	protected void deleteBranches(Git git, String... names) throws GitAPIException {
		DeleteBranchCommand deleteCommand = git.branchDelete()
			.setForce(true)
			.setBranchNames(names);

		retryingRepositoryOperationFacade.call(deleteCommand);
	}

	protected boolean branchExists(Repository repo, String branch) throws IOException {
		return repo.resolve(branch) != null;
	}

	private void deleteParentFolder(Git git, Path parentFolder, boolean wasPage) throws GitAPIException, IOException {
		String parent = parentFolder.toString();
		String folderToDelete = helper.getGitPath(parent);
		Path toDelete = Paths.get(git.getRepository().getDirectory().getParent(), parent);
		if (Files.exists(toDelete)) {
			try (Stream<Path> dirStream = Files.walk(toDelete);
				 Stream<Path> fileStream = Files.walk(toDelete, 1)) {
				List<String> dirs = dirStream.filter(x -> !x.equals(toDelete))
					.filter(Files::isDirectory)
					.map(y -> y.getFileName().toString())
					.collect(toList());
				List<String> files = fileStream.filter(x -> !x.equals(toDelete))
					.filter(Files::isRegularFile)
					.map(y -> y.getFileName().toString())
					.collect(toList());
				if (wasPage ||
					(isEmpty(dirs) &&
						(isEmpty(files) || files.size() < 2 && files.getFirst().equals(EMPTY_FILE)))) {
					if (CollectionUtils.isNotEmpty(dirs)) {
						for (String child : dirs) {
							Path childToDelete = Paths.get(folderToDelete, child);
							deleteParentFolder(git, childToDelete, false);
							RmCommand rmCommand = git.rm()
								.addFilepattern(folderToDelete + FILE_SEPARATOR + child + FILE_SEPARATOR + "*")
								.setCached(false);
							retryingRepositoryOperationFacade.call(rmCommand);
						}
					}
					if (CollectionUtils.isNotEmpty(files)) {
						for (String child : files) {
							RmCommand rmCommand = git.rm()
								.addFilepattern(folderToDelete + FILE_SEPARATOR + child)
								.setCached(false);
							retryingRepositoryOperationFacade.call(rmCommand);
						}
					}
				}
			}
		}
	}

	@Override
	public boolean repositoryExists(String siteId, GitRepositories repoType) {
		boolean exists = false;
		Path repoPath = helper.getRepoGitDir(repoType, siteId);
		if (Files.exists(repoPath)) {
			exists = commitIdExists(siteId, repoType, HEAD);
		}
		return exists;
	}

	@Override
	public boolean commitIdExists(String site, GitRepositories repoType, String commitId) {
		boolean toRet = false;
		try {
			Repository repo = helper.getRepository(site, repoType);
			if (repo != null) {
				ObjectId objCommitId = repo.resolve(commitId);
				if (objCommitId != null) {
					RevCommit revCommit = repo.parseCommit(objCommitId);
					if (revCommit != null) {
						toRet = true;
					}
				}
			}
		} catch (IOException | RepositoryException e) {
			logger.info("Commit ID '{}' doesn't exist in repo '{}' for site '{}'", commitId, repoType, site);
			logger.debug("Error while checking if commit ID '{}' exists in repo '{}' for site '{}'", commitId, repoType, site, e);
		}
		return toRet;
	}

	@Override
	public void createSiteCloneRemote(String siteId, String sandboxBranch, String remoteName, String remoteUrl,
										String remoteBranch, boolean singleBranch, AuthenticationType authenticationType,
										String remoteUsername, String remotePassword, String remoteToken,
										String remotePrivateKey, Map<String, String> params, boolean createAsOrphan,
										String creator)
			throws InvalidRemoteRepositoryException, InvalidRemoteRepositoryCredentialsException,
			RemoteRepositoryNotFoundException, ServiceLayerException {

		// Clone the remote git repository
		logger.debug("Creating site '{}' as a clone of remote repository '{} ({})'", siteId, remoteName, remoteUrl);
		String gitLockKey = helper.getSandboxRepoLockKey(siteId);
		generalLockService.lock(gitLockKey);
		try {
			helper.createSiteCloneRemoteGitRepo(siteId, remoteName, remoteUrl, remoteBranch,
					singleBranch, authenticationType, remoteUsername, remotePassword, remoteToken, remotePrivateKey,
					createAsOrphan, creator);

			try {
				if (createAsOrphan) {
					removeRemote(siteId, remoteName);
				} else {
					insertRemoteToDb(siteId, remoteName, remoteUrl, authenticationType, remoteUsername, remotePassword,
							remoteToken, remotePrivateKey);
				}
			} catch (CryptoException e) {
				throw new ServiceLayerException(e);
			}

			// Update the siteName variable inside the config files
			logger.debug("Update siteName configuration variables for site '{}'", siteId);
			helper.updateSiteNameConfigVar(siteId);

			helper.replaceParameters(siteId, params);

			// Commit everything so it is visible
			logger.debug("Perform initial commit for site '{}'", siteId);
			helper.performInitialCommit(siteId,
					helper.getCommitMessage(REPO_INITIAL_COMMIT_COMMIT_MESSAGE), sandboxBranch, creator);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	@Override
	public boolean removeRemote(String siteId, String remoteName) throws RepositoryException {
		logger.debug("Remove remote '{}' from the sandbox repo in the site '{}'", remoteName, siteId);
		Repository repo = helper.getRepository(siteId, SANDBOX);
		try (Git git = new Git(repo)) {
			RemoteRemoveCommand remoteRemoveCommand = git.remoteRemove();
			remoteRemoveCommand.setRemoteName(remoteName);
			retryingRepositoryOperationFacade.call(remoteRemoveCommand);

			ListBranchCommand listBranchCommand = git.branchList()
				.setListMode(ListBranchCommand.ListMode.REMOTE);
			List<Ref> resultRemoteBranches = retryingRepositoryOperationFacade.call(listBranchCommand);

			List<String> branchesToDelete = new ArrayList<>();
			for (Ref remoteBranchRef : resultRemoteBranches) {
				if (remoteBranchRef.getName().startsWith(Constants.R_REMOTES + remoteName)) {
					branchesToDelete.add(remoteBranchRef.getName());
				}
			}
			if (CollectionUtils.isNotEmpty(branchesToDelete)) {
				deleteBranches(git, branchesToDelete.toArray(new String[]{}));
			}

		} catch (GitAPIException e) {
			logger.error("Failed to remove remote '{}' in site '{}'", remoteName, siteId, e);
			return false;
		}

		logger.debug("Remove remote record from the database where the remote is '{}' in site '{}'",
			remoteName, siteId);
		Map<String, String> params = new HashMap<>();
		params.put("siteId", siteId);
		params.put("remoteName", remoteName);
		retryingDatabaseOperationFacade.retry(() -> remoteRepositoryDAO.deleteRemoteRepository(params));

		return true;
	}

	private void insertRemoteToDb(String siteId, String remoteName, String remoteUrl,
								  AuthenticationType authenticationType, String remoteUsername, String remotePassword,
								  String remoteToken, String remotePrivateKey) throws CryptoException {
		logger.debug("Insert git remote '{}' in site '{}' into the database", remoteName, siteId);
		RemoteRepository remote = new RemoteRepository();
		remote.setRemoteName(remoteName);
		remote.setRemoteUrl(remoteUrl);
		remote.setAuthenticationType(authenticationType);
		remote.setRemoteUsername(remoteUsername);

		if (StringUtils.isNotEmpty(remotePassword)) {
			// Encrypt password before inserting to database
			String hashedPassword = encryptor.encrypt(remotePassword);
			remote.setRemotePassword(hashedPassword);
		} else {
			remote.setRemotePassword(remotePassword);
		}
		if (StringUtils.isNotEmpty(remoteToken)) {
			// Encrypt token before inserting to database
			String hashedToken = encryptor.encrypt(remoteToken);
			remote.setRemoteToken(hashedToken);
		} else {
			remote.setRemoteToken(remoteToken);
		}
		if (StringUtils.isNotEmpty(remotePrivateKey)) {
			// Encrypt private key before inserting to database
			String hashedPrivateKey = encryptor.encrypt(remotePrivateKey);
			remote.setRemotePrivateKey(hashedPrivateKey);
		} else {
			remote.setRemotePrivateKey(remotePrivateKey);
		}

		// Insert site remote record into database
		retryingDatabaseOperationFacade.retry(() -> remoteRepositoryDAO.insertRemoteRepository(siteId, remote));
	}

	@Override
	public void checkContentExists(String site, String path) throws ServiceLayerException {
		if (!contentExists(site, path)) {
			throw new ContentNotFoundException(path, site, format("Content does not exist at '%s' for site '%s'", path, site));
		}
	}

	@Override
	public boolean deleteSite(String siteId) {
		// Destroy site context
		contextManager.destroyContext(siteId);
		// Delete git repositories (sandbox and published)
		// The helper will take care of locking the repos
		return helper.deleteSiteGitRepo(siteId);
	}

	@Override
	public boolean shallowContentExists(String site, String path) {
		return Files.exists(helper.buildRepoPath(SANDBOX, site).resolve(helper.getGitPath(path)));
	}

	@Override
	public SequencedCollection<String> validatePublishCommits(final String siteId, final Collection<String> commitIds) throws IOException, ServiceLayerException {
		if (isEmpty(commitIds)) {
			return emptyList();
		}

		String repoLockKey = helper.getSandboxRepoLockKey(siteId);
		Repository repo = helper.getRepository(siteId, SANDBOX);
		generalLockService.lock(repoLockKey);
		String repoLastCommitId = getRepoLastCommitId(siteId);

		List<String> resultCommits = new LinkedList<>();

		try (Git git = Git.wrap(repo); RevWalk revWalk = new RevWalk(git.getRepository())) {
			// git log --first-parent --reverse commitFrom..commitTo
			revWalk.setFirstParent(true);
			revWalk.markStart(revWalk.parseCommit(repo.resolve(repoLastCommitId)));
			revWalk.setRevFilter(new RevFilter() {
				private final List<String> targetCommits = new ArrayList<>(commitIds);

				@Override
				public boolean include(RevWalk walker, RevCommit commit) throws StopWalkException {
					if (targetCommits.isEmpty()) {
						// Stop early if we found them all
						throw StopWalkException.INSTANCE;
					}
					if (targetCommits.contains(commit.getName())) {
						targetCommits.remove(commit.getName());
						return true;
					}

					return false;
				}

				@Override
				public RevFilter clone() {
					return this;
				}
			});
			revWalk.sort(TOPO_KEEP_BRANCH_TOGETHER);
			revWalk.sort(REVERSE, true);

			for (RevCommit revCommit : revWalk) {
				resultCommits.add(revCommit.getName());
			}
			Collection<String> notFoundCommits = subtract(commitIds, resultCommits);
			if (!notFoundCommits.isEmpty()) {
				throw new InvalidParametersException(format("Failed to publish items: Invalid commit ids %s", notFoundCommits));
			}
			return resultCommits;
		} finally {
			generalLockService.unlock(repoLockKey);
		}
	}

	@Override
	public boolean isFolder(final String siteId, final String path) {
		Path p = Paths.get(helper.buildRepoPath(isEmpty(siteId) ? GLOBAL : SANDBOX, siteId)
			.toAbsolutePath().toString(), path);
		File file = p.toFile();
		return file.isDirectory();
	}

	@Override
	public boolean contentExists(String site, String path) {
		boolean toReturn = false;
		try {
			Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
			if (repo != null) {

				RevTree tree = helper.getTreeForLastCommit(repo);
				try (TreeWalk tw = TreeWalk.forPath(repo, helper.getGitPath(path), tree)) {
					// Check if the array of items is not null, and since we have an absolute path to the item,
					// pick the first item in the list
					if (tw != null && tw.getObjectId(0) != null) {
						toReturn = true;
					} else if (tw == null) {
						String gitPath = helper.getGitPath(path);
						if (isEmpty(gitPath) || gitPath.equals(".")) {
							toReturn = true;
						}
					}
				} catch (IOException e) {
					logger.debug("Content not found for site '{}' path '{}'", site, path, e);
				}
			}
		} catch (Exception e) {
			logger.error("Failed to create RevTree for site '{}' path '{}'", site, path, e);
		}
		return toReturn;
	}

	@Override
	public String getRepoLastCommitId(final String site) throws RepositoryException {
		String toReturn = EMPTY;
		String gitLockKey = helper.getSandboxRepoLockKey(site, true);
		generalLockService.lock(gitLockKey);
		try {
			Repository repository = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
			if (repository != null) {
				ObjectId commitId = repository.resolve(HEAD);
				if (commitId != null) {
					toReturn = commitId.getName();
				}
			}
		} catch (IOException e) {
			throw new RepositoryException(format("Failed to get the last commit ID in site '%s'", site), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}

		return toReturn;
	}

	@Override
	public Item getItem(String siteId, String path, boolean flatten) {
		var context = contextManager.getContext(siteId);
		return contentStoreService.getItem(context, null, path, null, flatten);
	}

	@Override
	public boolean isTargetPublished(String siteId, String target) throws IOException, RepositoryException {
		Repository repo = helper.getRepository(siteId, PUBLISHED);
		return branchExists(repo, target);
	}

	@Override
	public String deleteContent(String site, Collection<String> paths,
								Collection<? extends ContentWriteItem> additionalItems,
								Set<String> newFolders)
			throws ServiceLayerException {
		String gitLockKey = helper.getSandboxRepoLockKey(site, true);
		generalLockService.lock(gitLockKey);
		try {
			Repository repo = helper.getRepositoryForWrite(site);
			try (Git git = new Git(repo)) {
				List<String> pathsToCommit = new ArrayList<>(paths.size());
				for (String path : paths) {
					String pathToDelete = helper.getGitPath(path);
					RmCommand rmCommand = git.rm().addFilepattern(pathToDelete).setCached(false);
					retryingRepositoryOperationFacade.call(rmCommand);

					String pathToCommit = pathToDelete;
					boolean isPage = path.endsWith(FILE_SEPARATOR + INDEX_FILE);
					if (isPage) {
						Path parentToDelete = Paths.get(pathToDelete).getParent();
						pathToCommit = parentToDelete.toString();
						deleteParentFolder(git, parentToDelete, true);
					}
					pathsToCommit.add(pathToCommit);
				}

				pathsToCommit.addAll(addContent(site, repo, additionalItems));
				pathsToCommit.addAll(addNewFolders(site, repo, newFolders));

				String commitMsg = helper.getCommitMessage(REPO_DELETE_CONTENT_COMMIT_MESSAGE)
					.replaceAll(PATTERN_PATH, StringUtils.join(paths));
				PersonIdent user = helper.getCurrentUserIdent();

				// TODO: SJ: we need to define messages in a string table of sorts
				String commitId = helper.commitFiles(repo, site, commitMsg, user, pathsToCommit.toArray(new String[0]));
				if (commitId != null) {
					persistCommit(site, commitId);
				}
				return commitId;
			} catch (ServiceLayerException e) {
				logger.error("Failed to delete content at site '{}' paths '{}'", site, paths, e);
				throw e;
			} catch (GitAPIException | UserNotFoundException | IOException e) {
				logger.error("Failed to delete content at site '{}' paths '{}'", site, paths, e);
				throw new ServiceLayerException(format("Failed to delete content at site '%s' paths '%s'", site, StringUtils.join(paths)), e);
			}
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Write content and add it to the git index
	 *
	 * @param siteId the site id
	 * @param repo   the repository to write to
	 * @param items  the content items to write
	 * @return a list of paths that were added to the repository
	 * @throws IOException if an I/O error occurs while writing the content
	 */
	protected List<String> addContent(String siteId, Repository repo, Collection<? extends ContentWriteItem> items)
			throws IOException, ServiceLayerException {
		List<String> addedPaths = new ArrayList<>(items.size());
		for (ContentWriteItem writeItem : items) {
			try (InputStream content = writeItem.content()) {
				helper.writeFile(repo, siteId, writeItem.repoPath(), content);
				addedPaths.add(writeItem.repoPath());
			}
		}
		return addedPaths;
	}

	@Override
	public void createEmptyFiles(String siteId, Collection<String> paths) throws RepositoryException {
		String gitLockKey = helper.getSandboxRepoLockKey(siteId, true);
		generalLockService.lock(gitLockKey);
		try {
			Repository repo = helper.getRepository(siteId, isEmpty(siteId) ? GLOBAL : SANDBOX);
			boolean result = paths.stream()
				.allMatch(path -> {
					try {
						addEmptyFile(repo, siteId, path);
						return true;
					} catch (ServiceLayerException e) {
						logger.error("Failed to create empty file at site '{}' path '{}'", siteId, path, e);
						return false;
					}
				});
			if (result) {
				String commitMessage = helper.getCommitMessage(REPO_CREATE_EMPTY_FILE_COMMIT_MESSAGE)
					.replaceAll(PATTERN_SITE, siteId)
					.replaceAll(PATTERN_PATH, StringUtils.join(paths));
				commitFiles(repo, siteId, paths, commitMessage);
			}
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Create and add an empty file to git
	 *
	 * @param repo   instance of {@link Repository}
	 * @param siteId site id
	 * @param path   path to create and add to git
	 * @throws ServiceLayerException if the file could not be created or added
	 */
	private void addEmptyFile(Repository repo, String siteId, String path) throws ServiceLayerException {
		try {
			File file = new File(repo.getDirectory().getParent(), path);
			if (!file.exists() && !file.createNewFile()) {
				logger.error("Failed to create file to site '{}' path '{}'", siteId, path);
				throw new ServiceLayerException(format("Failed to create file to site '%s' path '%s'", siteId, path));
			}
			helper.addFiles(repo, siteId, path);
		} catch (ServiceLayerException e) {
			logger.error("Error adding file '{}' to site '{}'", path, siteId, e);
			throw e;
		} catch (IOException e) {
			logger.error("Failed to create file to site '{}' path '{}'", siteId, path, e);
			throw new ServiceLayerException(format("Failed to create file to site '%s' path '%s'", siteId, path), e);
		}
	}

	/**
	 * Commit files to git
	 *
	 * @param repo          instance of {@link Repository}
	 * @param siteId        site id
	 * @param paths         paths to commit
	 * @param commitMessage commit message
	 */
	private void commitFiles(Repository repo, String siteId, Collection<String> paths, String commitMessage) {
		try {
			String commitId = helper.commitFiles(repo, siteId,
				commitMessage,
				helper.getAuthorIdent(GIT_REPO_USER_USERNAME),
				paths.toArray(new String[0]));
			if (StringUtils.isNotEmpty(commitId)) {
				persistCommit(siteId, commitId);
			}
		} catch (ServiceLayerException | UserNotFoundException e) {
			logger.error("Failed to commit file in site '{}' path '{}'", siteId, paths, e);
		}
	}

	/**
	 * Insert commit id into processed_commits table if the site exists
	 *
	 * @param siteId   site id
	 * @param commitId commit id
	 */
	private void persistCommit(final String siteId, final String commitId) {
		Site site = siteDao.getSite(siteId);
		if (site != null) {
			retryingDatabaseOperationFacade.retry(() -> processedCommitsDao.insertCommit(site.getId(), commitId));
		}
	}

	@Override
	public void garbageCollectGitRepositories(String siteId) {
		if (isEmpty(siteId)) {
			garbageCollectGlobalRepository();
		} else {
			garbageCollectSiteRepositories(siteId);
		}
	}

	/**
	 * Perform git garbage collection for global repository
	 */
	private void garbageCollectGlobalRepository() {
		logger.info("Garbage collect the global repository");
		String gitLockKey = GLOBAL_REPOSITORY_GIT_LOCK;
		generalLockService.lock(gitLockKey);
		try {
			helper.performGitGarbageCollection(EMPTY, GLOBAL);
		} catch (RepositoryException e) {
			logger.error("Failed to perform git garbage collection for the global repository", e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Perform git garbage collection for site repositories SANDBOX and PUBLISHED
	 *
	 * @param siteId site identifier
	 */
	private void garbageCollectSiteRepositories(String siteId) {
		logger.info("Garbage collect the git repositories in site '{}'", siteId);

		String gitLockKeySandbox = helper.getSandboxRepoLockKey(siteId);
		generalLockService.lock(gitLockKeySandbox);
		try {
			logger.info("Garbage collect the SANDBOX repository for site '{}'", siteId);
			helper.performGitGarbageCollection(siteId, SANDBOX);
		} catch (RepositoryException e) {
			logger.error("Failed to perform git garbage collection for the SANDBOX repository in site '{}'", siteId, e);
		} finally {
			generalLockService.unlock(gitLockKeySandbox);
		}

		String gitLockKeyPublished = helper.getPublishedRepoLockKey(siteId);
		generalLockService.lock(gitLockKeyPublished);
		try {
			logger.info("Garbage collect the PUBLISHED repository for site '{}'", siteId);
			helper.performGitGarbageCollection(siteId, PUBLISHED);
		} catch (RepositoryException e) {
			logger.error("Failed to perform git garbage collection for the PUBLISHED repository in site '{}'", siteId, e);
		} finally {
			generalLockService.unlock(gitLockKeyPublished);
		}
	}

	@Override
	public long getContentSize(final String site, final String path) {
		// TODO: SJ: Reconsider this implementation for blob store backed repos
		try {
			Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
			RevTree tree = helper.getTreeForLastCommit(repo);
			try (TreeWalk tw = TreeWalk.forPath(repo, helper.getGitPath(path), tree)) {
				if (tw != null && tw.getObjectId(0) != null) {
					ObjectId id = tw.getObjectId(0);
					ObjectLoader objectLoader = repo.open(id);
					return objectLoader.getSize();
				}
			}
		} catch (IOException | RepositoryException e) {
			logger.error("Failed to get content size for path '{}' in site '{}'", path, site, e);
		}
		return -1L;
	}

	@Override
	@LogExecutionTime
	public void forAllSitePaths(String site,
								ThrowingConsumer<String> directoryProcessor,
								ThrowingConsumer<String> fileProcessor)
		throws Exception {
		Repository repository = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
		try (TreeWalk treeWalk = new TreeWalk(repository)) {
			RevCommit commit = repository.parseCommit(repository.resolve(HEAD));
			treeWalk.addTree(commit.getTree());
			treeWalk.setRecursive(false);
			while (treeWalk.next()) {
				if (treeWalk.isSubtree()) {
					directoryProcessor.acceptWithException(CS.prependIfMissing(treeWalk.getPathString(), FILE_SEPARATOR));
					treeWalk.enterSubtree();
				} else {
					fileProcessor.acceptWithException(CS.prependIfMissing(treeWalk.getPathString(), FILE_SEPARATOR));
				}
			}
		}
	}

	@Override
	public void lockItem(String site, String path) throws RepositoryException {
		String gitLockKey = helper.getSandboxRepoLockKey(site, true);
		Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
		generalLockService.lock(gitLockKey);
		try (TreeWalk tw = new TreeWalk(repo)) {
			RevTree tree = helper.getTreeForLastCommit(repo);
			tw.addTree(tree); // tree ‘0’
			tw.setRecursive(false);
			tw.setFilter(PathFilter.create(path));

			if (!tw.next()) {
				return;
			}

			File repoRoot = repo.getWorkTree();
			Paths.get(repoRoot.getPath(), tw.getPathString());
			File file = new File(tw.getPathString());
			LockFile lock = new LockFile(file);
			lock.lock();
		} catch (IOException e) {
			logger.error("Failed to lock file at '{}' path '{}'", site, path, e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	@Override
	public void unlockItem(String site, String path) throws RepositoryException {
		String gitLockKey = helper.getSandboxRepoLockKey(site, true);
		Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
		generalLockService.lock(gitLockKey);
		try (TreeWalk tw = new TreeWalk(repo)) {
			RevTree tree = helper.getTreeForLastCommit(repo);
			tw.addTree(tree);
			tw.setRecursive(false);
			tw.setFilter(PathFilter.create(path));

			if (!tw.next()) {
				return;
			}

			File repoRoot = repo.getWorkTree();
			Paths.get(repoRoot.getPath(), tw.getPathString());
			File file = new File(tw.getPathString());
			LockFile lock = new LockFile(file);
			lock.unlock();

		} catch (IOException e) {
			logger.error("Failed to unlock file at site '{}' path '{}'", site, path, e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	@Override
	public Optional<Resource> getContentByCommitId(String site, String path, String commitId) throws ServiceLayerException {
		try {
			Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
			getRevCommit(repo, site, commitId);
			RevTree tree = helper.getTreeForCommit(repo, commitId);
			if (tree != null) {
				try (TreeWalk tw = TreeWalk.forPath(repo, helper.getGitPath(path), tree)) {
					if (tw != null) {
						ObjectId id = tw.getObjectId(0);
						ObjectLoader objectLoader = repo.open(id);
						if (OBJ_BLOB == objectLoader.getType()) {
							return Optional.of(new GitResource(objectLoader));
						}
						return Optional.empty();
					}
				}
			}
		} catch (IOException | RepositoryException e) {
			logger.error("Failed to get content from file at site '{}' path '{}' with commit ID '{}'",
				site, path, commitId, e);
		}
		return Optional.empty();
	}

	/**
	 * Get the commit object from the repository
	 *
	 * @param repo the repository
	 * @param site the site
	 * @param commitId the commit ID
	 * @return the commit object
	 * @throws IOException if an error occurs
	 * @throws InvalidParametersException if the commit ID is invalid
	 */
	protected RevCommit getRevCommit(Repository repo, String site, String commitId) throws IOException, ServiceLayerException {
		var objectId = repo.resolve(commitId);

		if (objectId == null) {
			throw new InvalidParametersException(format("Invalid commit ID '%s' for site '%s'", commitId, site));
		}
		try {
			return repo.parseCommit(objectId);
		} catch (IncorrectObjectTypeException e) {
			throw new InvalidParametersException(format("Invalid commit ID '%s' for site '%s'", commitId, site));
		}
	}

	@Override
	public boolean publishedRepositoryExists(String siteId) throws RepositoryException {
		return Objects.nonNull(helper.getRepository(siteId, PUBLISHED));
	}

	@Override
	public String initialPublish(final PublishPackage publishPackage, final List<String> ignorePaths,
								 final String target) throws ServiceLayerException {
		String siteId = publishPackage.getSite().getSiteId();
		long packageId = publishPackage.getId();

		TaskProgress<PublishTaskId, ?> taskProgress = taskManager.getTask(new PublishTaskId(siteId, packageId));
		String publishedRepoLockKey = helper.getPublishedRepoLockKey(siteId);
		generalLockService.lock(publishedRepoLockKey);
		try {
			String commitId = getRepoLastCommitId(siteId);
			// Create published repo
			if (!publishedRepositoryExists(siteId)) {
				helper.createPublishedRepository(siteId);
			}
			Repository repo = helper.getRepository(siteId, PUBLISHED);
			ObjectId commitIdObject = repo.resolve(commitId);
			String treeId = helper.writeTree(repo, emptyList(), ignorePaths, commitId, commitIdObject, taskProgress);
			User gitRepoUser = userService.getUserByIdOrUsername(-1, GIT_REPO_USER_USERNAME);
			String newCommitId = helper.commitTree(repo, treeId, commitIdObject, gitRepoUser, helper.getCommitMessage(REPO_INITIAL_PUBLISH_COMMIT_MESSAGE));

			// Create target branch
			createEnvironmentBranch(siteId, newCommitId,
				target);
			siteDao.setPublishedRepoCreated(siteId);
			logger.info("Completed the initial publish of the site '{}' for target '{}'", siteId, target);
			return newCommitId;
		} catch (Exception e) {
			throw new ServiceLayerException(format("Failed to perform initial publish of the site '%s' for target '%s'", siteId, target), e);
		} finally {
			generalLockService.unlock(publishedRepoLockKey);
		}
	}

	private void createEnvironmentBranch(String siteId, String startPoint, String environment) throws RepositoryException {
		Repository repository = helper.getRepository(siteId, PUBLISHED);
		try (Git git = new Git(repository)) {
			CreateBranchCommand createBranchCommand = git.branchCreate().setName(environment).setStartPoint(startPoint);
			retryingRepositoryOperationFacade.call(createBranchCommand);
		} catch (GitAPIException e) {
			logger.error("Failed to create the publishing target branch '{}' in the published repo for " +
				"site '{}'", environment, siteId, e);
		}
	}

	@Override
	public <T extends PublishItemTO> GitPublishChangeSet<T> publishAll(final PublishPackage publishPackage,
																	   final String publishingTarget)
		throws ServiceLayerException, IOException {
		String siteId = publishPackage.getSite().getSiteId();
		logger.debug("Publishing all changes for site '{}' package '{}' target '{}'",
			siteId, publishPackage.getId(), publishingTarget);
		Repository repo = helper.getRepository(siteId, PUBLISHED);
		if (repo == null) {
			throw new PublishedRepositoryNotFoundException(
				format("Failed to publish package '%s' for site '%s': published repository not found",
					publishPackage.getId(), siteId));
		}
		ensureEnvironmentBranch(siteId, publishingTarget, repo, publishPackage.getSite().getSandboxBranch());
		String repoLockKey = helper.getPublishedRepoLockKey(siteId);
		generalLockService.lock(repoLockKey);
		try (Git git = Git.wrap(repo)) {
			logger.debug("PublishAll: Fetching changes from sandbox to published repo for site '{}' package '{}' target '{}'",
				siteId, publishPackage.getId(), publishingTarget);
			retryingRepositoryOperationFacade.call(git.fetch());
			RevTree sandboxTree = helper.getTreeForCommit(repo, publishPackage.getCommitId());
			ObjectId publishedLastCommitId = repo.resolve(publishingTarget);
			logger.debug("Creating new commit for tree '{}' in published repo for site '{}' package '{}' target '{}'",
				sandboxTree, siteId, publishPackage.getId(), publishingTarget);

			User user = userService.getUserByIdOrUsername(publishPackage.getSubmitterId(), "");
			String newCommitId = helper.commitTree(repo, sandboxTree.getId().getName(),
				publishedLastCommitId, user, getPublishCommitMessage(publishPackage, user));
			logger.debug("Published all changes for site '{}' package '{}' target '{}'",
				siteId, publishPackage.getId(), publishingTarget);
			return new GitPublishChangeSet<>(newCommitId, emptyList(), emptyList());
		} catch (GitAPIException | IOException | UserNotFoundException e) {
			logger.error("Failed to publish all changes for site '{}' package '{}' target '{}'",
				siteId, publishPackage.getId(), publishingTarget, e);
			throw new ServiceLayerException(format("Failed to publish all changes for site '%s' package '%s' target '%s'",
				siteId, publishPackage.getId(), publishingTarget), e);
		} finally {
			generalLockService.unlock(repoLockKey);
		}
	}

	@Override
	public void updateRef(final String siteId, final long packageId,
						  final String newCommitId, final String publishingTarget) throws RepositoryException {
		Repository repo = helper.getRepository(siteId, PUBLISHED);
		String repoLockKey = helper.getPublishedRepoLockKey(siteId);
		generalLockService.lock(repoLockKey);
		try {
			logger.debug("Updating target branch '{}' in published repo for site '{}' package '{}' with new commit ID '{}'",
				publishingTarget, siteId, packageId, newCommitId);
			RefUpdate refUpdate = repo.updateRef(helper.getBranchRefName(publishingTarget));
			refUpdate.setNewObjectId(repo.resolve(newCommitId));
			refUpdate.update();
		} catch (IOException e) {
			throw new RepositoryException(format("Failed to update ref for site '%s' package '%s'", siteId, packageId), e);
		} finally {
			generalLockService.unlock(repoLockKey);
		}
	}

	@Override
	@LogExecutionTime
	public <T extends PublishItemTO> GitPublishChangeSet<T> publish(final PublishPackage publishPackage,
																	final String publishingTarget,
																	final Collection<T> publishItems) throws ServiceLayerException, IOException {
		String siteId = publishPackage.getSite().getSiteId();
		TaskProgress<PublishTaskId, ?> taskProgress = taskManager.getTask(new PublishTaskId(siteId, publishPackage.getId()));
		logger.debug("Publishing changes for site '{}' package '{}' target '{}'",
			siteId, publishPackage.getId(), publishingTarget);
		if (isEmpty(publishItems)) {
			logger.warn("No items to publish for site '{}' package '{}' target '{}'",
				siteId, publishPackage.getId(), publishingTarget);
			throw new PublishException(format("No items to publish for site '%s' package '%s' target '%s'",
				siteId, publishPackage.getId(), publishingTarget));
		}
		Repository repo = helper.getRepository(siteId, PUBLISHED);
		if (repo == null) {
			throw new PublishedRepositoryNotFoundException(
				format("Failed to publish package '%s' for site '%s': published repository not found",
					publishPackage.getId(), siteId));
		}
		ensureEnvironmentBranch(siteId, publishingTarget, repo, publishPackage.getSite().getSandboxBranch());
		String repoLockKey = helper.getPublishedRepoLockKey(siteId);
		generalLockService.lock(repoLockKey);
		try (Git git = Git.wrap(repo)) {
			logger.debug("Fetching changes from sandbox to published repo for site '{}' package '{}' target '{}'",
				siteId, publishPackage.getId(), publishingTarget);

			TaskProgress.Stage fetchStage = taskProgress.startStage("Fetch changes from sandbox");
			retryingRepositoryOperationFacade.call(git.fetch());
			fetchStage.complete();

			User user = userService.getUserByIdOrUsername(publishPackage.getSubmitterId(), "");
			ObjectId publishedLastCommitId = repo.resolve(publishingTarget);

			// Get affected paths, translate to git paths, group by action
			Map<Action, List<String>> pathsByAction = publishItems.stream()
				.collect(groupingBy(pi -> switch (pi.getAction()) {
						case ADD, UPDATE -> ADD;
						case DELETE -> DELETE;
					},
					mapping(((Function<String, String>) helper::getGitPath).compose(PublishItemTO::getPath), toList())));

			// git read-tree target_branch
			// git ls-tree commit_id list_of_paths | git update-index --index-info
			// git write-tree
			String newTreeId = helper.writeTree(repo,
				pathsByAction.get(ADD),
				pathsByAction.get(DELETE),
				publishPackage.getCommitId(),
				publishedLastCommitId,
				taskProgress);
			// git commit-tree
			TaskProgress.Stage commitTreeStage = taskProgress
				.startStage("Commit changes for target '%s'".formatted(publishingTarget));
			String newCommitId = helper.commitTree(repo, newTreeId, publishedLastCommitId, user, getPublishCommitMessage(publishPackage, user));
			commitTreeStage.complete();
			logger.debug("Published changes for site '{}' package '{}' target '{}'",
				siteId, publishPackage.getId(), publishingTarget);
			return new GitPublishChangeSet<>(newCommitId, publishItems, emptyList());
		} catch (GitAPIException | IOException | UserNotFoundException | InterruptedException e) {
			logger.error("Failed to publish changes for site '{}' package '{}' target '{}'",
				siteId, publishPackage.getId(), publishingTarget, e);
			throw new ServiceLayerException(format("Failed to publish all changes for site '%s' package '%s' target '%s'",
				siteId, publishPackage.getId(), publishingTarget), e);
		} finally {
			generalLockService.unlock(repoLockKey);
		}
	}

	private String getPublishCommitMessage(final PublishPackage publishPackage, final User user) throws UserNotFoundException {
		String commitMessage = studioConfiguration.getProperty(REPO_PUBLISHED_COMMIT_MESSAGE);

		commitMessage = commitMessage.replace("{username}", user.getUsername());
		commitMessage =
			commitMessage.replace("{datetime}",
				DateUtils.getCurrentTime().format(
					DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HHmmssSSSX")));
		commitMessage = commitMessage.replace("{source}", "UI");
		commitMessage = commitMessage.replace("{message}", defaultIfEmpty(publishPackage.getSubmitterComment(), ""));
		commitMessage = commitMessage.replace("{commit_id}", publishPackage.getCommitId());
		commitMessage = commitMessage.replace("{package_id}", String.valueOf(publishPackage.getId()));

		return commitMessage;
	}

	@Override
	public List<ItemVersion> getContentItemHistory(String site, String path) throws RepositoryException {
		List<ItemVersion> versionHistory = new ArrayList<>();
		final String gitPath = helper.getGitPath(path);
		String repoLockKey = helper.getSandboxRepoLockKey(site);
		Repository repo = helper.getRepository(site, SANDBOX);
		generalLockService.lock(repoLockKey);
		try (Git git = Git.wrap(repo); final RevWalk revWalk = new RevWalk(git.getRepository())) {
			DiffConfig diffConfig = repo.getConfig().get(DiffConfig.KEY);
			revWalk.setTreeFilter(FollowFilter.create(gitPath, diffConfig));
			revWalk.markStart(revWalk.parseCommit(repo.resolve(HEAD)));
			revWalk.sort(RevSort.TOPO);
			String currentPath = gitPath;
			boolean revertible = true;
			for (RevCommit revCommit : revWalk) {
				ItemVersion version = new ItemVersion(new RepositoryVersion(revCommit));
				version.setRevertible(revertible);
				version.setPath(CS.prependIfMissing(currentPath, FILE_SEPARATOR));
				try {
					DiffEntry diffEntry = helper.getDiffEntry(repo, revCommit, currentPath);
					if (!CS.equals(currentPath, diffEntry.getOldPath())) {
						if (CS.equals(diffEntry.getOldPath(), DiffEntry.DEV_NULL)) {
							currentPath = null;
						} else {
							currentPath = diffEntry.getOldPath();
							revertible = false;
						}
					}
				} catch (NoChangesForPathException e) {
					logger.error("Failed to get diff entry for path '{}' in commit '{}'", currentPath, revCommit.getName(), e);
				}
				// Set this after the diff entry is retrieved, so that the old path is set correctly
				version.setOldPath(CS.prependIfMissing(currentPath, FILE_SEPARATOR));
				versionHistory.add(version);
				if (currentPath == null) {
					// We have reached the latest creation of a file in this path
					break;
				}
			}
		} catch (GitAPIException | IOException e) {
			throw new RepositoryException(format("Failed to get content item history for site '%s' path '%s'", site, path), e);
		} finally {
			generalLockService.unlock(repoLockKey);
		}
		return versionHistory;
	}

	@Override
	public List<String> getCommitIdsBetween(final String site, final String commitFrom, final String commitTo) throws RepositoryException {
		List<String> result = new ArrayList<>();
		String repoLockKey = helper.getSandboxRepoLockKey(site);
		Repository repo = helper.getRepository(site, SANDBOX);
		generalLockService.lock(repoLockKey);
		try (Git git = Git.wrap(repo); RevWalk revWalk = new RevWalk(git.getRepository())) {
			// git log --first-parent --reverse commitFrom..commitTo
			revWalk.setFirstParent(true);
			revWalk.markStart(revWalk.parseCommit(repo.resolve(commitTo)));
			revWalk.setRevFilter(new RevFilter() {
				@Override
				public boolean include(RevWalk walker, RevCommit commit) throws StopWalkException {
					if (!commit.getName().equals(commitFrom)) {
						return true;
					}
					throw StopWalkException.INSTANCE;
				}

				@Override
				public RevFilter clone() {
					return this;
				}
			});
			revWalk.sort(TOPO_KEEP_BRANCH_TOGETHER);
			revWalk.sort(REVERSE, true);

			for (RevCommit revCommit : revWalk) {
				result.add(revCommit.getName());
			}
		} catch (IOException e) {
			throw new RepositoryException(format("Failed to get commit IDs between '%s' and '%s' for site '%s'", commitFrom, commitTo, site), e);
		} finally {
			generalLockService.unlock(repoLockKey);
		}
		return result;
	}

	@Override
	public List<RepositoryVersion> getHistory(String siteId, String commitFrom, int limit) throws RepositoryException, ServiceLayerException {
		List<RepositoryVersion> versionHistory = new ArrayList<>();
		String repoLockKey = helper.getSandboxRepoLockKey(siteId);
		Repository repo = helper.getRepository(siteId, SANDBOX);
		generalLockService.lock(repoLockKey);
		try (Git git = Git.wrap(repo); RevWalk revWalk = new RevWalk(git.getRepository())) {
			revWalk.setFirstParent(true);
			RevCommit commitFromId = getRevCommit(repo, siteId, commitFrom);
			revWalk.setRevFilter(new RevFilter() {
				private int count = 0;

				@Override
				public boolean include(RevWalk revWalk, RevCommit revCommit) throws StopWalkException {
					if (count++ < limit) {
						return true;
					}
					throw StopWalkException.INSTANCE;
				}

				@Override
				public RevFilter clone() {
					return this;
				}
			});
			revWalk.markStart(commitFromId);
			revWalk.sort(TOPO);
			for (RevCommit revCommit : revWalk) {
				versionHistory.add(new RepositoryVersion(revCommit));
			}
		} catch (IOException e) {
			throw new RepositoryException(format("Failed to get history for site '%s' from commit '%s'", siteId, commitFrom), e);
		} finally {
			generalLockService.unlock(repoLockKey);
		}
		return versionHistory;
	}

	@Override
	public List<String> getIntroducedCommits(String site, String baseCommit, String commitId) throws RepositoryException {
		List<String> result = new ArrayList<>();
		String repoLockKey = helper.getSandboxRepoLockKey(site);
		Repository repo = helper.getRepository(site, SANDBOX);
		generalLockService.lock(repoLockKey);
		try (Git git = Git.wrap(repo)) {
			RevCommit revCommitBase = repo.parseCommit(repo.resolve(baseCommit));
			RevCommit revCommit = repo.parseCommit(repo.resolve(commitId));

			git.log().addRange(revCommitBase, revCommit).call().forEach(commit -> result.add(commit.getName()));
		} catch (IOException | GitAPIException e) {
			throw new RepositoryException(format("Failed to get introduced commits between '%s' and '%s' for site '%s'", baseCommit, commitId, site), e);
		} finally {
			generalLockService.unlock(repoLockKey);
		}
		return result;
	}

	@Override
	public void duplicateSite(String sourceSiteId, String siteId, String sourceSandboxBranch, String sandboxBranch) throws IOException, ServiceLayerException {
		String repoLockKey = helper.getSandboxRepoLockKey(sourceSiteId);
		generalLockService.lock(repoLockKey);

		try {
			Path sourceSandboxPath = helper.buildRepoPath(SANDBOX, sourceSiteId);
			Path destSandboxPath = helper.buildRepoPath(SANDBOX, siteId);
			if (destSandboxPath.toFile().exists()) {
				logger.warn("Deleting existing sandbox repository for site '{}'", siteId);
				FileUtils.deleteDirectory(destSandboxPath.toFile());
			}
			FileUtils.copyDirectory(sourceSandboxPath.toFile(), destSandboxPath.toFile());
			// Cache the repo and checkout the sandbox branch
			helper.getRepository(siteId, SANDBOX, sandboxBranch);

			if (!publishedRepositoryExists(sourceSiteId)) {
				return;
			}
			Path sourcePublishedPath = helper.buildRepoPath(PUBLISHED, sourceSiteId);
			Path destPublishedPath = helper.buildRepoPath(PUBLISHED, siteId);
			if (destPublishedPath.toFile().exists()) {
				logger.warn("Deleting existing published repository for site '{}'", siteId);
				FileUtils.deleteDirectory(destPublishedPath.toFile());
			}
			FileUtils.copyDirectory(sourcePublishedPath.toFile(), destPublishedPath.toFile());
			// Cache the repo
			Repository publishedRepo = helper.getRepository(siteId, PUBLISHED);
			if (CS.equals(sourceSandboxBranch, sandboxBranch)) {
				return;
			}
			try {
				boolean create = !branchExists(publishedRepo, sandboxBranch);
				if (create) {
					helper.createBranch(publishedRepo, siteId, sourceSandboxBranch, sandboxBranch);
				}
			} catch (RepositoryException e) {
				throw new ServiceLayerException(format("Failed to duplicate site '%s' to '%s'", sourceSiteId, siteId),
						e);
			}
		} finally {
			generalLockService.unlock(repoLockKey);
		}
	}

	protected InputStream shallowGetContent(String site, String path) throws ContentNotFoundException {
		Path filePath = helper.buildRepoPath(SANDBOX, site).resolve(helper.getGitPath(path));
		try {
			return new FileInputStream(filePath.toFile());
		} catch (FileNotFoundException e) {
			throw new ContentNotFoundException(path, site, format("Content not found at site '%s' path '%s'", site, path), e);
		}
	}

	@Override
	public InputStream getContent(String site, String path, boolean shallow) throws ContentNotFoundException {
		if (shallow) {
			return shallowGetContent(site, path);
		}
		return getContentFromHead(site, path);
	}

	private TreeWalk getTreeWalkForPath(Repository repo, String path) throws IOException {
		RevTree tree = helper.getTreeForLastCommit(repo);
		String gitPath = helper.getGitPath(path);
		if (isEmpty(gitPath) || gitPath.equals(".")) {
			TreeWalk tw = new TreeWalk(repo);
			tw.addTree(tree);
			return tw;

		}
		return TreeWalk.forPath(repo, gitPath, tree);
	}

	@Override
	public Collection<RepositoryItem> getContentChildren(final String site, final String path) throws ServiceLayerException {
		final List<RepositoryItem> retItems = new ArrayList<>();
		try {
			Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
			try (TreeWalk tw = getTreeWalkForPath(repo, path)) {
				if (tw == null) {
					throw new ContentNotFoundException(path, site, format("Content not found at site '%s' path '%s'", site, path));
				}
				// Loop for all children and gather path of item excluding the item, file/folder name, and
				// whether it's a folder
				ObjectLoader loader = repo.open(tw.getObjectId(0));
				if (loader.getType() != OBJ_TREE) {
					logger.debug("Item at site '{}' path '{}' doesn't have any children",
						site, path);
					return emptyList();
				}
				tw.enterSubtree();
				while (tw.next()) {
					String name = tw.getNameString();
					if (ArrayUtils.contains(IGNORE_FILES, name)) {
						continue;
					}
					loader = repo.open(tw.getObjectId(0));
					boolean isFolder = loader.getType() == OBJ_TREE;
					String itemPath = FILE_SEPARATOR + CS.removeEnd(tw.getPathString(), FILE_SEPARATOR + name);
					retItems.add(new RepositoryItem(itemPath, name, isFolder));
				}
			}
		} catch (IOException e) {
			logger.error("Failed to get children at site '{}' path '{}'", site, path, e);
			throw new ServiceLayerException(format("Failed to get children at site '%s' path '%s'", site, path), e);
		}

		return retItems;
	}

	@Override
	@SuppressWarnings("ResultOfMethodCallIgnored")
	public String createFolder(String siteId, String folderPath) throws ServiceLayerException, UserNotFoundException {
		String gitLockKey = helper.getSandboxRepoLockKey(siteId, true);
		generalLockService.lock(gitLockKey);
		try {
			Repository repo = helper.getRepositoryForWrite(siteId);
			File newFolderFile = new File(repo.getDirectory().getParent(), folderPath);
			newFolderFile.mkdirs();

			List<String> paths = addNewFolders(siteId, repo, Set.of(folderPath));
			PersonIdent user = helper.getCurrentUserIdent();
			String comment = helper.getCommitMessage(REPO_CREATE_FOLDER_COMMIT_MESSAGE)
					.replaceAll(PATTERN_SITE, siteId)
					.replaceAll(PATTERN_PATH, folderPath);
			String commitId = helper.commitFiles(repo, siteId, comment, user, paths.toArray(new String[]{}));
			if (commitId != null) {
				persistCommit(siteId, commitId);
			}
			return commitId;
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Create empty files in the new folders and add the paths to the index
	 * Notice that this method assumes the folders already exist in the repository.
	 *
	 * @param siteId     the site id
	 * @param repo       the git repo
	 * @param newFolders the list of new folder paths
	 * @return the list of paths to the empty files
	 */
	protected List<String> addNewFolders(String siteId, Repository repo, Set<String> newFolders) throws ServiceLayerException {
		List<String> paths = new ArrayList<>(newFolders.size());
		// Create new folders
		for (String newFolder : newFolders) {
			String emptyFilePath = Path.of(newFolder, EMPTY_FILE).toString();
			addEmptyFile(repo, siteId, emptyFilePath);
			paths.add(emptyFilePath);
		}
		return paths;
	}

	@Override
	public String writeContent(String siteId, Collection<? extends ContentWriteItem> writeItems, Set<String> newFolders, String userComment)
		throws ServiceLayerException, UserNotFoundException {
		String gitLockKey = helper.getSandboxRepoLockKey(siteId, true);
		generalLockService.lock(gitLockKey);
		try {
			Repository repo = helper.getRepositoryForWrite(siteId);

			for (ContentWriteItem writeItem : writeItems) {
				try (InputStream content = writeItem.content()) {
					helper.writeFile(repo, siteId, writeItem.repoPath(), content);
				}
			}
			List<String> paths = new ArrayList<>(writeItems.size() + newFolders.size());
			paths.addAll(writeItems.stream()
				.map(ContentWriteItem::repoPath)
				.toList());

			paths.addAll(addNewFolders(siteId, repo, newFolders));

			PersonIdent user = helper.getCurrentUserIdent();
			String username = SecurityUtils.getCurrentUsername();
			String comment = helper.getCommitMessage(REPO_SANDBOX_WRITE_COMMIT_MESSAGE)
					.replace(REPO_COMMIT_MESSAGE_USERNAME_VAR, username)
					.replace(REPO_COMMIT_MESSAGE_PATH_VAR, paths.getFirst())
					.replace(REPO_COMMIT_MESSAGE_USER_COMMENT_VAR, defaultIfEmpty(userComment, "")); // Avoid "null" in the commit message if the comment is null
			String commitId = helper.commitFiles(repo, siteId, comment, user, paths.toArray(new String[]{}));
			if (commitId != null) {
				persistCommit(siteId, commitId);
			}
			return commitId;
		} catch (ServiceLayerException | UserNotFoundException e) {
			logger.error("Failed to write content to site '{}' items '{}'", siteId, writeItems, e);
			throw e;
		} catch (IOException e) {
			throw new ServiceLayerException(format("Failed to write content to site '%s' items '%s'", siteId, writeItems), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Move files or folders in the file system
	 *
	 * @param repoPath    path to the repository
	 * @param gitFromPath path to move from
	 * @param gitToPath   path to move to
	 * @throws IOException if an I/O error occurs
	 */
	private void moveFiles(String repoPath, String gitFromPath, String gitToPath) throws
			IOException {
		Path sourcePath = Paths.get(repoPath, gitFromPath);
		Path targetPath = Paths.get(repoPath, gitToPath);
		File sourceFile = sourcePath.toFile();
		File targetFile = targetPath.toFile();

		if (sourceFile.isFile()) {
			FileUtils.moveFile(sourceFile, targetFile);
		} else {
			FileUtils.moveDirectory(sourceFile, targetFile);
		}
	}

	@Override
	public String moveContent(String siteId, String fromPath, String toPath, Collection<? extends ContentWriteItem> additionalItems,
							  Set<String> newFolders) throws ServiceLayerException, UserNotFoundException {
		return copyOrMoveContent(siteId, fromPath, toPath, additionalItems, newFolders, true);
	}

	protected String copyOrMoveContent(String siteId, String fromPath, String toPath,
									   Collection<? extends ContentWriteItem> additionalItems, Set<String> newFolders,
									   boolean isMove)
			throws ServiceLayerException, UserNotFoundException {
		String operation = isMove ? "move" : "copy";
		String gitLockKey = helper.getSandboxRepoLockKey(siteId, true);
		generalLockService.lock(gitLockKey);
		try {
			Repository repo = helper.getRepositoryForWrite(siteId);
			String gitFromPath = helper.getGitPath(fromPath);
			String gitToPath = helper.getGitPath(toPath);
			if (isMove) {
				moveFiles(repo.getDirectory().getParent(), gitFromPath, gitToPath);
			} else {
				copyFiles(repo.getDirectory().getParent(), gitFromPath, gitToPath);
			}

			helper.addFiles(repo, siteId, gitFromPath, gitToPath);
			List<String> changeSet = new ArrayList<>(additionalItems.size() + newFolders.size() + 1);
			changeSet.add(gitToPath);
			if (isMove) {
				// If it's a move, we need to add the 'from' path, so it gets removed
				changeSet.add(gitFromPath);
			}

			for (ContentWriteItem writeItem : additionalItems) {
				try (InputStream content = writeItem.content()) {
					helper.writeFile(repo, siteId, writeItem.repoPath(), content);
					changeSet.add(writeItem.repoPath());
				}
			}
			changeSet.addAll(addNewFolders(siteId, repo, newFolders));
			PersonIdent user = helper.getCurrentUserIdent();
			String commitMsg = helper.getCommitMessage(isMove ? REPO_MOVE_CONTENT_COMMIT_MESSAGE : REPO_COPY_CONTENT_COMMIT_MESSAGE)
					.replaceAll(PATTERN_FROM_PATH, fromPath)
					.replaceAll(PATTERN_TO_PATH, toPath);
			String commitId = helper.commitFiles(repo, siteId, commitMsg, user, changeSet.toArray(new String[0]));
			if (commitId != null) {
				persistCommit(siteId, commitId);
			}
			return commitId;
		} catch (ServiceLayerException e) {
			logger.error("Failed to {} item in site '{}' from path '{}' to path '{}'", operation, siteId, fromPath, toPath, e);
			throw e;
		} catch (UserNotFoundException e) {
			logger.error("Failed to {} item in site '{}' from path '{}' to path '{}': user not found", operation, siteId, fromPath, toPath, e);
			throw e;
		} catch (Exception e) {
			logger.error("Failed to {} item in site '{}' from path '{}' to path '{}'", operation, siteId, fromPath, toPath, e);
			throw new ServiceLayerException(format("Failed to %s item in site '%s' from path '%s' to path '%s'", operation, siteId, fromPath, toPath), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	@Override
	public String copy(String siteId, String fromPath, String toPath, Collection<? extends ContentWriteItem> additionalItems, Set<String> newFolders)
			throws ServiceLayerException, UserNotFoundException {
		return copyOrMoveContent(siteId, fromPath, toPath, additionalItems, newFolders, false);
	}

	/**
	 * Copy files or folders in the file system
	 *
	 * @param repoPath    the path to the repository
	 * @param gitFromPath the path to copy from
	 * @param gitToPath   the path to copy to
	 * @throws IOException if an I/O error occurs
	 */
	protected void copyFiles(String repoPath, String gitFromPath, String gitToPath)
			throws IOException {
		Path sourcePath = Paths.get(repoPath, gitFromPath);
		Path targetPath = Paths.get(repoPath, gitToPath);
		File sourceFile = sourcePath.toFile();
		File targetFile = targetPath.toFile();

		if (sourceFile.isFile()) {
			FileUtils.copyFile(sourceFile, targetFile);
		} else {
			FileUtils.copyDirectory(sourceFile, targetFile);
		}
	}

	/**
	 * Get the content of a file at a specific commit
	 */
	private InputStream getContentFromHead(String site, String path) throws ContentNotFoundException {
		try {
			Repository repo = helper.getRepository(site, isEmpty(site) ? GLOBAL : SANDBOX);
			if (repo == null) {
				throw new ContentNotFoundException(path, site, format("Repository not found for site '%s'", site));
			}
			RevTree tree = helper.getTreeForCommit(repo, HEAD);
			if (tree != null) {
				try (TreeWalk tw = TreeWalk.forPath(repo, helper.getGitPath(path), tree)) {
					// Check if the array of items is not null, and since we have an absolute path to the item,
					// pick the first item in the list
					if (tw != null && tw.getObjectId(0) != null) {
						ObjectId id = tw.getObjectId(0);
						ObjectLoader objectLoader = repo.open(id);

						if (OBJ_BLOB == objectLoader.getType()) {
							return objectLoader.openStream();
						}
					}
				}
			}
			throw new ContentNotFoundException(path, site, format("Failed to get content from site '%s' path '%s'", site, path));
		} catch (IOException | RepositoryException e) {
			logger.error("Failed to get the content item at site '{}' path '{}' from HEAD",
				site, path, e);
			throw new ContentNotFoundException(path, site, format("Failed to get content from site '%s' path '%s'", site, path), e);
		}
	}

	@Override
	public String writeContent(String siteId, String path, InputStream content) throws
			ServiceLayerException, UserNotFoundException {
		String gitLockKey = helper.getSandboxRepoLockKey(siteId, true);
		generalLockService.lock(gitLockKey);
		try {
			Repository repo = helper.getRepositoryForWrite(siteId);
			helper.writeFile(repo, siteId, path, content);
			PersonIdent user = helper.getCurrentUserIdent();
			String username = SecurityUtils.getCurrentUsername();
			String comment = helper.getCommitMessage(REPO_SANDBOX_WRITE_COMMIT_MESSAGE)
					.replace(REPO_COMMIT_MESSAGE_USERNAME_VAR, username)
					.replace(REPO_COMMIT_MESSAGE_PATH_VAR, path)
					.replace(REPO_COMMIT_MESSAGE_USER_COMMENT_VAR, ""); // Avoid "null" in the commit message if the comment is null;
			String commitId = helper.commitFiles(repo, siteId, comment, user, path);
			if (commitId != null) {
				persistCommit(siteId, commitId);
			}
			return commitId;
		} catch (ServiceLayerException | UserNotFoundException e) {
			logger.error("Failed to write content to site '{}' path '{}'", siteId, path, e);
			throw e;
		} catch (IOException e) {
			throw new ServiceLayerException("Failed to write content to site '%s' path '%s'".formatted(siteId, path), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	@SuppressWarnings("unused")
	public void setHelper(GitRepositoryHelper helper) {
		this.helper = helper;
	}

	@SuppressWarnings("unused")
	public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	@SuppressWarnings("unused")
	public void setUserService(UserService userService) {
		this.userService = userService;
	}

	@SuppressWarnings("unused")
	public void setRemoteRepositoryDAO(RemoteRepositoryDAO remoteRepositoryDAO) {
		this.remoteRepositoryDAO = remoteRepositoryDAO;
	}

	@SuppressWarnings("unused")
	public void setSiteDao(SiteDAO siteDao) {
		this.siteDao = siteDao;
	}

	@SuppressWarnings("unused")
	public void setProcessedCommitsDao(ProcessedCommitsDAO processedCommitsDao) {
		this.processedCommitsDao = processedCommitsDao;
	}

	@SuppressWarnings("unused")
	public void setEncryptor(TextEncryptor encryptor) {
		this.encryptor = encryptor;
	}

	@SuppressWarnings("unused")
	public void setContextManager(ContextManager contextManager) {
		this.contextManager = contextManager;
	}

	@SuppressWarnings("unused")
	public void setContentStoreService(ContentStoreService contentStoreService) {
		this.contentStoreService = contentStoreService;
	}

	@SuppressWarnings("unused")
	public void setGeneralLockService(GeneralLockService generalLockService) {
		this.generalLockService = generalLockService;
	}

	@SuppressWarnings("unused")
	public void setRetryingRepositoryOperationFacade(RetryingRepositoryOperationFacade
														 retryingRepositoryOperationFacade) {
		this.retryingRepositoryOperationFacade = retryingRepositoryOperationFacade;
	}

	@SuppressWarnings("unused")
	public void setRetryingDatabaseOperationFacade(RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}

	@SuppressWarnings("unused")
	public void setServicesConfig(ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	@SuppressWarnings("unused")
	public void setTaskManager(final TaskManager taskManager) {
		this.taskManager = taskManager;
	}
}
