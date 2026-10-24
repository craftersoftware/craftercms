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

import {
	Children,
	cloneElement,
	createContext,
	Fragment,
	isValidElement,
	type ReactElement,
	type ReactNode
} from 'react';

/** Form-level polite live region. The default is a no-op so fields can render outside a form shell. */
export const FormValidationAnnouncerContext = createContext<(message: string) => void>(() => {});

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

const INPUT_MUI_NAMES = new Set(['MuiInputBase', 'MuiInput', 'MuiOutlinedInput', 'MuiFilledInput', 'MuiTextField']);

const TOGGLE_MUI_NAMES = new Set(['MuiSwitch', 'MuiCheckbox', 'MuiRadio']);

export interface FieldControlA11yOptions {
	/** Space-separated ids of the description and error text. */
	describedBy?: string;
	required: boolean;
	invalid: boolean;
}

type MuiComponentType = { muiName?: string };

function elementIdSelector(id: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return `#${CSS.escape(id)}`;
	}
	return `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

export function mergeDescribedByIds(...values: Array<string | null | undefined>): string | undefined {
	const ids = values.flatMap((value) => (value ? value.split(/\s+/).filter(Boolean) : []));
	const unique = [...new Set(ids)];
	return unique.length ? unique.join(' ') : undefined;
}

/**
 * The focusable control for a form field. `htmlFor` wins when it points at an element inside `root`
 * (MUI inputs put that id on the native control; Switch forwards `id` to its input).
 */
export function resolveFieldControl(root: ParentNode, htmlFor?: string): HTMLElement | null {
	if (htmlFor) {
		const byId = root.querySelector(elementIdSelector(htmlFor));
		if (byId instanceof HTMLElement) {
			if (byId.matches(FIELD_CONTROL_SELECTOR)) return byId;
			const inner = byId.querySelector(FIELD_CONTROL_SELECTOR);
			if (inner instanceof HTMLElement) return inner;
			return byId;
		}
	}
	const found = root.querySelector(FIELD_CONTROL_SELECTOR);
	return found instanceof HTMLElement ? found : null;
}

/**
 * Links the control to helper/error text and exposes required + invalid.
 * Safe to call again after a child re-render: managed description ids are replaced, not duplicated.
 */
export function applyFieldControlA11y(control: HTMLElement, options: FieldControlA11yOptions): void {
	const { describedBy, required, invalid } = options;
	const previousManaged = control.getAttribute(MANAGED_DESCRIBED_BY_ATTR);
	const previousManagedIds = new Set(previousManaged ? previousManaged.split(/\s+/).filter(Boolean) : []);
	const kept = (control.getAttribute('aria-describedby') ?? '')
		.split(/\s+/)
		.filter((id) => id && !previousManagedIds.has(id));
	const next = mergeDescribedByIds(kept.join(' '), describedBy);
	if (next) control.setAttribute('aria-describedby', next);
	else control.removeAttribute('aria-describedby');
	if (describedBy) control.setAttribute(MANAGED_DESCRIBED_BY_ATTR, describedBy);
	else control.removeAttribute(MANAGED_DESCRIBED_BY_ATTR);

	if (required) {
		control.setAttribute('aria-required', 'true');
		if ('required' in control) {
			(control as HTMLInputElement).required = true;
		}
	}

	control.setAttribute('aria-invalid', invalid ? 'true' : 'false');
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

/** Moves focus to the first invalid control in the form body, expanding a collapsed section when needed. */
export function focusFirstInvalidField(root: ParentNode | null): HTMLElement | null {
	if (!root) return null;
	const invalid = root.querySelector('[data-area-id="formBody"] [aria-invalid="true"]');
	if (!(invalid instanceof HTMLElement)) return null;
	const summary = invalid.closest('.MuiAccordion-root')?.querySelector('.MuiAccordionSummary-root');
	if (summary instanceof HTMLElement && summary.getAttribute('aria-expanded') === 'false') {
		summary.click();
	}
	const target = invalid.matches(FIELD_CONTROL_SELECTOR) ? invalid : invalid.querySelector(FIELD_CONTROL_SELECTOR);
	const focusTarget = target instanceof HTMLElement ? target : invalid;
	focusTarget.focus();
	return focusTarget;
}

function a11yInputProps(
	existing: Record<string, unknown> | undefined,
	options: FieldControlA11yOptions
): Record<string, unknown> {
	const describedBy = mergeDescribedByIds(
		typeof existing?.['aria-describedby'] === 'string' ? (existing['aria-describedby'] as string) : undefined,
		options.describedBy
	);
	return {
		...existing,
		'aria-describedby': describedBy,
		'aria-invalid': options.invalid,
		...(options.required ? { required: true, 'aria-required': true } : {})
	};
}

/**
 * Copies error/required association onto MUI inputs and switches so a later render does not drop it.
 * `InputBase` writes `aria-describedby` from `inputProps` (spread after its own prop). `Switch` forwards
 * `slotProps.input` and `required` to the native input; `inputProps` would land on the root instead.
 * Other controls are linked from the DOM in `FormsEngineField`.
 */
export function enhanceFieldControl(child: ReactNode, options: FieldControlA11yOptions): ReactNode {
	if (!isValidElement(child)) return child;
	if (child.type === Fragment) {
		return cloneElement(
			child,
			{},
			Children.map((child.props as { children?: ReactNode }).children, (nested) => enhanceFieldControl(nested, options))
		);
	}
	const muiName = (child.type as MuiComponentType)?.muiName;
	const props = child.props as Record<string, unknown>;
	if (muiName && INPUT_MUI_NAMES.has(muiName)) {
		const describedBy = mergeDescribedByIds(
			typeof props['aria-describedby'] === 'string' ? (props['aria-describedby'] as string) : undefined,
			options.describedBy
		);
		return cloneElement(child as ReactElement<Record<string, unknown>>, {
			'aria-describedby': describedBy,
			...(options.required ? { required: true } : {}),
			inputProps: a11yInputProps(props.inputProps as Record<string, unknown> | undefined, options)
		});
	}
	if (muiName && TOGGLE_MUI_NAMES.has(muiName)) {
		const slotProps = (props.slotProps ?? {}) as {
			input?: Record<string, unknown> | ((ownerState: unknown) => Record<string, unknown>);
		};
		const inputSlot = slotProps.input;
		const input =
			typeof inputSlot === 'function'
				? (ownerState: unknown) => a11yInputProps(inputSlot(ownerState) ?? {}, options)
				: a11yInputProps(inputSlot, options);
		return cloneElement(child as ReactElement<Record<string, unknown>>, {
			...(options.required ? { required: true } : {}),
			slotProps: {
				...slotProps,
				input
			}
		});
	}
	return child;
}
