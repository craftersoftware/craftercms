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
import { getById, getMovableParentRecord } from '../iceRegistry';
import { ElementRecord } from '../models/InContextEditing';
import { clearAndListen$ } from '../store/subjects';
import {
	startListening,
	zoneHoverClearedViaKeyboard,
	zoneHoveredViaKeyboard,
	zoneSelectedViaKeyboard
} from '../store/actions';
import { GuestState } from '../store/models/GuestStore';
import { checkIfLockedOrModified } from '../store/util';
import { getParentModelId } from '../utils/ice';
import { isEditActionAvailable } from '../utils/util';
import { getCachedContentItems, getCachedModels, modelHierarchyMap } from '../contentController';
import { subscribeGuestStatus } from '../utils/guestAnnounce';
import {
	clearZoneOpenedFromKeyboard,
	markZoneOpenedFromKeyboard,
	noteZoneButtonsRendered,
	notifyZoneRegistryChange
} from '../utils/zoneFocus';
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

/** Identity only. Geometry is measured for the focused button, not for every zone. */
function collectZones(active: boolean, getState: () => GuestState, moveMode: boolean): ZoneControl[] {
	if (!active) {
		return noZones;
	}
	const state = getState();
	const next: ZoneControl[] = [];
	getElementRecords().forEach((record) => {
		if (!record.element || !isElementShown(record.element) || clickWouldDoNothing(record, state)) {
			return;
		}
		// In move mode the click epic ignores a zone that has no movable item, so a button for it would
		// be a tab stop that does nothing.
		if (moveMode && getMovableParentRecord(record.iceIds[0], record.element) == null) {
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
	// Rounded positions keep a 1px scroll jitter from rebuilding the list.
	const key = `${moveMode}#${next
		.map(
			(zone) =>
				`${zone.id}:${zone.iceId}:${zone.modelId}:${zone.fieldId}:${zone.index}:${zone.label}:${Math.round(zone.top)}:${Math.round(zone.left)}`
		)
		.join('|')}`;
	if (key === cachedKey) {
		return cachedZones;
	}
	cachedKey = key;
	cachedZones = next;
	return next;
}

const PILL_VIEWPORT_MARGIN = 4;

/**
 * Anchors the focused pill to the zone's top-right corner, then nudges it back inside the viewport. A zone at
 * the top of the page, or narrower than its pill and close to the left edge, would otherwise put the focus
 * indicator off-screen where the page cannot scroll to it. Only the focused button is measured.
 */
function placeButton(button: HTMLElement, element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	let top = rect.top + window.scrollY;
	let left = rect.left + window.scrollX + rect.width;
	button.style.top = `${top}px`;
	button.style.left = `${left}px`;
	const pill = button.getBoundingClientRect();
	if (pill.width > 1 || pill.height > 1) {
		const viewportWidth = document.documentElement.clientWidth;
		const dy = pill.top < PILL_VIEWPORT_MARGIN ? PILL_VIEWPORT_MARGIN - pill.top : 0;
		let dx = 0;
		if (pill.left < PILL_VIEWPORT_MARGIN) {
			dx = PILL_VIEWPORT_MARGIN - pill.left;
		} else if (pill.right > viewportWidth - PILL_VIEWPORT_MARGIN) {
			dx = Math.min(0, viewportWidth - PILL_VIEWPORT_MARGIN - pill.right);
		}
		if (dx || dy) {
			top += dy;
			left += dx;
			button.style.top = `${top}px`;
			button.style.left = `${left}px`;
		}
	}
}

function repositionFocusedZoneButton() {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !active.hasAttribute('data-craftercms-zone-button')) {
		return;
	}
	const recordId = Number(active.getAttribute('data-craftercms-element-id'));
	const record = Number.isNaN(recordId) ? undefined : get(recordId);
	if (record?.element) {
		placeButton(active, record.element);
	}
}

export function GuestStatusAnnouncer() {
	const [message, setMessage] = useState('');
	useEffect(() => {
		let timer: number | undefined;
		const unsubscribe = subscribeGuestStatus((next) => {
			window.clearTimeout(timer);
			// Clear first so a repeated message still changes the live-region text.
			// A timeout (not a microtask) survives React batching when an epic announces.
			setMessage('');
			timer = window.setTimeout(() => setMessage(next), 50);
		});
		return () => {
			window.clearTimeout(timer);
			unsubscribe();
		};
	}, []);
	return (
		<LiveRegion role="status" aria-live="polite" aria-atomic="true">
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
 * Enter/Space (native button) selects the zone through the keyboard actions, not a fake pointer event.
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
					notify();
				});
			};
			// Per frame, only the focused pill is measured. A settled scroll refreshes the rest once.
			let scrollFrame = 0;
			let scrollEnd: number | undefined;
			const onScroll = () => {
				cancelAnimationFrame(scrollFrame);
				scrollFrame = requestAnimationFrame(repositionFocusedZoneButton);
				window.clearTimeout(scrollEnd);
				scrollEnd = window.setTimeout(() => {
					cachedKey = '';
					notify();
				}, 200);
			};
			const onPointerDown = (event: PointerEvent) => {
				if (event.pointerType === 'mouse') {
					clearZoneOpenedFromKeyboard();
				}
			};
			const subscription = elementRegistryChanges$.subscribe(schedule);
			window.addEventListener('scroll', onScroll, true);
			window.addEventListener('resize', onScroll);
			document.addEventListener('pointerdown', onPointerDown, true);
			schedule();
			return () => {
				cancelAnimationFrame(frame);
				cancelAnimationFrame(scrollFrame);
				window.clearTimeout(scrollEnd);
				subscription.unsubscribe();
				window.removeEventListener('scroll', onScroll, true);
				window.removeEventListener('resize', onScroll);
				document.removeEventListener('pointerdown', onPointerDown, true);
			};
		},
		[active]
	);
	const zones = useSyncExternalStore(
		subscribe,
		() => collectZones(active, () => store.getState(), moveMode),
		() => noZones
	);
	const zoneIdentity = zones.map((zone) => `${zone.iceId}:${zone.modelId}:${zone.fieldId}:${zone.index}`).join('|');
	useEffect(() => {
		noteZoneButtonsRendered();
	}, [zoneIdentity]);

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
						data-craftercms-element-id={zone.id}
						data-craftercms-model-id={zone.modelId}
						data-craftercms-field-id={zone.fieldId}
						data-craftercms-index={zone.index}
						style={{ top: zone.top, left: zone.left, transform: 'translate(-100%, -100%)' }}
						onMouseDown={(event) => event.stopPropagation()}
						onFocus={(event) => {
							const record = get(zone.id);
							if (!record) {
								return;
							}
							placeButton(event.currentTarget, record.element);
							dispatch(zoneHoveredViaKeyboard({ record }));
						}}
						onBlur={() => {
							dispatch(zoneHoverClearedViaKeyboard());
						}}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							const record = get(zone.id);
							if (!record) {
								return;
							}
							markZoneOpenedFromKeyboard();
							clearAndListen$.next();
							dispatch(startListening());
							dispatch(zoneHoveredViaKeyboard({ record }));
							dispatch(zoneSelectedViaKeyboard({ record }));
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
				sx={{ minWidth: 24, minHeight: 24 }}
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
