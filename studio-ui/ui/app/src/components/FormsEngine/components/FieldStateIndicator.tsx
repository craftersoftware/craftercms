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
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { visuallyHidden } from '@mui/utils';
import { useAtomValue, type Atom } from 'jotai';
import { FormattedMessage } from 'react-intl';
import type { ContentTypeField } from '../../../models/ContentType';
import Asterisk from '../../../icons/Asterisk';
import type { FormsEngineAtoms } from '../lib/formsEngineContext';
import { XmlKeys } from '../lib/formConsts';
import useLoadableAtom, { type Loadable } from '../lib/useLoadableAtom';
import {
	hasFieldValidator,
	hasValidationKeyValidator,
	isEmptyValue,
	isFieldRequired,
	type FieldValidityState
} from '../lib/validators';

export type FieldStateIndicatorProps = {
	isRequired: boolean;
	hasValidator: boolean;
	isValid: boolean;
	isEmpty: boolean;
};

type FieldStateKind = 'complete' | 'required' | 'invalid';

type FieldIndicatorAtoms = Pick<FormsEngineAtoms, 'valueByFieldId' | 'validationByFieldId' | 'fileName'>;

const iconByKind: Record<FieldStateKind, ComponentType<SvgIconProps>> = {
	complete: CheckRounded,
	required: Asterisk,
	invalid: ErrorOutlineRounded
};

// These ids are the formatjs hashes of the default messages, so a catalogue entry keeps matching after extraction.
function FieldStateMessage({ kind }: { kind: FieldStateKind }) {
	if (kind === 'complete') return <FormattedMessage id="U78NhE" defaultMessage="Complete" />;
	if (kind === 'required') return <FormattedMessage id="Seanpx" defaultMessage="Required" />;
	return <FormattedMessage id="89T/ze" defaultMessage="Invalid" />;
}

function fieldStateKind({ isValid, isRequired, isEmpty }: FieldStateIndicatorProps): FieldStateKind {
	// A check when the value passes. An asterisk only for a required field that is still empty.
	// Any other failure uses an error icon, so the state is not the colour of an asterisk.
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
 */
export function useFieldStateIndicatorProps(
	field: ContentTypeField,
	atoms: FieldIndicatorAtoms
): {
	loading: boolean;
	value: unknown;
	props: FieldStateIndicatorProps;
	validityData: Loadable<Promise<FieldValidityState>>;
} {
	const { valueAtom, validationAtom } = fieldIndicatorAtoms(field.id, atoms);
	const value = useAtomValue(valueAtom ?? atoms.valueByFieldId[field.id]);
	const validityData = useLoadableAtom(validationAtom);
	const isValid = validityData.state === 'hasData' ? Boolean(validityData.data?.isValid) : true;
	return {
		loading: validityData.state === 'loading',
		value,
		validityData,
		props: {
			isRequired: isFieldRequired(field),
			hasValidator: hasFieldValidator(field.type) || hasValidationKeyValidator(field),
			isValid,
			isEmpty: isEmptyValue(field, value)
		}
	};
}

export function FieldStateIndicator({ isRequired, hasValidator, isValid, isEmpty }: FieldStateIndicatorProps) {
	// If there is no requirement and no validator, and the field is empty, do not show any indicator
	if (!isRequired && !hasValidator && isEmpty) return undefined;

	const kind = fieldStateKind({ isRequired, hasValidator, isValid, isEmpty });
	const Icon = iconByKind[kind];
	const message = <FieldStateMessage kind={kind} />;
	return (
		<Tooltip title={message}>
			{/*
			 * A span holds the tooltip ref. The icon is hidden from assistive tech; the same words sit in the
			 * label (or the table-of-contents entry) so the state is not colour alone and is not a second
			 * description on top of the field's error text.
			 */}
			<Box
				component="span"
				sx={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', lineHeight: 0 }}
			>
				<Icon fontSize="small" color={kind === 'complete' ? 'success' : 'error'} aria-hidden />
				<Box component="span" sx={visuallyHidden}>
					{', '}
					<FieldStateMessage kind={kind} />
				</Box>
			</Box>
		</Tooltip>
	);
}

export default FieldStateIndicator;
