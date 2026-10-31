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
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import '../../../test/registerTsLoader.mjs';

const { parseLegacyFormDefinition } = await import('../../services/contentTypes.ts');
const {
	buildContentTypeXml,
	createTypeFieldValuesObject,
	prepareSerializeToXmlTypeObject,
	reverseTypeFieldValuesObject
} = await import('./utils.ts');
const { deserialize, entityEncodingTagValueProcessor } = await import('../../utils/xml.ts');
const { inputDescriptor } = await import('./descriptors/controls/input.ts');

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(
	here,
	'../../../../../../studio/src/main/webapp/repo-bootstrap/global/blueprints/2000_headless_store/config/studio/content-types/page/catalog/form-definition.xml'
);
const dependencyPath = resolve(
	here,
	'../../../../../../studio/src/test/resources/crafter/studio/config/dependency/form-definition.xml'
);

function namedList<T>(value: T | T[] | null | undefined): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function savedType(type: ReturnType<typeof parseLegacyFormDefinition>) {
	return prepareSerializeToXmlTypeObject(type);
}

function formProperties(type: ReturnType<typeof parseLegacyFormDefinition>) {
	return namedList(savedType(type).properties?.property);
}

function fieldConstraints(type: ReturnType<typeof parseLegacyFormDefinition>, fieldId: string) {
	const xml = savedType(type);
	const section = namedList(xml.sections.section)[0];
	const field = namedList(section.fields.field).find((item) => item.id === fieldId);
	return namedList(field?.constraints?.constraint);
}

function parseXml(xml: string) {
	return parseLegacyFormDefinition(
		deserialize(xml, {
			parseTagValue: false,
			tagValueProcessor: entityEncodingTagValueProcessor
		}).form
	);
}

describe('form property and constraint pass-through', () => {
	// Given /page/catalog, a no-edit save keeps placeInNav and descriptor-mapper and does not write iceId or the thumbnail "undefined".
	it('keeps catalog form properties and drops iceId and the undefined thumbnail', () => {
		const parsed = parseXml(readFileSync(catalogPath, 'utf8'));
		assert.equal(parsed.thumbnailFileName, null);
		const props = formProperties(parsed);
		assert.deepEqual(
			props.map((item) => item.name),
			['placeInNav', 'display-template', 'no-template-required', 'descriptor-mapper']
		);
		const placeInNav = props.find((item) => item.name === 'placeInNav');
		const mapper = props.find((item) => item.name === 'descriptor-mapper');
		assert.equal(placeInNav?.value, 'true');
		assert.equal(placeInNav?.type, 'boolean');
		assert.equal(placeInNav?.label, 'Show In Nav');
		assert.equal(mapper?.value, 'hierarchical-mapper');
		assert.equal(mapper?.type, 'string');
		assert.equal(mapper?.label, 'Descriptor Mapper');
		assert.equal(
			props.some((item) => item.name === 'merge-strategy'),
			false
		);
		const noTemplate = props.find((item) => item.name === 'no-template-required');
		assert.notEqual(noTemplate?.value, 'false');
		const xml = buildContentTypeXml(savedType(parsed));
		assert.equal(xml.includes('iceId'), false);
		assert.equal(xml.includes('undefined'), false);
	});

	// Given an extra form property and an unknown constraint, both survive a no-edit save and an unrelated field edit.
	it('keeps an extra form property and an unknown constraint after a no-edit save and an unrelated edit', () => {
		const parsed = parseLegacyFormDefinition({
			'content-type': '/page/custom',
			title: 'Custom',
			description: 'Original',
			objectType: 'page',
			imageThumbnail: 'page.png',
			properties: {
				property: [
					{
						name: 'display-template',
						label: 'Display Template',
						value: '/templates/web/custom.ftl',
						type: 'template'
					},
					{ name: 'placeInNav', label: 'Show In Nav', value: 'true', type: 'boolean' },
					{ name: 'plugin-flag', label: 'Plugin Flag', value: 'keep-me', type: 'string' },
					{ name: 'bare-flag', value: '1' }
				]
			},
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id: 'title_t',
							title: 'Title',
							description: '',
							type: 'input',
							iceId: 'title',
							constraints: {
								constraint: [
									{ name: 'pluginConstraint', label: 'Plugin rule', value: 'alpha', type: 'string' },
									{ name: 'required', value: 'true', type: 'boolean' },
									{ name: 'custom', value: 'x', type: 'string' }
								]
							}
						}
					}
				}
			}
		} as never);

		const before = formProperties(parsed);
		assert.equal(before.find((item) => item.name === 'plugin-flag')?.value, 'keep-me');
		assert.equal(before.find((item) => item.name === 'plugin-flag')?.type, 'string');
		assert.equal(before.find((item) => item.name === 'plugin-flag')?.label, 'Plugin Flag');
		assert.equal(before.find((item) => item.name === 'bare-flag')?.value, '1');
		assert.equal(before.find((item) => item.name === 'bare-flag')?.type, undefined);
		assert.deepEqual(
			before.map((item) => item.name),
			['display-template', 'placeInNav', 'plugin-flag', 'bare-flag']
		);
		const beforeConstraints = fieldConstraints(parsed, 'title_t');
		const pluginConstraint = beforeConstraints.find((item) => item.name === 'pluginConstraint');
		assert.equal(pluginConstraint?.value, 'alpha');
		assert.equal(pluginConstraint?.type, 'string');
		assert.equal(pluginConstraint?.label, 'Plugin rule');
		assert.deepEqual(
			beforeConstraints.map((item) => item.name),
			['pluginConstraint', 'required', 'custom']
		);
		assert.equal(buildContentTypeXml(savedType(parsed)).includes('iceId'), false);

		const values = createTypeFieldValuesObject(parsed.fields.title_t);
		values.title = 'Headline';
		const edited = reverseTypeFieldValuesObject(parsed.fields.title_t, values, inputDescriptor);
		const type = { ...parsed, description: 'Edited', fields: { ...parsed.fields, title_t: edited } };
		assert.equal(type.fields.title_t.name, 'Headline');
		const after = formProperties(type);
		assert.equal(after.find((item) => item.name === 'plugin-flag')?.value, 'keep-me');
		assert.equal(after.find((item) => item.name === 'plugin-flag')?.type, 'string');
		assert.equal(after.find((item) => item.name === 'plugin-flag')?.label, 'Plugin Flag');
		assert.equal(after.find((item) => item.name === 'display-template')?.value, '/templates/web/custom.ftl');
		const afterConstraints = fieldConstraints(type, 'title_t');
		assert.equal(afterConstraints.find((item) => item.name === 'pluginConstraint')?.value, 'alpha');
		assert.equal(afterConstraints.find((item) => item.name === 'pluginConstraint')?.type, 'string');
		assert.equal(afterConstraints.find((item) => item.name === 'pluginConstraint')?.label, 'Plugin rule');

		const retargeted = { ...parsed, displayTemplate: '/templates/web/other.ftl' };
		const retargetedProps = formProperties(retargeted);
		assert.equal(retargetedProps.find((item) => item.name === 'display-template')?.value, '/templates/web/other.ftl');
		assert.equal(retargetedProps.find((item) => item.name === 'plugin-flag')?.value, 'keep-me');
		assert.deepEqual(
			retargetedProps.map((item) => item.name),
			['display-template', 'placeInNav', 'plugin-flag', 'bare-flag']
		);
	});

	// Given required true stored next to other constraints, setting it to false writes that one entry in place.
	it('updates a stored required constraint in place', () => {
		const parsed = parseLegacyFormDefinition({
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
							id: 'title_t',
							title: 'Title',
							description: '',
							type: 'input',
							constraints: {
								constraint: [
									{ name: 'pluginConstraint', value: 'alpha', type: 'string' },
									{ name: 'required', value: 'true', type: 'string' },
									{ name: 'custom', value: 'x', type: 'string' }
								]
							}
						}
					}
				}
			}
		} as never);
		parsed.fields.title_t.validations.required = { id: 'required', value: false, level: 'required' };
		const constraints = fieldConstraints(parsed, 'title_t');
		assert.deepEqual(
			constraints.map((item) => item.name),
			['pluginConstraint', 'required', 'custom']
		);
		const required = constraints.filter((item) => item.name === 'required');
		assert.equal(required.length, 1);
		assert.equal(required[0].value, false);
		assert.equal(required[0].type, 'string');
	});

	// Given a pattern validation with no value, save does not write type "undefined".
	it('does not write a pattern constraint whose value is undefined', () => {
		const parsed = parseLegacyFormDefinition({
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
							id: 'title_t',
							title: 'Title',
							description: '',
							type: 'input',
							constraints: { constraint: { name: 'required', value: 'true', type: 'boolean' } }
						}
					}
				}
			}
		} as never);
		parsed.fields.title_t.validations.pattern = { id: 'pattern', value: undefined, level: 'required' };
		const constraints = fieldConstraints(parsed, 'title_t');
		assert.equal(
			constraints.some((item) => item.name === 'pattern' || item.type === 'undefined'),
			false
		);
		assert.equal(buildContentTypeXml(savedType(parsed)).includes('<type>undefined</type>'), false);
	});

	// Given a stored pattern of abc, clearing the pattern field (the string control saves '') drops the constraint.
	it('does not write a stored pattern back when the editor clears it', () => {
		const parsed = parseLegacyFormDefinition({
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
							id: 'title_t',
							title: 'Title',
							description: '',
							type: 'input',
							constraints: { constraint: { name: 'pattern', value: 'abc', type: 'string' } }
						}
					}
				}
			}
		} as never);
		const values = createTypeFieldValuesObject(parsed.fields.title_t);
		values.pattern = '';
		const edited = reverseTypeFieldValuesObject(parsed.fields.title_t, values, inputDescriptor);
		const type = { ...parsed, fields: { ...parsed.fields, title_t: edited } };
		const constraints = fieldConstraints(type, 'title_t');
		assert.equal(edited.validations.pattern?.value, '');
		assert.equal(
			constraints.some((item) => item.name === 'pattern'),
			false
		);
	});

	// A blank value is cleared for any constraint name, not only pattern.
	it('does not write a non-pattern constraint back when its value is blank', () => {
		const parsed = parseLegacyFormDefinition({
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
							id: 'title_t',
							title: 'Title',
							description: '',
							type: 'input',
							constraints: { constraint: { name: 'customRule', value: 'keep', type: 'string' } }
						}
					}
				}
			}
		} as never);
		parsed.fields.title_t.validations.customRule = { id: 'customRule', value: '   ', level: 'required' };
		const constraints = fieldConstraints(parsed, 'title_t');
		assert.equal(
			constraints.some((item) => item.name === 'customRule'),
			false
		);
	});
});

describe('allowed roles', () => {
	function withRoles(roles: string[]) {
		return parseLegacyFormDefinition({
			'content-type': '/page/article',
			title: 'Article',
			description: '',
			objectType: 'page',
			'allowed-roles': { role: roles },
			paths: {
				includes: { pattern: ['/site/website/.*'] },
				excludes: { pattern: ['/site/website/drafts/.*'] }
			},
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: { field: { id: 'title_t', title: 'Title', description: '', type: 'input' } }
				}
			}
		} as never);
	}

	// Given author and admin, save writes both role elements. Editing the list and clearing it updates the element, and an empty list omits it.
	it('round-trips roles and omits an empty list', () => {
		const parsed = withRoles(['author', 'admin']);
		assert.deepEqual(parsed.allowedRoles, ['author', 'admin']);
		assert.deepEqual(savedType(parsed)['allowed-roles']?.role, ['author', 'admin']);

		const edited = { ...parsed, allowedRoles: ['editor'] };
		assert.deepEqual(savedType(edited)['allowed-roles']?.role, ['editor']);

		const cleared = { ...parsed, allowedRoles: [] };
		assert.equal(savedType(cleared)['allowed-roles'], undefined);
		assert.equal(buildContentTypeXml(savedType(cleared)).includes('allowed-roles'), false);

		const blank = { ...parsed, allowedRoles: ['', '   '] };
		assert.equal(savedType(blank)['allowed-roles'], undefined);

		const messy = { ...parsed, allowedRoles: [' admin ', 'admin', 'editor', 'editor', '  '] };
		assert.deepEqual(savedType(messy)['allowed-roles']?.role, ['admin', 'editor']);
	});

	// Given stored roles with surrounding spaces and duplicates, read trims and de-dupes so the next save does not rewrite them.
	it('trims and de-dupes roles on read', () => {
		const parsed = withRoles([' admin ', 'admin', 'editor', 'editor', '  ']);
		assert.deepEqual(parsed.allowedRoles, ['admin', 'editor']);
		assert.deepEqual(savedType(parsed)['allowed-roles']?.role, ['admin', 'editor']);
	});

	// Given includes and excludes, a no-edit save writes the same patterns.
	it('keeps includes and excludes', () => {
		const parsed = withRoles(['author']);
		const paths = savedType(parsed).paths;
		assert.deepEqual(paths.includes?.pattern, ['/site/website/.*']);
		assert.deepEqual(paths.excludes?.pattern, ['/site/website/drafts/.*']);
	});

	// Given an empty allowed-roles element, or one role, the list is empty or that role.
	it('parses an empty allowed-roles element and a single role', () => {
		const empty = parseXml(
			'<form><content-type>/page/a</content-type><title>A</title><objectType>page</objectType><allowed-roles/></form>'
		);
		assert.deepEqual(empty.allowedRoles, []);
		const one = parseXml(
			'<form><content-type>/page/a</content-type><title>A</title><objectType>page</objectType><allowed-roles><role>author</role></allowed-roles></form>'
		);
		assert.deepEqual(one.allowedRoles, ['author']);
	});
});

describe('image thumbnail undefined', () => {
	// Given imageThumbnail undefined, the field is empty and save does not write undefined.
	it('discards the legacy undefined thumbnail', () => {
		const parsed = parseLegacyFormDefinition({
			'content-type': '/page/catalog',
			title: 'Catalog',
			description: '',
			objectType: 'page',
			imageThumbnail: 'undefined',
			sections: { section: [] }
		} as never);
		assert.equal(parsed.thumbnailFileName, null);
		assert.equal(savedType(parsed).imageThumbnail, undefined);
		assert.equal(buildContentTypeXml(savedType(parsed)).includes('undefined'), false);
	});
});

describe('checkbox group minSize type', () => {
	// Given a checkbox group minimum of 2, save writes the minSize constraint with type int.
	it('writes minSize as int', () => {
		const parsed = parseLegacyFormDefinition({
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
							constraints: { constraint: { name: 'minSize', value: '2', type: 'int' } }
						}
					}
				}
			}
		} as never);
		const minSize = fieldConstraints(parsed, 'topics_o').find((item) => item.name === 'minSize');
		assert.equal(minSize?.value, 2);
		assert.equal(minSize?.type, 'int');
	});
});

describe('form definition without sections', () => {
	// The config/dependency fixture's root is <fake>, so `.form` is a path string, not a form.
	it('does not throw when the definition is missing', () => {
		const fixture = parseXml(readFileSync(dependencyPath, 'utf8'));
		assert.deepEqual(fixture.sections, []);
		assert.doesNotThrow(() => prepareSerializeToXmlTypeObject(fixture));

		const bare = parseLegacyFormDefinition(undefined as never);
		assert.deepEqual(bare.sections, []);
		assert.doesNotThrow(() => prepareSerializeToXmlTypeObject(bare));
	});

	// Given a real form element with no sections child, the parser returns an empty section list.
	it('does not throw for a form element with no sections', () => {
		const parsed = parseXml(
			'<form><title>Plain</title><content-type>/page/plain</content-type><objectType>page</objectType><description></description></form>'
		);
		assert.equal(parsed.id, '/page/plain');
		assert.deepEqual(parsed.sections, []);
		assert.doesNotThrow(() => prepareSerializeToXmlTypeObject(parsed));
	});

	it('does not throw for a repeat with no nested fields', () => {
		const repeat = parseLegacyFormDefinition({
			'content-type': '/component/widget',
			title: 'Widget',
			description: '',
			objectType: 'component',
			sections: {
				section: {
					title: '',
					description: '',
					defaultOpen: 'false',
					fields: { field: { id: 'items_o', title: 'Items', description: '', type: 'repeat' } }
				}
			}
		} as never);
		assert.deepEqual(Object.keys(repeat.fields.items_o.fields ?? {}), []);
	});
});

describe('shipped form definitions', () => {
	function constraintSnap(field: { constraints?: { constraint?: unknown } } | undefined) {
		return namedList(field?.constraints?.constraint).map((item) => ({
			name: item?.name,
			value: item?.value == null ? '' : String(item.value),
			type: item?.type
		}));
	}

	function walkFields(fields: unknown, into: Map<string, ReturnType<typeof constraintSnap>>, prefix = '') {
		for (const field of namedList(
			fields as { id?: string; constraints?: { constraint?: unknown }; fields?: { field?: unknown } }
		)) {
			if (!field?.id) continue;
			const id = prefix ? `${prefix}.${field.id}` : field.id;
			into.set(id, constraintSnap(field));
			if (field.fields?.field) walkFields(field.fields.field, into, id);
		}
	}

	function formFiles(dir: string): string[] {
		const found: string[] = [];
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = resolve(dir, entry.name);
			if (entry.isDirectory()) found.push(...formFiles(path));
			else if (entry.name === 'form-definition.xml') found.push(path);
		}
		return found;
	}

	// Given every shipped form definition, a no-edit save keeps each field's constraints, including a blank minSize.
	it('does not drop constraints from the shipped blueprints', () => {
		const root = resolve(here, '../../../../../../studio/src/main/webapp/repo-bootstrap/global/blueprints');
		const files = formFiles(root);
		assert.ok(files.length >= 24);
		const losses: string[] = [];
		for (const file of files) {
			const xml = readFileSync(file, 'utf8');
			const original = deserialize(xml, {
				parseTagValue: false,
				tagValueProcessor: entityEncodingTagValueProcessor
			}).form;
			const originalConstraints = new Map<string, ReturnType<typeof constraintSnap>>();
			for (const section of namedList(original?.sections?.section)) {
				walkFields(section?.fields?.field, originalConstraints);
			}
			const saved = deserialize(buildContentTypeXml(savedType(parseLegacyFormDefinition(original))), {
				parseTagValue: false,
				tagValueProcessor: entityEncodingTagValueProcessor
			}).form;
			const savedConstraints = new Map<string, ReturnType<typeof constraintSnap>>();
			for (const section of namedList(saved?.sections?.section)) {
				walkFields(section?.fields?.field, savedConstraints);
			}
			for (const [fieldId, constraints] of originalConstraints) {
				const after = savedConstraints.get(fieldId) ?? [];
				if (JSON.stringify(constraints) !== JSON.stringify(after)) {
					losses.push(`${file} ${fieldId}: ${JSON.stringify(constraints)} -> ${JSON.stringify(after)}`);
				}
			}
		}
		assert.deepEqual(losses, []);
	});
});
