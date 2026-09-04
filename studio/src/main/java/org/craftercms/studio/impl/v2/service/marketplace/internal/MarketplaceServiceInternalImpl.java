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

package org.craftercms.studio.impl.v2.service.marketplace.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.XMLConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationRuntimeException;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.text.StringSubstitutor;
import org.craftercms.commons.git.utils.AuthenticationType;
import org.craftercms.commons.monitoring.SysInfo;
import org.craftercms.commons.plugin.PluginDescriptorReader;
import org.craftercms.commons.plugin.exception.PluginException;
import org.craftercms.commons.plugin.model.Installation;
import org.craftercms.commons.plugin.model.Plugin;
import org.craftercms.commons.plugin.model.PluginDescriptor;
import org.craftercms.commons.plugin.model.Version;
import org.craftercms.commons.rest.RestTemplate;
import org.craftercms.studio.api.v1.constant.GitRepositories;
import org.craftercms.studio.api.v1.constant.StudioConstants;
import org.craftercms.studio.api.v1.exception.*;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteUrlException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.content.ContentService;
import org.craftercms.studio.api.v1.service.deployment.DeploymentService;
import org.craftercms.studio.api.v1.service.site.SiteService;
import org.craftercms.studio.api.v2.exception.MissingPluginParameterException;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.exception.marketplace.*;
import org.craftercms.studio.api.v2.repository.RetryingRepositoryOperationFacade;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.service.marketplace.Constants;
import org.craftercms.studio.api.v2.service.marketplace.MarketplacePlugin;
import org.craftercms.studio.api.v2.service.marketplace.Paths;
import org.craftercms.studio.api.v2.service.marketplace.PluginTreeCopier;
import org.craftercms.studio.api.v2.service.marketplace.internal.MarketplaceServiceInternal;
import org.craftercms.studio.api.v2.service.marketplace.registry.ConfigRecord;
import org.craftercms.studio.api.v2.service.marketplace.registry.FileRecord;
import org.craftercms.studio.api.v2.service.marketplace.registry.PluginRecord;
import org.craftercms.studio.api.v2.service.marketplace.registry.PluginRegistry;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.service.system.InstanceService;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.utils.XsltUtils;
import org.craftercms.studio.model.contentType.ContentTypeUsage;
import org.craftercms.studio.model.rest.marketplace.CreateSiteRequest;
import org.dom4j.*;
import org.eclipse.jgit.api.AddCommand;
import org.eclipse.jgit.api.CheckoutCommand;
import org.eclipse.jgit.api.CommitCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.revwalk.RevCommit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.util.UriComponentsBuilder;

import javax.xml.transform.TransformerException;
import java.beans.ConstructorProperties;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.lang.String.format;
import static java.lang.String.join;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.nio.file.StandardOpenOption.CREATE;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.toList;
import static org.apache.commons.io.IOUtils.toInputStream;
import static org.apache.commons.lang.text.StrSubstitutor.replace;
import static org.apache.commons.lang3.StringUtils.*;
import static org.craftercms.studio.api.v1.constant.StudioConstants.PATTERN_MODULE;
import static org.craftercms.studio.api.v2.service.marketplace.Constants.SOURCE_GIT;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN;
import static org.craftercms.studio.impl.v2.utils.PluginUtils.*;
import static org.craftercms.studio.impl.v2.utils.XsltUtils.executeTemplate;

/**
 * Default implementation of {@link MarketplaceServiceInternal} that proxies all request to the configured Marketplace
 *
 * @author joseross
 * @since 3.1.2
 */
public class MarketplaceServiceInternalImpl implements MarketplaceServiceInternal, InitializingBean {

    private static final Logger logger = LoggerFactory.getLogger(MarketplaceServiceInternalImpl.class);

    public static final String INSTALLABLE_TYPES_CONFIG_KEY = "studio.marketplace.plugin.installable";

    public static final String FOLDER_MAPPING_CONFIG_KEY = "studio.marketplace.plugin.mapping";

    public static final String WIDGET_MAPPING_CONFIG_KEY = "studio.marketplace.plugin.wire.mapping";

    public static final String WIDGET_REMOVE_CONFIG_KEY = "studio.marketplace.plugin.wire.remove";

    public static final String TEMPLATE_MAPPING_CONFIG_KEY = "studio.marketplace.plugin.template.mapping";

    public static final String CONTENT_TYPE_PATTERN_CONFIG_KEY = "studio.marketplace.plugin.contentType.pattern";

    public static final String PLUGIN_CONFIG_MODULE_CONFIG_KEY = "studio.marketplace.plugin.config.module";

    public static final String PLUGIN_CONFIG_FILENAME_CONFIG_KEY = "studio.marketplace.plugin.config.filename";

    public static final String MODULE_CONFIG_KEY = "module";

    public static final String PATH_CONFIG_KEY = "path";

    public static final String TEMPLATE_CONFIG_KEY = "template";

    public static final String SYSTEM_PATH_KEY = "systemPath";

    public static final String PLUGIN_PATTERN_KEY = "pluginPattern";

    public static final String PARAM_NEW_XML = "newXml";

    public static final String PARAM_PARENT_XPATH = "parentXpath";

    public static final String PARAM_PLUGIN_ID = "pluginId";

    public static final String PARAM_PLUGIN_PATH = "pluginPath";

    protected final InstanceService instanceService;

    protected final SiteService siteService;

    protected final SitesService sitesServiceInternal;

    protected final ContentService contentService;

    protected final StudioConfiguration studioConfiguration;

    protected final GitRepositoryHelper gitRepositoryHelper;

    protected final PluginDescriptorReader pluginDescriptorReader;

    protected final String pluginDescriptorFilename;

    protected final RestTemplate restTemplate = new RestTemplate(MarketplaceException.class);

    protected ObjectMapper mapper;

    protected final ReadWriteLock lock = new ReentrantReadWriteLock();

    protected final Lock readLock = lock.readLock();

    protected final Lock writeLock = lock.writeLock();

    protected final ConfigurationService configurationService;

    /**
     * The custom HTTP headers to sent with all requests
     */
    protected HttpHeaders httpHeaders;

    /**
     * The current CrafterCMS version, sent with all requests
     */
    protected String version;

    /**
     * The current CrafterCMS edition, sent with all requests
     */
    protected String edition;

    /**
     * The Marketplace URL to use
     */
    protected String url;

    /**
     * The path of the plugin registry in the site
     */
    protected String pluginRegistryPath;

    /**
     * Indicates if the search should include plugins pending of approval
     */
    protected boolean showPending = false;

    /**
     * List of plugin types that can be installed
     */
    protected List<String> installableTypes = Collections.emptyList();

    /**
     * Folder mappings to use during plugin installation
     */
    protected final Map<String, String> folderMapping = new HashMap<>();

    /**
     * Name of the folder to copy all plugin files
     */
    protected String pluginsFolder;

    /**
     * Mapping used to wire plugin files into the site configuration
     */
    protected HierarchicalConfiguration<?> widgetMapping;

    /**
     * XSLT template used to remove wired configurations
     */
    protected Resource widgetRemoveTemplate;

    /**
     * Mapping used to wire plugin files into the site templates
     */
    protected Map<String, String> templateMapping;

    /**
     * Code injected in the templates for each plugin
     */
    protected String templateCode;

    /**
     * Comment added in the templates for each plugin
     */
    protected String templateComment;

    /**
     * Regular expression used to detect content-type definition files
     */
    protected String contentTypePattern;

    protected String pluginConfigModule;

    protected String pluginConfigFilename;

    protected RetryingRepositoryOperationFacade retryingRepositoryOperationFacade;

    protected final DeploymentService deploymentService;

    protected final DependencyService dependencyService;

    protected final ContentTypeService contentTypeService;

    @ConstructorProperties({ "instanceService", "siteService", "sitesServiceInternal", "contentService",
            "studioConfiguration", "pluginDescriptorReader", "gitRepositoryHelper",
            "pluginDescriptorFilename", "templateCode", "templateComment", "retryingRepositoryOperationFacade",
            "deploymentService", "dependencyService", "contentTypeService", "configurationService"})
    public MarketplaceServiceInternalImpl(InstanceService instanceService, SiteService siteService,
                                          SitesService sitesServiceInternal, ContentService contentService,
                                          StudioConfiguration studioConfiguration,
                                          PluginDescriptorReader pluginDescriptorReader,
                                          GitRepositoryHelper gitRepositoryHelper, String pluginDescriptorFilename,
                                          String templateCode, String templateComment,
                                          RetryingRepositoryOperationFacade retryingRepositoryOperationFacade,
                                          DeploymentService deploymentService, DependencyService dependencyService,
                                          ContentTypeService contentTypeService,
                                          ConfigurationService configurationService) {
        this.instanceService = instanceService;
        this.siteService = siteService;
        this.sitesServiceInternal = sitesServiceInternal;
        this.contentService = contentService;
        this.studioConfiguration = studioConfiguration;
        this.pluginDescriptorReader = pluginDescriptorReader;
        this.gitRepositoryHelper = gitRepositoryHelper;
        this.pluginDescriptorFilename = pluginDescriptorFilename;
        this.templateCode = templateCode;
        this.templateComment = templateComment;
        this.retryingRepositoryOperationFacade = retryingRepositoryOperationFacade;
        this.deploymentService = deploymentService;
        this.dependencyService = dependencyService;
        this.contentTypeService = contentTypeService;
        this.configurationService = configurationService;
    }

    public void setUrl(final String url) {
        this.url = url;
    }

    public void setPluginRegistryPath(String pluginRegistryPath) {
        this.pluginRegistryPath = pluginRegistryPath;
    }

    public void setShowPending(final boolean showPending) {
        this.showPending = showPending;
    }

    public void setPluginsFolder(final String pluginsFolder) {
        this.pluginsFolder = pluginsFolder;
    }

    @Override
    public void afterPropertiesSet() throws IOException {
        SysInfo versionInfo = SysInfo.getInfo(MarketplaceServiceInternalImpl.class);
        if (versionInfo == null) {
            logger.error("Failed to initialize the Marketplace service");
            return;
        }
        String versionStr = versionInfo.getPackageVersion();

        // init version
        version = Version.getVersion(versionStr);
        edition = Version.getEdition(versionStr);

        // init headers
        httpHeaders = new HttpHeaders();
        httpHeaders.set(HEADER_STUDIO_ID, instanceService.getInstanceId());

        httpHeaders.set(HEADER_STUDIO_BUILD, versionInfo.getPackageBuild());
        httpHeaders.set(HEADER_STUDIO_VERSION, versionInfo.getPackageVersion());
        httpHeaders.set(HEADER_JAVA_VERSION, versionInfo.getJavaVersion());

        httpHeaders.set(HEADER_OS_NAME, versionInfo.getOsName());
        httpHeaders.set(HEADER_OS_VERSION, versionInfo.getOsVersion());
        httpHeaders.set(HEADER_OS_ARCH, versionInfo.getOsArch());

        installableTypes = studioConfiguration.getList(INSTALLABLE_TYPES_CONFIG_KEY, String.class);

        studioConfiguration.getSubConfigs(FOLDER_MAPPING_CONFIG_KEY).forEach(mapping ->
            mapping.getKeys().forEachRemaining(folder ->
                folderMapping.put(folder.replace("\\/", File.separator), mapping.getString(folder)))
        );

        mapper = new ObjectMapper(new YAMLFactory().disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER))
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .findAndRegisterModules();

        widgetMapping = studioConfiguration.getSubConfig(WIDGET_MAPPING_CONFIG_KEY);

        widgetRemoveTemplate = new ClassPathResource(studioConfiguration.getProperty(WIDGET_REMOVE_CONFIG_KEY));

        templateMapping = new HashMap<>();
        studioConfiguration.getSubConfigs(TEMPLATE_MAPPING_CONFIG_KEY).forEach(config ->
                templateMapping.put(config.getString(SYSTEM_PATH_KEY), config.getString(PLUGIN_PATTERN_KEY)));

        contentTypePattern = studioConfiguration.getProperty(CONTENT_TYPE_PATTERN_CONFIG_KEY);
        pluginConfigModule = studioConfiguration.getProperty(PLUGIN_CONFIG_MODULE_CONFIG_KEY);
        pluginConfigFilename = studioConfiguration.getProperty(PLUGIN_CONFIG_FILENAME_CONFIG_KEY);
    }

    @Override
    public Map<String, Object> searchPlugins(final String type, final String keywords, final boolean showIncompatible,
                                             final long offset, final long limit)
        throws MarketplaceException {

        validate();
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(url)
            .path(Paths.PLUGIN_SEARCH)
            .queryParam(Constants.PARAM_VERSION, version)
            .queryParam(Constants.PARAM_EDITION, edition)
            .queryParam(Constants.PARAM_SHOW_PENDING, showPending)
            .queryParam(Constants.PARAM_SHOW_INCOMPATIBLE, showIncompatible)
            .queryParam(Constants.PARAM_OFFSET, offset)
            .queryParam(Constants.PARAM_LIMIT, limit);
        Map<String, String> uriVariables = new HashMap<>();

        if (isNotEmpty(type)) {
            builder.queryParam(Constants.PARAM_TYPE, type);
        }

        if (isNotEmpty(keywords)) {
            builder.queryParam(Constants.PARAM_KEYWORDS, "{keywords}");
            uriVariables.put("keywords", keywords);
        }

        HttpEntity<Void> request = new HttpEntity<>(null, httpHeaders);

        try {
            ResponseEntity<Map<String, Object>> response =
                restTemplate.exchange(builder.build().toString(), HttpMethod.GET, request,
                    new ParameterizedTypeReference<>() {}, uriVariables);
            return response.getBody();
        } catch (ResourceAccessException e) {
            throw new MarketplaceUnreachableException(url, e);
        }
    }

    protected void validate() throws MarketplaceException {
        if (isEmpty(version)) {
            throw new MarketplaceNotInitializedException();
        }
    }

    protected MarketplacePlugin getDescriptor(String id, Version version)
        throws MarketplaceException {
        validate();

        logger.debug("Load plugin descriptor for plugin '{}' version '{}'", id, version);
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(url)
            .path(Paths.GET_PLUGIN)
            .pathSegment(id, version.toString())
            .queryParam(Constants.PARAM_SHOW_PENDING, showPending);

        HttpEntity<Void> request = new HttpEntity<>(null, httpHeaders);

        try {
            ResponseEntity<MarketplacePlugin> response =
                restTemplate.exchange(builder.build().toString(), HttpMethod.GET, request, MarketplacePlugin.class);
            return response.getBody();
        } catch (ResourceAccessException e) {
            throw new MarketplaceUnreachableException(url, e);
        } catch (IllegalArgumentException e) {
            throw new PluginNotFoundException(format("Plugin '%s' version '%s' was not found in the Marketplace",
                    id, version));
        }
    }

    @Override
    public void createSite(CreateSiteRequest request) throws RemoteRepositoryNotFoundException,
        InvalidRemoteRepositoryException, InvalidRemoteUrlException,
        ServiceLayerException, InvalidRemoteRepositoryCredentialsException {

        logger.info("Create site '{}' from the marketplace blueprint '{}' version '{}'",
                request.getSiteId(), request.getBlueprintId(), request.getBlueprintVersion());

        if (isEmpty(request.getSandboxBranch())) {
            logger.debug("Use the default sandbox branch for site '{}'", request.getSiteId());
            request.setSandboxBranch(studioConfiguration.getProperty(StudioConfiguration.REPO_SANDBOX_BRANCH));
        }

        if (isEmpty(request.getRemoteName())) {
            logger.debug("Use the default remote name for site '{}'", request.getSiteId());
            request.setRemoteName(studioConfiguration.getProperty(StudioConfiguration.REPO_DEFAULT_REMOTE_NAME));
        }

        MarketplacePlugin plugin = getDescriptor(request.getBlueprintId(), request.getBlueprintVersion());

        validatePluginParameters(plugin, request.getSiteParams());

        siteService.createSiteWithRemoteOption(request.getSiteId(), request.getName(), request.getSandboxBranch(),
            request.getDescription(), request.getBlueprintId(), request.getRemoteName(),
            plugin.getUrl(), plugin.getRef(), false, AuthenticationType.NONE, null,
            null, null, null, StudioConstants.REMOTE_REPOSITORY_CREATE_OPTION_CLONE, request.getSiteParams(),
            true);

        logger.info("Site '{}' was created successfully", request.getSiteId());
    }

    @Override
    public List<PluginRecord> getInstalledPlugins(final String siteId) throws MarketplaceException {
        if (!contentService.contentExists(siteId, pluginRegistryPath)) {
            return Collections.emptyList();
        }
        return getPluginRegistry(siteId).getPlugins();
    }

    protected PluginRegistry getPluginRegistry(String siteId) throws MarketplaceRegistryException {
        logger.debug("Read the plugin registry for site '{}'", siteId);
        if (!contentService.contentExists(siteId, pluginRegistryPath)) {
            logger.debug("Create a new plugin registry for site '{}'", siteId);
            return new PluginRegistry();
        }
        readLock.lock();
        try (InputStream is = contentService.getContent(siteId, pluginRegistryPath)) {
            return mapper.readValue(is, PluginRegistry.class);
        } catch (ContentNotFoundException | IOException e) {
            throw new MarketplaceRegistryException("Error collecting installed plugins registry for site " + siteId, e);
        } finally {
            readLock.unlock();
        }
    }

    @Override
    public void installPlugin(String siteId, String pluginId, Version pluginVersion, Map<String, String> parameters)
            throws MarketplaceException {
        writeLock.lock();
        List<String> changedFiles = new LinkedList<>();
        try {
            if (isPluginAlreadyInstalled(siteId, pluginId)) {
                throw new PluginAlreadyInstalledException(format("Plugin '%s' is already installed in site '%s'",
                        pluginId, siteId));
            }

            logger.debug("Install the plugin '{}' version '{}' in site '{}'",
                    pluginId, pluginVersion, siteId);

            MarketplacePlugin marketplacePlugin = getDescriptor(pluginId, pluginVersion);

            if (installableTypes.stream().noneMatch(marketplacePlugin.getType()::equalsIgnoreCase)) {
                throw new IncompatiblePluginException(
                        format("Plugin '%s' version '%s' of type '%s' can't be installed in site '%s' " +
                                        "because it's not compatible",
                                pluginId, pluginVersion, marketplacePlugin.getType(), siteId));
            }

            Path siteDir = getRepoDirectory(siteId);
            String pluginIdPath = getPluginPath(marketplacePlugin.getId());

            validatePluginParameters(marketplacePlugin, parameters);

            createPluginConfig(siteDir, pluginIdPath, parameters, changedFiles);

            Path temp = Files.createTempDirectory("plugin-" + marketplacePlugin.getId());
            switch (marketplacePlugin.getSource()) {
                case SOURCE_GIT:
                    clonePluginFromGit(marketplacePlugin, temp);
                    break;
                default:
                    throw new IncompatiblePluginException(
                            format("Plugin '%s' version '%s' from source '%s' can't be installed in site '%s' " +
                                            "because the source of the plugin is not supported",
                                    marketplacePlugin.getId(), pluginVersion, marketplacePlugin.getSource(), siteId));
            }

            try (InputStream is = Files.newInputStream(temp.resolve(pluginDescriptorFilename))) {
                // Load the plugin descriptor from the temp directory
                Plugin localPlugin = pluginDescriptorReader.read(is).getPlugin();

                // Copy the required files from the temp directory into the site repo
                List<FileRecord> files = copyPluginFiles(temp, siteId, localPlugin, parameters);

                List<ConfigRecord> wiring = new LinkedList<>();

                files.stream()
                    .map(FileRecord::getPath)
                    .forEach(changedFiles::add);

                // Wire plugin to the site configuration
                performConfigurationWiring(localPlugin, siteId, changedFiles, wiring);

                // Wire plugin to the freemarker hooks
                performTemplateWiring(localPlugin, siteId, files, changedFiles);

                // Update the plugin registry
                addPluginToRegistry(siteId, localPlugin, files, wiring);
                changedFiles.add(pluginRegistryPath);

                // Commit all changes
                commitChanges(siteId, changedFiles, false, false,
                        format("Install plugin %s %s", pluginId, pluginVersion));

                logger.info("Installed the plugin '{}' version '{}' in site '{}'",
                        marketplacePlugin.getId(), marketplacePlugin.getVersion(), siteId);
            } finally {
                if (temp != null) {
                    try {
                        FileUtils.deleteDirectory(temp.toFile());
                    } catch (IOException e) {
                        logger.warn("Failed to delete temporary folder '{}'", temp);
                    }
                }
            }
        } catch (IOException | TransformerException | ServiceLayerException | DocumentException | GitAPIException |
                PluginException | org.apache.commons.configuration2.ex.ConfigurationException |
                UserNotFoundException e) {
            if (CollectionUtils.isNotEmpty(changedFiles)) {
                try {
                    resetChanges(siteId, changedFiles);
                } catch (IOException | GitAPIException e2) {
                    throw new PluginInstallationException("Failed to rollback plugin removal", e2);
                }
            }
            if (e instanceof PluginInstallationException) {
                throw (PluginInstallationException) e;
            } else {
                logger.error("Failed to install plugin '{}' version '{}' in site '{}'",
                        pluginId, pluginVersion, siteId, e);
                throw new PluginInstallationException(format("Failed to write plugin '%s' version '%s' in site '%s'",
                        pluginId, pluginVersion, siteId), e);
            }
        } finally {
            writeLock.unlock();
        }
    }

    protected boolean isPluginAlreadyInstalled(String siteId, String pluginId) throws MarketplaceException {
        logger.debug("Check if the plugin '{}' is already installed in site '{}'", pluginId, siteId);
        return getInstalledPlugins(siteId).stream()
                .map(PluginRecord::getId)
                .anyMatch(pluginId::equalsIgnoreCase);
    }

    protected void clonePluginFromGit(MarketplacePlugin plugin, Path directory)
            throws PluginInstallationException {
        Git git = null;
        try {
            logger.debug("Clone the remote repository '{}' with tag '{}'", plugin.getUrl(), plugin.getRef());

            git = Git.cloneRepository()
                     .setDirectory(directory.toFile())
                     .setURI(plugin.getUrl())
                     .setBranch(plugin.getRef())
                     .call();
        } catch (Exception e) {
            logger.error("Failed to clone the plugin '{}'", plugin.getId(), e);
            throw new PluginInstallationException(format("Failed to clone the plugin '%s'", plugin.getId()), e);
        } finally {
            if (git != null) {
                git.close();
            }
        }
    }

    protected List<FileRecord> copyPluginFiles(Path pluginDir, String siteId, Plugin plugin, Map<String, String> params)
        throws IOException {
        logger.debug("Copy the files from plugin '{}' version '{}' to site '{}'",
                plugin.getId(), plugin.getVersion(), siteId);
        List<FileRecord> files = new LinkedList<>();
        Path siteDir = getRepoDirectory(siteId);
        String pluginIdPath = getPluginPath(plugin.getId());

        for(Map.Entry<String, String> mapping : folderMapping.entrySet()) {
            var rootFolder = join(File.separator, mapping.getValue(), pluginsFolder);
            Path source = pluginDir.resolve(join(File.separator, mapping.getKey(), pluginsFolder, pluginIdPath));
            if (Files.exists(source)) {
                Path target = siteDir.resolve(rootFolder).resolve(pluginIdPath);
                Files.createDirectories(target);

                Files.walkFileTree(source,
                        new PluginTreeCopier(source, target, studioConfiguration, siteId, params, files, true));
            }
        }

        return files;
    }

    protected void addPluginToRegistry(String siteId, Plugin plugin, List<FileRecord> files, List<ConfigRecord> wiring)
            throws MarketplaceRegistryException, IOException {
        PluginRecord record = new PluginRecord();
        record.setId(plugin.getId());
        record.setVersion(plugin.getVersion());
        record.setType(plugin.getType());
        record.setPluginUrl(plugin.getWebsite().getUrl());
        record.setInstallationDate(Instant.now());
        record.setFiles(files);
        record.setConfig(wiring);

        PluginRegistry registry = getPluginRegistry(siteId);
        registry.getPlugins().add(record);

        logger.debug("Add the plugin '{}' version '{}' to the registry in site '{}'",
                plugin.getId(), plugin.getVersion(), siteId);

        Path repoDir = getRepoDirectory(siteId);
        Path registryFile = repoDir.resolve(pluginRegistryPath);
        try (OutputStream os = Files.newOutputStream(registryFile)) {
            mapper.writeValue(os, registry);
            logger.debug("Successfully updated the plugin registry in site '{}'", siteId);
        } catch (JsonProcessingException e) {
            logger.error("Failed to update the plugin registry in site '{}'", siteId, e);
            throw new MarketplaceRegistryException(format("Failed to update the plugin registry in site '%s'",
                    siteId), e);
        }
    }

    protected void removePluginFromRegistry(String siteId, String pluginId)
            throws MarketplaceRegistryException, IOException {
        PluginRegistry registry = getPluginRegistry(siteId);
        registry.getPlugins().removeIf(p -> p.getId().equals(pluginId));

        logger.debug("Remove the plugin '{}' from registry of site '{}'", pluginId, siteId);

        Path repoDir = getRepoDirectory(siteId);
        Path registryFile = repoDir.resolve(pluginRegistryPath);
        try (OutputStream os = Files.newOutputStream(registryFile)) {
            mapper.writeValue(os, registry);
            logger.debug("Successfully updated the plugin registry in site '{}'", siteId);
        } catch (JsonProcessingException e) {
            logger.error("Failed to update the plugin registry in site '{}'", siteId);
            throw new MarketplaceRegistryException(format("Failed to update the plugin registry in site '%s'",
                    siteId), e);
        }
    }

    @Override
    public void copyPlugin(String siteId, String localPath, Map<String, String> parameters)
            throws MarketplaceException {
        Path pluginFolder = Path.of(localPath);
        if (!Files.exists(pluginFolder)) {
            throw new PluginInstallationException(format("The provided path '%s' does not exist", localPath));
        }
        if (!Files.isDirectory(pluginFolder)) {
            throw new PluginInstallationException(format("The provided path '%s' is not a folder", localPath));
        }

        List<String> changedFiles = new LinkedList<>();

        try {
            logger.debug("Copy the plugin from '{}' to site '{}'", localPath, siteId);
            Path descriptorFile = pluginFolder.resolve(pluginDescriptorFilename);
            try (InputStream is = Files.newInputStream(descriptorFile)) {
                PluginDescriptor descriptor = pluginDescriptorReader.read(is);
                Plugin plugin = descriptor.getPlugin();
                Path siteDir = getRepoDirectory(siteId);
                String pluginIdPath = getPluginPath(plugin.getId());

                validatePluginParameters(plugin, parameters);

                createPluginConfig(siteDir, pluginIdPath, parameters, changedFiles);

                var files = new LinkedList<FileRecord>();

                logger.debug("Copy files from plugin '{}' version '{}' to site '{}'",
                        plugin.getId(), plugin.getVersion(), siteId);

                for (Map.Entry<String, String> mapping : folderMapping.entrySet()) {
                    var rootFolder = join(File.separator, mapping.getValue(), pluginsFolder);
                    Path source = pluginFolder.resolve(
                            join(File.separator, mapping.getKey(), pluginsFolder, pluginIdPath));
                    if (Files.exists(source)) {
                        Path target = siteDir.resolve(rootFolder).resolve(pluginIdPath);
                        Files.createDirectories(target);

                        Files.walkFileTree(source, new PluginTreeCopier(source, target, studioConfiguration, siteId,
                                parameters, files, false));
                    }
                }

                files.stream()
                        .map(FileRecord::getPath)
                        .forEach(changedFiles::add);

                // Wire plugin to the site configuration
                performConfigurationWiring(plugin, siteId, changedFiles, null);

                // Wire plugin to the freemarker hooks
                performTemplateWiring(plugin, siteId, files, changedFiles);

                // Commit al changes
                commitChanges(siteId, changedFiles, false, false,
                        format("Copy plugin %s %s", plugin.getId(), plugin.getVersion()));

                logger.info("Successfully copied the plugin '{}' version '{}' to site '{}'",
                        plugin.getId(), plugin.getVersion(), siteId);
            }
        } catch (Exception e) {
            if (CollectionUtils.isNotEmpty(changedFiles)) {
                try {
                    resetChanges(siteId, changedFiles);
                } catch (IOException | GitAPIException e2) {
                    throw new PluginInstallationException(format("Failed to rollback the plugin removal in site '%s'",
                            siteId), e2);
                }
            }
            if (e instanceof MissingPluginParameterException) {
                throw (MissingPluginParameterException) e;
            }
            throw new PluginInstallationException(format("Failed to copy the plugin from '%s' to site '%s'",
                    localPath, siteId), e);
        }
    }

    @Override
    public void removePlugin(String siteId, String pluginId, boolean force) throws ServiceLayerException {
        logger.info("Start the removal of plugin '{}' from site '{}'", pluginId, siteId);
        Optional<PluginRecord> record = getPluginRecord(siteId, pluginId);
        // if the plugin is not installed do anything
        if (record.isEmpty()) {
            logger.info("The plugin '{}' is not installed in site '{}', nothing to do", pluginId, siteId);
            return;
        }

        // check the dependencies
        List<String> dependantItems = getPluginUsage(siteId, pluginId);

        if (!force && CollectionUtils.isNotEmpty(dependantItems)) {
            throw new RemovePluginException(
                    format("The plugin '%s' in site '%s' is in use by one or more items", pluginId, siteId));
        }

        // otherwise, start the removal process
        writeLock.lock();
        List<String> changedFiles = new LinkedList<>();
        try {
            Path repoDir = getRepoDirectory(siteId);

            // Remove configuration file
            removePluginConfig(repoDir, pluginId, changedFiles);

            // Remove wiring from the site configuration
            removeConfigurationWiring(pluginId, siteId, changedFiles, record.get().getConfig());

            // Remove wiring from the freemarker hooks
            removeTemplateWiring(pluginId, siteId, changedFiles);


            // Delete the files created by the plugin
            logger.debug("Delete the files created by the plugin '{}' from site '{}'", pluginId, siteId);
            List<FileRecord> files = record.get().getFiles();
            for (FileRecord file : files) {
                Files.deleteIfExists(repoDir.resolve(file.getPath()));
                changedFiles.add(file.getPath());
            }

            // Remove the plugin from the registry
            removePluginFromRegistry(siteId, pluginId);
            changedFiles.add(pluginRegistryPath);

            // commit all changes
            commitChanges(siteId, changedFiles, true, true, "Remove plugin " + pluginId);
        } catch (IOException | GitAPIException | CommitNotFoundException | EnvironmentNotFoundException |
                SiteNotFoundException | TransformerException | UserNotFoundException e) {
            if (CollectionUtils.isNotEmpty(changedFiles)) {
                try {
                    resetChanges(siteId, changedFiles);
                } catch (IOException | GitAPIException e2) {
                    throw new PluginInstallationException(format("Failed to rollback plugin removal from site '%s'",
                            siteId), e2);
                }
            }
            throw new PluginInstallationException(format("Failed to remove plugin '%s' from site '%s'",
                    pluginId, siteId), e);
        } finally {
            writeLock.unlock();
        }
    }



    @Override
    public HierarchicalConfiguration<?> getPluginConfiguration(String siteId, String pluginId)
            throws ConfigurationException {
        return configurationService.getXmlConfiguration(siteId,
                                                        getPluginConfigurationPath(studioConfiguration, pluginId));
    }

    @Override
    public String getPluginConfigurationAsString(String siteId, String pluginId) throws ContentNotFoundException {
        return configurationService.getConfigurationAsString(siteId, pluginConfigModule,
                getPluginPath(pluginId) + File.separator + pluginConfigFilename, null);
    }

    @Override
    public void writePluginConfiguration(String siteId, String pluginId, String content)
            throws UserNotFoundException, ServiceLayerException {
        configurationService.writeConfiguration(siteId, pluginConfigModule,
                getPluginPath(pluginId) + File.separator + pluginConfigFilename, null,
                IOUtils.toInputStream(content, UTF_8));
    }

    protected void createPluginConfig(Path siteDir, String pluginId, Map<String, String> parameters,
                                      List<String> changedFiles) throws IOException,
            org.apache.commons.configuration2.ex.ConfigurationException {
        XMLConfiguration config = new XMLConfiguration();

        // TODO: SJ: Avoid string literals
        if (MapUtils.isNotEmpty(parameters)) {
            config.setRootElementName("config");
            parameters.forEach(config::addProperty);
        }

        String configPath = removeStart(getPluginConfigurationPath(studioConfiguration, pluginId), File.separator);
        Path configFile = siteDir.resolve(configPath);
        Files.createDirectories(configFile.getParent());
        try (Writer writer = Files.newBufferedWriter(configFile, CREATE)) {
            config.write(writer);
        }
        changedFiles.add(configPath);
    }

    protected void removePluginConfig(Path siteDir, String pluginId,
                                      List<String> changedFiles) throws IOException{

        String configPath = removeStart(getPluginConfigurationPath(studioConfiguration, pluginId), File.separator);
        Path configFile = siteDir.resolve(configPath);
        Files.deleteIfExists(configFile);
        changedFiles.add(configPath);
    }

    protected Optional<PluginRecord> getPluginRecord(String siteId, String pluginId)
            throws MarketplaceRegistryException {
        // get the plugins from the registry
        PluginRegistry registry = getPluginRegistry(siteId);
        // find the plugin to remove
        return registry.getPlugins().stream().filter(r -> r.getId().equals(pluginId)).findFirst();
    }

    public List<String> getPluginUsage(String siteId, String pluginId) throws ServiceLayerException {
        logger.debug("Get all items that depend on the plugin '{}' in site '{}'", pluginId, siteId);
        Optional<PluginRecord> record = getPluginRecord(siteId, pluginId);
        Pattern contentTypeRegex = Pattern.compile(contentTypePattern);
        Set<String> dependantItems = new TreeSet<>();
        List<String> contentTypePaths = record.get().getFiles().stream()
                .map(FileRecord::getPath)
                .map(p -> prependIfMissing(p, File.separator))
                .filter(contentTypeRegex.asMatchPredicate())
                .collect(toList());

        if (CollectionUtils.isNotEmpty(contentTypePaths)) {
            dependantItems = new HashSet<>(dependencyService.getDependentPaths(siteId, contentTypePaths));
        }

        for(String contentTypePath : contentTypePaths) {
            Matcher contentTypeMatcher = contentTypeRegex.matcher(contentTypePath);
            if (contentTypeMatcher.matches()) {
                String contentTypeId = contentTypeMatcher.group(1);
                ContentTypeUsage usage = contentTypeService.getContentTypeUsage(siteId, contentTypeId);
                dependantItems.addAll(usage.getContent());
            }
        }

        logger.debug("Found '{}' item(s) that depend on the plugin '{}' in site '{}' and the items are '{}'" ,
                dependantItems.size(), pluginId, siteId, dependantItems);
        return new ArrayList<>(dependantItems);
    }

    protected Path getRepoDirectory(String siteId) {
        return gitRepositoryHelper.buildRepoPath(GitRepositories.SANDBOX, siteId);
    }

    protected void resetChanges(String siteId, List<String> changedFiles) throws IOException, GitAPIException {
        Path siteDir = getRepoDirectory(siteId);
        try (Git git = Git.open(siteDir.toFile())) {
            CheckoutCommand checkout = git.checkout().addPaths(changedFiles);
            retryingRepositoryOperationFacade.call(checkout);
        }
    }

    protected void commitChanges(String siteId, List<String> changedFiles, boolean update, boolean publish,
                                 String message) throws IOException, GitAPIException, ServiceLayerException,
            UserNotFoundException {
        logger.debug("Commit the changes in site '{}' with the message '{}'", siteId, message);
        Path siteDir = getRepoDirectory(siteId);
        try (Git git = Git.open(siteDir.toFile())) {
            AddCommand add = git.add().setUpdate(update);
            changedFiles.forEach(add::addFilepattern);
            retryingRepositoryOperationFacade.call(add);

            PersonIdent user = gitRepositoryHelper.getCurrentUserIdent();
            CommitCommand commitCommand = git.commit().setAuthor(user).setCommitter(user).setMessage(message);
            RevCommit commit = retryingRepositoryOperationFacade.call(commitCommand);

            if (publish) {
                // publish changes
                logger.debug("Publish the changes in site '{}' with the message '{}'", siteId, message);
                deploymentService.publishCommits(siteId, "live", List.of(commit.getName()), message);
            }
        }
    }

    protected void performConfigurationWiring(Plugin plugin, String siteId, List<String> changedFiles,
                                              List<ConfigRecord> wiring) throws
            TransformerException, IOException, ServiceLayerException, DocumentException {
        if (CollectionUtils.isNotEmpty(plugin.getInstallation())) {
            logger.debug("Wire the plugin '{}' in site '{}'", plugin.getId(), siteId);
            Path repoDir = getRepoDirectory(siteId);
            for(Installation installation : plugin.getInstallation()) {
                try {
                    HierarchicalConfiguration<?> mapping = widgetMapping.configurationAt(installation.getType());
                    if (mapping == null) {
                        throw new PluginInstallationException(format("Unsupported wiring type '%s' for plugin '%s' " +
                                        "in site '%s'", installation.getType(), plugin.getId(), siteId));
                    }

                    String module = mapping.getString(MODULE_CONFIG_KEY);
                    String filePath = mapping.getString(PATH_CONFIG_KEY);
                    String templatePath = mapping.getString(TEMPLATE_CONFIG_KEY);
                    String configPath = getConfigurationPath(module, filePath);
                    Path configFile = repoDir.resolve(configPath);

                    // load the existing configuration
                    String config = Files.readString(configFile);

                    Installation.Element root = installation.getElement();
                    String parentXpath = installation.getParentXpath();
                    Document document = DocumentHelper.parseText(config);

                    // check if the wiring has already been performed
                    if (document.selectSingleNode(installation.getElementXpath()) != null) {
                        logger.debug("Wiring of type '{}' was already performed for plugin '{}' in site '{}'," +
                                        " skip...", installation.getType(), plugin.getId(), siteId);
                        continue;
                    }

                    if (wiring != null) {
                        wiring.add(ConfigRecord.from(installation));
                    }

                    // merge the new XML with the existing configuration (to avoid invalid XML)
                    // get the parent element
                    Node docRoot = document.selectSingleNode(parentXpath);
                    boolean completed = docRoot == null;
                    while (!completed) {
                        // if the parent has only one child, go one level down
                        // if there is more than one child just add the new XML as a sibling
                        List<Node> children = docRoot.selectNodes(root.getName());
                        if (CollectionUtils.isNotEmpty(children) && children.size() == 1) {
                            parentXpath += File.separator + root.getName();
                            root = root.getChildren().get(0);
                            docRoot = children.get(0);
                        } else {
                            completed = true;
                        }
                    }

                    logger.debug("Wire the widget of type '{}' into site '{}'", installation.getType(), siteId);
                    Element element = buildXml(root);

                    String newXml = element.asXML();
                    logger.debug("New configuration XML '{}' for site '{}'", newXml, siteId);

                    var params = new HashMap<String, Object>();
                    params.put(PARAM_NEW_XML, newXml);
                    params.put(PARAM_PLUGIN_ID, plugin.getId());

                    ClassPathResource templateRes = new ClassPathResource(templatePath);
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    String template = IOUtils.toString(templateRes.getInputStream(), UTF_8);

                    template = replace(template, Map.of(PARAM_PARENT_XPATH, parentXpath.replace("\"", "'")));

                    executeTemplate(toInputStream(template, UTF_8), params, null,
                                    toInputStream(config, UTF_8), output);

                    Files.write(configFile, output.toByteArray());
                    changedFiles.add(configPath);
                } catch (ConfigurationRuntimeException e) {
                    logger.warn("Unsupported installation type '{}' for plugin '{}' in site '{}'",
                            installation.getType(), plugin.getId(), siteId);
                }
            }
            logger.debug("Successfully wired the plugin '{}' into site '{}'", plugin.getId(), siteId);
        } else {
            logger.debug("No wiring required for the plugin '{}' while installing it into site '{}'",
                    plugin.getId(), siteId);
        }
    }

    protected void performTemplateWiring(Plugin plugin, String siteId, List<FileRecord> files,
                                         List<String> changedFiles) throws IOException {
        List<String> paths = files.stream().map(FileRecord::getPath).collect(toList());
        String pluginPath = getPluginPath(plugin.getId());
        String pluginIdComment = replace(templateComment, Map.of(PARAM_PLUGIN_ID, plugin.getId()));

        // Check if the plugin contains templates to be wired
        for(Map.Entry<String, String> mapping : templateMapping.entrySet()) {
            String actualPath = replace(mapping.getValue(), Map.of(PARAM_PLUGIN_PATH, pluginPath));
            addIncludeIfNeeded(siteId, plugin.getId(), paths, mapping.getKey(), pluginIdComment, actualPath,
                                changedFiles);
        }
    }

    protected void addIncludeIfNeeded(String siteId, String pluginId, List<String> paths, String includePath,
                                      String includeComment, String pluginPath, List<String> changedFiles)
            throws IOException {
        if (paths.contains(pluginPath)) {
            logger.debug("Detected the template '{}' in the plugin '{}' while installing in site '{}'",
                    pluginPath, pluginId, siteId);
            String fileContent = EMPTY;
            if (contentService.contentExists(siteId, includePath)) {
                logger.debug("Site '{}' already has the template '{}', it will be updated", siteId, includePath);
                fileContent = contentService.getContentAsString(siteId, includePath);
            } else {
                logger.debug("Site '{}' does not have the template '{}', it will be created", siteId, includePath);
            }
            if (isEmpty(fileContent) || !contains(fileContent, includeComment)) {
                logger.debug("Wire the plugin template '{}' into '{}' in site '{}'",
                        pluginPath, includePath, siteId);
                String newLine =
                        format("\n%s%s\n", replace(templateCode,
                                Map.of(PATH_CONFIG_KEY, pluginPath, PARAM_PLUGIN_ID, pluginId)), includeComment);
                fileContent += newLine;

                Path repo = getRepoDirectory(siteId);
                Path templateFile = repo.resolve(includePath);
                Files.createDirectories(templateFile.getParent());
                Files.write(templateFile, fileContent.getBytes());
                changedFiles.add(includePath);
            } else {
                logger.debug("The plugin template '{}' was already wired into '{}' in site '{}'",
                        pluginPath, includePath, siteId);
            }
        }
    }

    protected Element buildXml(Installation.Element element) {
        Element xmlElement = DocumentHelper.createElement(element.getName());
        if (CollectionUtils.isNotEmpty(element.getAttributes())) {
            element.getAttributes().forEach(
                    attribute -> xmlElement.addAttribute(attribute.getName(), attribute.getValue()));
        }
        if (isNotEmpty(element.getValue())) {
            xmlElement.setText(element.getValue());
        }
        if (CollectionUtils.isNotEmpty(element.getChildren())) {
            element.getChildren().forEach(child -> {
                Element xmlChild = buildXml(child);
                xmlElement.add(xmlChild);
            });
        }
        return xmlElement;
    }

    protected void removeTemplateWiring(String pluginId, String siteId, List<String> changedFiles) throws IOException {
        logger.debug("Remove the template wiring of the plugin '{}' from site '{}'", pluginId, siteId);
        Path repo = getRepoDirectory(siteId);

        // Check all possible hooks
        for(Map.Entry<String, String> mapping : templateMapping.entrySet()) {
            Path hookFile = repo.resolve(mapping.getKey());
            if (Files.exists(hookFile)) {
                // load the content
                List<String> lines = Files.readAllLines(hookFile);
                // remove the lines related to the given plugin
                List<String> newLines = lines.stream()
                                             .filter(not(line -> contains(line, pluginId)))
                                             .collect(toList());
                // write the changes if any
                if (newLines.size() < lines.size()) {
                    Files.write(hookFile, newLines);
                    changedFiles.add(mapping.getKey());
                }
            }
        }

        logger.debug("Successfully removed the template wiring of plugin '{}' from site '{}'", pluginId, siteId);
    }

    protected void removeConfigurationWiring(String pluginId, String siteId, List<String> changedFiles,
                                             List<ConfigRecord> changedConfigurations) throws
            IOException, TransformerException {
            if (CollectionUtils.isNotEmpty(changedConfigurations)) {
                logger.debug("Remove the configuration wiring of plugin '{}' from site '{}'", pluginId, siteId);

                for (ConfigRecord record : changedConfigurations) {
                    HierarchicalConfiguration<?> mapping = widgetMapping.configurationAt(record.getType());
                    String module = mapping.getString(MODULE_CONFIG_KEY);
                    String filePath = mapping.getString(PATH_CONFIG_KEY);
                    String configPath = getConfigurationPath(module, filePath);

                    // load the existing configuration
                    Path repo = getRepoDirectory(siteId);
                    Path configFile = repo.resolve(configPath);

                    String configContent = Files.readString(configFile);
                    Map<String, Object> params = Map.of("elementXpath", record.getElementXpath().replace("\"", "'"));

                    try (InputStream templateIs = widgetRemoveTemplate.getInputStream()) {
                        String templateContent = IOUtils.toString(templateIs, UTF_8);
                        templateContent = StringSubstitutor.replace(templateContent, params);

                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        XsltUtils.executeTemplate(toInputStream(templateContent, UTF_8), null, null,
                                                  toInputStream(configContent, UTF_8), out);

                        Files.write(configFile, out.toByteArray());
                        changedFiles.add(configPath);
                    }
                }

                logger.debug("Successfully removed the configuration wiring of plugin '{}' from site '{}'",
                        pluginId, siteId);
            }
    }

    protected String getConfigurationPath(String module, String filePath) {
        String basePath = studioConfiguration.getProperty(CONFIGURATION_SITE_CONFIG_BASE_PATH_PATTERN)
                                             .replaceAll(PATTERN_MODULE, module);
        return Path.of(removeStart(basePath, File.separator), filePath).toString();
    }

    

}
