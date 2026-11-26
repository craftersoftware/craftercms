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

import React, { useMemo, useState } from 'react';
import { EnhancedDialog, EnhancedDialogProps } from '../../EnhancedDialog';
import { ContentType, ContentTypeSection } from '../../../models';
import { createVirtualSection } from '../utils';
import { FormattedMessage } from 'react-intl';
import { DialogBody } from '../../DialogBody';
import { DialogFooter } from '../../DialogFooter';
import SecondaryButton from '../../SecondaryButton';
import PrimaryButton from '../../PrimaryButton';
import InsertPositionPicker from './InsertPositionPicker';

export interface SectionInsertionProps extends EnhancedDialogProps {
	type: ContentType;
	onInsertSection: (section: ContentTypeSection, position: number) => void;
}

export function SectionInsertionDialogBody({ type, onInsertSection, ...dialogProps }: SectionInsertionProps) {
	const [position, setPosition] = useState(type.sections.length);
	const items = useMemo(
		() => type.sections.map((section) => ({ id: section.id, label: section.title })),
		[type.sections]
	);

	const handleAccept = () => {
		onInsertSection?.(createVirtualSection({ title: 'New Section', fields: [] } as ContentTypeSection), position);
	};

	return (
		<>
			<DialogBody>
				<InsertPositionPicker
					items={items}
					value={position}
					onChange={setPosition}
					afterSelectLabel={<FormattedMessage defaultMessage="Section to insert after" />}
					emptyMode="firstOnly"
				/>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={(e) => dialogProps.onClose?.(e, null)}>
					<FormattedMessage defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton onClick={handleAccept}>
					<FormattedMessage defaultMessage="Accept" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export function SectionInsertionDialog({ type, onInsertSection, ...dialogProps }: SectionInsertionProps) {
	return (
		<EnhancedDialog
			{...dialogProps}
			maxWidth="xs"
			fullWidth
			title={<FormattedMessage defaultMessage="Insert New Section" />}
		>
			<SectionInsertionDialogBody type={type} onInsertSection={onInsertSection} {...dialogProps} />
		</EnhancedDialog>
	);
}

export default SectionInsertionDialog;
