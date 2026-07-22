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

import { type DialogStackItem, GlobalState } from '../../models/GlobalState';
import { createReducer } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import { WidgetDialogProps } from '../../components/WidgetDialog/utils';
import { popDialog, pushDialog, pushNonDialog, updateDialogState, updateNonDialogState } from '../actions/dialogStack';
import type { CodeEditorDialogProps } from '../../components/CodeEditorDialog';
import type { FormsEngineDialogProps } from '../../components/FormsEngine';
import type { LegacyFormDialogProps } from '../../components/LegacyFormDialog/utils';

const reducer = createReducer<GlobalState['dialogStack']>(
	{
		ids: [],
		byId: {}
	},
	(builder) => {
		builder.addCase(pushDialog, (state, { payload }) => {
			const component = payload.component;
			// If the dialog is a CodeEditorDialog, FormsEngineDialog or LegacyFormDialog, we run extra verification.
			// If the same type of dialog is already open for the same path, we set minimized to false.
			if (
				component === 'craftercms.components.CodeEditorDialog' ||
				component === 'craftercms.components.LegacyFormDialog' ||
				component === 'craftercms.components.FormsEngineDialog'
			) {
				const payloadProps = payload.props as CodeEditorDialogProps | LegacyFormDialogProps;
				const dialogState = Object.values(state.byId).find((dialog) => {
					if (dialog.component === 'craftercms.components.FormsEngineDialog') {
						return (
							dialog.component === component &&
							(dialog.props as FormsEngineDialogProps).formProps.update?.path ===
								(payload.props as FormsEngineDialogProps).formProps.update?.path
						);
					} else {
						const dialogProps = dialog.props as CodeEditorDialogProps | LegacyFormDialogProps;
						return dialog.component === component && dialogProps.path === payloadProps.path;
					}
				});
				if (dialogState) {
					const byIdState = state.byId[dialogState.id] as
						| DialogStackItem<CodeEditorDialogProps>
						| DialogStackItem<LegacyFormDialogProps>
						| DialogStackItem<FormsEngineDialogProps>;
					state.byId[dialogState.id].props = {
						...byIdState.props,
						isMinimized: false
					};
					return state;
				}
			}

			const id = payload.id ?? nanoid();
			state.ids.push(id);
			state.byId[id] = {
				id,
				...payload,
				props: {
					open: true,
					isMinimized: false,
					isFullScreen: false,
					hasPendingChanges: false,
					isSubmitting: false,
					...(payload.props as object)
				}
			};
		});
		builder.addCase(popDialog, (state, { payload }) => {
			state.ids = state.ids.filter((id) => payload.id !== id);
			delete state.byId[payload.id];
		});
		builder.addCase(updateDialogState, (state, { payload }) => {
			state.byId[payload.id].props = {
				// @ts-expect-error TS2698: TypeScript doesn't think the WritableDraft can be spread.
				...state.byId[payload.id].props,
				// @ts-expect-error TS2698: Don't know how to type this all around. Type is too dynamic.
				...payload.props
			};
		});
		builder.addCase(pushNonDialog, (state, { payload }) => {
			const id = payload.id ?? nanoid();
			state.ids.push(id);
			state.byId[id] = {
				id,
				component: 'craftercms.components.WidgetDialog',
				props: {
					open: true,
					isMinimized: false,
					isFullScreen: false,
					hasPendingChanges: false,
					isSubmitting: false,
					...(payload.dialogProps as object),
					widget: {
						id: payload.component,
						configuration: payload.props
					}
				} as WidgetDialogProps
			};
		});
		builder.addCase(updateNonDialogState, (state, { payload }) => {
			const target = (state.byId[payload.id].props as WidgetDialogProps).widget;
			target.configuration = {
				...target.configuration,
				// @ts-expect-error: Don't know how to type this all around. Type is too dynamic.
				...payload.props
			};
		});
	}
);

export default reducer;
