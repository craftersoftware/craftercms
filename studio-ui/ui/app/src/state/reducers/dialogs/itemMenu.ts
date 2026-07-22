/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { createReducer } from '@reduxjs/toolkit';
import GlobalState from '../../../models/GlobalState';
import { closeItemMenu, itemMenuClosed, showItemMenu } from '../../actions/dialogs';
import { ItemMenuStateProps } from '../../../components/ItemActionsMenu';

const initialState: ItemMenuStateProps = {
	open: false,
	path: null,
	anchorReference: 'anchorPosition',
	anchorPosition: {
		top: 0,
		left: 0
	}
};

export default createReducer<GlobalState['dialogs']['itemMenu']>(initialState, (builder) => {
	builder
		.addCase(showItemMenu, (state, { payload }) => ({
			...state,
			onClose: closeItemMenu(),
			onClosed: itemMenuClosed(),
			...(payload as Partial<ItemMenuStateProps>),
			open: true
		}))
		.addCase(closeItemMenu, (state) => ({ ...state, open: false }))
		.addCase(itemMenuClosed, () => initialState);
});
