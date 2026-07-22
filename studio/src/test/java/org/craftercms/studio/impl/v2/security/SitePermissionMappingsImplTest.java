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

import java.util.Collections;
import static java.util.Collections.emptySet;
import java.util.List;
import java.util.Set;

import org.craftercms.studio.api.v2.dal.Group;
import org.craftercms.studio.api.v2.dal.security.NormalizedGroup;
import org.craftercms.studio.api.v2.dal.security.NormalizedRole;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.BITMAP_CONTENT_CREATE;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.BITMAP_CONTENT_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_CREATE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_WRITE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_GET_CHILDREN;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import org.junit.Before;
import org.junit.Test;

public class SitePermissionMappingsImplTest {

	private SitePermissionMappingsImpl mappings;

	@Before
	public void setUp() {
		mappings = editorialSiteMappings();
	}

	@Test
	public void test_getAvailableActions_mergesGroupRoleAndWildcardRules() {
		long actions = mappings.getAvailableActions(
			"jane",
			List.of(group("site_author")),
			"/site/website/articles/index.xml");

		assertEquals(BITMAP_CONTENT_READ | BITMAP_CONTENT_CREATE, actions);
	}

	@Test
	public void getAvailableActionsUsesDirectUserRoleMappingWithoutGroups() {
		SitePermissionMappingsImpl userMapped = new SitePermissionMappingsImpl();
		userMapped.addGroupToRolesMapping(new NormalizedGroup("jane"),
			List.of(new NormalizedRole("author")));
		userMapped.addRolePermissionMapping("author", authorRoleMappings());
		userMapped.addRolePermissionMapping("*", wildcardRoleMappings());

		long actions = userMapped.getAvailableActions("jane", Collections.emptyList(),
			"/site/website/index.xml");

		assertEquals(BITMAP_CONTENT_READ | BITMAP_CONTENT_CREATE, actions);
	}

	@Test
	public void getAvailableActionsReturnsZeroWhenUserHasNoRoles() {
		assertEquals(0L, mappings.getAvailableActions("unknown", Collections.emptyList(),
			"/site/website/index.xml"));
	}

	@Test
	public void isSiteAdminReturnsTrueWhenUserHasAdminRole() {
		SitePermissionMappingsImpl adminMappings = new SitePermissionMappingsImpl();
		adminMappings.addGroupToRolesMapping(new NormalizedGroup("site_admin"),
			List.of(new NormalizedRole("admin")));
		adminMappings.addRolePermissionMapping("admin", authorRoleMappings());
		adminMappings.addRolePermissionMapping("*", wildcardRoleMappings());

		assertTrue(adminMappings.isSiteAdmin("admin-user", List.of(group("site_admin"))));
	}

	@Test
	public void isSiteAdminReturnsFalseForNonAdminRole() {
		assertFalse(mappings.isSiteAdmin("jane", List.of(group("site_author"))));
	}

	@Test
	public void getUserPermissionsAsSystemAdminReturnsAllConfiguredPermissions() {
		Set<String> permissions = mappings.getUserPermissions("sysadmin", Collections.emptyList(), true);

		assertTrue(permissions.contains(PERMISSION_CONTENT_READ));
		assertTrue(permissions.contains(PERMISSION_CONTENT_CREATE));
		assertTrue(permissions.contains(PERMISSION_GET_CHILDREN));
	}

	@Test
	public void getUserPermissionsIncludesWildcardRolePermissions() {
		Set<String> permissions = mappings.getUserPermissions("jane", List.of(group("site_author")), false);

		assertTrue(permissions.contains(PERMISSION_CONTENT_READ));
		assertTrue(permissions.contains(PERMISSION_CONTENT_CREATE));
		assertTrue(permissions.contains(PERMISSION_GET_CHILDREN));
	}

	@Test
	public void getUserPermissionsForPathFiltersByRegex() {
		Set<String> permissions = mappings.getUserPermissions(
			"jane",
			List.of(group("site_author")),
			"/site/website/index.xml",
			false);

		assertEquals(Set.of(PERMISSION_CONTENT_READ, PERMISSION_CONTENT_CREATE, PERMISSION_GET_CHILDREN),
			permissions);
	}

	@Test
	public void getUserPermissionsForPathExcludesNonMatchingRoleRules() {
		RolePermissionMappingsImpl authorRules = new RolePermissionMappingsImpl();
		authorRules.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_READ));
		authorRules.addRuleContentItemPermissionsMapping("/site/components/.*",
			List.of(PERMISSION_CONTENT_WRITE));

		SitePermissionMappingsImpl siteMappings = new SitePermissionMappingsImpl();
		siteMappings.addGroupToRolesMapping(new NormalizedGroup("site_author"),
			List.of(new NormalizedRole("author")));
		siteMappings.addRolePermissionMapping("author", authorRules);
		siteMappings.addRolePermissionMapping("*", wildcardRoleMappings());

		Set<String> permissions = siteMappings.getUserPermissions(
			"jane",
			List.of(group("site_author")),
			"/site/website/index.xml",
			false);

		assertTrue(permissions.contains(PERMISSION_CONTENT_READ));
		assertTrue(permissions.contains(PERMISSION_GET_CHILDREN));
		assertFalse(permissions.contains(PERMISSION_CONTENT_WRITE));
	}

	@Test
	public void getUserPermissionsReturnsEmptySetWhenUserHasNoRoles() {
		Set<String> sitePermissions = mappings.getUserPermissions("unknown", Collections.emptyList(), false);
		Set<String> pathPermissions = mappings.getUserPermissions("unknown", Collections.emptyList(),
			"/site/website/index.xml", false);

		assertEquals(emptySet(), sitePermissions);
		assertEquals(emptySet(), pathPermissions);
	}

	@Test
	public void getUserPermissionsReturnsEmptySetWhenSiteHasNoRoles() {
		SitePermissionMappingsImpl siteMappings = new SitePermissionMappingsImpl();

		Set<String> sitePermissions = siteMappings.getUserPermissions("jane", Collections.emptyList(), false);
		Set<String> pathPermissions = siteMappings.getUserPermissions("jane", Collections.emptyList(),
			"/site/website/index.xml", false);

		assertEquals(emptySet(), sitePermissions);
		assertEquals(emptySet(), pathPermissions);
	}

	@Test
	public void getUserPermissionsReturnsContentReadWhenUserHasNoMappedPermission() {
		Set<String> sitePermissions = mappings.getUserPermissions("unknown", List.of(group("no_permissions")), false);
		Set<String> pathPermissions = mappings.getUserPermissions("unknown", List.of(group("no_permissions")),
			"/site/website/index.xml", false);

		assertEquals(Set.of(PERMISSION_GET_CHILDREN, PERMISSION_CONTENT_READ), sitePermissions);
		assertEquals(Set.of(PERMISSION_GET_CHILDREN, PERMISSION_CONTENT_READ), pathPermissions);
	}

	private static SitePermissionMappingsImpl editorialSiteMappings() {
		SitePermissionMappingsImpl siteMappings = new SitePermissionMappingsImpl();
		siteMappings.addGroupToRolesMapping(new NormalizedGroup("site_author"),
			List.of(new NormalizedRole("author")));
		siteMappings.addRolePermissionMapping("author", authorRoleMappings());
		siteMappings.addRolePermissionMapping("*", wildcardRoleMappings());
		siteMappings.addGroupToRolesMapping(new NormalizedGroup("no_permissions"), List.of(new NormalizedRole("no_permissions")));
		return siteMappings;
	}

	private static RolePermissionMappingsImpl authorRoleMappings() {
		RolePermissionMappingsImpl roleMappings = new RolePermissionMappingsImpl();
		roleMappings.addRuleContentItemPermissionsMapping("/site/website/.*",
			List.of(PERMISSION_CONTENT_READ, PERMISSION_CONTENT_CREATE));
		return roleMappings;
	}

	private static RolePermissionMappingsImpl wildcardRoleMappings() {
		RolePermissionMappingsImpl roleMappings = new RolePermissionMappingsImpl();
		roleMappings.addRuleContentItemPermissionsMapping(".*",
			List.of(PERMISSION_CONTENT_READ, PERMISSION_GET_CHILDREN));
		return roleMappings;
	}

	private static Group group(String name) {
		Group group = new Group();
		group.setGroupName(name);
		return group;
	}
}
