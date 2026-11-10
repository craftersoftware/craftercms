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

import { ContentTypeField } from '../../../models';
import FormControl from '@mui/material/FormControl';
import type { SxProps, Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import FieldStateIndicator, { useFieldStateIndicatorProps } from './FieldStateIndicator';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import Collapse from '@mui/material/Collapse';
import Alert, { alertClasses } from '@mui/material/Alert';
import FormHelperText from '@mui/material/FormHelperText';
import React, {
	forwardRef,
	PropsWithChildren,
	ReactNode,
	SyntheticEvent,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { isEmptyValue } from '../lib/validators';
import { fieldDescriptionId, fieldErrorId, FormValidationAnnouncerContext } from '../lib/fieldA11y';
import FormLabel from '@mui/material/FormLabel';
import { FormattedMessage, useIntl } from 'react-intl';
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
import { useAtomValue, useStore as useJotaiStore } from 'jotai';
import { isScopeActive, revealField } from '../lib/formVisibility';
import { changedFieldAtom, commitFormVisibility, getAdditionalFieldIds, useStackSubmitting } from '../lib/formUtils';
import { FieldValidityMessages, translateValidityMessage } from './FieldValidityMessages';
import { FieldDescribedByProvider } from './useControlAria';
import { XmlKeys } from '../lib/formConsts';
import { mergeSx } from '../lib/mergeSx';
import EditOutlined from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useDispatch } from 'react-redux';
import useSelection from '../../../hooks/useSelection';
import { pushDialog } from '../../../state/actions/dialogStack';
import { createComponentId } from '../../../utils/system';

/** The `length/max` counter shown next to a field label, or null when there is neither. */
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
	/**
	 * Id the description and error ids derive from, for a control the label's `htmlFor` does not point at
	 * (a select, the rich text editor). Ignored when `htmlFor` is set. See `useFieldControlA11y`.
	 */
	controlId?: string;
	labelId?: string;
	value?: unknown;
	min?: number;
	max?: number;
	length?: number;
	action?: ReactNode;
	isValid?: boolean;
	sx?: SxProps<Theme>;
	className?: string;
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

/**
 * The `FormsEngineField` props that are a stable contract for plugin controls that opt out of the default
 * wrapper (`fieldChrome: false`) and wrap themselves. Every other prop is host-internal and may change.
 */
export type FormsEngineFieldPublicProps = Pick<
	FormsEngineFieldProps,
	| 'field'
	| 'children'
	| 'htmlFor'
	| 'labelId'
	| 'length'
	| 'max'
	| 'action'
	| 'menu'
	| 'menuOptions'
	| 'onMenuOptionClick'
	| 'sx'
	| 'className'
>;

export const FormsEngineField = forwardRef<HTMLDivElement, FormsEngineFieldProps>(function (props, ref) {
	const {
		children,
		field,
		max,
		min,
		length,
		action,
		htmlFor,
		controlId: controlIdProp,
		labelId,
		autoFocus,
		menu = true,
		menuOptions,
		onMenuOptionClick,
		sx,
		className
	} = props;
	const { sourceMap } = useItemMetaContext();
	const stableForm = useStableFormContext();
	const { changedFieldIds, atoms } = stableForm;
	const jotai = useJotaiStore();
	const visibility = useAtomValue(atoms.formVisibility);
	const stackSubmitting = useStackSubmitting();
	const scopeActive = isScopeActive(visibility.active);
	const formApi = useFormApiContext();
	const globalApi = useStableGlobalApiContext();
	const { formatMessage } = useIntl();
	const fieldId = field.id;
	const sourcePath = fieldId !== XmlKeys['fileName'] ? sourceMap?.[fieldId] : undefined;
	// Subscribe to the one source item's label rather than the whole `itemsByPath` slice, so unrelated item updates
	// don't re-render every field.
	const sourceLabel = useSelection<string | undefined>((state) =>
		sourcePath ? state.content.itemsByPath[sourcePath]?.label : undefined
	);
	const labelRef = useRef<HTMLLabelElement>(null);
	const menuButtonRef = useRef<HTMLButtonElement>(undefined);
	const [openMenu, setOpenMenu] = useState(false);
	const [showHelp, setShowHelp] = useState(false);
	const customControls = useSelection((state) => state.uiConfig?.controls);
	const additionalFieldIds = useMemo(() => getAdditionalFieldIds(field, customControls), [field, customControls]);
	const hasChanges = useAtomValue(changedFieldAtom(changedFieldIds, field.id, additionalFieldIds));
	const hasHelpText = Boolean(field.helpText);
	const hasDescription = Boolean(field.description);
	const lengthBlock = createLengthBlock({ length, max });
	// The label icon and the control border share this verdict, including a control's isValid override.
	const fieldState = useFieldStateIndicatorProps(field, atoms, { isValid: props.isValid });
	const { validityData, value } = fieldState;
	const isRequired = fieldState.props.isRequired;
	const isValid = fieldState.props.isValid;
	const indicatorProps = fieldState.props;
	const dispatch = useDispatch();
	const announceValidation = useContext(FormValidationAnnouncerContext);
	// The value atom is the edit signal. Select, the rich-text iframe, pickers and the node selector
	// change it without a bubbling input event. The flag is recorded after commit, before paint, so the
	// first blur after an edit still sees it. Controller setValue and rollback tag the write and are ignored.
	const editedRef = useRef(false);
	const committedValueRef = useRef(value);
	const systemWriteRef = useRef(false);
	const fieldUpdates$ = stableForm.fieldUpdates$;
	useLayoutEffect(() => {
		if (!fieldUpdates$) return undefined;
		const subscription = fieldUpdates$.subscribe((update) => {
			if (update.fieldId !== fieldId) return;
			// The latest write decides. A same-value controller setValue or rollback still emits, and the
			// value effect does not run, so leaving the flag true would swallow the author's next edit.
			systemWriteRef.current = Boolean(update.origin);
		});
		return () => subscription.unsubscribe();
	}, [fieldUpdates$, fieldId]);
	useLayoutEffect(() => {
		if (Object.is(committedValueRef.current, value)) return;
		committedValueRef.current = value;
		if (systemWriteRef.current) {
			systemWriteRef.current = false;
			return;
		}
		editedRef.current = true;
	}, [value]);
	// 9388 names the description and the error from the label id, which is what a group is labelled by.
	// A control that has no label id passes the id `useFieldControlA11y` uses, so the same elements resolve.
	const generatedId = useId();
	const describedByBase = labelId || htmlFor || controlIdProp || generatedId;
	const handleCloseMenu = () => setOpenMenu(false);
	const handleRollback = () => formApi.rollbackField(field.id);
	const handleFieldBlur = (event: React.FocusEvent<HTMLDivElement>) => {
		const next = event.relatedTarget;
		if (next instanceof Node && event.currentTarget.contains(next)) return;
		if (isValid || validityData.state !== 'hasData') return;
		const errorText = (validityData.data?.messages ?? [])
			.map((messageData) => translateValidityMessage(messageData, formatMessage))
			.join(' ');
		if (!errorText) return;
		// Blur announces only edited fields, to cut noise while tabbing.
		// Untouched invalid fields still expose their error on focus through aria-describedby, and a failed
		// Save still announces the full error count and summary, so nothing is lost.
		if (!editedRef.current) return;
		announceValidation(formatMessage({ defaultMessage: '{field}: {error}' }, { field: field.name, error: errorText }));
	};
	useEffect(() => {
		// Offer controls the option to focus on the label when the field is rendered.
		if (autoFocus) {
			labelRef.current?.focus();
		}
	}, [autoFocus]);
	const errorShown = !isValid && validityData.state === 'hasData';
	const helpId = hasHelpText && showHelp ? `${describedByBase}-help` : undefined;
	const descriptionId = hasDescription ? fieldDescriptionId(describedByBase) : undefined;
	const errorId = errorShown ? fieldErrorId(describedByBase) : undefined;
	const describedByIds = [helpId, descriptionId, errorId].filter((id): id is string => Boolean(id));
	return (
		<FormControl
			ref={ref}
			fullWidth
			error={!isValid}
			variant="standard"
			data-field-id={fieldId}
			required={isRequired}
			className={className}
			onBlur={handleFieldBlur}
			sx={mergeSx({ '.MuiFormLabel-asterisk': { display: 'none' } }, sx)}
		>
			<FieldDescribedByProvider value={{ labelId, describedByIds }}>
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center'
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center'
						}}
					>
						<FormLabel
							htmlFor={htmlFor}
							id={labelId}
							component="label"
							ref={labelRef}
							tabIndex={autoFocus ? 0 : undefined}
						>
							{field.name}
						</FormLabel>
						<FieldStateIndicator {...indicatorProps} announce={false} />
						{hasHelpText && (
							<IconButton size="small" onClick={() => setShowHelp(!showHelp)}>
								<HelpOutlineRounded fontSize="small" />
							</IconButton>
						)}
					</Box>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center'
						}}
					>
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
									{scopeActive && (
										<MenuItem
											disabled={stackSubmitting}
											onClick={() => {
												if (stackSubmitting) return;
												const reveal = revealField(jotai.get(atoms.formVisibility), field.id);
												commitFormVisibility(jotai.set, atoms, reveal.state, reveal.fieldId);
												if (stableForm.itemFormMode) jotai.set(stableForm.itemFormMode, 'full');
											}}
										>
											<ListItemText>
												<FormattedMessage defaultMessage="View in form" />
											</ListItemText>
										</MenuItem>
									)}
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
								id={helpId}
								dangerouslySetInnerHTML={{ __html: field.helpText }}
								sx={{ 'p:first-of-type:last-of-type': { margin: 0 } }}
							/>
						</Alert>
					</Collapse>
				)}
				{sourcePath && (
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
											update: { path: sourcePath }
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
								values={{ label: sourceLabel ?? sourcePath }}
							/>
						) : (
							<FormattedMessage
								defaultMessage="Inherited value from {label} is overridden"
								values={{ label: sourceLabel ?? sourcePath }}
							/>
						)}
					</Alert>
				)}
				{children}
				{hasDescription && <FormHelperText id={descriptionId}>{field.description}</FormHelperText>}
				{/* Rendered while invalid, even with no messages, so the control's aria-describedby always resolves. */}
				{errorShown && (
					<Box id={errorId}>
						<FieldValidityMessages messages={validityData.data?.messages} />
					</Box>
				)}
			</FieldDescribedByProvider>
		</FormControl>
	);
});

export default FormsEngineField;
