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

import React, { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import visuallyHidden from '@mui/utils/visuallyHidden';
import { useDispatch } from 'react-redux';
import { ItemMetaContext, StableFormContext } from '../lib/formsEngineContext';
import { useFormItem } from '../lib/formItem';
import { useAtom, useAtomValue, useStore as useJotaiStore } from 'jotai';
import useLocale from '../../../hooks/useLocale';
import { getFieldAtomValue } from '../lib/formUtils';
import { ContentItem } from '../../../models';
import { prettyPrintPerson } from '../../../utils/object';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import ItemTypeIcon from '../../ItemTypeIcon';
import Typography from '@mui/material/Typography';
import Chip, { chipClasses } from '@mui/material/Chip';
import { defineMessages, FormattedMessage, type MessageDescriptor, useIntl } from 'react-intl';
import { EditOffOutlined, EditOutlined } from '@mui/icons-material';
import CalendarTodayRounded from '@mui/icons-material/CalendarTodayRounded';
import ItemPublishingTargetIcon from '../../ItemPublishingTargetIcon';
import { getItemPublishingTargetText, getItemStateText } from '../../ItemDisplay/utils';
import ItemStateIcon from '../../ItemStateIcon';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { copyToClipboard } from '../../../utils/system';
import { showSystemNotification } from '../../../state/actions/system';
import MenuOpenIcon from '@mui/icons-material/MenuOpenRounded';
import { XmlKeys } from '../lib/formConsts';
import { DraftChip } from '../../DraftChip';
import { formHeaderTitleMinHeight, iconButtonSmallSize } from './formHeaderMetrics';

export const formHeaderContainerName = 'formHeader';

const copyMessages = defineMessages({
	copyValue: { defaultMessage: 'Copy {value}' },
	copied: { defaultMessage: 'Copied' },
	copyFailed: { defaultMessage: 'Could not copy to the clipboard' }
});

const tocMessages = defineMessages({
	collapse: { defaultMessage: 'Collapse table of contents' },
	expand: { defaultMessage: 'Expand table of contents' }
});

const dateMessages = defineMessages({
	created: { defaultMessage: 'Created {when} by <who>who</who>' },
	updated: { defaultMessage: 'Updated {when} by <who>who</who>' }
});

// Theme spacing units. The title row uses `columnGap`; the toggle also keeps a small end margin.
const titleRowGap = 1;
const toggleMarginEnd = 0.5;
// Extra header width, past the `lg` container, so the shifted toggle stays inside the header.
// spacing(10) is 80px. Half of that plus the container padding (`spacing(3)`) covers the toggle shift.
const tocGutterSideAllowance = 10;
// Unwrapped minimum of this row (toggle, icon, both chips, 8ch title, 6ch path, gaps,
// and the header container padding) is about 406px. Wrap below that instead of overflowing.
const titleRowWrapBelow = 420;
const copiedVisibleMs = 1500;

const copyableValueSx: SxProps<Theme> = {
	display: 'flex',
	alignItems: 'center',
	minWidth: 0,
	maxWidth: '100%',
	overflow: 'hidden',
	p: 0,
	border: 0,
	backgroundColor: 'transparent',
	color: 'inherit',
	font: 'inherit',
	lineHeight: 'inherit',
	cursor: 'pointer',
	borderRadius: 0.5,
	'&:hover': {
		backgroundColor: 'action.hover'
	},
	'&:focus': {
		outline: 'none'
	},
	'&:focus-visible': {
		outlineStyle: 'solid',
		outlineWidth: 2,
		outlineColor: 'primary.main',
		outlineOffset: (theme) => theme.spacing(0.25)
	}
};

// Width of the small icon button, its end margin, and the title-row column gap.
function toggleGutterShift(theme: Theme) {
	return `${iconButtonSmallSize(theme)} + ${theme.spacing(toggleMarginEnd)} + ${theme.spacing(titleRowGap)}`;
}

function tocGutterQuery(theme: Theme) {
	return `@container ${formHeaderContainerName} (min-width: calc(${theme.breakpoints.values.lg}px + ${theme.spacing(tocGutterSideAllowance)}))`;
}

function titleRowWrapQuery() {
	return `@container ${formHeaderContainerName} (max-width: ${titleRowWrapBelow}px)`;
}

function CopyableValue({ value, children }: { value: string; children: ReactNode }) {
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const [copied, setCopied] = useState(false);
	const [liveMessage, setLiveMessage] = useState('');
	const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const requestId = useRef(0);
	const clearTimer = () => {
		if (resetTimer.current != null) {
			clearTimeout(resetTimer.current);
			resetTimer.current = null;
		}
	};
	useEffect(
		() => () => {
			requestId.current += 1;
			if (resetTimer.current != null) clearTimeout(resetTimer.current);
		},
		[]
	);
	const resetCopied = () => {
		clearTimer();
		setCopied(false);
		setLiveMessage('');
	};
	const copyLabel = formatMessage(copyMessages.copyValue, { value });
	const copiedLabel = formatMessage(copyMessages.copied);
	return (
		<>
			<Tooltip title={copied ? copiedLabel : copyLabel} slotProps={{ transition: { onExited: resetCopied } }}>
				<Box
					component="button"
					type="button"
					onClick={() => {
						clearTimer();
						setLiveMessage('');
						const id = ++requestId.current;
						copyToClipboard(value).then(
							() => {
								if (id !== requestId.current) return;
								setCopied(true);
								setLiveMessage(copiedLabel);
								resetTimer.current = setTimeout(resetCopied, copiedVisibleMs);
							},
							() => {
								if (id !== requestId.current) return;
								setCopied(false);
								dispatch(
									showSystemNotification({
										message: formatMessage(copyMessages.copyFailed),
										options: { variant: 'error' }
									})
								);
							}
						);
					}}
					sx={copyableValueSx}
				>
					{children}
				</Box>
			</Tooltip>
			<Box component="span" aria-live="polite" sx={visuallyHidden}>
				{liveMessage}
			</Box>
		</>
	);
}

export function EditModeHeader({ isEmbedded }: { isEmbedded: boolean }) {
	const { atoms } = useContext(StableFormContext);
	const item = useFormItem();
	const store = useJotaiStore();
	const readonly = useAtomValue(atoms.readonly);
	const isLargeContainer = useAtomValue(atoms.isLargeContainer);
	const itemLabel = isEmbedded
		? (getFieldAtomValue(atoms.valueByFieldId[XmlKeys.internalName], store) as string)
		: item.label;
	const typeIconItem: Pick<ContentItem, 'systemType' | 'mimeType'> = isEmbedded
		? { systemType: 'component', mimeType: 'application/xml' }
		: item;

	return (
		<Container sx={{ py: 1 }}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					minWidth: 0,
					columnGap: titleRowGap,
					minHeight: formHeaderTitleMinHeight,
					[titleRowWrapQuery()]: {
						flexWrap: 'wrap',
						rowGap: titleRowGap
					}
				}}
			>
				{isLargeContainer && <CollapseToCButton />}
				<ItemTypeIcon item={typeIconItem} sx={{ color: 'info.main', flexShrink: 0 }} />
				<Typography
					title={itemLabel}
					sx={{
						flex: '0 1 auto',
						minWidth: '8ch',
						display: '-webkit-box',
						WebkitLineClamp: 2,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden'
					}}
				>
					{itemLabel}
				</Typography>
				{item.savedAsDraft && <DraftChip />}
				{readonly && (
					<Chip
						sx={{ [`.${chipClasses.label}`]: { display: 'flex', alignItems: 'center' }, flexShrink: 0 }}
						color="warning"
						variant="outlined"
						label={
							<>
								<FormattedMessage defaultMessage="Readonly" />
								<EditOffOutlined fontSize="small" sx={{ ml: 1 }} />
							</>
						}
					/>
				)}
				<Box sx={{ flex: '1 0 6ch', minWidth: '6ch', display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
					<Typography
						component="span"
						variant="body2"
						color="textSecondary"
						sx={{
							display: 'flex',
							alignItems: 'center',
							overflow: 'hidden',
							maxWidth: '100%',
							minWidth: 0
						}}
					>
						<CopyableValue value={item.path}>
							<Box
								component="span"
								dir="ltr"
								sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', minWidth: 0 }}
							>
								{item.path}
							</Box>
						</CopyableValue>
					</Typography>
				</Box>
			</Box>
		</Container>
	);
}

function DateBy({
	icon,
	label,
	when,
	who
}: {
	icon: ReactNode;
	label: MessageDescriptor;
	when: string;
	who: { display: string; tooltip: string };
}) {
	return (
		<Box
			component="span"
			sx={{
				display: 'flex',
				alignItems: 'center',
				flexShrink: 0,
				maxWidth: '100%',
				whiteSpace: 'nowrap'
			}}
		>
			{icon}
			<Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
				<FormattedMessage
					{...label}
					values={{
						who: () => (
							<em key="0" title={who.tooltip}>
								{who.display}
							</em>
						),
						when
					}}
				/>
			</Box>
		</Box>
	);
}

export function EditModeMetadata() {
	const { id: objectId } = useContext(ItemMetaContext);
	const item = useFormItem();
	const localeConf = useLocale();
	const { formatMessage } = useIntl();
	const formattedCreator = prettyPrintPerson(item.creator);
	const formattedCreationDate = new Intl.DateTimeFormat(localeConf.localeCode, {
		dateStyle: 'short'
	}).format(new Date(item.dateCreated));
	const formattedModifier = prettyPrintPerson(item.modifier);
	const formattedModifiedDate = new Intl.DateTimeFormat(localeConf.localeCode, {
		dateStyle: 'short'
	}).format(new Date(item.dateModified));

	return (
		<Box
			sx={{
				display: 'flex',
				flexWrap: 'wrap',
				alignItems: 'flex-start',
				columnGap: 1,
				rowGap: 1
			}}
		>
			<Box sx={{ flex: '0 0 auto', maxWidth: '100%', minWidth: 0 }}>
				{/* Item metadata */}
				<div>
					<Typography
						variant="body2"
						color="textSecondary"
						sx={{
							display: 'flex',
							alignItems: 'center',
							flexWrap: 'wrap',
							columnGap: 1,
							em: { fontWeight: 600 }
						}}
					>
						<DateBy
							icon={<CalendarTodayRounded sx={{ mr: 0.25 }} fontSize="inherit" />}
							label={dateMessages.created}
							when={formattedCreationDate}
							who={formattedCreator}
						/>
						<DateBy
							icon={<EditOutlined sx={{ mr: 0.25 }} fontSize="inherit" />}
							label={dateMessages.updated}
							when={formattedModifiedDate}
							who={formattedModifier}
						/>
					</Typography>
					<Typography
						variant="body2"
						color="textSecondary"
						sx={{
							display: 'flex',
							alignItems: 'center',
							flexWrap: 'wrap',
							columnGap: 1
						}}
					>
						<Box
							component="span"
							sx={{
								display: 'flex',
								alignItems: 'center'
							}}
						>
							<ItemPublishingTargetIcon fontSize="inherit" sxs={{ root: { marginRight: 0.25 } }} item={item} />{' '}
							{getItemPublishingTargetText(item.stateMap, formatMessage)}
						</Box>
						<Box
							component="span"
							sx={{
								display: 'flex',
								alignItems: 'center'
							}}
						>
							<ItemStateIcon fontSize="inherit" sxs={{ root: { mr: 0.25 } }} item={item} />{' '}
							{getItemStateText(item.stateMap, formatMessage, {
								user: item.lockOwner?.username,
								draft: item.savedAsDraft
							})}
						</Box>
					</Typography>
				</div>
			</Box>
			{objectId && (
				<Typography
					component="span"
					variant="body2"
					color="textSecondary"
					sx={{
						alignSelf: 'flex-start',
						display: 'flex',
						justifyContent: 'flex-end',
						minWidth: '12ch',
						flex: '1 1 18ch',
						maxWidth: '100%',
						overflow: 'hidden',
						whiteSpace: 'nowrap',
						textAlign: 'end'
					}}
				>
					<CopyableValue value={objectId}>
						<Box
							component="span"
							dir="ltr"
							sx={{
								minWidth: 0,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap'
							}}
						>
							{objectId}
						</Box>
					</CopyableValue>
				</Typography>
			)}
		</Box>
	);
}

function CollapseToCButton() {
	const theme = useTheme();
	const { formatMessage } = useIntl();
	const { atoms } = useContext(StableFormContext);
	const [collapseToC, setCollapseToC] = useAtom(atoms.collapseToC);
	const useCollapsedToC = useAtomValue(atoms.useCollapsedToC);
	const expanded = !useCollapsedToC;
	const label = formatMessage(expanded ? tocMessages.collapse : tocMessages.expand);

	return (
		<Tooltip title={label}>
			<IconButton
				size="small"
				aria-label={label}
				aria-expanded={expanded}
				onClick={() => setCollapseToC(!collapseToC)}
				sx={(theme) => ({
					// TODO: Tabs will be done at a later phase.
					// visibility: activeTab === 0 ? undefined : 'hidden',
					marginInlineEnd: toggleMarginEnd,
					// Stay in flow so the line's size matches the toggle-inside state. Shift toward the
					// start by the button width plus the column gap, so the type icon meets the breadcrumb.
					[tocGutterQuery(theme)]: {
						marginInlineStart: `calc(-1 * (${toggleGutterShift(theme)}))`
					}
				})}
			>
				<MenuOpenIcon
					sx={{
						// Add transform to rotate 180deg when collapsed
						transform: useCollapsedToC ? 'rotate(180deg)' : 'none',
						// Animate the rotation
						transition: theme.transitions.create('transform', {
							duration: theme.transitions.duration.shortest
						})
					}}
				/>
			</IconButton>
		</Tooltip>
	);
}

export default EditModeHeader;
