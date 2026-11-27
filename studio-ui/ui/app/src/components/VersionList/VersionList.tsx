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

import { FormattedDateParts, FormattedMessage, FormattedTime, useIntl } from 'react-intl';
import React, { useId, useState } from 'react';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import Tooltip from '@mui/material/Tooltip';
import { ItemHistoryEntry } from '../../models/Version';
import palette from '../../styles/palette';
import GlobalState from '../../models/GlobalState';
import { useSelection } from '../../hooks/useSelection';
import ListItemButton from '@mui/material/ListItemButton';
import Checkbox from '@mui/material/Checkbox';
import { createPresenceTable } from '../../utils/array';
import ListItem from '@mui/material/ListItem';

interface FancyFormattedDateProps {
	date: string;
	locale?: GlobalState['uiConfig']['locale'];
}

export function AsDayMonthDateTime(props: FancyFormattedDateProps) {
	const { date, locale } = props;
	const hour12 = locale?.dateTimeFormatOptions?.hour12 ?? true;

	return (
		<FormattedDateParts value={date} month="long" day="numeric" weekday="long" year="numeric">
			{(parts) => (
				<>
					{`${parts[0].value} ${parts[2].value} `}
					<FormattedMessage
						id="dateTime.ordinals"
						defaultMessage="{day, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
						values={{ day: parts[4].value }}
					/>{' '}
					{parts[6].value} @ <FormattedTime value={date} hour12={hour12} />
				</>
			)}
		</FormattedDateParts>
	);
}

const isTruncated = (el: Element | null) => Boolean(el && el.scrollWidth > el.clientWidth);

interface VersionListProps {
	versions: ItemHistoryEntry[];
	selected?: string[];
	current?: string;
	isSelectMode?: boolean;
	onItemClick(version: ItemHistoryEntry): void;
	onOpenMenu?(anchorEl: Element, version: ItemHistoryEntry, isCurrent: boolean, lastOne: boolean): void;
}

export function VersionList(props: VersionListProps) {
	const { versions, onOpenMenu, onItemClick, current, selected, isSelectMode = false } = props;
	const locale = useSelection<GlobalState['uiConfig']['locale']>((state) => state.uiConfig.locale);
	const selectedLookup = createPresenceTable(selected);
	const { formatMessage } = useIntl();
	const versionLabelId = useId();
	const [tooltipVersion, setTooltipVersion] = useState<string>(null);
	const closeTooltip = (versionNumber: string) => setTooltipVersion((open) => (open === versionNumber ? null : open));
	return (
		<List
			component="div"
			sx={{
				backgroundColor: (theme) => theme.palette.background.paper,
				padding: 0,
				borderRadius: '5px 5px 0 0'
			}}
			disablePadding
		>
			{versions.map((version: ItemHistoryEntry, i: number) => {
				const isSelected = Boolean(selectedLookup[version.versionNumber]);
				const labelId = `${versionLabelId}-${i}`;
				return (
					<ListItemButton
						key={version.versionNumber}
						component={ListItem}
						divider={versions.length - 1 !== i}
						onClick={() => onItemClick(version)}
						onFocus={(e) => {
							// Tooltip's own focus handling only covers its (non-focusable) child, so open it when the row is
							// focused via keyboard.
							if (e.target !== e.currentTarget) return;
							let isFocusVisible = false;
							try {
								isFocusVisible = e.currentTarget.matches(':focus-visible');
							} catch {
								// Selector not supported
							}
							if (isFocusVisible && isTruncated(e.currentTarget.querySelector('.MuiListItemText-secondary'))) {
								setTooltipVersion(version.versionNumber);
							}
						}}
						onBlur={() => closeTooltip(version.versionNumber)}
						sx={{ padding: '15px 48px 15px 20px' }}
						className={isSelected && 'selected'}
						secondaryAction={
							onOpenMenu || isSelectMode ? (
								<>
									{isSelectMode && (
										<Checkbox checked={isSelected} slotProps={{ input: { 'aria-labelledby': labelId } }} />
									)}
									{!isSelectMode && onOpenMenu && (
										<IconButton
											edge="end"
											size="large"
											onClick={(e) => {
												e.stopPropagation();
												onOpenMenu(
													e.currentTarget,
													version,
													current === version.versionNumber,
													versions.length === i + 1
												);
											}}
											aria-label={formatMessage({ defaultMessage: 'Options' })}
										>
											<MoreVertIcon />
										</IconButton>
									)}
								</>
							) : null
						}
					>
						<ListItemText
							sx={{ margin: 0 }}
							slotProps={{
								primary: { id: labelId, sx: { display: 'flex', alignItems: 'center' } },
								secondary: { sx: { whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' } }
							}}
							primary={
								<>
									<AsDayMonthDateTime date={version.modifiedDate} locale={locale} />
									{current === version.versionNumber && (
										<Chip
											label={<FormattedMessage id="historyDialog.current" defaultMessage="current" />}
											sx={{
												padding: '1px',
												backgroundColor: palette.green.main,
												height: 'auto',
												color: palette.white,
												marginLeft: '10px'
											}}
										/>
									)}
								</>
							}
							secondary={
								version.comment ? (
									<Tooltip
										describeChild
										title={version.comment}
										open={tooltipVersion === version.versionNumber}
										onOpen={(e) => {
											if (isTruncated((e.target as Element).closest('.MuiListItemText-secondary'))) {
												setTooltipVersion(version.versionNumber);
											}
										}}
										onClose={() => closeTooltip(version.versionNumber)}
										slotProps={{
											popper: { onClick: (e) => e.stopPropagation(), onMouseDown: (e) => e.stopPropagation() },
											tooltip: {
												sx: {
													maxWidth: 400,
													overflow: 'auto',
													whiteSpace: 'pre-wrap',
													wordBreak: 'break-word'
												}
											}
										}}
									>
										<span>{version.comment}</span>
									</Tooltip>
								) : null
							}
						/>
					</ListItemButton>
				);
			})}
		</List>
	);
}

export default VersionList;
