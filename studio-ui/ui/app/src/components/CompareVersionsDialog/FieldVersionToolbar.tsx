/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import Button from '@mui/material/Button';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import React, { ReactNode } from 'react';
import { ContentTypeField } from '../../models';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage, useIntl } from 'react-intl';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import { useHotkeys } from 'react-hotkeys-hook';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import { initialFieldViewState, useVersionsDialogContext } from './VersionsDialogContext';
import { typesViewMap } from '../ViewVersionDialog/ContentFieldView';
import TextView from '../ViewVersionDialog/FieldTypesViews/TextView';
import TextDiffView from './FieldsTypesDiffViews/TextDiffView';
import { typesDiffMap } from './utils';

interface FieldVersionToolbarProps {
	field: ContentTypeField;
	contentTypeFields: ContentTypeField[];
	isDiff?: boolean;
	actions?: ReactNode;
	showFieldsNavigation?: boolean;
	justContent?: boolean;
	disableKeyboardNavigation?: boolean;
	onSelectField?(field: ContentTypeField): void;
}

export function FieldVersionToolbar(props: FieldVersionToolbarProps) {
	const {
		field,
		contentTypeFields,
		onSelectField,
		actions,
		showFieldsNavigation = true,
		disableKeyboardNavigation = false,
		isDiff = true,
		justContent
	} = props;
	const { formatMessage } = useIntl();
	const fieldType = field.type;
	const [{ fieldsViewState }, contextApiRef] = useVersionsDialogContext();
	const currentFieldIndex = contentTypeFields.findIndex((f) => f.id === field.id);
	const nextField = contentTypeFields[currentFieldIndex + 1] || contentTypeFields[0];
	const previousField = contentTypeFields[currentFieldIndex - 1] || contentTypeFields[contentTypeFields.length - 1];
	const viewState = fieldsViewState[field.id] ?? initialFieldViewState;
	const { compareXml, cleanText, monacoOptions, compareMode, compareModeDisabled } = viewState;
	const showDivider =
		(!compareXml && fieldType === 'repeat') ||
		compareXml ||
		typesDiffMap[fieldType] === TextView ||
		typesDiffMap[fieldType] === TextDiffView ||
		Boolean(actions);
	const isMappedFieldType = isDiff ? Boolean(typesDiffMap[fieldType]) : Boolean(typesViewMap[fieldType]);

	const onSelectNextField = (fieldId: string) => {
		const index = contentTypeFields.findIndex((f) => f.id === fieldId);
		const nextField = contentTypeFields[index + 1] || contentTypeFields[0];
		onSelectField?.(nextField);
	};

	const onSelectPreviousField = (fieldId: string) => {
		const index = contentTypeFields.findIndex((f) => f.id === fieldId);
		const previousField = contentTypeFields[index - 1] || contentTypeFields[contentTypeFields.length - 1];
		onSelectField?.(previousField);
	};

	// Keyboard navigation - Left and Up to select previous field, Right and Down to select next field
	useHotkeys('ArrowLeft,ArrowRight,ArrowUp,ArrowDown', (event) => {
		if (disableKeyboardNavigation) {
			return;
		} else {
			switch (event.key) {
				case 'ArrowLeft':
				case 'ArrowUp':
					onSelectPreviousField(field.id);
					break;
				case 'ArrowRight':
				case 'ArrowDown':
					onSelectNextField(field.id);
					break;
			}
		}
	});

	return (
		<Box sx={{ display: 'flex', alignItems: 'center', mb: justContent ? 0 : 2 }}>
			{showFieldsNavigation && contentTypeFields.length > 1 && (
				<Button
					sx={{ mx: 1 }}
					startIcon={<ChevronLeftRoundedIcon />}
					onClick={() => onSelectPreviousField(field.id)}
					title={previousField.name}
				>
					<Typography variant="subtitle2" noWrap sx={{ maxWidth: 160 }}>
						{previousField.name}
					</Typography>
				</Button>
			)}
			<Paper
				variant="outlined"
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexGrow: 1,
					py: 1,
					px: 2,
					...(justContent && {
						background: 'none',
						border: 'none',
						p: 0
					})
				}}
			>
				<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
					<Typography sx={{ fontWeight: 'bold' }}>{field.name}</Typography>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', mr: justContent && 1 }} onClick={(e) => e.stopPropagation()}>
					{actions}
					{!compareXml && fieldType === 'repeat' && (
						<Button
							onClick={() =>
								contextApiRef.current.setFieldViewState(field.id, {
									compareMode: !compareMode
								})
							}
							startIcon={<CompareArrowsIcon />}
							disabled={compareModeDisabled}
						>
							<FormattedMessage defaultMessage="Compare" />
						</Button>
					)}
					{(compareXml || typesDiffMap[fieldType] === TextDiffView || typesViewMap[fieldType] === TextView) && (
						<>
							{isDiff && (
								<>
									<Button
										onClick={() => {
											contextApiRef.current.setFieldViewEditorOptionsState(field.id, {
												ignoreTrimWhitespace: !monacoOptions.ignoreTrimWhitespace
											});
										}}
									>
										{viewState?.monacoOptions.ignoreTrimWhitespace ? (
											<FormattedMessage defaultMessage="Show whitespace" />
										) : (
											<FormattedMessage defaultMessage="Hide whitespace" />
										)}
									</Button>
									<Button
										onClick={() => {
											contextApiRef.current.setFieldViewEditorOptionsState(field.id, {
												renderSideBySide: !monacoOptions.renderSideBySide
											});
										}}
									>
										{monacoOptions.renderSideBySide ? (
											<FormattedMessage defaultMessage="Unified view" />
										) : (
											<FormattedMessage defaultMessage="Split view" />
										)}
									</Button>
								</>
							)}
							<Button
								onClick={() => {
									contextApiRef.current.setFieldViewEditorOptionsState(field.id, {
										diffWordWrap: monacoOptions.diffWordWrap === 'on' ? 'off' : 'on',
										wordWrap: monacoOptions.wordWrap === 'on' ? 'off' : 'on'
									});
								}}
							>
								{(isDiff ? monacoOptions.diffWordWrap : monacoOptions.wordWrap) === 'on' ? (
									<FormattedMessage defaultMessage="No Wrap" />
								) : (
									<FormattedMessage defaultMessage="Wrap" />
								)}
							</Button>
						</>
					)}
					{showDivider && (
						<Divider orientation="vertical" sx={{ display: 'inline-flex', height: '25px', ml: 2, mr: 2 }} />
					)}
					{fieldType === 'html' && (
						<Tooltip title={formatMessage({ defaultMessage: 'Show clean text' })}>
							<IconButton
								size="small"
								onClick={() =>
									contextApiRef.current.setFieldViewState?.(field.id, { cleanText: true, compareXml: false })
								}
								color={cleanText && !compareXml ? 'primary' : 'default'}
							>
								<NotesRoundedIcon />
							</IconButton>
						</Tooltip>
					)}
					{isMappedFieldType && (
						<>
							<Tooltip title={formatMessage({ defaultMessage: 'Compare' })}>
								<IconButton
									size="small"
									onClick={() =>
										contextApiRef.current.setFieldViewState?.(field.id, { cleanText: false, compareXml: false })
									}
									color={!cleanText && !compareXml ? 'primary' : 'default'}
								>
									<TextSnippetOutlinedIcon />
								</IconButton>
							</Tooltip>
							<Tooltip title={formatMessage({ defaultMessage: 'Compare XML' })}>
								<IconButton
									size="small"
									onClick={() => contextApiRef.current.setFieldViewState?.(field.id, { compareXml: true })}
									color={compareXml ? 'primary' : 'default'}
								>
									<CodeOutlinedIcon />
								</IconButton>
							</Tooltip>
						</>
					)}
				</Box>
			</Paper>
			{showFieldsNavigation && contentTypeFields.length > 1 && (
				<Button
					sx={{ mx: 1 }}
					endIcon={<NavigateNextRoundedIcon />}
					onClick={() => onSelectNextField(field.id)}
					title={nextField.name}
				>
					<Typography variant="subtitle2" noWrap sx={{ maxWidth: 160 }}>
						{nextField.name}
					</Typography>
				</Button>
			)}
		</Box>
	);
}

export default FieldVersionToolbar;
