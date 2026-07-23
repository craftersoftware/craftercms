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

package org.craftercms.studio.impl.v2.security;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import static org.craftercms.studio.api.v1.constant.StudioConstants.MODULE_STUDIO;
import org.craftercms.studio.api.v1.constant.StudioXmlConstants;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.dal.security.NormalizedGroup;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import org.craftercms.studio.api.v2.security.PermissionMappingsProvider;
import org.craftercms.studio.api.v2.security.SitePermissionMappings;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_ENVIRONMENT_ACTIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_CONFIG_BASE_PATH;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_PERMISSION_MAPPINGS_FILE_NAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_ROLE_MAPPINGS_FILE_NAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_SYSTEM_SITE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_PERMISSION_MAPPINGS_FILE_NAME;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_ROLE_MAPPINGS_FILE_NAME;
import org.dom4j.Document;
import org.dom4j.Element;
import org.dom4j.Node;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.common.cache.Cache;

/**
 * Keeps a cached mapping of roles and available actions.
 * Allow access to path-constrained and site-wide available actions.
 */
public class PermissionMappingsProviderImpl implements PermissionMappingsProvider {

	private static final Logger logger = LoggerFactory.getLogger(PermissionMappingsProviderImpl.class);

	public static final String CACHE_KEY = ":available-actions";

	private final Cache<String, SitePermissionMappingsImpl> cache;
	private final StudioConfiguration studioConfiguration;
	private final ConfigurationService configurationService;

	public PermissionMappingsProviderImpl(Cache<String, SitePermissionMappingsImpl> cache,
										  StudioConfiguration studioConfiguration,
										  ConfigurationService configurationService) {
		this.cache = cache;
		this.studioConfiguration = studioConfiguration;
		this.configurationService = configurationService;
	}

	@Override
	public SitePermissionMappings getPermissionMappings(String site) throws ServiceLayerException {
		var cacheKey = site + CACHE_KEY;
		SitePermissionMappingsImpl mappings = cache.getIfPresent(cacheKey);
		if (mappings == null) {
			logger.debug("Cache miss for site '{}' cache key '{}'", site, cacheKey);
			mappings = fetchSitePermissionMappings(site);
			cache.put(cacheKey, mappings);
		}
		return mappings;
	}

	private SitePermissionMappingsImpl fetchSitePermissionMappings(String site) throws ServiceLayerException {
		SitePermissionMappingsImpl sitePermissionMappings = new SitePermissionMappingsImpl();

		if (isNotEmpty(site) && !CS.equals(site, studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE))) {
			Document roleMappingsDocument = configurationService.getConfigurationAsDocument(site, MODULE_STUDIO,
				studioConfiguration.getProperty(CONFIGURATION_SITE_ROLE_MAPPINGS_FILE_NAME),
				studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE));
			Document permissionsMappingsDocument = configurationService.getConfigurationAsDocument(site, MODULE_STUDIO,
				studioConfiguration.getProperty(CONFIGURATION_SITE_PERMISSION_MAPPINGS_FILE_NAME),
				studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE));
			loadRoles(roleMappingsDocument, sitePermissionMappings);
			loadPermissions(permissionsMappingsDocument, sitePermissionMappings);
		} else {
			String globalRolesConfigPath = studioConfiguration.getProperty(CONFIGURATION_GLOBAL_CONFIG_BASE_PATH) +
					FILE_SEPARATOR + studioConfiguration.getProperty(CONFIGURATION_GLOBAL_ROLE_MAPPINGS_FILE_NAME);
			Document globalRoleMappingsDocument = configurationService
					.getGlobalConfigurationAsDocument(globalRolesConfigPath);

			String globalPermissionsConfigPath = studioConfiguration.getProperty(CONFIGURATION_GLOBAL_CONFIG_BASE_PATH)
					+ FILE_SEPARATOR +
					studioConfiguration.getProperty(CONFIGURATION_GLOBAL_PERMISSION_MAPPINGS_FILE_NAME);
			Document globalPermissionMappingsDocument = configurationService
					.getGlobalConfigurationAsDocument(globalPermissionsConfigPath);

			loadRoles(globalRoleMappingsDocument, sitePermissionMappings);
			loadPermissions(globalPermissionMappingsDocument, sitePermissionMappings);
		}
		return sitePermissionMappings;
	}

	private void loadPermissions(Document document, SitePermissionMappingsImpl sitePermissionMappings) {
		Element permissionsRoot = document.getRootElement();
		if (permissionsRoot.getName().equals(StudioXmlConstants.DOCUMENT_PERMISSIONS)) {
			Element siteNode = (Element) permissionsRoot.selectSingleNode(StudioXmlConstants.DOCUMENT_ELM_SITE);
			if (siteNode != null) {
				permissionsRoot = siteNode;
			}

			List<Node> roleNodes = permissionsRoot.selectNodes(StudioXmlConstants.DOCUMENT_ELM_PERMISSION_ROLE);
			for (Node roleNode : roleNodes) {
				String roleName = roleNode.valueOf(StudioXmlConstants.DOCUMENT_ATTR_NAME);
				RolePermissionMappingsImpl rolePermissionMappings = new RolePermissionMappingsImpl();
				List<Node> ruleNodes = roleNode.selectNodes(StudioXmlConstants.DOCUMENT_ELM_PERMISSION_RULE);
				ruleNodes.forEach(r -> {
					String regex = r.valueOf(StudioXmlConstants.DOCUMENT_ATTR_REGEX);
					List<Node> permissionNodes = r.selectNodes(StudioXmlConstants.DOCUMENT_ELM_ALLOWED_PERMISSIONS);
					List<String> permissions = permissionNodes.stream()
					.map(Node::getText)
					.map(permission -> permission.toLowerCase(Locale.ROOT))
					.toList();
					rolePermissionMappings.addRuleContentItemPermissionsMapping(regex, permissions);
				});
				sitePermissionMappings.addRolePermissionMapping(roleName, rolePermissionMappings);
			}
		}
	}

	private void loadRoles(Document document, SitePermissionMappingsImpl sitePermissionMappings) {
		Element root = document.getRootElement();
		if (root.getName().equals(StudioXmlConstants.DOCUMENT_ROLE_MAPPINGS)) {
			Map<NormalizedGroup, List<NormalizedRole>> rolesMap = new HashMap<>();

			List<Node> userNodes = root.selectNodes(StudioXmlConstants.DOCUMENT_ELM_USER_NODE);
			rolesMap = getRoles(userNodes, rolesMap);

			List<Node> groupNodes = root.selectNodes(StudioXmlConstants.DOCUMENT_ELM_GROUPS_NODE);
			rolesMap = getRoles(groupNodes, rolesMap);

			rolesMap.forEach(sitePermissionMappings::addGroupToRolesMapping);
		}
	}

	private Map<NormalizedGroup, List<NormalizedRole>> getRoles(List<Node> nodes, Map<NormalizedGroup,
		List<NormalizedRole>> rolesMap) {
		for (Node node : nodes) {
			String groupName = node.valueOf(StudioXmlConstants.DOCUMENT_ATTR_NAME);
			if (!StringUtils.isEmpty(groupName)) {
				List<Node> roleNodes = node.selectNodes(StudioXmlConstants.DOCUMENT_ELM_PERMISSION_ROLE);
				List<NormalizedRole> roles = new ArrayList<>();
				for (Node roleNode : roleNodes) {
					roles.add(new NormalizedRole(roleNode.getText()));
				}
				rolesMap.put(new NormalizedGroup(groupName), roles);
			}
		}
		return rolesMap;
	}

}
