/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import Link from '@mui/material/Link';
import { FormattedMessage, IntlShape } from 'react-intl';
import React, { ReactNode, useMemo, useState } from 'react';
import { Activities, Activity } from '../../models/Activity';
import GlobalState from '../../models/GlobalState';
import { asLocalizedDateTime } from '../../utils/datetime';
import moment from 'moment/min/moment-with-locales';
import { messages } from '../ItemTypeIcon/translations';
import SystemType from '../../models/SystemType';
import { DashboardPublishingPackage } from '../../models';
import { isPage } from '../SiteDashboard/utils';
import { getCurrentLocale } from '../../utils/i18n';

export interface ActivityItem {
	id: number;
	label: string;
	previewUrl: string;
	systemType: SystemType;
}

export type ActivitiesAndAll = Activities | 'ALL';

export function renderActivity(
	activity: Activity,
	dependencies: {
		formatMessage: IntlShape['formatMessage'];
		onItemClick: (item: ActivityItem, e) => void;
		onPackageClick: (pkg: DashboardPublishingPackage, e) => void;
	}
) {
	const { formatMessage, onItemClick, onPackageClick } = dependencies;
	let item = activity.item;
	let systemType: string = activity.item?.systemType;
	if (messages[systemType]) {
		const crafterStudioLanguage = getCurrentLocale();
		const message = formatMessage(messages[systemType]);
		// In Deutsch, the system types for 'page' and 'component' are capitalized.
		systemType =
			crafterStudioLanguage === 'de' && (systemType === 'page' || systemType === 'component')
				? message
				: message.toLowerCase();
	}
	const anchor = (chunks: ReactNode[]) => {
		const [label, systemType, previewUrl, path] = chunks;
		return !isPage(systemType) ? (
			<em title={path as string}>{label}</em>
		) : (
			<Link
				title={path as string}
				sx={{ cursor: 'pointer' }}
				onClick={(e) => onItemClick(previewUrl as unknown as ActivityItem, e)}
			>
				{label}
			</Link>
		);
	};
	const render_package_link = (message) => {
		const activityPackage = activity.package;
		return (
			<Link sx={{ cursor: 'pointer' }} onClick={(e) => onPackageClick(activity.package, e)}>
				{activityPackage?.title ?? message}
			</Link>
		);
	};
	switch (activity.actionType) {
		case 'CREATE':
			return item.label === null ? (
				<FormattedMessage
					id="activityDashlet.deletedItemCreateActivityMessage"
					defaultMessage="Created an item that no longer exists"
				/>
			) : (
				<FormattedMessage
					id="activityDashlet.createActivityMessage"
					defaultMessage="Created <anchor>{item}</anchor> {systemType}"
					values={{ item: [item.label, item.systemType, item.previewUrl, item.path], systemType, anchor }}
				/>
			);
		case 'UPDATE':
			return item.label === null ? (
				<FormattedMessage
					id="activityDashlet.deletedItemUpdateActivityMessage"
					defaultMessage="Updated a an item that no longer exists"
				/>
			) : (
				<FormattedMessage
					id="activityDashlet.updateActivityMessage"
					defaultMessage="Updated <anchor>{item}</anchor> {systemType}"
					values={{ item: [item.label, item.systemType, item.previewUrl, item.path], systemType, anchor }}
				/>
			);
		case 'DELETE':
			return item.label === null ? (
				<FormattedMessage id="activityDashlet.deletedItemDeleteActivityMessage" defaultMessage="Deleted an item" />
			) : (
				<FormattedMessage
					id="activityDashlet.deleteActivityMessage"
					defaultMessage="Deleted {label} {systemType}"
					values={{
						label: item.label,
						systemType
					}}
				/>
			);
		case 'MOVE':
			return item.label === null ? (
				<FormattedMessage
					id="activityDashlet.deletedItemMoveActivityMessage"
					defaultMessage="Moved an item that no longer exists"
				/>
			) : (
				<FormattedMessage
					id="activityDashlet.moveActivityMessage"
					defaultMessage="Moved <anchor>{item}</anchor> {systemType}"
					values={{ item: [item.label, item.systemType, item.previewUrl, item.path], anchor, systemType }}
				/>
			);
		case 'REQUEST_PUBLISH':
			return (
				<FormattedMessage
					defaultMessage="Requested <render_package_link>a package</render_package_link> for publishing"
					values={{ render_package_link }}
				/>
			);
		// PUBLISH and APPROVE_PUBLISH_PACKAGE are approval actions, for direct publishing or via a request approval.
		case 'PUBLISH':
		case 'APPROVE_PUBLISH_PACKAGE':
			return (
				<FormattedMessage
					id="activityDashlet.publishActivityMessage"
					defaultMessage="Approved <render_package_link>a package</render_package_link>"
					values={{ render_package_link }}
				/>
			);
		case 'REJECT_PUBLISH_PACKAGE':
			return (
				<FormattedMessage
					id="activityDashlet.rejectedActivityMessage"
					defaultMessage="Rejected <render_package_link>a package</render_package_link>"
					values={{ render_package_link }}
				/>
			);
		case 'REVERT':
			return item.label === null ? (
				<FormattedMessage
					id="activityDashlet.deletedItemRevertActivityMessage"
					defaultMessage="Reverted an item that no longer exists"
				/>
			) : (
				<FormattedMessage
					id="activityDashlet.revertActivityMessage"
					defaultMessage="Reverted <anchor>{item}</anchor> {systemType}"
					values={{ item: [item.label, item.systemType, item.previewUrl, item.path], anchor, systemType }}
				/>
			);
		case 'PUBLISH_ITEM_LIST_COMPLETE':
			return (
				<FormattedMessage
					id="activityDashlet.publishedActivityMessage"
					defaultMessage="Published <render_package_link>a package</render_package_link>"
					values={{ render_package_link }}
				/>
			);
		case 'INITIAL_PUBLISH_COMPLETE':
			return (
				<FormattedMessage
					id="activityDashlet.initialPublishActivityMessage"
					defaultMessage="Performed the project's initial publish"
				/>
			);
		case 'PUBLISH_ALL_COMPLETE':
			return <FormattedMessage defaultMessage="Published entire project" />;
		case 'CANCEL_PUBLISH_PACKAGE':
			return (
				<FormattedMessage
					defaultMessage="Cancelled <render_package_link>a package</render_package_link>"
					values={{ render_package_link }}
				/>
			);
		default:
			console.log('[INFO] An unknown activity was received from the server.', activity);
			return <FormattedMessage defaultMessage="Unlabelled activity" />;
	}
}

export function renderActivityTimestamp(timestamp: string, locale: GlobalState['uiConfig']['locale']) {
	const now = Date.now();
	const date = new Date(timestamp).getTime();
	const crafterStudioLanguage = getCurrentLocale();
	return now - date < 3.6e7
		? moment(date).locale(crafterStudioLanguage).fromNow()
		: asLocalizedDateTime(timestamp, locale.localeCode, locale.dateTimeFormatOptions);
}

export const activityNameLookup: Record<Activities | 'ALL', any> = {
	ALL: <FormattedMessage id="activityDashlet.showActivityByEveryone" defaultMessage="All activities" />,
	CREATE: <FormattedMessage id="words.create" defaultMessage="Create" />,
	DELETE: <FormattedMessage id="words.delete" defaultMessage="Delete" />,
	INITIAL_PUBLISH_COMPLETE: <FormattedMessage id="operations.initialPublish" defaultMessage="Initial Publish" />,
	MOVE: <FormattedMessage id="words.move" defaultMessage="Move" />,
	PUBLISH: <FormattedMessage id="words.approve" defaultMessage="Approve" />,
	APPROVE_PUBLISH_PACKAGE: <FormattedMessage id="words.approve" defaultMessage="Approve" />,
	PUBLISH_ITEM_LIST_COMPLETE: <FormattedMessage id="words.publish" defaultMessage="Publish" />,
	REJECT_PUBLISH_PACKAGE: <FormattedMessage id="words.reject" defaultMessage="Reject" />,
	REQUEST_PUBLISH: <FormattedMessage id="operations.requestPublish" defaultMessage="Request Publish" />,
	REVERT: <FormattedMessage id="words.revert" defaultMessage="Revert" />,
	UPDATE: <FormattedMessage id="words.update" defaultMessage="Update" />,
	PUBLISH_ALL_COMPLETE: <FormattedMessage defaultMessage="Publish All" />,
	CANCEL_PUBLISH_PACKAGE: <FormattedMessage defaultMessage="Cancel" />
};

function getSelectedKeys<K extends string>(selection: Partial<Record<K, boolean>>): K[] {
	return Object.entries<boolean>(selection)
		.filter(([key, value]) => value)
		.map(([key]) => key as K);
}

type UseSelectionLookupState<K extends string> = Partial<Record<K, boolean>>;

export function useSelectionLookupState<
	K extends string,
	S extends UseSelectionLookupState<K> = UseSelectionLookupState<K>
>(): [S, (key: string) => void, string[]];
export function useSelectionLookupState<
	K extends string,
	S extends UseSelectionLookupState<K> = UseSelectionLookupState<K>
>(initialState?: S, resetSelectionKey?: string): [S, (key: string) => void, string[]];
export function useSelectionLookupState<
	K extends string,
	S extends UseSelectionLookupState<K> = UseSelectionLookupState<K>
>(initialState?: S): [S, (key: string) => void, string[]];
export function useSelectionLookupState<
	K extends string,
	S extends UseSelectionLookupState<K> = UseSelectionLookupState<K>
>(initialState?: () => S, resetSelectionKey?: string): [S, (key: string) => void, string[]];
export function useSelectionLookupState<
	K extends string,
	S extends UseSelectionLookupState<K> = UseSelectionLookupState<K>
>(initialState?: () => S): [S, (key: string) => void, string[]];
export function useSelectionLookupState<
	K extends string,
	S extends UseSelectionLookupState<K> = UseSelectionLookupState<K>
>(initialState: S | (() => S) = {} as S, resetSelectionKey: K = 'ALL' as K): [S, (key: K) => void, K[]] {
	const [selected, setSelected] = useState<S>(initialState);
	const [selectedList, setSelectedList] = useState(getSelectedKeys(selected));
	const fn = useMemo<(key: string) => void>(
		() => (id) => {
			let selection: S;
			if (id === resetSelectionKey) {
				selection = { [resetSelectionKey]: true } as S;
				setSelected(selection);
			} else {
				const isSelecting = !selected[id];
				selection = (
					isSelecting ||
					Object.entries(selected).filter(([key, value]) => key !== resetSelectionKey && key !== id && value).length
						? { ...selected, [resetSelectionKey]: false, [id]: isSelecting }
						: { [resetSelectionKey]: true }
				) as S;
				setSelected(selection);
			}
			setSelectedList(getSelectedKeys(selection));
		},
		[resetSelectionKey, selected]
	);
	return [selected, fn, selectedList];
}
