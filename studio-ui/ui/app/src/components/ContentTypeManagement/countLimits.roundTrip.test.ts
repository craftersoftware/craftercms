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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { parseLegacyFormDefinition } = await import('../../services/contentTypes.ts');
const {
	buildContentTypeXml,
	createTypeFieldValuesObject,
	prepareSerializeToXmlTypeObject,
	reverseTypeFieldValuesObject
} = await import('./utils.ts');
const { deserialize, entityEncodingTagValueProcessor } = await import('../../utils/xml.ts');
const { checkboxGroupDescriptor } = await import('./descriptors/controls/checkboxGroup.ts');
const { nodeSelectorDescriptor } = await import('./descriptors/controls/nodeSelector.ts');
const { repeatDescriptor } = await import('./descriptors/controls/repeat.ts');
const { countLimitStorage, getCountLimitStorage } = await import('../../utils/countLimits.ts');

/**
 * Type Builder load and save for item counts.
 * countLimitStorage in utils/countLimits.ts is the contract: one entry per control, read with getCountLimitStorage.
 * Each entry is round-tripped through parse, the editor and XML below.
 * A repeat writes the element and the property (min as int, max as string) and strips required, minCount and maxCount.
 * A checkbox group writes the minSize constraint only for a positive minimum. A stored 0 loads blank and is omitted.
 * A stored maximum of 0 loads as unlimited: blank for a node selector's int field, '*' for a repeat, so the type can be saved unchanged.
 * Descriptor fields declare the editor rule as itemCount { role, partner }. They do not also set minValue.
 * The table does not name the partner. The descriptor's itemCount validation does.
 */

function property(name: string, value: string, type = 'string') {
	return { name, value, type };
}

describe('repeat count-limit round trip', () => {
	// Given accounts_o with element min 1 / property 0, element max '*' / property 4, and a required constraint: the editor shows 1 and '*', and save writes both copies without required, minCount or maxCount.
	it('loads the element when it disagrees with the property, and writes both back without required', () => {
		const parsed = parseLegacyFormDefinition({
			'content-type': '/component/social-media-widget',
			title: 'Social',
			description: '',
			objectType: 'component',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id: 'accounts_o',
							title: 'Accounts',
							description: '',
							type: 'repeat',
							minOccurs: '1',
							maxOccurs: '*',
							constraints: { constraint: { name: 'required', value: 'true', type: 'boolean' } },
							properties: {
								property: [property('minOccurs', '0'), property('maxOccurs', '4')]
							},
							fields: { field: { id: 'title_s', title: 'Title', description: '', type: 'input' } }
						}
					}
				}
			}
		} as never);

		const loaded = createTypeFieldValuesObject(parsed.fields.accounts_o);
		assert.equal(loaded.minOccurs, 1);
		assert.equal(loaded.maxOccurs, '*');
		assert.equal(loaded.required, undefined);

		const xml = prepareSerializeToXmlTypeObject(parsed);
		const section = Array.isArray(xml.sections.section) ? xml.sections.section[0] : xml.sections.section;
		const field = Array.isArray(section.fields.field) ? section.fields.field[0] : section.fields.field;
		assert.equal(field.minOccurs, '1');
		assert.equal(field.maxOccurs, '*');
		const props = Array.isArray(field.properties.property) ? field.properties.property : [field.properties.property];
		assert.equal(props.find((item) => item.name === 'minOccurs')?.value, '1');
		assert.equal(props.find((item) => item.name === 'minOccurs')?.type, 'int');
		assert.equal(props.find((item) => item.name === 'maxOccurs')?.value, '*');
		assert.equal(props.find((item) => item.name === 'maxOccurs')?.type, 'string');
		const constraints = field.constraints?.constraint;
		const constraintList = constraints == null ? [] : Array.isArray(constraints) ? constraints : [constraints];
		assert.equal(
			constraintList.some((item) => item.name === 'required' || item.name === 'minCount' || item.name === 'maxCount'),
			false
		);
	});

	// Given a repeat with no stored limits, save writes the TB1 defaults: min '0' (int) and max '*' (string), as element and property.
	it('writes TB1 defaults when the repeat limits are blank', () => {
		const parsed = parseLegacyFormDefinition({
			'content-type': '/component/widget',
			title: 'Widget',
			description: '',
			objectType: 'component',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id: 'items_o',
							title: 'Items',
							description: '',
							type: 'repeat',
							fields: { field: [] }
						}
					}
				}
			}
		} as never);
		const xml = prepareSerializeToXmlTypeObject(parsed);
		const section = Array.isArray(xml.sections.section) ? xml.sections.section[0] : xml.sections.section;
		const field = Array.isArray(section.fields.field) ? section.fields.field[0] : section.fields.field;
		assert.equal(field.minOccurs, '0');
		assert.equal(field.maxOccurs, '*');
		const props = Array.isArray(field.properties.property) ? field.properties.property : [field.properties.property];
		assert.equal(props.find((item) => item.name === 'minOccurs')?.value, '0');
		assert.equal(props.find((item) => item.name === 'minOccurs')?.type, 'int');
		assert.equal(props.find((item) => item.name === 'maxOccurs')?.value, '*');
		assert.equal(props.find((item) => item.name === 'maxOccurs')?.type, 'string');
	});
});

function checkboxField(minSize?: string) {
	return parseLegacyFormDefinition({
		'content-type': '/page/article',
		title: 'Article',
		description: '',
		objectType: 'page',
		sections: {
			section: {
				title: 'Main',
				description: '',
				defaultOpen: 'true',
				fields: {
					field: {
						id: 'topics_o',
						title: 'Topics',
						description: '',
						type: 'checkbox-group',
						...(minSize == null
							? {}
							: { constraints: { constraint: { name: 'minSize', value: minSize, type: 'int' } } })
					}
				}
			}
		}
	} as never);
}

function savedConstraint(type: ReturnType<typeof parseLegacyFormDefinition>) {
	const xml = prepareSerializeToXmlTypeObject(type);
	const section = Array.isArray(xml.sections.section) ? xml.sections.section[0] : xml.sections.section;
	const field = Array.isArray(section.fields.field) ? section.fields.field[0] : section.fields.field;
	const constraints = field.constraints?.constraint;
	const constraintList = constraints == null ? [] : Array.isArray(constraints) ? constraints : [constraints];
	return { field, constraintList };
}

describe('checkbox group minSize round trip', () => {
	// Given topics_o with minSize 2, the editor shows 2 and save writes the minSize constraint, not minCount.
	it('writes the minSize constraint and does not write minCount', () => {
		const parsed = checkboxField('2');
		const loaded = parsed.fields.topics_o;
		assert.equal(loaded.validations.minCount?.value, 2);
		assert.equal(Object.hasOwn(loaded.validations, 'minSize'), false);
		assert.equal(createTypeFieldValuesObject(loaded).minSize, 2);

		const saved = savedConstraint(parsed);
		assert.equal(saved.constraintList.find((item) => item.name === 'minSize')?.value, 2);
		assert.equal(
			saved.constraintList.some((item) => item.name === 'minCount' || item.name === 'maxCount'),
			false
		);
	});

	// Given an editor change from 1 to 4, save writes minSize 4 and still does not write minCount.
	it('keeps an edited minSize constraint after the form is saved', () => {
		const parsed = checkboxField('1');
		const values = createTypeFieldValuesObject(parsed.fields.topics_o);
		values.minSize = 4;
		const edited = reverseTypeFieldValuesObject(parsed.fields.topics_o, values, checkboxGroupDescriptor);
		const type = { ...parsed, fields: { ...parsed.fields, topics_o: edited } };
		const saved = savedConstraint(type);
		assert.equal(edited.validations.minCount?.value, 4);
		assert.equal(saved.constraintList.find((item) => item.name === 'minSize')?.value, 4);
		assert.equal(
			saved.constraintList.some((item) => item.name === 'minCount'),
			false
		);
	});

	// Given a stored 2 edited to 5, reopening shows 5. Clearing it to blank reopens blank and save omits minSize.
	it('keeps an edited or cleared minimum when the field is opened again', () => {
		const parsed = checkboxField('2');
		const editedValues = createTypeFieldValuesObject(parsed.fields.topics_o);
		editedValues.minSize = 5;
		const edited = reverseTypeFieldValuesObject(parsed.fields.topics_o, editedValues, checkboxGroupDescriptor);
		assert.equal(createTypeFieldValuesObject(edited).minSize, 5);
		assert.equal(edited.validations.minCount?.value, 5);
		assert.equal(Object.hasOwn(edited.validations, 'minSize'), false);

		const clearedValues = createTypeFieldValuesObject(edited);
		clearedValues.minSize = '';
		const cleared = reverseTypeFieldValuesObject(edited, clearedValues, checkboxGroupDescriptor);
		assert.equal(createTypeFieldValuesObject(cleared).minSize, '');
		assert.equal(cleared.validations.minCount, undefined);
		assert.equal(Object.hasOwn(cleared.validations, 'minSize'), false);

		const type = { ...parsed, fields: { ...parsed.fields, topics_o: cleared } };
		assert.equal(
			savedConstraint(type).constraintList.some((item) => item.name === 'minSize'),
			false
		);
	});

	// Given a legacy minSize of 0, the editor is blank and save writes neither minSize nor minCount. 0 is the same as no minimum.
	it('loads a stored minimum of 0 as blank and saves without the constraint', () => {
		const parsed = checkboxField('0');
		const loaded = parsed.fields.topics_o;
		assert.equal(loaded.validations.minCount, undefined);
		assert.equal(createTypeFieldValuesObject(loaded).minSize, '');

		const saved = savedConstraint(parsed);
		assert.equal(
			saved.constraintList.some((item) => item.name === 'minSize' || item.name === 'minCount'),
			false
		);
	});
});

describe('stored max of 0 in Type Builder', () => {
	// Given articles_o with minSize and maxSize 0, and items_o with maxOccurs 0: the node selector loads blank (int unlimited) and the repeat loads '*'. Saving the selector does not invent minCount or maxCount.
	it('loads a node selector maxSize of 0 as blank, and a repeat max of 0 as *', () => {
		const parsed = parseLegacyFormDefinition({
			'content-type': '/component/widget',
			title: 'Widget',
			description: '',
			objectType: 'component',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: [
							{
								id: 'articles_o',
								title: 'Articles',
								description: '',
								type: 'node-selector',
								properties: {
									property: [property('minSize', '0', 'int'), property('maxSize', '0', 'int')]
								}
							},
							{
								id: 'items_o',
								title: 'Items',
								description: '',
								type: 'repeat',
								maxOccurs: '0',
								fields: { field: [] }
							}
						]
					}
				}
			}
		} as never);

		const selectorValues = createTypeFieldValuesObject(parsed.fields.articles_o);
		assert.equal(parsed.fields.articles_o.validations.maxCount, undefined);
		assert.equal(selectorValues.minSize, 0);
		assert.equal(selectorValues.maxSize, '');

		const edited = reverseTypeFieldValuesObject(parsed.fields.articles_o, selectorValues, nodeSelectorDescriptor);
		const savedType = { ...parsed, fields: { ...parsed.fields, articles_o: edited } };
		const xml = prepareSerializeToXmlTypeObject(savedType);
		const section = Array.isArray(xml.sections.section) ? xml.sections.section[0] : xml.sections.section;
		const fields = Array.isArray(section.fields.field) ? section.fields.field : [section.fields.field];
		const selector = fields.find((item) => item.id === 'articles_o');
		const props = Array.isArray(selector.properties.property)
			? selector.properties.property
			: [selector.properties.property];
		assert.equal(props.find((item) => item.name === 'maxSize')?.value, '');
		assert.equal(props.find((item) => item.name === 'minSize')?.value, 0);
		const constraints = selector.constraints?.constraint;
		const constraintList = constraints == null ? [] : Array.isArray(constraints) ? constraints : [constraints];
		assert.equal(
			constraintList.some((item) => item.name === 'minCount' || item.name === 'maxCount'),
			false
		);

		const repeatValues = createTypeFieldValuesObject(parsed.fields.items_o);
		assert.equal(repeatValues.maxOccurs, '*');
		assert.equal(parsed.fields.items_o.validations.maxCount, undefined);
	});
});

describe('item count editor rules', () => {
	// Given the repeat maxOccurs descriptor, the helper text allows '*', blank, or an integer of 1 or more, and itemCount says this field is the max whose partner is minOccurs.
	it('explains an unlimited repeat maximum and requires an integer of at least 1', () => {
		const field = repeatDescriptor.fields.maxOccurs;
		const description = field.description as { defaultMessage?: string };
		assert.match(description.defaultMessage ?? '', /\*/);
		assert.match(description.defaultMessage ?? '', /blank/i);
		assert.match(description.defaultMessage ?? '', /1 or more/);
		assert.deepEqual(field.validations.itemCount?.value, { role: 'max', partner: 'minOccurs' });
		assert.deepEqual(repeatDescriptor.fields.minOccurs.validations.itemCount?.value, {
			role: 'min',
			partner: 'maxOccurs'
		});
	});

	// Given the three descriptors, each bound's role and partner live on itemCount. The node selector does not also set minValue. A checkbox group has no partner.
	it('declares the role and partner on itemCount and does not also set minValue', () => {
		assert.deepEqual(nodeSelectorDescriptor.fields.maxSize.validations.itemCount?.value, {
			role: 'max',
			partner: 'minSize'
		});
		assert.equal(nodeSelectorDescriptor.fields.maxSize.validations.minValue, undefined);
		assert.deepEqual(nodeSelectorDescriptor.fields.minSize.validations.itemCount?.value, {
			role: 'min',
			partner: 'maxSize'
		});
		assert.equal(nodeSelectorDescriptor.fields.minSize.validations.minValue, undefined);
		assert.deepEqual(checkboxGroupDescriptor.fields.minSize.validations.itemCount?.value, { role: 'min' });
	});
});

function namedList<T>(value: T | T[] | null | undefined): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function savedField(type: ReturnType<typeof parseLegacyFormDefinition>, fieldId: string) {
	const xml = prepareSerializeToXmlTypeObject(type);
	const section = Array.isArray(xml.sections.section) ? xml.sections.section[0] : xml.sections.section;
	return namedList(section.fields.field).find((item) => item.id === fieldId);
}

/** The same path as fetchContentTypes: XML text, then parseTagValue false, so every stored value is a string. */
function reparsedType(type: ReturnType<typeof parseLegacyFormDefinition>) {
	const xml = buildContentTypeXml(prepareSerializeToXmlTypeObject(type));
	const form = deserialize(xml, {
		parseTagValue: false,
		tagValueProcessor: entityEncodingTagValueProcessor
	}).form;
	return parseLegacyFormDefinition(form);
}

describe('count-limit storage table', () => {
	// Given the table, the only item-count controls are repeat, node-selector and checkbox-group. An input has no entry.
	it('has one entry per item-count control and none for any other type', () => {
		assert.deepEqual(Object.keys(countLimitStorage).sort(), ['checkbox-group', 'node-selector', 'repeat']);
		assert.equal(getCountLimitStorage('input'), undefined);
		assert.equal(getCountLimitStorage(undefined), undefined);
		assert.equal(getCountLimitStorage(null), undefined);
	});

	// Given accounts_o (element min 1 vs property 0, element max '*' vs property 4, required true), the repeat entry wins on the element. Editing the editor to 3 and 5 writes both copies as int and string and drops required. Parsing that XML again yields minCount 3 and maxCount 5.
	it('round-trips the repeat entry through parse, the editor and XML', () => {
		assert.deepEqual(getCountLimitStorage('repeat'), {
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
		});

		const parsed = parseLegacyFormDefinition({
			'content-type': '/component/social-media-widget',
			title: 'Social',
			description: '',
			objectType: 'component',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id: 'accounts_o',
							title: 'Accounts',
							description: '',
							type: 'repeat',
							minOccurs: '1',
							maxOccurs: '*',
							constraints: { constraint: { name: 'required', value: 'true', type: 'boolean' } },
							properties: {
								property: [property('minOccurs', '0'), property('maxOccurs', '4')]
							},
							fields: { field: { id: 'title_s', title: 'Title', description: '', type: 'input' } }
						}
					}
				}
			}
		} as never);

		assert.equal(parsed.fields.accounts_o.validations.minCount?.value, 1);
		assert.equal(parsed.fields.accounts_o.validations.maxCount, undefined);
		assert.equal(parsed.fields.accounts_o.validations.required, undefined);
		const loaded = createTypeFieldValuesObject(parsed.fields.accounts_o);
		assert.equal(loaded.minOccurs, 1);
		assert.equal(loaded.maxOccurs, '*');

		loaded.minOccurs = 3;
		loaded.maxOccurs = '5';
		const edited = reverseTypeFieldValuesObject(parsed.fields.accounts_o, loaded, repeatDescriptor);
		const editedType = { ...parsed, fields: { ...parsed.fields, accounts_o: edited } };
		const saved = savedField(editedType, 'accounts_o');
		assert.equal(saved.minOccurs, '3');
		assert.equal(saved.maxOccurs, '5');
		const props = namedList(saved.properties?.property);
		assert.equal(props.find((item) => item.name === 'minOccurs')?.value, '3');
		assert.equal(props.find((item) => item.name === 'minOccurs')?.type, 'int');
		assert.equal(props.find((item) => item.name === 'maxOccurs')?.value, '5');
		assert.equal(props.find((item) => item.name === 'maxOccurs')?.type, 'string');
		assert.equal(
			namedList(saved.constraints?.constraint).some(
				(item) => item.name === 'required' || item.name === 'minCount' || item.name === 'maxCount'
			),
			false
		);

		const again = reparsedType(editedType).fields.accounts_o;
		assert.equal(again.validations.minCount?.value, 3);
		assert.equal(again.validations.maxCount?.value, 5);
		assert.equal(createTypeFieldValuesObject(again).minOccurs, 3);
		assert.equal(createTypeFieldValuesObject(again).maxOccurs, '5');
		assert.equal(again.validations.required, undefined);
	});

	// Given articles_o with minSize 1 and maxSize 4 properties (no elements), the node-selector entry loads those properties. Editing the maximum to 8 writes the properties only, keeps a stored required constraint, and does not write minOccurs or minCount. Parsing that XML again yields minCount 1 and maxCount 8.
	it('round-trips the node-selector entry through parse, the editor and XML', () => {
		assert.deepEqual(getCountLimitStorage('node-selector'), {
			type: 'node-selector',
			stripConstraints: [],
			min: { kind: 'min', name: 'minSize', sources: ['property'] },
			max: { kind: 'max', name: 'maxSize', sources: ['property'] }
		});

		const parsed = parseLegacyFormDefinition({
			'content-type': '/component/widget',
			title: 'Widget',
			description: '',
			objectType: 'component',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id: 'articles_o',
							title: 'Articles',
							description: '',
							type: 'node-selector',
							constraints: { constraint: { name: 'required', value: 'true', type: 'boolean' } },
							properties: {
								property: [property('minSize', '1', 'int'), property('maxSize', '4', 'int')]
							}
						}
					}
				}
			}
		} as never);

		assert.equal(parsed.fields.articles_o.validations.minCount?.value, 1);
		assert.equal(parsed.fields.articles_o.validations.maxCount?.value, 4);
		assert.equal(parsed.fields.articles_o.validations.required?.value, true);
		const loaded = createTypeFieldValuesObject(parsed.fields.articles_o);
		assert.equal(loaded.minSize, 1);
		assert.equal(loaded.maxSize, 4);

		loaded.maxSize = 8;
		const edited = reverseTypeFieldValuesObject(parsed.fields.articles_o, loaded, nodeSelectorDescriptor);
		const editedType = { ...parsed, fields: { ...parsed.fields, articles_o: edited } };
		const saved = savedField(editedType, 'articles_o');
		assert.equal(saved.minOccurs, undefined);
		assert.equal(saved.maxOccurs, undefined);
		const props = namedList(saved.properties?.property);
		assert.equal(props.find((item) => item.name === 'minSize')?.value, 1);
		assert.equal(props.find((item) => item.name === 'minSize')?.type, 'int');
		assert.equal(props.find((item) => item.name === 'maxSize')?.value, 8);
		assert.equal(props.find((item) => item.name === 'maxSize')?.type, 'int');
		const constraints = namedList(saved.constraints?.constraint);
		assert.equal(
			constraints.some((item) => item.name === 'minCount' || item.name === 'maxCount'),
			false
		);
		assert.equal(
			constraints.some((item) => item.name === 'minSize'),
			false
		);
		assert.equal(constraints.find((item) => item.name === 'required')?.value, true);

		const again = reparsedType(editedType).fields.articles_o;
		assert.equal(again.validations.minCount?.value, 1);
		assert.equal(again.validations.maxCount?.value, 8);
		assert.equal(createTypeFieldValuesObject(again).minSize, 1);
		assert.equal(createTypeFieldValuesObject(again).maxSize, 8);
	});

	// Given topics_o with a minSize constraint of 2 and no maximum, the checkbox-group entry loads minCount 2 and a blank-able editor. Editing the editor to 6 writes the minSize constraint (type number) and not minCount. Parsing that XML again shows 6, and a cleared editor writes no constraint.
	it('round-trips the checkbox-group entry through parse, the editor and XML', () => {
		assert.deepEqual(getCountLimitStorage('checkbox-group'), {
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
		});

		const parsed = checkboxField('2');
		assert.equal(parsed.fields.topics_o.validations.minCount?.value, 2);
		assert.equal(parsed.fields.topics_o.validations.maxCount, undefined);
		assert.equal(Object.hasOwn(parsed.fields.topics_o.validations, 'minSize'), false);
		const loaded = createTypeFieldValuesObject(parsed.fields.topics_o);
		assert.equal(loaded.minSize, 2);

		loaded.minSize = 6;
		const edited = reverseTypeFieldValuesObject(parsed.fields.topics_o, loaded, checkboxGroupDescriptor);
		assert.equal(edited.validations.minCount?.value, 6);
		const editedType = { ...parsed, fields: { ...parsed.fields, topics_o: edited } };
		const saved = savedField(editedType, 'topics_o');
		const written = namedList(saved.constraints?.constraint).find((item) => item.name === 'minSize');
		assert.equal(written?.value, 6);
		assert.equal(written?.type, 'number');
		assert.equal(
			namedList(saved.constraints?.constraint).some((item) => item.name === 'minCount' || item.name === 'maxCount'),
			false
		);
		assert.equal(saved.minOccurs, undefined);

		const again = reparsedType(editedType).fields.topics_o;
		assert.equal(again.validations.minCount?.value, 6);
		assert.equal(createTypeFieldValuesObject(again).minSize, 6);

		const clearedValues = createTypeFieldValuesObject(again);
		clearedValues.minSize = '';
		const cleared = reverseTypeFieldValuesObject(again, clearedValues, checkboxGroupDescriptor);
		const clearedType = { ...parsed, fields: { topics_o: cleared } };
		const clearedSaved = savedField(clearedType, 'topics_o');
		assert.equal(
			namedList(clearedSaved.constraints?.constraint).some((item) => item.name === 'minSize'),
			false
		);
		const clearedAgain = reparsedType(clearedType).fields.topics_o;
		assert.equal(clearedAgain.validations.minCount, undefined);
		assert.equal(createTypeFieldValuesObject(clearedAgain).minSize, '');
	});
});
