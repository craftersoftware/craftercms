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

import { createContext } from 'react';

/** Form-level polite live region. The default is a no-op so fields can render outside a form shell. */
export const FormValidationAnnouncerContext = createContext<(message: string) => void>(() => {});

/**
 * Bubbled from a control that mounts its visible surface after the field's layout effect
 * (TinyMCE's iframe). The field listens and links aria attributes onto that surface.
 */
export const FIELD_CONTROL_READY_EVENT = 'craftercms-field-control-ready';

/** True after Save was pressed on an invalid form, so later blurs may announce an error. */
export const FormSaveAttemptedContext = createContext(false);

/** Ids this module writes onto a control, so a later pass can replace them. */
const MANAGED_DESCRIBED_BY_ATTR = 'data-field-a11y-describedby';

const FIELD_CONTROL_SELECTOR = [
	'input:not([type="hidden"])',
	'textarea',
	'select',
	'[role="combobox"]',
	'[role="textbox"]',
	'[role="switch"]',
	'[role="checkbox"]',
	'[role="radio"]',
	'[contenteditable="true"]'
].join(', ');

const TINYMCE_IFRAME_SELECTOR = 'iframe.tox-edit-area__iframe';

export interface FieldControlA11yOptions {
	/** Space-separated ids of the description and error text. */
	describedBy?: string;
	required: boolean;
	invalid: boolean;
}

function elementIdSelector(id: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return `#${CSS.escape(id)}`;
	}
	return `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function setAttributeIfChanged(element: HTMLElement, name: string, value: string | null): void {
	if (value == null) {
		if (element.hasAttribute(name)) element.removeAttribute(name);
		return;
	}
	if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/**
 * Hidden from assistive tech or not shown. TinyMCE hides its textarea this way.
 * `allowCollapsed` treats a control that is hidden only because its accordion section is
 * collapsed (`visibility: hidden` from MUI Collapse) as present, so it can still be linked and counted.
 */
export function isHiddenFieldControl(element: HTMLElement, allowCollapsed = false): boolean {
	if (element.getAttribute('aria-hidden') === 'true') return true;
	if (element.closest('[aria-hidden="true"]')) return true;
	if (element instanceof HTMLInputElement && element.type === 'hidden') return true;
	const view = element.ownerDocument.defaultView;
	if (!view) return false;
	const style = view.getComputedStyle(element);
	if (style.display === 'none') return true;
	if (style.visibility === 'hidden') return !(allowCollapsed && collapsedAccordionOf(element));
	return false;
}

/** `aria-required` is not allowed on role=switch. Native `required` on a checkbox input is. */
function supportsAriaRequired(element: HTMLElement): boolean {
	if (element.getAttribute('role') === 'switch') return false;
	const role = element.getAttribute('role');
	if (role === 'textbox' || role === 'combobox' || role === 'checkbox' || role === 'radio' || role === 'searchbox') {
		return true;
	}
	if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
	if (element instanceof HTMLInputElement) return true;
	return element.getAttribute('contenteditable') === 'true';
}

export function mergeDescribedByIds(...values: Array<string | null | undefined>): string | undefined {
	const ids = values.flatMap((value) => (value ? value.split(/\s+/).filter(Boolean) : []));
	const unique = [...new Set(ids)];
	return unique.length ? unique.join(' ') : undefined;
}

function collectControls(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll(FIELD_CONTROL_SELECTOR)].filter(
		(node): node is HTMLElement => node instanceof HTMLElement
	);
}

/**
 * The visible control for a form field. A hidden TinyMCE textarea is skipped in favour of
 * `iframe.tox-edit-area__iframe`, which is the surface that can take focus.
 */
export function resolveFieldControl(root: ParentNode, htmlFor?: string): HTMLElement | null {
	const candidates: HTMLElement[] = [];
	if (htmlFor) {
		const byId = root.querySelector(elementIdSelector(htmlFor));
		if (byId instanceof HTMLElement) {
			if (byId.matches(FIELD_CONTROL_SELECTOR)) candidates.push(byId);
			else {
				const inner = byId.querySelector(FIELD_CONTROL_SELECTOR);
				if (inner instanceof HTMLElement) candidates.push(inner);
			}
		}
	}
	candidates.push(...collectControls(root));
	const visible = candidates.find((element) => !isHiddenFieldControl(element, true));
	if (visible) return visible;
	const iframe = root.querySelector(TINYMCE_IFRAME_SELECTOR);
	if (iframe instanceof HTMLElement) return iframe;
	return null;
}

function clearManagedA11y(element: HTMLElement): void {
	const previousManaged = element.getAttribute(MANAGED_DESCRIBED_BY_ATTR);
	const previousManagedIds = new Set(previousManaged ? previousManaged.split(/\s+/).filter(Boolean) : []);
	if (!previousManagedIds.size && !element.hasAttribute(MANAGED_DESCRIBED_BY_ATTR)) return;
	const kept = (element.getAttribute('aria-describedby') ?? '')
		.split(/\s+/)
		.filter((id) => id && !previousManagedIds.has(id));
	setAttributeIfChanged(element, 'aria-describedby', kept.join(' ') || null);
	setAttributeIfChanged(element, MANAGED_DESCRIBED_BY_ATTR, null);
	setAttributeIfChanged(element, 'aria-invalid', null);
	setAttributeIfChanged(element, 'aria-required', null);
}

/**
 * Links the visible control to helper/error text and exposes required + invalid.
 * Writes are skipped when the attribute already has the same value.
 * A previous hidden target (the TinyMCE textarea) has the managed attributes removed.
 */
export function applyFieldControlA11y(control: HTMLElement, options: FieldControlA11yOptions): void {
	const fieldRoot = control.closest('[data-field-id]') ?? control.parentElement;
	if (fieldRoot) {
		fieldRoot.querySelectorAll(`[${MANAGED_DESCRIBED_BY_ATTR}]`).forEach((node) => {
			if (node instanceof HTMLElement && node !== control) clearManagedA11y(node);
		});
	}

	const { describedBy, required, invalid } = options;
	const previousManaged = control.getAttribute(MANAGED_DESCRIBED_BY_ATTR);
	const previousManagedIds = new Set(previousManaged ? previousManaged.split(/\s+/).filter(Boolean) : []);
	const kept = (control.getAttribute('aria-describedby') ?? '')
		.split(/\s+/)
		.filter((id) => id && !previousManagedIds.has(id));
	const next = mergeDescribedByIds(kept.join(' '), describedBy);
	setAttributeIfChanged(control, 'aria-describedby', next ?? null);
	setAttributeIfChanged(control, MANAGED_DESCRIBED_BY_ATTR, describedBy ?? null);

	if (required && supportsAriaRequired(control)) {
		setAttributeIfChanged(control, 'aria-required', 'true');
	} else if (!supportsAriaRequired(control)) {
		setAttributeIfChanged(control, 'aria-required', null);
	}

	if (
		required &&
		'required' in control &&
		(control instanceof HTMLInputElement ||
			control instanceof HTMLTextAreaElement ||
			control instanceof HTMLSelectElement) &&
		!control.required
	) {
		control.required = true;
	}

	setAttributeIfChanged(control, 'aria-invalid', invalid ? 'true' : 'false');
}

export function readDescribedText(control: HTMLElement): string {
	const ids = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
	return ids
		.map((id) => control.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
		.filter(Boolean)
		.join(' ');
}

/** The field's error text, when this module linked an `*-error` description id. */
export function readInvalidMessage(control: HTMLElement): string {
	const ids = control.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
	const errorId = ids.find((id) => id.endsWith('-error'));
	if (!errorId) return '';
	return control.ownerDocument.getElementById(errorId)?.textContent?.trim() ?? '';
}

/** Accordion whose summary is collapsed. MUI then hides the section with visibility:hidden. */
function collapsedAccordionOf(element: HTMLElement): HTMLElement | null {
	const accordion = element.closest('.MuiAccordion-root');
	if (!(accordion instanceof HTMLElement)) return null;
	const summary = accordion.querySelector('.MuiAccordionSummary-root');
	if (summary instanceof HTMLElement && summary.getAttribute('aria-expanded') === 'false') return accordion;
	return null;
}

function focusSurface(invalid: HTMLElement): HTMLElement | null {
	if (!isHiddenFieldControl(invalid)) return invalid;
	const field = invalid.closest('[data-field-id]');
	const iframe = field?.querySelector(TINYMCE_IFRAME_SELECTOR);
	// TinyMCE's textarea stays in the DOM and keeps aria-invalid until the iframe is linked.
	if (iframe instanceof HTMLIFrameElement) return iframe;
	// A collapsed section hides the real control. Keep that control; the caller expands first.
	// Substituting the label would move focus off the field the error belongs to.
	if (collapsedAccordionOf(invalid)) return invalid;
	const label = field?.querySelector('label');
	if (label instanceof HTMLElement) {
		if (!label.hasAttribute('tabindex')) label.tabIndex = -1;
		return label;
	}
	return null;
}

function focusAndReveal(target: HTMLElement): boolean {
	target.focus();
	const active = target.ownerDocument.activeElement;
	if (active !== target) return false;
	if (typeof target.scrollIntoView === 'function') {
		target.scrollIntoView({ block: 'center', inline: 'nearest' });
	}
	return true;
}

function focusAfterAccordionExpand(accordion: HTMLElement, target: HTMLElement): void {
	const collapse = accordion.querySelector('.MuiCollapse-root');
	if (!(collapse instanceof HTMLElement)) {
		focusAndReveal(target);
		return;
	}
	const doc = target.ownerDocument;
	const view = doc.defaultView;
	const origin = doc.activeElement;
	const startedAt = Date.now();
	let finished = false;
	let timer = 0;
	const finish = () => {
		if (finished) return;
		finished = true;
		collapse.removeEventListener('transitionend', onTransitionEnd);
		if (view) view.clearTimeout(timer);
		// The user may have moved on while the section opened. Do not take focus back from them.
		const active = doc.activeElement;
		if (active && active !== target && active !== origin && active !== doc.body) return;
		focusAndReveal(target);
	};
	const onTransitionEnd = (event: Event) => {
		const transition = event as TransitionEvent;
		if (transition.target !== collapse) return;
		if (transition.propertyName && transition.propertyName !== 'height') return;
		finish();
	};
	// MUI sizes the Collapse duration from the content height, so a tall section takes longer than
	// a fixed delay. After the first 400 ms keep waiting until MUI marks the Collapse as entered
	// (it does so even when there is no CSS transition), with a hard cap.
	const check = () => {
		if (finished) return;
		if (!collapse.isConnected) {
			// The form was unmounted or the section removed while waiting. Nothing left to focus.
			finished = true;
			collapse.removeEventListener('transitionend', onTransitionEnd);
			return;
		}
		if (collapse.classList.contains('MuiCollapse-entered') || Date.now() - startedAt >= 2000) finish();
		else timer = view?.setTimeout(check, 50) ?? 0;
	};
	collapse.addEventListener('transitionend', onTransitionEnd);
	timer = view?.setTimeout(check, 400) ?? 0;
}

/** Helper text FormsEngineField renders as a direct child of the field while the field is invalid. */
const FIELD_ERROR_SELECTOR = '[data-field-id] > [id$="-error"]';
const INVALID_ENTRY_SELECTOR = `[data-area-id="formBody"] [aria-invalid="true"], [data-area-id="formBody"] ${FIELD_ERROR_SELECTOR}`;

/**
 * Controls that have no native input (repeat, node selector, image and video pickers) never
 * get `aria-invalid`, but their field still shows an error. Returns that field, or null when the
 * node is a linked control or the field has one.
 */
function unlinkedInvalidField(node: Element): HTMLElement | null {
	if (!node.matches(FIELD_ERROR_SELECTOR)) return null;
	const field = node.parentElement;
	if (!(field instanceof HTMLElement) || field.querySelector('[aria-invalid="true"]')) return null;
	return field;
}

/** First tabbable control in the body of a field (not its label row, help or inheritance alert), else its label. */
function unlinkedFieldTarget(field: HTMLElement, errorId: string): HTMLElement | null {
	const header = field.firstElementChild;
	const candidates = field.querySelectorAll('button, a[href], [tabindex="0"]');
	for (const candidate of candidates) {
		if (!(candidate instanceof HTMLElement) || candidate.hasAttribute('disabled')) continue;
		if (candidate.tabIndex < 0 || header?.contains(candidate)) continue;
		const skipped = candidate.closest('.MuiAlert-root, .MuiCollapse-root, [role="menu"]');
		if (skipped && field.contains(skipped)) continue;
		const ids = (candidate.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
		if (!ids.includes(errorId)) candidate.setAttribute('aria-describedby', [...ids, errorId].join(' '));
		return candidate;
	}
	const label = field.querySelector('label');
	if (label instanceof HTMLElement) {
		if (!label.hasAttribute('tabindex')) label.tabIndex = -1;
		return label;
	}
	return null;
}

/**
 * Moves focus to the first invalid control in the form body.
 * A collapsed section is expanded first: its fields are visibility:hidden, so they must not be
 * skipped before the summary is opened. Focus waits until the Collapse height transition ends,
 * then scrolls the field into view. A hidden TinyMCE textarea is focused via its iframe. A field
 * with an error but no linked control is focused on its first tabbable control, or its label.
 */
export function focusFirstInvalidField(root: ParentNode | null): HTMLElement | null {
	if (!root) return null;
	const entries = root.querySelectorAll(INVALID_ENTRY_SELECTOR);
	for (const invalid of entries) {
		if (!(invalid instanceof HTMLElement)) continue;
		const unlinked = unlinkedInvalidField(invalid);
		if (invalid.matches(FIELD_ERROR_SELECTOR) && !unlinked) continue;
		const target = unlinked ? unlinkedFieldTarget(unlinked, invalid.id) : focusSurface(invalid);
		if (!target) continue;
		const accordion = collapsedAccordionOf(invalid) ?? collapsedAccordionOf(target);
		if (accordion) {
			const summary = accordion.querySelector('.MuiAccordionSummary-root');
			if (summary instanceof HTMLElement) summary.click();
			focusAfterAccordionExpand(accordion, target);
			return target;
		}
		if (isHiddenFieldControl(target)) continue;
		if (focusAndReveal(target)) return target;
	}
	return null;
}

/**
 * Invalid fields, including ones inside a collapsed section and ones whose control has no native
 * input. A hidden TinyMCE textarea and its editor iframe count as one field. A textarea that
 * TinyMCE has hidden, with the section open, is not counted on its own.
 */
export function countInvalidFields(root: ParentNode | null): number {
	if (!root) return 0;
	const fields = new Set<Element>();
	root.querySelectorAll(INVALID_ENTRY_SELECTOR).forEach((node) => {
		if (!(node instanceof HTMLElement)) return;
		const unlinked = unlinkedInvalidField(node);
		if (node.matches(FIELD_ERROR_SELECTOR) && !unlinked) return;
		if (!unlinked && isHiddenFieldControl(node, true)) return;
		fields.add(unlinked ?? node.closest('[data-field-id]') ?? node);
	});
	return fields.size;
}
