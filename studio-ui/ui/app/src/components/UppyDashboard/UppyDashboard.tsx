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

import { Dashboard } from '@craftercms/uppy';
import React, { useCallback, useEffect, useRef } from 'react';

import palette from '../../styles/palette';
import { validateActionPolicy } from '../../services/sites';
import { checkPathExistence } from '../../services/content';
import { defineMessages, useIntl } from 'react-intl';
import { showSystemNotification } from '../../state/actions/system';
import { pushErrorDialog } from '../../utils/system';
import { useDispatch } from 'react-redux';
import { alpha } from '@mui/material';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import type { Body, Meta, UppyFile } from '@uppy/core';
import { ensureSingleSlash } from '../../utils/string';
import { UppyDashboardProps } from './UppyDashboardProps';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import type { DashboardOptions } from 'uppy';
import { extractErrorPayload } from '../../utils/ajax';

const translations = defineMessages({
	cancelPending: {
		id: 'uppyDashboard.cancelPending',
		defaultMessage: 'Cancel pending'
	},
	clearCompleted: {
		id: 'uppyDashboard.clearCompleted',
		defaultMessage: 'Clear completed'
	},
	clear: {
		id: 'words.clear',
		defaultMessage: 'Clear'
	},
	addMore: {
		id: 'uppyDashboard.addMore',
		defaultMessage: 'Add more'
	},
	rejectAll: {
		id: 'uppyDashboard.rejectAll',
		defaultMessage: 'Reject all changes'
	},
	acceptAll: {
		id: 'uppyDashboard.acceptAll',
		defaultMessage: 'Accept all changes'
	},
	validating: {
		id: 'words.validating',
		defaultMessage: 'Validating'
	},
	validateAndRetry: {
		id: 'uppyDashboard.validateAndRetry',
		defaultMessage: 'Accept changes and upload'
	},
	removeFile: {
		id: 'uppyDashboard.removeFile',
		defaultMessage: 'Remove file'
	},
	back: {
		id: 'words.back',
		defaultMessage: 'Back'
	},
	addingMoreFiles: {
		id: 'uppyDashboard.addingMoreFiles',
		defaultMessage: 'Adding more files'
	},
	renamingFromTo: {
		id: 'uppyDashboard.renamingFromTo',
		defaultMessage: "Renaming from %'{from}' to %'{to}'"
	},
	close: {
		id: 'words.close',
		defaultMessage: 'Close'
	},
	minimize: {
		id: 'words.minimize',
		defaultMessage: 'Minimize'
	},
	maxFiles: {
		id: 'uppyDashboard.maxFiles',
		defaultMessage: '{maxFiles} max.'
	},
	maxActiveUploadsReached: {
		id: 'uppyDashboard.maxActiveUploadsReached',
		defaultMessage: '{maxFiles} maximum active uploads reached. Excess has been discarded.'
	},
	projectPoliciesNoComply: {
		defaultMessage: 'File "{fileName}" doesn\'t comply with project policies: {detail}'
	},
	fileAlreadyExists: {
		id: 'uppyDashboard.fileAlreadyExists',
		defaultMessage: 'A file with the name "{fileName}" already exists at this location.'
	},
	fileOverwriteRequired: {
		id: 'uppyDashboard.fileOverwriteRequired',
		defaultMessage: 'A file named "{fileName}" already exists. Do you want to overwrite it?'
	},
	confirmOverwrite: {
		id: 'uppyDashboard.confirmOverwrite',
		defaultMessage: 'Overwrite and upload'
	},
	proceed: {
		defaultMessage: 'Start Uploads'
	},
	proceedSingle: {
		defaultMessage: 'Start Upload'
	},
	browseFiles: {
		defaultMessage: 'browse files'
	},
	browseFolders: {
		defaultMessage: 'browse folders'
	},
	dropPasteBoth: {
		defaultMessage: 'Drop files here, {browseFiles} or {browseFolders}'
	},
	pathExistenceCheckFailed: {
		id: 'uppyDashboard.pathExistenceCheckFailed',
		defaultMessage: 'Unable to verify whether the file already exists'
	}
});

export function UppyDashboard(props: UppyDashboardProps) {
	const { uppy, site, path, onClose, onMinimized, title, onPendingChanges, maxActiveUploads } = props;
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
	const options = {
		replaceTargetContent: true,
		width: '100%',
		height: '60vh',
		fileManagerSelectionType: 'both',
		showRemoveButtonAfterComplete: false,
		theme: prefersDarkMode ? 'dark' : 'light',
		...props.options
	};
	const ref = useRef(undefined);
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const targetsRef = useRef<string[]>([]);

	// onItemsUploaded will be called every 1000ms and it will use the targetsRef.current list to dispatch itemsUploaded system event
	// then next time onItemsUploaded will be called with a new list of targetsRef.current
	const onItemsUploaded = useCallback(() => {
		targetsRef.current = [];
	}, []);

	const functionsRef = useRef({ onItemsUploaded: null, onPendingChanges: null, onMinimized: null, onClose: null });
	functionsRef.current.onItemsUploaded = onItemsUploaded;
	functionsRef.current.onPendingChanges = onPendingChanges;
	functionsRef.current.onMinimized = onMinimized;
	functionsRef.current.onClose = onClose;

	useEffect(() => {
		const onItemsUploaded$ = new Subject();

		const subscription = onItemsUploaded$.pipe(debounceTime(1000)).subscribe(() => {
			functionsRef.current.onItemsUploaded();
		});

		if (uppy.getPlugin('craftercms:Dashboard')) {
			uppy.removePlugin(uppy.getPlugin('craftercms:Dashboard'));
		}
		uppy.use(Dashboard, {
			...options,
			inline: true,
			target: ref.current,
			singleFileFullScreen: false,
			proudlyDisplayPoweredByUppy: false,
			validateActionPolicy,
			checkPathExistence,
			onPathExistenceError: (err) => {
				dispatch(pushErrorDialog({ props: { error: extractErrorPayload(err) } }));
			},
			onPendingChanges: function () {
				functionsRef.current.onPendingChanges.apply(null, arguments);
			},
			onClose: function () {
				functionsRef.current.onClose.apply(null, arguments);
			},
			onMinimized: function () {
				functionsRef.current.onMinimized.apply(null, arguments);
			},
			title,
			id: 'craftercms:Dashboard',
			site,
			path: ensureSingleSlash(`${path}/`),
			locale: {
				strings: {
					cancelPending: formatMessage(translations.cancelPending),
					clearCompleted: formatMessage(translations.clearCompleted),
					clear: formatMessage(translations.clear),
					addMore: formatMessage(translations.addMore),
					acceptAll: formatMessage(translations.acceptAll),
					rejectAll: formatMessage(translations.rejectAll),
					validating: formatMessage(translations.validating),
					validateAndRetry: formatMessage(translations.validateAndRetry),
					confirmOverwrite: formatMessage(translations.confirmOverwrite),
					removeFile: formatMessage(translations.removeFile),
					back: formatMessage(translations.back),
					addingMoreFiles: formatMessage(translations.addingMoreFiles),
					renamingFromTo: formatMessage(translations.renamingFromTo),
					minimize: formatMessage(translations.minimize),
					close: formatMessage(translations.close),
					proceed: formatMessage(translations.proceed),
					proceedSingle: formatMessage(translations.proceedSingle),
					browseFiles: formatMessage(translations.browseFiles),
					browseFolders: formatMessage(translations.browseFolders),
					dropPasteBoth: formatMessage(translations.dropPasteBoth, {
						// These values are for uppy's mechanism to replace the placeholders with links
						browseFiles: '%{browseFiles}',
						browseFolders: '%{browseFolders}'
					}),
					pathExistenceCheckFailed: formatMessage(translations.pathExistenceCheckFailed)
				},
				pluralize: (n: number) => (n === 1 ? 0 : 1)
			},
			maxActiveUploads,
			externalMessages: {
				maxFiles: formatMessage(translations.maxFiles, { maxFiles: maxActiveUploads }),
				projectPoliciesChangeRequired: (fileName, suggestedFileName) => {
					return formatMessage(
						{
							defaultMessage:
								'Path `{fileName}` was transformed to `{suggestedFileName}` per the project file name policy'
						},
						{ fileName, suggestedFileName }
					);
				},
				projectPoliciesNoComply: (fileName, detail) => {
					return formatMessage(translations.projectPoliciesNoComply, { fileName, detail });
				},
				fileAlreadyExists: (fileName) => {
					return formatMessage(translations.fileAlreadyExists, { fileName });
				},
				fileOverwriteRequired: (fileName) => {
					return formatMessage(translations.fileOverwriteRequired, { fileName });
				}
			},
			onMaxActiveUploadsReached: () => {
				dispatch(
					showSystemNotification({
						message: formatMessage(translations.maxActiveUploadsReached, { maxFiles: maxActiveUploads })
					})
				);
			}
		} as unknown as DashboardOptions<Meta, Body>);

		const onUploadSuccess = (file: UppyFile<Meta, Body>) => {
			onItemsUploaded$.next(file.id);
			targetsRef.current.push(file.id);
		};

		uppy.on('upload-success', onUploadSuccess);

		return () => {
			subscription.unsubscribe();
			const plugin = uppy.getPlugin('craftercms:Dashboard');
			if (plugin) {
				uppy.removePlugin(plugin);
				uppy.off('upload-success', onUploadSuccess);
			}
		};
		// options is removed from dependencies to avoid re-render a new dashboard
		/* eslint-disable react-hooks/exhaustive-deps */
	}, [dispatch, formatMessage, maxActiveUploads, path, site, title, uppy]);

	return (
		<Box
			component="section"
			ref={ref}
			sx={(theme) => ({
				paddingBottom: 0,
				'& .uppy-Dashboard-inner': {
					border: 0,
					borderRadius: 0,
					backgroundColor: theme.palette.background.default
				},
				'& .uppy-Dashboard-files, & .uppy-size--md .uppy-Dashboard-files': {
					padding: '15px'
				},
				'& .uppy-Dashboard-browse': {
					color: theme.palette.primary.main,
					'&:hover': {
						textDecoration: 'underline'
					}
				},
				'& .uppy-Dashboard-dropFilesHereHint': {
					border: `1px dashed ${theme.palette.primary.main}`,
					color: theme.palette.primary.main
				},
				'& [data-uppy-drag-drop-supported=true] .uppy-Dashboard-AddFiles': {
					border: 0
				},
				// region header
				'& .uppy-dashboard-header': {
					backgroundColor: theme.palette.background.paper,
					minHeight: '64px',
					color: theme.palette.text.primary,
					padding: '8px',
					display: 'flex',
					alignItems: 'center',
					borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
					'& .uppy-dashboard-header-actions': {
						marginLeft: 'auto'
					},
					'& .uppy-dashboard-header-title': {
						padding: '0 8px',
						margin: 0,
						fontSize: '1.25rem',
						fontFamily: 'Source Sans Pro, Open Sans, sans-serif',
						fontWeight: 600,
						lineHeight: '1.6'
					}
				},
				// endregion
				// region item card
				'& .uppy-dashboard-item-card': {
					display: 'flex',
					position: 'relative'
				},
				'& .uppy-dashboard-item-validating': {
					color: 'rgba(0, 0, 0, 0.54)'
				},
				'& .uppy-dashboard-item-preview': {
					width: '120px',
					height: '120px',
					position: 'relative'
				},
				'& .uppy-Dashboard-Item-name': {
					display: 'flex',
					alignItems: 'center',
					'& .suggested-file-name': {
						display: 'flex',
						alignItems: 'center'
					},
					'& .suggested-icon': {
						fill: palette.gray.medium6,
						width: '20px',
						height: '20px',
						marginRight: '5px',
						marginLeft: '5px'
					}
				},
				'& .uppy-dashboard-site-policy-warning': {
					color: theme.palette.error.main,
					display: 'flex',
					alignItems: 'center',
					fontSize: '0.875rem',
					marginBottom: '5px',
					'& .warning-icon': {
						fill: theme.palette.error.main,
						width: '20px',
						height: '20px',
						marginRight: '5px'
					}
				},
				'& .uppy-Dashboard-Item-previewInnerWrap': {
					backgroundColor: `${theme.palette.divider} !important`,
					borderTopRightRadius: 0,
					borderBottomRightRadius: 0
				},
				'& .uppy-dashboard-item-statusType': {
					display: 'inline-block'
				},
				'& .uppy-dashboard-item-fileInfoAndButtons': {
					padding: '15px',
					display: 'flex',
					alignItems: 'center',
					flexGrow: 1
				},
				'& .uppy-dashboard-item-progress': {
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
					'& .uppy-file-progress-bar': {
						backgroundColor: theme.palette.primary.main,
						height: '2px',
						transition: 'background-color, width 0.3s ease-out',
						borderBottomRightRadius: '5px',
						borderBottomLeftRadius: '5px',
						'&.complete': {
							backgroundColor: theme.palette.success.main
						},
						'&.error': {
							backgroundColor: theme.palette.error.main
						}
					}
				},
				'& .uppy-Dashboard-Item-statusSize': {
					marginBottom: 0
				},
				'& .uppy-Dashboard-Item-errorDetails': {
					display: 'inline-block'
				},
				'& .item-name-valid': {
					color: theme.palette.success.dark
				},
				'& .item-name-invalid': {
					textDecoration: 'line-through',
					color: theme.palette.text.primary
				},
				// endregion
				// region File list
				'& .uppy-Dashboard-files': {},
				'& .uppy-Dashboard-AddFiles-title': {
					color: theme.palette.text.primary,
					position: 'relative',
					zIndex: 1
				},
				'& .uppy-dashboard-files-list-row': {
					marginBottom: '20px',
					'&:last-child': {
						marginBottom: 0
					}
				},
				// endregion
				// region Footer
				'& .uppy-DashboardContent-bar': {
					position: 'relative',
					borderTop: `1px solid ${theme.palette.divider}`,
					backgroundColor: theme.palette.background.paper,
					borderBottom: 0
				},
				'& .uppy-dashboard-progress-indicator': {
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					'& .uppy-file-progress-bar': {
						backgroundColor: theme.palette.primary.main,
						height: '2px',
						transition: 'background-color, width 0.3s ease-out',
						'&.complete': {
							backgroundColor: theme.palette.success.main
						},
						'&.error': {
							backgroundColor: theme.palette.error.main
						}
					}
				},
				'& .uppy-dashboard-validation-buttons': {
					marginLeft: 'auto',
					'& button:first-child': {
						marginRight: '10px'
					}
				},
				'& .uppy-dashboard-right-buttons': {
					marginLeft: 'auto',
					'& button:last-child': {
						marginLeft: '10px'
					}
				},
				'& .uppy-dashboard-button-base': {
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxSizing: 'border-box',
					WebkitTapHighlightColor: 'transparent',
					backgroundColor: 'transparent',
					outline: 0,
					border: 0,
					margin: 0,
					borderRadius: 0,
					padding: 0,
					cursor: 'pointer',
					userSelect: 'none',
					verticalAlign: 'middle',
					MozAppearance: 'none',
					WebkitAppearance: 'none',
					textDecoration: 'none',
					color: 'inherit',
					'&::-moz-focus-inner': {
						borderStyle: 'none'
					},
					'&:disabled': {
						pointerEvents: 'none',
						cursor: 'default'
					},
					'@media print': {
						colorAdjust: 'exact'
					}
				},
				'& .uppy-dashboard-text-button': {
					...theme.typography.button,
					minWidth: '64px',
					padding: '6px 8px',
					borderRadius: theme.shape.borderRadius,
					transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
						duration: theme.transitions.duration.short
					}),
					color: theme.palette.primary.main,
					'&:hover': {
						textDecoration: 'none',
						// backgroundColor: alpha(theme.palette.text.primary, theme.palette.action.hoverOpacity),
						// Reset on touch devices, it doesn't add specificity
						'@media (hover: none)': {
							backgroundColor: 'transparent'
						},
						backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity)
					},
					'&:disabled': {
						color: theme.palette.action.disabled,
						pointerEvents: 'none',
						cursor: 'default'
					}
				},
				'& .uppy-dashboard-icon-button': {
					textAlign: 'center',
					flex: '0 0 auto',
					borderRadius: '50%',
					overflow: 'visible', // Explicitly set the default value to solve a bug on IE11.
					color: theme.palette.action.active,
					transition: theme.transitions.create('background-color', {
						duration: theme.transitions.duration.shortest
					}),
					padding: '12px',
					fontSize: theme.typography.pxToRem(28),
					'&:hover': {
						backgroundColor: alpha(theme.palette.action.active, theme.palette.action.hoverOpacity),
						'@media (hover: none)': {
							backgroundColor: 'transparent'
						}
					},
					'&.edgeEnd': {
						marginRight: '-12px'
					}
				},
				'& .uppy-dashboard-svg-icon': {
					userSelect: 'none',
					width: '1em',
					height: '1em',
					display: 'inline-block',
					fill: 'currentColor',
					flexShrink: 0,
					fontSize: theme.typography.pxToRem(24),
					transition: theme.transitions.create('fill', {
						duration: theme.transitions.duration.shorter
					})
				}
				// endregion
			})}
		/>
	);
}

export default UppyDashboard;
