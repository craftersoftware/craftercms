import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { studioDocumentTitle } from './studioDocumentTitle.ts';

describe('studioDocumentTitle', () => {
	it('prefixes the page name with the product', () => {
		assert.equal(studioDocumentTitle('Preview'), 'CrafterCMS - Preview');
	});

	it('returns the product name when the page title is blank', () => {
		assert.equal(studioDocumentTitle('   '), 'CrafterCMS');
	});
});
