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

import { ContentTypeField } from '../../../models';
import FormControl, { FormControlProps } from '@mui/material/FormControl';
import Box from '@mui/material/Box';
import FieldRequiredStateIndicator from './FieldRequiredStateIndicator';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import Collapse from '@mui/material/Collapse';
import Alert, { alertClasses } from '@mui/material/Alert';
import FormHelperText from '@mui/material/FormHelperText';
import React, { forwardRef, PropsWithChildren, ReactNode, SyntheticEvent, useEffect, useRef, useState } from 'react';
import { type FieldValidityMessage, isEmptyValue, isFieldRequired } from '../lib/validators';
import FormLabel from '@mui/material/FormLabel';
import useItemsByPath from '../../../hooks/useItemsByPath';
import { FormattedMessage, type IntlFormatters, useIntl } from 'react-intl';
import { HelpOutlineRounded } from '@mui/icons-material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import { SystemIconDescriptor } from '../../SystemIcon';
import {
	useFormApiContext,
	useItemMetaContext,
	useStableFormContext,
	useStableGlobalApiContext
} from '../lib/formsEngineContext';
import { useAtomValue } from 'jotai';
import { translateIfMessageDescriptor } from '../../ContentTypeManagement/utils';
import useLoadableAtom from '../lib/useLoadableAtom';
import { XmlKeys } from '../lib/formConsts';
import EditOutlined from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useDispatch } from 'react-redux';
import { pushDialog } from '../../../state/actions/dialogStack';
import { createComponentId } from '../../../utils/system';

function createLengthBlock({ length, max }: { length: number; max: number }) {
	const pieces = [];
	if (length != null) {
		pieces.push(`${length}`);
	}
	if (max != null) {
		pieces.push(`/${max}`);
	}

	return pieces.length ? (
		<Typography variant="body2" color="textSecondary" children={pieces.join('')} sx={{ mr: 1 }} />
	) : null;
}

export type FormsEngineFieldProps = PropsWithChildren<{
	field: ContentTypeField;
	autoFocus?: boolean;
	htmlFor?: string;
	labelId?: string;
	value?: unknown;
	min?: number;
	max?: number;
	length?: number;
	action?: ReactNode;
	isValid?: boolean;
	sx?: FormControlProps['sx'];
	menu?: false;
	menuOptions?: Array<
		| {
				id: string;
				text: ReactNode;
				icon?: SystemIconDescriptor;
		  }
		| 'divider'
	>;
	onMenuOptionClick?(e: SyntheticEvent, optionId: string, closeMenu: () => void): void;
}>;

export const FormsEngineField = forwardRef<HTMLDivElement, FormsEngineFieldProps>(function (props, ref) {
	const {
		children,
		field,
		max,
		min,
		length,
		action,
		htmlFor,
		labelId,
		autoFocus,
		menu = true,
		menuOptions,
		onMenuOptionClick
	} = props;
	const { sourceMap } = useItemMetaContext();
	const { changedFieldIds, atoms } = useStableFormContext();
	const formApi = useFormApiContext();
	const globalApi = useStableGlobalApiContext();
	const { formatMessage } = useIntl();
	const itemsByPath = useItemsByPath();
	const labelRef = useRef<HTMLLabelElement>(null);
	const menuButtonRef = useRef<HTMLButtonElement>(undefined);
	const [openMenu, setOpenMenu] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const fieldId = field.id;
	const hasChanges = changedFieldIds.has(field.id);
	const hasHelpText = Boolean(field.helpText);
	const hasDescription = Boolean(field.description);
	const lengthBlock = createLengthBlock({ length, max });
	const isRequired = isFieldRequired(field);
	const validityData = useLoadableAtom(atoms.validationByFieldId[fieldId]);
	const value = useAtomValue(atoms.valueByFieldId[fieldId]);
	const isValid = props.isValid ?? (validityData.state === 'hasData' ? validityData?.data.isValid : true);
	const dispatch = useDispatch();
	const handleCloseMenu = () => setOpenMenu(false);
	const handleRollback = () => formApi.rollbackField(field.id);
	useEffect(() => {
		// Offer controls the option to focus on the label when the field is rendered.
		if (autoFocus) {
			labelRef.current?.focus();
		}
	}, [autoFocus]);
	return (
        <FormControl
			ref={ref}
			fullWidth
			error={!isValid}
			variant="standard"
			data-field-id={fieldId}
			required={isRequired}
			sx={{ '.MuiFormLabel-asterisk': { display: 'none' }, ...props.sx }}
		>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
				<Box
                    sx={{
                        display: "flex",
                        alignItems: "center"
                    }}>
					<FormLabel
						htmlFor={htmlFor}
						id={labelId}
						component="label"
						ref={labelRef}
						tabIndex={autoFocus ? 0 : undefined}
					>
						{field.name}
					</FormLabel>
					{isRequired && <FieldRequiredStateIndicator isValid={isValid} />}
					{hasHelpText && (
						<IconButton size="small" onClick={() => setShowHelp(!showHelp)}>
							<HelpOutlineRounded fontSize="small" />
						</IconButton>
					)}
				</Box>
				<Box
                    sx={{
                        display: "flex",
                        alignItems: "center"
                    }}>
					{lengthBlock}
					{action}
					{menu && (
						<>
							{/* TODO: Should the menu button be tabbable? Perhaps it could be a preference whether it should be tabbable or not. */}
							<IconButton size="small" tabIndex={-1} ref={menuButtonRef} onClick={() => setOpenMenu(true)}>
								<MoreVertRounded fontSize="small" />
							</IconButton>
							<Menu
								open={openMenu}
								anchorEl={menuButtonRef.current}
								onClose={handleCloseMenu}
								onClick={handleCloseMenu}
							>
								<MenuItem
									onClick={() => {
										dispatch(
											pushDialog({
												component: createComponentId('FieldInformationDialog'),
												props: { field }
											})
										);
									}}
								>
									<ListItemText>
										<FormattedMessage defaultMessage="Field Information" />
									</ListItemText>
								</MenuItem>
								{hasChanges && [
									<Divider key="rollback-divider" />,
									<MenuItem key="rollback-action" onClick={handleRollback}>
										<ListItemText>
											<FormattedMessage defaultMessage="Rollback changes" />
										</ListItemText>
									</MenuItem>
								]}
								{menuOptions && <Divider />}
								{menuOptions?.map((option, index) =>
									option === 'divider' ? (
										<Divider key={`divider_${index}`} />
									) : (
										<MenuItem key={option.id} onClick={(e) => onMenuOptionClick?.(e, option.id, handleCloseMenu)}>
											<ListItemText children={option.text} />
										</MenuItem>
									)
								)}
							</Menu>
						</>
					)}
				</Box>
			</Box>
            {hasHelpText && (
				<Collapse in={showHelp}>
					<Alert severity="info" variant="outlined" sx={{ border: 'none' }}>
						<Typography
							variant="body2"
							component="section"
							color="textSecondary"
							dangerouslySetInnerHTML={{ __html: field.helpText }}
							sx={{ 'p:first-of-type:last-of-type': { margin: 0 } }}
						/>
					</Alert>
				</Collapse>
			)}
            {sourceMap?.[fieldId] && fieldId !== XmlKeys['fileName'] && (
				<Alert
					variant="standard"
					severity="info"
					icon={
						<IconButton
							href="https://craftercms.com/docs/current/by-role/developer/common/content-modeling/content-inheritance.html"
							size="small"
							color="inherit"
							target="_blank"
							component="a"
							aria-label={formatMessage({ defaultMessage: 'Learn more about content inheritance' })}
							title={formatMessage({ defaultMessage: 'Learn more about content inheritance' })}
							sx={{ p: 0 }}
						>
							<InfoOutlinedIcon />
						</IconButton>
					}
					action={
						<>
							<IconButton
								color="inherit"
								size="small"
								sx={{ px: 0.5, minWidth: 0 }}
								onClick={() => {
									globalApi.pushForm({
										update: { path: sourceMap[fieldId] }
									});
								}}
								aria-label={formatMessage({ defaultMessage: 'Edit' })}
								title={formatMessage({ defaultMessage: 'Edit' })}
							>
								<EditOutlined fontSize="small" />
							</IconButton>
						</>
					}
					sx={{
						px: 1,
						mb: 0.625,
						borderRadius: 5,
						alignItems: 'center',
						[`.${alertClasses.message}`]: { display: 'flex', alignItems: 'center' },
						[`.${alertClasses.action}`]: { mr: 0 },
						[`.${alertClasses.icon}`]: { mr: 1 }
					}}
				>
					{isEmptyValue(field, value) ? (
						<FormattedMessage
							defaultMessage="Value is inherited from {label}"
							values={{ label: itemsByPath[sourceMap[fieldId]]?.label ?? sourceMap[fieldId] }}
						/>
					) : (
						<FormattedMessage
							defaultMessage="Inherited value from {label} is overridden"
							values={{ label: itemsByPath[sourceMap[fieldId]]?.label ?? sourceMap[fieldId] }}
						/>
					)}
				</Alert>
			)}
            {children}
            {hasDescription && <FormHelperText>{field.description}</FormHelperText>}
            {!isValid &&
				validityData.state === 'hasData' &&
				validityData.data?.messages?.map((messageData, key) => (
					<FormHelperText key={key}>{translateValidityMessage(messageData, formatMessage)}</FormHelperText>
				))}
        </FormControl>
    );
});

/**
 * Translates a validity message for a form field.
 *
 * @param messageData {FieldValidityMessage} - The validity message data, which can be a single message
 * or a tuple containing a message and its associated values.
 * @param formatMessage {IntlFormatters['formatMessage']} - The function used to format internationalized messages.
 * @returns {string} - The translated validity message.
 */
function translateValidityMessage(
	messageData: FieldValidityMessage,
	formatMessage: IntlFormatters['formatMessage']
): string {
	const message = Array.isArray(messageData) ? messageData[0] : messageData;
	const values = Array.isArray(messageData) ? messageData[1] : undefined;
	return translateIfMessageDescriptor(message, formatMessage, values);
}

export default FormsEngineField;
