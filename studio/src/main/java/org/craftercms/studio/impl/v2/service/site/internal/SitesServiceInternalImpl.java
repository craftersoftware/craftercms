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

package org.craftercms.studio.impl.v2.service.site.internal;

import java.beans.ConstructorProperties;
import java.io.FileReader;
import java.io.IOException;
import static java.lang.String.format;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.lang3.StringUtils;
import static org.apache.commons.lang3.StringUtils.EMPTY;
import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import org.craftercms.commons.entitlements.exception.EntitlementException;
import org.craftercms.commons.entitlements.model.EntitlementType;
import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import org.craftercms.commons.plugin.PluginDescriptorReader;
import org.craftercms.commons.plugin.exception.PluginException;
import org.craftercms.commons.plugin.model.PluginDescriptor;
import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v1.constant.StudioConstants;
import static org.craftercms.studio.api.v1.constant.StudioConstants.MODULE_STUDIO;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_UUID_FILENAME;
import org.craftercms.studio.api.v1.exception.BlueprintNotFoundException;
import org.craftercms.studio.api.v1.exception.DeployerTargetException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteAlreadyExistsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.content.ContentMonitor;
import org.craftercms.studio.api.v2.dal.AuditLog;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_CREATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_DELETE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_DUPLICATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_START_DELETE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_START_PUBLISHER;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_STOP_PUBLISHER;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_BLUEPRINT;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_REMOTE_REPOSITORY;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_SITE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_SOURCE_SITE;
import org.craftercms.studio.api.v2.dal.AuditLogParameter;
import org.craftercms.studio.api.v2.dal.PublishStatus;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import static org.craftercms.studio.api.v2.dal.Site.State.LOCKED;
import static org.craftercms.studio.api.v2.dal.Site.State.READY;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.dal.publish.ItemTargetDAO;
import org.craftercms.studio.api.v2.deployment.Deployer;
import org.craftercms.studio.api.v2.event.site.SiteDeletedEvent;
import org.craftercms.studio.api.v2.event.site.SiteDeletingEvent;
import org.craftercms.studio.api.v2.event.site.SiteReadyEvent;
import org.craftercms.studio.api.v2.exception.CompositeException;
import org.craftercms.studio.api.v2.exception.InvalidSiteStateException;
import org.craftercms.studio.api.v2.exception.StagingAlreadyEnabledException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.repository.RepositoryItem;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStore;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStoreResolver;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.task.TaskManager;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.api.v2.upgrade.StudioUpgradeManager;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.BLOB_STORES_CONFIG_PATH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.BLOB_STORES_SERVERLESS_DEFAULT_CONFIG_PATH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.BLUE_PRINTS_PATH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_ENVIRONMENT_ACTIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_SYSTEM_SITE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_PREVIEW_DESTROY_CONTEXT_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.GLOBAL_REPO_PATH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_BASE_PATH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_BLUEPRINTS_DESCRIPTOR_FILENAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_DEFAULT_REMOTE_NAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_SANDBOX_BRANCH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_ENABLED;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SITES_REPOS_PATH;
import org.craftercms.studio.api.v2.utils.spring.context.SiteBootstrapStateProvider;
import static org.craftercms.studio.impl.v2.utils.PluginUtils.validatePluginParameters;
import static org.craftercms.studio.impl.v2.utils.db.DBUtils.runAfterCommit;
import static org.craftercms.studio.impl.v2.utils.db.DBUtils.runAfterRollback;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUsername;
import org.craftercms.studio.model.rest.sites.CreateSiteRequest;
import org.craftercms.studio.model.rest.sites.CreateSiteRequest.BlueprintSource;
import org.craftercms.studio.model.rest.sites.CreateSiteRequest.RemoteSource;
import org.craftercms.studio.model.site.AllSitesMonitors;
import org.craftercms.studio.model.site.SiteDetails;
import org.craftercms.studio.model.site.SiteMonitor;
import org.craftercms.studio.model.task.PublishTask;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;

public class SitesServiceInternalImpl implements SitesService, ApplicationContextAware {

	private final static Logger logger = LoggerFactory.getLogger(SitesServiceInternalImpl.class);
	// This will become remoteName:remoteBranch
	private static final String REMOTE_REPOSITORY_AUDIT_FORMAT = "%s/%s";

	private final PluginDescriptorReader descriptorReader;
	private StudioBlobAwareContentRepository blobAwareRepository;
	private final StudioConfiguration studioConfiguration;
	private final SiteDAO siteDao;
	private final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private final Deployer deployer;
	private ConfigurationService configurationService;
	private final AuditService auditService;
	private final TaskManager taskManager;
	private final EntitlementValidator entitlementValidator;
	private final UserService userService;

	private StudioUpgradeManager upgradeManager;
	private StudioBlobStoreResolver blobStoreResolver;
	private ContentService contentService;
	private ContentMonitor contentMonitor;
	private final SiteBootstrapStateProvider siteBootstrapStateProvider;
	private ApplicationContext applicationContext;
	private ServicesConfig servicesConfig;
	private ItemTargetDAO itemTargetDao;
	private GeneralLockService generalLockService;
	private GitRepositoryHelper gitRepositoryHelper;

	@ConstructorProperties({"descriptorReader",
			"studioConfiguration", "siteDao",
			"retryingDatabaseOperationFacade",
			"deployer",
			"auditService", "taskManager",
			"entitlementValidator", "userService",
			"siteBootstrapStateProvider"})
	public SitesServiceInternalImpl(PluginDescriptorReader descriptorReader,
									StudioConfiguration studioConfiguration, SiteDAO siteDao,
									RetryingDatabaseOperationFacade retryingDatabaseOperationFacade,
									Deployer deployer,
									AuditService auditService, TaskManager taskManager,
									EntitlementValidator entitlementValidator, UserService userService,
									SiteBootstrapStateProvider siteBootstrapStateProvider) {
		this.descriptorReader = descriptorReader;
		this.studioConfiguration = studioConfiguration;
		this.siteDao = siteDao;
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
		this.deployer = deployer;
		this.auditService = auditService;
		this.taskManager = taskManager;
		this.entitlementValidator = entitlementValidator;
		this.userService = userService;
		this.siteBootstrapStateProvider = siteBootstrapStateProvider;
	}

	@Override
	public List<PluginDescriptor> getAvailableBlueprints() throws ServiceLayerException {
		Collection<RepositoryItem> blueprintsFolders = getBlueprintsFolders();
		List<PluginDescriptor> toRet = new ArrayList<>();
		for (RepositoryItem folder : blueprintsFolders) {
			if (folder.isFolder()) {
				PluginDescriptor descriptor = loadDescriptor(folder);
				if (descriptor != null) {
					toRet.add(descriptor);
				}
			}
		}
		return toRet;
	}

	@Override
	public PluginDescriptor getBlueprintDescriptor(final String id) throws ServiceLayerException {
		Collection<RepositoryItem> blueprintsFolders = getBlueprintsFolders();
		for (RepositoryItem folder : blueprintsFolders) {
			if (folder.isFolder()) {
				PluginDescriptor descriptor = loadDescriptor(folder);
				if (descriptor != null && descriptor.getPlugin().getId().equals(id)) {
					return descriptor;
				}
			}
		}
		return null;
	}

	@Override
	public String getBlueprintLocation(String blueprintId) throws ServiceLayerException {
		Collection<RepositoryItem> blueprintsFolders = getBlueprintsFolders();
		for (RepositoryItem folder : blueprintsFolders) {
			if (folder.isFolder()) {
				Path descriptorPath = getBlueprintPath(folder);
				PluginDescriptor descriptor = loadDescriptor(folder);
				if (descriptor != null && descriptor.getPlugin().getId().equals(blueprintId)) {
					return descriptorPath.getParent().toAbsolutePath().toString();
				}
			}
		}

		return StringUtils.EMPTY;
	}

	protected Collection<RepositoryItem> getBlueprintsFolders() throws ServiceLayerException {
		return blobAwareRepository.getContentChildren(
			StringUtils.EMPTY, studioConfiguration.getProperty(BLUE_PRINTS_PATH));
	}

	protected Path getBlueprintPath(RepositoryItem folder) {
		return Paths.get(studioConfiguration.getProperty(StudioConfiguration.REPO_BASE_PATH),
			studioConfiguration.getProperty(GLOBAL_REPO_PATH), folder.path(), folder.name(),
			studioConfiguration.getProperty(REPO_BLUEPRINTS_DESCRIPTOR_FILENAME)).toAbsolutePath();
	}

	protected PluginDescriptor loadDescriptor(RepositoryItem folder) {
		Path descriptorPath = getBlueprintPath(folder);
		if (Files.exists(descriptorPath)) {
			try (FileReader reader = new FileReader(descriptorPath.toString())) {
				return descriptorReader.read(reader);
			} catch (PluginException | IOException e) {
				logger.error("Failed to load descriptor from blueprint '{}'", folder.name(), e);
			}
		}
		return null;
	}

	@Override
	public void updateSite(String siteId, String name, String description)
		throws SiteNotFoundException, SiteAlreadyExistsException {
		if (isNotEmpty(name) && siteDao.isNameUsed(siteId, name)) {
			throw new SiteAlreadyExistsException("A site with name " + name + " already exists");
		}
		int updated = retryingDatabaseOperationFacade.retry(() -> siteDao.updateSite(siteId, name, description));
		if (updated != 1) {
			throw new SiteNotFoundException();
		}
	}

	@Override
	public void unlockSite(String siteId) {
		retryingDatabaseOperationFacade.retry(() -> siteDao.setSiteState(siteId, READY));
	}

	@Override
	public boolean exists(String siteId) {
		return siteDao.exists(siteId);
	}

	@Override
	public void deleteSite(final String siteId) throws ServiceLayerException {
		logger.info("Delete site '{}'", siteId);
		Site site = siteDao.getSite(siteId);

		List<Exception> exceptions = new ArrayList<>();
		startSiteDelete(site, exceptions);

		logger.debug("Unmark site '{}' as ready in bootstrap state provider", siteId);
		unmarkSiteAsReadyInBootstrapState(siteId, exceptions);

		logger.debug("Delete deployer targets for site '{}'", siteId);
		deleteDeployerTargets(siteId, exceptions);

		logger.debug("Delete site content repository for site '{}'", siteId);
		deleteSiteRepositories(siteId, exceptions);

		logger.debug("Clear configuration cache for site '{}'", siteId);
		clearConfigurationCache(siteId, exceptions);

		logger.debug("Delete database records for site '{}'", siteId);
		deleteSiteRelatedDBItems(siteId, exceptions);

		// Don't update site record if there are any exceptions
		if (exceptions.isEmpty()) {
			completeSiteDelete(site, exceptions);
		}
		if (!exceptions.isEmpty()) {
			throw new CompositeException(format("Failed to delete site '%s'", siteId), exceptions);
		}
	}

	/**
	 * Utility method to try a block of code, and then add to a list of exceptions if an exception is thrown during the execution
	 *
	 * @param operation          {@link Runnable} to execute
	 * @param errorMessageFormat error message format, to be used with {@link String#format(String, Object...)} and siteId parameter
	 * @param siteId             siteId to use in the error message
	 * @param exceptions         list of exceptions to add to if an exception is thrown
	 */
	private void tryOperation(Runnable operation, String errorMessageFormat, String siteId, List<Exception> exceptions) {
		try {
			operation.run();
		} catch (Exception e) {
			logger.error(format(errorMessageFormat, siteId), e);
			exceptions.add(new ServiceLayerException(format(errorMessageFormat, siteId), e));
		}
	}

	/**
	 * Mark the site as DELETED, insert audit log and publish site delete event
	 *
	 * @param site       site to delete
	 * @param exceptions if an exception is thrown, a new {@link ServiceLayerException} wrapping it will be added to this list
	 */
	private void completeSiteDelete(final Site site, final List<Exception> exceptions) {
		if (site == null) {
			return;
		}
		String siteId = site.getSiteId();
		tryOperation(() -> {
			logger.debug("Mark the site '{}' as DELETED", siteId);
			retryingDatabaseOperationFacade.retry(() -> siteDao.completeSiteDelete(siteId));
			insertDeleteSiteAuditLog(siteId, site.getName(), OPERATION_DELETE);
			logger.info("Site '{}' deleted", siteId);
			applicationContext.publishEvent(new SiteDeletedEvent(siteId, site.getSiteUuid()));
		}, "Failed to complete the site '%s' deletion", siteId, exceptions);
	}

	@Override
	public void checkSiteState(final String siteId, final String requiredState) throws InvalidSiteStateException, SiteNotFoundException {
		Site site = siteDao.getSite(siteId);
		if (site == null) {
			throw new SiteNotFoundException(format("Site '%s' not found.", siteId));
		}
		if (!requiredState.equals(site.getState())) {
			throw new InvalidSiteStateException(siteId, format("Site '%s' state ('%s') is not the required value: '%s'",
				siteId, site.getState(), requiredState));
		}
	}

	@Override
	public Site getSite(String siteId) {
		Site site = siteDao.getSite(siteId);
		checkBootstrappingState(site);
		return site;
	}

	@Override
	public SiteDetails getSiteDetails(String siteId) throws ServiceLayerException {
		Site site = getSite(siteId);
		checkBootstrappingState(site);
		List<StudioBlobStore> blobStores = blobStoreResolver.getAll(siteId);
		return new SiteDetails(site, blobStores);
	}

	@Override
	public void updateLastCommitId(String siteId, String commitId) {
		retryingDatabaseOperationFacade.retry(() -> siteDao.updateLastCommitId(siteId, commitId));
	}

	@Override
	public String getLastCommitId(String siteId) {
		return siteDao.getLastCommitId(siteId);
	}

	@Override
	public boolean checkSiteUuid(final String siteId, final String siteUuid) {
		try {
			Path path = Paths.get(studioConfiguration.getProperty(REPO_BASE_PATH),
				studioConfiguration.getProperty(SITES_REPOS_PATH), siteId, SITE_UUID_FILENAME);
			return Files.readAllLines(path).stream()
				.anyMatch(siteUuid::equals);
		} catch (IOException e) {
			logger.info("Invalid site UUID in site '{}'", siteId);
			return false;
		}
	}

	/**
	 * Delete the site-related db records. e.g.: dependencies, items, publish_request, etc.
	 *
	 * @param siteId     site id
	 * @param exceptions if an exception is thrown, a new {@link ServiceLayerException} wrapping it will be added to this list
	 */
	private void deleteSiteRelatedDBItems(final String siteId, final List<Exception> exceptions) {
		tryOperation(() -> siteDao.deleteSiteRelatedItems(siteId), "Failed to delete the database records for site '%s'", siteId, exceptions);
	}

	/**
	 * Invalidate the configuration cache for the site
	 *
	 * @param siteId     site id
	 * @param exceptions if an exception is thrown, a new {@link ServiceLayerException} wrapping it will be added to this list
	 */
	private void clearConfigurationCache(String siteId, List<Exception> exceptions) {
		tryOperation(() -> configurationService.invalidateConfiguration(siteId),
			"Failed to clear configuration cache for site '%s'", siteId, exceptions);
	}

	/**
	 * Delete the site content repositories
	 *
	 * @param siteId     site id
	 * @param exceptions if an exception is thrown, a new {@link ServiceLayerException} wrapping it will be added to this list
	 */
	private void deleteSiteRepositories(String siteId, List<Exception> exceptions) {
		tryOperation(() -> blobAwareRepository.deleteSite(siteId), "Failed to delete site content repository for site '%s'", siteId, exceptions);
	}

	/**
	 * Unmark the site as ready in the bootstrap state provider
	 *
	 * @param siteId     site id
	 * @param exceptions if an exception is thrown, a new {@link ServiceLayerException} wrapping it will be added to this list
	 */
	private void unmarkSiteAsReadyInBootstrapState(final String siteId, final List<Exception> exceptions) {
		tryOperation(() -> siteBootstrapStateProvider.unmarkSiteAsReady(siteId),
			"Failed to unmark site '%s' as ready in bootstrap state provider", siteId, exceptions);
	}

	/**
	 * Delete the deployer targets
	 *
	 * @param siteId     site id
	 * @param exceptions if an exception is thrown, a new {@link ServiceLayerException} wrapping it will be added to this list
	 */
	private void deleteDeployerTargets(final String siteId, final List<Exception> exceptions) {
		tryOperation(() -> deployer.deleteTargets(siteId), "Failed to delete deployer targets for site '%s'", siteId, exceptions);
	}

	/**
	 * Start the site delete process. This marks the site as DELETING and disables publishing and destroys the site preview context.
	 *
	 * @param site       site to delete
	 * @param exceptions if an exception is thrown, a new {@link ServiceLayerException} wrapping it will be added to this list
	 */
	private void startSiteDelete(final Site site, List<Exception> exceptions) {
		if (site == null) {
			return;
		}
		String siteId = site.getSiteId();

		tryOperation(() -> {
			logger.debug("Mark the site '{}' as DELETING", siteId);
			insertDeleteSiteAuditLog(site.getSiteId(), site.getName(), OPERATION_START_DELETE);
			retryingDatabaseOperationFacade.retry(() -> siteDao.startSiteDelete(siteId));
			applicationContext.publishEvent(new SiteDeletingEvent(siteId, site.getSiteUuid()));
		}, "Failed to start the site '%s' deletion", siteId, exceptions);

		try {
			// Disable publishing
			logger.debug("Disable publishing for site '{}'", siteId);
			enablePublishing(siteId, false);
		} catch (Exception e) {
			logger.error("Failed to disable publishing for site '{}'", siteId, e);
		}

		try {
			// Destroy site preview context
			logger.debug("Destroy site preview context for site '{}'", siteId);
			destroySitePreviewContext(siteId);
		} catch (Exception e) {
			logger.error("Failed to destroy site preview context for site '{}'", siteId, e);
		}
	}

	/**
	 * Insert delete site audit log entry
	 *
	 * @param siteId    the site id (String id)
	 * @param siteName  the site name
	 * @param operation the operation to record: OPERATION_START_DELETE or OPERATION_DELETE
	 */
	private void insertDeleteSiteAuditLog(String siteId, String siteName, String operation) {
		Site globalSite = siteDao.getSite(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE));
		String user = getCurrentUsername();
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(operation);
		auditLog.setSiteId(globalSite.getId());
		auditLog.setActorId(user);
		auditLog.setPrimaryTargetId(siteId);
		auditLog.setPrimaryTargetType(TARGET_TYPE_SITE);
		auditLog.setPrimaryTargetValue(siteName);
		auditService.insertAuditLog(auditLog);
	}

	/**
	 * Call the engine API to destroy the site preview context
	 *
	 * @param siteId site id
	 * @throws ServiceLayerException if the request fails or response status code is not 200
	 */
	protected void destroySitePreviewContext(String siteId) throws ServiceLayerException {
		String requestUrl = studioConfiguration.getProperty(CONFIGURATION_SITE_PREVIEW_DESTROY_CONTEXT_URL)
			.replaceAll(StudioConstants.CONFIG_SITENAME_VARIABLE, siteId);

		try {
			HttpResponse<String> response = HttpClient.newHttpClient().send(HttpRequest.newBuilder()
				.uri(URI.create(requestUrl))
				.build(), HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() != 200) {
				throw new ServiceLayerException(format("Failed to destroy site preview context for site '%s'", siteId));
			}
		} catch (IOException | InterruptedException e) {
			throw new ServiceLayerException(format("Failed to destroy site preview context for site '%s'", siteId), e);
		}
	}

	@Override
	public void enablePublishing(String siteId, boolean enabled) {
		Site site = siteDao.getSite(siteId);
		retryingDatabaseOperationFacade.retry(() -> siteDao.enablePublishing(siteId, enabled));

		AuditLog auditLog = createAuditLogEntry();
		auditLog.setSiteId(site.getId());
		if (enabled) {
			logger.info("Publishing started for site '{}'", siteId);
			auditLog.setOperation(OPERATION_START_PUBLISHER);
		} else {
			logger.info("Publishing stopped for site '{}'", siteId);
			auditLog.setOperation(OPERATION_STOP_PUBLISHER);
		}
		auditLog.setActorId(getCurrentUsername());
		auditLog.setPrimaryTargetId(siteId);
		auditLog.setPrimaryTargetType(TARGET_TYPE_SITE);
		auditLog.setPrimaryTargetValue(site.getName());
		auditService.insertAuditLog(auditLog);
	}

	@Override
	public PublishStatus getPublishingStatus(String siteId) throws RepositoryException {
		PublishStatus publishStatus = new PublishStatus();
		Site site = siteDao.getSite(siteId);
		publishStatus.setEnabled(site.getPublishingEnabled());
		publishStatus.setPublished(blobAwareRepository.publishedRepositoryExists(siteId));
		List<TaskProgress<PublishTask.PublishTaskId, Long>> publishTasks =
			taskManager.getSiteTasksByType(siteId, PublishTask.PUBLISH_TASK_TYPE);
		if (isNotEmpty(publishTasks)) {
			publishStatus.setCurrentTask(publishTasks.getFirst());
		}
		return publishStatus;
	}

	@Override
	public TaskProgress<PublishTask.PublishTaskId, Long> getPublishingTaskProgress(String siteId, long packageId) {
		return taskManager.getTask(new PublishTask.PublishTaskId(siteId, packageId));
	}

	@Override
	public void duplicate(String sourceSiteId, String siteId, String siteName, String description, String sandboxBranch, boolean readOnlyBlobStores, boolean enableStaging)
		throws ServiceLayerException {
		if (isNotEmpty(siteName) && siteDao.isNameUsed(siteId, siteName)) {
			throw new SiteAlreadyExistsException(format("A site with name '%s' already exists", siteName));
		}

		if (isEmpty(sandboxBranch)) {
			sandboxBranch = studioConfiguration.getProperty(REPO_SANDBOX_BRANCH);
		}
		doDuplicate(sourceSiteId, siteId, siteName, description, sandboxBranch, readOnlyBlobStores, enableStaging);
	}

	protected void doDuplicate(String sourceSiteId, String siteId, String siteName, String description, String sandboxBranch, boolean readOnlyBlobStores, boolean enableStaging)
		throws ServiceLayerException {
		logger.info("Site duplicate from '{}' to '{}' - START", sourceSiteId, siteId);

		Site sourceSite = siteDao.getSite(sourceSiteId);
		boolean publishingEnabled = sourceSite.getPublishingEnabled();
		try {
			// Lock source site
			if (publishingEnabled) {
				enablePublishing(sourceSiteId, false);
			}
			retryingDatabaseOperationFacade.retry(() -> siteDao.setSiteState(sourceSiteId, LOCKED));
			readOnlyBlobStores = readOnlyBlobStores && !studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false);

			// Copy site repos in disk
			logger.debug("Duplicate site repos in disk from '{}' to '{}'", sourceSiteId, siteId);
			blobAwareRepository.duplicateSite(sourceSiteId, siteId, sourceSite.getSandboxBranch(), sandboxBranch);

			String siteUuid = UUID.randomUUID().toString();
			addSiteUuidFile(siteId, siteUuid);
			// Create site in db (site state is INITIALIZING) and copy all db data
			logger.debug("Duplicate site DB data from '{}' to '{}'", sourceSiteId, siteId);
			retryingDatabaseOperationFacade.retry(() -> siteDao.duplicate(sourceSiteId, siteId, siteName, description, sandboxBranch, siteUuid));
			if (enableStaging) {
				retryingDatabaseOperationFacade.retry(() -> siteDao.setStagingEnabled(siteId));
			}
			prepareDuplicatedStaging(sourceSite, siteId, enableStaging);

			// Duplicate site in deployer
			logger.debug("Duplicate site deployer targets from '{}' to '{}'", sourceSiteId, siteId);
			deployer.duplicateTargets(sourceSiteId, siteId);
			if (enableStaging) {
				if (sourceSite.isStagingEnabled()) {
					duplicateOrCreateStagingTarget(sourceSiteId, siteId);
				} else {
					deployer.createStagingTarget(siteId);
				}
			}

			// read-only blobstores
			if (readOnlyBlobStores) {
				logger.debug("Make blobstores read-only for duplicate site '{}'", siteId);
				configurationService.makeBlobStoresReadOnly(siteId);
			} else {
				logger.debug("Duplicating blobstores content from site '{}' to '{}'", sourceSiteId, siteId);
				blobAwareRepository.duplicateBlobs(sourceSiteId, siteId);
				if (enableStaging && !sourceSite.isStagingEnabled() && blobAwareRepository.publishedRepositoryExists(siteId)) {
					String liveBranch = servicesConfig.getLiveEnvironment(siteId);
					String stagingBranch = servicesConfig.getStagingEnvironment(siteId);
					if (blobAwareRepository.isTargetPublished(siteId, liveBranch)) {
						blobAwareRepository.copyBlobs(siteId, liveBranch, stagingBranch);
					}
				}
			}

			auditSiteDuplicate(sourceSiteId, siteId, siteName);

			// Set site state to READY
			retryingDatabaseOperationFacade.retry(() -> siteDao.setSiteState(siteId, READY));
			enablePublishing(siteId, true);
			// Mark site as ready, since we don't need to run UM on duplicate
			siteBootstrapStateProvider.markSiteAsReady(siteId);
			applicationContext.publishEvent(new SiteReadyEvent(siteId, siteUuid));
			logger.info("Site duplicate from '{}' to '{}' - COMPLETE", sourceSiteId, siteId);
		} catch (ServiceLayerException ex) {
			deleteSite(siteId);
			throw ex;
		} catch (Exception ex) {
			deleteSite(siteId);
			throw new ServiceLayerException(format("Failed to duplicate site '%s' into '%s'", sourceSiteId, siteId), ex);
		} finally {
			// Unlock source site
			retryingDatabaseOperationFacade.retry(() -> siteDao.setSiteState(sourceSiteId, READY));
			if (publishingEnabled) {
				enablePublishing(sourceSiteId, true);
			}
		}
	}

	@Override
	public List<Site> getSitesByState(String state) {
		List<Site> sitesByState = siteDao.getSitesByState(state);
		sitesByState.forEach(this::checkBootstrappingState);
		return sitesByState;
	}

	@Override
	public List<Site> getAllSites() {
		List<Site> allSites = siteDao.getAllSites();
		allSites.forEach(this::checkBootstrappingState);
		return allSites;
	}

	/**
	 * Check if the site is in READY state but the bootstrap state provider doesn't consider it ready, and if so, set the site state to BOOTSTRAPPING.
	 * @param site the site to check
	 */
	protected void checkBootstrappingState(final Site site) {
		if (READY.equals(site.getState()) && !siteBootstrapStateProvider.isSiteReady(site.getSiteId())) {
			site.setState(Site.State.BOOTSTRAPPING);
		}
	}

	@Override
	public void updatePublishingStatus(String siteId, String status) {
		retryingDatabaseOperationFacade.retry(() -> siteDao.updatePublishingStatus(siteId, status));
	}

	@Override
	public void garbageCollectRepositories() throws RepositoryException {
		blobAwareRepository.garbageCollectGitRepositories(EMPTY);
		for (Site site : getSitesByState(READY)) {
			String siteId = site.getSiteId();
			blobAwareRepository.garbageCollectGitRepositories(siteId);
		}
	}

	/**
	 * Check a site with the given id and name can be created,
	 * and that the entitlements allowed the creation of a new site.
	 */
	private void checkCanCreateSite(String siteId, String name) throws ServiceLayerException {
		if (siteDao.exists(siteId) || siteDao.existsByName(name)) {
			throw new SiteAlreadyExistsException();
		}
		try {
			entitlementValidator.validateEntitlement(EntitlementType.SITE, 1);
		} catch (EntitlementException e) {
			throw new ServiceLayerException(format("Failed to perform create site '%s' operation due to entitlement validation failure", siteId), e);
		}
	}

	@Override
	@Transactional(rollbackFor = Throwable.class)
	public void createSite(CreateSiteRequest request) throws ServiceLayerException, InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException, InvalidRemoteRepositoryException {
		logger.debug("Create site with params: '{}'", request);
		checkCanCreateSite(request.getSiteId(), request.getName());

		runAfterRollback(() -> cleanupFailedSiteCreation(request.getSiteId()));

		if (isEmpty(request.getSandboxBranch())) {
			logger.debug("Use the default sandbox branch for site '{}'", request.getSiteId());
			request.setSandboxBranch(studioConfiguration.getProperty(REPO_SANDBOX_BRANCH));
		}

		switch (request) {
			case RemoteSource remoteRequest -> createSiteFromRemote(remoteRequest);
			case BlueprintSource blueprintRequest -> createSiteFromBlueprint(blueprintRequest);
			// No default case needed since CreateSiteRequest is a sealed class
		}
	}

	/**
	 * Configure the created site after the repository has been created, by:
	 * - Adding the site to the database
	 * - Running the upgrade manager on the site to apply any possible upgrade scripts
	 * - Processing the created content to create the corresponding content items in the database
	 * - Configuring the blob stores if serverless delivery is enabled
	 * - Publishing the site ready event to trigger the deployer and the repository watcher
	 * - Creating the deployer targets for the site
	 * - Updating the site last commit id in the database and set the site state to READY
	 *
	 * @param request the create site request
	 * @throws ServiceLayerException if any error occurs during the configuration of the created site
	 */
	protected void configureAfterCreateRepo(CreateSiteRequest request) throws ServiceLayerException {
		String siteId = request.getSiteId();
		// Add site to the database
		String siteUuid = UUID.randomUUID().toString();
		addSiteUuidFile(siteId, siteUuid);
		Site site = createSiteInDb(request, siteId, siteUuid);

		// Run the upgrade manager on the site
		upgradeSite(siteId);

		processCreatedContent(site);
		// Configure blob stores if serverless delivery is enabled
		configureBlobStores(siteId);

		// This will trigger the deployer and the repository watcher
		runAfterCommit(() -> applicationContext.publishEvent(new SiteReadyEvent(siteId, siteUuid)));

		// Create deployerTargets
		createDeployerTargets(siteId);

		// Update the site last commit id in the database and set the site state to READY
		siteDao.updateLastCommitId(siteId, blobAwareRepository.getRepoLastCommitId(siteId));
		siteDao.setSiteState(siteId, READY);
		siteBootstrapStateProvider.markSiteAsReady(siteId);
	}

	/**
	 * Create a new site based on a remote repository
	 * @param request the request object containing the remote repository url and site parameters
	 */
	protected void createSiteFromRemote(RemoteSource request)
			throws ServiceLayerException, InvalidRemoteRepositoryCredentialsException,
			RemoteRepositoryNotFoundException, InvalidRemoteRepositoryException {
		String siteId = request.getSiteId();
		if (isEmpty(request.getRemoteName())) {
			logger.debug("Use the default remote name for site '{}'", siteId);
			request.setRemoteName(studioConfiguration.getProperty(REPO_DEFAULT_REMOTE_NAME));
		}

		CreateSiteRequest.RemoteAuthentication auth = request.getAuthentication();
		blobAwareRepository.createSiteCloneRemote(request.getSiteId(), request.getSandboxBranch(), request.getRemoteName(),
				request.getRemoteUrl(), request.getRemoteBranch(), request.isSingleBranch(), auth.getType(), auth.getUsername(),
				auth.getPassword(), auth.getToken(), auth.getPrivateKey(), request.getSiteParams(), request.isCreateAsOrphan(),
				getCurrentUsername());

		configureAfterCreateRepo(request);

		auditSiteCreate(siteId, request.getName(), TARGET_TYPE_REMOTE_REPOSITORY, format(REMOTE_REPOSITORY_AUDIT_FORMAT, request.getRemoteName(), request.getRemoteBranch()));
		logger.info("Site '{}' based on remote repository", siteId);
	}

	/**
	 * Process the created content after site creation, by calling the content service to process the created files
	 * and create the corresponding content items in the database.
	 *
	 * @param site the created site
	 * @throws ServiceLayerException if any error occurs during the processing of the created content
	 */
	protected void processCreatedContent(Site site) throws ServiceLayerException {
		String currentUsername = getCurrentUsername();
		try {
			contentService.processCreatedFiles(site, userService.getUserByGitName(currentUsername));
		} catch (UserNotFoundException e) {
			// This should not really happen since it is the current user
			throw new ServiceLayerException(format("Failed to process created files for site '%s' after creation. User '%s' not found.", site.getSiteId(), currentUsername), e);
		}
	}

	/**
	 * When serverless mode is enabled, checks if the site has blob-stores-config.xml file and if not, creates it.
	 *
	 * @param siteId The site ID
	 */
	private void configureBlobStores(String siteId) {
		// TODO: JM: consider moving this kind of operations to a site-create pipeline
		if (!studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false)) {
			logger.info("Serverless delivery is disabled, blob-stores configuration will not be updated for site '{}'", siteId);
			return;
		}

		try {
			String configLocation = studioConfiguration.getProperty(BLOB_STORES_CONFIG_PATH);
			HierarchicalConfiguration<?> xmlConfiguration = configurationService.getXmlConfiguration(siteId, MODULE_STUDIO, configLocation);
			if (xmlConfiguration == null) {
				logger.info("Serverless delivery is enabled, configuring default blob stores for site '{}'", siteId);
				String environment = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
				String defaultBlobConfigsLocation = studioConfiguration.getProperty(BLOB_STORES_SERVERLESS_DEFAULT_CONFIG_PATH);
				Resource resource = applicationContext.getResource(defaultBlobConfigsLocation);
				configurationService.writeConfiguration(siteId, MODULE_STUDIO, configLocation, environment, resource.getInputStream());
			}
		} catch (Exception e) {
			logger.error("Failed to configure blob stores for site '{}'", siteId, e);
		}
	}

	/**
	 * Cleanup method to be called after a failed site creation, to delete any possible created resource
	 * like deployer targets or site repository, and to invalidate the configuration cache.
	 *
	 * @param siteId site id
	 */
	protected void cleanupFailedSiteCreation(String siteId) {
		deployer.deleteTargets(siteId);
		blobAwareRepository.deleteSite(siteId);
		configurationService.invalidateConfiguration(siteId);
		siteBootstrapStateProvider.unmarkSiteAsReady(siteId);
	}

	/**
	 * Create a new site based on a blueprint.
	 * @param request the request object containing the blueprint id and site parameters
	 * @throws ServiceLayerException if the blueprint is not found, if the parameters are not valid, or if any error occurs during site creation
	 */
	protected void createSiteFromBlueprint(BlueprintSource request) throws ServiceLayerException {
		String siteId = request.getSiteId();
		String blueprintId = request.getBlueprintId();
		PluginDescriptor descriptor = getBlueprintDescriptor(blueprintId);
		if (descriptor == null) {
			throw new BlueprintNotFoundException(request.getBlueprintId());
		}
		logger.debug("Validate the parameters for blueprint '{}'", request.getBlueprintId());
		validatePluginParameters(descriptor.getPlugin(), request.getSiteParams());

		// Create repository
		createSiteRepoFromBlueprint(request, blueprintId);

		configureAfterCreateRepo(request);

		// Audit the site creation
		auditSiteCreate(siteId, request.getName(), TARGET_TYPE_BLUEPRINT, blueprintId);
		logger.info("Site '{}' based on blueprint '{}' has been created", siteId, blueprintId);
	}

	/**
	 * Insert an audit log entry for site creation, with the blueprint used as audit parameter
	 *
	 * @param siteId      the created site id
	 * @param siteName    the created site name
	 * @param sourceTargetType the type of the blueprint source to be used in the audit parameter: TARGET_TYPE_BLUEPRINT or TARGET_TYPE_REMOTE_REPOSITORY
	 * @param sourceId the source of the repository: the blueprint id or the remote repository
	 */
	protected void auditSiteCreate(final String siteId, final String siteName, String sourceTargetType, final String sourceId) {
		Site globalSite = siteDao.getSite(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE));
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(OPERATION_CREATE);
		auditLog.setSiteId(globalSite.getId());
		auditLog.setActorId(getCurrentUsername());
		auditLog.setPrimaryTargetId(siteId);
		auditLog.setPrimaryTargetType(TARGET_TYPE_SITE);
		auditLog.setPrimaryTargetValue(siteName);
		List<AuditLogParameter> auditLogParameters = new ArrayList<>();
		AuditLogParameter auditLogParameter = new AuditLogParameter();
		auditLogParameter.setTargetId(siteId);
		auditLogParameter.setTargetType(sourceTargetType);
		auditLogParameter.setTargetValue(sourceId);
		auditLogParameters.add(auditLogParameter);

		auditLog.setParameters(auditLogParameters);
		auditService.insertAuditLog(auditLog);
	}

	/**
	 * Call the upgrade manager on a newly created site
	 * @param siteId site id
	 * @throws ServiceLayerException if the upgrade process fails
	 */
	protected void upgradeSite(String siteId) throws ServiceLayerException {
		logger.info("Upgrade newly created site '{}'", siteId);
		try {
			upgradeManager.upgrade(siteId);
		} catch (UpgradeException e) {
			throw new ServiceLayerException(format("Failed to upgrade site '%s'", siteId), e);
		}
	}

	/**
	 * Create a new site in the database
	 */
	protected Site createSiteInDb(CreateSiteRequest request, String siteId,
								  String siteUuid) {
		logger.info("Create site '{}' in the database", siteId);
		Site site = new Site();
		site.setSiteId(siteId);
		site.setSiteUuid(siteUuid);
		site.setName(request.getName());
		site.setDescription(request.getDescription());
		site.setPublishingStatus(PublishStatus.READY);
		site.setSandboxBranch(request.getSandboxBranch());
		site.setStagingEnabled(request.isEnableStaging());
		siteDao.createSite(site);
		return site;
	}

	/**
	 * Create the site repository based on the blueprint content.
	 *
	 * @param request     the request object containing the blueprint id and site parameters
	 * @param blueprintId the blueprint id
	 * @throws ServiceLayerException if any error occurs during the site repository creation
	 */
	protected void createSiteRepoFromBlueprint(BlueprintSource request, String blueprintId) throws ServiceLayerException {
		logger.info("Create site repository for site '{}' based on blueprint '{}'", request.getSiteId(), blueprintId);
		blobAwareRepository.createSiteFromBlueprint(getBlueprintLocation(blueprintId), request.getSiteId(), request.getSandboxBranch(),
				request.getSiteParams(), getCurrentUsername());
	}

	/**
	 * Create the deployer targets for a newly created site
	 * @throws DeployerTargetException if any error occurs during the deployer target creation
	 */
	protected void createDeployerTargets(String siteId) throws DeployerTargetException {
		// Create the site in the preview deployer
		logger.info("Create the deployer targets for site '{}'", siteId);
		try {
			deployer.createTargets(siteId);
			Site site = siteDao.getSite(siteId);
			if (site != null && site.isStagingEnabled()) {
				deployer.createStagingTarget(siteId);
			}
		} catch (Exception e) {
			logger.error("Failed to create deployer targets for site '{}'", siteId, e);
			throw new DeployerTargetException(format("Failed to create site '%s' deployer targets", siteId), e);
		}
	}

	@Override
	public Collection<SiteMonitor> monitorSite(String siteId) throws ServiceLayerException {
		return contentMonitor.monitorSite(siteId);
	}

	@Override
	public AllSitesMonitors monitorAllSites() {
		return contentMonitor.monitorAllSites();
	}

	/**
	 * Creates an audit log entry for the site duplication operation, including the source site as audit params
	 *
	 * @param sourceSiteId the source site id
	 * @param siteId       the new site id
	 * @param siteName     the new site name
	 */
	protected void auditSiteDuplicate(final String sourceSiteId, final String siteId, final String siteName) {
		Site globalSite = siteDao.getSite(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE));
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(OPERATION_DUPLICATE);
		auditLog.setSiteId(globalSite.getId());
		auditLog.setActorId(getCurrentUsername());
		auditLog.setPrimaryTargetId(siteId);
		auditLog.setPrimaryTargetType(TARGET_TYPE_SITE);
		auditLog.setPrimaryTargetValue(siteName);
		List<AuditLogParameter> auditLogParameters = new ArrayList<>();
		AuditLogParameter auditLogParameter = new AuditLogParameter();
		auditLogParameter.setTargetId(siteId);
		auditLogParameter.setTargetType(TARGET_TYPE_SOURCE_SITE);
		auditLogParameter.setTargetValue(sourceSiteId);
		auditLogParameters.add(auditLogParameter);

		auditLog.setParameters(auditLogParameters);
		auditService.insertAuditLog(auditLog);
	}

	/**
	 * Add a file containing the site uuid in the site folder
	 *
	 * @param site     site id
	 * @param siteUuid site uuid
	 * @throws ServiceLayerException if the file cannot be written
	 */
	protected void addSiteUuidFile(final String site, final String siteUuid) throws ServiceLayerException {
		logger.info("Adding site uuid file for site '{}'", site);
		try {
			Path path = Paths.get(studioConfiguration.getProperty(REPO_BASE_PATH),
					studioConfiguration.getProperty(SITES_REPOS_PATH), site,
					StudioConstants.SITE_UUID_FILENAME);
			String toWrite = StudioConstants.SITE_UUID_FILE_COMMENT + "\n" + siteUuid;
			Files.write(path, toWrite.getBytes());
		} catch (IOException e) {
			logger.error("Failed to write site uuid file for site '{}'", site, e);
			throw new ServiceLayerException(format("Failed to write site uuid file for site '%s'", site), e);
		}
	}

	@Override
	public void setApplicationContext(@NonNull ApplicationContext applicationContext) throws BeansException {
		this.applicationContext = applicationContext;
	}

	// These setters are needed to break circular dependencies
	@Autowired
	@Lazy
	@Qualifier("configurationServiceInternal")
	public void setConfigurationService(ConfigurationService configurationService) {
		this.configurationService = configurationService;
	}

	@Autowired
	@Lazy
	@SuppressWarnings("unused")
	public void setBlobStoreResolver(StudioBlobStoreResolver blobStoreResolver) {
		this.blobStoreResolver = blobStoreResolver;
	}

	@Autowired
	@Lazy
	public void setUpgradeManager(StudioUpgradeManager upgradeManager) {
		this.upgradeManager = upgradeManager;
	}

	@Autowired
	@Lazy
	@Qualifier("contentServiceInternal")
	public void setContentService(ContentService contentService) {
		this.contentService = contentService;
	}

	@Autowired
	@Lazy
	public void setBlobAwareRepository(StudioBlobAwareContentRepository blobAwareRepository) {
		this.blobAwareRepository = blobAwareRepository;
	}

	@Autowired
	@Lazy
	public void setContentMonitor(ContentMonitor contentMonitor) {
		this.contentMonitor = contentMonitor;
	}

	@Autowired
	public void setServicesConfig(ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	@Autowired
	public void setItemTargetDao(ItemTargetDAO itemTargetDao) {
		this.itemTargetDao = itemTargetDao;
	}

	@Autowired
	public void setGeneralLockService(GeneralLockService generalLockService) {
		this.generalLockService = generalLockService;
	}

	@Autowired
	public void setGitRepositoryHelper(GitRepositoryHelper gitRepositoryHelper) {
		this.gitRepositoryHelper = gitRepositoryHelper;
	}

	@Override
	public void enableStaging(String siteId) throws ServiceLayerException {
		String lockKey = gitRepositoryHelper.getPublishedRepoLockKey(siteId);
		generalLockService.lock(lockKey);
		try {
			doEnableStaging(siteId);
		} finally {
			generalLockService.unlock(lockKey);
		}
	}

	/**
	 * Initialize staging for an existing site and set the one-way flag only after initialization succeeds.
	 */
	protected void doEnableStaging(String siteId) throws ServiceLayerException {
		Site site = siteDao.getSite(siteId);
		if (site == null) {
			throw new SiteNotFoundException(format("Site '%s' not found.", siteId));
		}
		if (site.isStagingEnabled()) {
			throw new StagingAlreadyEnabledException(siteId);
		}
		String liveBranch = servicesConfig.getLiveEnvironment(siteId);
		String stagingBranch = servicesConfig.getStagingEnvironment(siteId);
		boolean createdBranch = false;
		boolean insertedTargets = false;
		boolean createdDeployerTarget = false;
		try {
			if (publishedToLive(siteId, liveBranch)) {
				createdBranch = blobAwareRepository.createStagingBranchFromLive(siteId, liveBranch, stagingBranch);
				if (!itemTargetDao.targetExists(site.getId(), stagingBranch)) {
					retryingDatabaseOperationFacade.retry(() -> itemTargetDao.initStaging(site.getId(), stagingBranch, liveBranch));
					insertedTargets = true;
				}
				blobAwareRepository.copyBlobs(siteId, liveBranch, stagingBranch);
			}
			deployer.createStagingTarget(siteId);
			createdDeployerTarget = true;
			int updated = retryingDatabaseOperationFacade.retry(() -> siteDao.setStagingEnabled(siteId));
			if (updated == 0) {
				throw new StagingAlreadyEnabledException(siteId);
			}
			logger.info("Enabled staging for site '{}'", siteId);
		} catch (Exception e) {
			compensateEnableStaging(siteId, site.getId(), stagingBranch, createdBranch, insertedTargets, createdDeployerTarget);
			if (e instanceof ServiceLayerException serviceLayerException) {
				throw serviceLayerException;
			}
			throw new ServiceLayerException(format("Failed to enable staging for site '%s'", siteId), e);
		}
	}

	/**
	 * Duplicate the source staging deployer target. When that target does not exist, create one for the new site.
	 */
	private void duplicateOrCreateStagingTarget(String sourceSiteId, String siteId) {
		try {
			deployer.duplicateStagingTarget(sourceSiteId, siteId);
		} catch (RestClientException e) {
			if (!(e instanceof HttpStatusCodeException status) || !status.getStatusCode().isSameCodeAs(HttpStatus.NOT_FOUND)) {
				throw e;
			}
			logger.info("Staging deployer target for site '{}' does not exist. Creating one for site '{}'", sourceSiteId, siteId);
			deployer.createStagingTarget(siteId);
		}
	}

	/**
	 * Align the duplicated site's staging branch, item targets, and later blob copy with {@code enableStaging}.
	 * The database flag is already stored before this runs.
	 */
	protected void prepareDuplicatedStaging(Site sourceSite, String siteId, boolean enableStaging) throws ServiceLayerException, IOException {
		if (!enableStaging && !sourceSite.isStagingEnabled()) {
			return;
		}
		String stagingBranch = servicesConfig.getStagingEnvironment(siteId);
		Site newSite = siteDao.getSite(siteId);
		if (!enableStaging) {
			if (sourceSite.isStagingEnabled()) {
				blobAwareRepository.deletePublishedBranch(siteId, stagingBranch);
				if (newSite != null) {
					retryingDatabaseOperationFacade.retry(() -> itemTargetDao.deleteForTarget(newSite.getId(), stagingBranch));
				}
			}
			return;
		}
		if (sourceSite.isStagingEnabled() || newSite == null) {
			return;
		}
		String liveBranch = servicesConfig.getLiveEnvironment(siteId);
		if (!publishedToLive(siteId, liveBranch)) {
			return;
		}
		blobAwareRepository.createStagingBranchFromLive(siteId, liveBranch, stagingBranch);
		if (!itemTargetDao.targetExists(newSite.getId(), stagingBranch)) {
			retryingDatabaseOperationFacade.retry(() -> itemTargetDao.initStaging(newSite.getId(), stagingBranch, liveBranch));
		}
	}

	protected boolean publishedToLive(String siteId, String liveBranch) throws ServiceLayerException, IOException {
		return blobAwareRepository.publishedRepositoryExists(siteId) && blobAwareRepository.isTargetPublished(siteId, liveBranch);
	}

	/**
	 * Remove the staging deployer target, item targets, and branch created by a failed enable so the flag stays off
	 * and the call can be retried. Only resources this call created are removed.
	 */
	protected void compensateEnableStaging(String siteId, long siteNumericId, String stagingBranch, boolean createdBranch,
										   boolean insertedTargets, boolean createdDeployerTarget) {
		if (createdDeployerTarget) {
			try {
				deployer.deleteStagingTarget(siteId);
			} catch (Exception e) {
				logger.error("Failed to delete the staging deployer target for site '{}' after a failed enable", siteId, e);
			}
		}
		if (insertedTargets) {
			try {
				retryingDatabaseOperationFacade.retry(() -> itemTargetDao.deleteForTarget(siteNumericId, stagingBranch));
			} catch (Exception e) {
				logger.error("Failed to delete staging item targets for site '{}' after a failed enable", siteId, e);
			}
		}
		if (createdBranch) {
			try {
				blobAwareRepository.deletePublishedBranch(siteId, stagingBranch);
			} catch (Exception e) {
				logger.error("Failed to delete staging branch '{}' for site '{}' after a failed enable", stagingBranch, siteId, e);
			}
		}
	}
}
