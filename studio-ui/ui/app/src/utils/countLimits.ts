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
 * Count-limit contract for repeating groups, node selectors, checkbox groups and XB.
 *
 * One meaning for every control. Where TB1 stores the limits is {@link countLimitStorage},
 * one entry per control. Parser, Type Builder load/save and the XML writer look that entry
 * up with {@link getCountLimitStorage}. They do not branch on the control type. A new
 * item-count control is a new table entry.
 *
 * A minimum of 0 or blank is no minimum. A maximum of 0, `*` or blank is no maximum.
 * Only positive integers are limits. Fractions, trailing junk and negatives count as blank.
 * When a stored value is unusable and nothing else applies, the limit is unset and
 * {@link countLimitsFromStorage} logs a warning naming the content type and field.
 *
 * At runtime every control uses `field.validations.minCount` / `maxCount`. Read them with
 * {@link countLimitValue}. Null, undefined and 0 are unlimited, so do not test the result
 * with truthiness. A positive `minCount` is the required marker (`isFieldRequired`). It is
 * not stored as a `required` constraint. The occurrence error is the only message.
 * Type Builder 2 strips `minCount` / `maxCount` on save. The editor check is not tied to the
 * control type. The descriptor field declares it as an `itemCount` validation,
 * `{ role: 'min' | 'max', partner?: '<other field id>' }`, and the form runs that validator
 * only when the validation is present. {@link isItemCountMinEditorValue},
 * {@link isItemCountMaxEditorValue} and {@link isItemCountRangeValid} are the only parsing
 * path: a maximum of 0 is rejected, and a minimum greater than the maximum is rejected.
 *
 * TODO: Normalize the XML so each limit has a single representation.
 */

export interface CountLimits {
	/** Absent when there is no minimum. */
	minCount?: number;
	/** Absent when there is no maximum. */
	maxCount?: number;
}

/** Virtual runtime keys. Type Builder 2 must not write these back into form-definition XML. */
export const virtualCountValidationIds = ['minCount', 'maxCount'] as const;

const repeatMaxDefault = '*';

/**
 * One place a bound is stored in TB1 XML.
 * `element` is a child of the field (`<minOccurs>`). The legacy field only has `minOccurs` and
 * `maxOccurs` element slots, so an element source must use one of those names.
 * `property` is `<property><name>`. `constraint` is `<constraint><name>`.
 */
export type CountLimitSource = 'element' | 'property' | 'constraint';

/**
 * One bound of one control.
 * `sources` is precedence order. {@link countLimitsFromStorage} applies it: a usable element
 * wins, and the first non-element source is the fallback. 0 and `*` do not fall through.
 * An invalid token does. A control that stored both a property and a constraint would need a
 * third slot; none of the current controls do, so the fallback is a single value.
 */
export interface CountLimitBound {
	kind: 'min' | 'max';
	/** Storage name. Also the Type Builder field id. */
	name: string;
	sources: readonly CountLimitSource[];
	/**
	 * Property `<type>` forced on parse and on save. Omitted to keep the type already stored
	 * (a node selector max stays `int`, so a stored 0 loads blank rather than `*`).
	 */
	propertyType?: 'int' | 'string';
	/** Create the property when the XML omitted it. Repeats always have both properties. */
	ensureProperty?: boolean;
	/**
	 * The Type Builder field is filled from virtual minCount/maxCount, not from a property.
	 * Unset uses {@link editorUnset}. A checkbox minimum is blank, not 0.
	 */
	editorFromVirtual?: boolean;
	editorUnset?: '' | 0 | '*';
	/** Write this constraint on save only when the limit is a positive integer. */
	writeConstraintWhenPositive?: boolean;
	/** XML `<type>` of that constraint. Checkbox `minSize` is `number`. */
	constraintType?: string;
}

/**
 * Storage for one control. Adding a control means adding an entry, not a type branch.
 * `stripConstraints` are removed when the form definition is parsed and omitted on save.
 * A repeat's stored `required` is not a minimum.
 */
export interface CountLimitControl {
	type: string;
	min?: CountLimitBound;
	max?: CountLimitBound;
	stripConstraints: readonly string[];
}

/**
 * The item-count storage contract.
 * Repeat: element wins over the same-named property. Save writes both, min as `int` (default `0`)
 * and max as `string` (default `*`). Node selector: `minSize` / `maxSize` properties only; a missing
 * property stays missing. Checkbox group: `minSize` constraint, no maximum; the editor shows
 * `minCount` (blank when unset, including a stored 0) and save writes the constraint only for a
 * positive integer.
 */
export const countLimitStorage: Record<string, CountLimitControl> = {
	repeat: {
		type: 'repeat',
		stripConstraints: ['required'],
		min: {
			kind: 'min',
			name: 'minOccurs',
			sources: ['element', 'property'],
			propertyType: 'int',
			ensureProperty: true
		},
		max: {
			kind: 'max',
			name: 'maxOccurs',
			sources: ['element', 'property'],
			propertyType: 'string',
			ensureProperty: true
		}
	},
	'node-selector': {
		type: 'node-selector',
		stripConstraints: [],
		min: { kind: 'min', name: 'minSize', sources: ['property'] },
		max: { kind: 'max', name: 'maxSize', sources: ['property'] }
	},
	'checkbox-group': {
		type: 'checkbox-group',
		stripConstraints: [],
		min: {
			kind: 'min',
			name: 'minSize',
			sources: ['constraint'],
			editorFromVirtual: true,
			editorUnset: '',
			writeConstraintWhenPositive: true,
			constraintType: 'number'
		}
	}
};

/** The storage entry for a control type, or undefined when that control has no item-count limits. */
export function getCountLimitStorage(fieldType?: string | null): CountLimitControl | undefined {
	// Own keys only. `constructor` and `toString` are on the prototype, not controls.
	if (!fieldType || !Object.hasOwn(countLimitStorage, fieldType)) return undefined;
	return countLimitStorage[fieldType];
}

/** True when some control stores an item-count bound under this constraint name. */
export function isCountLimitConstraint(name: string): boolean {
	return Object.values(countLimitStorage).some((control) =>
		[control.min, control.max].some((bound) => bound?.sources.includes('constraint') && bound.name === name)
	);
}

/** Constraint names the validations loop must not copy onto the content field (checkbox `minSize`). */
export function countLimitValidationKeys(storage: CountLimitControl | undefined): string[] {
	if (!storage) return [];
	return [storage.min, storage.max].flatMap((bound) => (bound?.sources.includes('constraint') ? [bound.name] : []));
}

/** True when save must rebuild virtual minCount/maxCount from the editor field. */
export function storageRefreshesVirtualCount(storage: CountLimitControl | undefined): boolean {
	if (!storage) return false;
	return [storage.min, storage.max].some(
		(bound) => bound != null && (bound.editorFromVirtual || bound.sources.includes('constraint'))
	);
}

export interface CountLimitLegacySource {
	element(name: string): unknown;
	property(name: string): unknown;
	constraint(name: string): unknown;
}

function readBoundSource(
	bound: CountLimitBound | undefined,
	source: CountLimitLegacySource
): { element?: unknown; fallback?: unknown } {
	if (!bound) return {};
	let element: unknown;
	let fallback: unknown;
	let sawFallback = false;
	for (const slot of bound.sources) {
		if (slot === 'element') {
			element = source.element(bound.name);
			continue;
		}
		// One fallback slot. The first non-element source in `sources` is that slot.
		if (!sawFallback) {
			fallback = slot === 'property' ? source.property(bound.name) : source.constraint(bound.name);
			sawFallback = true;
		}
	}
	return { element, fallback };
}

/** Parse one control's stored bounds into runtime limits. No entry means the field is unchanged. */
export function countLimitsFromLegacy(
	storage: CountLimitControl,
	source: CountLimitLegacySource,
	context?: ItemCountParseContext
): CountLimits {
	const min = readBoundSource(storage.min, source);
	const max = readBoundSource(storage.max, source);
	return countLimitsFromStorage(
		{
			minElement: min.element,
			minProperty: min.fallback,
			maxElement: max.element,
			maxProperty: max.fallback
		},
		context
	);
}

export interface CountLimitPropertyWrite {
	name: string;
	kind: 'min' | 'max';
	limit: number | undefined;
	ensure: boolean;
	type?: string;
}

/** Properties to rewrite after parse so the Type Builder form shows the element-winning value. */
export function countLimitPropertyWrites(storage: CountLimitControl, limits: CountLimits): CountLimitPropertyWrite[] {
	const writes: CountLimitPropertyWrite[] = [];
	for (const bound of [storage.min, storage.max]) {
		if (!bound?.sources.includes('property')) continue;
		writes.push({
			name: bound.name,
			kind: bound.kind,
			limit: bound.kind === 'min' ? limits.minCount : limits.maxCount,
			ensure: Boolean(bound.ensureProperty),
			type: bound.propertyType
		});
	}
	return writes;
}

/** Editor fields filled from virtual minCount/maxCount. Empty when the property copy is enough. */
export function countLimitEditorOverrides(
	storage: CountLimitControl | undefined,
	validations?: { minCount?: { value?: unknown }; maxCount?: { value?: unknown } }
): Record<string, unknown> {
	if (!storage) return {};
	const values: Record<string, unknown> = {};
	for (const bound of [storage.min, storage.max]) {
		if (!bound?.editorFromVirtual) continue;
		const raw = bound.kind === 'min' ? validations?.minCount?.value : validations?.maxCount?.value;
		const limit = countLimitValue(raw);
		values[bound.name] = limit == null ? (bound.editorUnset ?? '') : limit;
	}
	return values;
}

/** Runtime limits from editor fields that are not stored as properties (checkbox `minSize`). */
export function countLimitsFromEditorValues(storage: CountLimitControl, values: Record<string, unknown>): CountLimits {
	const minIsVirtual =
		storage.min != null && (storage.min.editorFromVirtual || storage.min.sources.includes('constraint'));
	const maxIsVirtual =
		storage.max != null && (storage.max.editorFromVirtual || storage.max.sources.includes('constraint'));
	return countLimitsFromStorage({
		minProperty: minIsVirtual ? values[storage.min!.name] : undefined,
		maxProperty: maxIsVirtual ? values[storage.max!.name] : undefined
	});
}

export interface CountLimitXmlWrite {
	/** Field-level elements, keyed by the bound name (`minOccurs` / `maxOccurs`). */
	elements: Record<string, string>;
	/** Properties whose type and value are rewritten. Absent keys are left as stored. */
	properties: Record<string, { name: string; type: string; value: string }>;
	stripConstraints: readonly string[];
	constraints: Array<{ name: string; value: number; type: string }>;
}

/**
 * XML for one control's limits. Element and property values are the TB1 strings, including the
 * defaults when the editor value is blank. A constraint is included only for a positive integer.
 */
export function writeCountLimitXml(
	storage: CountLimitControl,
	field: {
		properties?: Record<string, { value?: unknown } | undefined>;
		validations?: { minCount?: { value?: unknown }; maxCount?: { value?: unknown } };
	}
): CountLimitXmlWrite {
	const elements: Record<string, string> = {};
	const properties: Record<string, { name: string; type: string; value: string }> = {};
	const constraints: Array<{ name: string; value: number; type: string }> = [];
	for (const bound of [storage.min, storage.max]) {
		if (!bound) continue;
		if (bound.sources.includes('element') || (bound.sources.includes('property') && bound.propertyType)) {
			const raw = field.properties?.[bound.name]?.value;
			const parsed = countLimitsFromStorage(bound.kind === 'min' ? { minElement: raw } : { maxElement: raw });
			const limit = bound.kind === 'min' ? parsed.minCount : parsed.maxCount;
			const text = String(itemCountEditorValue(limit, bound.kind, bound.propertyType ?? 'string'));
			if (bound.sources.includes('element')) elements[bound.name] = text;
			if (bound.propertyType) properties[bound.name] = { name: bound.name, type: bound.propertyType, value: text };
		}
		if (bound.writeConstraintWhenPositive) {
			const raw = bound.kind === 'min' ? field.validations?.minCount?.value : field.validations?.maxCount?.value;
			const minimum = countLimitValue(raw);
			if (minimum != null)
				constraints.push({ name: bound.name, value: minimum, type: bound.constraintType ?? 'number' });
		}
	}
	return { elements, properties, stripConstraints: storage.stripConstraints, constraints };
}

export interface RepeatOccurrenceViolation {
	kind: 'min' | 'max';
	limit: number;
}

function countLimits(minCount: number | undefined, maxCount: number | undefined): CountLimits {
	return {
		...(minCount != null ? { minCount } : {}),
		...(maxCount != null ? { maxCount } : {})
	};
}

export interface ItemCountStorage {
	/** Repeat element. Wins when it is usable. A blank or invalid element falls back to the property. */
	minElement?: unknown;
	/** Repeat property, node-selector property, or checkbox-group constraint. */
	minProperty?: unknown;
	maxElement?: unknown;
	maxProperty?: unknown;
}

/** Names the field when a stored limit cannot be used. The parser supplies this. */
export interface ItemCountParseContext {
	contentTypeId?: string;
	fieldId?: string;
}

/**
 * Storage → runtime limits. The same rules for every control.
 * Pass `context` so an unusable value with no fallback logs a warning.
 */
export function countLimitsFromStorage(storage: ItemCountStorage, context?: ItemCountParseContext): CountLimits {
	const min = resolveStoredBound(storage.minElement, storage.minProperty, false);
	const max = resolveStoredBound(storage.maxElement, storage.maxProperty, true);
	if (context) {
		if (min.unusable) warnUnusableCountLimit('min', context);
		if (max.unusable) warnUnusableCountLimit('max', context);
	}
	return countLimits(min.limit, max.limit);
}

/**
 * Declared on a Type Builder field's `itemCount` validation.
 * The descriptor names which bound this field is, and the other bound's field id when there is one.
 */
export interface ItemCountEditorSpec {
	role: 'min' | 'max';
	/** Absent for a minimum-only control, such as a checkbox group. */
	partner?: string;
}

/** The role and partner declared on an `itemCount` validation, or undefined when the value is not that spec. */
export function readItemCountEditorSpec(value: unknown): ItemCountEditorSpec | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const role = (value as { role?: unknown }).role;
	if (role !== 'min' && role !== 'max') return undefined;
	const partner = (value as { partner?: unknown }).partner;
	return typeof partner === 'string' && partner !== '' ? { role, partner } : { role };
}

/** Type Builder minimum. Blank and 0 mean no minimum. Any other value must be a non-negative integer. */
export function isItemCountMinEditorValue(value: unknown): boolean {
	if (isBlankCount(value)) return true;
	return readOccursNumber(value) != null;
}

/**
 * Type Builder maximum. Blank and `*` mean no maximum. A stored 0 is unlimited, but the
 * editor must not accept 0: the value has to be an integer of 1 or more.
 */
export function isItemCountMaxEditorValue(value: unknown): boolean {
	if (isBlankCount(value) || isUnlimitedStar(value)) return true;
	const parsed = readOccursNumber(value);
	return parsed != null && parsed >= 1;
}

/** True when either side is unset, or the minimum is not greater than the maximum. */
export function isItemCountRangeValid(min: unknown, max: unknown): boolean {
	const minLimit = countLimitValue(min);
	const maxLimit = countLimitValue(max);
	if (minLimit == null || maxLimit == null) return true;
	return minLimit <= maxLimit;
}

/**
 * Value Type Builder shows for one bound. Every control uses this.
 * An unset limit, including a stored 0, is the unlimited token: `0` for a minimum,
 * blank for an int maximum, and `*` for any other maximum. A positive limit is kept.
 */
export function itemCountEditorValue(
	limit: number | undefined,
	kind: 'min' | 'max',
	storedType?: string
): number | string {
	if (kind === 'min') return limit ?? 0;
	if (storedType === 'int') return limit == null ? '' : limit;
	return limit == null ? repeatMaxDefault : String(limit);
}

/**
 * Values the repeat editor shows. No minimum is `0`. No maximum is `*`.
 * Save writes these (stringified) as both the element and the property.
 */
export function repeatLimitEditorValues(limits: CountLimits): { minOccurs: number; maxOccurs: string } {
	return {
		minOccurs: itemCountEditorValue(limits.minCount, 'min', 'int') as number,
		maxOccurs: itemCountEditorValue(limits.maxCount, 'max', 'string') as string
	};
}

/** TB1 storage strings for a repeat, including the defaults when the editor value is blank. */
export function repeatOccursXmlValues(min: unknown, max: unknown): { minOccurs: string; maxOccurs: string } {
	const editor = repeatLimitEditorValues(countLimitsFromStorage({ minElement: min, maxElement: max }));
	return { minOccurs: String(editor.minOccurs), maxOccurs: editor.maxOccurs };
}

/**
 * Virtual `minCount` / `maxCount` value, for every control.
 * Null, undefined, blank, `*` and 0 are unlimited. A positive integer is a limit.
 * Do not test the result with truthiness: unlimited is `undefined`, never `0`.
 */
export function countLimitValue(value: unknown): number | undefined {
	const parsed = readOccursNumber(value);
	if (parsed == null || parsed === 0) return undefined;
	return parsed;
}

/** @see countLimitValue */
export function readNumericLimit(value: unknown): number | undefined {
	return countLimitValue(value);
}

/**
 * Add is allowed while the count is below the max, including when the repeat is empty.
 * A missing max ("unlimited") never disables Add. Readonly always does.
 */
export function isRepeatAddDisabled(readonly: boolean, count: number, maxCount: unknown): boolean {
	if (readonly) return true;
	const max = readNumericLimit(maxCount);
	return max != null && count >= max;
}

/** Minimum a repeat enforces. No stored minimum (blank or 0) is 0. Required is not a minimum. */
export function getRepeatMinimum(minCount: unknown): number {
	return readNumericLimit(minCount) ?? 0;
}

/**
 * Delete is disabled when the count is at or below {@link getRepeatMinimum}.
 * Readonly always disables removal.
 */
export function isRepeatRemoveDisabled(readonly: boolean, count: number, minCount: unknown): boolean {
	if (readonly) return true;
	return count <= getRepeatMinimum(minCount);
}

/**
 * Count may equal the min or the max. Only a count outside that range is invalid.
 * A missing max does not apply an upper bound. A minimum or maximum of 0 is unlimited.
 */
export function getRepeatOccurrenceViolations(
	count: number,
	minCount: unknown,
	maxCount: unknown
): RepeatOccurrenceViolation[] {
	const violations: RepeatOccurrenceViolation[] = [];
	const min = readNumericLimit(minCount);
	const max = readNumericLimit(maxCount);
	if (min != null && count < min) violations.push({ kind: 'min', limit: min });
	if (max != null && count > max) violations.push({ kind: 'max', limit: max });
	return violations;
}

type StoredBound = { limit?: number; unusable: boolean };

/** Element wins when usable. Blank and invalid fall back to the property. 0 and `*` (max) are unlimited. */
function resolveStoredBound(element: unknown, property: unknown, allowStar: boolean): StoredBound {
	const top = classifyCountToken(element, allowStar);
	if (top === 'limit') return { limit: readOccursNumber(element) as number, unusable: false };
	if (top === 'unlimited') return { unusable: false };
	const fallback = classifyCountToken(property, allowStar);
	if (fallback === 'limit') return { limit: readOccursNumber(property) as number, unusable: false };
	if (fallback === 'unlimited') return { unusable: false };
	return { unusable: top === 'invalid' || fallback === 'invalid' };
}

function classifyCountToken(value: unknown, allowStar: boolean): 'missing' | 'unlimited' | 'limit' | 'invalid' {
	if (isBlankCount(value)) return 'missing';
	if (allowStar && isUnlimitedStar(value)) return 'unlimited';
	const parsed = readOccursNumber(value);
	if (parsed == null) return 'invalid';
	if (parsed === 0) return 'unlimited';
	return 'limit';
}

function isBlankCount(value: unknown): boolean {
	if (value == null) return true;
	return typeof value === 'string' && value.trim() === '';
}

function isUnlimitedStar(value: unknown): boolean {
	return typeof value === 'string' && value.trim() === '*';
}

function warnUnusableCountLimit(bound: 'min' | 'max', context: ItemCountParseContext): void {
	const contentTypeId = context.contentTypeId || 'unknown';
	const fieldId = context.fieldId || 'unknown';
	console.warn(
		`[parseLegacyFormDef] Unusable ${bound} item-count on content type "${contentTypeId}" field "${fieldId}". The limit was left unset.`
	);
}

/** A non-negative integer, or null. 0 is included so callers can decide whether it means unlimited. */
function readOccursNumber(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value >= 0 ? value : null;
	}
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return /^\d+$/.test(text) ? Number.parseInt(text, 10) : null;
}
