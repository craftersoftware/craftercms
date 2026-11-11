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

import { createIntl } from 'react-intl';

/**
 * Keys of an options argument. Anything else is read as a map of message id to translation.
 * A message id that equals one of these names would be read as an option, which real ids never do.
 */
const optionKeys = new Set([
	'messages',
	'locale',
	'defaultLocale',
	'formats',
	'timeZone',
	'onError',
	'defaultRichTextElements',
	'textComponent'
]);

/**
 * A react-intl instance for render tests. Pass it to `RawIntlProvider`, or give `formatMessage` to code
 * that takes one.
 *
 * `formatMessage` uses the default message as the id of a descriptor that has none. react-intl throws on
 * a missing id. The test loader runs babel-plugin-formatjs on app sources, so every message written in
 * the app already has an id. Descriptors built at run time, such as the messages a plugin validator or a
 * form controller returns, can still lack one, and the app normalizes those before it formats them.
 * This fallback gives tests, and code that formats them directly, the same safety net. It also covers a
 * branch whose test loader does not have the formatjs transform yet. `onError` is silent, so a missing
 * translation does not print.
 *
 * Call it with nothing, with a map of message id to translation, or with options. Both forms take the
 * same options, so these are equivalent:
 *   createTestIntl({ 'org.example.limit': 'Translated limit' })
 *   createTestIntl({ messages: { 'org.example.limit': 'Translated limit' } })
 *   createTestIntl({ 'org.example.limit': 'Translated limit' }, { locale: 'es' })
 * Options are react-intl's `createIntl` config: `locale` (default 'en'), `messages`, `onError` and the rest.
 *
 * @param {Record<string, string> | import('react-intl').IntlConfig | undefined} [messagesOrOptions]
 * @param {Partial<import('react-intl').IntlConfig>} [options]
 * @returns {import('react-intl').IntlShape}
 */
export function createTestIntl(messagesOrOptions, options) {
	const first = messagesOrOptions ?? {};
	const firstIsOptions = Object.keys(first).some((key) => optionKeys.has(key));
	const config = firstIsOptions ? { ...first, ...options } : { messages: first, ...options };
	const baseIntl = createIntl({
		locale: 'en',
		messages: {},
		onError: () => undefined,
		...config
	});
	return {
		...baseIntl,
		formatMessage: (descriptor, values, formatOptions) =>
			baseIntl.formatMessage(
				{ ...descriptor, id: descriptor.id ?? String(descriptor.defaultMessage) },
				values,
				formatOptions
			)
	};
}

export default createTestIntl;
