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

import java.util.List;
import java.util.Set;

import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.BITMAP_CONTENT_READ;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.BITMAP_CONTENT_WRITE;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.mapPermissionsToContentItemAvailableActions;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_COPY;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_WRITE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_GET_CHILDREN;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_PUBLISH_REQUEST;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Before;
import org.junit.Test;

import org.craftercms.studio.api.v2.security.RolePermissionMappings;
import org.craftercms.studio.impl.v2.security.RolePermissionMappingsImpl;

public class RolePermissionMappingsImplTest {

	private RolePermissionMappingsImpl mappings;

	@Before
	public void setUp() {
		mappings = new RolePermissionMappingsImpl();
	}

	@Test
	public void getActionsForPathCombinesMatchingRules() {
		mappings.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_READ));
		mappings.addRuleContentItemPermissionsMapping("/site/website/articles/.*",
			List.of(PERMISSION_CONTENT_WRITE));

		long actions = mappings.getActionsForPath("/site/website/articles/2024/index.xml");

		assertEquals(BITMAP_CONTENT_READ | BITMAP_CONTENT_WRITE, actions);
	}

	@Test
	public void getActionsForPathReturnsZeroWhenNoRuleMatches() {
		mappings.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_READ));

		assertEquals(0L, mappings.getActionsForPath("/site/components/item.xml"));
	}

	@Test
	public void getPermissionsForPathReturnsOnlyMatchingRulePermissions() {
		mappings.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_READ, PERMISSION_CONTENT_WRITE));
		mappings.addRuleContentItemPermissionsMapping("/site/components/.*",
			List.of(PERMISSION_CONTENT_COPY));

		Set<String> permissions = mappings.getPermissionsForPath("/site/website/index.xml");

		assertEquals(Set.of(PERMISSION_CONTENT_READ, PERMISSION_CONTENT_WRITE), permissions);
		assertFalse(permissions.contains(PERMISSION_CONTENT_COPY));
	}

	@Test
	public void getAllPermissionsReturnsPermissionsFromAllRules() {
		mappings.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_READ));
		mappings.addRuleContentItemPermissionsMapping("/site/components/.*",
			List.of(PERMISSION_CONTENT_COPY));

		assertEquals(
			Set.of(PERMISSION_CONTENT_READ, PERMISSION_CONTENT_COPY),
			Set.copyOf(mappings.getAllPermissions()));
	}

	@Test
	public void getSiteWidePermissionsIncludesOnlySiteWideRegexRules() {
		mappings.addRuleContentItemPermissionsMapping(".*",
			List.of(PERMISSION_GET_CHILDREN, PERMISSION_PUBLISH_REQUEST));
		mappings.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_WRITE));

		assertEquals(
			Set.of(PERMISSION_GET_CHILDREN, PERMISSION_PUBLISH_REQUEST),
			Set.copyOf(mappings.getSiteWidePermissions()));
	}

	@Test
	public void getSiteWidePermissionsSupportsSlashDotStarRegex() {
		mappings.addRuleContentItemPermissionsMapping("/.*",
			List.of(PERMISSION_PUBLISH_REQUEST));

		assertTrue(mappings.getSiteWidePermissions().contains(PERMISSION_PUBLISH_REQUEST));
	}

	@Test
	public void addRuleStoresMappedActionsBitmap() {
		mappings.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_READ, PERMISSION_CONTENT_WRITE));

		long expected = mapPermissionsToContentItemAvailableActions(
			List.of(PERMISSION_CONTENT_READ, PERMISSION_CONTENT_WRITE));

		assertEquals(expected, mappings.getActionsForPath("/site/website/index.xml"));
	}
}
