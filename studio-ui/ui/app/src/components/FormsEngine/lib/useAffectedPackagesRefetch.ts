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

import { useEffect } from 'react';
import type { Observable } from 'rxjs';
import type { PublishPackage } from '../../../models';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import { getHostToHostBus } from '../../../utils/subjects';
import { fetchAffectedPackages } from '../../../services/workflow';
import {
	workflowEventApprove,
	workflowEventCancel,
	workflowEventDirectPublish,
	workflowEventReject,
	workflowEventSubmit
} from '../../../state/actions/system';

const workflowEventTypes: string[] = [
	workflowEventSubmit.type,
	workflowEventDirectPublish.type,
	workflowEventApprove.type,
	workflowEventReject.type,
	workflowEventCancel.type
];

/**
 * Refetches the packages the form's item is part of when a workflow event arrives, and hands them to
 * `onPackages`. The bus subscription lives as long as the site doesn't change: the item path and the callback are read
 * when an event arrives, so a rename or an item update doesn't resubscribe.
 */
export function useAffectedPackagesRefetch(
	siteId: string,
	itemPath: string | null,
	onPackages: (packages: PublishPackage[]) => void,
	fetchPackages: (siteId: string, path: string) => Observable<PublishPackage[]> = fetchAffectedPackages
): void {
	const latest = useUpdateRefs({ itemPath, onPackages, fetchPackages });
	useEffect(() => {
		const subscription = getHostToHostBus().subscribe(({ type }) => {
			const { itemPath, onPackages, fetchPackages } = latest.current;
			if (!itemPath || !workflowEventTypes.includes(type)) return;
			fetchPackages(siteId, itemPath).subscribe({
				next: onPackages,
				error({ response }) {
					console.error(response);
				}
			});
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [latest, siteId]);
}
