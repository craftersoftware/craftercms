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
import { WidgetDialogProps } from './utils';
import EnhancedDialog from '../EnhancedDialog';
import Suspencified from '../Suspencified/Suspencified';
import { Widget } from '../Widget/Widget';
import Box from '@mui/material/Box';

export function WidgetDialog(props: WidgetDialogProps) {
	const { title, fullHeight = true, widget, onSubmittingAndOrPendingChange, isSubmitting, extraProps, ...rest } = props;
	return (
		<EnhancedDialog
			title={title}
			maxWidth="xl"
			slotProps={{
				paper: {
					sx: fullHeight && { minHeight: '90vh' }
				}
			}}
			isSubmitting={isSubmitting}
			updateSubmittingOrHasPendingChanges={onSubmittingAndOrPendingChange}
			{...rest}
		>
			<Box
				component="section"
				sx={(theme) => {
					const toolbarMixin: any = theme.mixins.toolbar;
					const key1 = '@media (min-width:0px)';
					const key1a = '@media (orientation: landscape)';
					const key2 = '@media (min-width:600px)';
					if (fullHeight) {
						if (!toolbarMixin[key1]?.[key1a] || !toolbarMixin[key2] || !toolbarMixin.minHeight) {
							console.error('[WidgetDialog] MUI may have changed their toolbar mixin.', toolbarMixin);
							return { overflow: 'auto', height: `calc(90vh - 57px)` };
						} else {
							return {
								[key1]: {
									[key1a]: {
										height: `calc(90vh - ${toolbarMixin[key1].minHeight}px - 1px)`
									}
								},
								[key2]: {
									height: `calc(90vh - ${toolbarMixin[key2].minHeight}px - 1px)`
								},
								overflow: 'auto',
								height: `calc(90vh - ${toolbarMixin.minHeight}px - 1px)`
							};
						}
					} else {
						return {};
					}
				}}
			>
				<Suspencified loadingStateProps={{ sxs: { graphicRoot: { minWidth: '350px', minHeight: '150px' } } }}>
					<Widget
						{...widget}
						overrideProps={{ onSubmittingAndOrPendingChange, isSubmitting, mountMode: 'dialog', ...extraProps }}
					/>
				</Suspencified>
			</Box>
		</EnhancedDialog>
	);
}

export default WidgetDialog;
