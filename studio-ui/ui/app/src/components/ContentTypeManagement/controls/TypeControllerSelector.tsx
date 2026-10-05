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

import OutlinedInput from '@mui/material/OutlinedInput';
import React, { useEffect, useId, useState } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import IconButton from '@mui/material/IconButton';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useStableFormContext } from '../../FormsEngine/lib/formsEngineContext';
import { CONTENT_TYPES_BASE_PATH, editTypeController, TypeBuilderControl } from '../utils';
import { getPropertyValue } from '../../FormsEngine/lib/formUtils';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { checkPathExistence, deleteItems } from '../../../services/content';
import { setJsControllerEnabled } from '../../../services/contentTypes';
import { ensureSingleSlash } from '../../../utils/string';
import { nanoid } from 'nanoid';
import { popDialog } from '../../../state/actions/dialogStack';
import { updateContentTypeJsController } from '../../../state/actions/preview';
import { pushConfirmDialog, pushErrorDialog } from '../../../utils/system';
import { clearFormControllerCache } from '../../FormsEngine/formControllers/loader';

export interface TypeControllerSelectorProps extends TypeBuilderControl {
	value: boolean;
}

/**
 * Allows the selection and edition of a controller for a content type.
 * If the controller file does not exist, the editor opens empty and creates it on Save.
 * Saving or deleting `form-controller.js` also writes `<controller>` on the saved
 * form-definition, so FE2 follows the file even if pending Type Builder edits are discarded.
 * The draft flag is committed after that write succeeds. A failed write keeps the previous
 * draft value. An unsaved type (write returns false) still keeps the draft for its first save.
 * JavaScript delete writes the flag off before removing the file.
 */
export function TypeControllerSelector(props: TypeControllerSelectorProps) {
	const { field, value, autoFocus, setValue } = props;
	const htmlId = useId();
	const dispatch = useDispatch();
	const siteId = useActiveSiteId();
	const { formatMessage } = useIntl();
	const stableFormContext = useStableFormContext();
	// stableFormContext.originalValues is of type `ContentType`, and `id` is the current contentTypeId.
	const contentTypeId: string = stableFormContext.originalValues.id as string;
	const type: 'javascript' | 'groovy' = getPropertyValue(field.properties, 'type', 'javascript') as
		| 'javascript'
		| 'groovy';
	const isJavascript = type === 'javascript';
	const fileName = isJavascript ? 'form-controller.js' : 'controller.groovy';
	const controllerPath = ensureSingleSlash(`${CONTENT_TYPES_BASE_PATH}${contentTypeId}/${fileName}`);
	const [groovyExists, setGroovyExists] = useState(false);

	useEffect(() => {
		if (isJavascript) return;
		const sub = checkPathExistence(siteId, controllerPath).subscribe({
			next: setGroovyExists,
			error: () => setGroovyExists(false)
		});
		return () => sub.unsubscribe();
	}, [isJavascript, siteId, controllerPath]);

	const hasFile = isJavascript ? Boolean(value) : groovyExists;

	const persistJsControllerEnabled = (enabled: boolean, onPersisted?: () => void) => {
		const priorValue = value;
		setJsControllerEnabled(siteId, contentTypeId, enabled).subscribe({
			next: (written) => {
				// `false` means the type has no saved definition yet. Keep the draft flag
				// so the first type save can store it. Existing types commit only after the write.
				setValue(enabled);
				if (written) {
					dispatch(updateContentTypeJsController({ contentTypeId, enabled }));
				}
				onPersisted?.();
			},
			error: ({ response }) => {
				setValue(priorValue);
				dispatch(pushErrorDialog({ props: { error: response?.response } }));
			}
		});
	};

	const onEditController = () => {
		editTypeController(CONTENT_TYPES_BASE_PATH, contentTypeId, dispatch, type, () => {
			if (isJavascript) {
				clearFormControllerCache(siteId, contentTypeId);
				persistJsControllerEnabled(true);
			} else {
				setGroovyExists(true);
			}
		});
	};

	const performDelete = () => {
		checkPathExistence(siteId, controllerPath).subscribe({
			next: (exists) => {
				if (!isJavascript) {
					if (!exists) {
						setGroovyExists(false);
						return;
					}
					const title = formatMessage({ defaultMessage: 'Delete Controller' });
					const comment = formatMessage({ defaultMessage: 'Deleting controller {fileName}' }, { fileName });
					deleteItems(siteId, [controllerPath], title, comment).subscribe({
						next: () => {
							setGroovyExists(false);
						},
						error: ({ response }) => {
							dispatch(pushErrorDialog({ props: { error: response?.response } }));
						}
					});
					return;
				}
				if (!exists) {
					clearFormControllerCache(siteId, contentTypeId);
					persistJsControllerEnabled(false);
					return;
				}
				const title = formatMessage({ defaultMessage: 'Delete Controller' });
				const comment = formatMessage({ defaultMessage: 'Deleting controller {fileName}' }, { fileName });
				persistJsControllerEnabled(false, () => {
					deleteItems(siteId, [controllerPath], title, comment).subscribe({
						next: () => {
							clearFormControllerCache(siteId, contentTypeId);
						},
						error: ({ response }) => {
							dispatch(pushErrorDialog({ props: { error: response?.response } }));
						}
					});
				});
			},
			error: ({ response }) => {
				dispatch(pushErrorDialog({ props: { error: response?.response } }));
			}
		});
	};

	const onDeleteController = () => {
		const dialogId = nanoid();
		dispatch(
			pushConfirmDialog({
				id: dialogId,
				props: {
					title: formatMessage({ defaultMessage: 'Delete Controller' }),
					body: formatMessage({ defaultMessage: 'Delete "{fileName}"? This action cannot be undone.' }, { fileName }),
					onCancel: () => dispatch(popDialog({ id: dialogId })),
					onOk: () => {
						dispatch(popDialog({ id: dialogId }));
						performDelete();
					}
				}
			})
		);
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			<OutlinedInput
				autoFocus={autoFocus}
				id={htmlId}
				fullWidth
				value={hasFile ? fileName : ''}
				disabled
				endAdornment={
					<>
						{hasFile && (
							<Tooltip title={<FormattedMessage defaultMessage="Delete Controller" />}>
								<IconButton onClick={onDeleteController}>
									<DeleteOutlineRoundedIcon />
								</IconButton>
							</Tooltip>
						)}
						<Tooltip title={<FormattedMessage defaultMessage="Edit Controller" />}>
							<IconButton onClick={onEditController}>
								<EditRoundedIcon />
							</IconButton>
						</Tooltip>
					</>
				}
			/>
		</FormsEngineField>
	);
}

export default TypeControllerSelector;
