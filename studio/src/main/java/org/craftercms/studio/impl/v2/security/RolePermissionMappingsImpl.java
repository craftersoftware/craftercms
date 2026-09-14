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

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.mapPermissionsToContentItemAvailableActions;
import org.craftercms.studio.api.v2.security.RolePermissionMappings;
import org.craftercms.studio.permissions.StudioPermissionsConstants;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.SITE_WIDE_RULE_REGEXES;

/**
 * Maps role rules to item available actions.
 * Instances will keep a map of rules to available actions for a given role.
 * It will also keep a set of site wide permissions. These are meant to be merged for all roles and then be used
 * to determine site-wide actions. e.g.: a user can be assigned a role with PUBLISH_REQUEST permission and another
 * one with PUBLISH_REVIEW permission. Such user would get the PUBLISH available action.
 */
public class RolePermissionMappingsImpl implements RolePermissionMappings {

	// Rule path -> available actions
	private final Map<Pattern, PermissionsActions> ruleContentItemPermissions = new HashMap<>();
	private final Set<String> siteWidePermissions = new HashSet<>();

	/**
	 * Add a rule to this role mappings
	 *
	 * @param ruleRegex   regex to match the content item paths
	 * @param permissions granted permissions for the rule
	 */
	void addRuleContentItemPermissionsMapping(final String ruleRegex, final Collection<String> permissions) {
		Pattern pattern = Pattern.compile(ruleRegex);
		// Copy the permissions to a set to avoid modifying the original collection
		HashSet<String> permissionsSet = new HashSet<>(permissions);
		PermissionsActions permissionsActions = new PermissionsActions(permissionsSet, mapPermissionsToContentItemAvailableActions(permissionsSet));
		ruleContentItemPermissions.put(pattern, permissionsActions);
		if (SITE_WIDE_RULE_REGEXES.stream().anyMatch(ruleRegex::equals)) {
			this.siteWidePermissions.addAll(permissionsSet);
		}
	}

	@Override
	public long getActionsForPath(final String path) {
		return ruleContentItemPermissions.entrySet().stream()
			.filter(entry -> entry.getKey().matcher(path).matches())
			.map(Map.Entry::getValue)
			.mapToLong(PermissionsActions::actions)
			.reduce(0L, (a, b) -> a | b);
	}

	@Override
	public Set<String> getPermissionsForPath(final String path) {
		return ruleContentItemPermissions.entrySet().stream()
			.filter(entry -> entry.getKey().matcher(path).matches())
			.map(Map.Entry::getValue)
			.map(PermissionsActions::permissions)
			.flatMap(Collection::stream)
			.collect(Collectors.toSet());
	}

	/**
	 * Get the site wide permissions for this role.
	 * The site-wide permissions are the ones found in rules matching {@link StudioPermissionsConstants#SITE_WIDE_RULE_REGEXES}
	 *
	 * @return list of permissions
	 */
	@Override
	public Collection<String> getSiteWidePermissions() {
		return Set.copyOf(siteWidePermissions);
	}

	@Override
	public Collection<String> getAllPermissions() {
		return ruleContentItemPermissions.values().stream()
			.map(PermissionsActions::permissions)
			.flatMap(Collection::stream)
			.collect(Collectors.toSet());
	}

	/**
	 * Record to store permissions and actions for a given rule.
	 *
	 * @param permissions permissions for the rule
	 * @param actions mapped actions for the rule
	 */
	protected record PermissionsActions(Collection<String> permissions, long actions) {
	}
}
