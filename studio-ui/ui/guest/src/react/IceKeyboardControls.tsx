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

import React, { useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import EditOutlined from '@mui/icons-material/EditOutlined';
import OpenWithRounded from '@mui/icons-material/OpenWithRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { useIntl } from 'react-intl';
import ContentType from '@craftercms/studio-ui/models/ContentType';
import { ContentInstance } from '@craftercms/studio-ui/models/ContentInstance';
import { insertComponentAtDropZone } from '@craftercms/studio-ui/state/actions/preview';
import { HighlightMode } from '../constants';
import { elementRegistryChanges$, get, getElementRecords } from '../elementRegistry';
import { ElementRecord } from '../models/InContextEditing';
import { clearAndListen$ } from '../store/subjects';
import { startListening } from '../store/actions';
import { useDispatch } from './GuestContext';
import UltraStyledIconButton from './UltraStyledIconButton';
import UltraStyledTooltip from './UltraStyledTooltip';

const IceZoneButton = styled('button')(({ theme }) => ({
	position: 'absolute',
	zIndex: (theme.zIndex?.tooltip ?? 1500) + 2,
	pointerEvents: 'auto',
	display: 'inline-flex',
	alignItems: 'center',
	gap: 4,
	maxWidth: 240,
	margin: 0,
	padding: '2px 6px',
	borderRadius: 4,
	border: `1px solid ${theme.palette.success.main} !important`,
	backgroundColor: `${theme.palette.background.paper} !important`,
	color: `${theme.palette.text.primary} !important`,
	font: '600 12px/1.4 sans-serif !important',
	cursor: 'pointer !important',
	textAlign: 'left',
	boxShadow: theme.shadows[1],
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
		outline: `2px solid ${theme.palette.primary.main}`,
		outlineOffset: 2
	}
}));

interface ZoneControl {
	id: number;
	label: string;
	top: number;
	left: number;
}

/** Forces the string overload of formatMessage. A conditional otherwise resolves to ReactNode[]. */
function messageText(
	formatMessage: ReturnType<typeof useIntl>['formatMessage'],
	descriptor: { id: string; defaultMessage: string },
	values?: Record<string, string | number>
): string {
	return values ? formatMessage(descriptor, values) : formatMessage(descriptor);
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

export interface IceKeyboardControlsProps {
	active: boolean;
	highlightMode: string;
}

/**
 * One real button per ICE zone so edit mode is in the tab order and the accessibility tree.
 * Enter/Space (native button) runs the same guest action as clicking the zone.
 */
export function IceKeyboardControls(props: IceKeyboardControlsProps) {
	const { active, highlightMode } = props;
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const [zones, setZones] = useState<ZoneControl[]>([]);
	const moveMode = highlightMode === HighlightMode.MOVE_TARGETS;

	useEffect(() => {
		if (!active) {
			setZones([]);
			return undefined;
		}
		let frame = 0;
		const measure = () => {
			const next: ZoneControl[] = [];
			getElementRecords().forEach((record) => {
				const rect = record.element.getBoundingClientRect();
				if (rect.width < 1 && rect.height < 1) {
					return;
				}
				const labeled = get(record.id);
				next.push({
					id: record.id,
					label: labeled?.label || record.label || '',
					top: rect.top + window.scrollY,
					left: rect.left + window.scrollX + rect.width
				});
			});
			next.sort((a, b) => a.top - b.top || a.left - b.left);
			setZones((current) => {
				if (
					current.length === next.length &&
					current.every(
						(zone, index) =>
							zone.id === next[index].id &&
							zone.top === next[index].top &&
							zone.left === next[index].left &&
							zone.label === next[index].label
					)
				) {
					return current;
				}
				return next;
			});
		};
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		};
		schedule();
		const subscription = elementRegistryChanges$.subscribe(schedule);
		window.addEventListener('scroll', schedule, true);
		window.addEventListener('resize', schedule);
		return () => {
			cancelAnimationFrame(frame);
			subscription.unsubscribe();
			window.removeEventListener('scroll', schedule, true);
			window.removeEventListener('resize', schedule);
		};
	}, [active]);

	if (!active || zones.length === 0) {
		return null;
	}

	const regionLabel = messageText(formatMessage, {
		id: 'ice.zoneControls',
		defaultMessage: 'In-context editing'
	});

	return (
		<div role="region" aria-label={regionLabel}>
			{zones.map((zone) => {
				const label =
					zone.label || messageText(formatMessage, { id: 'ice.untitledZone', defaultMessage: 'Content zone' });
				const name = messageText(
					formatMessage,
					moveMode
						? { id: 'ice.selectToMove', defaultMessage: 'Select {label} to move' }
						: { id: 'ice.editZone', defaultMessage: 'Edit {label}' },
					{ label }
				);
				return (
					<IceZoneButton
						key={zone.id}
						type="button"
						data-craftercms-ice-control=""
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
							dispatch({ type: 'mouseleave', payload: {} });
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
	const label = messageText(
		formatMessage,
		{ id: 'ice.insertHereNamed', defaultMessage: 'Insert {contentType} into {zone}' },
		{ contentType: instance?.craftercms.label || contentType.name, zone: zoneLabel }
	);
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
