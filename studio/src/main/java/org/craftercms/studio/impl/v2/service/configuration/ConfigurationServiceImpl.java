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
package org.craftercms.studio.impl.v2.service.configuration;

import java.io.InputStream;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.security.permissions.annotations.ProtectedResourceId;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPath;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.security.NormalizedGroup;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.model.config.TranslationConfiguration;
import org.craftercms.studio.model.i18n.Language;
import org.craftercms.studio.model.rest.ConfigurationHistory;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PATH_RESOURCE_ID;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_READ_CONFIGURATION;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_WRITE_CONFIGURATION;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_WRITE_GLOBAL_CONFIGURATION;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.SITE_ID_RESOURCE_ID;
import org.dom4j.Document;
import org.springframework.core.io.Resource;


public class ConfigurationServiceImpl implements ConfigurationService {

	private ConfigurationService configurationServiceInternal;

	@SuppressWarnings("unused")
	public void setConfigurationServiceInternal(ConfigurationService configurationServiceInternal) {
		this.configurationServiceInternal = configurationServiceInternal;
	}

	@Override
	public Map<NormalizedGroup, List<NormalizedRole>> getRoleMappings(String siteId) throws ServiceLayerException {
		return configurationServiceInternal.getRoleMappings(siteId);
	}

	@Override
	public Map<NormalizedGroup, List<NormalizedRole>> getGlobalRoleMappings() throws ServiceLayerException {
		return configurationServiceInternal.getGlobalRoleMappings();
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	@LogExecutionTime
	public String getConfigurationAsString(@SiteId String siteId,
					       String module,
					       @ProtectedResourceId(PATH_RESOURCE_ID) String path,
					       String environment) throws ServiceLayerException {
		return configurationServiceInternal.getConfigurationAsString(siteId, module, path, environment);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	public Document getConfigurationAsDocument(@ProtectedResourceId(SITE_ID_RESOURCE_ID) String siteId, String module,
						   String path, String environment) throws ServiceLayerException {
		return configurationServiceInternal.getConfigurationAsDocument(siteId, module, path, environment);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	public HierarchicalConfiguration<?> getXmlConfiguration(@SiteId String siteId, @ContentPath String path) throws ConfigurationException {
		return configurationServiceInternal.getXmlConfiguration(siteId, path);
	}

	@Override
	public HierarchicalConfiguration<?> getXmlConfiguration(String siteId, String module, String path) throws ConfigurationException {
		return configurationServiceInternal.getXmlConfiguration(siteId, module, path);
	}

	@Override
	public HierarchicalConfiguration<?> getGlobalXmlConfiguration(String path) throws ConfigurationException {
		return configurationServiceInternal.getGlobalXmlConfiguration(path);
	}

	@Override
	public Document getGlobalConfigurationAsDocument(String path) throws ServiceLayerException {
		return configurationServiceInternal.getGlobalConfigurationAsDocument(path);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_GLOBAL_CONFIGURATION)
	public String getGlobalConfigurationAsString(@ProtectedResourceId(PATH_RESOURCE_ID) String path) throws ServiceLayerException {
		return configurationServiceInternal.getGlobalConfigurationAsString(path);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_CONFIGURATION)
	public void writeConfiguration(@SiteId String siteId,
				       String module,
				       @ProtectedResourceId(PATH_RESOURCE_ID) String path,
				       String environment,
				       InputStream content)
		throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		configurationServiceInternal.writeConfiguration(siteId, module, path, environment, content);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	public String getCacheKey(String siteId, String module, String path, String environment, String suffix) throws SiteNotFoundException {
		return configurationServiceInternal.getCacheKey(siteId, module, path, environment, suffix);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Resource getPluginFile(@SiteId String siteId,
				      String pluginId,
				      String type,
				      String name,
				      String filename)
		throws ContentNotFoundException, SiteNotFoundException {
		return configurationServiceInternal.getPluginFile(siteId, pluginId, type, name, filename);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	public ConfigurationHistory getConfigurationHistory(@SiteId String siteId,
							    String module,
							    @ProtectedResourceId(PATH_RESOURCE_ID) String path,
							    String environment)
		throws ServiceLayerException, UserNotFoundException {
		return configurationServiceInternal.getConfigurationHistory(siteId, module, path, environment);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_GLOBAL_CONFIGURATION)
	public void writeGlobalConfiguration(@ProtectedResourceId(PATH_RESOURCE_ID) String path, InputStream content)
			throws ServiceLayerException, UserNotFoundException {
		configurationServiceInternal.writeGlobalConfiguration(path, content);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	public TranslationConfiguration getTranslationConfiguration(@SiteId String siteId) throws ServiceLayerException {
		return configurationServiceInternal.getTranslationConfiguration(siteId);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_CONFIGURATION)
	public void invalidateConfiguration(@SiteId String siteId, @ContentPath String path) throws SiteNotFoundException {
		configurationServiceInternal.invalidateConfiguration(siteId, path);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_CONFIGURATION)
	public void invalidateConfiguration(@SiteId String siteId, String module, String path, String environment) throws SiteNotFoundException {
		configurationServiceInternal.invalidateConfiguration(siteId, module, path, environment);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_CONFIGURATION)
	public void invalidateConfiguration(@SiteId String siteId) {
		configurationServiceInternal.invalidateConfiguration(siteId);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_CONFIGURATION)
	public void makeBlobStoresReadOnly(final String siteId) throws ServiceLayerException {
		configurationServiceInternal.makeBlobStoresReadOnly(siteId);
	}

	@Override
	public List<NormalizedGroup> getSiteGroups(String siteId) throws ServiceLayerException {
		return configurationServiceInternal.getSiteGroups(siteId);
	}

	@Override
	public Collection<Language> getAvailableLanguages() throws ServiceLayerException {
		return configurationServiceInternal.getAvailableLanguages();
	}
}
