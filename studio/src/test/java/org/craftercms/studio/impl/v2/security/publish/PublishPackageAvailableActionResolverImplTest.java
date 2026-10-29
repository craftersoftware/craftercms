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

package org.craftercms.studio.impl.v2.security.publish;

import java.util.List;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState;
import org.craftercms.studio.api.v2.security.PermissionMappingsProvider;
import org.craftercms.studio.api.v2.security.SitePermissionMappings;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.rest.Person;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.MockitoJUnitRunner;

import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.APPROVED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.REJECTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.SUBMITTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.CANCELLED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.COMPLETED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.APPROVE;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.CANCEL;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.REJECT;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.RESUBMIT;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.UPDATE;
import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class PublishPackageAvailableActionResolverImplTest {

	private static final String SITE_ID = "editorial";
	private static final long PACKAGE_ID = 42L;
	private static final String CURRENT_USER = "reviewer";
	private static final String OTHER_USER = "author";
	private static final long ALL_ACTIONS = APPROVE | REJECT | CANCEL | RESUBMIT | UPDATE;
	private static final long READY_OPEN = APPROVE | REJECT | UPDATE | CANCEL;

	private static final List<FilterCase> FILTER_CASES = List.of(
			new FilterCase("submitter loses approve when peer review is on",
					true, true, ALL_ACTIONS, READY, SUBMITTED, REJECT | UPDATE | CANCEL),
			new FilterCase("submitter keeps approve when peer review is off",
					true, false, ALL_ACTIONS, READY, SUBMITTED, READY_OPEN),
			new FilterCase("submitter loses approve on a rejected package",
					true, true, ALL_ACTIONS, READY, REJECTED, CANCEL),
			new FilterCase("peer keeps approve and loses update",
					false, true, ALL_ACTIONS, READY, SUBMITTED, APPROVE | REJECT | CANCEL),
			new FilterCase("peer loses update even when peer review is off",
					false, false, ALL_ACTIONS, READY, APPROVED, APPROVE | REJECT | CANCEL),
			new FilterCase("peer keeps approve on a rejected package",
					false, false, ALL_ACTIONS, READY, REJECTED, APPROVE | CANCEL),
			new FilterCase("completed package is only resubmit for the submitter",
					true, true, ALL_ACTIONS, COMPLETED, SUBMITTED, RESUBMIT),
			new FilterCase("cancelled package is only resubmit for a peer",
					false, false, ALL_ACTIONS, CANCELLED, APPROVED, RESUBMIT),
			new FilterCase("in-progress package has no actions",
					true, false, ALL_ACTIONS, PROCESSING, SUBMITTED, 0L),
			new FilterCase("user bitmap is intersected before peer-review filtering",
					true, false, UPDATE | CANCEL, READY, SUBMITTED, UPDATE | CANCEL),
			new FilterCase("peer review cannot grant approve the user does not have",
					false, true, UPDATE | CANCEL, READY, SUBMITTED, CANCEL));

	@Mock
	private PermissionMappingsProvider permissionMappingProvider;
	@Mock
	private UserService userService;
	@Mock
	private ServicesConfig servicesConfig;
	@Mock
	private PublishDAO publishDao;
	@Mock
	private SitePermissionMappings permissionMappings;
	@InjectMocks
	private PublishPackageAvailableActionResolverImpl resolver;

	@Test
	public void unauthenticatedUserHasNoActions() throws ServiceLayerException, UserNotFoundException {
		try (MockedStatic<SecurityUtils> security = mockStatic(SecurityUtils.class)) {
			security.when(SecurityUtils::getCurrentUsername).thenReturn(null);

			assertEquals(0L, resolver.getPublishPackageAvailableActions(publishPackage(OTHER_USER, READY, SUBMITTED)));
		}
		verifyNoInteractions(permissionMappingProvider, userService, servicesConfig, publishDao);
	}

	@Test
	public void submitterAndPeerReviewFilterTheBitmap() throws ServiceLayerException, UserNotFoundException {
		when(userService.getUserGroups(-1, CURRENT_USER)).thenReturn(List.of());
		when(userService.isSystemAdmin(CURRENT_USER)).thenReturn(false);
		when(publishDao.getPublishItems(SITE_ID, PACKAGE_ID)).thenReturn(List.of());
		when(permissionMappingProvider.getPermissionMappings(SITE_ID)).thenReturn(permissionMappings);

		try (MockedStatic<SecurityUtils> security = mockStatic(SecurityUtils.class)) {
			security.when(SecurityUtils::getCurrentUsername).thenReturn(CURRENT_USER);
			for (FilterCase row : FILTER_CASES) {
				when(permissionMappings.getPublishPackageAvailableActions(CURRENT_USER, List.of(), List.of(), false))
						.thenReturn(row.userActions());
				when(servicesConfig.isRequirePeerReview(SITE_ID)).thenReturn(row.peerReview());

				String submitter = row.submitter() ? CURRENT_USER : OTHER_USER;
				PublishPackage publishPackage = publishPackage(submitter, row.packageState(), row.approval());
				assertEquals(row.name(), row.expected(), resolver.getPublishPackageAvailableActions(publishPackage));
			}
		}
	}

	private static PublishPackage publishPackage(String submitterUsername, PackageState packageState, ApprovalState approvalState) {
		Site site = new Site();
		site.setSiteId(SITE_ID);
		Person submitter = new Person();
		submitter.setUsername(submitterUsername);
		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setId(PACKAGE_ID);
		publishPackage.setSite(site);
		publishPackage.setSubmitter(submitter);
		publishPackage.setPackageState(packageState.value);
		publishPackage.setApprovalState(approvalState);
		return publishPackage;
	}

	private record FilterCase(String name, boolean submitter, boolean peerReview, long userActions,
							  PackageState packageState, ApprovalState approval, long expected) {
	}
}
