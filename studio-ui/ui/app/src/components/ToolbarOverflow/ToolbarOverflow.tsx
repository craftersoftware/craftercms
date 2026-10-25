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
	const previousCountRef = useRef<number | null>(null);
	const [visibleCount, setVisibleCount] = useState(items.length);
	const [menuOpen, setMenuOpen] = useState(false);
	const itemCount = items.length;

	useLayoutEffect(() => {
		const bar = barRef.current;
		if (!bar) {
			return undefined;
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
			const moreWidth = moreRef.current?.offsetWidth || MORE_BUTTON_FALLBACK_WIDTH;
			const next = countVisibleToolbarItems(widths, bar.clientWidth, moreWidth);
			setVisibleCount((current) => {
				if (next === current) {
					return current;
				}
				// Keep the tighter count if the button appearing would immediately reveal an item again.
				if (previousCountRef.current === next && next > current) {
					return current;
				}
				previousCountRef.current = current;
				return next;
			});
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

	useLayoutEffect(() => {
		if (visibleCount >= itemCount && menuOpen) {
			setMenuOpen(false);
		}
	}, [itemCount, menuOpen, visibleCount]);

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
					minWidth: 0,
					flex: '1 1 auto',
					overflow: 'hidden'
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
							aria-expanded={menuOpen}
							aria-controls={menuOpen ? menuId : undefined}
							aria-haspopup="true"
							onClick={() => setMenuOpen((open) => !open)}
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
				id={menuId}
				open={menuOpen && hasOverflow}
				anchorEl={moreRef.current}
				onClose={() => setMenuOpen(false)}
				anchorOrigin={{ vertical: 'bottom', horizontal: align === 'end' ? 'right' : 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: align === 'end' ? 'right' : 'left' }}
			>
				<Box
					role="group"
					aria-label={moreLabel}
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
