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

import { CompareVersionsDialogContainerProps, SelectionContentVersion } from './utils';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CompareFieldPanel } from './CompareFieldPanel';
import DialogBody from '../DialogBody/DialogBody';
import { LoadingState } from '../LoadingState';
import useSpreadState from '../../hooks/useSpreadState';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { forkJoin } from 'rxjs';
import { fetchContentByCommitId } from '../../services/content';
import { fromString } from '../../utils/xml';
import { getContentInstanceXmlValueFromProp, parseContentXML } from '../../utils/content';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { ResizeableDrawer } from '../ResizeableDrawer';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import { FormattedMessage, useIntl } from 'react-intl';
import EmptyState from '../EmptyState';
import useSelection from '../../hooks/useSelection';
import ListItemText, { listItemTextClasses } from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { ItemTypeIcon } from '../ItemTypeIcon';
import palette from '../../styles/palette';
import { ErrorBoundary } from '../ErrorBoundary';
import Badge, { badgeClasses } from '@mui/material/Badge';
import Button from '@mui/material/Button';
import { getStudioContentInternalFields } from '../../utils/contentType';
import { FieldAccordionPanel } from './FieldAccordionPanel';
import FieldVersionToolbar from './FieldVersionToolbar';
import { initialFieldViewState, useVersionsDialogContext, VersionsDialogContextProps } from './VersionsDialogContext';
import { ContentInstance, ContentTypeField } from '../../models';
import { getCompareVersionDialogViewModes, setCompareVersionDialogViewModes } from '../../utils/state';
import useActiveUser from '../../hooks/useActiveUser';
import TextDiffView from './FieldsTypesDiffViews/TextDiffView';
import CompareAssetPanel from './CompareAssetPanel';

export function CompareVersionsDialogContainer(props: CompareVersionsDialogContainerProps) {
	const {
		selectedA,
		selectedB,
		selectionContent: preFetchedContent,
		fields,
		versionsBranch,
		contentTypesBranch,
		compareXml
	} = props;
	const [{ fieldsViewState, viewSlideOutState, compareSlideOutState }, contextApiRef] = useVersionsDialogContext();
	const disableKeyboardNavigation = viewSlideOutState.open || compareSlideOutState.open;
	const fieldsViewStateRef = useRef<VersionsDialogContextProps['fieldsViewState']>(undefined);
	fieldsViewStateRef.current = fieldsViewState;
	const compareVersionsBranch = versionsBranch?.compareVersionsBranch;
	const item = versionsBranch?.item;
	const isAsset = item?.systemType === 'asset';
	const baseUrl = useSelection<string>((state) => state.env.authoringBase);
	const { formatMessage } = useIntl();
	const { username } = useActiveUser();
	const viewModes = getCompareVersionDialogViewModes(username);
	const [showOnlyChanges, setShowOnlyChanges] = useState<boolean>(viewModes?.entireDiff ?? true);
	const [accordionView, setAccordionView] = useState<boolean>(viewModes?.accordionView ?? false);
	const [selectionContent, setSelectionContent] = useSpreadState<{
		a: SelectionContentVersion;
		b: SelectionContentVersion;
	}>(
		preFetchedContent ?? {
			a: {
				content: null,
				xml: null
			},
			b: {
				content: null,
				xml: null
			}
		}
	);
	const siteId = useActiveSiteId();
	const isCompareDataReady = useMemo(() => {
		if (preFetchedContent) {
			// Check that selectionContent is complete and synced with prefetchedContent
			return (
				selectionContent.a.content &&
				selectionContent.b.content &&
				selectionContent.a.xml === preFetchedContent.a.xml &&
				selectionContent.b.xml === preFetchedContent.b.xml
			);
		} else if (isAsset) {
			return compareVersionsBranch?.compareVersions && selectionContent.a.content && selectionContent.b.content;
		} else {
			return (
				compareVersionsBranch?.compareVersions &&
				contentTypesBranch?.byId &&
				item?.contentTypeId &&
				selectionContent.a.content &&
				selectionContent.b.content
			);
		}
	}, [
		preFetchedContent,
		compareVersionsBranch?.compareVersions,
		contentTypesBranch?.byId,
		item?.contentTypeId,
		selectionContent
	]);
	const [selectedField, setSelectedField] = useState<ContentTypeField>(null);
	const selectedFieldRef = useRef(null);
	selectedFieldRef.current = selectedField;
	const contentType = contentTypesBranch?.byId[item.contentTypeId];
	const contentTypeFields = useMemo(() => {
		return !isAsset && isCompareDataReady
			? [
					...Object.values(fields ?? contentType.fields),
					...(((selectionContent.a.content ?? selectionContent.b.content) as ContentInstance).craftercms
						? getStudioContentInternalFields(formatMessage)
						: [])
				]
			: [];
	}, [contentType, fields, isCompareDataReady, formatMessage, selectionContent, isAsset]);
	const fieldIdsWithChanges = useMemo(
		() =>
			contentTypeFields
				.filter(
					(field) =>
						getContentInstanceXmlValueFromProp(selectionContent.a.xml, field.id) !==
						getContentInstanceXmlValueFromProp(selectionContent.b.xml, field.id)
				)
				.map((field) => field.id),
		[contentTypeFields, selectionContent.a, selectionContent.b]
	);
	const filteredContentTypeFields = showOnlyChanges
		? contentTypeFields.filter((field) => fieldIdsWithChanges.includes(field.id))
		: contentTypeFields;
	const isFilteredFieldsEmpty = filteredContentTypeFields.length === 0;
	const sidebarRefs = useRef({});
	const fieldsRefs = useRef({});

	useEffect(() => {
		contextApiRef.current.setState({ enableDialogActions: !isAsset });
	}, [isAsset, contextApiRef]);

	useEffect(() => {
		if (preFetchedContent) {
			setSelectionContent(preFetchedContent);
		}
	}, [preFetchedContent, setSelectionContent]);

	useEffect(() => {
		// The dialog can handle 2 different set of props:
		// - selected versions of the history of an item, so we need to fetch the content we're going to diff
		// - pre-fetched content (and the fields of the content) so we don't need to fetch anything.
		if (!preFetchedContent && selectedA && selectedB) {
			const subscription = forkJoin([
				fetchContentByCommitId(siteId, selectedA.path, selectedA.versionNumber),
				fetchContentByCommitId(siteId, selectedB.path, selectedB.versionNumber)
			]).subscribe(([contentA, contentB]) => {
				if (isAsset) {
					setSelectionContent({
						a: { content: contentA as string },
						b: { content: contentB as string }
					});
				} else {
					setSelectionContent({
						a: {
							content: parseContentXML(fromString(contentA as string), selectedA.path, contentTypesBranch.byId, {}),
							xml: contentA as string
						},
						b: {
							content: parseContentXML(fromString(contentB as string), selectedB.path, contentTypesBranch.byId, {}),
							xml: contentB as string
						}
					});
				}
			});
			return () => subscription.unsubscribe();
		}
	}, [preFetchedContent, selectedA, selectedB, siteId, setSelectionContent, contentTypesBranch, isAsset]);

	useEffect(() => {
		if (contentTypeFields?.length && !fieldIdsWithChanges.includes(selectedFieldRef.current?.id)) {
			setSelectedField(
				contentTypeFields.filter((field) => (showOnlyChanges ? fieldIdsWithChanges.includes(field.id) : true))[0]
			);
		}
	}, [contentTypeFields, fieldIdsWithChanges, showOnlyChanges]);

	useEffect(() => {
		contentTypeFields?.forEach((field) => {
			sidebarRefs.current[field.id] = React.createRef<HTMLDivElement>();
			fieldsRefs.current[field.id] = React.createRef<HTMLDivElement>();
			fieldsViewStateRef.current[field.id] = initialFieldViewState;
		});
	}, [contentTypeFields]);

	const onSelectFieldFromContent = (field: ContentTypeField) => {
		setSelectedField(field);
		sidebarRefs.current[field.id]?.current?.scrollIntoView({ behavior: 'smooth' });
	};

	const onSelectFieldFromList = (field: ContentTypeField) => {
		setSelectedField(field);
		if (accordionView) {
			fieldsRefs.current[field.id]?.current?.scrollIntoView({ behavior: 'smooth' });
		}
	};

	const onToggleShowOnlyChanges = () => {
		setShowOnlyChanges(!showOnlyChanges);
		setCompareVersionDialogViewModes(username, { entireDiff: !showOnlyChanges, accordionView });
	};

	const onSetAccordionView = (value: boolean) => {
		setAccordionView(value);
		setCompareVersionDialogViewModes(username, { entireDiff: showOnlyChanges, accordionView: value });
	};

	return (
        <>
            <DialogBody
				sx={{
					overflow: 'auto',
					minHeight: '50vh',
					padding: 0,
					...(!selectedField && { display: 'flex', justifyContent: 'center', alignItems: 'center' })
				}}
			>
				{!isCompareDataReady ? (
					<LoadingState />
				) : compareVersionsBranch?.error || contentTypesBranch?.error ? (
					<ApiResponseErrorState error={compareVersionsBranch.error ?? contentTypesBranch.error} />
				) : compareXml ? (
					<TextDiffView aXml={selectionContent.a.xml} bXml={selectionContent.b.xml} editorProps={{ height: '100%' }} />
				) : (
					<>
						<ResizeableDrawer
							open={!isFilteredFieldsEmpty}
							width={280}
							sxs={{
								drawerBody: {
									display: 'flex',
									flexDirection: 'column',
									overflowY: 'inherit'
								},
								drawerPaper: {
									overflow: 'hidden',
									position: 'absolute'
								}
							}}
						>
							{contentType && (
								<Box
                                    sx={{
                                        pt: 1,
                                        pb: 1,
                                        pr: 2,
                                        pl: 2,
                                        borderBottom: 1,
                                        borderColor: "divider"
                                    }}>
									<Typography variant="body2" color="textSecondary">
										{contentType.id}
									</Typography>
									<Box
										component="span"
										sx={{
											display: 'inline-flex',
											alignItems: 'center',
											mt: 1
										}}
									>
										<ItemTypeIcon
											item={item}
											sx={{ fontSize: '1.4rem', marginRight: '5px', color: palette.teal.main }}
										/>
										<Typography>{contentType.name}</Typography>
									</Box>
								</Box>
							)}
							<List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
								{contentTypeFields
									.filter((field) => (showOnlyChanges ? fieldIdsWithChanges.includes(field.id) : true))
									.map((field) => (
										<Badge
											key={field.id}
											color="info"
											variant="dot"
											invisible={showOnlyChanges || !fieldIdsWithChanges.includes(field.id)}
											sx={{ width: '100%', [`& .${badgeClasses.badge}`]: { top: 10, right: 10 } }}
										>
											<ListItemButton
												onClick={() => onSelectFieldFromList(field)}
												selected={!accordionView && selectedField?.id === field.id}
												ref={sidebarRefs.current[field.id]}
											>
												<ListItemText
													primary={field.name}
													secondary={`${field.id} - ${field.type}`}
													sx={{
														m: 0,
														...(!showOnlyChanges && {
															[`.${listItemTextClasses.primary}`]: {
																fontWeight: fieldIdsWithChanges.includes(field.id) ? 600 : 'normal'
															}
														})
													}}
												/>
											</ListItemButton>
										</Badge>
									))}
							</List>
							<Box
                                sx={{
                                    width: "100%",
                                    borderTop: 1,
                                    borderColor: "divider"
                                }}>
								<Button onClick={() => onToggleShowOnlyChanges()}>
									{showOnlyChanges ? (
										<FormattedMessage defaultMessage="Entire version" />
									) : (
										<FormattedMessage defaultMessage="Changed fields" />
									)}
								</Button>
								<Button onClick={() => onSetAccordionView(!accordionView)}>
									{accordionView ? (
										<FormattedMessage defaultMessage="Single field" />
									) : (
										<FormattedMessage defaultMessage="All fields" />
									)}
								</Button>
							</Box>
						</ResizeableDrawer>
						<Box
							sx={{
								marginLeft: isFilteredFieldsEmpty ? 0 : '280px',
								height: '100%',
								width: isAsset ? '100%' : null,
								overflowY: 'auto'
							}}
						>
							<ErrorBoundary>
								{isAsset ? (
									<CompareAssetPanel
										// both 'a' and 'b' content will be string in case of asset.
										a={selectionContent.a.content as string}
										b={selectionContent.b.content as string}
										item={item}
									/>
								) : accordionView ? (
									contentTypeFields
										.filter((field) => (showOnlyChanges ? fieldIdsWithChanges.includes(field.id) : true))
										.map((field) => (
											<FieldAccordionPanel
												key={field.id}
												field={field}
												fieldRef={fieldsRefs.current[field.id]}
												selected={selectedField?.id === field.id}
												summary={
													<FieldVersionToolbar
														field={field}
														showFieldsNavigation={false}
														contentTypeFields={filteredContentTypeFields}
														isDiff={fieldIdsWithChanges.includes(field.id)}
														justContent={true}
														disableKeyboardNavigation={disableKeyboardNavigation}
													/>
												}
												details={
													<CompareFieldPanel
														a={{
															...selectedA,
															...compareVersionsBranch?.compareVersions?.[0],
															content: selectionContent.a.content,
															xml: selectionContent.a.xml
														}}
														b={{
															...selectedB,
															...compareVersionsBranch?.compareVersions?.[1],
															content: selectionContent.b.content,
															xml: selectionContent.b.xml
														}}
														field={field}
														onSelectField={onSelectFieldFromContent}
														dynamicHeight
													/>
												}
											/>
										))
								) : selectedField ? (
									<Box
                                        sx={{
                                            p: 2,
                                            height: "100%"
                                        }}>
										<FieldVersionToolbar
											field={selectedField}
											contentTypeFields={filteredContentTypeFields}
											onSelectField={onSelectFieldFromContent}
											isDiff={fieldIdsWithChanges.includes(selectedField.id)}
											disableKeyboardNavigation={disableKeyboardNavigation}
										/>
										<CompareFieldPanel
											a={{
												...selectedA,
												...compareVersionsBranch?.compareVersions?.[0],
												content: selectionContent.a.content,
												xml: selectionContent.a.xml
											}}
											b={{
												...selectedB,
												...compareVersionsBranch?.compareVersions?.[1],
												content: selectionContent.b.content,
												xml: selectionContent.b.xml
											}}
											field={selectedField}
											onSelectField={onSelectFieldFromContent}
										/>
									</Box>
								) : (
									<EmptyState
										sxs={{ root: { height: '100%', margin: 0 } }}
										title={
											isFilteredFieldsEmpty ? (
												<FormattedMessage defaultMessage="No differences in content detected. Check the XML diff to review changes." />
											) : (
												<FormattedMessage
													id="siteTools.selectTool"
													defaultMessage="Please select a field from the left."
												/>
											)
										}
										image={isFilteredFieldsEmpty ? undefined : `${baseUrl}/static-assets/images/choose_option.svg`}
									/>
								)}
							</ErrorBoundary>
						</Box>
					</>
				)}
			</DialogBody>
        </>
    );
}

export default CompareVersionsDialogContainer;
