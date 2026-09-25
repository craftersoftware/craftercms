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

import { createIntl, createIntlCache, IntlShape, MessageDescriptor } from 'react-intl';
import { Subject } from 'rxjs';
import TranslationOrText from '../models/TranslationOrText';
import { nou } from './object';
import { FormatXMLElementFn, PrimitiveType } from 'intl-messageformat';
import { ReactNode } from 'react';
import LookupTable from '../models/LookupTable';
import { getLocalStorageItem, setLocalStorageItem } from './storage';

export type BundledLocaleCodes = 'en' | 'es' | 'de' | 'ko';

export type ImportsLookup = LookupTable<() => Promise<{ default: LookupTable<string> }>>;
const importsLookup: ImportsLookup = {
	de: () => import('../translations/de.json'),
	es: () => import('../translations/es.json'),
	ko: () => import('../translations/ko.json')
};

/* private */
let currentTranslations = { en: {} };

let fetchedLocales: Partial<Record<BundledLocaleCodes, boolean>> = { en: true };

/* private */
const intl$$ = new Subject<IntlShape>();

/* public */
export const intl$ = intl$$.asObservable();

/* private */
let intl = createIntl({ locale: 'en', messages: currentTranslations.en }, createIntlCache());

export function getCurrentLocale(username?: string): string {
	const user = username ?? getLocalStorageItem('username');
	return getStoredLanguage(user) || 'en';
}

export function getStoredLanguage(username?: string): string {
	return (
		(username ? getLocalStorageItem(buildStoredLanguageKey(username)) : null) ??
		getLocalStorageItem(`crafterStudioLanguage`)
	);
}

if (getCurrentLocale() !== 'en') {
	createIntlInstance(getCurrentLocale()).then((newIntl) => {
		intl = newIntl;
		intl$$.next(newIntl);
	});
}

async function fetchLocale(locale: string, imports: ImportsLookup): Promise<LookupTable<string>> {
	const importFn = imports[locale];
	if (!importFn) {
		return {};
	}
	const translations = await importFn();
	return translations.default;
}

export async function createIntlInstance(
	localeCode: string,
	imports: ImportsLookup = importsLookup
): Promise<IntlShape> {
	if (
		!fetchedLocales[localeCode] &&
		// Nothing to fetch point if we don't have the locale
		['de', 'es', 'ko'].includes(localeCode)
	) {
		let fetchedTranslations = await fetchLocale(localeCode as BundledLocaleCodes, imports);
		// Plugins may have added translations to a locale that hasn't been fetched.
		currentTranslations[localeCode] = { ...currentTranslations[localeCode], ...fetchedTranslations };
		fetchedLocales[localeCode] = true;
	}
	return createIntl(
		{
			locale: localeCode,
			messages: currentTranslations[localeCode] || currentTranslations.en
		},
		createIntlCache()
	);
}

export function augmentTranslations(translations: { [localeCode: string]: object }): void {
	if (translations) {
		let currentLocale = intl.locale;
		let currentLocaleChanged = false;
		Object.entries(translations).forEach(([localeCode, translations]) => {
			currentTranslations[localeCode] = { ...currentTranslations[localeCode], ...translations };
			currentLocale === localeCode && (currentLocaleChanged = true);
		});
		if (currentLocaleChanged) {
			createIntlInstance(currentLocale).then((newIntl) => {
				intl = newIntl;
				intl$$.next(newIntl);
			});
		}
	}
}

export function getTranslation(
	key: string,
	table: Record<string, MessageDescriptor>,
	formatMessage: IntlShape['formatMessage']
): string {
	return formatMessage(
		table[key] || {
			id: 'translationNotAvailable',
			defaultMessage: key || '(check configuration)'
		}
	);
}

export function getPossibleTranslation(
	titleOrDescriptor: TranslationOrText,
	formatMessage: IntlShape['formatMessage'],
	// TODO: Fix FormatXMLElementFn generics
	values?: Record<string, PrimitiveType | FormatXMLElementFn<any, any>>
): string | ReactNode[] {
	if (nou(titleOrDescriptor)) {
		return null;
	}
	return typeof titleOrDescriptor === 'object' ? formatMessage(titleOrDescriptor, values) : titleOrDescriptor;
}

export function getCurrentIntl(): IntlShape {
	return intl;
}

export function buildStoredLanguageKey(username: string): string {
	return `${username}_crafterStudioLanguage`;
}

export function setStoredLanguage(language: string, username?: string): void {
	// Prevent `null` or `undefined`, or even `"""` from being stored.
	if (language) {
		username && setLocalStorageItem(buildStoredLanguageKey(username), language);
		setLocalStorageItem('crafterStudioLanguage', language);
	}
}

declare global {
	interface DocumentEventMap {
		setlocale: CustomEvent<string>;
	}
}

export function dispatchLanguageChange(language: string): void {
	if (typeof document === 'undefined') {
		return;
	}
	let event = new CustomEvent('setlocale', { detail: language });
	document.dispatchEvent(event);
}

if (typeof document !== 'undefined') {
	document.addEventListener(
		'setlocale',
		async (e) => {
			if (e.detail && e.detail !== intl.locale) {
				intl = await createIntlInstance(e.detail);
				document.documentElement.setAttribute('lang', e.detail);
				intl$$.next(intl);
			}
		},
		false
	);
}
