/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import { RenameContentDialogProps } from './RenameContentDialog';
import React, { useState } from 'react';
import { ensureSingleSlash, isBlank } from '../../utils/string';
import { RenameItemView } from '../RenameDialogBody';
import { DialogFooter } from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import { FormattedMessage } from 'react-intl';
import PrimaryButton from '../PrimaryButton';
import { useEnhancedDialogContext } from '../EnhancedDialog';
import { LightItem } from '../../models';
import { DialogBody } from '../DialogBody';
import { AjaxError } from 'rxjs/ajax';
import useDebouncedInput from '../../hooks/useDebouncedInput';
import { checkPathExistence } from '../../services/content';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { applyContentNameRules } from '../../utils/content';

export interface RenameContentDialogContainerProps extends Pick<
	RenameContentDialogProps,
	'path' | 'value' | 'onRenamed' | 'onClose' | 'validRenameValue' | 'maxLength'
> {
	dependantItems: LightItem[];
	fetchingDependantItems: boolean;
	error: AjaxError;
	fetchDependant(): void;
}

export function RenameContentDialogContainer(props: RenameContentDialogContainerProps) {
	const {
		path,
		value,
		validRenameValue = '',
		maxLength,
		onRenamed,
		onClose,
		fetchDependant,
		dependantItems,
		fetchingDependantItems,
		error
	} = props;
	const safeValue = value ?? '';
	const isPage = safeValue.includes('/index.xml');
	const itemName = getItemName(safeValue);
	const { isSubmitting, updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const [name, setName] = useState(itemName);
	const [itemExists, setItemExists] = useState(false);
	const exceedsMaxLength = maxLength != null && name.length > maxLength;
	const isValid = !isBlank(name) && !itemExists && !exceedsMaxLength && name !== itemName;
	const [confirmBrokenReferences, setConfirmBrokenReferences] = useState(false);
	const renameDisabled =
		isSubmitting || !isValid || fetchingDependantItems || (dependantItems?.length > 0 && !confirmBrokenReferences);
	const siteId = useActiveSiteId();

	const onNameUpdate$ = useDebouncedInput((name: string) => {
		if (name !== itemName && name !== getItemName(validRenameValue)) {
			checkPathExistence(siteId, `${ensureSingleSlash(`${path}/${name}`)}${isPage ? '/index.xml' : '.xml'}`).subscribe(
				(exists) => setItemExists(exists)
			);
		}
	}, 400);

	const onInputChanges = (newValue: string) => {
		setName(newValue);
		onNameUpdate$.next(newValue);
		const newHasPendingChanges = newValue !== itemName;
		updateSubmittingOrHasPendingChanges({ hasPendingChanges: newHasPendingChanges });
	};

	const onRename = () => {
		onRenamed(`${name}${isPage ? '/index.xml' : '.xml'}`);
	};

	return (
		<>
			<DialogBody>
				<RenameItemView
					name={name}
					disabled={renameDisabled}
					maxLength={maxLength}
					fetchDependant={fetchDependant}
					dependantItems={dependantItems}
					isSubmitting={isSubmitting}
					confirmBrokenReferences={confirmBrokenReferences}
					fetchingDependantItems={fetchingDependantItems}
					error={error}
					setConfirmBrokenReferences={setConfirmBrokenReferences}
					onRename={onRename}
					onInputChanges={(event) => onInputChanges(applyContentNameRules(event.target.value))}
					nameInvalid={itemExists || exceedsMaxLength}
					helperText={
						itemExists ? (
							<FormattedMessage defaultMessage="An item with that name already exists." />
						) : exceedsMaxLength ? (
							<FormattedMessage
								defaultMessage="The value is greater than the allowed maximum ({maxLength})."
								values={{ maxLength }}
							/>
						) : (
							<FormattedMessage defaultMessage="Consisting of lowercase letters without accents, numbers, dash (-) and underscore (_)." />
						)
					}
				/>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={(e) => onClose(e, null)} disabled={isSubmitting}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton onClick={onRename} disabled={renameDisabled} loading={isSubmitting}>
					<FormattedMessage id="words.rename" defaultMessage="Rename" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

/**
 * Gets the name of the content item by removing the file extension (`.xml` if the item is a component or `index.xml` if page).
 * The function checks if the input string represents a page (contains '/index.xml').
 * - If it is a page, it removes '/index.xml' from the string.
 * - Otherwise, it removes '.xml' from the string.
 *
 * @param {string} value - The file path or name to process.
 * @returns {string} - The stripped value without the file extension.
 */
function getItemName(value: string): string {
	const isPage = value.includes('/index.xml');
	return isPage ? value.replace('/index.xml', '') : value.replace('.xml', '');
}

export default RenameContentDialogContainer;
