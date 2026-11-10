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
import { defineMessages, useIntl } from 'react-intl';
import { countVisibleToolbarItems } from './countVisibleToolbarItems';
import { toolbarItemSignature } from './toolbarItemSignature';
import { getFocusRingSx } from '../../styles/focusRing';

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
const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Identifies the rendered items, so cached widths are dropped when an item is replaced by another one. */
function getItemsSignature(items: ReturnType<typeof Children.toArray>): string {
	return items
		.map((child) => {
			if (!React.isValidElement<{ id?: string; uiKey?: string; configuration?: unknown }>(child)) {
				return String(child);
			}
			const type = typeof child.type === 'string' ? child.type : (child.type as { name?: string }).name;
			const { id, uiKey, configuration } = child.props;
			return toolbarItemSignature({
				key: child.key == null ? null : String(child.key),
				typeName: type ?? '',
				id,
				uiKey,
				configuration
			});
		})
		.join('\n');
}

/** Index of the overflow item, and of the control within it, that holds `element`. */
function locateFocus(element: Element | null): { item: number; control: number } | null {
	const wrapper = element?.closest<HTMLElement>('[data-toolbar-overflow-item]');
	if (!wrapper) {
		return null;
	}
	return {
		item: Number(wrapper.dataset.toolbarOverflowItem),
		control: Math.max(0, Array.from(wrapper.querySelectorAll(FOCUSABLE_SELECTOR)).indexOf(element))
	};
}

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
	const menuContentRef = useRef<HTMLDivElement>(null);
	// Set when the menu closes because everything fits again while focus was inside it.
	const pendingFocusRef = useRef<{ item: number; control: number } | null>(null);
	const itemCount = items.length;
	const itemsSignature = getItemsSignature(items);
	const lastSignatureRef = useRef(itemsSignature);
	// The item list changed (e.g. the toolbar configuration arrived): render every item again so each one
	// can be measured. State is adjusted while rendering, which React applies before painting.
	const [seenSignature, setSeenSignature] = useState(itemsSignature);
	if (seenSignature !== itemsSignature) {
		setSeenSignature(itemsSignature);
		setVisibleCount(itemCount);
	}

	useLayoutEffect(() => {
		visibleCountRef.current = visibleCount;
		const pendingFocus = pendingFocusRef.current;
		if (pendingFocus && visibleCount >= itemCount) {
			// The menu closed and its items moved back into the bar. Focus the same control there, so it does
			// not fall to the document body (the More button that would get it back is gone).
			pendingFocusRef.current = null;
			const wrapper = itemRefs.current[pendingFocus.item];
			const controls = wrapper?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
			(controls?.[pendingFocus.control] ?? controls?.[0])?.focus();
		}
		const bar = barRef.current;
		if (!bar) {
			return undefined;
		}
		if (lastSignatureRef.current !== itemsSignature) {
			// Cached widths belong to other items.
			lastSignatureRef.current = itemsSignature;
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
			// The end-aligned bar keeps its trailing items (e.g. the Navigation menu at the edge) and moves the
			// leading ones into the menu first.
			const next = countVisibleToolbarItems(
				align === 'end' ? [...widths].reverse() : widths,
				bar.clientWidth - FOCUS_RING_ROOM * 2,
				currentMoreWidth
			);
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
				const menuPaper = menuContentRef.current?.parentElement;
				if (resolved !== current && menuPaper?.contains(document.activeElement)) {
					// Focus on the menu itself (not on an item) goes to the first item that moves back.
					pendingFocusRef.current = locateFocus(document.activeElement) ?? {
						item: align === 'end' ? 0 : current,
						control: 0
					};
				}
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
	}, [align, itemCount, itemsSignature, visibleCount]);

	// Item indexes stay absolute, so `itemRefs` and the cached widths line up whichever end is kept.
	const firstVisible = align === 'end' ? itemCount - visibleCount : 0;
	const visibleItems = items.slice(firstVisible, firstVisible + visibleCount);
	const overflowItems = align === 'end' ? items.slice(0, firstVisible) : items.slice(visibleCount);
	const firstOverflow = align === 'end' ? 0 : visibleCount;
	const hasOverflow = overflowItems.length > 0;
	const moreButton = (
		<Tooltip title={moreLabel}>
			<IconButton
				ref={moreRef}
				aria-label={moreLabel}
				aria-expanded={Boolean(menuAnchor)}
				aria-controls={menuAnchor ? menuId : undefined}
				aria-haspopup="dialog"
				onClick={(event) => {
					// Read currentTarget before the state updater. React runs the updater after the event
					// dispatch, by which time currentTarget is null, and the menu would not open.
					const anchor = event.currentTarget;
					setMenuAnchor((current) => (current ? null : anchor));
				}}
				sx={{
					flex: '0 0 auto',
					position: 'relative',
					'&:focus-visible, &.Mui-focusVisible': getFocusRingSx()
				}}
			>
				<MoreHorizRoundedIcon />
			</IconButton>
		</Tooltip>
	);

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
				{hasOverflow && align === 'end' && moreButton}
				{visibleItems.map((child, offset) => {
					const index = firstVisible + offset;
					return (
						<Box
							key={index}
							ref={(node: HTMLDivElement | null) => {
								itemRefs.current[index] = node;
							}}
							sx={{ display: 'flex', flex: '0 0 auto' }}
						>
							<Suspense fallback={null}>{child}</Suspense>
						</Box>
					);
				})}
				{hasOverflow && align !== 'end' && moreButton}
			</Box>
			{/*
			 * Widgets in the menu may open their own popups (QuickCreate's menu, the Launcher anchored to its button)
			 * or Studio dialogs, so the menu stays open under them rather than unmounting their anchor. MUI only
			 * traps focus in the topmost modal, and when that one closes focus returns to the control in this menu.
			 */}
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
					ref={menuContentRef}
					sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 1, gap: 0.5, maxWidth: '100vw' }}
				>
					{overflowItems.map((child, offset) => (
						<Box
							key={firstOverflow + offset}
							data-toolbar-overflow-item={firstOverflow + offset}
							sx={{ display: 'contents' }}
						>
							<Suspense fallback={null}>{child}</Suspense>
						</Box>
					))}
				</Box>
			</Popover>
		</>
	);
}

export default ToolbarOverflow;
