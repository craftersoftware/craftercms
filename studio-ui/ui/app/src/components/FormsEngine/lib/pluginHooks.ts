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

const frozen = new WeakSet<object>();

/**
 * Freezes `value` and everything reachable from it, once. Plugin hooks receive the form's own definitions
 * (`field`, `contentTypesById`), and their types say read-only. This makes that true at runtime, so a hook can't
 * change what every other field of that type sees, such as turning off a required check.
 * Content types read from the store are already frozen, so this mostly just marks them.
 */
export function deepFreeze<T>(value: T): T {
	if (value === null || typeof value !== 'object' || frozen.has(value)) return value;
	frozen.add(value);
	Object.values(value).forEach(deepFreeze);
	return Object.freeze(value);
}

/** A definition handed to a plugin hook, read-only at runtime. See {@link deepFreeze}. */
export function freezeForPlugin<T extends object>(value: T): Readonly<T> {
	return deepFreeze(value);
}
