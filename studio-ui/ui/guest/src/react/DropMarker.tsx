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

import React, { useEffect, useRef, useState } from 'react';
import { foo, HORIZONTAL, VERTICAL, X_AXIS, Y_AXIS } from '../utils/util';
import { Coordinates } from '../models/Positioning';
import { DropZone, ElementRecord } from '../models/InContextEditing';
import { notNullOrUndefined } from '@craftercms/studio-ui/utils/object';
import { forEach } from '@craftercms/studio-ui/utils/array';
import { findClosestRect, getDropMarkerPosition, getInRectStats, splitRect } from '../utils/dom';
import { FullSxRecord, PartialSxRecord } from '@craftercms/studio-ui/models/CustomRecord';
import { Box, Theme, useTheme } from '@mui/material';
import { overlayBandSx } from '@craftercms/studio-ui/styles/overlayStroke';

export type DropMarkerClassKey = 'root' | 'tips' | 'horizontal' | 'vertical';

export type DropMarkerFullSx = FullSxRecord<DropMarkerClassKey>;

export type DropMarkerPartialSx = PartialSxRecord<DropMarkerClassKey>;

export interface DropMarkerProps {
	over: ElementRecord;
	prev: DOMRect;
	next: DOMRect;
	dropZone: DropZone;
	coordinates: Coordinates;
	onDropPosition: Function;
	sx?: DropMarkerPartialSx;
}

function getSx(sx: DropMarkerPartialSx, theme: Theme): DropMarkerFullSx {
	return {
		root: {
			zIndex: 'tooltip',
			position: 'fixed',
			pointerEvents: 'none',
			...sx?.root
		},
		tips: {
			content: '""',
			width: '8px',
			height: '8px',
			backgroundColor: 'error.main',
			borderRadius: 1,
			marginTop: '-3px',
			marginLeft: '-4.5px',
			position: 'absolute',
			...sx?.tips
		},
		vertical: {
			height: 2,
			visibility: 'visible',
			backgroundColor: 'error.main',
			// The marker is drawn on the authored page, so it carries the companion bands too.
			...overlayBandSx(theme),
			'&::before': {
				left: 0
			},
			'&::after': {
				right: 0
			},
			...sx?.horizontal
		},
		horizontal: {
			width: 2,
			minHeight: '5px',
			marginLeft: '3px',
			...overlayBandSx(theme),
			'&::before': {
				top: 0
			},
			'&::after': {
				bottom: -4
			},
			...sx?.vertical
		}
	};
}

export function DropMarker(props: DropMarkerProps) {
	const {
		over: { element },
		prev,
		next,
		dropZone,
		coordinates,
		onDropPosition = foo
	} = props;
	const refs = useRef({ targetIndex: null });
	const [style, setStyle] = useState({});
	const theme = useTheme();
	const sx = getSx(props.sx, theme);
	const arrangement = dropZone.arrangement;

	useEffect(() => {
		let nextStyle = null;
		let targetIndex;

		if (element === dropZone.element) {
			if (element.children.length > 0) {
				const closestChildIndex = findClosestRect(dropZone.rect, dropZone.childrenRects, coordinates),
					closestRect = dropZone.childrenRects[closestChildIndex],
					closestChild = dropZone.children[closestChildIndex],
					before =
						dropZone.arrangement === HORIZONTAL
							? // Is it to the left of the center of the rect?
								coordinates.x <= closestRect.left + closestRect.width / 2
							: // Is it to the north of the center of the rect?
								coordinates.y <= closestRect.top + closestRect.height / 2;

				nextStyle = getDropMarkerPosition({
					arrangement: dropZone.arrangement,
					insertPosition: before ? 'before' : 'after',
					refElement: closestChild,
					refElementRect: closestRect,
					nextOrPrevRect: before
						? dropZone.childrenRects[closestChildIndex - 1]
						: dropZone.childrenRects[closestChildIndex + 1]
				});

				targetIndex = before ? closestChildIndex : closestChildIndex + 1;
			} else {
				// Drop zone is empty
				// onDropPosition({ targetIndex: 0 });

				const virtualRects = splitRect(
					dropZone.rect,
					// Using the larger space to display the drop marker makes it more visible
					dropZone.rect.width > dropZone.rect.height ? X_AXIS : Y_AXIS
				);

				nextStyle = getDropMarkerPosition({
					arrangement: dropZone.arrangement,
					insertPosition: 'after',
					refElement: dropZone.element,
					refElementRect: virtualRects[0],
					nextOrPrevRect: virtualRects[1]
				});

				targetIndex = 0;
			}
		} else {
			let prevRect = prev;
			let nextRect = next;
			let rect = element.getBoundingClientRect();
			let rectStats = getInRectStats(rect, coordinates);

			if (rectStats.inRect) {
				const insertPosition =
					(dropZone.arrangement === HORIZONTAL && rectStats.percents.x >= 50) ||
					(dropZone.arrangement === VERTICAL && rectStats.percents.y >= 50)
						? 'after'
						: 'before';
				let before = insertPosition === 'before';

				nextStyle = getDropMarkerPosition({
					insertPosition,
					arrangement: dropZone.arrangement,
					refElement: element,
					refElementRect: rect,
					nextOrPrevRect: before ? prevRect : nextRect
				});

				targetIndex = dropZone.children.findIndex((e) => e === element);
				if (!before) {
					++targetIndex;
				}
			} else {
				console.log('DropMarker:dragOver unhandled path');
			}
		}

		if (notNullOrUndefined(nextStyle)) {
			forEach(Object.keys(nextStyle), (key) => {
				if (style[key] !== nextStyle[key]) {
					setStyle(nextStyle);
					return 'break';
				}
			});
		}

		if (refs.current.targetIndex !== targetIndex) {
			refs.current.targetIndex = targetIndex;
			onDropPosition({ targetIndex });
		}
	}, [
		prev,
		next,
		coordinates.x,
		coordinates.y,
		element,
		dropZone.element,
		dropZone.rect,
		dropZone.childrenRects,
		dropZone.children,
		dropZone.arrangement,
		coordinates,
		style,
		onDropPosition
	]);

	return (
		<Box
			className="craftercms-drop-marker"
			sx={{
				...sx.root,
				...style,
				// @ts-ignore
				'&::before, &::after': sx.tips,
				...(arrangement === HORIZONTAL ? sx.horizontal : sx.vertical)
			}}
		/>
	);
}

export default DropMarker;
