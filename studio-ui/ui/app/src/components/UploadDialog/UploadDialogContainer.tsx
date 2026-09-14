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

import { getResponseError as getResponseErrorUtil, UploadDialogContainerProps } from './util';
import { useIntl } from 'react-intl';
import { useSelection } from '../../hooks/useSelection';
import React, { useEffect } from 'react';
import { Uppy, type XHRUploadOptions as UppyXHRUploadOptions, XHRUpload } from 'uppy';
import { translations } from './translations';
import { getBulkUploadUrl } from '../../services/content';
import { getGlobalHeaders } from '../../utils/ajax';
import { useUnmount } from '../../hooks/useUnmount';
import { IconButton } from '@mui/material';
import CloseIconRounded from '@mui/icons-material/CloseRounded';
import DialogBody from '../DialogBody/DialogBody';
import UppyDashboard from '../UppyDashboard';
import useSiteUIConfig from '../../hooks/useSiteUIConfig';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { nnou } from '../../utils/object';

const mixHeaders = (headers: Record<string, any>) => Object.assign({}, getGlobalHeaders(), headers);

export function UploadDialogContainer(props: UploadDialogContainerProps) {
	const { formatMessage } = useIntl();
	const expiresAt = useSelection((state) => state.auth.expiresAt);
	const { upload } = useSiteUIConfig();
	// region const { ... } = props
	const {
		site,
		path,
		onClose,
		onClosed,
		maxSimultaneousUploads,
		onMinimized,
		hasPendingChanges,
		setPendingChanges,
		headers,
		method = 'put',
		meta,
		allowedMetaFields,
		endpoint,
		useFormData = true,
		fieldName = 'file',
		onFileAdded,
		onUploadSuccess,
		validateStatus,
		getResponseData,
		getResponseError,
		successfulUploadButton,
		showRemoveButtonAfterComplete = false,
		autoProceed = true
	} = props;
	// endregion
	const propRefs = useUpdateRefs({
		headers,
		meta,
		allowedMetaFields,
		onFileAdded,
		onUploadSuccess,
		validateStatus,
		getResponseData,
		getResponseError
	});

	// TODO: Currently unknown if recreating the Uppy instance works properly down the component tree.
	const uppy = React.useMemo(() => {
		// Want to avoid memo renewal on every render due to these various props not being memoized up in the tree.
		const {
			headers,
			allowedMetaFields,
			validateStatus,
			getResponseData,
			getResponseError,
			onFileAdded,
			onUploadSuccess,
			meta
		} = propRefs.current;
		const xhrOptions: UppyXHRUploadOptions & {
			validateStatus?(statusCode: number, responseText: string, response: unknown): boolean;
		} = {
			endpoint: endpoint ?? getBulkUploadUrl(site, path),
			formData: useFormData,
			fieldName,
			limit: maxSimultaneousUploads ? maxSimultaneousUploads : upload.maxSimultaneousUploads,
			timeout: upload.timeout,
			headers: mixHeaders(headers),
			method,
			onAfterResponse: (response) => {
				if (response.status !== 200) {
					if (nnou(getResponseError)) {
						getResponseError(response);
					} else {
						throw getResponseErrorUtil(response.responseText, formatMessage);
					}
				}
				getResponseData && getResponseData(response);
			}
		};
		allowedMetaFields && (xhrOptions.allowedMetaFields = allowedMetaFields);
		// These (validateStatus, getResponseData, getResponseError) are unlikely to have closures inside them that would go stale.
		validateStatus && (xhrOptions.validateStatus = validateStatus);
		const instance = new Uppy({
			meta: Object.assign({ site }, meta),
			locale: {
				strings: { noDuplicates: formatMessage(translations.noDuplicates) },
				pluralize: (n: number) => (n === 1 ? 0 : 1)
			},
			onBeforeFileAdded: () => {
				// There's a default duplicate check in Uppy (if an item was already added in current session). We're overriding this behavior to handle the duplicate files
				// later when the file is added to the list of files to upload.
				return true;
			}
		}).use(XHRUpload, xhrOptions);
		onFileAdded &&
			instance.on('file-added', (file) => {
				propRefs.current.onFileAdded({ file, uppy: instance });
			});
		onUploadSuccess &&
			instance.on('upload-success', (file, response) => {
				propRefs.current.onUploadSuccess({ file, response });
			});
		return instance;
	}, [
		propRefs,
		endpoint,
		site,
		path,
		useFormData,
		fieldName,
		maxSimultaneousUploads,
		upload.maxSimultaneousUploads,
		upload.timeout,
		method,
		formatMessage
	]);

	useUnmount(() => {
		uppy.destroy();
		onClosed?.();
	});

	useEffect(() => {
		const handleBeforeUpload = () => {
			return formatMessage(translations.uploadInProgress);
		};

		if (hasPendingChanges) {
			window.onbeforeunload = handleBeforeUpload;
		} else {
			window.onbeforeunload = null;
		}

		return () => {
			window.onbeforeunload = null;
		};
	}, [hasPendingChanges, formatMessage]);

	useEffect(() => {
		const plugin = uppy.getPlugin('XHRUpload');
		plugin.setOptions({ headers: mixHeaders(headers) });
	}, [expiresAt, uppy, headers]);

	return (
		<>
			<IconButton style={{ display: 'none' }} size="large" aria-label={formatMessage({ defaultMessage: 'Close' })}>
				<CloseIconRounded />
			</IconButton>
			<DialogBody sx={{ minHeight: '60vh', padding: 0 }}>
				<UppyDashboard
					uppy={uppy}
					site={site}
					path={path}
					onMinimized={onMinimized}
					onPendingChanges={setPendingChanges}
					onClose={onClose}
					title={formatMessage(translations.title)}
					maxActiveUploads={upload.maxActiveUploads}
					options={{ successfulUploadButton, showRemoveButtonAfterComplete, autoProceed }}
				/>
			</DialogBody>
		</>
	);
}
