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
import FormHelperText from '@mui/material/FormHelperText';
import React, { useContext, useEffect, useId, useRef, useState } from 'react';
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
import { TypeControllerFlagContext } from '../typeControllerFlagContext';
import { catchError, defer, EMPTY, finalize, type Observable, switchMap, tap, throwError } from 'rxjs';

export interface TypeControllerSelectorProps extends TypeBuilderControl {
	value: boolean;
}

/**
 * Allows the selection and edition of a controller for a content type.
 * If the controller file does not exist, the editor opens empty and creates it on Save.
 * Saving or deleting `form-controller.js` also writes `<controller>` on the saved
 * form-definition, so FE2 follows the file even if pending Type Builder edits are discarded.
 * The draft flag is committed after that write succeeds. A failed write keeps the previous
 * draft value. `false` means the form-definition is missing (unsaved type), not a write failure.
 * JavaScript delete disables the controller first and removes the file only after that succeeds.
 * If the file delete then fails, the controller stays disabled and the field shows that the file
 * is still there so the author can retry. Groovy delete only removes `controller.groovy`.
 * Edit and Delete stay disabled while a flag write, existence check, or delete is in flight.
 * A landed flag write is also reported through {@link TypeControllerFlagContext}, so the Type
 * Builder working copy follows it even if this form closed while the code editor was open.
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
	const [jsFileExists, setJsFileExists] = useState(false);
	// True until the first existence check settles, so Edit/Delete cannot race that read.
	const [busy, setBusy] = useState(true);
	// Flag writes can outlive the render that started them (the code editor stays open).
	// Read the draft through refs so a failed write restores the value from when the write began.
	const valueRef = useRef(value);
	const setValueRef = useRef(setValue);
	valueRef.current = value;
	setValueRef.current = setValue;
	const typeControllerFlag = useContext(TypeControllerFlagContext);
	// Synchronous guard. `busy` lags a render, so a double-click would otherwise start two writes.
	const inFlight = useRef(false);
	// The editor can finish saving while a delete is in flight. Keep that flag write; do not drop it.
	const pending = useRef<Observable<unknown> | null>(null);

	useEffect(() => {
		let active = true;
		if (!inFlight.current) setBusy(true);
		const sub = checkPathExistence(siteId, controllerPath).subscribe({
			next: (exists) => {
				if (!active) return;
				if (isJavascript) setJsFileExists(exists);
				else setGroovyExists(exists);
				if (!inFlight.current) setBusy(false);
			},
			error: () => {
				if (!active) return;
				if (isJavascript) setJsFileExists(false);
				else setGroovyExists(false);
				if (!inFlight.current) setBusy(false);
			}
		});
		return () => {
			active = false;
			sub.unsubscribe();
		};
	}, [isJavascript, siteId, controllerPath]);

	const hasFile = isJavascript ? Boolean(value) || jsFileExists : groovyExists;
	const controllerDisabledWithFile = isJavascript && jsFileExists && !value;

	const showOperationError = (error: { response?: { response?: unknown } }) => {
		dispatch(pushErrorDialog({ props: { error: error?.response?.response } }));
	};

	const persistJsControllerEnabled = (enabled: boolean) => {
		const priorValue = valueRef.current;
		return setJsControllerEnabled(siteId, contentTypeId, enabled).pipe(
			tap((written) => {
				// `false` is only a missing form-definition. Write failures take the error path.
				setValueRef.current(enabled);
				// This form's atom is discarded if the form closed before the write landed.
				typeControllerFlag?.onJsControllerPersisted(enabled);
				if (written) {
					dispatch(updateContentTypeJsController({ contentTypeId, enabled }));
				}
			}),
			catchError((error) => {
				setValueRef.current(priorValue);
				return throwError(() => error);
			})
		);
	};

	// Not torn down on unmount: the code editor is minimizable and can save after this field is gone,
	// and an aborted flag write or delete would leave the form-definition and the file out of step.
	const runOperation = (operation: Observable<unknown>) => {
		if (inFlight.current) {
			pending.current = operation;
			return;
		}
		const begin = (nextOperation: Observable<unknown>) => {
			inFlight.current = true;
			setBusy(true);
			nextOperation
				.pipe(
					finalize(() => {
						const queued = pending.current;
						pending.current = null;
						if (queued) {
							begin(queued);
						} else {
							inFlight.current = false;
							setBusy(false);
						}
					})
				)
				.subscribe({ error: showOperationError });
		};
		begin(operation);
	};

	const onEditController = () => {
		if (busy || inFlight.current) return;
		editTypeController(CONTENT_TYPES_BASE_PATH, contentTypeId, dispatch, type, () => {
			if (!isJavascript) {
				setGroovyExists(true);
				return;
			}
			clearFormControllerCache(siteId, contentTypeId);
			// `defer` so a delete still queued ahead of this write records its result first.
			// The editor has already created the file; keep that visible even if the flag write fails.
			runOperation(
				defer(() => {
					setJsFileExists(true);
					return persistJsControllerEnabled(true);
				})
			);
		});
	};

	const performDelete = () => {
		const title = formatMessage({ defaultMessage: 'Delete Controller' });
		const comment = formatMessage({ defaultMessage: 'Deleting controller {fileName}' }, { fileName });
		runOperation(
			checkPathExistence(siteId, controllerPath).pipe(
				switchMap((exists) => {
					if (!isJavascript) {
						if (!exists) {
							setGroovyExists(false);
							return EMPTY;
						}
						return deleteItems(siteId, [controllerPath], title, comment).pipe(tap(() => setGroovyExists(false)));
					}
					if (!exists) {
						clearFormControllerCache(siteId, contentTypeId);
						return persistJsControllerEnabled(false).pipe(tap(() => setJsFileExists(false)));
					}
					// Disable first. The file is removed only after that write succeeds, so a failed
					// delete leaves the controller off and the file in place for a retry.
					return persistJsControllerEnabled(false).pipe(
						switchMap(() => deleteItems(siteId, [controllerPath], title, comment)),
						tap(() => {
							clearFormControllerCache(siteId, contentTypeId);
							setJsFileExists(false);
						})
					);
				})
			)
		);
	};

	const onDeleteController = () => {
		if (busy || inFlight.current) return;
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
								<IconButton onClick={onDeleteController} disabled={busy}>
									<DeleteOutlineRoundedIcon />
								</IconButton>
							</Tooltip>
						)}
						<Tooltip title={<FormattedMessage defaultMessage="Edit Controller" />}>
							<IconButton onClick={onEditController} disabled={busy}>
								<EditRoundedIcon />
							</IconButton>
						</Tooltip>
					</>
				}
			/>
			{controllerDisabledWithFile && (
				<FormHelperText sx={{ color: 'warning.main' }}>
					<FormattedMessage defaultMessage="Controller file exists but is disabled for this type" />
				</FormHelperText>
			)}
		</FormsEngineField>
	);
}

export default TypeControllerSelector;
