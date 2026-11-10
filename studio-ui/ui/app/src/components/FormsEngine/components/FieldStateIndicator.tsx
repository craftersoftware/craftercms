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

import React, { type ComponentType } from 'react';
import CheckRounded from '@mui/icons-material/CheckRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import type { Theme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { useAtomValue, type Atom } from 'jotai';
import { useIntl } from 'react-intl';
import type { ContentTypeField } from '../../../models/ContentType';
import Asterisk from '../../../icons/Asterisk';
import type { FormsEngineAtoms } from '../lib/formsEngineContext';
import { XmlKeys } from '../lib/formConsts';
import useLoadableAtom, { type Loadable } from '../lib/useLoadableAtom';
import {
	hasFieldValidator,
	hasValidationKeyValidator,
	isFieldRequired,
	isFieldValueEmpty,
	type FieldValidityMessage,
	type FieldValidityState
} from '../lib/validators';
import { translateValidityMessage } from './FieldValidityMessages';

export type FieldStateIndicatorProps = {
	isRequired: boolean;
	hasValidator: boolean;
	isValid: boolean;
	isEmpty: boolean;
	/** First validation message. Spoken with "Required." when a required field fails for a reason other than being empty. */
	detail?: FieldValidityMessage;
	/** Hidden state words. The table of contents sets this; a field label does not, because the control already exposes required and invalid. */
	announce?: boolean;
};

/**
 * Label-only inputs to {@link useFieldStateIndicatorProps}.
 * The table of contents and the form alert do not receive `isValid`: they follow the validation atom.
 * A follow-up will move the image picker's rejected-URL check into validation.
 */
export type FieldStateIndicatorOptions = {
	/** When set, replaces the validation atom's verdict for this label and its control. */
	isValid?: boolean;
};

type FieldStateKind = 'complete' | 'required' | 'invalid';

type FieldIndicatorAtoms = Pick<FormsEngineAtoms, 'valueByFieldId' | 'validationByFieldId' | 'fileName'>;

const iconByKind: Record<FieldStateKind, ComponentType<SvgIconProps>> = {
	complete: CheckRounded,
	required: Asterisk,
	invalid: WarningAmberRounded
};

/** Asterisk in the icon's empty upper-left. Size and nudge are fractions of the icon, so 16px and 20px share one placement. */
function badgeSx(color: 'success' | 'error') {
	return (theme: Theme) => ({
		position: 'absolute',
		width: '52%',
		height: '52%',
		left: '10%',
		top: 0,
		// In the triangle's empty upper-left, above the stroke, not in the gap before the icon.
		transform: 'translate(0, -28%)',
		color: theme.palette[color].main,
		overflow: 'visible',
		pointerEvents: 'none',
		'& path': {
			stroke: theme.palette.background.paper,
			strokeWidth: 2,
			paintOrder: 'stroke',
			strokeLinejoin: 'round'
		}
	});
}

function RequiredBadge({ color, children }: { color: 'success' | 'error'; children: React.ReactNode }) {
	return (
		<Box component="span" sx={{ display: 'inline-flex', position: 'relative', lineHeight: 0 }}>
			{children}
			<Asterisk aria-hidden sx={badgeSx(color)} />
		</Box>
	);
}

function fieldStateKind({ isValid, isRequired, isEmpty }: FieldStateIndicatorProps): FieldStateKind {
	// A check when the value passes. An asterisk only for a required field that is still empty.
	// Any other failure uses the warning triangle. A filled required field adds the asterisk badge.
	if (isValid) return 'complete';
	if (isRequired && isEmpty) return 'required';
	return 'invalid';
}

/**
 * The value and validation atoms the table of contents reads for `fieldId`.
 * `file-name` is the dedicated filename atom. A missing atom is left missing so the caller can skip the row.
 */
export function fieldIndicatorAtoms(
	fieldId: string,
	atoms: FieldIndicatorAtoms
): { valueAtom: Atom<unknown> | undefined; validationAtom: Atom<Promise<FieldValidityState>> | undefined } {
	return {
		valueAtom: fieldId === XmlKeys.fileName ? atoms.fileName : atoms.valueByFieldId[fieldId],
		validationAtom: atoms.validationByFieldId[fieldId]
	};
}

/**
 * The same required / validator / valid / empty values for a field label and its table-of-contents row.
 * While validation is still loading, the field counts as valid, matching the previous indicator.
 * `options.isValid` is only for the label that passes it. The table of contents calls this without it.
 */
export function useFieldStateIndicatorProps(
	field: ContentTypeField,
	atoms: FieldIndicatorAtoms,
	options?: FieldStateIndicatorOptions
): {
	loading: boolean;
	value: unknown;
	props: FieldStateIndicatorProps;
	validityData: Loadable<Promise<FieldValidityState>>;
} {
	const { valueAtom, validationAtom } = fieldIndicatorAtoms(field.id, atoms);
	const value = useAtomValue(valueAtom ?? atoms.valueByFieldId[field.id]);
	const validityData = useLoadableAtom(validationAtom);
	// Loading counts as valid, matching the previous indicator. A failed validation run is not a pass.
	const derivedValid =
		validityData.state === 'hasData' ? Boolean(validityData.data?.isValid) : validityData.state !== 'hasError';
	// `options.isValid` is the label override. Undefined keeps the atom's verdict.
	const isValid = options?.isValid ?? derivedValid;
	const detail = validityData.state === 'hasData' ? validityData.data?.messages?.[0] : undefined;
	return {
		loading: validityData.state === 'loading',
		value,
		validityData,
		props: {
			isRequired: isFieldRequired(field),
			hasValidator: hasFieldValidator(field.type) || hasValidationKeyValidator(field),
			isValid,
			isEmpty: isFieldValueEmpty(field, value),
			detail
		}
	};
}

function stateWords(
	kind: FieldStateKind,
	isRequired: boolean,
	detail: string | undefined,
	formatMessage: ReturnType<typeof useIntl>['formatMessage']
): string {
	if (kind === 'required') return formatMessage({ defaultMessage: 'Required' });
	if (kind === 'complete' && isRequired) return formatMessage({ defaultMessage: 'Required, complete' });
	if (kind === 'complete') return formatMessage({ defaultMessage: 'Complete' });
	if (isRequired && detail) return formatMessage({ defaultMessage: 'Required. {detail}' }, { detail });
	if (isRequired) return formatMessage({ defaultMessage: 'Required. Invalid' });
	return formatMessage({ defaultMessage: 'Invalid' });
}

export function FieldStateIndicator({
	isRequired,
	hasValidator,
	isValid,
	isEmpty,
	detail,
	announce = true
}: FieldStateIndicatorProps) {
	const { formatMessage } = useIntl();
	// If there is no requirement and no validator, and the field is empty, do not show any indicator
	if (!isRequired && !hasValidator && isEmpty) return undefined;

	const kind = fieldStateKind({ isRequired, hasValidator, isValid, isEmpty });
	const color = kind === 'complete' ? 'success' : 'error';
	const Icon = iconByKind[kind];
	const icon = <Icon fontSize="small" color={color} aria-hidden />;
	// The full asterisk is the empty-required state. A filled required field keeps a small asterisk on that icon.
	const marked = isRequired && kind !== 'required';
	const detailText = detail ? translateValidityMessage(detail, formatMessage) : undefined;
	const words = stateWords(kind, isRequired, detailText, formatMessage);
	return (
		<Tooltip title={words}>
			{/*
			 * A span holds the tooltip ref. The icons are hidden from assistive tech; the same words are the
			 * tooltip and, in the table of contents, the entry's name. The badge asterisk is not a second "required".
			 */}
			<Box
				component="span"
				sx={{
					display: 'inline-flex',
					alignItems: 'center',
					verticalAlign: 'middle',
					lineHeight: 0,
					// Room so the badge, which sits in the icon's corner, does not meet the last letter.
					ml: 0.5
				}}
			>
				{marked ? <RequiredBadge color={color}>{icon}</RequiredBadge> : icon}
				{announce && (
					<Box component="span" sx={visuallyHidden}>
						{', '}
						{words}
					</Box>
				)}
			</Box>
		</Tooltip>
	);
}

export default FieldStateIndicator;
