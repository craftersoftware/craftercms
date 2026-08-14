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

import Person from '../models/Person';
import { alpha } from '@mui/material/styles';

/**
 * Converts a string separated by dashes into a
 * camelCase equivalent. For instance, 'foo-bar'
 * would be converted to 'fooBar'.
 **/
export function camelize(str: string) {
	return str.replace(/-+(.)?/g, function (match, chr) {
		return chr ? chr.toUpperCase() : '';
	});
}

/**
 * Capitalizes the first letter of a string and down-cases all the others.
 **/
export function capitalize(str: string): string {
	return `${str.charAt(0).toUpperCase()}${str.substr(1)}`;
}

/**
 * Converts a camelized string into a series of words separated by an underscore (_).
 **/
export function underscore(str: string) {
	return str
		.replace(/::/g, '/')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
		.replace(/([a-z\d])([A-Z])/g, '$1_$2')
		.replace(/-/g, '_')
		.toLowerCase();
}

/**
 * Replaces every instance of the underscore character "_" by a dash "-".
 **/
export function dasherize(str: string) {
	return str.replace(/_/g, '-');
}

export function removeSpaces(str: string) {
	return str.replace(/\s+/g, '');
}

export function removeLastPiece(str: string, splitChar: string = '.'): string {
	return (str = `${str}`).substr(0, str.lastIndexOf(splitChar));
}

export function popPiece(str: string, splitChar: string = '.'): string {
	return String(str).split(splitChar).pop();
}

export function isJSON(str: string): boolean {
	throw new Error('[isJSON] Not implemented.');
}

export function hasUppercaseChars(str: string) {
	return /[A-Z]/.test(str);
}

export function getInitials(str: string): string;
export function getInitials(person: Person): string;
export function getInitials(str: string | Person): string {
	if (!str) {
		return '';
	} else if (typeof str === 'string') {
		return (str ?? '')
			.split(' ')
			.map((str) => str.charAt(0))
			.join('')
			.toUpperCase();
	} else {
		return `${str.firstName.charAt(0)}${str.lastName.charAt(0)}`.toUpperCase();
	}
}

export function formatBytes(bytes: number, decimals: number = 2) {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function isBlank(str: string): boolean {
	return (str ?? '').trim() === '';
}

export function dataUriToBlob(dataURI: string) {
	// convert base64 to raw binary data held in a string
	// doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
	const byteString = atob(dataURI.split(',')[1]);

	// separate out the mime component
	const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

	// write the bytes of the string to an ArrayBuffer
	const ab = new ArrayBuffer(byteString.length);

	// create a view into the buffer
	const ia = new Uint8Array(ab);

	// set the bytes of the buffer to the correct values
	for (let i = 0; i < byteString.length; i++) {
		ia[i] = byteString.charCodeAt(i);
	}

	// write the ArrayBuffer to a blob, and you're done
	const blob = new Blob([ab], { type: mimeString });
	return blob;
}

export function fileNameFromPath(path: string) {
	return path.substr(path.lastIndexOf('/') + 1).replace(/\.xml/, '');
}

export function escapeHTML(str: string): string {
	const element = document.createElement('textarea');
	element.textContent = str;
	return element.innerHTML;
}

export function unescapeHTML(html: string): string {
	const element = document.createElement('textarea');
	element.innerHTML = html;
	return element.textContent;
}

export function legacyEscapeXml(value: string): string {
	if (typeof value === 'string') {
		return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
	return value;
}

export function legacyUnescapeXml(value: string): string {
	if (typeof value === 'string') {
		return value
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&');
	}
	return value;
}

export function bytesToSize(bytes: number, separator: string = '') {
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes === 0) return 'n/a';
	const i = parseInt(`${Math.floor(Math.log(bytes) / Math.log(1024))}`, 10);
	if (i === 0) return `${bytes}${separator}${sizes[i]}`;
	return `${(bytes / 1024 ** i).toFixed(1)}${separator}${sizes[i]}`;
}

/**
 * Removes double slashes from urls
 * @param url {string} The URL to clean up
 */
export function ensureSingleSlash(url: string): string {
	return /^(http|https):\/\//g.test(url) ? url.replace(/([^:]\/)\/+/g, '$1') : url.replace(/\/+/g, '/');
}

/**
 * True when the value is already a loadable absolute/remote media URL (http(s), data, or blob).
 * Site-relative paths like `/static-assets/...` return false.
 */
export function isExternalMediaUrl(url: string): boolean {
	if (!url) return false;
	return /^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:');
}

/**
 * Resolves a media field value for preview / fetch / download.
 * Absolute/remote URLs are returned as-is; site paths are prefixed with `guestBase` (FE1 image-picker parity).
 */
export function resolveMediaUrl(guestBase: string, value: string): string {
	if (!value) return value;
	if (isExternalMediaUrl(value)) {
		return ensureSingleSlash(value);
	}
	return ensureSingleSlash(`${guestBase}${value}`);
}

export function getSimplifiedVersion(version: string, options: { minor?: boolean; patch?: boolean } = {}) {
	if (!version) {
		return version;
	}
	const { minor = true, patch = false } = options;
	const pieces = version.split('.');
	!patch && pieces.pop();
	!minor && pieces.pop();
	return pieces.join('.');
}

export function preFill(str: string | number, minLength: number = 2, char: string = '0'): string {
	str = `${str}`;
	return str.length >= minLength ? str : `${new Array(minLength - str.length).fill(char).join('')}${str}`;
}

export function postFill(str: string | number, minLength: number = 2, char: string = '0'): string {
	str = `${str}`;
	return str.length >= minLength ? str : `${str}${new Array(minLength - str.length).fill(char).join('')}`;
}

export const isSimple = (str: string | number, separator = '.') => String(str).split(separator).length === 1;

export const isSymmetricCombination = (string1: string | number, string2: string | number, separator = '.') =>
	String(string1).split(separator).length === String(string2).split(separator).length;

export function stripCData(str: string): string {
	return str.replace(/<!\[CDATA\[|\]\]>/gi, '');
}

export function toColor(str: string, alphaValue?: number) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	let color = '#';
	for (let value: number, j = 0; j < 3; j++) {
		value = (hash >> (j * 8)) & 0xff;
		color += ('00' + value.toString(16)).substr(-2);
	}
	if (alphaValue) {
		color = alpha(color, alphaValue);
	}
	return color;
}

export const replaceAccentedVowels = (input) => {
	const accentsMap = {
		á: 'a',
		é: 'e',
		í: 'i',
		ó: 'o',
		ú: 'u',
		Á: 'A',
		É: 'E',
		Í: 'I',
		Ó: 'O',
		Ú: 'U',
		à: 'a',
		è: 'e',
		ì: 'i',
		ò: 'o',
		ù: 'u',
		À: 'A',
		È: 'E',
		Ì: 'I',
		Ò: 'O',
		Ù: 'U',
		â: 'a',
		ê: 'e',
		î: 'i',
		ô: 'o',
		û: 'u',
		Â: 'A',
		Ê: 'E',
		Î: 'I',
		Ô: 'O',
		Û: 'U',
		ä: 'a',
		ë: 'e',
		ï: 'i',
		ö: 'o',
		ü: 'u',
		Ä: 'A',
		Ë: 'E',
		Ï: 'I',
		Ö: 'O',
		Ü: 'U'
	};
	return input.replace(/[áéíóúÁÉÍÓÚàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜ]/g, (match) => accentsMap[match]);
};

export function isPath(str: string): boolean {
	return /^\/(?:[^/]+\/)*[^/]*$/.test(str);
}

export function isUUID(str: string): boolean {
	return /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(str);
}

export function isEmpty(str: string): boolean {
	if (str == null) return true;
	return str.trim() === '';
}

export function toBooleanString(bool: boolean): 'true' | 'false' {
	return bool ? 'true' : 'false';
}

/**
 * Counts the number of lines in a given text based on the break lines it has.
 *
 * @param text - The text to count lines in.
 * @returns The number of lines in the text. Returns 0 if the text is empty or undefined.
 */
export function countLines(text: string): number {
	if (!text) {
		return 0;
	}
	return text.split('\n').length;
}
