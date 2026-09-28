import { CSSProperties, useEffect, useRef, useState } from 'react';
import {
	draggable,
	dropTargetForElements,
	monitorForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
	attachClosestEdge,
	type Edge,
	extractClosestEdge
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge';
import { triggerPostMoveFlash } from '@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash';
import { createPortal, flushSync } from 'react-dom';
import DragIndicator from '@mui/icons-material/DragIndicatorRounded';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import invariant from 'tiny-invariant';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Box from '@mui/material/Box';
import { SxProps, SystemStyleObject } from '@mui/system';
import List from '@mui/material/List';
import useUpdateRefs from '../../../hooks/useUpdateRefs';

// Adapted from:
// https://stackblitz.com/github/alexreardon/pdnd-react-tailwind
// https://atlassian.design/components/pragmatic-drag-and-drop/about
// https://atlassian.design/components/pragmatic-drag-and-drop/examples#simple-list-on-other-stacks

export type Orientation = 'horizontal' | 'vertical';

export type ItemState =
	| { type: 'idle' }
	| { type: 'preview'; container: HTMLElement }
	| { type: 'is-dragging' }
	| { type: 'is-dragging-over'; closestEdge: Edge | null };

export type TItem<T = unknown> = { key: string; value: string; data?: T };

export type TItemData = { [itemDataKey]: true; itemId: TItem['key'] };

export interface SortableListProps<T = unknown> {
	items: TItem<T>[];
	onChange(items: TItem<T>[]): void;
	selectedItemId?: string;
	onlySelectedSortable?: boolean;
}

const strokeSize = 2;
const terminalSize = 8;
const gapBetweenItems = '4px';
const offsetToAlignTerminalWithLine = (strokeSize - terminalSize) / 2;
const idle: ItemState = { type: 'idle' };
const itemDataKey = Symbol('SortableItem');

// Drop Indicator orientation
const edgeToOrientationMap: Record<Edge, Orientation> = {
	top: 'horizontal',
	bottom: 'horizontal',
	left: 'vertical',
	right: 'vertical'
};

// Drop Indicator orientation-related styles
const orientationStyles: Record<Orientation, SxProps> = {
	horizontal: {
		height: `var(--line-thickness)`,
		left: `var(--terminal-radius)`,
		right: 0
	},
	vertical: {
		width: `var(--line-thickness)`,
		top: 'var(--terminal-radius)',
		bottom: 0
	}
};

// Drop Indicator `::before` block orientation-related styles
const terminalOrientationStyles: Record<Orientation, SystemStyleObject> = {
	horizontal: { left: `var(--negative-terminal-size)` },
	vertical: { top: 'var(--negative-terminal-size)' }
};

// Drop Indicator edge-related styles
const edgeStyles: Record<Edge, SxProps> = {
	top: { top: 'var(--line-offset)' },
	right: { right: 'var(--line-offset)' },
	bottom: { bottom: 'var(--line-offset)' },
	left: { left: 'var(--line-offset)' }
};

// Drop Indicator `::before` block edge-related styles
const terminalEdgeStyles: Record<Edge, SystemStyleObject> = {
	top: { top: 'var(--offset-terminal)' },
	right: { right: 'var(--offset-terminal)' },
	bottom: { bottom: 'var(--offset-terminal)' },
	left: { left: 'var(--offset-terminal)' }
};

function getItemData(item: TItem): TItemData {
	return { [itemDataKey]: true, itemId: item.key };
}

function isItemData(data: Record<string | symbol, unknown>): data is TItemData {
	return data[itemDataKey] === true;
}

function DropIndicator({ edge, gap }: { edge: Edge; gap: string }) {
	const lineOffset = `calc(-0.5 * (${gap} + ${strokeSize}px))`;
	const orientation = edgeToOrientationMap[edge];
	return (
		<Box
			style={
				{
					'--line-thickness': `${strokeSize}px`,
					'--line-offset': `${lineOffset}`,
					'--terminal-size': `${terminalSize}px`,
					'--terminal-radius': `${terminalSize / 2}px`,
					'--negative-terminal-size': `-${terminalSize}px`,
					'--offset-terminal': `${offsetToAlignTerminalWithLine}px`
				} as CSSProperties
			}
			sx={{
				position: 'absolute',
				zIndex: 10,
				bgcolor: 'primary.main',
				pointerEvents: 'none',
				...orientationStyles[orientation],
				...edgeStyles[edge],
				'::before': {
					content: '""',
					width: `var(--terminal-size)`,
					height: `var(--terminal-size)`,
					position: 'absolute',
					boxSizing: 'border-box',
					borderWidth: `var(--line-thickness)`,
					borderStyle: 'solid',
					borderColor: 'primary.main',
					borderRadius: 10,
					...terminalOrientationStyles[orientation],
					...terminalEdgeStyles[edge]
				}
			}}
		/>
	);
}

function DragPreview({ item }: { item: TItem }) {
	return (
		<Box
			sx={{
				borderStyle: 'solid',
				borderRadius: 2,
				bgcolor: 'secondary.main',
				p: 2
			}}
		>
			{item.value}
		</Box>
	);
}

function SortableItem({ item, selected, sortable = true }: { item: TItem; selected?: boolean; sortable?: boolean }) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<ItemState>(idle);
	useEffect(() => {
		const element = ref.current;
		invariant(element);
		return combine(
			sortable
				? draggable({
						element,
						getInitialData() {
							return getItemData(item);
						},
						onGenerateDragPreview({ nativeSetDragImage }) {
							setCustomNativeDragPreview({
								nativeSetDragImage,
								getOffset: pointerOutsideOfPreview({
									x: '16px',
									y: '8px'
								}),
								render({ container }) {
									setState({ type: 'preview', container });
								}
							});
						},
						onDragStart() {
							setState({ type: 'is-dragging' });
						},
						onDrop() {
							setState(idle);
						}
					})
				: () => {},
			dropTargetForElements({
				element,
				canDrop({ source }) {
					// not allowing dropping on yourself
					if (source.element === element) {
						return false;
					}
					// only allowing items to be dropped on me
					return isItemData(source.data);
				},
				getData({ input }) {
					const data = getItemData(item);
					return attachClosestEdge(data, {
						element,
						input,
						allowedEdges: ['top', 'bottom']
					});
				},
				getIsSticky() {
					return true;
				},
				onDragEnter({ self }) {
					const closestEdge = extractClosestEdge(self.data);
					setState({ type: 'is-dragging-over', closestEdge });
				},
				onDrag({ self }) {
					const closestEdge = extractClosestEdge(self.data);

					// Only need to update react state if nothing has changed.
					// Prevents re-rendering.
					setState((current) => {
						if (current.type === 'is-dragging-over' && current.closestEdge === closestEdge) {
							return current;
						}
						return { type: 'is-dragging-over', closestEdge };
					});
				},
				onDragLeave() {
					setState(idle);
				},
				onDrop() {
					setState(idle);
				}
			})
		);
	}, [item, sortable]);
	return (
		<>
			<ListItemButton
				ref={ref}
				data-item-id={item.key}
				sx={[
					{ position: 'relative', borderRadius: 1, cursor: sortable ? 'grab' : 'default' },
					state.type === 'is-dragging' && { opacity: 0.4 },
					!sortable && { background: 'none !important' }
				]}
				selected={selected}
			>
				{sortable && (
					<ListItemIcon>
						<DragIndicator fontSize="small" />
					</ListItemIcon>
				)}
				<ListItemText primary={item.value} />
				{state.type === 'is-dragging-over' && state.closestEdge ? (
					<DropIndicator edge={state.closestEdge} gap={gapBetweenItems} />
				) : null}
			</ListItemButton>
			{state.type === 'preview' ? createPortal(<DragPreview item={item} />, state.container) : null}
		</>
	);
}

export function SortableList({ items, onChange, selectedItemId, onlySelectedSortable }: SortableListProps) {
	const onChangeRef = useUpdateRefs(onChange);
	useEffect(() => {
		return monitorForElements({
			canMonitor({ source }) {
				return isItemData(source.data);
			},
			onDrop({ location, source }) {
				const target = location.current.dropTargets[0];
				if (!target) {
					return;
				}

				const sourceData = source.data;
				const targetData = target.data;

				if (!isItemData(sourceData) || !isItemData(targetData)) {
					return;
				}

				const indexOfSource = items.findIndex((item) => item.key === sourceData.itemId);
				const indexOfTarget = items.findIndex((item) => item.key === targetData.itemId);

				if (indexOfTarget < 0 || indexOfSource < 0) {
					return;
				}

				const closestEdgeOfTarget = extractClosestEdge(targetData);

				// Avoid any re-rendering when nothing moved: when the target position is below or above itself,
				// there won't be a move, no change.
				if (
					(closestEdgeOfTarget === 'top' && indexOfSource < indexOfTarget && indexOfSource + 1 === indexOfTarget) ||
					(closestEdgeOfTarget === 'bottom' && indexOfSource > indexOfTarget && indexOfSource - 1 === indexOfTarget)
				) {
					return;
				}

				// Using `flushSync` so we can query the DOM straight after this line (apply changes immediately)
				flushSync(() => {
					onChangeRef.current(
						reorderWithEdge({
							list: items,
							startIndex: indexOfSource,
							indexOfTarget,
							closestEdgeOfTarget,
							axis: 'vertical'
						})
					);
				});

				// Being simple and just querying for the item after the drop.
				// We could use React context to register the element in a lookup,
				// and then we could retrieve that element after the drop and use
				// `triggerPostMoveFlash`. But this gets the job done.
				const element = document.querySelector(`[data-item-id="${sourceData.itemId}"]`);
				if (element instanceof HTMLElement) {
					triggerPostMoveFlash(element);
				}
			}
		});
	}, [items, onChangeRef]);
	return (
		<List sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 1 }}>
			{items.map((item) => (
				<SortableItem
					key={item.key}
					item={item}
					selected={item.key === selectedItemId}
					sortable={onlySelectedSortable ? item.key === selectedItemId : true}
				/>
			))}
		</List>
	);
}

export default SortableList;
