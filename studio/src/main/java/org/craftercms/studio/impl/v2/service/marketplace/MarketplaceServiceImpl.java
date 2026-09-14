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

package org.craftercms.studio.impl.v2.service.marketplace;

import jakarta.validation.Valid;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.craftercms.commons.plugin.model.Version;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.validation.annotations.param.ValidateSecurePathParam;
import org.craftercms.commons.validation.annotations.param.ValidateStringParam;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteUrlException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.exception.marketplace.MarketplaceException;
import org.craftercms.studio.api.v2.service.marketplace.MarketplaceService;
import org.craftercms.studio.api.v2.service.marketplace.registry.PluginRecord;
import org.craftercms.studio.model.rest.marketplace.CreateSiteFromMarketplaceRequest;

import java.beans.ConstructorProperties;
import java.util.List;
import java.util.Map;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

/**
 * Default implementation of {@link MarketplaceService} that proxies all request to the configured Marketplace
 *
 * @author joseross
 * @since 3.1.2
 */
public class MarketplaceServiceImpl implements MarketplaceService {

	protected final MarketplaceService marketplaceServiceInternal;

	@ConstructorProperties({"marketplaceServiceInternal"})
	public MarketplaceServiceImpl(MarketplaceService marketplaceServiceInternal) {
		this.marketplaceServiceInternal = marketplaceServiceInternal;
	}

	@Override
	@Valid
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_SEARCH_PLUGINS)
	public Map<String, Object> searchPlugins(@ValidateStringParam String type,
						 @ValidateStringParam String keywords,
						 boolean showIncompatible, long offset, long limit)
		throws MarketplaceException {
		return marketplaceServiceInternal.searchPlugins(type, keywords, showIncompatible, offset, limit);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CREATE_SITE)
	public void createSite(CreateSiteFromMarketplaceRequest request) throws RemoteRepositoryNotFoundException,
		InvalidRemoteRepositoryException, InvalidRemoteUrlException,
		ServiceLayerException, InvalidRemoteRepositoryCredentialsException {
		marketplaceServiceInternal.createSite(request);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_LIST_PLUGINS)
	public List<PluginRecord> getInstalledPlugins(@SiteId String siteId)
		throws MarketplaceException {
		return marketplaceServiceInternal.getInstalledPlugins(siteId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_INSTALL_PLUGINS)
	public void installPlugin(@SiteId String siteId,
				  String pluginId, Version pluginVersion, Map<String, String> parameters)
		throws MarketplaceException {
		marketplaceServiceInternal.installPlugin(siteId, pluginId, pluginVersion, parameters);
	}

	@Override
	@Valid
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_INSTALL_PLUGINS)
	public void copyPlugin(@SiteId String siteId,
			       @ValidateSecurePathParam String path,
			       Map<String, String> parameters) throws MarketplaceException {
		marketplaceServiceInternal.copyPlugin(siteId, path, parameters);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_REMOVE_PLUGINS)
	public void removePlugin(@SiteId String siteId, String pluginId, boolean force)
		throws ServiceLayerException {
		marketplaceServiceInternal.removePlugin(siteId, pluginId, force);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_REMOVE_PLUGINS)
	public List<String> getPluginUsage(@SiteId String siteId, String pluginId)
		throws ServiceLayerException {
		return marketplaceServiceInternal.getPluginUsage(siteId, pluginId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public HierarchicalConfiguration<?> getPluginConfiguration(@SiteId String siteId,
								   String pluginId)
		throws ConfigurationException {
		return marketplaceServiceInternal.getPluginConfiguration(siteId, pluginId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public String getPluginConfigurationAsString(@SiteId String siteId,
						     String pluginId) throws ServiceLayerException {
		return marketplaceServiceInternal.getPluginConfigurationAsString(siteId, pluginId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_CONFIGURATION)
	public void writePluginConfiguration(@SiteId String siteId,
					     String pluginId, String content)
		throws UserNotFoundException, ServiceLayerException, AuthenticationException {
		marketplaceServiceInternal.writePluginConfiguration(siteId, pluginId, content);
	}

}
