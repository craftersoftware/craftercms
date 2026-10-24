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

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { styled } from '@mui/material/styles';
import EditOutlined from '@mui/icons-material/EditOutlined';
import OpenWithRounded from '@mui/icons-material/OpenWithRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { defineMessages, useIntl } from 'react-intl';
import ContentType from '@craftercms/studio-ui/models/ContentType';
import { ContentInstance } from '@craftercms/studio-ui/models/ContentInstance';
import { insertComponentAtDropZone } from '@craftercms/studio-ui/state/actions/preview';
import { HighlightMode } from '../constants';
import { elementRegistryChanges$, get, getElementRecords } from '../elementRegistry';
import { getById } from '../iceRegistry';
import { ElementRecord } from '../models/InContextEditing';
import { clearAndListen$ } from '../store/subjects';
import { startListening } from '../store/actions';
import { GuestState } from '../store/models/GuestStore';
import { checkIfLockedOrModified } from '../store/util';
import { getParentModelId } from '../utils/ice';
import { isEditActionAvailable } from '../utils/util';
import { getCachedContentItems, getCachedModels, modelHierarchyMap } from '../contentController';
import { subscribeGuestStatus } from '../utils/guestAnnounce';
import { noteZoneFocusIdentity, notifyZoneRegistryChange, tryFocusPendingZone } from '../utils/zoneFocus';
import { useDispatch, useStore } from './GuestContext';
import UltraStyledIconButton from './UltraStyledIconButton';
import UltraStyledTooltip from './UltraStyledTooltip';

const iceMessages = defineMessages({
	editZone: { id: 'ice.editZone', defaultMessage: 'Edit {label}' },
	selectToMove: { id: 'ice.selectToMove', defaultMessage: 'Select {label} to move' },
	insertHereNamed: { id: 'ice.insertHereNamed', defaultMessage: 'Insert {contentType} into {zone}' },
	zoneControls: { id: 'ice.zoneControls', defaultMessage: 'In-context editing' },
	untitledZone: { id: 'ice.untitledZone', defaultMessage: 'Content zone' }
});

const IceZoneButton = styled('button')(({ theme }) => ({
	position: 'absolute',
	zIndex: (theme.zIndex?.tooltip ?? 1500) + 2,
	// Hidden until keyboard focus so the control stays in the tab order without covering the page.
	pointerEvents: 'none',
	width: 1,
	height: 1,
	padding: 0,
	margin: '-1px',
	overflow: 'hidden',
	clip: 'rect(0 0 0 0)',
	clipPath: 'inset(50%)',
	whiteSpace: 'nowrap',
	border: '0 !important',
	background: 'transparent',
	font: '600 12px/1.4 sans-serif !important',
	'& svg': {
		fontSize: 16,
		flexShrink: 0
	},
	'& span': {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	'&:focus': {
		outline: 'none'
	},
	'&:focus-visible': {
		pointerEvents: 'auto',
		clip: 'auto',
		clipPath: 'none',
		width: 'auto',
		height: 'auto',
		minHeight: '24px !important',
		maxWidth: 240,
		margin: 0,
		overflow: 'visible',
		display: 'inline-flex',
		alignItems: 'center',
		gap: 4,
		padding: '2px 6px',
		borderRadius: 4,
		border: `1px solid ${theme.palette.success.main} !important`,
		backgroundColor: `${theme.palette.background.paper} !important`,
		color: `${theme.palette.text.primary} !important`,
		textAlign: 'left',
		cursor: 'pointer !important',
		boxShadow: theme.shadows[1],
		outline: `2px solid ${theme.palette.primary.main} !important`,
		outlineOffset: '2px !important'
	}
}));

const LiveRegion = styled('div')({
	position: 'absolute',
	width: 1,
	height: 1,
	padding: 0,
	margin: '-1px',
	overflow: 'hidden',
	clip: 'rect(0 0 0 0)',
	whiteSpace: 'nowrap',
	border: 0
});

interface ZoneControl {
	id: number;
	iceId: number;
	modelId: string;
	fieldId: string;
	index: string;
	label: string;
	top: number;
	left: number;
}

let cachedZones: ZoneControl[] = [];
let cachedKey = '';
const noZones: ZoneControl[] = [];

function clickWouldDoNothing(record: ElementRecord, state: GuestState): boolean {
	const ice = record.iceIds[0] != null ? getById(record.iceIds[0]) : null;
	if (!ice) {
		return true;
	}
	const editable = isEditActionAvailable({
		record,
		models: getCachedModels(),
		contentItemsByPath: getCachedContentItems(),
		parentModelId: getParentModelId(record.modelId, getCachedModels(), modelHierarchyMap)
	});
	const { isLocked, isExternallyModified, isLockedByCurrentUser } = checkIfLockedOrModified(state, record);
	if (!editable || isExternallyModified) {
		return true;
	}
	// Locked fields owned by someone else are ignored by the click epic. Locked components can still be selected.
	return Boolean(isLocked && !isLockedByCurrentUser && ice.recordType === 'field');
}

function isElementShown(element: HTMLElement): boolean {
	const rect = element.getBoundingClientRect();
	if (rect.width < 1 && rect.height < 1) {
		return false;
	}
	const style = window.getComputedStyle(element);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function measureZones(active: boolean, getState: () => GuestState): ZoneControl[] {
	if (!active) {
		return noZones;
	}
	const state = getState();
	const next: ZoneControl[] = [];
	getElementRecords().forEach((record) => {
		if (!record.element || !isElementShown(record.element) || clickWouldDoNothing(record, state)) {
			return;
		}
		const rect = record.element.getBoundingClientRect();
		const labeled = get(record.id);
		next.push({
			id: record.id,
			iceId: record.iceIds[0],
			modelId: record.modelId,
			fieldId: record.fieldId?.join('.') ?? '',
			index: record.index == null ? '' : String(record.index),
			label: labeled?.label || record.label || '',
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX + rect.width
		});
	});
	next.sort((a, b) => a.top - b.top || a.left - b.left);
	const key = next.map((zone) => `${zone.id}:${zone.top}:${zone.left}:${zone.label}`).join('|');
	if (key === cachedKey) {
		return cachedZones;
	}
	cachedKey = key;
	cachedZones = next;
	return next;
}

function syntheticPointer(record: ElementRecord) {
	const rect = record.element.getBoundingClientRect();
	return {
		clientX: rect.left + rect.width / 2,
		clientY: rect.top + Math.min(8, rect.height / 2),
		preventDefault() {},
		stopPropagation() {},
		type: 'click'
	};
}

export function GuestStatusAnnouncer() {
	const [message, setMessage] = useState('');
	useEffect(() => {
		return subscribeGuestStatus((next) => {
			setMessage('');
			queueMicrotask(() => setMessage(next));
		});
	}, []);
	return (
		<LiveRegion role="status" aria-live="polite">
			{message}
		</LiveRegion>
	);
}

export interface IceKeyboardControlsProps {
	active: boolean;
	highlightMode: string;
}

/**
 * One real button per actionable ICE zone so edit mode is in the tab order.
 * Buttons stay visually hidden until :focus-visible and do not take pointer events until then.
 * Enter/Space (native button) runs the same guest action as clicking the zone.
 */
export function IceKeyboardControls(props: IceKeyboardControlsProps) {
	const { active, highlightMode } = props;
	const dispatch = useDispatch();
	const store = useStore();
	const { formatMessage } = useIntl();
	const moveMode = highlightMode === HighlightMode.MOVE_TARGETS;
	const subscribe = useCallback(
		(notify: () => void) => {
			if (!active) {
				return () => undefined;
			}
			let frame = 0;
			const schedule = () => {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(() => {
					notifyZoneRegistryChange();
					tryFocusPendingZone();
					notify();
				});
			};
			const subscription = elementRegistryChanges$.subscribe(schedule);
			window.addEventListener('scroll', schedule, true);
			window.addEventListener('resize', schedule);
			schedule();
			return () => {
				cancelAnimationFrame(frame);
				subscription.unsubscribe();
				window.removeEventListener('scroll', schedule, true);
				window.removeEventListener('resize', schedule);
			};
		},
		[active]
	);
	const zones = useSyncExternalStore(
		subscribe,
		() => measureZones(active, () => store.getState()),
		() => noZones
	);
	const zoneIdentity = zones.map((zone) => `${zone.iceId}:${zone.modelId}:${zone.fieldId}:${zone.index}`).join('|');
	// The moved item's button is created on a later commit. Retry after that render, then drop the request.
	useEffect(() => {
		if (!tryFocusPendingZone()) {
			noteZoneFocusIdentity(zoneIdentity);
		}
	}, [zones, zoneIdentity]);

	if (!active || zones.length === 0) {
		return null;
	}

	const regionLabel = formatMessage(iceMessages.zoneControls) as string;

	return (
		<div role="region" aria-label={regionLabel}>
			{zones.map((zone) => {
				const label = zone.label || (formatMessage(iceMessages.untitledZone) as string);
				const name = (
					moveMode ? formatMessage(iceMessages.selectToMove, { label }) : formatMessage(iceMessages.editZone, { label })
				) as string;
				return (
					<IceZoneButton
						key={zone.id}
						type="button"
						data-craftercms-ice-control=""
						data-craftercms-zone-button={zone.iceId}
						data-craftercms-model-id={zone.modelId}
						data-craftercms-field-id={zone.fieldId}
						data-craftercms-index={zone.index}
						title={name}
						style={{ top: zone.top, left: zone.left, transform: 'translate(-100%, -100%)' }}
						onMouseDown={(event) => event.stopPropagation()}
						onFocus={() => {
							const record = get(zone.id);
							if (record) {
								dispatch({ type: 'mouseover', payload: { record, event: syntheticPointer(record) } });
							}
						}}
						onBlur={() => {
							const record = get(zone.id);
							if (!record) {
								return;
							}
							dispatch({ type: 'mouseleave', payload: { record, event: syntheticPointer(record) } });
						}}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							const record = get(zone.id);
							if (!record) {
								return;
							}
							const pointer = syntheticPointer(record);
							// Drop any open zone menu first so the click epic sees LISTENING, same as a page click.
							clearAndListen$.next();
							dispatch(startListening());
							dispatch({ type: 'mouseover', payload: { record, event: pointer } });
							dispatch({ type: 'click', payload: { record, event: pointer } });
						}}
					>
						{moveMode ? <OpenWithRounded aria-hidden /> : <EditOutlined aria-hidden />}
						<span>{name}</span>
					</IceZoneButton>
				);
			})}
		</div>
	);
}

export function InsertHereButton(props: {
	contentType: ContentType;
	instance?: ContentInstance;
	zoneLabel: string;
	iceId: number;
}) {
	const { contentType, instance, zoneLabel, iceId } = props;
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const contentTypeName = instance?.craftercms.label || contentType.name;
	const label = formatMessage(iceMessages.insertHereNamed, {
		contentType: contentTypeName,
		zone: zoneLabel
	}) as string;
	return (
		<UltraStyledTooltip title={label}>
			<UltraStyledIconButton
				size="small"
				aria-label={label}
				onMouseDown={(event) => event.stopPropagation()}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					dispatch(insertComponentAtDropZone({ contentType, iceId, instance }));
				}}
			>
				<AddCircleOutlineRoundedIcon />
			</UltraStyledIconButton>
		</UltraStyledTooltip>
	);
}

export default IceKeyboardControls;
