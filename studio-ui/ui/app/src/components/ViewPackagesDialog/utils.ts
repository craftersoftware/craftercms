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

import type { ContentItem, PublishPackage } from '../../models';
import { Dispatch } from 'redux';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { cancelPackages, fetchAffectedPackages } from '../../services/workflow';
import { IntlShape } from 'react-intl';
import { createComponentId } from '../../utils/system';
import { hasApproveAction, hasRejectAction } from '../../utils/content';
import type { ReactNode } from 'react';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export function showPackageDetails({
	pkg,
	dispatch,
	onSuccess
}: {
	pkg: PublishPackage;
	dispatch: Dispatch;
	onSuccess?: () => void;
}) {
	if (
		pkg.approvalState === 'SUBMITTED' &&
		(hasApproveAction(pkg.availableActions) || hasRejectAction(pkg.availableActions))
	) {
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('PublishPackageReviewDialog'),
				props: {
					packageId: pkg.id,
					onSuccess: () => {
						dispatch(popDialog({ id: dialogId }));
						onSuccess?.();
					}
				}
			})
		);
	} else {
		dispatch(
			pushDialog({
				component: createComponentId('PackageDetailsDialog'),
				props: { packageId: pkg.id }
			})
		);
	}
}

export function checkAndCancelAffectedPackages({
	siteId,
	item,
	dispatch,
	onContinue,
	onClose,
	cancelPackagesComment,
	formatMessage,
	subtitle
}: {
	siteId: string;
	item: ContentItem;
	dispatch: Dispatch;
	onContinue: () => void;
	onClose?: () => void;
	cancelPackagesComment?: string;
	formatMessage: IntlShape['formatMessage'];
	subtitle?: ReactNode;
}) {
	const cancelPackagesInitialComment =
		cancelPackagesComment ??
		formatMessage({ defaultMessage: 'Cancel affected packages of "{path}"' }, { path: item.path });
	fetchAffectedPackages(siteId, item.path).subscribe({
		next: (affectedPackages) => {
			if (!affectedPackages || affectedPackages.length === 0) {
				onContinue();
			} else {
				const dialogId = nanoid();
				dispatch(
					pushDialog({
						id: dialogId,
						component: 'craftercms.components.ViewPackagesDialog',
						props: {
							item,
							cancelPackagesInitialComment,
							...(subtitle && { subtitle }),
							onContinue: (cancelPackagesUpdatedComment: string) => {
								fetchAffectedPackages(siteId, item.path)
									.pipe(
										switchMap((pkgs) =>
											pkgs?.length
												? cancelPackages(siteId, {
														packageIds: pkgs.map((p) => p.id),
														comment: cancelPackagesUpdatedComment
													})
												: of(null)
										)
									)
									.subscribe({
										next: () => onContinue(),
										error: ({ response }) => {
											dispatch(
												pushDialog({
													component: 'craftercms.components.ErrorDialog',
													props: { error: response?.response }
												})
											);
										}
									});
							},
							onClose: () => {
								dispatch(popDialog({ id: dialogId }));
								onClose?.();
							}
						}
					})
				);
			}
		},
		error: ({ response }) => {
			dispatch(
				pushDialog({
					component: 'craftercms.components.ErrorDialog',
					props: { error: response?.response }
				})
			);
		}
	});
}
