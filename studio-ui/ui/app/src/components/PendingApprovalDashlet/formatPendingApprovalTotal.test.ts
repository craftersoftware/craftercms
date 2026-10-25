import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPendingApprovalTotal } from './formatPendingApprovalTotal.ts';

describe('formatPendingApprovalTotal', () => {
	it('omits the count until a number is known', () => {
		assert.equal(formatPendingApprovalTotal(null), '');
	});

	it('shows zero when there are no pending items', () => {
		assert.equal(formatPendingApprovalTotal(0), '(0)');
	});

	it('shows a positive count', () => {
		assert.equal(formatPendingApprovalTotal(3), '(3)');
	});
});
