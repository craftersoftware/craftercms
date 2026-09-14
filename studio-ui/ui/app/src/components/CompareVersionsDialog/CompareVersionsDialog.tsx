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
import { CompareVersionsDialogProps, getDialogHeaderActions } from './utils';
import CompareVersionsDialogContainer from './CompareVersionsDialogContainer';
import EnhancedDialog from '../EnhancedDialog/EnhancedDialog';
import { dialogClasses } from '@mui/material/Dialog';
import { FormattedMessage, useIntl } from 'react-intl';
import { AsDayMonthDateTime } from '../VersionList';
import Slide from '@mui/material/Slide';
import { translations } from './translations';
import useMediaQuery from '@mui/material/useMediaQuery';
import useLocale from '../../hooks/useLocale';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import { ViewVersionDialogProps } from '../ViewVersionDialog/utils';
import { Backdrop } from '@mui/material';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import { DialogHeader } from '../DialogHeader';
import ViewVersionDialogContainer from '../ViewVersionDialog/ViewVersionDialogContainer';
import { MonacoDiffEditorOptions } from '../MonacoEditor';
import {
	dialogInitialState,
	FieldViewState,
	VersionsDialogContext,
	VersionsDialogContextProps,
	VersionsDialogContextType
} from './VersionsDialogContext';

export function CompareVersionsDialog(props: CompareVersionsDialogProps) {
	// region const { ... } = props
	const {
		subtitle,
		selectedA,
		selectedB,
		leftActions,
		rightActions,
		versionsBranch,
		isFetching,
		error,
		disableItemSwitching,
		contentTypesBranch,
		selectionContent,
		fields,
		TransitionComponent = Slide,
		TransitionProps,
		onClose,
		...rest
	} = props;
	// endregion
	const [compareXml, setCompareXml] = useState(false);
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
			setCompareSlideOutState(props: Partial<CompareVersionsDialogProps>) {
				setState({ ...state, compareSlideOutState: { ...state.compareSlideOutState, ...props } });
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
					compareSlideOutState: { ...state.compareSlideOutState, open: false },
					viewSlideOutState: { ...state.viewSlideOutState, open: false }
				});
			}
		};
		return [state, contextRef];
	}, [state]);
	// endregion

	const onDialogClose = (event: React.SyntheticEvent, reason: 'backdropClick' | 'escapeKeyDown'): void => {
		if (!(state.compareSlideOutState?.open || state.viewSlideOutState?.open)) {
			onClose?.(event, reason);
		}
		context[1].current.closeSlideOuts();
	};

	return (
		<EnhancedDialog
			title={<FormattedMessage defaultMessage="Compare Versions" />}
			subtitle={
				subtitle ?? (
					<>
						<AsDayMonthDateTime date={selectedA?.modifiedDate} locale={locale} />
						<CompareArrowsIcon fontSize="small" />
						<AsDayMonthDateTime date={selectedB?.modifiedDate} locale={locale} />
					</>
				)
			}
			dialogHeaderProps={{
				leftActions,
				rightActions: [
					...(state.enableDialogActions && !selectionContent
						? getDialogHeaderActions({
								xmlMode: compareXml,
								contentActionLabel: formatMessage(translations.compareContent),
								xmlActionLabel: 'XML',
								onClickContent: () => setCompareXml(false),
								onClickXml: () => setCompareXml(true)
							})
						: []),
					...(rightActions ?? [])
				],
				sxs: {
					subtitle: {
						display: 'flex',
						color: (theme) => theme.palette.text.secondary,
						alignItems: 'center',
						gap: 1
					}
				}
			}}
			maxWidth="xl"
			TransitionComponent={TransitionComponent}
			TransitionProps={TransitionProps}
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
				<CompareVersionsDialogContainer
					versionsBranch={versionsBranch}
					isFetching={isFetching}
					error={error}
					disableItemSwitching={disableItemSwitching}
					contentTypesBranch={contentTypesBranch}
					selectedA={selectedB}
					selectedB={selectedA}
					compareXml={compareXml}
					selectionContent={selectionContent}
					fields={fields}
				/>

				{/* region In-dialog slide-out panel */}
				<Backdrop
					open={Boolean(state.compareSlideOutState?.open || state.viewSlideOutState?.open)}
					sx={{ zIndex: (theme) => theme.zIndex.drawer, position: 'absolute' }}
					onClick={() => {
						context[1].current.closeSlideOuts();
					}}
				/>
				<Drawer
					open={Boolean(state.compareSlideOutState?.open || state.viewSlideOutState?.open)}
					anchor="right"
					variant="persistent"
					sx={{ [`& > .${drawerClasses.paper}`]: { width: '90%', position: 'absolute' } }}
				>
					{/* region Compare */}
					{state.compareSlideOutState.open && (
						<Box display="flex" flexDirection="column" height="100%">
							<DialogHeader
								title={state.compareSlideOutState.title}
								subtitle={state.compareSlideOutState.subtitle}
								onCloseButtonClick={state.compareSlideOutState.onClose}
								rightActions={getDialogHeaderActions({
									xmlMode: state.compareSlideOutState.compareXml,
									contentActionLabel: formatMessage(translations.compareContent),
									xmlActionLabel: 'XML',
									onClickContent: () => contextRef.current.setCompareSlideOutState({ compareXml: false }),
									onClickXml: () => contextRef.current.setCompareSlideOutState({ compareXml: true })
								})}
							/>
							<CompareVersionsDialogContainer {...state.compareSlideOutState} />
						</Box>
					)}
					{/* endregion */}
					{/* region View */}
					{state.viewSlideOutState.open && (
						<>
							<DialogHeader
								title={state.viewSlideOutState.title}
								subtitle={state.viewSlideOutState.subtitle}
								onCloseButtonClick={state.viewSlideOutState.onClose}
								rightActions={[
									{
										icon: { id: '@mui/icons-material/TextSnippetOutlined' },
										text: formatMessage(translations.compareContent),
										onClick: () => contextRef.current.setViewSlideOutState({ showXml: false }),
										sx: {
											color: (theme) =>
												!state.viewSlideOutState.showXml ? theme.palette.primary.main : theme.palette.text.secondary,
											fontSize: 14
										}
									},
									{
										icon: { id: '@mui/icons-material/CodeRounded' },
										text: 'XML',
										onClick: () => contextRef.current.setViewSlideOutState({ showXml: true }),
										sx: {
											color: (theme) =>
												state.viewSlideOutState.showXml ? theme.palette.primary.main : theme.palette.text.secondary,
											fontSize: 14
										}
									}
								]}
							/>
							<ViewVersionDialogContainer {...state.viewSlideOutState} />
						</>
					)}
					{/* endregion */}
				</Drawer>
				{/* endregion */}
			</VersionsDialogContext.Provider>
		</EnhancedDialog>
	);
}

export default CompareVersionsDialog;
