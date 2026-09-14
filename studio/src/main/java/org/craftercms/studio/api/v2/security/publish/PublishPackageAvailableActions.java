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

package org.craftercms.studio.api.v2.security.publish;

import org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState;

import java.util.Collection;

import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.*;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

/**
 * Publish package available actions and basic mapping from permissions
 */
public final class PublishPackageAvailableActions {

	public static final long APPROVE = 1L;
	public static final long REJECT = 1L << 1;
	public static final long CANCEL = 1L << 2;
	public static final long RESUBMIT = 1L << 3;

	/**
	 * Map  permissions to package available actions
	 *
	 * @param permissions permissions
	 * @return bitmap of available actions
	 */
	public static long mapPermissionsToPackageAvailableActions(final Collection<String> permissions) {
		long result = 0;
		if (permissions.contains(PERMISSION_PUBLISH_REVIEW)) {
			result |= APPROVE | REJECT;
		}
		if (permissions.contains(PERMISSION_PUBLISH_CANCEL)) {
			result |= CANCEL;
		}
		if (permissions.contains(PERMISSION_PUBLISH_REQUEST)) {
			result |= RESUBMIT;
		}

		return result;
	}

	/**
	 * Get possible actions for a package according to its state and approval state
	 *
	 * @param packageState  the package state
	 * @param approvalState the package approval state
	 * @return bitmap of possible actions
	 */
	public static long getPossibleActionsForPackageStates(final long packageState,
														  final ApprovalState approvalState) {
		if (READY.matches(packageState)) {
			long result = switch (approvalState) {
				case SUBMITTED -> APPROVE | REJECT;
				case APPROVED -> REJECT;
				case REJECTED -> APPROVE;
			};
			return result | CANCEL;
		}
		if(COMPLETED.matches(packageState) || CANCELLED.matches(packageState)) {
			return RESUBMIT;
		}
		return 0;
	}
}
