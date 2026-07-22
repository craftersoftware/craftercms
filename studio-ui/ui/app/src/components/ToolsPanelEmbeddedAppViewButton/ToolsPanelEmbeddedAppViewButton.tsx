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

import React from 'react';
import ToolsPanelListItemButton, { ToolsPanelListItemButtonProps } from '../ToolsPanelListItemButton';
import { usePossibleTranslation } from '../../hooks/usePossibleTranslation';
import { WidgetDescriptor } from '../../models';
import { useDispatch, useStore } from 'react-redux';
import { pushDialog, updateDialogState } from '../../state/actions/dialogStack';
import { createComponentId } from '../../utils/system';
import GlobalState from '../../models/GlobalState';
import { EnhancedDialogProps } from '../EnhancedDialog';

interface ToolsPanelEmbeddedAppViewButtonProps extends Omit<ToolsPanelListItemButtonProps, 'onClick'> {
	widget: WidgetDescriptor;
}

export function ToolsPanelEmbeddedAppViewButton(props: ToolsPanelEmbeddedAppViewButtonProps) {
	const { widget, ...buttonProps } = props;
	const title = usePossibleTranslation(props.title);
	const dispatch = useDispatch();
	const store = useStore<GlobalState>();
	const widgetDialogId = widget.id;

	const openEmbeddedApp = () => {
		const existing = store.getState().dialogStack.byId[widgetDialogId];
		if (existing) {
			const { isMinimized } = existing.props as EnhancedDialogProps;
			dispatch(
				updateDialogState({
					id: widgetDialogId,
					props: {
						title,
						widget,
						...(isMinimized && { isMinimized: false })
					}
				})
			);
		} else {
			dispatch(
				pushDialog({
					id: widgetDialogId,
					component: createComponentId('WidgetDialog'),
					allowMinimize: true,
					props: { title, widget }
				})
			);
		}
	};

	return <ToolsPanelListItemButton {...buttonProps} onClick={openEmbeddedApp} />;
}

export default ToolsPanelEmbeddedAppViewButton;
