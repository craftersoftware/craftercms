/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.plugin.PluginDescriptorReader;
import org.craftercms.commons.plugin.exception.PluginException;
import org.craftercms.commons.plugin.model.PluginDescriptor;
import org.craftercms.studio.api.v1.constant.StudioConstants;
import org.craftercms.studio.api.v1.dal.SiteFeed;
import org.craftercms.studio.api.v1.dal.SiteFeedMapper;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteAlreadyExistsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.repository.ContentRepository;
import org.craftercms.studio.api.v1.repository.RepositoryItem;
import org.craftercms.studio.api.v1.service.site.SiteService;
import org.craftercms.studio.api.v2.dal.*;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_DELETE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_DUPLICATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_START_DELETE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_SITE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_SOURCE_SITE;
import org.craftercms.studio.api.v2.dal.AuditLogParameter;
import org.craftercms.studio.api.v2.dal.PublishStatus;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.deployment.Deployer;
import org.craftercms.studio.api.v2.event.site.SiteDeletedEvent;
import org.craftercms.studio.api.v2.event.site.SiteDeletingEvent;
import org.craftercms.studio.api.v2.event.site.SiteReadyEvent;
import org.craftercms.studio.api.v2.exception.CompositeException;
import org.craftercms.studio.api.v2.exception.InvalidSiteStateException;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.service.audit.internal.AuditServiceInternal;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.item.internal.ItemServiceInternal;
import org.craftercms.studio.api.v2.service.security.SecurityService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.api.v2.utils.spring.context.SiteBootstrapStateProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.lang.NonNull;

import java.beans.ConstructorProperties;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SITE_UUID_FILENAME;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.SITE_ID;
import static org.craftercms.studio.api.v2.dal.Site.State.READY;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;

public class SitesServiceInternalImpl implements SitesService, ApplicationContextAware {

    private final static Logger logger = LoggerFactory.getLogger(SitesServiceInternalImpl.class);
    /**
     * Site id suffix Engine uses to render a site's staging publishing target.
     * Matches {@code crafter.engine.site.staging.pattern}.
     */
    private static final String STAGING_SITE_ID_SUFFIX = "-staging";

    private final PluginDescriptorReader descriptorReader;
    private final ContentRepository contentRepository;
    private final StudioBlobAwareContentRepository blobAwareRepository;
    private final StudioConfiguration studioConfiguration;
    private final SiteFeedMapper siteFeedMapper;
    private final SiteDAO siteDao;
    private final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
    private final SiteService siteServiceV1;
    private final Deployer deployer;
    private final ConfigurationService configurationService;
    private ServicesConfig servicesConfig;
    private final SecurityService securityService;
    private final AuditServiceInternal auditServiceInternal;
    private final ItemServiceInternal itemServiceInternal;
    private final SiteBootstrapStateProvider siteBootstrapStateProvider;
    private ApplicationContext applicationContext;

    @ConstructorProperties({"descriptorReader", "contentRepository",
            "blobAwareRepository",
            "studioConfiguration", "siteFeedMapper",
            "siteDao",
            "retryingDatabaseOperationFacade", "siteServiceV1",
            "deployer", "configurationService",
            "securityService", "auditServiceInternal",
            "itemServiceInternal", "siteBootstrapStateProvider"})
    public SitesServiceInternalImpl(PluginDescriptorReader descriptorReader, ContentRepository contentRepository,
                                    StudioBlobAwareContentRepository blobAwareRepository,
                                    StudioConfiguration studioConfiguration, SiteFeedMapper siteFeedMapper,
                                    SiteDAO siteDao,
                                    RetryingDatabaseOperationFacade retryingDatabaseOperationFacade, SiteService siteServiceV1,
                                    Deployer deployer, ConfigurationService configurationService,
                                    SecurityService securityService, AuditServiceInternal auditServiceInternal,
                                    ItemServiceInternal itemServiceInternal, SiteBootstrapStateProvider siteBootstrapStateProvider) {
        this.descriptorReader = descriptorReader;
        this.contentRepository = contentRepository;
        this.blobAwareRepository = blobAwareRepository;
        this.studioConfiguration = studioConfiguration;
        this.siteFeedMapper = siteFeedMapper;
        this.siteDao = siteDao;
        this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
        this.siteServiceV1 = siteServiceV1;
        this.deployer = deployer;
        this.configurationService = configurationService;
        this.securityService = securityService;
        this.auditServiceInternal = auditServiceInternal;
        this.itemServiceInternal = itemServiceInternal;
        this.siteBootstrapStateProvider = siteBootstrapStateProvider;
    }

    @Override
    public List<PluginDescriptor> getAvailableBlueprints() {
        RepositoryItem[] blueprintsFolders = getBlueprintsFolders();
        List<PluginDescriptor> toRet = new ArrayList<>();
        for (RepositoryItem folder : blueprintsFolders) {
            if (folder.isFolder) {
                PluginDescriptor descriptor = loadDescriptor(folder);
                if (descriptor != null) {
                    toRet.add(descriptor);
                }
            }
        }
        return toRet;
    }

    @Override
    public PluginDescriptor getBlueprintDescriptor(final String id) {
        RepositoryItem[] blueprintsFolders = getBlueprintsFolders();
        for (RepositoryItem folder : blueprintsFolders) {
            if (folder.isFolder) {
                PluginDescriptor descriptor = loadDescriptor(folder);
                if (descriptor != null && descriptor.getPlugin().getId().equals(id)) {
                    return descriptor;
                }
            }
        }
        return null;
    }

    @Override
    public String getBlueprintLocation(String blueprintId) {
        RepositoryItem[] blueprintsFolders = getBlueprintsFolders();
        for (RepositoryItem folder : blueprintsFolders) {
            if (folder.isFolder) {
                Path descriptorPath = getBlueprintPath(folder);
                PluginDescriptor descriptor = loadDescriptor(folder);
                if (descriptor != null && descriptor.getPlugin().getId().equals(blueprintId)) {
                    return descriptorPath.getParent().toAbsolutePath().toString();
                }
            }
        }

        return StringUtils.EMPTY;
    }

    @Override
    public PluginDescriptor getSiteBlueprintDescriptor(final String id) {
        String descriptorPath = studioConfiguration.getProperty(REPO_BLUEPRINTS_DESCRIPTOR_FILENAME);
        if (blobAwareRepository.contentExists(id, descriptorPath)) {
            try (InputStream is = contentRepository.getContent(id, descriptorPath)) {
                return loadDescriptor(is);
            } catch (Exception e) {
                logger.error("Failed to get site blueprint descriptor for site '{}'", id, e);
            }
        }
        return null;
    }

    protected RepositoryItem[] getBlueprintsFolders() {
        return contentRepository.getContentChildren(
                StringUtils.EMPTY, studioConfiguration.getProperty(BLUE_PRINTS_PATH));
    }

    protected Path getBlueprintPath(RepositoryItem folder) {
        return Paths.get(studioConfiguration.getProperty(StudioConfiguration.REPO_BASE_PATH),
                studioConfiguration.getProperty(StudioConfiguration.GLOBAL_REPO_PATH), folder.path, folder.name,
                studioConfiguration.getProperty(REPO_BLUEPRINTS_DESCRIPTOR_FILENAME)).toAbsolutePath();
    }

    protected PluginDescriptor loadDescriptor(InputStream is) {
        try {
            return descriptorReader.read(is);
        } catch (PluginException e) {
            logger.error("Failed to load descriptor", e);
        }
        return null;
    }

    protected PluginDescriptor loadDescriptor(RepositoryItem folder) {
        Path descriptorPath = getBlueprintPath(folder);
        if (Files.exists(descriptorPath)) {
            try (FileReader reader = new FileReader(descriptorPath.toString())) {
                return descriptorReader.read(reader);
            } catch (PluginException | IOException e) {
                logger.error("Failed to load descriptor from blueprint '{}'", folder.name, e);
            }
        }
        return null;
    }

    @Override
    public void updateSite(String siteId, String name, String description)
            throws SiteNotFoundException, SiteAlreadyExistsException {
        if (isNotEmpty(name) && siteFeedMapper.isNameUsed(siteId, name)) {
            throw new SiteAlreadyExistsException("A site with name " + name + " already exists");
        }
        int updated = retryingDatabaseOperationFacade.retry(() -> siteFeedMapper.updateSite(siteId, name, description));
        if (updated != 1) {
            throw new SiteNotFoundException();
        }
    }

    @Override
    public void unlockSite(String siteId) {
        retryingDatabaseOperationFacade.retry(() -> siteFeedMapper.setSiteState(siteId, SiteFeed.STATE_READY));
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
     * @param errorMessageFormat error message format, to be use with String.format and siteId parameter
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
        SiteFeed site = siteFeedMapper.getSite(Map.of(SITE_ID, siteId));
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
        return siteDao.getSite(siteId);
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
        String user = securityService.getCurrentUser();
        AuditLog auditLog = auditServiceInternal.createAuditLogEntry();
        auditLog.setOperation(operation);
        auditLog.setSiteId(globalSite.getId());
        auditLog.setActorId(user);
        auditLog.setPrimaryTargetId(siteId);
        auditLog.setPrimaryTargetType(TARGET_TYPE_SITE);
        auditLog.setPrimaryTargetValue(siteName);
        auditServiceInternal.insertAuditLog(auditLog);
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
        retryingDatabaseOperationFacade.retry(() -> siteDao.enablePublishing(siteId, enabled));
    }

    @Override
    public PublishStatus getPublishingStatus(String siteId) {
        return siteFeedMapper.getPublishingStatus(siteId);
    }

    @Override
    public void duplicate(String sourceSiteId, String siteId, String siteName, String description, String sandboxBranch, boolean readOnlyBlobStores)
            throws ServiceLayerException {
        if (isNotEmpty(siteName) && siteFeedMapper.isNameUsed(siteId, siteName)) {
            throw new SiteAlreadyExistsException(format("A site with name '%s' already exists", siteName));
        }

        if (isEmpty(sandboxBranch)) {
            sandboxBranch = studioConfiguration.getProperty(REPO_SANDBOX_BRANCH);
        }
        doDuplicate(sourceSiteId, siteId, siteName, description, sandboxBranch, readOnlyBlobStores);
    }

    protected void doDuplicate(String sourceSiteId, String siteId, String siteName, String description, String sandboxBranch, boolean readOnlyBlobStores)
            throws ServiceLayerException {
        logger.info("Site duplicate from '{}' to '{}' - START", sourceSiteId, siteId);

        Site sourceSite = siteDao.getSite(sourceSiteId);
        boolean publishingEnabled = sourceSite.getPublishingEnabled();
        try {
            // Lock source site
            if (publishingEnabled) {
                siteServiceV1.enablePublishing(sourceSiteId, false);
            }
            retryingDatabaseOperationFacade.retry(() -> siteFeedMapper.setSiteState(sourceSiteId, SiteFeed.STATE_LOCKED));
            readOnlyBlobStores = readOnlyBlobStores && !studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false);

            // Copy site repos in disk
            logger.debug("Duplicate site repos in disk from '{}' to '{}'", sourceSiteId, siteId);
            blobAwareRepository.duplicateSite(sourceSiteId, siteId, sourceSite.getSandboxBranch(), sandboxBranch);

            String siteUuid = UUID.randomUUID().toString();
            addSiteUuidFile(siteId, siteUuid);
            // Create site in db (site state is INITIALIZING) and copy all db data
            logger.debug("Duplicate site DB data from '{}' to '{}'", sourceSiteId, siteId);
            retryingDatabaseOperationFacade.retry(() -> siteFeedMapper.duplicate(sourceSiteId, siteId, siteName, description, sandboxBranch, siteUuid));
            logger.debug("Update item parent ids for new site '{}'", siteId);
            itemServiceInternal.updateParentId(siteId);

            // Duplicate site in deployer
            logger.debug("Duplicate site deployer targets from '{}' to '{}'", sourceSiteId, siteId);
            deployer.duplicateTargets(sourceSiteId, siteId);

            // read-only blobstores
            if (readOnlyBlobStores) {
                logger.debug("Make blobstores read-only for duplicate site '{}'", siteId);
                configurationService.makeBlobStoresReadOnly(siteId);
            } else {
                logger.debug("Duplicating blobstores content from site '{}' to '{}'", sourceSiteId, siteId);
                blobAwareRepository.duplicateBlobs(sourceSiteId, siteId);
            }

            auditSiteDuplicate(sourceSiteId, siteId, siteName);

            // Set site state to READY
            retryingDatabaseOperationFacade.retry(() -> siteFeedMapper.setSiteState(siteId, SiteFeed.STATE_READY));
            siteServiceV1.enablePublishing(siteId, true);
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
            retryingDatabaseOperationFacade.retry(() -> siteFeedMapper.setSiteState(sourceSiteId, SiteFeed.STATE_READY));
            if (publishingEnabled) {
                siteServiceV1.enablePublishing(sourceSiteId, true);
            }
        }
    }

    @Override
    public List<Site> getSitesByState(String state) {
        return siteDao.getSitesByState(state);
    }

    @Override
    public List<Site> getAllSites() {
        List<Site> allSites = siteDao.getAllSites();
        for (Site site : allSites) {
            if (READY.equals(site.getState()) && !siteBootstrapStateProvider.isSiteReady(site.getSiteId())) {
                site.setState(Site.State.BOOTSTRAPPING);
            }
        }
        return allSites;
    }

    @Override
    public List<String> getDeliverableSiteIds() {
        List<String> deliverableSiteIds = new ArrayList<>();
        for (String siteId : siteDao.getDeliverableSiteIds()) {
            deliverableSiteIds.add(siteId);
            try {
                if (servicesConfig.isStagingEnvironmentEnabled(siteId)) {
                    deliverableSiteIds.add(siteId + STAGING_SITE_ID_SUFFIX);
                }
            } catch (Exception e) {
                logger.warn("Failed to check if site '{}' is a staging site", siteId, e);
            }
        }
        return deliverableSiteIds;
    }

    /**
     * Creates an audit log entry for the site duplication operation, including the source site as audit params
     *
     * @param sourceSiteId the source site id
     * @param siteId       the new site id
     * @param siteName     the new site name
     */
    protected void auditSiteDuplicate(final String sourceSiteId, final String siteId, final String siteName) {
        SiteFeed globalSiteFeed = siteFeedMapper.getSite(Map.of(SITE_ID, studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE)));
        AuditLog auditLog = auditServiceInternal.createAuditLogEntry();
        auditLog.setOperation(OPERATION_DUPLICATE);
        auditLog.setSiteId(globalSiteFeed.getId());
        auditLog.setActorId(securityService.getCurrentUser());
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
        auditServiceInternal.insertAuditLog(auditLog);
    }

    /**
     * Add a file containing the site uuid in the site folder
     *
     * @param site     site id
     * @param siteUuid site uuid
     * @throws IOException if the file cannot be written
     */
    protected void addSiteUuidFile(final String site, final String siteUuid) throws IOException {
        Path path = Paths.get(studioConfiguration.getProperty(REPO_BASE_PATH),
                studioConfiguration.getProperty(SITES_REPOS_PATH), site,
                StudioConstants.SITE_UUID_FILENAME);
        String toWrite = StudioConstants.SITE_UUID_FILE_COMMENT + "\n" + siteUuid;
        Files.write(path, toWrite.getBytes());
    }

    @Override
    public void setApplicationContext(@NonNull ApplicationContext applicationContext) throws BeansException {
        this.applicationContext = applicationContext;
    }
}
