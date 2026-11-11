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
 * Pass a `createIntl` options object, or nothing. `locale` defaults to `'en'`.
 *   createTestIntl()
 *   createTestIntl({ messages: { 'org.example.limit': 'Translated limit' }, locale: 'es' })
 *
 * @param {Partial<import('react-intl').IntlConfig>} [options]
 * @returns {import('react-intl').IntlShape}
 */
export function createTestIntl(options = {}) {
	const baseIntl = createIntl({
		locale: 'en',
		messages: {},
		onError: () => undefined,
		...options
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
