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

import React, { useMemo, useRef, useState } from 'react';
import { ViewVersionDialogProps } from './utils';
import ViewVersionDialogContainer from './ViewVersionDialogContainer';
import EnhancedDialog from '../EnhancedDialog/EnhancedDialog';
import { FormattedMessage, useIntl } from 'react-intl';
import translations from '../CompareVersionsDialog/translations';
import Slide from '@mui/material/Slide';
import { dialogClasses } from '@mui/material/Dialog';
import useMediaQuery from '@mui/material/useMediaQuery';
import { AsDayMonthDateTime } from '../VersionList';
import useLocale from '../../hooks/useLocale';
import { Backdrop } from '@mui/material';
import Drawer from '@mui/material/Drawer';
import { DialogHeader } from '../DialogHeader';
import {
	dialogInitialState,
	FieldViewState,
	VersionsDialogContext,
	VersionsDialogContextProps,
	VersionsDialogContextType
} from '../CompareVersionsDialog/VersionsDialogContext';
import { MonacoDiffEditorOptions } from '../MonacoEditor';
import { getDialogHeaderActions } from '../CompareVersionsDialog';

export function ViewVersionDialog(props: ViewVersionDialogProps) {
	const { rightActions, leftActions, contentTypesBranch, error, isFetching, version, onClose, ...rest } = props;
	const [showXml, setShowXml] = useState(false);
	const { formatMessage } = useIntl();
	const largeHeightScreen = useMediaQuery('(min-height: 880px)');
	const locale = useLocale();

	// region Dialog Context
	const [state, setState] = useState<VersionsDialogContextProps>(dialogInitialState);
	const contextRef = useRef(null);
	const context = useMemo<VersionsDialogContextType>(() => {
		contextRef.current = {
			setState(nextState: Partial<VersionsDialogContextProps>) {
				setState({ ...state, ...nextState });
			},
			setViewSlideOutState(props: Partial<ViewVersionDialogProps>) {
				setState({ ...state, viewSlideOutState: { ...state.viewSlideOutState, ...props } });
			},
			setFieldViewState(fieldId: string, viewState: Partial<FieldViewState>) {
				setState({
					...state,
					fieldsViewState: { ...state.fieldsViewState, [fieldId]: { ...state.fieldsViewState[fieldId], ...viewState } }
				});
			},
			setFieldViewEditorOptionsState(fieldId: string, options: MonacoDiffEditorOptions) {
				setState({
					...state,
					fieldsViewState: {
						...state.fieldsViewState,
						[fieldId]: {
							...state.fieldsViewState[fieldId],
							monacoOptions: { ...state.fieldsViewState[fieldId].monacoOptions, ...options }
						}
					}
				});
			},
			closeSlideOuts() {
				setState({
					...state,
					viewSlideOutState: { ...state.viewSlideOutState, open: false }
				});
			}
		};
		return [state, contextRef];
	}, [state]);
	// endregion

	const onDialogClose = (event: React.SyntheticEvent, reason: 'backdropClick' | 'escapeKeyDown') => {
		if (!state.viewSlideOutState.open) {
			onClose?.(event, reason);
		}
		context[1].current.closeSlideOuts();
	};

	return (
		<EnhancedDialog
			title={<FormattedMessage id="viewVersionDialog.headerTitle" defaultMessage="Viewing item version" />}
			subtitle={<AsDayMonthDateTime date={version?.modifiedDate} locale={locale} />}
			dialogHeaderProps={{
				leftActions,
				rightActions: [
					...getDialogHeaderActions({
						xmlMode: showXml,
						contentActionLabel: formatMessage(translations.compareContent),
						xmlActionLabel: 'XML',
						onClickContent: () => setShowXml(false),
						onClickXml: () => setShowXml(true)
					}),
					...(rightActions ?? [])
				]
			}}
			maxWidth="xl"
			TransitionComponent={Slide}
			sx={{
				[`.${dialogClasses.paper}`]: {
					height: largeHeightScreen ? 'calc(100% - 200px)' : 'calc(100% - 60px)',
					maxHeight: '1000px',
					width: 'calc(100% - 64px)',
					overflow: 'hidden'
				}
			}}
			onClose={onDialogClose}
			{...rest}
		>
			<VersionsDialogContext.Provider value={context}>
				<ViewVersionDialogContainer
					version={version}
					contentTypesBranch={contentTypesBranch}
					error={error}
					isFetching={isFetching}
					showXml={showXml}
				/>

				{/* Sub-view for inner viewVersionDialog */}
				<Backdrop
					open={state.viewSlideOutState.open}
					sx={{ zIndex: 1200 }}
					onClick={() => {
						context[1].current.closeSlideOuts();
					}}
				/>
				<Drawer
					open={state.viewSlideOutState.open}
					anchor="right"
					variant="persistent"
					sx={{
						'& > .MuiDrawer-root': {
							position: 'absolute'
						},
						'& > .MuiPaper-root': {
							width: '90%',
							position: 'absolute'
						}
					}}
				>
					<DialogHeader
						title={state.viewSlideOutState.title}
						subtitle={state.viewSlideOutState.subtitle}
						onCloseButtonClick={(e) => state.viewSlideOutState.onClose(e, null)}
						rightActions={getDialogHeaderActions({
							xmlMode: state.viewSlideOutState.showXml,
							contentActionLabel: formatMessage(translations.compareContent),
							xmlActionLabel: 'XML',
							onClickContent: () => contextRef.current.setViewSlideOutState({ showXml: false }),
							onClickXml: () => contextRef.current.setViewSlideOutState({ showXml: true })
						})}
					/>
					<ViewVersionDialogContainer {...state.viewSlideOutState} />
				</Drawer>
			</VersionsDialogContext.Provider>
		</EnhancedDialog>
	);
}

export default ViewVersionDialog;
