/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { EnhancedDialog, EnhancedDialogProps } from '../../EnhancedDialog';
import { applyTranslations, PartialContentType } from '../utils';
import { FormattedMessage, useIntl } from 'react-intl';
import { DialogBody } from '../../DialogBody';
import { useEffect, useMemo, useState } from 'react';
import controlDescriptors from '../descriptors/controls';
import { SelectField } from './PickFieldDialog';
import { DialogFooter } from '../../DialogFooter';
import SecondaryButton from '../../SecondaryButton';
import PrimaryButton from '../../PrimaryButton';
import { systemFieldsIds } from '../../../utils/constants';

export interface SwapFieldDialogProps extends EnhancedDialogProps {
	currentFieldType: string;
	allowedTypeIds?: string[];
	onSwapField(newField: PartialContentType): void;
}

const types = Object.values(controlDescriptors).sort((a, b) => (a?.name > b?.name ? 1 : -1));

export function SwapFieldDialogBody(props: SwapFieldDialogProps) {
	const { currentFieldType, allowedTypeIds, onSwapField, onClose } = props;
	const [selectedField, setSelectedField] = useState<PartialContentType>(undefined);
	const { formatMessage } = useIntl();
	const disableSubmit = !selectedField || currentFieldType === selectedField?.id;
	const allowedTypes = useMemo(() => {
		return types.filter((type) => {
			if (!allowedTypeIds) {
				return true;
			} else {
				return allowedTypeIds.includes(type.id);
			}
		});
	}, [allowedTypeIds]);

	useEffect(() => {
		if (currentFieldType) {
			const newSelectedField = applyTranslations(
				allowedTypes.find((type) => type.id === currentFieldType),
				formatMessage
			);
			setSelectedField(newSelectedField);
		}
	}, [currentFieldType, formatMessage, allowedTypes]);

	return (
		<>
			<DialogBody sx={{ transition: 'height 0.3s ease-in-out', minHeight: '40vh' }}>
				<SelectField
					typesFullList={allowedTypes}
					selectedField={selectedField}
					setSelectedField={setSelectedField}
					systemFieldsIds={systemFieldsIds}
				/>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={(e) => onClose?.(e, null)}>
					<FormattedMessage defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton disabled={disableSubmit} onClick={() => onSwapField?.(selectedField)}>
					<FormattedMessage defaultMessage="Select" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export function SwapFieldDialog(props: SwapFieldDialogProps) {
	const { currentFieldType, onSwapField, ...dialogProps } = props;
	return (
		<EnhancedDialog title={<FormattedMessage defaultMessage="Swap Field" />} maxWidth="sm" {...dialogProps}>
			<SwapFieldDialogBody {...dialogProps} currentFieldType={currentFieldType} onSwapField={onSwapField} />
		</EnhancedDialog>
	);
}

export default SwapFieldDialog;
