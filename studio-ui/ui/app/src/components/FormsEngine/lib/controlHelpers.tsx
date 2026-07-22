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

import { ControlProps } from '../types';
import Alert from '@mui/material/Alert';
import { FormattedMessage } from 'react-intl';
import React, {
	ComponentType,
	ElementType,
	lazy,
	LazyExoticComponent,
	memo,
	MouseEvent as ReactMouseEvent,
	Suspense
} from 'react';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { Atom, useAtom } from 'jotai/index';
import { buildFileUrl } from '../../../services/plugin';
import { controlMap } from './controlMap';
import { UnknownControl } from '../components/UnknownControl';
import ErrorBoundary from '../../ErrorBoundary';
import { ControlSkeleton } from '../components/ControlSkeleton';
import { ContentTypeField } from '../../../models';
import ContentType from '../../../models/ContentType';
import FormsEngineField from '../components/FormsEngineField';
import { FormsEngineAtoms } from './formsEngineContext';
import type { ConsolidatedMediaPickerData } from '../dataSourceHooks/useConsolidatedImagePickerData';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TravelExploreOutlined from '@mui/icons-material/TravelExploreOutlined';
import SearchRounded from '@mui/icons-material/SearchRounded';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { getFileNameFromPath } from '../../../utils/path';
import { ensureSingleSlash } from '../../../utils/string';
import { Dispatch as ReduxDispatch } from 'redux';
import { BrowseFilesDialogProps } from '../../BrowseFilesDialog';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog, pushNonDialog } from '../../../state/actions/dialogStack';
import { createComponentId } from '../../../utils/system';
import { SearchProps } from '../../Search';
import type { ImageRestrictions } from '../../ImageEditorDialog/types';
import type { SingleFileUploadDialogProps } from '../../SingleFileUploadDialog';
import type { FileUploadResult } from '../../SingleFileUpload';
import { ImagePickerType } from '../controls/ImagePicker';

// Note: These persist past the closing of the form.
const lazyControlMap = new Map<string, LazyExoticComponent<ComponentType>>();

function addLazyControl(url: string): void {
	lazyControlMap.set(
		url,
		lazy(() =>
			import(/* @vite-ignore */ url)
				.then((m) => {
					if (m.default) return m;
					else return { default: ControlPluginNoDefaultExportError };
				})
				.catch((reason) => {
					console.error(
						// TODO: Docs or internal URL
						`An error occurred loading the control. The form attempted to load the control from \`${url}\`. Forms Engine v1 controls are not compatible with this version. If you haven't migrated this control, please check the migration guide at https://docs.craftercms.org/.\n\n`,
						reason
					);
					return { default: ControlPluginError };
				})
		)
	);
}

export interface ControlWrapperProps {
	field: ContentTypeField;
	autoFocus: boolean;
	readonly: boolean;
	contentType: ContentType;
	atom: Atom<unknown>;
	customControlMap?: Record<string, ElementType>;
}

export const ControlWrapper = memo(function (props: ControlWrapperProps) {
	const siteId = useActiveSiteId();
	const { field, autoFocus, readonly, contentType, atom, customControlMap } = props;
	const [value, setValue] = useAtom(atom);
	const fieldId = field.id;
	let Control: ElementType<ControlProps>;
	if (field.properties?.plugin) {
		const url = buildFileUrl(
			siteId,
			field.properties.plugin.type,
			field.properties.plugin.name,
			field.properties.plugin.filename,
			field.properties.plugin.pluginId
		);
		if (!lazyControlMap.has(url)) addLazyControl(url);
		Control = lazyControlMap.get(url);
	} else {
		Control = customControlMap?.[field.type] ?? controlMap[field.type] ?? UnknownControl;
	}
	return (
		<ErrorBoundary key={fieldId}>
			<Suspense fallback={<ControlSkeleton label={field.name} />}>
				<Control
					// Only auto-focus on controls that are not readonly.
					// Focus might not work consistently on disabled controls anyway.
					autoFocus={autoFocus && !readonly}
					value={value}
					setValue={setValue}
					field={field}
					contentType={contentType}
					readonly={readonly}
				/>
			</Suspense>
		</ErrorBoundary>
	);
});

function ControlPluginError({ field }: ControlProps) {
	return (
		<FormsEngineField field={field} menu={false}>
			<Alert
				severity="error"
				variant="standard"
				sx={(theme) => ({ border: 'none', strong: { fontWeight: theme.typography.fontWeightMedium } })}
			>
				<FormattedMessage
					defaultMessage="Unable to load the {name} ({id}) control. The control may be absent or contain errors in the code. Check the browser console for error details."
					values={{
						name: field.name,
						id: field.id
					}}
				/>
			</Alert>
		</FormsEngineField>
	);
}

function ControlPluginNoDefaultExportError({ field }: ControlProps) {
	return (
		<FormsEngineField field={field} menu={false}>
			<Alert
				severity="error"
				variant="standard"
				sx={(theme) => ({ border: 'none', strong: { fontWeight: theme.typography.fontWeightMedium } })}
			>
				<FormattedMessage
					defaultMessage="Unable to render {name} ({id}) control. No default export found. A control's JavaScript file should export a React component as `default`. Please check <docs>the documentation</docs>."
					values={{
						name: field.name,
						id: field.id,
						// TODO: Docs or internal link
						docs: (str) => (
							<a href="https://docs.craftercms.org" target="_blank">
								{str}
							</a>
						)
					}}
				/>
			</Alert>
		</FormsEngineField>
	);
}

export function renderFieldControl(
	field: ContentTypeField,
	atoms: FormsEngineAtoms['valueByFieldId'],
	autoFocus: boolean,
	readonly: boolean,
	contentType: ContentType,
	customControlsMap?: ControlWrapperProps['customControlMap']
) {
	const fieldId = field.id;
	return (
		<ControlWrapper
			key={fieldId}
			field={field}
			atom={atoms[fieldId]}
			readonly={readonly}
			autoFocus={autoFocus}
			contentType={contentType}
			customControlMap={customControlsMap}
		/>
	);
}

/** Returns menu options for media controls based on allowed paths. The options are categorized into "Browse", "Search",
 * and "Upload".
 *
 * @param dataSourceSummary - Summary of allowed paths for browsing, searching, and uploading media.
 * @param handleDataSourceOptionClick - Callback function to handle clicks on the menu options.
 * @param readonly - If true, the menu options will be disabled.
 * @returns An array of JSX elements representing the menu options.
 * */
export function createMediaMenuOptions(
	dataSourceSummary: ConsolidatedMediaPickerData,
	handleDataSourceOptionClick: (option: ImagePickerType) => void,
	readonly: boolean = false
) {
	const { allowedBrowsePaths, allowedUploadPaths, allowedSearchPaths } = dataSourceSummary;
	const menuOptions = [];
	const availableOptions: ImagePickerType[] = [];

	if (allowedBrowsePaths.length > 0) {
		availableOptions.push('browse');
		menuOptions.push(
			<MenuItem key="browse" onClick={(event) => handleDataSourceOptionClick('browse')} disabled={readonly}>
				<ListItemIcon sx={{ mr: 0 }}>
					<TravelExploreOutlined fontSize="small" />
				</ListItemIcon>
				<ListItemText>
					<FormattedMessage defaultMessage="Browse" />
				</ListItemText>
			</MenuItem>
		);
	}
	if (allowedSearchPaths.length > 0) {
		availableOptions.push('search');
		menuOptions.push(
			<MenuItem key="search" onClick={(event) => handleDataSourceOptionClick('search')} disabled={readonly}>
				<ListItemIcon sx={{ mr: 0 }}>
					<SearchRounded fontSize="small" />
				</ListItemIcon>
				<ListItemText>
					<FormattedMessage defaultMessage="Search" />
				</ListItemText>
			</MenuItem>
		);
	}
	if (allowedUploadPaths.length > 0) {
		availableOptions.push('upload');
		menuOptions.push(
			<MenuItem key="upload" onClick={(event) => handleDataSourceOptionClick('upload')} disabled={readonly}>
				<ListItemIcon sx={{ mr: 0 }}>
					<UploadFileOutlinedIcon fontSize="small" />
				</ListItemIcon>
				<ListItemText>
					<FormattedMessage defaultMessage="Upload" />
				</ListItemText>
			</MenuItem>
		);
	}
	return { menuOptions, availableOptions };
}

export function downloadMedia(base: string, url: string) {
	const link = document.createElement('a');
	link.href = ensureSingleSlash(`${base}${url}`);
	link.download = getFileNameFromPath(url); // Extracts the file name from the URL
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

export const showBrowseFilesDialog = ({
	dispatch,
	onSuccess,
	path,
	contentTypes,
	multiSelect = true,
	preselectedPaths = [],
	initialParameters = {}
}: {
	path: string;
	dispatch: ReduxDispatch;
	onSuccess: BrowseFilesDialogProps['onSuccess'];
	contentTypes?: string[];
	multiSelect?: boolean;
	preselectedPaths?: string[];
	initialParameters?: BrowseFilesDialogProps['initialParameters'];
}): void => {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('BrowseFilesDialog'),
			props: {
				path,
				multiSelect,
				allowUpload: false,
				contentTypes: contentTypes ?? [],
				preselectedPaths,
				initialParameters,
				onClose: () => dispatch(popDialog({ id })),
				onSuccess(items) {
					dispatch(popDialog({ id }));
					onSuccess(items);
				}
			} as Partial<BrowseFilesDialogProps>
		})
	);
};

export const showSearchDialog = ({
	dispatch,
	path,
	preselectedPaths = [],
	contentTypes,
	onAcceptSelection,
	initialParameters
}: {
	path: string;
	contentTypes?: string[];
	preselectedPaths?: string[];
	initialParameters?: SearchProps['initialParameters'];
	dispatch: ReduxDispatch;
	onAcceptSelection: SearchProps['onAcceptSelection'];
}): void => {
	const id = nanoid();
	dispatch(
		pushNonDialog({
			id,
			component: createComponentId('Search'),
			props: {
				mode: 'select',
				embedded: true,
				initialParameters: {
					path,
					sortBy: 'internalName',
					...initialParameters,
					...(contentTypes && {
						filters: {
							...(initialParameters?.filters ?? {}),
							'content-type': contentTypes
						}
					})
				},
				preselectedPaths,
				onClose: () => dispatch(popDialog({ id })),
				onAcceptSelection(paths, items) {
					dispatch(popDialog({ id }));
					onAcceptSelection(paths, items);
				}
			} as Partial<SearchProps>
		})
	);
};

export const showSingleFileUploadDialog = ({
	dispatch,
	siteId,
	path,
	fileTypes,
	onFileAdded,
	onUploadComplete
}: {
	dispatch: ReduxDispatch;
	siteId: string;
	path: string;
	fileTypes?: string[];
	onFileAdded?: SingleFileUploadDialogProps['onFileAdded'];
	onUploadComplete?: SingleFileUploadDialogProps['onUploadComplete'];
}): void => {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('SingleFileUploadDialog'),
			props: {
				site: siteId,
				path,
				fileTypes,
				onFileAdded,
				onUploadComplete: (result: FileUploadResult) => {
					dispatch(popDialog({ id }));
					onUploadComplete?.(result);
				}
			} as SingleFileUploadDialogProps
		})
	);
};

export const showImageCropDialog = ({
	dispatch,
	path,
	mimeType,
	restrictions,
	writeContent,
	onCrop
}: {
	dispatch: ReduxDispatch;
	path: string;
	mimeType?: string;
	restrictions?: ImageRestrictions;
	writeContent?: boolean;
	onCrop: (blob: Blob, newPath?: string) => void;
}): void => {
	const dialogId = nanoid();
	dispatch(
		pushDialog({
			id: dialogId,
			component: createComponentId('ImageEditorDialog'),
			props: {
				path,
				mimeType,
				subtitle: restrictions ? <ImageRestrictionSubtitle restrictions={restrictions} /> : undefined,
				restrictions,
				writeContent,
				onCrop: (blob: Blob, newPath: string) => {
					dispatch(popDialog({ id: dialogId }));
					onCrop?.(blob, newPath);
				}
			}
		})
	);
};

/** Generates user-friendly messages for image width and height restrictions.
 *
 * @param restrictions - An object containing image dimension restrictions.
 * @returns An object with formatted width and height restriction messages.
 */
export const getImageRestrictionMessages = (restrictions: ImageRestrictions) => {
	const width = [
		restrictions.width ? ` equal to ${restrictions.width}px` : null,
		restrictions.minWidth ? ` minimum ${restrictions.minWidth}px` : null,
		restrictions.maxWidth ? ` maximum ${restrictions.maxWidth}px` : null
	]
		.filter(Boolean)
		.join(',');
	const height = [
		restrictions.height ? ` equal to ${restrictions.height}px` : null,
		restrictions.minHeight ? ` minimum ${restrictions.minHeight}px` : null,
		restrictions.maxHeight ? ` maximum ${restrictions.maxHeight}px` : null
	]
		.filter(Boolean)
		.join(',');
	return { width, height };
};

const hasWidthRestriction = (restrictions: ImageRestrictions) =>
	Boolean(restrictions.width || restrictions.minWidth || restrictions.maxWidth);

const hasHeightRestriction = (restrictions: ImageRestrictions) =>
	Boolean(restrictions.height || restrictions.minHeight || restrictions.maxHeight);

export const ImageRestrictionSubtitle = ({ restrictions }: { restrictions?: ImageRestrictions }) => {
	if (!restrictions) return null;
	const { width, height } = getImageRestrictionMessages(restrictions);
	const hasWidth = hasWidthRestriction(restrictions);
	const hasHeight = hasHeightRestriction(restrictions);

	if (hasWidth && hasHeight) {
		return (
			<FormattedMessage
				defaultMessage="The image does not meet the width & height constraints (Width: {width}. Height: {height})."
				values={{ width, height }}
			/>
		);
	}
	if (hasWidth) {
		return (
			<FormattedMessage
				defaultMessage="The image does not meet the width constraint (Width: {width})."
				values={{ width }}
			/>
		);
	}
	if (hasHeight) {
		return (
			<FormattedMessage
				defaultMessage="The image does not meet the height constraint (Height: {height})."
				values={{ height }}
			/>
		);
	}
	return null;
};

/**
 * Checks if the populate time expression is valid.
 *
 * @param expr {string} The populate time expression to validate.
 * @returns true if the expression is valid, false otherwise.
 */
export function validateTimePopulateExpression(expr: string): boolean {
	const trimmed = (expr ?? '').replace(/ /g, '').toLowerCase();
	if (trimmed === 'now') return true;
	return /^(now)?[+-]\d+(hours|minutes)$/i.test(trimmed);
}

/**
 * Checks if the populate date expression is valid.
 * @param expr {string} The populate date expression to validate.
 * @returns true if the expression is valid, false otherwise.
 *
 * Supports: now, now+/-N[days|weeks|years|hours|minutes], day-of-week names, and {macro} with optional HH:mm[:ss].
 * A static time suffix is only valid on the {macro} form (e.g. "{friday} 09:00"), not on plain expressions
 * (e.g. "monday 09:00" or "now+2d 09:00").
 */
export function validateDatePopulateExpression(expr: string): boolean {
	if (!expr) return false;
	const trimmed = expr.trim();
	const days = [
		'sunday',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
		'sun',
		'mon',
		'tue',
		'wed',
		'thu',
		'fri',
		'sat'
	];

	// 1. Check for {macro} or {macro} time
	const macroMatch = trimmed.match(/^\{([^}]+)\}(?:\s+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?))?$/i);
	if (macroMatch) {
		const macro = macroMatch[1].trim().toLowerCase();
		const staticTime = macroMatch[2] ? macroMatch[2].trim() : null;

		// Validate macro (day-of-week or now/now+/-N...)
		if (
			days.includes(macro) ||
			/^(now|((now)?[+-]\d+(d|days|w|weeks|y|years|h|hours|m|minutes)))$/i.test(macro.replace(/ /g, ''))
		) {
			// If static time is present, validate format HH:mm or HH:mm:ss
			if (staticTime) {
				if (/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(staticTime)) {
					return true;
				} else {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	const lowered = trimmed.toLowerCase();
	// 2. Day of week macro (plain)
	if (days.includes(lowered)) return true;

	// 3. now, now+2d, now-3weeks, now+1years, now-4hours, now+30minutes (plain)
	if (/^(now|((now)?[+-]\d+(d|days|w|weeks|y|years|h|hours|m|minutes)))$/i.test(lowered.replace(/ /g, ''))) return true;

	return false;
}

/**
 * Returns a new Date object representing the next occurrence of the specified day of the week after the given date.
 *
 * @param date - The reference date from which to calculate the next day of the week.
 * @param dayOfWeek - The target day of the week as a number (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 * @returns A new Date object set to the next occurrence of the specified day of the week.
 *
 */
function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
	const result = new Date(date);
	const current = result.getDay();
	let delta = dayOfWeek - current;
	if (delta <= 0) delta += 7;
	result.setDate(result.getDate() + delta);
	return result;
}

/**
 * Sets the time (hours, minutes, seconds) on a given Date object based on a time string.
 *
 * @param date - The Date object to modify.
 * @param timeStr - The time string in the format "HH:mm" or "HH:mm:ss".
 * @returns The modified Date object with the specified time set.
 *
 */
function setTimeOnDate(date: Date, timeStr: string) {
	const parts = timeStr.split(':').map(Number);
	if (parts.length >= 2) {
		date.setHours(parts[0], parts[1], parts[2] || 0, 0);
	}
	return date;
}

/**
 * Evaluates a populate date/time expression and returns the resulting Date.
 * If the expression is invalid, returns the current date.
 *
 * Supported forms include plain offsets ("now", "now+5days", "+2d"), day-of-week names ("monday"),
 * and braced macros with an optional static time ("{friday} 09:00", "{now+2days} 09:30:15").
 *
 * @param params {Object} - The parameters for processing the date expression.
 * @param params.expression {string} - The populate expression to evaluate.
 * @param params.validatePopulateExpression {Function} - Validates the expression; invalid expressions fall back to now.
 * @param [params.allowPastDate=false] {boolean} - When `false` (the default), avoids populating a datetime in the past:
 *   - Plain `now` sets seconds to :59 on the current minute.
 *   - `{macro} HH:mm[:ss]` applies the static time first; if the result is already in the past, falls back to
 *     the current time with seconds set to :59 (e.g. `{now} 00:00` does not stay at midnight for most of the day).
 *   - Other past-producing expressions (e.g. "now-5days") are not clamped here; the field control validates those.
 *   When `true`, the computed datetime is returned as-is, including past static-time results.
 *
 * @returns {Date} The calculated date based on the expression.
 */

export function processPopulateExpression({
	expression,
	validatePopulateExpression,
	allowPastDate = false
}: {
	expression: string;
	validatePopulateExpression(expr: string): boolean;
	allowPastDate?: boolean;
}): Date {
	const trimmed = expression?.trim() ?? '';
	const macroMatch = trimmed.match(/^\{([^}]+)\}(?:\s+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?))?$/i);
	const macro = (macroMatch ? macroMatch[1] : trimmed).trim();
	const staticTime = macroMatch?.[2]?.trim() ?? null;

	if (!validatePopulateExpression(trimmed)) {
		const fallback = new Date();
		if (!allowPastDate) fallback.setSeconds(59, 0);
		return fallback;
	}

	let date = new Date();

	// Day-of-week mapping
	const dayOfWeekMap: Record<string, number> = {
		sunday: 0,
		sun: 0,
		monday: 1,
		mon: 1,
		tuesday: 2,
		tue: 2,
		wednesday: 3,
		wed: 3,
		thursday: 4,
		thu: 4,
		friday: 5,
		fri: 5,
		saturday: 6,
		sat: 6
	};
	const macroLower = macro.toLowerCase();
	if (macroLower in dayOfWeekMap) {
		date = getNextDayOfWeek(date, dayOfWeekMap[macroLower]);
	} else if (validatePopulateExpression(macro)) {
		const normalized = macro.replace(/ /g, '').toLowerCase();
		if (normalized === 'now') {
			if (!allowPastDate) date.setSeconds(59, 0);
		} else {
			const match = normalized.match(/^(?:now)?([+-])(\d+)(d|days|w|weeks|y|years|h|hours|m|minutes)$/);
			if (match) {
				const [, sign, value, unit] = match;
				const n = parseInt(value, 10) * (sign === '-' ? -1 : 1);
				switch (unit) {
					case 'y':
					case 'years':
						date.setFullYear(date.getFullYear() + n);
						break;
					case 'w':
					case 'weeks':
						date.setDate(date.getDate() + n * 7);
						break;
					case 'd':
					case 'days':
						date.setDate(date.getDate() + n);
						break;
					case 'h':
					case 'hours':
						date.setTime(date.getTime() + n * 3600000);
						break;
					case 'm':
					case 'minutes':
						date.setTime(date.getTime() + n * 60000);
						break;
				}
			}
		}
	}

	if (staticTime) {
		setTimeOnDate(date, staticTime);
		if (!allowPastDate && date.getTime() < Date.now()) {
			date = new Date();
			date.setSeconds(59, 0);
		}
	}
	return date;
}
