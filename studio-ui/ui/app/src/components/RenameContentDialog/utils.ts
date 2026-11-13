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

/**
 * True when `name` is longer than `maxLength`. Evaluated against the current field value as soon as
 * the dialog opens (including an unchanged legacy name). That surfaces the error until the user
 * shortens the name; `htmlInput.maxLength` is only a typing guard and does not resolve this.
 */
export function exceedsRenameMaxLength(name: string, maxLength?: number | null): boolean {
	return maxLength != null && name.length > maxLength;
}

/**
 * Gets the name of the content item by removing the file extension (`.xml` if the item is a component or `index.xml` if page).
 * The function checks if the input string represents a page (contains '/index.xml').
 * - If it is a page, it removes '/index.xml' from the string.
 * - Otherwise, it removes '.xml' from the string.
 *
 * @param {string} value - The file path or name to process.
 * @returns {string} - The stripped value without the file extension.
 */
export function getItemName(value: string): string {
	const isPage = value.includes('/index.xml');
	return isPage ? value.replace('/index.xml', '') : value.replace('.xml', '');
}
