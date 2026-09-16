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

import React, { useContext } from 'react';
import { useTheme } from '@mui/material/styles';
import { ItemContext, ItemMetaContext, StableFormContext } from '../lib/formsEngineContext';
import { useAtomValue, useStore as useJotaiStore } from 'jotai/index';
import useLocale from '../../../hooks/useLocale';
import { getFieldAtomValue } from '../lib/formUtils';
import { ContentItem } from '../../../models';
import { prettyPrintPerson } from '../../../utils/object';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import ItemTypeIcon from '../../ItemTypeIcon';
import Typography from '@mui/material/Typography';
import Chip, { chipClasses } from '@mui/material/Chip';
import { FormattedMessage, useIntl } from 'react-intl';
import { EditOffOutlined, EditOutlined } from '@mui/icons-material';
import CalendarTodayRounded from '@mui/icons-material/CalendarTodayRounded';
import ItemPublishingTargetIcon from '../../ItemPublishingTargetIcon';
import { getItemPublishingTargetText, getItemStateText } from '../../ItemDisplay/utils';
import ItemStateIcon from '../../ItemStateIcon';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { copyToClipboard } from '../../../utils/system';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import MenuOpenIcon from '@mui/icons-material/MenuOpenRounded';
import { XmlKeys } from '../lib/formConsts';
import { useAtom } from 'jotai';
import Collapse from '@mui/material/Collapse';
import { DraftChip } from '../../DraftChip';

export function EditModeHeader({ isEmbedded, collapse = false }: { isEmbedded: boolean; collapse?: boolean }) {
	const { atoms } = useContext(StableFormContext);
	const { id: objectId } = useContext(ItemMetaContext);
	const item = useContext(ItemContext);
	const store = useJotaiStore();
	const readonly = useAtomValue(atoms.readonly);
	const localeConf = useLocale();
	const isLargeContainer = useAtomValue(atoms.isLargeContainer);
	const { formatMessage } = useIntl();
	const itemLabel = isEmbedded
		? (getFieldAtomValue(atoms.valueByFieldId[XmlKeys.internalName], store) as string)
		: item.label;
	const typeIconItem: Pick<ContentItem, 'systemType' | 'mimeType'> = isEmbedded
		? { systemType: 'component', mimeType: 'application/xml' }
		: item;
	const formattedCreator = prettyPrintPerson(item.creator);
	const formattedCreationDate = new Intl.DateTimeFormat(localeConf.localeCode, {
		dateStyle: 'short'
	}).format(new Date(item.dateCreated));
	const formattedModifier = prettyPrintPerson(item.modifier);
	const formattedModifiedDate = new Intl.DateTimeFormat(localeConf.localeCode, {
		dateStyle: 'short'
	}).format(new Date(item.dateModified));
	// TODO: Tabs will be done at a later phase.
	// const [activeTab, setActiveTab] = useAtom(activeTabAtom);
	// const handleTabChange: TabsProps['onChange'] = (e, value) => setActiveTab(value);

	const handleCopyToClipboard = () => {
		copyToClipboard(item.path);
	};

	return (
        <>
            <Container className="space-y" sx={{ py: 1 }}>
				{/* Item display */}
				<Box
                    className="space-x"
                    sx={{
                        display: "flex",
                        alignItems: "center"
                    }}>
					{isLargeContainer && collapse && <CollapseToCButton />}
					<ItemTypeIcon item={typeIconItem} sx={{ color: 'info.main' }} />
					<Typography>{itemLabel}</Typography>
					{item.savedAsDraft && <DraftChip />}
					{readonly && (
						<Chip
							sx={{ [`.${chipClasses.label}`]: { display: 'flex', alignItems: 'center' } }}
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
					{collapse && (
						<Tooltip title={<FormattedMessage defaultMessage="Copy path to clipboard" />}>
							<IconButton size="small" onClick={handleCopyToClipboard} sx={{ padding: '1px', ml: 1 }}>
								<ContentCopyRounded fontSize="inherit" sx={{ color: 'text.secondary' }} />
							</IconButton>
						</Tooltip>
					)}
				</Box>
				<Collapse in={!collapse}>
					<Box
                        sx={{
                            display: "flex",
                            alignItems: "end",
                            justifyContent: "space-between"
                        }}>
						<Box className="space-y" sx={{ flexBasis: '50%' }}>
							{/* Item metadata */}
							<div>
								<Typography
                                    variant="body2"
                                    color="textSecondary"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexWrap: 'wrap',
                                        em: { fontWeight: 600 }
                                    }}>
									<Box
                                        component="span"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            marginRight: 1
                                        }}>
										<CalendarTodayRounded sx={{ mr: 0.25 }} fontSize="inherit" />
										<span>
											<FormattedMessage
												defaultMessage="Created {when} by <who>who</who>"
												values={{
													who: () => (
														<em key="0" title={formattedCreator.tooltip}>
															{formattedCreator.display}
														</em>
													),
													when: formattedCreationDate
												}}
											/>
										</span>
									</Box>
									<Box
                                        component="span"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center"
                                        }}>
										<EditOutlined sx={{ mr: 0.25 }} fontSize="inherit" />
										<span>
											<FormattedMessage
												defaultMessage="Updated {when} by <who>who</who>"
												values={{
													who: () => (
														<em key="0" title={formattedModifier.tooltip}>
															{formattedModifier.display}
														</em>
													),
													when: formattedModifiedDate
												}}
											/>
										</span>
									</Box>
								</Typography>
								<Typography
                                    variant="body2"
                                    color="textSecondary"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexWrap: 'wrap'
                                    }}>
									<Box
                                        component="span"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            marginRight: 1
                                        }}>
										<ItemPublishingTargetIcon fontSize="inherit" sxs={{ root: { marginRight: 0.25 } }} item={item} />{' '}
										{getItemPublishingTargetText(item.stateMap, formatMessage)}
									</Box>
									<Box
                                        component="span"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center"
                                        }}>
										<ItemStateIcon fontSize="inherit" sxs={{ root: { mr: 0.25 } }} item={item} />{' '}
										{getItemStateText(item.stateMap, formatMessage, {
											user: item.lockOwner?.username,
											draft: item.savedAsDraft
										})}
									</Box>
								</Typography>
							</div>
						</Box>
						<Box
                            className="space-y"
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "end",
                                maxWidth: '50%'
                            }}>
							<Typography
                                component="span"
                                variant="body2"
                                color="textSecondary"
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    overflow: 'hidden',
                                    maxWidth: '100%'
                                }}>
								<Box
									component="span"
									title={item.path}
									sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
								>
									{item.path}
									{/* Super-long test path: /Lorem/Ipsum/is/simply/dummy/text/of/the/printing/and/typesetting/industry/Lorem/Ipsum/has/been/the/industrys/standard/dummy/text/ever/since/the/1500s/when/an/unknown/printer/took/a/galley/of/type/and/scrambled/it/to/make/a/type/specimen/book.xml */}
								</Box>
								<Tooltip title={<FormattedMessage defaultMessage="Copy path to clipboard" />}>
									<IconButton size="small" onClick={handleCopyToClipboard} sx={{ padding: '1px', ml: 1 }}>
										<ContentCopyRounded fontSize="inherit" sx={{ color: 'text.secondary' }} />
									</IconButton>
								</Tooltip>
							</Typography>
							<Typography
                                component="span"
                                variant="body2"
                                color="textSecondary"
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    overflow: 'hidden',
                                    maxWidth: '100%'
                                }}>
								<Box
									component="span"
									title={objectId}
									sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
								>
									{objectId}
								</Box>
								<Tooltip title={<FormattedMessage defaultMessage="Copy ID to clipboard" />}>
									<IconButton
										size="small"
										sx={{ padding: '1px', ml: 1 }}
										onClick={() =>
											copyToClipboard(getFieldAtomValue(atoms.valueByFieldId[XmlKeys.modelId], store) as string)
										}
									>
										<ContentCopyRounded fontSize="inherit" sx={{ color: 'text.secondary' }} />
									</IconButton>
								</Tooltip>
							</Typography>
						</Box>
					</Box>
				</Collapse>
			</Container>
            <Collapse in={!collapse}>
				<Container maxWidth="xl" sx={{ display: 'flex' }}>
					{isLargeContainer && <CollapseToCButton />}
					{/*
					TODO: Disabling Tabs. Differed feature.
					<Tabs value={activeTab} onChange={handleTabChange} sx={{ minHeight: 0 }}>
						<DenseTab label={<FormattedMessage defaultMessage="Form" />} />
						<DenseTab label={<FormattedMessage defaultMessage="Preview" />} />
						<DenseTab label={<FormattedMessage defaultMessage="History" />} />
						<DenseTab label={<FormattedMessage defaultMessage="References" />} />
						<DenseTab label={<FormattedMessage defaultMessage="Template" />} />
						<DenseTab label={<FormattedMessage defaultMessage="Controller" />} />
						<DenseTab label={<FormattedMessage defaultMessage="Settings" />} />
					</Tabs>
					*/}
				</Container>
			</Collapse>
        </>
    );
}

function CollapseToCButton() {
	const theme = useTheme();
	const { atoms } = useContext(StableFormContext);
	const [collapseToC, setCollapseToC] = useAtom(atoms.collapseToC);
	const useCollapsedToC = useAtomValue(atoms.useCollapsedToC);

	return (
		<Tooltip title={<FormattedMessage defaultMessage="Collapse table of contents" />}>
			<IconButton
				size="small"
				onClick={() => setCollapseToC(!collapseToC)}
				sx={{
					// TODO: Tabs will be done at a later phase.
					// visibility: activeTab === 0 ? undefined : 'hidden',
					mr: 0.5
				}}
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
