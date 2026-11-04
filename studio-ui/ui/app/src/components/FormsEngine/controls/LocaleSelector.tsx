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

import { ControlProps } from '../types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSiteLocales } from '../../../services/translation';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { extractErrorPayload } from '../../../utils/ajax';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import FormsEngineField from '../components/FormsEngineField';
import MenuItem from '@mui/material/MenuItem';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import Skeleton from '@mui/material/Skeleton';
import { ApiResponse } from '../../../models';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { FormattedMessage } from 'react-intl';
import { isFieldReadOnly } from '../lib/formUtils';
import { Subscription } from 'rxjs';

export type LocaleSelectorProps = ControlProps<string>;

export function LocaleSelector(props: LocaleSelectorProps) {
	const { field, value, setValue, autoFocus, readonly: formReadonly } = props;
	const [isFetching, setIsFetching] = useState(false);
	const [localeData, setLocaleData] = useState<{
		localeCodes: {
			code: string;
			label: string;
		}[];
		defaultLocaleCode: string;
	}>();
	const siteId = useActiveSiteId();
	const handleChange = (event: SelectChangeEvent) => setValue(event.target.value);
	const [error, setError] = useState<ApiResponse | null>(null);
	const readonly: boolean = isFieldReadOnly(field, formReadonly);
	const refs = useUpdateRefs({ value, readonly });
	const fetchSubscriptionRef = useRef<Subscription | null>(null);

	const fetchLocales = useCallback(() => {
		fetchSubscriptionRef.current?.unsubscribe();
		setIsFetching(true);
		setError(null);
		setLocaleData(undefined);
		const subscription = fetchSiteLocales(siteId).subscribe({
			next: (config) => {
				const localeCodes = config?.localeCodes ?? [];
				const defaultLocaleCode = config?.defaultLocaleCode;
				setIsFetching(false);
				if (localeCodes.length) {
					setLocaleData({
						localeCodes: localeCodes.map((code) => ({
							code,
							label: getLocaleLabel(code)
						})),
						defaultLocaleCode
					});
					if (!refs.current.value && defaultLocaleCode && !refs.current.readonly) {
						setValue(defaultLocaleCode);
					}
				}
			},
			error: (e) => {
				setIsFetching(false);
				setError(extractErrorPayload(e));
			}
		});
		fetchSubscriptionRef.current = subscription;
		return subscription;
	}, [refs, setValue, siteId]);

	useEffect(() => {
		fetchLocales();
		return () => {
			fetchSubscriptionRef.current?.unsubscribe();
			fetchSubscriptionRef.current = null;
		};
	}, [fetchLocales]);

	if (!isFetching && !localeData && !error) return null;

	return (
		<FormsEngineField field={field}>
			{isFetching ? (
				<Skeleton variant="rounded" width="100%" height={50} />
			) : error ? (
				<Alert
					variant="outlined"
					severity="error"
					sx={{ border: 'none' }}
					action={
						<Button color="inherit" size="small" onClick={fetchLocales}>
							<FormattedMessage defaultMessage="Retry" />
						</Button>
					}
				>
					{error.message || <FormattedMessage defaultMessage="Unable to load locales." />}
					{error.remedialAction ? `${error.message ? '. ' : ' '}${error.remedialAction}` : ''}
				</Alert>
			) : (
				<Select value={value} onChange={handleChange} autoFocus={autoFocus} disabled={readonly}>
					{localeData.localeCodes.map((locale) => (
						<MenuItem key={locale.code} value={locale.code}>
							{locale.label}
						</MenuItem>
					))}
				</Select>
			)}
		</FormsEngineField>
	);
}

function getLocaleLabel(localeCode: string) {
	const normalized = localeCode.replace(/_/g, '-');
	let languageLabel: string;
	let regionLabel: string | undefined;
	let lang: string;
	let region: string | undefined;
	let locale: string;
	try {
		const parsed = new Intl.Locale(normalized);
		lang = parsed.language;
		region = parsed.region;
		locale = parsed.toString();
		const languageNames = new Intl.DisplayNames([locale], { type: 'language' });
		languageLabel = languageNames.of(lang) || lang;
		if (region) {
			const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
			regionLabel = regionNames.of(region.toUpperCase()) || region.toUpperCase();
		}
	} catch {
		return normalized || localeCode;
	}
	return regionLabel ? `${languageLabel} (${regionLabel})` : languageLabel;
}

export default LocaleSelector;
