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

import { useAtom, useAtomValue } from 'jotai';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import React, { MouseEvent, useCallback, useContext, useId, useLayoutEffect, useRef, useState } from 'react';
import { StableFormContext } from '../lib/formsEngineContext';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch, { switchClasses } from '@mui/material/Switch';
import ToggleButton, { toggleButtonClasses } from '@mui/material/ToggleButton';
import ToggleButtonGroup, { toggleButtonGroupClasses } from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import FormHelperText from '@mui/material/FormHelperText';
import PushPinOutlined from '@mui/icons-material/PushPinOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import MinimizeRounded from '@mui/icons-material/MinimizeRounded';
import CloseIcon from '@mui/icons-material/Close';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import { useIsDarkModeTheme } from '../../../hooks/useIsDarkModeTheme';
import { SplitButton } from '../../SplitButton';
import { useDispatch } from 'react-redux';
import { pushConfirmDialog, pushErrorDialog } from '../../../utils/system';
import { showSystemNotification } from '../../../state/actions/system';
import type { FormsEngineAtoms } from '../lib/formsEngineContext';
import { popDialog } from '../../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import type { SaveFormResult } from '../lib/useSaveForm';
import type { ApiResponse } from '../../../models/ApiResponse';

const messages = defineMessages({
	saveReadFailed: { defaultMessage: 'The form could not be checked before saving.' },
	afterSaving: { defaultMessage: 'Save and…' },
	afterSavingHelp: {
		defaultMessage: 'Choose what happens after you save: stay in the form, minimize it, or close it.'
	},
	stay: { defaultMessage: 'Stay' },
	minimize: { defaultMessage: 'Minimize' },
	close: { defaultMessage: 'Close' },
	releaseLockOnClose: { defaultMessage: 'Release lock when closing' },
	keepLockWarning: {
		defaultMessage: "Others can't edit it until you release the lock."
	},
	noChanges: { defaultMessage: 'No changes detected' }
});

type AfterSaving = 'stay' | 'minimize' | 'close';

const afterSavingOrder: AfterSaving[] = ['stay', 'minimize', 'close'];

const afterSavingIcons = {
	stay: PushPinOutlined,
	minimize: MinimizeRounded,
	close: CloseIcon
} as const;

/**
 * The hidden label's intrinsic width against the button's content box.
 * The copy stays in the button, so switching to an icon does not remove the measurement.
 */
function labelOverflowsButton(probe: HTMLElement, button: HTMLElement): boolean {
	const buttonStyle = getComputedStyle(button);
	// The probe must use the button's used font. Measuring before that face
	// loads misses a clip that shows up once it swaps in.
	probe.style.fontFamily = buttonStyle.fontFamily;
	probe.style.fontSize = buttonStyle.fontSize;
	probe.style.fontWeight = buttonStyle.fontWeight;
	probe.style.fontStyle = buttonStyle.fontStyle;
	probe.style.letterSpacing = buttonStyle.letterSpacing;
	probe.style.textTransform = 'none';
	const available =
		button.clientWidth - (parseFloat(buttonStyle.paddingLeft) || 0) - (parseFloat(buttonStyle.paddingRight) || 0);
	const visible = button.querySelector('[data-after-saving-label]');
	if (visible instanceof HTMLElement && visible.scrollWidth > visible.clientWidth) return true;
	// A subpixel tie still clips. Treat that as overflow.
	return probe.scrollWidth > available - 0.5;
}

/** All three pills switch together, so one overflowing translation does not leave a mixed row. */
function useAfterSavingIcons(labels: Record<AfterSaving, string>) {
	const probes = useRef<Partial<Record<AfterSaving, HTMLSpanElement | null>>>({});
	// State, not a ref object: the group can mount later without SaveCard remounting.
	const [group, setGroup] = useState<HTMLDivElement | null>(null);
	const [icons, setIcons] = useState(false);
	const measure = useCallback(() => {
		const overflow = afterSavingOrder.some((key) => {
			const probe = probes.current[key];
			const button = probe?.closest('button');
			if (!probe || !(button instanceof HTMLElement)) return false;
			return labelOverflowsButton(probe, button);
		});
		setIcons(overflow);
		return overflow;
	}, []);
	useLayoutEffect(() => {
		measure();
		let cancelled = false;
		const fonts = document.fonts;
		const onFonts = () => {
			if (!cancelled) measure();
		};
		fonts.addEventListener('loadingdone', onFonts);
		void fonts.ready.then(onFonts);
		let observer: ResizeObserver | undefined;
		if (group && typeof ResizeObserver !== 'undefined') {
			observer = new ResizeObserver(() => measure());
			observer.observe(group);
		}
		return () => {
			cancelled = true;
			fonts.removeEventListener('loadingdone', onFonts);
			observer?.disconnect();
		};
	}, [group, labels.close, labels.minimize, labels.stay, measure]);
	return { probes, setGroup, icons, measure };
}

/** Stay is both flags off. Close wins if both were stored, matching the save follow-up. */
function afterSavingChoice(closeAfterSave: boolean, minimizeAfterSave: boolean): AfterSaving {
	if (closeAfterSave) return 'close';
	if (minimizeAfterSave) return 'minimize';
	return 'stay';
}

export interface SaveCardProps {
	isRepeatMode: boolean;
	isStackedForm: boolean;
	isEmbedded: boolean;
	/** Defaults to this form's atoms. A selected-fields item form passes the parent's atoms. */
	atoms?: FormsEngineAtoms;
	/** From the form's existing validation alert. Not a second validity subscription. */
	validationErrorCount?: number;
	/**
	 * Runs the save. `revealed` opened a hidden field and wrote nothing.
	 * `invalid` is the cannot-proceed dialog. `saved` started a write.
	 * `auto` is the main button: draft when the fresh read is invalid, else the remembered choice.
	 */
	onSave: (e: MouseEvent, draft?: boolean | 'auto') => Promise<SaveFormResult | void>;
}

export function SaveCard(props: SaveCardProps) {
	const { isEmbedded, isStackedForm, isRepeatMode, onSave, validationErrorCount = 0 } = props;
	const stableFormContext = useContext(StableFormContext);
	const formAtoms = props.atoms ?? stableFormContext.atoms;
	const isSubmitting = useAtomValue(formAtoms.isSubmitting);
	const [versionComment, setVersionComment] = useAtom(formAtoms.versionComment);
	const hasPendingChanges = useAtomValue(formAtoms.hasPendingChanges);
	const [closeAfterSave, setCloseAfterSave] = useAtom(formAtoms.closeAfterSave);
	const [minimizeAfterSave, setMinimizeAfterSave] = useAtom(formAtoms.minimizeAfterSave);
	const [saveAsDraft, setSaveAsDraftChoice] = useAtom(formAtoms.saveAsDraft);
	// Invalid forms always show Save Draft. The alert is mounted only once a read has found errors.
	const showDraft = validationErrorCount > 0 || saveAsDraft === true;
	const afterSavingLabelId = useId();
	const afterSaving = afterSavingChoice(closeAfterSave, minimizeAfterSave);
	const disableSave = !isEmbedded && !isRepeatMode && (isSubmitting || !versionComment);
	const showVersionComment = (!isEmbedded || !isStackedForm) && !isRepeatMode;
	const showSaveOptions = !isEmbedded && !isRepeatMode;
	const { formatMessage } = useIntl();
	// Idle forms are disabled by the empty comment while nothing is pending. The tip explains
	// that case only: not while submitting, and not when pending edits are blocked by the comment.
	const noChangesMessage = formatMessage(messages.noChanges);
	const showNoChangesTip = disableSave && !isSubmitting && !hasPendingChanges;
	// Same surface as a form section: default paper in light, elevation 2 in dark.
	const sectionElevation = useIsDarkModeTheme() ? 2 : undefined;
	const afterSavingLabels: Record<AfterSaving, string> = {
		stay: formatMessage(messages.stay),
		minimize: formatMessage(messages.minimize),
		close: formatMessage(messages.close)
	};
	const {
		probes,
		setGroup,
		icons: afterSavingIconsMode,
		measure: measureAfterSaving
	} = useAfterSavingIcons(afterSavingLabels);
	const [afterSavingTip, setAfterSavingTip] = useState<AfterSaving | null>(null);
	const dispatch = useDispatch();
	// Set for the whole save, including the validity read before isSubmitting flips.
	// A dropdown pick in that window must not write saveAsDraft: the save re-reads it after onBeforeSave.
	const saveInFlight = useRef(false);

	const handleAfterSaving = (_event: MouseEvent<HTMLElement>, choice: AfterSaving | null) => {
		// Clicking the active pill reports null. Keep the current choice.
		if (choice == null) return;
		setCloseAfterSave(choice === 'close');
		setMinimizeAfterSave(choice === 'minimize');
	};
	const showCannotProceed = () => {
		const dialogId = nanoid();
		dispatch(
			pushConfirmDialog({
				id: dialogId,
				props: {
					title: formatMessage({ defaultMessage: 'Cannot Proceed' }),
					body: formatMessage({
						defaultMessage:
							'You cannot save until all form requirements are satisfied. If you still want to save, you can use the Save as draft option, but required fields left blank may cause errors when previewed or deployed.'
					}),
					cancelButtonText: formatMessage({ defaultMessage: 'Ok' }),
					onCancel: () => dispatch(popDialog({ id: dialogId }))
				}
			})
		);
	};
	const handleSave = async (e: MouseEvent, draft?: boolean | 'auto') => {
		if (saveInFlight.current) return;
		saveInFlight.current = true;
		try {
			const status = await onSave(e, draft);
			if (status === 'invalid') showCannotProceed();
			else if (status === 'revealed') {
				dispatch(
					showSystemNotification({
						options: { variant: 'warning', autoHideDuration: 10000 },
						message: formatMessage({
							defaultMessage: 'Not saved. A field with an error was out of view.'
						})
					})
				);
			}
		} catch (error) {
			dispatch(
				pushErrorDialog({
					props: { error: saveReadError(error, formatMessage(messages.saveReadFailed)) }
				})
			);
		} finally {
			saveInFlight.current = false;
		}
	};
	const saveButton = (
		<SplitButton
			fullWidth
			loading={isSubmitting}
			disabled={disableSave}
			selectedId={showDraft ? 'saveDraft' : 'save'}
			onClick={(e) => handleSave(e, 'auto')}
			onSelect={(id) => {
				if (saveInFlight.current || isSubmitting) return;
				setSaveAsDraftChoice(id === 'saveDraft');
			}}
			options={[
				{
					id: 'save',
					color: 'primary',
					icon: <SaveOutlined fontSize="small" />,
					label:
						isRepeatMode || (isEmbedded && isStackedForm)
							? formatMessage({ defaultMessage: 'Done' })
							: formatMessage({ defaultMessage: 'Save' }),
					callback: (e) => {
						handleSave(e, false);
					}
				},
				{
					id: 'saveDraft',
					color: 'warning',
					icon: <EditNoteOutlined fontSize="small" />,
					label:
						isRepeatMode || (isEmbedded && isStackedForm)
							? formatMessage({ defaultMessage: 'Done (Draft)' })
							: formatMessage({ defaultMessage: 'Save Draft' }),
					callback: (e) => {
						handleSave(e, true);
					}
				}
			]}
		/>
	);

	return (
		<>
			<Paper elevation={sectionElevation} sx={{ p: 1 }}>
				{/* One gap between whichever blocks are actually shown, so the button is not flush with the comment. */}
				<Stack spacing={1}>
					{showVersionComment && (
						// TODO: Should embedded components and repeats get a version comment? How would that work?
						<TextField
							size="small"
							multiline
							fullWidth
							label={<FormattedMessage defaultMessage="Version Comment" />}
							value={versionComment}
							onChange={(e) => setVersionComment(e.target.value)}
							onFocus={(e) => e.target.select()}
						/>
					)}
					<Tooltip title={showNoChangesTip ? noChangesMessage : ''} describeChild>
						{/* Disabled buttons do not emit hover or focus, so the tip listens on this span. */}
						<Box component="span" tabIndex={showNoChangesTip ? 0 : undefined} sx={{ display: 'block', width: '100%' }}>
							{saveButton}
						</Box>
					</Tooltip>
					{isStackedForm && isEmbedded && (
						<FormHelperText sx={{ m: 0, textAlign: 'center' }}>
							<FormattedMessage defaultMessage="Changes are saved with the main item." />
						</FormHelperText>
					)}
				</Stack>
			</Paper>
			{showSaveOptions && (
				// Sibling of the card, so the sidebar's space-y gap sits above Release Lock and Close.
				<Box
					role="group"
					aria-labelledby={afterSavingLabelId}
					sx={(theme) => ({
						width: '100%',
						// Same border ToggleButton paints: `1px solid ${(theme.vars || theme).palette.divider}`.
						border: `1px solid ${(theme.vars || theme).palette.divider}`,
						// A numeric sx radius is multiplied by the token. `1` is exactly that token in px.
						borderRadius: 1,
						overflow: 'hidden'
					})}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							px: 1,
							py: 0.5
						}}
					>
						<Typography id={afterSavingLabelId} variant="caption" color="text.secondary" component="span">
							<FormattedMessage {...messages.afterSaving} />
						</Typography>
						<Tooltip title={formatMessage(messages.afterSavingHelp)}>
							<IconButton
								size="small"
								aria-label={formatMessage(messages.afterSavingHelp)}
								sx={{ p: 0, color: 'text.secondary' }}
							>
								<InfoOutlined sx={(theme) => ({ fontSize: theme.typography.caption.fontSize })} />
							</IconButton>
						</Tooltip>
					</Box>
					<ToggleButtonGroup
						ref={setGroup}
						exclusive
						fullWidth
						size="small"
						color="primary"
						value={afterSaving}
						aria-labelledby={afterSavingLabelId}
						onChange={handleAfterSaving}
						sx={(theme) => ({
							display: 'flex',
							[`& .${toggleButtonGroupClasses.firstButton}`]: {
								borderLeftColor: 'transparent'
							},
							[`& .${toggleButtonGroupClasses.lastButton}`]: {
								borderRightColor: 'transparent'
							},
							[`& .${toggleButtonClasses.root}`]: {
								flex: '1 1 0',
								minWidth: 0,
								overflow: 'hidden',
								textTransform: 'none',
								px: 1,
								py: 0.5,
								// The container clips the corners. A pill radius is 1px outside that inner edge.
								borderRadius: 0,
								// Keep the 1px border box so a selection change cannot shift the labels.
								// Top edge is the caption separator. Bottom stays clear of the container border.
								borderTopColor: (theme.vars || theme).palette.divider,
								borderBottomColor: 'transparent'
							}
						})}
					>
						{afterSavingOrder.map((value) => {
							const label = afterSavingLabels[value];
							const Icon = afterSavingIcons[value];
							const showTip = afterSavingIconsMode && afterSavingTip === value;
							return (
								<ToggleButton
									key={value}
									value={value}
									aria-label={afterSavingIconsMode ? label : undefined}
									sx={{ position: 'relative' }}
									onMouseEnter={() => setAfterSavingTip(measureAfterSaving() ? value : null)}
									onMouseLeave={() => setAfterSavingTip((current) => (current === value ? null : current))}
									onFocus={() => setAfterSavingTip(measureAfterSaving() ? value : null)}
									onBlur={() => setAfterSavingTip((current) => (current === value ? null : current))}
								>
									{afterSavingIconsMode ? (
										<Tooltip
											title={label}
											open={showTip}
											disableHoverListener
											disableFocusListener
											disableTouchListener
										>
											<Box component="span" sx={{ display: 'inline-flex', lineHeight: 0 }}>
												<Icon fontSize="small" aria-hidden />
											</Box>
										</Tooltip>
									) : (
										<Box
											component="span"
											data-after-saving-label=""
											sx={{
												display: 'block',
												width: '100%',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
												minWidth: 0
											}}
										>
											{label}
										</Box>
									)}
									<Box
										component="span"
										aria-hidden
										ref={(node: HTMLSpanElement | null) => {
											probes.current[value] = node;
										}}
										sx={{
											position: 'absolute',
											left: 0,
											top: 0,
											visibility: 'hidden',
											whiteSpace: 'nowrap',
											width: 'max-content',
											pointerEvents: 'none'
										}}
									>
										{label}
									</Box>
								</ToggleButton>
							);
						})}
					</ToggleButtonGroup>
				</Box>
			)}
		</>
	);
}

/** Sits under Close. Same per-user atom the close path reads. */
export function ReleaseLockOnCloseControl({ atoms }: { atoms?: FormsEngineAtoms }) {
	const stableFormContext = useContext(StableFormContext);
	const [releaseLockOnClose, setReleaseLockOnClose] = useAtom((atoms ?? stableFormContext.atoms).releaseLockOnClose);
	return (
		<Stack spacing={1} sx={{ maxWidth: '100%' }}>
			<FormControlLabel
				labelPlacement="start"
				sx={{
					// "start" sets marginRight: -11. That, like Switch edge="end" (-8),
					// makes the sidebar scroll sideways. Keep the control inside the column.
					ml: 0,
					mr: 0,
					width: '100%',
					maxWidth: '100%',
					minWidth: 0,
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					gap: 1,
					[`& .${switchClasses.root}`]: { flexShrink: 0 }
				}}
				label={
					<Typography variant="body2" component="span" sx={{ minWidth: 0, flex: '1 1 auto', textAlign: 'left' }}>
						<FormattedMessage {...messages.releaseLockOnClose} />
					</Typography>
				}
				control={
					<Switch
						size="small"
						color={releaseLockOnClose ? 'primary' : 'warning'}
						checked={releaseLockOnClose}
						onChange={(_event, checked) => setReleaseLockOnClose(checked)}
						// `color` only paints the checked switch. Keep-lock is the off state.
						sx={
							releaseLockOnClose
								? undefined
								: (theme) => ({
										[`& .${switchClasses.switchBase}`]: {
											color: theme.palette.warning.main
										},
										[`& .${switchClasses.switchBase} + .${switchClasses.track}`]: {
											backgroundColor: theme.palette.warning.main,
											opacity: 0.5
										}
									})
						}
					/>
				}
			/>
			{!releaseLockOnClose && (
				<Alert role="status" severity="warning">
					<FormattedMessage {...messages.keepLockWarning} />
				</Alert>
			)}
		</Stack>
	);
}

function saveReadError(error: unknown, fallbackMessage: string): ApiResponse {
	if (error instanceof Error) return { message: error.message };
	if (error && typeof error === 'object') return error as ApiResponse;
	return { message: fallbackMessage };
}

export default SaveCard;
