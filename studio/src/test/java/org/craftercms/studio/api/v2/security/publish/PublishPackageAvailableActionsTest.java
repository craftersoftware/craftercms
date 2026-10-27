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

package org.craftercms.studio.api.v2.security.publish;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;

import org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState;
import org.junit.Test;

import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.APPROVED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.REJECTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.SUBMITTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.CANCELLED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.COMPLETED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.LIVE_COMPLETED_WITH_ERRORS;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.LIVE_FAILED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.LIVE_SUCCESS;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.STAGING_COMPLETED_WITH_ERRORS;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.STAGING_FAILED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.STAGING_SUCCESS;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.APPROVE;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.CANCEL;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.REJECT;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.RESUBMIT;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.UPDATE;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.getPossibleActionsForPackageStates;
import static org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActions.mapPermissionsToPackageAvailableActions;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_PUBLISH_CANCEL;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_PUBLISH_REQUEST;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_PUBLISH_REVIEW;
import static org.junit.Assert.assertEquals;

public class PublishPackageAvailableActionsTest {

	private static final long READY_OPEN = APPROVE | REJECT | UPDATE | CANCEL;
	private static final long READY_REJECTED = APPROVE | CANCEL;

	private static final List<PackageState> IN_PROGRESS = List.of(
			PROCESSING,
			LIVE_SUCCESS,
			LIVE_COMPLETED_WITH_ERRORS,
			LIVE_FAILED,
			STAGING_SUCCESS,
			STAGING_COMPLETED_WITH_ERRORS,
			STAGING_FAILED);

	private static final List<StateCase> STATE_CASES = stateCases();

	private static final List<PermissionCase> PERMISSION_CASES = List.of(
			new PermissionCase("no permissions", List.of(), UPDATE),
			new PermissionCase("unrelated permission", List.of(PERMISSION_CONTENT_READ), UPDATE),
			new PermissionCase("review", List.of(PERMISSION_PUBLISH_REVIEW), UPDATE | APPROVE | REJECT),
			new PermissionCase("cancel", List.of(PERMISSION_PUBLISH_CANCEL), UPDATE | CANCEL),
			new PermissionCase("request", List.of(PERMISSION_PUBLISH_REQUEST), UPDATE | RESUBMIT),
			new PermissionCase("review and cancel",
					List.of(PERMISSION_PUBLISH_REVIEW, PERMISSION_PUBLISH_CANCEL),
					UPDATE | APPROVE | REJECT | CANCEL),
			new PermissionCase("review and request",
					List.of(PERMISSION_PUBLISH_REVIEW, PERMISSION_PUBLISH_REQUEST),
					UPDATE | APPROVE | REJECT | RESUBMIT),
			new PermissionCase("cancel and request",
					List.of(PERMISSION_PUBLISH_CANCEL, PERMISSION_PUBLISH_REQUEST),
					UPDATE | CANCEL | RESUBMIT),
			new PermissionCase("every publish permission",
					List.of(PERMISSION_PUBLISH_REVIEW, PERMISSION_PUBLISH_CANCEL,
							PERMISSION_PUBLISH_REQUEST, PERMISSION_CONTENT_READ),
					UPDATE | APPROVE | REJECT | CANCEL | RESUBMIT));

	@Test
	public void possibleActionsFollowPackageAndApprovalState() {
		EnumSet<PackageState> covered = EnumSet.noneOf(PackageState.class);
		for (StateCase row : STATE_CASES) {
			covered.add(row.state());
			assertEquals(row.state() + " / " + row.approval(), row.expected(),
					getPossibleActionsForPackageStates(row.state().value, row.approval()));
		}
		assertEquals(EnumSet.allOf(PackageState.class), covered);
	}

	@Test
	public void readyBitTakesPrecedenceWhenCompletedIsAlsoSet() {
		long packageState = READY.value | COMPLETED.value;
		assertEquals(READY_OPEN, getPossibleActionsForPackageStates(packageState, SUBMITTED));
		assertEquals(READY_REJECTED, getPossibleActionsForPackageStates(packageState, REJECTED));
	}

	@Test
	public void emptyPackageStateHasNoActions() {
		for (ApprovalState approval : ApprovalState.values()) {
			assertEquals(approval.name(), 0L, getPossibleActionsForPackageStates(0L, approval));
		}
	}

	@Test
	public void permissionsMapOntoActionBits() {
		for (PermissionCase row : PERMISSION_CASES) {
			assertEquals(row.name(), row.expected(), mapPermissionsToPackageAvailableActions(row.permissions()));
		}
	}

	private static List<StateCase> stateCases() {
		List<StateCase> cases = new ArrayList<>();
		cases.add(new StateCase(READY, SUBMITTED, READY_OPEN));
		cases.add(new StateCase(READY, APPROVED, READY_OPEN));
		cases.add(new StateCase(READY, REJECTED, READY_REJECTED));
		for (ApprovalState approval : ApprovalState.values()) {
			cases.add(new StateCase(COMPLETED, approval, RESUBMIT));
			cases.add(new StateCase(CANCELLED, approval, RESUBMIT));
			for (PackageState inProgress : IN_PROGRESS) {
				cases.add(new StateCase(inProgress, approval, 0L));
			}
		}
		return List.copyOf(cases);
	}

	private record StateCase(PackageState state, ApprovalState approval, long expected) {
	}

	private record PermissionCase(String name, Collection<String> permissions, long expected) {
	}
}
