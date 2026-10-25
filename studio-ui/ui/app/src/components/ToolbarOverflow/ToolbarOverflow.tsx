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

import React, { Children, Suspense, useId, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { visuallyHidden } from '@mui/utils';
import { defineMessages, useIntl } from 'react-intl';
import { countVisibleToolbarItems } from './countVisibleToolbarItems';

const messages = defineMessages({
	moreActions: {
		id: 'previewToolbar.moreActions',
		defaultMessage: 'More toolbar actions'
	}
});

const MORE_BUTTON_FALLBACK_WIDTH = 48;
/**
 * The bar clips its overflow, which would also clip the 2px focus outline (plus 2px offset) of a control at its
 * edge. The bar pads itself by this much on every side and cancels it with a negative margin.
 */
const FOCUS_RING_ROOM = 4;

export interface ToolbarOverflowProps {
	children: React.ReactNode;
	/** Pack the items that still fit against this edge of the row. */
	align?: 'start' | 'end';
}

/**
 * Keeps a single row of toolbar controls and moves the ones that do not fit into a menu.
 * Items stay mounted in only one place, so a control is not duplicated when the row is narrow.
 */
export function ToolbarOverflow(props: ToolbarOverflowProps) {
	const { children, align = 'start' } = props;
	const items = Children.toArray(children);
	const { formatMessage } = useIntl();
	const moreLabel = formatMessage(messages.moreActions);
	const menuId = useId();
	const barRef = useRef<HTMLDivElement>(null);
	const moreRef = useRef<HTMLButtonElement>(null);
	const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
	const widthsRef = useRef<number[]>([]);
	const [visibleCount, setVisibleCount] = useState(items.length);
	const visibleCountRef = useRef(visibleCount);
	const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
	// Width every item needs side by side. It is the bar's flex basis, so the room the bar gets does
	// not depend on how many items are currently packed (a packed bar would otherwise shrink to its
	// content and never grow back).
	const [naturalWidth, setNaturalWidth] = useState(0);
	const [moreWidth, setMoreWidth] = useState(MORE_BUTTON_FALLBACK_WIDTH);
	const lastItemCountRef = useRef(items.length);
	const itemCount = items.length;
	// The item list changed (e.g. the toolbar configuration arrived): render every item again so each one
	// can be measured. State is adjusted while rendering, which React applies before painting.
	const [seenItemCount, setSeenItemCount] = useState(itemCount);
	if (seenItemCount !== itemCount) {
		setSeenItemCount(itemCount);
		setVisibleCount(itemCount);
	}

	useLayoutEffect(() => {
		visibleCountRef.current = visibleCount;
		const bar = barRef.current;
		if (!bar) {
			return undefined;
		}
		if (lastItemCountRef.current !== itemCount) {
			// Cached widths belong to other items.
			lastItemCountRef.current = itemCount;
			widthsRef.current = [];
		}
		const measure = () => {
			const nextWidths = widthsRef.current.slice(0, itemCount);
			itemRefs.current.forEach((node, index) => {
				if (node && node.offsetWidth > 0) {
					nextWidths[index] = node.offsetWidth;
				}
			});
			widthsRef.current = nextWidths;
			const widths = Array.from({ length: itemCount }, (_, index) => nextWidths[index] ?? 0);
			const currentMoreWidth = moreRef.current?.offsetWidth || MORE_BUTTON_FALLBACK_WIDTH;
			if (moreRef.current?.offsetWidth) {
				setMoreWidth(moreRef.current.offsetWidth);
			}
			if (widths.length > 0 && widths.every((width) => width > 0)) {
				setNaturalWidth(widths.reduce((sum, width) => sum + width, 0));
			}
			const next = countVisibleToolbarItems(widths, bar.clientWidth - FOCUS_RING_ROOM * 2, currentMoreWidth);
			// The bar's room does not depend on the packed count, so the result is stable and needs no
			// hysteresis. (A guard against "button appearing reveals an item again" kept a collapsed bar
			// collapsed after the window grew back.)
			const current = visibleCountRef.current;
			const resolved = next;
			if (resolved !== current) {
				visibleCountRef.current = resolved;
				setVisibleCount(resolved);
			}
			if (resolved >= itemCount) {
				setMenuAnchor(null);
			}
		};
		measure();
		const observer = new ResizeObserver(() => measure());
		observer.observe(bar);
		itemRefs.current.forEach((node) => {
			if (node) {
				observer.observe(node);
			}
		});
		return () => observer.disconnect();
	}, [itemCount, visibleCount]);

	const overflowItems = items.slice(visibleCount);
	const hasOverflow = overflowItems.length > 0;

	return (
		<>
			<Box
				ref={barRef}
				data-toolbar-overflow=""
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
					// Never narrower than the More button, so it cannot be clipped away.
					minWidth: (hasOverflow ? moreWidth : 0) + FOCUS_RING_ROOM * 2,
					flex: naturalWidth > 0 ? `1 1 ${naturalWidth + FOCUS_RING_ROOM * 2}px` : '1 1 auto',
					overflow: 'hidden',
					padding: `${FOCUS_RING_ROOM}px`,
					margin: `-${FOCUS_RING_ROOM}px`
				}}
			>
				{items.slice(0, visibleCount).map((child, index) => (
					<Box
						key={index}
						ref={(node: HTMLDivElement | null) => {
							itemRefs.current[index] = node;
						}}
						sx={{ display: 'flex', flex: '0 0 auto' }}
					>
						<Suspense fallback={null}>{child}</Suspense>
					</Box>
				))}
				{hasOverflow && (
					<Tooltip title={moreLabel} describeChild>
						<IconButton
							ref={moreRef}
							aria-expanded={Boolean(menuAnchor)}
							aria-controls={menuAnchor ? menuId : undefined}
							aria-haspopup="dialog"
							onClick={(event) => setMenuAnchor((current) => (current ? null : event.currentTarget))}
							sx={{
								flex: '0 0 auto',
								position: 'relative',
								'&:focus-visible, &.Mui-focusVisible': {
									outline: '2px solid',
									outlineColor: 'primary.main',
									outlineOffset: 2
								}
							}}
						>
							<MoreHorizRoundedIcon />
							<Box component="span" sx={visuallyHidden}>
								{moreLabel}
							</Box>
						</IconButton>
					</Tooltip>
				)}
			</Box>
			<Popover
				open={Boolean(menuAnchor) && hasOverflow}
				anchorEl={menuAnchor}
				onClose={() => setMenuAnchor(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: align === 'end' ? 'right' : 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: align === 'end' ? 'right' : 'left' }}
				slotProps={{
					paper: {
						id: menuId,
						role: 'dialog',
						'aria-modal': true,
						'aria-label': moreLabel
					}
				}}
			>
				<Box
					sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 1, gap: 0.5, maxWidth: '100vw' }}
				>
					{overflowItems.map((child, index) => (
						<Suspense key={visibleCount + index} fallback={null}>
							{child}
						</Suspense>
					))}
				</Box>
			</Popover>
		</>
	);
}

export default ToolbarOverflow;
