/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import { defineMessages } from 'react-intl';
import { PackageActions, PublishPackage } from '../models';
import { ContextMenuOptionDescriptor } from './itemActions';
import { ContextMenuOption } from '../components/ContextMenu';
import { createPresenceTable } from './array';
import { Action, Dispatch } from 'redux';
import { batchActions } from '../state/actions/misc';
import { hasApproveAction, hasCancelAction, hasRejectAction, hasResubmitAction } from './content';
import { popDialog, pushDialog } from '../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { createComponentId } from './system';

const translations = defineMessages({
	view: {
		defaultMessage: 'View'
	},
	review: {
		defaultMessage: 'Review'
	},
	resubmit: {
		defaultMessage: 'Resubmit'
	},
	promote: {
		defaultMessage: 'Promote'
	},
	cancel: {
		defaultMessage: 'Cancel'
	}
});

const unparsedOptions: Record<PackageActions, ContextMenuOptionDescriptor<PackageActions>> = {
	view: {
		id: 'view',
		label: translations.view
	},
	review: {
		id: 'review',
		label: translations.review
	},
	resubmit: {
		id: 'resubmit',
		label: translations.resubmit
	},
	promote: {
		id: 'promote',
		label: translations.promote
	},
	cancel: {
		id: 'cancel',
		label: translations.cancel
	}
};

export const allPackageActions = Object.keys(unparsedOptions);

export const generatePackageOptions = (
	packages: PublishPackage[],
	options?: {
		includeOnly?: PackageActions[];
	}
): ContextMenuOption[] => {
	const actionsToInclude = createPresenceTable(options?.includeOnly ?? allPackageActions) as Record<
		PackageActions,
		boolean
	>;
	const packageOptions = [];
	if (packages?.length) {
		const packagesHaveCancelAction = packages.every((pkg) => hasCancelAction(pkg.availableActions));
		if (packages?.length === 1) {
			const pkg = packages[0];
			if (actionsToInclude.view) {
				packageOptions.push(unparsedOptions.view);
			}
			if (
				(hasApproveAction(pkg.availableActions) || hasRejectAction(pkg.availableActions)) &&
				pkg.approvalState === 'SUBMITTED' &&
				actionsToInclude.review
			) {
				packageOptions.push(unparsedOptions.review);
			}
			if (hasResubmitAction(pkg.availableActions) && actionsToInclude.resubmit) {
				if (pkg.target === 'staging' && pkg.approvalState === 'APPROVED') {
					// Promote is a virtual action, it's shown when the package is approved and the target is staging
					packageOptions.push(unparsedOptions.promote);
				} else {
					packageOptions.push(unparsedOptions.resubmit);
				}
			}
		}
		if (packagesHaveCancelAction && actionsToInclude.cancel) {
			packageOptions.push(unparsedOptions.cancel);
		}
	}
	return packageOptions;
};

export const packageActionDispatcher = ({
	pkg,
	option,
	dispatch,
	onActionSuccess
}: {
	pkg: PublishPackage | PublishPackage[];
	option: PackageActions;
	dispatch: Dispatch;
	onActionSuccess?: Action;
}) => {
	switch (option) {
		case 'view': {
			if (Array.isArray(pkg)) break;
			dispatch(
				pushDialog({
					component: createComponentId('PackageDetailsDialog'),
					props: {
						packageId: (pkg as PublishPackage).id
					}
				})
			);
			break;
		}
		case 'review': {
			const dialogId = nanoid();
			dispatch(
				pushDialog({
					id: dialogId,
					component: createComponentId('PublishPackageReviewDialog'),
					props: {
						packageId: (pkg as PublishPackage).id,
						onSuccess: () => {
							dispatch(batchActions([popDialog({ id: dialogId }), onActionSuccess].filter(Boolean)));
						}
					}
				})
			);
			break;
		}
		case 'resubmit':
		case 'promote': {
			const dialogId = nanoid();
			dispatch(
				pushDialog({
					id: dialogId,
					component: createComponentId('PublishingPackageResubmitDialog'),
					props: {
						pkg,
						type: option,
						onSuccess: () => {
							dispatch(batchActions([popDialog({ id: dialogId }), onActionSuccess].filter(Boolean)));
						}
					}
				})
			);
			break;
		}
		case 'cancel':
			if (Array.isArray(pkg)) {
				const dialogId = nanoid();
				dispatch(
					pushDialog({
						id: dialogId,
						component: createComponentId('BulkCancelPackageDialog'),
						props: {
							packages: pkg,
							onSuccess: () => dispatch(batchActions([popDialog({ id: dialogId }), onActionSuccess].filter(Boolean)))
						}
					})
				);
			} else {
				const dialogId = nanoid();
				dispatch(
					pushDialog({
						id: dialogId,
						component: createComponentId('CancelPackageDialog'),
						props: {
							packageId: pkg.id,
							onSuccess: () => dispatch(batchActions([popDialog({ id: dialogId }), onActionSuccess].filter(Boolean)))
						}
					})
				);
			}
			break;
		default:
			break;
	}
};
