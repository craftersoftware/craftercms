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

package org.craftercms.studio.api.v2.utils;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Strings;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.craftercms.commons.crypto.CryptoException;
import org.craftercms.commons.crypto.TextEncryptor;
import org.craftercms.commons.git.utils.AuthConfiguratorFactory;
import org.craftercms.commons.git.utils.AuthenticationType;
import org.craftercms.commons.git.utils.TypeBasedAuthConfiguratorBuilder;
import org.craftercms.studio.api.v1.constant.GitRepositories;
import org.craftercms.studio.api.v1.constant.StudioConstants;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.repository.RemoteRepository;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.git.MergeInProgressException;
import org.craftercms.studio.api.v2.exception.git.NoChangesForPathException;
import org.craftercms.studio.api.v2.exception.git.cli.CommitterIdentityUnknownException;
import org.craftercms.studio.api.v2.exception.git.cli.GitCliException;
import org.craftercms.studio.api.v2.exception.git.cli.NoChangesToCommitException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.repository.RetryingRepositoryOperationFacade;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.impl.v1.repository.StrSubstitutorVisitor;
import org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants;
import org.craftercms.studio.impl.v1.repository.git.TreeCopier;
import org.craftercms.studio.impl.v2.utils.GitUtils;
import org.craftercms.studio.impl.v2.utils.git.GitCli;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.eclipse.jgit.api.*;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.api.errors.InvalidRemoteException;
import org.eclipse.jgit.api.errors.TransportException;
import org.eclipse.jgit.diff.DiffConfig;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.lib.*;
import org.eclipse.jgit.revwalk.FollowFilter;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.treewalk.AbstractTreeIterator;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.eclipse.jgit.treewalk.EmptyTreeIterator;
import org.eclipse.jgit.treewalk.filter.PathFilter;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.channels.ReadableByteChannel;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitOption;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.EMPTY;
import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v1.constant.GitRepositories.*;
import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getStudioTemporaryFilesRoot;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.*;
import static org.craftercms.studio.impl.v2.utils.git.cli.CommitterIdentityUnknownExceptionResolver.GIT_COMMITTER_IDENTITY_UNKNOWN_MESSAGE;
import static org.eclipse.jgit.lib.Constants.HEAD;
import static org.eclipse.jgit.lib.Constants.R_REMOTES;

// TODO: AV - Missing Javadoc and shouldn't be in the api root package. Those are only used mainly for interfaces
// TODO: AV - all methods in this class should throw exceptions instead of returning null or a boolean
// not implementations like this one
public class GitRepositoryHelper implements DisposableBean {

	public static final String CONFIG_KEY_RESOURCE = "resource";
	public static final String CONFIG_KEY_FOLDER = "folder";
	public static final String CONFIG_KEY_BARE = "bare";
	public static final String CONFIG_KEY_CORE = "core";
	public static final String PUBLISHED_TMP = "published-tmp";

	// firstname lastname
	public static final String USERNAME_FORMAT = "%s %s";

	protected static final String REMOTE_BRANCH_REF_NAME_FORMAT = R_REMOTES + "%s/%s";
	protected static final String REFS_HEADS_FORMAT = "refs/heads/%s";

	private static final Logger logger = LoggerFactory.getLogger(GitRepositoryHelper.class);
	private static final String GIT_CONFIG_PROPERTY_EMAIL = "email";
	private static final String GIT_CONFIG_PROPERTY_NAME = "name";
	private static final String GIT_CONFIG_SECTION_USER = "user";

	private StudioConfiguration studioConfiguration;
	private TextEncryptor encryptor;
	private UserService userService;
	private GeneralLockService generalLockService;
	private RetryingRepositoryOperationFacade retryingRepositoryOperationFacade;
	private AuthConfiguratorFactory authConfiguratorFactory;
	private GitCli gitCli;

	private final Cache<String, Repository> repositoryCache = CacheBuilder.newBuilder().build();

	@Override
	public void destroy() throws Exception {
		repositoryCache.asMap().values().forEach(Repository::close);
		repositoryCache.invalidateAll();
		repositoryCache.cleanUp();
	}

	protected String getRepoCacheKey(String siteId, GitRepositories type) {
		return String.join(":", type.toString(), siteId);
	}

	public Repository getRepository(String siteId, GitRepositories gitRepository) throws RepositoryException {
		return getRepository(siteId, gitRepository, null);
	}

	/**
	 * Get the repository for write operations, ensuring it is not in a merge state
	 *
	 * @param siteId the site id
	 * @return the repository
	 * @throws ServiceLayerException if the repository is in a merge state or if there is an error accessing it
	 */
	@NonNull
	public Repository getRepositoryForWrite(String siteId) throws ServiceLayerException {
		Repository repo = getRepository(siteId, isEmpty(siteId) ? GLOBAL : SANDBOX);
		if (repo == null) {
			logger.error("Missing repository for write for site '{}'", siteId);
			throw new ServiceLayerException(format("Missing repository for write for site '%s'", siteId));
		}
		ensureNoMergeState(siteId, repo);
		return repo;
	}

	/**
	 * Ensures that the repo is not in merge state (i.e.: MERGE_HEAD exists)
	 *
	 * @param siteId the site id
	 * @param repo   the git repo
	 * @throws ServiceLayerException if the repo is not clean or if there is an error while checking the status
	 */
	protected void ensureNoMergeState(String siteId, Repository repo) throws ServiceLayerException {
		try (Git git = new Git(repo)) {
			StatusCommand statusCommand = git.status();
			Status status = retryingRepositoryOperationFacade.call(statusCommand);
			if (!status.isClean()) {
				if (!status.getConflicting().isEmpty()) {
					throw new MergeInProgressException(format("Repository has merge conflicts for write-content in site '%s'. Refuse to write-content", siteId));
				}
				if (CollectionUtils.isNotEmpty(repo.readMergeHeads())) {
					throw new MergeInProgressException(format("Repository for site '%s' is currently in a merge state. Refuse to write-content", siteId));
				}
			}
			logger.debug("Repository is clean for write-content in site '{}'", siteId);
		} catch (GitAPIException | IOException e) {
			throw new ServiceLayerException(format("Failed to check status of the repository for site '%s'", siteId), e);
		}
	}

	public Repository getRepository(String siteId, GitRepositories repoType, String sandboxBranch) throws RepositoryException {
		String cacheKey = getRepoCacheKey(siteId, repoType);
		Repository repo = repositoryCache.getIfPresent(cacheKey);

		if (repo == null) {
			logger.debug("cache miss for site '{}', type '{}'", siteId, repoType);
			switch (repoType) {
				case SANDBOX:
					if (buildSiteRepo(siteId)) {
						repo = repositoryCache.getIfPresent(cacheKey);
						if (StringUtils.isNotEmpty(sandboxBranch)) {
							checkoutSandboxBranch(siteId, repo, sandboxBranch);
						}
					} else {
						logger.warn("Failed to get the sandbox repository for site '{}'", siteId);
					}
					break;
				case PUBLISHED:
					if (buildSiteRepo(siteId)) {
						repo = repositoryCache.getIfPresent(cacheKey);
					} else {
						logger.warn("Failed to get the published repository for site '{}'", siteId);
					}
					break;
				case GLOBAL:
					Path globalConfigRepoPath = getRepoGitDir(GLOBAL, EMPTY);
					try {
						repo = openRepository(globalConfigRepoPath);
					} catch (IOException e) {
						logger.error("Failed to get the global repository.", e);
					}
					break;
			}

			if (repo == null) {
				logger.debug("Failed to get the '{}' repository for site '{}'", repoType, siteId);
			}
		}

		return repo;
	}

	public boolean buildSiteRepo(String siteId) {
		boolean toReturn = true;
		Repository sandboxRepo;
		Repository publishedRepo;

		Path siteSandboxRepoPath = getRepoGitDir(GitRepositories.SANDBOX, siteId);
		Path sitePublishedRepoPath = getRepoGitDir(GitRepositories.PUBLISHED, siteId);

		try {
			if (Files.exists(siteSandboxRepoPath)) {
				// Build and put in cache
				sandboxRepo = repositoryCache.getIfPresent(getRepoCacheKey(siteId, SANDBOX));
				if (sandboxRepo == null) {
					sandboxRepo = openRepository(siteSandboxRepoPath);
					repositoryCache.put(getRepoCacheKey(siteId, SANDBOX), sandboxRepo);
				}
			}
		} catch (IOException e) {
			toReturn = false;
			logger.error("Failed to create the sandbox repository in site '{}' using path '{}'",
				siteId, siteSandboxRepoPath, e);
		}

		try {
			if (toReturn && Files.exists(sitePublishedRepoPath)) {
				// Build and put in cache
				publishedRepo = repositoryCache.getIfPresent(getRepoCacheKey(siteId, PUBLISHED));
				if (publishedRepo == null) {
					publishedRepo = openRepository(sitePublishedRepoPath);
					repositoryCache.put(getRepoCacheKey(siteId, PUBLISHED), publishedRepo);
				}
			}
		} catch (IOException e) {
			toReturn = false;
			logger.error("Failed to create the published repository in site '{}' using path '{}'",
				siteId, sitePublishedRepoPath, e);
		}

		return toReturn;
	}

	/**
	 * Builds global repository path
	 *
	 * @return repository path
	 */
	public Path buildGlobalRepoPath() {
		return buildRepoPath(GLOBAL, EMPTY);
	}

	/**
	 * Get the repository 'git' directory
	 * The 'git-dir' is the directory where the git repository is stored. It is
	 * '.git' for
	 * non-bare repositories (SANDBOX, GLOBAL) and the root directory for bare
	 * repositories (PUBLISHED).
	 *
	 * @param repoType the type of repository
	 * @param siteId   the site id (empty for the global repository)
	 * @return the path to the repository 'git' directory, or the root directory if
	 *         the repository is bare
	 */
	public Path getRepoGitDir(GitRepositories repoType, String siteId) {
		Path repoPath = buildRepoPath(repoType, siteId);
		// If published repository is not bare, return the .git directory
		if (repoType != PUBLISHED || repoPath.resolve(GIT_ROOT).toFile().exists()) {
			repoPath = repoPath.resolve(GIT_ROOT);
		}
		return repoPath;
	}

	/**
	 * Builds repository path
	 *
	 * @param repoType repository type
	 * @param siteId   site Id (if empty it is global repository)
	 * @return repository path
	 */
	public Path buildRepoPath(GitRepositories repoType, String siteId) {
		// TODO: SJ: Profile the following and see if it can be improved by using a simple string template
		return switch (repoType) {
			case SANDBOX -> Paths.get(studioConfiguration.getProperty(StudioConfiguration.REPO_BASE_PATH),
				studioConfiguration.getProperty(StudioConfiguration.SITES_REPOS_PATH), siteId,
				studioConfiguration.getProperty(StudioConfiguration.SANDBOX_PATH));
			case PUBLISHED -> Paths.get(studioConfiguration.getProperty(StudioConfiguration.REPO_BASE_PATH),
				studioConfiguration.getProperty(StudioConfiguration.SITES_REPOS_PATH), siteId,
				studioConfiguration.getProperty(StudioConfiguration.PUBLISHED_PATH));
			case GLOBAL -> Paths.get(studioConfiguration.getProperty(StudioConfiguration.REPO_BASE_PATH),
				studioConfiguration.getProperty(StudioConfiguration.GLOBAL_REPO_PATH));
		};
	}

	/**
	 * Opens a git repository
	 *
	 * @param repositoryPath path to repository to open (including .git)
	 * @return repository object if successful
	 * @throws IOException IO error
	 */
	public Repository openRepository(Path repositoryPath) throws IOException {
		FileRepositoryBuilder builder = new FileRepositoryBuilder();
		Repository repository = builder
			.setGitDir(repositoryPath.toFile())
			.readEnvironment()
			.findGitDir()
			.build();
		return repository;
	}

	public boolean isRemoteValid(Git git, String remote, AuthenticationType authenticationType,
				     String remoteUsername, String remotePassword, String remoteToken,
				     String remotePrivateKey)
		throws CryptoException, IOException, ServiceLayerException, GitAPIException {
		LsRemoteCommand lsRemoteCommand = git.lsRemote();
		lsRemoteCommand.setRemote(remote);
		final Path tempKey = Files.createTempFile(getStudioTemporaryFilesRoot(), UUID.randomUUID().toString(), TMP_FILE_SUFFIX);
		setAuthenticationForCommand(lsRemoteCommand, authenticationType, remoteUsername,
			remotePassword, remoteToken, remotePrivateKey, tempKey, false);
		retryingRepositoryOperationFacade.call(lsRemoteCommand);
		Files.deleteIfExists(tempKey);
		return true;
	}

	/**
	 * Configure a git command with authentication details
	 *
	 * @param gitCommand       the git command
	 * @param remoteRepository the remote repository information to get the authentication details from
	 * @param tempKey          temporary file to store the private key
	 * @param decrypt          whether to decrypt the password, token and private key
	 */
	public void setAuthenticationForCommand(final TransportCommand<?, ?> gitCommand,
						final RemoteRepository remoteRepository,
						final Path tempKey, boolean decrypt)
		throws ServiceLayerException, IOException, CryptoException {
		setAuthenticationForCommand(gitCommand, remoteRepository.getAuthenticationType(),
			remoteRepository.getRemoteUsername(), remoteRepository.getRemotePassword(),
			remoteRepository.getRemoteToken(), remoteRepository.getRemotePrivateKey(), tempKey, decrypt);
	}

	public void setAuthenticationForCommand(TransportCommand<?, ?> gitCommand, AuthenticationType authenticationType,
						String username, String password, String token, String privateKey,
						Path tempKey, boolean decrypt)
		throws CryptoException, ServiceLayerException, IOException {
		String passwordValue = password;
		String tokenValue = token;
		String privateKeyValue = privateKey;
		if (decrypt) {
			if (!StringUtils.isEmpty(password)) {
				passwordValue = encryptor.decrypt(password);
			}
			if (!StringUtils.isEmpty(token)) {
				tokenValue = encryptor.decrypt(token);
			}
			if (!StringUtils.isEmpty(privateKey)) {
				privateKeyValue = encryptor.decrypt(privateKey);
			}
		}
		TypeBasedAuthConfiguratorBuilder builder = authConfiguratorFactory.forType(authenticationType);
		switch (authenticationType) {
			case AuthenticationType.none:
				logger.debug("No authentication");
				break;
			case AuthenticationType.basic:
				logger.debug("Basic authentication");
				builder
					.withUsername(username)
					.withPassword(passwordValue);
				break;
			case AuthenticationType.token:
				logger.debug("Token based authentication");
				builder
					.withUsername(tokenValue);
				break;
			case AuthenticationType.private_key:
				logger.debug("Private key authentication");
				Files.writeString(tempKey, privateKeyValue);
				tempKey.toFile().deleteOnExit();
				builder
					.withPrivateKeyPath(tempKey.toString());
				break;
			default:
				throw new ServiceLayerException("Unsupported authentication type " + authenticationType);
		}
		try {
			builder.build().configureAuthentication(gitCommand);
		} catch (IllegalStateException e) {
			throw new InvalidParametersException(format("Invalid authentication configuration: %s", e.getMessage()), e);
		}
	}

	public String getGitPath(String path) {
		if (isEmpty(path) || Strings.CI.equals(path, "/")) {
			path = ".";
		} else {
			path = FilenameUtils.normalize(path, true);
			path = StringUtils.stripStart(path, FILE_SEPARATOR);
			path = FilenameUtils.separatorsToUnix(path);
		}
		return path;
	}

	public String[] getGitPaths(String... paths) {
		if (ArrayUtils.isNotEmpty(paths)) {
			String[] gitPaths = new String[paths.length];
			for (int i = 0; i < paths.length; i++) {
				gitPaths[i] = getGitPath(paths[i]);
			}

			return gitPaths;
		} else {
			return new String[0];
		}
	}

	/**
	 * Return the author identity as a jgit PersonIdent
	 *
	 * @param user author
	 * @return author user as a PersonIdent
	 */
	public PersonIdent getAuthorIdent(User user) {
		PersonIdent currentUserIdent =
			new PersonIdent(format(USERNAME_FORMAT, user.getFirstName(), user.getLastName()), user.getEmail());

		return currentUserIdent;
	}

	public RevTree getTreeForCommit(Repository repository, String commitId) throws IOException {
		ObjectId commitObjectId = repository.resolve(commitId);
		return getTreeForCommit(repository, commitObjectId);
	}

	public RevTree getTreeForCommit(Repository repository, ObjectId commitId) throws IOException {
		try (RevWalk revWalk = new RevWalk(repository)) {
			RevCommit commit = revWalk.parseCommit(commitId);
			// and using commit's tree find the path
			return commit.getTree();
		}
	}

	public RevTree getTreeForLastCommit(Repository repository) throws IOException {
		ObjectId lastCommitId = repository.resolve(HEAD);
		return getTreeForCommit(repository, lastCommitId);
	}

	/**
	 * Creates a tree parser for a given commit
	 *
	 * @param repository the repository
	 * @param objectId   the commit id
	 * @return the tree parser
	 * @throws IOException if an error occurred while creating and configuring the tree parser
	 */
	private static AbstractTreeIterator prepareTreeParser(Repository repository, String objectId) throws IOException {
		// from the commit we can build the tree which allows us to construct the TreeParser
		try (RevWalk walk = new RevWalk(repository)) {
			RevCommit commit = walk.parseCommit(repository.resolve(objectId));
			RevTree tree = walk.parseTree(commit.getTree().getId());

			CanonicalTreeParser treeParser = new CanonicalTreeParser();
			try (ObjectReader reader = repository.newObjectReader()) {
				treeParser.reset(reader, tree.getId());
			}
			walk.dispose();
			return treeParser;
		}
	}

	/**
	 * Get the diff entry for a given commit and path.
	 * The result value corresponds to the diff found for the given path
	 * between the given commit and its (first) parent (or empty tree for initial commits).
	 *
	 * @param repository the repository
	 * @param commitId   the commit ID
	 * @param gitPath    the git path of the content item
	 * @return the diff entry
	 */
	public DiffEntry getDiffEntry(final Repository repository, final ObjectId commitId, final String gitPath)
		throws NoChangesForPathException, IOException, GitAPIException {
		RevWalk rw = new RevWalk(repository);
		try (Git git = new Git(repository)) {
			RevCommit commit = rw.parseCommit(commitId);

			// Diff the two commit Ids
			DiffCommand diffCommand = git.diff()
				.setOldTree(getParentCommitTreeParser(repository, commit))
				.setNewTree(prepareTreeParser(repository, commit.getName()))
				.setPathFilter(FollowFilter.create(gitPath, repository.getConfig().get(DiffConfig.KEY)));
			List<DiffEntry> diffEntries = retryingRepositoryOperationFacade.call(diffCommand);

			if (CollectionUtils.isEmpty(diffEntries)) {
				// With FollowFilter it does not return a DiffEntry for the first commit (ADD)
				// TODO: JM: Investigate if there is a better way to do this
				diffCommand = git.diff()
					.setOldTree(getParentCommitTreeParser(repository, commit))
					.setNewTree(prepareTreeParser(repository, commit.getName()))
					.setPathFilter(PathFilter.create(gitPath));
				diffEntries = retryingRepositoryOperationFacade.call(diffCommand);
			}
			if (CollectionUtils.isNotEmpty(diffEntries)) {
				return diffEntries.getFirst();
			}
			logger.debug("No diff entry found for path '{}' in commit '{}'", gitPath, commitId);
			throw new NoChangesForPathException(format("No diff entry found for path '%s' in commit '%s'", gitPath, commitId));
		} finally {
			rw.dispose();
		}
	}

	/**
	 * Get a tree parser for the parent of the given commit, or {@link EmptyTreeIterator} if the commit is initial.
	 *
	 * @param repository the repository
	 * @param commit     the commit
	 * @return the tree parser for the parent commit, or {@link EmptyTreeIterator} if the commit is initial
	 * @throws IOException if an error occurred while creating and configuring the tree parser
	 */
	private AbstractTreeIterator getParentCommitTreeParser(Repository repository, RevCommit commit) throws IOException {
		if (commit.getParentCount() > 0) {
			return prepareTreeParser(repository, commit.getParent(0).getId().getName());
		}
		return new EmptyTreeIterator();
	}

	/**
	 * Create a site sandbox git repository from scratch
	 *
	 * @param site          site to create
	 * @param sandboxBranch sandbox branch name
	 */
	public void createSandboxRepository(String site, String sandboxBranch) throws RepositoryException {
		// Build a path for the site/sandbox
		Path siteSandboxPath = buildRepoPath(GitRepositories.SANDBOX, site);

		// Create Sandbox
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, site);
		generalLockService.lock(gitLockKey);
		try {
			Repository sandboxRepo = createGitRepository(siteSandboxPath);

			if (sandboxRepo == null) {
				throw new RepositoryException(format("Failed to create the sandbox repository for site '%s'", site));
			}

			checkoutSandboxBranch(site, sandboxRepo, sandboxBranch);
			repositoryCache.put(getRepoCacheKey(site, SANDBOX), sandboxRepo);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Create a site published git repository from scratch
	 *
	 * @param siteId site to create
	 */
	public void createPublishedRepository(String siteId) throws GitAPIException, IOException {
		// Create Published by cloning Sandbox
		// Build a path for the site/sandbox
		Path siteSandboxPath = buildRepoPath(GitRepositories.SANDBOX, siteId);
		// Built a path for the site/published
		Path sitePublishedPath = buildRepoPath(GitRepositories.PUBLISHED, siteId);
		String gitLockKey = SITE_PUBLISHED_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try (Git publishedGit = Git.cloneRepository()
			.setBare(true)
			.setURI(sitePublishedPath.relativize(siteSandboxPath).toString())
			.setDirectory(sitePublishedPath.normalize().toAbsolutePath().toFile())
			.call()) {
			Repository publishedRepo = publishedGit.getRepository();
			optimizeRepository(publishedRepo);
			publishedRepo.close();
		} catch (GitAPIException | IOException e) {
			logger.error("Failed to add origin (sandbox) to the published repository in site '{}'", siteId, e);
			throw e;
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	public Repository createGitRepository(Path path) {
		Repository toReturn;
		path = Paths.get(path.toAbsolutePath().toString(), GIT_ROOT);
		try {
			toReturn = FileRepositoryBuilder.create(path.toFile());
			toReturn.create();

			optimizeRepository(toReturn);
			try (Git git = new Git(toReturn)) {
				CommitCommand commitCommand = git.commit()
					.setAllowEmpty(true)
					.setMessage(getCommitMessage(REPO_CREATE_REPOSITORY_COMMIT_MESSAGE));
				retryingRepositoryOperationFacade.call(commitCommand);
			} catch (GitAPIException e) {
				logger.error("Failed to create the repository for site with path '{}'", path, e);
				toReturn = null;
			}
		} catch (IOException e) {
			logger.error("Failed to create the repository for site with path '{}'", path, e);
			toReturn = null;
		}

		return toReturn;
	}

	private void optimizeRepository(Repository repo) throws IOException {
		// Get git configuration
		StoredConfig config = repo.getConfig();
		// Set compression level (core.compression)
		config.setInt(CONFIG_SECTION_CORE, null, CONFIG_PARAMETER_COMPRESSION,
			CONFIG_PARAMETER_COMPRESSION_DEFAULT);
		// Set big file threshold (core.bigFileThreshold)
		config.setString(CONFIG_SECTION_CORE, null, CONFIG_PARAMETER_BIG_FILE_THRESHOLD,
			CONFIG_PARAMETER_BIG_FILE_THRESHOLD_DEFAULT);
		// Set fileMode
		config.setBoolean(CONFIG_SECTION_CORE, null, CONFIG_PARAMETER_FILE_MODE,
			CONFIG_PARAMETER_FILE_MODE_DEFAULT);
		// Save configuration changes
		config.save();
	}

	/**
	 * Check if the git status command responds without errors.
	 * If the status check fails, it might be because the repository is corrupted.
	 *
	 * @param repo repository to check
	 * @return true if the status is OK, false otherwise
	 */
	public boolean gitStatusOk(Repository repo) {
		try {
			gitCli.isRepoClean(repo.getWorkTree());
			// OK if no exception is thrown
			return true;
		} catch (GitCliException e) {
			return false;
		}
	}

	/**
	 * Remove the .git/index file and reset and clean the repository:
	 * rm .git/index
	 * git reset --hard
	 * git clean -fd
	 *
	 * @param repoDir path to the repository
	 * @throws IOException if an error occurred while cleaning the repository
	 */
	public void removeIndexAndClean(File repoDir) throws IOException {
		GitUtils.deleteGitIndex(repoDir.getAbsolutePath());
		gitCli.resetHard(repoDir);
		gitCli.clean(repoDir, true, true);
	}

	public String getCommitMessage(String commitMessageKey) {
		String prologue = studioConfiguration.getProperty(REPO_COMMIT_MESSAGE_PROLOGUE);
		String postscript = studioConfiguration.getProperty(REPO_COMMIT_MESSAGE_POSTSCRIPT);
		String message = studioConfiguration.getProperty(commitMessageKey);

		StringBuilder sb = new StringBuilder();
		if (StringUtils.isNotEmpty(prologue)) {
			sb.append(prologue).append("\n\n");
		}
		sb.append(message);
		if (StringUtils.isNotEmpty(postscript)) {
			sb.append("\n\n").append(postscript);
		}
		return sb.toString();
	}

	private void checkoutSandboxBranch(String site, Repository sandboxRepo, String sandboxBranch) throws RepositoryException {
		String sandboxBranchName = sandboxBranch;
		if (StringUtils.isEmpty(sandboxBranchName)) {
			sandboxBranchName = studioConfiguration.getProperty(REPO_SANDBOX_BRANCH);
		}
		try (Git git = new Git(sandboxRepo)) {
			if (!CS.equals(sandboxRepo.getBranch(), sandboxBranchName)) {
				ListBranchCommand listBranchCommand = git.branchList();
				List<Ref> branchList = retryingRepositoryOperationFacade.call(listBranchCommand);
				boolean createBranch = true;
				for (Ref branch : branchList) {
					if (CS.equals(branch.getName(), sandboxBranchName) ||
						CS.equals(branch.getName(), Constants.R_HEADS + sandboxBranchName)) {
						createBranch = false;
						break;
					}
				}
				if (sandboxRepo.isBare() || sandboxRepo.resolve(Constants.HEAD) == null) {
					CommitCommand commitCommand = git.commit()
						.setAllowEmpty(true)
						.setMessage(getCommitMessage(REPO_CREATE_SANDBOX_BRANCH_COMMIT_MESSAGE)
							.replaceAll(PATTERN_SANDBOX, sandboxBranchName));
					retryingRepositoryOperationFacade.call(commitCommand);
				}
				CheckoutCommand checkoutCommand = git.checkout()
					.setCreateBranch(createBranch)
					.setName(sandboxBranchName)
					.setForceRefUpdate(true);
				retryingRepositoryOperationFacade.call(checkoutCommand);
			}
		} catch (GitAPIException | IOException e) {
			logger.error("Failed to checkout the sandbox branch '{}' in site '{}'", sandboxBranchName, site, e);
			throw new RepositoryException(format("Failed to checkout the sandbox branch '%s' in site '%s'", sandboxBranchName, site), e);
		}
	}

	public void copyContentFromBlueprint(String blueprintLocation, String site) throws RepositoryException {
		// Build a path to the Sandbox repo we'll be copying to
		Path siteRepoPath = buildRepoPath(GitRepositories.SANDBOX, site);
		// Build a path to the blueprint
		Path blueprintPath = Paths.get(blueprintLocation);
		EnumSet<FileVisitOption> opts = EnumSet.of(FileVisitOption.FOLLOW_LINKS);
		// Let's copy!
		TreeCopier tc = new TreeCopier(blueprintPath, siteRepoPath);
		try {
			Files.walkFileTree(blueprintPath, opts, Integer.MAX_VALUE, tc);
		} catch (IOException e) {
			throw new RepositoryException(format("Failed to copy the files from blueprint '%s' to site '%s'", blueprintLocation, site), e);
		}
	}

	/**
	 * Update the {siteName} variable in the site configuration files with the actual site name.
	 * It updates the general configuration file (site-config.xml), the permission mappings file and the role mappings file.
	 * @param site the site id
	 * @throws RepositoryException if there is an error while updating the configuration files
	 */
	public void updateSiteNameConfigVar(String site) throws RepositoryException {
		replaceSiteNameVariable(site,
				Paths.get(buildRepoPath(GitRepositories.SANDBOX, site).toAbsolutePath().toString(),
						studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH),
						studioConfiguration.getProperty(CONFIGURATION_SITE_GENERAL_CONFIG_FILE_NAME)));
		replaceSiteNameVariable(site,
				Paths.get(buildRepoPath(GitRepositories.SANDBOX, site).toAbsolutePath().toString(),
						studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH),
						studioConfiguration.getProperty(CONFIGURATION_SITE_PERMISSION_MAPPINGS_FILE_NAME)));
		replaceSiteNameVariable(site,
				Paths.get(buildRepoPath(GitRepositories.SANDBOX, site).toAbsolutePath().toString(),
						studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH),
						studioConfiguration.getProperty(CONFIGURATION_SITE_ROLE_MAPPINGS_FILE_NAME)));
	}

	protected void replaceSiteNameVariable(String site, Path path) throws RepositoryException {
		Charset charset = StandardCharsets.UTF_8;
		try {
			String content = Files.readString(path, charset);
			content = content.replaceAll(StudioConstants.CONFIG_SITENAME_VARIABLE, site);
			Files.writeString(path, content, charset);
		} catch (IOException e) {
			throw new RepositoryException(format("Failed to replace the _sitename_ variable inside the configuration file '%s' in site '%s'",
				path, site), e);
		}
	}

	/**
	 * Replace the parameters in the configuration files with the given values.
	 * @param siteId the site id
	 * @param parameters the parameters to replace, where the key is the parameter name and the value is the parameter value
	 * @throws RepositoryException if there is an error while replacing the parameters in the configuration files
	 */
	public void replaceParameters(String siteId, Map<String, String> parameters) throws RepositoryException {
		if (MapUtils.isEmpty(parameters)) {
			logger.debug("Skip parameter replacement in site '{}'", siteId);
			return;
		}
		String configRootPath = FilenameUtils.getPath(
				studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH));
		Path siteSandboxPath = buildRepoPath(GitRepositories.SANDBOX, siteId);
		Path configFolder = siteSandboxPath.resolve(configRootPath);
		try {
			Files.walkFileTree(configFolder, new StrSubstitutorVisitor(parameters));
		} catch (IOException e) {
			throw new RepositoryException(format("Failed to find parameters in the configuration files in site '%s'", siteId), e);
		}
	}

	public void addGitIgnoreFiles(String siteId) throws RepositoryException {
		List<HierarchicalConfiguration<ImmutableNode>> ignores = studioConfiguration.getSubConfigs(REPO_IGNORE_FILES);
		if (CollectionUtils.isEmpty(ignores)) {
			logger.debug("No ignore files will be added to site '{}'", siteId);
			return;
		}

		logger.debug("Add ignore files to site '{}'", siteId);
		Path siteSandboxPath = buildRepoPath(GitRepositories.SANDBOX, siteId);

		for (HierarchicalConfiguration<ImmutableNode> ignore : ignores) {
			String ignoreLocation = ignore.getString(CONFIG_KEY_RESOURCE);
			Resource ignoreFile = new ClassPathResource(ignoreLocation);
			if (!ignoreFile.exists()) {
				logger.warn("Failed to find ignore file at '{}' in site '{}'", ignoreLocation, siteId);
				continue;
			}

			String repoFolder = ignore.getString(CONFIG_KEY_FOLDER);
			Path actualFolder = StringUtils.isEmpty(repoFolder) ? siteSandboxPath : siteSandboxPath.resolve(repoFolder);
			if (!Files.exists(actualFolder)) {
				logger.debug("Repository doesn't contain a '{}' folder in site '{}'", repoFolder, siteId);
				continue;
			}

			Path actualFile = actualFolder.resolve(GitContentRepositoryConstants.IGNORE_FILE);
			if (!Files.exists(actualFile)) {
				logger.debug("Add a git ignore file at '{}' in site '{}'", repoFolder, siteId);
				try (InputStream in = ignoreFile.getInputStream()) {
					Files.copy(in, actualFile);
				} catch (IOException e) {
					throw new RepositoryException(format("Failed to write the git ignore file at '%s' in site '%s'", repoFolder, siteId), e);
				}
			} else {
				logger.debug("The repository already contains a git ignore file at '{}' in site '{}'", actualFolder, siteId);
			}
		}
	}

	/**
	 * Perform an initial commit after large changes to a site. Will not work against the global config repo.
	 *
	 * @param site          site identifier
	 * @param message       commit message
	 * @param sandboxBranch sandbox branch name
	 * @param creator       site creator
	 */
	public void performInitialCommit(String site, String message, String sandboxBranch, String creator) throws ServiceLayerException {
		Repository repo = getRepository(site, GitRepositories.SANDBOX, sandboxBranch);
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, site);
		generalLockService.lock(gitLockKey);
		try (Git git = new Git(repo)) {
			StatusCommand statusCommand = git.status();
			Status status = retryingRepositoryOperationFacade.call(statusCommand);
			if (status.hasUncommittedChanges() || !status.isClean()) {
				AddCommand addCommand = git.add().addFilepattern(GIT_COMMIT_ALL_ITEMS);
				retryingRepositoryOperationFacade.call(addCommand);
				CommitCommand commitCommand = git.commit()
						.setMessage(message);
				User user = userService.getUserByIdOrUsername(-1, creator);
				commitCommand = commitCommand.setAuthor(getAuthorIdent(user));
				retryingRepositoryOperationFacade.call(commitCommand);
			}
			checkoutSandboxBranch(site, repo, sandboxBranch);
		} catch (GitAPIException | UserNotFoundException e) {
			logger.error("Failed to create the initial commit for site '{}'", site, e);
			throw new ServiceLayerException(format("Failed to create the initial commit for site '%s'", site), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	@SuppressWarnings("ResultOfMethodCallIgnored")
	public void createSiteCloneRemoteGitRepo(String siteId, String remoteName,
						    String remoteUrl, String remoteBranch, boolean singleBranch,
						    AuthenticationType authenticationType, String remoteUsername, String remotePassword,
						    String remoteToken, String remotePrivateKey, boolean createAsOrphan,
						    String creator)
		throws InvalidRemoteRepositoryException, InvalidRemoteRepositoryCredentialsException,
		RemoteRepositoryNotFoundException, ServiceLayerException {

		// prepare a new folder for the cloned repository
		Path siteSandboxPath = buildRepoPath(SANDBOX, siteId);
		File localPath = siteSandboxPath.toFile();
		localPath.delete();
		logger.debug("Add the user credentials if provided to site '{}'", siteId);
		// then clone
		logger.debug("Clone site '{}' from '{}' to '{}'", siteId, remoteUrl, localPath);
		CloneCommand cloneCommand = Git.cloneRepository()
			.setURI(remoteUrl)
			.setDirectory(localPath)
			.setRemote(remoteName)
			.setBranchesToClone(singleBranch && remoteBranch != null ? List.of(getBranchRefName(remoteBranch)) : null)
			.setCloneAllBranches(!singleBranch);
		if (StringUtils.isNotEmpty(remoteBranch)) {
			cloneCommand.setBranch(remoteBranch);
		}
		Git cloneResult = null;
		String gitLockKey = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
		generalLockService.lock(gitLockKey);
		try {
			Path tempKey = Files.createTempFile(getStudioTemporaryFilesRoot(), UUID.randomUUID().toString(), TMP_FILE_SUFFIX);
			try {
				setAuthenticationForCommand(cloneCommand, authenticationType, remoteUsername, remotePassword,
					remoteToken, remotePrivateKey, tempKey, false);

				cloneResult = retryingRepositoryOperationFacade.call(cloneCommand);

				Repository sandboxRepo = checkIfCloneWasOk(cloneResult, remoteName, remoteUrl);

				optimizeRepository(sandboxRepo);

				// Make repository orphan if needed
				if (createAsOrphan) {
					makeRepoOrphan(sandboxRepo, siteId, creator);
				}

				repositoryCache.put(getRepoCacheKey(siteId, SANDBOX), sandboxRepo);
			} catch (InvalidRemoteException e) {
				logger.error("Invalid remote repository '{}' URL '{}' while creating site '{}'",
					remoteName, remoteUrl, siteId, e);
				throw new InvalidRemoteRepositoryException(format("Invalid remote repository '%s (%s)'",
					remoteName, remoteUrl));
			} catch (TransportException e) {
				GitUtils.translateException(e, logger, remoteName, remoteUrl);
			} finally {
				Files.deleteIfExists(tempKey);
			}
		} catch (GitAPIException | IOException | UserNotFoundException | CryptoException e) {
			throw new RepositoryException(format("Failed to create the repository for site '%s' with path '%s'", siteId, siteSandboxPath), e);
		} finally {
			generalLockService.unlock(gitLockKey);
			if (cloneResult != null) {
				cloneResult.close();
			}
		}
	}

	/**
	 * Checks if the clone was executed ok: mostly check for null references and
	 * if the clone folder was created as a folder and current user has RW permissions.
	 * <b> Never returns null</b>
	 *
	 * @param cloneResult Clone Result to check.
	 * @param remoteName  Name of the remote we clone.
	 * @param remoteUrl   Clone URL
	 * @return A {@link Repository} if all checks pass , never returns null.
	 * @throws InvalidRemoteRepositoryException If a check does not pass.
	 */
	private Repository checkIfCloneWasOk(Git cloneResult, String remoteName, String remoteUrl)
		throws InvalidRemoteRepositoryException {
		// Check if cloneResult is null , if so die.
		if (cloneResult == null) {
			String msg = format("Remote Clone Error '%s (%s)' cloneResult is null", remoteName, remoteUrl);
			logger.error(msg);
			throw new InvalidRemoteRepositoryException(msg);
		}
		Repository repository = cloneResult.getRepository();
		// Check if cloneResult is null , if so die.
		if (repository == null) {
			String msg = format("Remote Clone Error '%s (%s)' sandboxRepo is null", remoteName, remoteUrl);
			logger.error(msg);
			throw new InvalidRemoteRepositoryException(msg);
		}
		File repoDir = repository.getDirectory();
		// Check if  sandbox repo,: exists, is a dir, we can RW to it.
		if (!repoDir.exists() || !repoDir.isDirectory() || !repoDir.canRead() || !repoDir.canWrite()) {
			String msg = format("Remote Clone Error '%s' doesn't exist, is not a directory, " +
				"or we don't have write permissions", repository.getDirectory());
			logger.error(msg);
			throw new InvalidRemoteRepositoryException(msg);
		}
		return repository;
	}

	private void makeRepoOrphan(Repository repository, String site, String creator) throws IOException, GitAPIException,
		ServiceLayerException, UserNotFoundException {
		// TODO: SJ: This can be replaced with CGit to shallow clone and not have to do this

		logger.debug("Make the repository orphan for site '{}'", site);
		String sandboxBranchName = repository.getBranch();
		if (StringUtils.isEmpty(sandboxBranchName)) {
			sandboxBranchName = studioConfiguration.getProperty(REPO_SANDBOX_BRANCH);
		}
		String sandboxBranchOrphanName = sandboxBranchName + "_orphan";

		// Shallow clone is not implemented in JGit. Instead, we are creating new orphan branch after
		// cloning and renaming it to sandbox branch to replace fully cloned branch
		try (Git git = new Git(repository)) {
			logger.debug("Create a temporary orphan branch '{}' for site '{}'", sandboxBranchOrphanName, site);
			CheckoutCommand checkoutCommand = git.checkout()
				.setName(sandboxBranchOrphanName)
				.setStartPoint(sandboxBranchName)
				.setOrphan(true);
			retryingRepositoryOperationFacade.call(checkoutCommand);

			// Reset everything to simulate first commit as created empty repo
			logger.debug("Soft reset then commit empty repo for site '{}'", site);
			ResetCommand resetCommand = git.reset();
			retryingRepositoryOperationFacade.call(resetCommand);

			User user = userService.getUserByIdOrUsername(-1, creator);
			// Commit empty repo, because we need to have HEAD to delete old and rename new branch
			CommitCommand commitCommand = git.commit()
					.setMessage(getCommitMessage(REPO_CREATE_AS_ORPHAN_COMMIT_MESSAGE))
					.setAuthor(getAuthorIdent(user));
			retryingRepositoryOperationFacade.call(commitCommand);

			logger.debug("Delete cloned branch '{}' for site '{}' and clean up.", sandboxBranchName, site);
			DeleteBranchCommand deleteBranchCommand =
				git.branchDelete().setBranchNames(sandboxBranchName).setForce(true);
			retryingRepositoryOperationFacade.call(deleteBranchCommand);

			// Rename temporary orphan branch to sandbox branch
			RenameBranchCommand renameBranchCommand =
				git.branchRename().setNewName(sandboxBranchName).setOldName(sandboxBranchOrphanName);
			retryingRepositoryOperationFacade.call(renameBranchCommand);
		}
	}

	// --------------------------------------------------------------------------------------------
	// TODO: Refactor this because it is just copy from V1

	/**
	 * Build the global repository as part of system startup and caches it
	 *
	 * @return true if successful, false otherwise
	 * @throws IOException IO error
	 */
	// TODO: SJ: This should be redesigned to return the repository instead of setting it as a "side effect"
	public boolean buildGlobalRepo() throws IOException {
		boolean toReturn = false;
		Path siteRepoPath = getRepoGitDir(GLOBAL, EMPTY);

		if (Files.exists(siteRepoPath)) {
			Repository repo = openRepository(siteRepoPath);
			repositoryCache.put(getRepoCacheKey(EMPTY, GLOBAL), repo);
			toReturn = true;
		}

		return toReturn;
	}

	public boolean createGlobalRepo() {
		boolean toReturn = false;
		Path globalConfigRepoPath = getRepoGitDir(GLOBAL, EMPTY);
		String gitLockKey = GLOBAL_REPOSITORY_GIT_LOCK;
		generalLockService.lock(gitLockKey);
		try {
			if (!Files.exists(globalConfigRepoPath)) {
				// Git repository doesn't exist for global, but the folder might be present, let's delete if exists
				Path globalConfigPath = globalConfigRepoPath.getParent();

				// Create the global repository folder
				try {
					Files.deleteIfExists(globalConfigPath);
					logger.info("Bootstrap the global repository");
					Files.createDirectories(globalConfigPath);
					Repository repo = createGitRepository(globalConfigPath);
					repositoryCache.put(getRepoCacheKey(EMPTY, GLOBAL), repo);
					toReturn = true;
				} catch (IOException e) {
					// Something very wrong has happened
					logger.error("Failed to bootstrap the global repository", e);
				}
			} else {
				logger.info("Detected an existing global repository, will not create a new one");
				// unlock if global repository is locked
				String path = globalConfigRepoPath.getParent().toAbsolutePath().toString();
				if (GitUtils.isRepositoryLocked(path)) {
					try {
						GitUtils.unlock(path);
					} catch (IOException e) {
						logger.warn("Failed to unlock the git repository '{}'", path, e);
					}
				}
			}
		} finally {
			generalLockService.unlock(gitLockKey);
		}

		return toReturn;
	}

	public boolean deleteSiteGitRepo(String site) {
		boolean toReturn;

		// Get the Sandbox Path
		Path siteSandboxPath = buildRepoPath(GitRepositories.SANDBOX, site);
		// Get parent of that (since every site has two repos: Sandbox and Published)
		Path sitePath = siteSandboxPath.getParent();
		// Get a file handle to the parent and delete it
		File siteFolder = sitePath.toFile();

		String gitLockKeySandbox = SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, site);
		String gitLockKeyPublished = SITE_PUBLISHED_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, site);
		generalLockService.lock(gitLockKeySandbox);
		generalLockService.lock(gitLockKeyPublished);
		try {
			String sandboxCacheKey = getRepoCacheKey(site, SANDBOX);
			Repository sandboxRepo = repositoryCache.getIfPresent(sandboxCacheKey);
			if (sandboxRepo != null) {
				repositoryCache.invalidate(sandboxCacheKey);
				sandboxRepo.close();
			}
			String publishedCacheKey = getRepoCacheKey(site, PUBLISHED);
			Repository publishedRepo = repositoryCache.getIfPresent(publishedCacheKey);
			if (publishedRepo != null) {
				repositoryCache.invalidate(publishedCacheKey);
				publishedRepo.close();
			}
			FileUtils.deleteDirectory(siteFolder);

			toReturn = true;

			logger.debug("Deleted site '{}' at path '{}'", site, sitePath);
		} catch (IOException e) {
			logger.error("Failed to delete site '{}' at path '{}'", site, sitePath, e);
			toReturn = false;
		} finally {
			generalLockService.unlock(gitLockKeyPublished);
			generalLockService.unlock(gitLockKeySandbox);
		}

		return toReturn;
	}

	/**
	 * Write a file to the site SANDBOX git repository (or GLOBAL if site is empty)
	 *
	 * @param repo    the repository
	 * @param site    the site id
	 * @param path    the path to write the file to
	 * @param content the content of the file as an InputStream
	 * @throws ServiceLayerException if there is an error while trying to write the file
	 * @throws IOException           if there is an error while trying to write the file
	 */
	@SuppressWarnings("ResultOfMethodCallIgnored")
	public void writeFile(Repository repo, String site, String path, InputStream content)
			throws ServiceLayerException, IOException {
		logger.debug("Write a file at site '{}' path '{}'", site, path);
		try {
			// Create basic file
			File file = new File(repo.getDirectory().getParent(), path);

			// Create parent folders
			File folder = file.getParentFile();
			if (folder != null) {
				if (!folder.exists()) {
					folder.mkdirs();
				}
			}

			// Create the file if it doesn't exist already
			if (!file.exists() && !file.createNewFile()) {
				logger.error("Failed to create a file in site '{}' path '{}'", site, path);
				throw new ServiceLayerException(format("Failed to create a file in site '%s' path '%s'", site, path));
			}

			logger.debug("Write a file to site '{}' path '{}'", site, path);

			// Write the bits
			try (content; FileOutputStream fos = new FileOutputStream(file.getPath()); FileChannel outChannel = fos.getChannel()) {
				logger.trace("Created the file output channel for site '{}' path '{}'", site, path);
				ReadableByteChannel inChannel = Channels.newChannel(content);
				logger.trace("Created the file input channel for site '{}' path '{}'", site, path);
				long amount = 1024 * 1024; // 1MB at a time
				long count;
				long offset = 0;
				while ((count = outChannel.transferFrom(inChannel, offset, amount)) > 0) {
					offset += count;
				}
			}

			addFiles(repo, site, path);
		} catch (IOException e) {
			logger.error("Failed to write the file to site '{}' path '{}'", site, path, e);
			throw e;
		}
	}

	/**
	 * git-add files to a repository
	 *
	 * @param repo  the repository
	 * @param site  the site id
	 * @param paths the paths to add
	 * @throws ServiceLayerException if there is an error while trying to add the files
	 */
	public void addFiles(Repository repo, String site, String... paths) throws ServiceLayerException {
		if (ArrayUtils.isEmpty(paths)) {
			logger.debug("No files to add to git in site '{}'", site);
			return;
		}
		if (logger.isDebugEnabled()) {
			logger.debug("Add files to git in site '{}' paths '{}' using Git CLI", site, ArrayUtils.toString(paths));
		}

		String gitLockKey = getSandboxRepoLockKey(site);
		generalLockService.lock(gitLockKey);
		try {
			retryingRepositoryOperationFacade.call((Callable<Void>) () -> {
				gitCli.add(repo.getWorkTree(), getGitPaths(paths));
				return null;
			});
		} catch (Exception e) {
			logger.error("Failed to add files to git in site '{}' paths '{}'",
					site, ArrayUtils.toString(paths), e);
			throw new ServiceLayerException(format("Failed to add files to git in site '%s' paths '%s'", site, ArrayUtils.toString(paths)), e);
		} finally {
			generalLockService.unlock(gitLockKey);
		}
	}

	/**
	 * Commit files to a site SANDBOX git repository (or GLOBAL if site is empty)
	 *
	 * @param repo    the repository
	 * @param site    the site
	 * @param comment the commit message
	 * @param user    author of the commit
	 * @param paths   the paths to commit
	 * @return commit id
	 *
	 * @throws ServiceLayerException general service exception
	 */
	public String commitFiles(Repository repo, String site, String comment, PersonIdent user, String... paths)
			throws ServiceLayerException {
		if (ArrayUtils.isEmpty(paths)) {
			return null;
		}
		if (logger.isDebugEnabled()) {
			logger.debug("Commit files to git in site '{}' paths '{}' using Git CLI", site, ArrayUtils.toString(paths));
		}

		String gitLockKey = getSandboxRepoLockKey(site, true);
		generalLockService.lock(gitLockKey);
		String commitId = null;
		try {
			String author = user.getName() + " <" + user.getEmailAddress() + ">";

			commitId = retryingRepositoryOperationFacade.call(
				() -> gitCli.commit(repo.getWorkTree(),
					author, comment, getGitPaths(paths)));
			// Check if commit id matches jgit
			ObjectId jgitHead = repo.resolve(HEAD);
			String jgitHeadCommitId = jgitHead != null ? jgitHead.getName() : null;
			if (CS.equals(jgitHeadCommitId, commitId)) {
				logger.debug("JGit HEAD '{}' matches CGit's '{}', will not rebuild JGit repository", jgitHeadCommitId, commitId);
			} else {
				logger.warn("JGit HEAD '{}' does not match CGit's '{}', will rebuild JGit repository", jgitHeadCommitId, commitId);
				reloadSiteSandboxRepository(site);
			}
		} catch (Exception e) {
			Throwable cause = ExceptionUtils.getRootCause(e);
			if (cause instanceof NoChangesToCommitException) {
				// we should ignore empty commit errors
				logger.debug("No changes were committed to git in site '{}' paths '{}'", site,
					ArrayUtils.toString(paths));
			} else {
				restorePaths(repo, site, paths);
				logger.error("Failed to commit files to git in site '{}' paths '{}'", site,
					ArrayUtils.toString(paths), cause);
				if (cause instanceof CommitterIdentityUnknownException) {
					throw new ServiceLayerException(GIT_COMMITTER_IDENTITY_UNKNOWN_MESSAGE, e.getCause());
				}
				throw new ServiceLayerException(format("Failed to commit files to git in site '%s' paths '%s'",
					site, ArrayUtils.toString(paths)), e);
			}
		} finally {
			generalLockService.unlock(gitLockKey);
		}

		return commitId;
	}

	/**
	 * Perform git garbage collection
	 * @param siteId site identifier
	 * @param gitRepository git repository type
	 */
	public void performGitGarbageCollection(String siteId, GitRepositories gitRepository) throws RepositoryException {
		Repository repo = getRepository(siteId, gitRepository);
		if (repo == null) {
			logger.info("Skip git gc for site '{}' repository '{}' as the repository is not found.", siteId, gitRepository);
			return;
		}

		String siteDescription = isEmpty(siteId) ? "global site" : format("site '%s' git repository '%s'", siteId, gitRepository);
		logger.debug("Start git gc for {} using CGit", siteDescription);
		try {
			retryingRepositoryOperationFacade.call((Callable<Void>) () -> {
				gitCli.gc(repo.getDirectory());
				return null;
			});
			logger.debug("Completed git gc for {} using CGit", siteDescription);
		} catch (Exception e) {
			logger.error("Failed to garbage collect the git repository in {}", siteDescription, e);
		}
	}

	/**
	 * Refresh the repository cache for the given site and repository type. <br/>
	 * <strong>Note:</strong> consumers of this method should use generalLockService to prevent concurrent access to the repository
	 *
	 * @param site the site id, or empty for global
	 */
	private void reloadSiteSandboxRepository(final String site) throws RepositoryException {
		String cacheKey;
		GitRepositories repoType = SANDBOX;
		if (isEmpty(site)) {
			repoType = GLOBAL;
		}
		cacheKey = getRepoCacheKey(site, repoType);

		logger.debug("Remove repository '{}' from cache", cacheKey);
		Repository repo = repositoryCache.getIfPresent(cacheKey);
		if (repo != null) {
			repositoryCache.invalidate(cacheKey);
			repo.close();
		}
		logger.debug("Reload repository '{}' so it gets added", cacheKey);
		getRepository(site, repoType);
	}

	/**
	 * Remove the given paths from the index and discard changes
	 *
	 * @param repo  the repository
	 * @param site  the site
	 * @param paths the paths
	 */
	private void restorePaths(Repository repo, String site, String... paths) {
		try {
			gitCli.restore(repo.getWorkTree(), getGitPaths(paths));
		} catch (GitCliException e) {
			logger.error("Failed to restore files in site '{}' paths '{}'", site, ArrayUtils.toString(paths), e);
		}
	}

	/**
	 * Return the current user identity as a jgit PersonIdent
	 *
	 * @return current user as a PersonIdent
	 * @throws ServiceLayerException general service error
	 * @throws UserNotFoundException user not found
	 */
	public PersonIdent getCurrentUserIdent() throws ServiceLayerException, UserNotFoundException {
		return getAuthorIdent(SecurityUtils.getCurrentUsername());
	}

	/**
	 * Return the author identity as a jgit PersonIdent
	 *
	 * @param author author
	 * @return author user as a PersonIdent
	 * @throws ServiceLayerException general service error
	 * @throws UserNotFoundException user not found error
	 */
	public PersonIdent getAuthorIdent(String author) throws ServiceLayerException, UserNotFoundException {
		User user = userService.getUserByIdOrUsername(-1, author);
		PersonIdent currentUserIdent =
			new PersonIdent(format(USERNAME_FORMAT, user.getFirstName(), user.getLastName()), user.getEmail());

		return currentUserIdent;
	}

	// TODO: AV - we should use this methods everywhere

	/**
	 * Returns the key to use when locking Git operations for a site's sandbox repo
	 *
	 * @param site the site name
	 * @return the lock key to use with the lock service
	 */
	public String getSandboxRepoLockKey(String site) {
		return SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, site);
	}

	/**
	 * Returns the key to use when locking Git operations for a site's sandbox or global repo
	 *
	 * @param site                            the site name
	 * @param ifSiteEmptyUseGlobalRepoLockKey `true` to use global repo lock key if site empty
	 * @return the lock key to use with the lock service
	 */
	public String getSandboxRepoLockKey(String site, boolean ifSiteEmptyUseGlobalRepoLockKey) {
		if (ifSiteEmptyUseGlobalRepoLockKey && StringUtils.isEmpty(site)) {
			return GLOBAL_REPOSITORY_GIT_LOCK;
		}
		return getSandboxRepoLockKey(site);
	}

	/**
	 * Returns the key to use when locking Git operations for a site's published repo
	 *
	 * @param site the site name
	 * @return the lock key to use with the lock service
	 */
	public String getPublishedRepoLockKey(String site) {
		return SITE_PUBLISHED_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, site);
	}

	public void setStudioConfiguration(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	@SuppressWarnings("unused")
	public void setEncryptor(TextEncryptor encryptor) {
		this.encryptor = encryptor;
	}

	public void setUserService(final UserService userService) {
		this.userService = userService;
	}

	public void setGeneralLockService(GeneralLockService generalLockService) {
		this.generalLockService = generalLockService;
	}

	public void setRetryingRepositoryOperationFacade(RetryingRepositoryOperationFacade retryingRepositoryOperationFacade) {
		this.retryingRepositoryOperationFacade = retryingRepositoryOperationFacade;
	}

	@SuppressWarnings("unused")
	public void setAuthConfiguratorFactory(AuthConfiguratorFactory authConfiguratorFactory) {
		this.authConfiguratorFactory = authConfiguratorFactory;
	}

	@SuppressWarnings("unused")
	public void setGitCli(GitCli gitCli) {
		this.gitCli = gitCli;
	}

	/**
	 * Create a branch
	 *
	 * @param repository   the repository
	 * @param site         the site
	 * @param sourceBranch starting point of the branch to create
	 * @param targetBranch the branch to create
	 * @throws RepositoryException if an error occurs
	 */
	public void createBranch(Repository repository, String site, String sourceBranch, String targetBranch)
			throws RepositoryException {
		try {
			gitCli.updateRef(repository.getDirectory(), getBranchRefName(sourceBranch), getBranchRefName(targetBranch));
		} catch (IOException e) {
			logger.error("Failed to create branch in site '{}' source branch '{}' target branch '{}'", site,
					sourceBranch, targetBranch, e);
			throw new RepositoryException(
					format("Failed to create branch in site '%s' source branch '%s' target branch '%s'", site,
							sourceBranch, targetBranch),
					e);
		}
	}

	/**
	 * Commit a tree to the repository.
	 * Since git-commit-tree does not accept an author parameter,
	 * this method will configure the user and email in the repository local configuration
	 * before committing the tree.
	 *
	 * @param repo           the git repository
	 * @param treeId         the id of the tree to commit
	 * @param parentCommitId the parent commit id
	 * @param user           the user to be configured as commit author
	 * @param comment        the commit message
	 * @return the commit id
	 * @throws IOException if an error occurs while commiting the tree or saving the configuration
	 */
	public String commitTree(final Repository repo, final String treeId,
				 final ObjectId parentCommitId, User user, final String comment) throws IOException {
		// Git commit-tree does not have an author param
		repo.getConfig().setString(GIT_CONFIG_SECTION_USER, null, GIT_CONFIG_PROPERTY_NAME,
			format(USERNAME_FORMAT, user.getFirstName(), user.getLastName()));
		repo.getConfig().setString(GIT_CONFIG_SECTION_USER, null, GIT_CONFIG_PROPERTY_EMAIL, user.getEmail());
		repo.getConfig().save();
		return gitCli.commitTree(repo.getDirectory(), treeId, parentCommitId, comment);
	}

	/**
	 * Write a tree to the repository
	 *
	 * @param repo           the repository
	 * @param paths          the paths to update
	 * @param deletedPaths   the paths to delete from the tree
	 * @param commitId       the commit id to get the new file versions from
	 * @param parentCommitId the commit to read the initial tree from
	 * @param taskProgress   the task progress to report progress to
	 * @return the new tree id
	 * @throws IOException          if an error occurs while writing the tree
	 * @throws InterruptedException if the operation is interrupted while waiting for the git process to finish
	 */
	public String writeTree(final Repository repo, final List<String> paths, List<String> deletedPaths,
							final String commitId, final ObjectId parentCommitId, TaskProgress<?, ?> taskProgress) throws IOException, InterruptedException {
		List<String> blacklist = studioConfiguration.getList(CONFIGURATION_PUBLISHING_BLACKLIST_PATHSPECS, String.class);
		blacklist.add(ALL_DOT_KEEP_PATTERN);
		return gitCli.writeTree(repo.getDirectory(), paths, deletedPaths,
			blacklist, commitId, parentCommitId, taskProgress);
	}

	/**
	 * Get a string like "refs/remotes/REMOTE/BRANCH_NAME" for a remote branch
	 *
	 * @param remoteName the remote name
	 * @param branchName the branch name
	 * @return the remote branch ref name
	 */
	public String getRemoteBranchRefName(final String remoteName, final String branchName) {
		return format(REMOTE_BRANCH_REF_NAME_FORMAT, remoteName, branchName);
	}

	/**
	 * Get a string like "refs/heads/BRANCH_NAME" for a local branch
	 *
	 * @param branchName the branch name
	 * @return the local branch ref name
	 */
	public String getBranchRefName(final String branchName) {
		return format(REFS_HEADS_FORMAT, branchName);
	}

	/**
	 * Check if the repository is bare
	 *
	 * @param siteId the site id
	 * @return true if the published repository is bare, false otherwise
	 * @throws RepositoryException
	 */
	public boolean isPublishedRepositoryBare(String siteId) throws RepositoryException {
		try {
			return getRepository(siteId, PUBLISHED)
					.getConfig().getBoolean(CONFIG_KEY_CORE, null, CONFIG_KEY_BARE, false);
		} catch (Exception e) {
			logger.error("Error checking if published repository for site '{}' is a bare repository", siteId, e);
			throw new RepositoryException(
					format("Error checking if published repository for site '%s' is a bare repository", siteId), e);
		}
	}

	/**
	 * Set the repository to be bare
	 *
	 * @param siteId the site id
	 * @throws IOException if an error occurs while setting the repository to be
	 *                     bare
	 */
	public void setBareRepository(String siteId) throws IOException {
		Path repositoryPath = buildRepoPath(PUBLISHED, siteId);
		String publishedCacheKey = getRepoCacheKey(siteId, PUBLISHED);
		Repository repository = repositoryCache.getIfPresent(publishedCacheKey);
		if (repository != null) {
			repository.close();
		}
		repositoryCache.invalidate(publishedCacheKey);
		gitCli.setBareRepository(repositoryPath.toFile());
	}
}
