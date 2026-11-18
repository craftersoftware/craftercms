/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import ContextMenu, { ContextMenuOption } from '../ContextMenu';
import { markForTranslation } from '../../services/translation';
import { useDispatch } from 'react-redux';
import palette from '../../styles/palette';
import DialogBody from '../DialogBody/DialogBody';
import DialogHeader from '../DialogHeader';
import SingleItemSelector from '../SingleItemSelector';
import { ContentItem } from '../../models/Item';
import ActionsBar from '../ActionsBar';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useUnmount } from '../../hooks/useUnmount';
import Box from '@mui/material/Box';
import { pushErrorDialog } from '../../utils/system';

const translations: { [id: string]: any } = defineMessages({
	mark: {
		id: 'contentLocalization.mark',
		defaultMessage: 'Mark for translation'
	},
	approveTranslation: {
		id: 'contentLocalization.approve',
		defaultMessage: 'Approve translation'
	},
	deleteTranslation: {
		id: 'contentLocalization.delete',
		defaultMessage: 'Delete translation'
	},
	locales: {
		id: 'words.locales',
		defaultMessage: 'Locales'
	},
	status: {
		id: 'words.status',
		defaultMessage: 'Status'
	},
	edit: {
		id: 'words.edit',
		defaultMessage: 'Edit'
	},
	schedule: {
		id: 'words.schedule',
		defaultMessage: 'Schedule'
	},
	delete: {
		id: 'words.delete',
		defaultMessage: 'Delete'
	},
	approve: {
		id: 'words.approve',
		defaultMessage: 'Approve'
	},
	review: {
		id: 'words.review',
		defaultMessage: 'Review'
	}
});

const localizationMap: any = {
	en: 'English, US (en)',
	en_gb: 'English, UK (en_gb)',
	es: 'Spanish, Spain (es)',
	fr: 'French (fr)',
	de: 'German (de)'
};

const menuSections: ContextMenuOption[] = [
	{
		id: 'edit',
		label: translations.edit
	},
	{
		id: 'review',
		label: translations.review
	},
	{
		id: 'mark',
		label: translations.mark
	},
	{
		id: 'approve',
		label: translations.approve
	},
	{
		id: 'delete',
		label: translations.delete
	}
];

const menuOptions = [
	{
		id: 'edit',
		label: translations.edit
	},
	{
		id: 'schedule',
		label: translations.schedule
	},
	{
		id: 'delete',
		label: translations.delete
	},
	{
		id: 'approve',
		label: translations.approve
	}
];

interface ContentLocalizationDialogProps {
	open: boolean;
	locales: any;
	rootPath: string;
	item: ContentItem;
	onItemChange?(item: ContentItem): void;
	onClose?(): void;
	onClosed?(): void;
}

export function ContentLocalizationDialog(props: ContentLocalizationDialogProps) {
	const { open, onClose } = props;
	return (
		<Dialog open={open} onClose={onClose} fullWidth>
			<ContentLocalizationDialogUI {...props} />
		</Dialog>
	);
}

function ContentLocalizationDialogUI(props: ContentLocalizationDialogProps) {
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const { onClose, locales, item, rootPath, onItemChange } = props;
	const [selected, setSelected] = useState([]);
	const [openSelector, setOpenSelector] = useState(false);
	const site = useActiveSiteId();
	const [menu, setMenu] = useState({
		activeItem: null,
		anchorEl: null
	});

	const onOpenCustomMenu = (locale: any, anchorEl: Element) => {
		setMenu({
			activeItem: locale,
			anchorEl
		});
	};

	const onCloseCustomMenu = () => {
		setMenu({
			activeItem: null,
			anchorEl: null
		});
	};

	const onMenuItemClicked = (option: string) => {
		switch (option) {
			case 'mark': {
				markForTranslation(site, menu.activeItem.path, menu.activeItem.localeCode).subscribe(
					() => {
						setMenu({
							activeItem: null,
							anchorEl: null
						});
					},
					({ response }) => {
						dispatch(pushErrorDialog({ props: { error: response } }));
					}
				);
				break;
			}
			default:
				break;
		}
	};

	const handleSelect = (checked: boolean, id: string) => {
		const _selected = [...selected];
		if (checked) {
			if (!_selected.includes(id)) {
				_selected.push(id);
			}
		} else {
			let index = _selected.indexOf(id);
			if (index >= 0) {
				_selected.splice(index, 1);
			}
		}
		setSelected(_selected);
	};

	const toggleSelectAll = () => {
		if (locales.length === selected.length) {
			setSelected([]);
		} else {
			setSelected(locales.map((locale: any) => locale.id));
		}
	};

	const onOptionClicked = (option: string) => {
		// TODO: Widget menu option clicked
	};

	useUnmount(props.onClosed);

	return (
		<>
			<DialogHeader
				title={<FormattedMessage id="contentLocalization.title" defaultMessage="Content Localization" />}
				onCloseButtonClick={onClose}
			/>
			<DialogBody>
				<SingleItemSelector
					label={<FormattedMessage id="words.item" defaultMessage="Item" />}
					sxs={{ root: { marginBottom: '10px' } }}
					open={openSelector}
					onClose={() => setOpenSelector(false)}
					onDropdownClick={() => setOpenSelector(!openSelector)}
					rootPath={rootPath}
					selectedItem={item}
					onItemClicked={(item) => {
						onItemChange(item);
						setOpenSelector(false);
					}}
				/>
				<Box
					component="section"
					sx={{
						background: palette.white,
						border: '1px solid rgba(0, 0, 0, .125)',
						minHeight: '30vh',
						'& header': {
							marginBottom: '5px'
						}
					}}
				>
					{selected.length > 0 ? (
						<ActionsBar
							isIndeterminate={selected.length > 0 && selected.length < locales.length}
							onOptionClicked={onOptionClicked}
							options={menuOptions}
							isChecked={selected.length === locales.length}
							onCheckboxChange={toggleSelectAll}
						/>
					) : (
						<Box component="header" sx={{ display: 'flex', alignItems: 'center' }}>
							<Checkbox
								color="primary"
								sx={{ color: (theme) => theme.palette.primary.main }}
								onChange={toggleSelectAll}
								slotProps={{ input: { 'aria-label': formatMessage({ defaultMessage: 'Select all' }) } }}
							/>
							<>
								<Typography variant="subtitle2" sx={{ fontWeight: 'bold', paddingRight: '20px', width: '30%' }}>
									{formatMessage(translations.locales)}
								</Typography>
								<Typography variant="subtitle2" sx={{ fontWeight: 'bold', paddingRight: '20px' }}>
									{formatMessage(translations.status)}
								</Typography>
							</>
						</Box>
					)}
					{locales?.map((locale: any) => {
						const localeLabel = localizationMap[locale.localeCode];
						const localeName = localeLabel ?? locale.localeCode;
						return (
							<Box sx={{ display: 'flex', alignItems: 'center' }} key={locale.id}>
								<Checkbox
									color="primary"
									sx={{ color: (theme) => theme.palette.primary.main }}
									checked={selected?.includes(locale.id)}
									onChange={(event) => handleSelect(event.currentTarget.checked, locale.id)}
									slotProps={{
										input: { 'aria-label': formatMessage({ defaultMessage: 'Select {name}' }, { name: localeName }) }
									}}
								/>
								<Typography variant="subtitle2" sx={{ paddingRight: '20px', width: '30%' }}>
									{localeLabel}
								</Typography>
								<Typography variant="subtitle2" sx={{ paddingRight: '20px' }}>
									{locale.status}
								</Typography>
								<IconButton
									aria-label={formatMessage({ defaultMessage: 'Options for {name}' }, { name: localeName })}
									sx={{ marginLeft: 'auto', padding: '9px' }}
									onClick={(e) => onOpenCustomMenu(locale, e.currentTarget)}
									size="large"
								>
									<MoreVertIcon />
								</IconButton>
							</Box>
						);
					})}
				</Box>
			</DialogBody>
			<ContextMenu
				anchorEl={menu.anchorEl}
				open={Boolean(menu.anchorEl)}
				sx={{ width: '182px' }}
				onClose={onCloseCustomMenu}
				options={[menuSections]}
				onMenuItemClicked={onMenuItemClicked}
			/>
		</>
	);
}

export default ContentLocalizationDialog;
