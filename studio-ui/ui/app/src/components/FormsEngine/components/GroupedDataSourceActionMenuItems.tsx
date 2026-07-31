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

import { useMemo, useState, type MouseEvent } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import { buildActionGroups, invokeActionChoice, invokeResolvedAction } from '../dataSources/actionAdapters';
import type {
	DataSourceActionGroup,
	DataSourceFieldContext,
	DataSourceSelection,
	ResolvedDataSourceAction
} from '../dataSources/types';

/**
 * Props for {@link GroupedDataSourceActionMenuItems}.
 *
 * Render this component as children of an open MUI `Menu` (or similar); it emits `MenuItem`s
 * (and nested menus / dialogs) rather than owning the outer menu shell.
 */
export interface GroupedDataSourceActionMenuItemsProps {
	/** Flat list of resolved field actions; grouped via {@link buildActionGroups}. */
	actions: readonly ResolvedDataSourceAction[];
	/** Field/runtime context forwarded to `run`, custom `MenuItem`, and `Dialog`. */
	context: DataSourceFieldContext;
	/** When true, disables group and custom menu items (and nested choice items). */
	disabled?: boolean;
	/** Called with the selection (or `null`) after a successful action / dialog. */
	onResult(selection: DataSourceSelection | DataSourceSelection[] | null): void;
	/** Called when an invoked action / dialog rejects. */
	onError(error: unknown): void;
	/**
	 * Optional close hook for the host menu. Invoked after `onResult` / `onError` so pickers can
	 * dismiss their add/actions menu once a flow finishes.
	 */
	onMenuClose?(): void;
}

/**
 * Menu items for Forms Engine data-source actions, grouped by intent.
 *
 * Turns a flat {@link ResolvedDataSourceAction} list into the “add / browse / upload / …” menu
 * used by media and item pickers:
 *
 * - **Standard kinds** (`browse`, `search`, `upload`, `create`) are collapsed by
 *   {@link buildActionGroups} into one top-level item per binding property + kind (e.g. a single
 *   “Browse” even when several data sources offer browse).
 * - A group with **one** choice runs immediately via {@link invokeActionChoice}.
 * - A group with **multiple** choices opens a nested submenu so the author picks the concrete
 *   data source / create target.
 * - **Custom** actions (`MenuItem`, `Dialog`, or non-standard `kind`) stay ungrouped: custom
 *   `MenuItem` components render as-is; `Dialog` actions mount their dialog on click; otherwise
 *   {@link invokeResolvedAction} runs.
 *
 * Used by ImagePicker, VideoPicker, TranscodedVideoPicker, RichTextEditor, and NodeSelector
 * (custom actions). Pair with `useFieldDataSources` (or equivalent) for the `actions` /
 * `context` inputs.
 *
 * @example
 * ```tsx
 * <Menu open={open} onClose={() => setOpen(false)}>
 *   <GroupedDataSourceActionMenuItems
 *     actions={dataSources.actions}
 *     context={dataSources.context}
 *     onResult={applySelection}
 *     onError={console.error}
 *     onMenuClose={() => setOpen(false)}
 *   />
 * </Menu>
 * ```
 */
export function GroupedDataSourceActionMenuItems({
	actions,
	context,
	disabled,
	onResult,
	onError,
	onMenuClose
}: GroupedDataSourceActionMenuItemsProps) {
	const { groups, customActions } = useMemo(() => buildActionGroups(actions), [actions]);
	const [choiceAnchor, setChoiceAnchor] = useState<HTMLElement | null>(null);
	const [choiceGroup, setChoiceGroup] = useState<DataSourceActionGroup | null>(null);
	const [dialogAction, setDialogAction] = useState<ResolvedDataSourceAction | null>(null);

	const closeChoices = () => {
		setChoiceAnchor(null);
		setChoiceGroup(null);
	};
	const handleResult = (selection: DataSourceSelection | DataSourceSelection[] | null) => {
		onResult(selection);
		onMenuClose?.();
	};
	const handleError = (error: unknown) => {
		onError(error);
		onMenuClose?.();
	};
	const runGroup = (group: DataSourceActionGroup, event: MouseEvent<HTMLElement>) => {
		if (group.choices.length === 1) {
			invokeActionChoice(group.choices[0], context).then(handleResult).catch(handleError);
		} else {
			setChoiceGroup(group);
			setChoiceAnchor(event.currentTarget);
		}
	};
	const runCustom = (action: ResolvedDataSourceAction) => {
		if (action.Dialog) {
			setDialogAction(action);
		} else {
			invokeResolvedAction(action, context).then(handleResult).catch(handleError);
		}
	};

	return (
		<>
			{groups.map((group) => (
				<MenuItem key={group.key} disabled={disabled || group.choices.length === 0} onClick={(e) => runGroup(group, e)}>
					{group.icon}
					{group.label}
				</MenuItem>
			))}
			{customActions.map((action) =>
				action.MenuItem ? (
					<action.MenuItem
						key={action.actionKey}
						action={action}
						context={context}
						disabled={disabled}
						onResult={handleResult}
						onError={handleError}
					/>
				) : (
					<MenuItem key={action.actionKey} disabled={disabled} onClick={() => runCustom(action)}>
						{action.icon}
						{action.label}
					</MenuItem>
				)
			)}
			<Menu anchorEl={choiceAnchor} open={Boolean(choiceAnchor)} onClose={closeChoices}>
				{choiceGroup?.choices.map((choice) => (
					<MenuItem
						key={choice.key}
						disabled={disabled}
						onClick={() => {
							closeChoices();
							invokeActionChoice(choice, context).then(handleResult).catch(handleError);
						}}
					>
						<ListItemText primary={choice.label} secondary={choice.description} />
					</MenuItem>
				))}
			</Menu>
			{dialogAction?.Dialog && (
				<dialogAction.Dialog
					action={dialogAction}
					context={context}
					disabled={disabled}
					onResult={(selection) => {
						handleResult(selection);
						setDialogAction(null);
					}}
					onError={(error) => {
						handleError(error);
						setDialogAction(null);
					}}
				/>
			)}
		</>
	);
}

export default GroupedDataSourceActionMenuItems;
