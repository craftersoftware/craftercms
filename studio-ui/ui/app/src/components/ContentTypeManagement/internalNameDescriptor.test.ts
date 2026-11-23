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
 * Internal Name is stored as type `input`, so Type Builder selects its properties descriptor by field identity.
 * The descriptor has no `required` (the field is always required), and a stored `required` must survive an edit.
 * See craftersoftware/craftercms#9505.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { parseLegacyFormDefinition } = await import('../../services/contentTypes.ts');
const {
	createTypeFieldValuesObject,
	createVirtualTypeForField,
	getNewFieldFromDescriptor,
	prepareSerializeToXmlTypeObject,
	resolveFieldControlDescriptor,
	reverseTypeFieldValuesObject
} = await import('./utils.ts');
const { messageSource } = await import('../../../test/messageSource.mjs');
const { controlDescriptors } = await import('./descriptors/controls/index.ts');
const { internalNameDescriptor } = await import('./descriptors/controls/internalName.ts');
const { inputDescriptor } = await import('./descriptors/controls/input.ts');

describe('resolveFieldControlDescriptor', () => {
	// The system field is identified by its reserved id and the stored type `input`.
	it('returns the internal-name descriptor for the internal-name field stored as input', () => {
		assert.equal(
			resolveFieldControlDescriptor({ id: 'internal-name', type: 'input' }, inputDescriptor),
			internalNameDescriptor
		);
		assert.equal(resolveFieldControlDescriptor({ id: 'internal-name', type: 'input' }), internalNameDescriptor);
	});

	// A regular input keeps the descriptor the caller looked up by type.
	it('returns the by-type descriptor for a normal input field', () => {
		assert.equal(resolveFieldControlDescriptor({ id: 'title_t', type: 'input' }, inputDescriptor), inputDescriptor);
		assert.equal(resolveFieldControlDescriptor({ id: 'title_t', type: 'input' }, undefined), undefined);
	});

	// The same id with another stored type is not the system field.
	it('does not return the internal-name descriptor for the internal-name id with another type', () => {
		const checkbox = controlDescriptors['checkbox'];
		assert.equal(resolveFieldControlDescriptor({ id: 'internal-name', type: 'checkbox' }, checkbox), checkbox);
		assert.equal(resolveFieldControlDescriptor({ id: 'internal-name', type: 'rte' }), undefined);
	});

	// The input type id shape is not enough on its own: another id with type internal-name is not remapped either.
	it('does not remap by type alone', () => {
		assert.equal(
			resolveFieldControlDescriptor({ id: 'name_s', type: 'internal-name' }, controlDescriptors['internal-name']),
			controlDescriptors['internal-name']
		);
	});
});

function labelOf(name: unknown): unknown {
	return typeof name === 'string' ? name : messageSource((name as { defaultMessage: unknown }).defaultMessage);
}

describe('internalNameDescriptor', () => {
	// The Options panel shows these labels, so a shared field must read the same as it does for input.
	it('labels the fields it shares with input the same way', () => {
		const shared = Object.keys(internalNameDescriptor.fields).filter((key) => key in inputDescriptor.fields);
		assert.deepEqual(shared.sort(), ['escapeContent', 'maxlength', 'pattern', 'readonly', 'tokenize']);
		for (const key of shared) {
			const ours = internalNameDescriptor.fields[key];
			const theirs = inputDescriptor.fields[key];
			assert.equal(typeof ours.name, 'object', `${key} label is a message, not a raw string`);
			assert.equal(labelOf(ours.name), labelOf(theirs.name), `${key} label`);
			assert.equal(ours.type, theirs.type, `${key} type`);
		}
		assert.equal(labelOf(internalNameDescriptor.fields.escapeContent.name), 'Escape Content');
	});

	// Open + save of a field with no stored value used to write the input defaults, so they stay the same.
	it('keeps the input defaults for the fields it shares', () => {
		for (const key of Object.keys(internalNameDescriptor.fields)) {
			if (!(key in inputDescriptor.fields)) continue;
			assert.equal(
				internalNameDescriptor.fields[key].defaultValue,
				inputDescriptor.fields[key].defaultValue,
				`${key} default`
			);
		}
		assert.equal(internalNameDescriptor.fields.maxlength.defaultValue, 50);
		assert.equal(internalNameDescriptor.fields.pattern.defaultValue, '');
	});

	// FE1 and FE2 always require Internal Name, so a toggle for it would do nothing.
	it('does not offer required', () => {
		assert.equal('required' in internalNameDescriptor.fields, false);
		const sectionFields = internalNameDescriptor.sections.flatMap((section) => section.fields);
		assert.equal(sectionFields.includes('required'), false);
	});

	// FE1 honoured a stored pattern, so it stays editable.
	it('keeps pattern', () => {
		assert.equal('pattern' in internalNameDescriptor.fields, true);
		assert.equal(internalNameDescriptor.sections.flatMap((section) => section.fields).includes('pattern'), true);
	});
});

describe('internal-name stored required round trip', () => {
	function parseWithInternalName(required: 'true' | 'false' | undefined) {
		return parseLegacyFormDefinition({
			'content-type': '/page/custom',
			title: 'Custom',
			description: '',
			objectType: 'page',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id: 'internal-name',
							title: 'Internal Name',
							description: '',
							type: 'input',
							...(required && {
								constraints: {
									constraint: [
										{ name: 'required', value: required, type: 'boolean' },
										{ name: 'pattern', value: '^[a-z]+$', type: 'string' }
									]
								}
							})
						}
					}
				}
			}
		} as never);
	}

	function storedConstraints(type: ReturnType<typeof parseWithInternalName>) {
		const section = [prepareSerializeToXmlTypeObject(type).sections.section].flat()[0];
		const field = [section.fields.field].flat().find((item) => item.id === 'internal-name');
		return { type: field.type, constraints: [field.constraints?.constraint ?? []].flat() };
	}

	// Mirrors the form: only the fields of the virtual type built from the resolved descriptor carry values.
	function editInternalName(type: ReturnType<typeof parseWithInternalName>, changes: Record<string, unknown>) {
		const field = type.fields['internal-name'];
		const descriptor = resolveFieldControlDescriptor(field, controlDescriptors['input']);
		assert.equal(descriptor, internalNameDescriptor);
		const virtualType = createVirtualTypeForField(descriptor, (message) => String(message.defaultMessage));
		const all = createTypeFieldValuesObject(field);
		const values = Object.fromEntries(Object.entries(all).filter(([key]) => key in virtualType.fields));
		assert.equal('required' in values, false);
		Object.assign(values, changes);
		const edited = reverseTypeFieldValuesObject(field, values, descriptor);
		return { ...type, fields: { ...type.fields, 'internal-name': edited } };
	}

	for (const stored of ['true', 'false'] as const) {
		// Given a stored required, editing another property writes the same required value back and keeps the type.
		it(`keeps a stored required=${stored} after editing another property`, () => {
			const parsed = parseWithInternalName(stored);
			const before = storedConstraints(parsed);
			const edited = editInternalName(parsed, { maxlength: '40', pattern: '^[a-z0-9]+$' });
			const after = storedConstraints(edited);
			assert.equal(after.type, 'input');
			const required = after.constraints.find((item) => item.name === 'required');
			assert.equal(String(required?.value), stored);
			assert.equal(required?.type, before.constraints.find((item) => item.name === 'required')?.type);
			assert.equal(after.constraints.find((item) => item.name === 'pattern')?.value, '^[a-z0-9]+$');
		});
	}

	// Given no stored required, editing does not add one.
	it('does not add a required constraint when none is stored', () => {
		const edited = editInternalName(parseWithInternalName(undefined), { maxlength: '40' });
		const after = storedConstraints(edited);
		assert.equal(after.type, 'input');
		assert.equal(
			after.constraints.some((item) => item.name === 'required'),
			false
		);
	});
});

describe('stored required without a form value on other controls', () => {
	function parseField(id: string, type: string) {
		return parseLegacyFormDefinition({
			'content-type': '/page/custom',
			title: 'Custom',
			description: '',
			objectType: 'page',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id,
							title: id,
							description: '',
							type,
							constraints: { constraint: [{ name: 'required', value: 'true', type: 'boolean' }] }
						}
					}
				}
			}
		} as never);
	}

	function savedRequired(type: ReturnType<typeof parseField>, id: string) {
		const section = [prepareSerializeToXmlTypeObject(type).sections.section].flat()[0];
		const field = [section.fields.field].flat().find((item) => item.id === id);
		return [field.constraints?.constraint ?? []].flat().find((item) => item.name === 'required');
	}

	// The form has no value for `required`, as when a descriptor does not list it.
	function editWithoutRequiredValue(
		type: ReturnType<typeof parseField>,
		id: string,
		descriptor: typeof inputDescriptor
	) {
		const field = type.fields[id];
		const values = createTypeFieldValuesObject(field);
		assert.equal(values.required, true);
		delete values.required;
		return { ...type, fields: { ...type.fields, [id]: reverseTypeFieldValuesObject(field, values, descriptor) } };
	}

	// Only Internal Name keeps a stored constraint the form has no value for. Everything else is cleared as before.
	for (const [id, type] of [
		['title_t', 'input'],
		['file-name', 'file-name'],
		['file-name', 'auto-filename'],
		['internal-name', 'checkbox']
	] as const) {
		it(`clears a stored required on ${id} (${type}) when the form has no value for it`, () => {
			const parsed = parseField(id, type);
			assert.notEqual(savedRequired(parsed, id), undefined);
			const descriptor = resolveFieldControlDescriptor(parsed.fields[id], controlDescriptors[type]);
			assert.notEqual(descriptor, internalNameDescriptor);
			assert.equal(savedRequired(editWithoutRequiredValue(parsed, id, descriptor), id), undefined);
		});
	}

	// A normal input whose required toggle the author turns off still has it cleared.
	it('clears required on a normal input when the author clears it in the form', () => {
		const parsed = parseField('title_t', 'input');
		const field = parsed.fields.title_t;
		const values = { ...createTypeFieldValuesObject(field), required: undefined };
		const edited = reverseTypeFieldValuesObject(field, values, inputDescriptor);
		const type = { ...parsed, fields: { ...parsed.fields, title_t: edited } };
		assert.equal(savedRequired(type, 'title_t'), undefined);
	});

	// Sanity: the same edit on Internal Name keeps it.
	it('keeps required on internal-name for the same edit', () => {
		const parsed = parseField('internal-name', 'input');
		const edited = editWithoutRequiredValue(parsed, 'internal-name', internalNameDescriptor);
		assert.equal(String(savedRequired(edited, 'internal-name')?.value), 'true');
	});
});

describe('inserting the internal-name field', () => {
	// Insert stores type input with the reserved id, and offers no required constraint.
	it('keeps type input and writes no required constraint', () => {
		const field = getNewFieldFromDescriptor('internal-name', controlDescriptors['internal-name']);
		assert.equal(field.type, 'input');
		assert.equal(field.id, 'internal-name');
		assert.equal('required' in field.validations, false);
		assert.equal('required' in (field.properties ?? {}), false);
		assert.equal(
			resolveFieldControlDescriptor(field, controlDescriptors['input']),
			internalNameDescriptor,
			'the inserted field reopens with the internal-name descriptor'
		);
	});

	// A normal input still offers required.
	it('still offers required for a normal input', () => {
		const field = getNewFieldFromDescriptor('input', controlDescriptors['input']);
		assert.equal('required' in field.validations, true);
	});
});
