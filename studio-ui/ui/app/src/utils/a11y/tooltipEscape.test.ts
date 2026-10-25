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
import test from 'node:test';
import {
	findShownTooltip,
	isTooltipEscapeRedispatch,
	shouldInterceptTooltipEscape,
	TOOLTIP_ESCAPE_REDISPATCH,
	type TooltipEscapeNode,
	type TooltipEscapeRoot
} from './tooltipEscape.ts';

class ClassList {
	private readonly tokens: Set<string>;
	constructor(value: string) {
		this.tokens = new Set(value.split(/\s+/).filter(Boolean));
	}
	contains(token: string) {
		return this.tokens.has(token);
	}
}

function node(
	className: string,
	parent: TooltipEscapeNode | null = null,
	inlineOpacity?: string
): TooltipEscapeNode & { parent: TooltipEscapeNode | null } {
	const element = {
		parent,
		classList: new ClassList(className),
		style: inlineOpacity === undefined ? {} : { opacity: inlineOpacity },
		closest(selector: string) {
			let current: (TooltipEscapeNode & { parent?: TooltipEscapeNode | null }) | null = element;
			while (current) {
				if (selector === '.MuiTooltip-popper' && current.classList.contains('MuiTooltip-popper')) return current;
				current = current.parent ?? null;
			}
			return null;
		}
	};
	return element;
}

/** Real MUI 9.4 shape: popper (no popperClose class) > .MuiTooltip-tooltip, which is the faded node. */
function root(
	tooltips: Array<{ display?: string; visibility?: string; opacity?: string; inlineOpacity?: string }>
): TooltipEscapeRoot {
	const tips = tooltips.map((tooltip) => {
		const popper = node('MuiTooltip-popper MuiTooltip-popperInteractive');
		const tip = node('MuiTooltip-tooltip', popper, tooltip.inlineOpacity);
		return { tip, tooltip };
	});
	return {
		querySelectorAll(selector: string) {
			if (selector !== '.MuiTooltip-tooltip') return [];
			return tips.map((entry) => entry.tip);
		},
		defaultView: {
			getComputedStyle(element: TooltipEscapeNode) {
				const match = tips.find((entry) => entry.tip === element);
				return {
					display: match?.tooltip.display ?? 'block',
					visibility: match?.tooltip.visibility ?? 'visible',
					opacity: match?.tooltip.opacity ?? '1'
				};
			}
		}
	};
}

test('findShownTooltip uses the inner tooltip, including a fade that has not reached opacity 0', () => {
	assert.equal(findShownTooltip(root([{}]))?.classList.contains('MuiTooltip-tooltip'), true);
	assert.equal(findShownTooltip(root([{ display: 'none' }])), null);
	assert.equal(findShownTooltip(root([{ visibility: 'hidden' }])), null);
	assert.equal(findShownTooltip(root([{ opacity: '0' }])), null);
	assert.equal(findShownTooltip(root([{ inlineOpacity: '0', opacity: '1' }])), null);
});

test('Escape is intercepted only while a tooltip is shown', () => {
	const shown = root([{}]);
	const hidden = root([{ opacity: '0' }]);
	assert.equal(shouldInterceptTooltipEscape({ key: 'Escape' }, shown), true);
	assert.equal(shouldInterceptTooltipEscape({ key: 'Enter' }, shown), false);
	assert.equal(shouldInterceptTooltipEscape({ key: 'Escape' }, hidden), false);
	const redispatched = { key: 'Escape', [TOOLTIP_ESCAPE_REDISPATCH]: true };
	assert.equal(isTooltipEscapeRedispatch(redispatched), true);
	assert.equal(shouldInterceptTooltipEscape(redispatched, shown), false);
});
