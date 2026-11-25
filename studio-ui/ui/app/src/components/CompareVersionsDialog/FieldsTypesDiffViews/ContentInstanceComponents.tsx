/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import ContentInstance from '../../../models/ContentInstance';
import React, { useEffect, useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import useItemsByPath from '../../../hooks/useItemsByPath';
import {
	ContentInstanceComponentsDiffResult,
	DiffViewComponentBaseProps,
	getContentInstanceXmlItemFromIndex,
	getItemDiffStatus,
	SelectionContentVersion
} from '../utils';
import { diffArrays } from 'diff';
import Box from '@mui/material/Box';
import { EmptyState } from '../../EmptyState';
import LookupTable from '../../../models/LookupTable';
import DiffCollectionItem from './DiffCollectionItem';
import { useVersionsDialogContext } from '../VersionsDialogContext';
import { getMockContentInstance, parseElementByContentType } from '../../../utils/content';
import useContentTypes from '../../../hooks/useContentTypes';
import useSelection from '../../../hooks/useSelection';
import { fromString } from '../../../utils/xml';

export interface ContentInstanceComponentsProps extends DiffViewComponentBaseProps {}

export function ContentInstanceComponents(props: ContentInstanceComponentsProps) {
	const { aXml, bXml, field } = props;
	const contentTypes = useContentTypes();
	const controls = useSelection((state) => state.uiConfig?.controls);
	const { contentA, contentB } = useMemo(
		() => ({
			contentA: aXml
				? parseElementByContentType(
						fromString(aXml).querySelector(field.id),
						field,
						contentTypes,
						{},
						undefined,
						controls
					)
				: [],
			contentB: bXml
				? parseElementByContentType(
						fromString(bXml).querySelector(field.id),
						field,
						contentTypes,
						{},
						undefined,
						controls
					)
				: []
		}),
		[aXml, bXml, contentTypes, controls, field]
	);
	const [diff, setDiff] = useState<ContentInstanceComponentsDiffResult[]>(null);
	const itemsByPath = useItemsByPath();
	const contentById: LookupTable<ContentInstance> = useMemo(() => {
		const byId = {};
		[...(contentA ?? []), ...(contentB ?? [])].forEach((item) => {
			if (item.craftercms?.id) {
				byId[item.craftercms.id] = item;
			} else {
				byId[item.key] = item;
			}
		});
		return byId;
	}, [contentA, contentB]);
	const [{ viewSlideOutState, compareSlideOutState }, contextApiRef] = useVersionsDialogContext();

	const getItemLabel = (item: ContentInstance): string => {
		return item.craftercms?.label ?? itemsByPath?.[item.craftercms?.path]?.label ?? item.craftercms?.id ?? item.key;
	};

	const isEmbedded = (item: ContentInstance): boolean => {
		return item?.craftercms && !item.craftercms.path;
	};

	const getEmbeddedVersions = (
		id: string
	): {
		embeddedA: SelectionContentVersion;
		embeddedB: SelectionContentVersion;
	} => {
		const embeddedAIndex = contentA.findIndex((item) => item.craftercms?.id === id);
		const embeddedBIndex = contentB.findIndex((item) => item.craftercms?.id === id);
		return {
			embeddedA:
				embeddedAIndex !== -1
					? {
							content: contentA[embeddedAIndex] ?? getMockContentInstance(),
							xml: getContentInstanceXmlItemFromIndex(aXml, embeddedAIndex)
						}
					: null,
			embeddedB:
				embeddedBIndex !== -1
					? {
							content: contentB[embeddedBIndex] ?? getMockContentInstance(),
							xml: getContentInstanceXmlItemFromIndex(bXml, embeddedBIndex)
						}
					: null
		};
	};

	const embeddedItemChanged = (id: string): boolean => {
		const { embeddedA, embeddedB } = getEmbeddedVersions(id);
		// If one of the embedded components doesn't exist at a specific version, we consider it unchanged (because it's a new or deleted state, not changed).
		if (!embeddedA || !embeddedB) {
			return false;
		} else {
			return embeddedA.xml !== embeddedB.xml;
		}
	};

	const isEmbeddedWithChanges = (id: string): boolean => {
		return isEmbedded(contentById[id]) && embeddedItemChanged(id);
	};

	const onCompareEmbedded = (id: string) => {
		const { embeddedA, embeddedB } = getEmbeddedVersions(id);
		const contentTypeId =
			(embeddedA?.content as ContentInstance)?.craftercms.contentTypeId ??
			(embeddedB?.content as ContentInstance)?.craftercms.contentTypeId;
		const fields = contentTypes[contentTypeId]?.fields ?? {};
		// It may happen that one of the embedded components we're comparing is null (doesn't exist at a specific version),
		// in that scenario we use a mock (empty) content instance.
		contextApiRef.current.setState({
			viewSlideOutState: {
				...viewSlideOutState,
				open: false
			},
			compareSlideOutState: {
				...compareSlideOutState,
				open: true,
				selectionContent: {
					a: embeddedA,
					b: embeddedB
				},
				fields,
				title: field.name,
				subtitle: <FormattedMessage defaultMessage="{fieldId}" values={{ fieldId: field.id }} />,
				onClose: () => contextApiRef.current.closeSlideOuts()
			}
		});
	};

	const onViewEmbedded = (id: string) => {
		const { embeddedA, embeddedB } = getEmbeddedVersions(id);
		const embeddedComponent = embeddedA ?? embeddedB;
		const fields = contentTypes[(embeddedComponent.content as ContentInstance).craftercms.contentTypeId]?.fields ?? {};

		contextApiRef.current.setState({
			compareSlideOutState: {
				...compareSlideOutState,
				open: false
			},
			viewSlideOutState: {
				...viewSlideOutState,
				open: true,
				data: {
					content: embeddedComponent.content as ContentInstance,
					xml: embeddedComponent.xml,
					fields
				},
				title: field.name,
				subtitle: <FormattedMessage defaultMessage="{fieldId}" values={{ fieldId: field.id }} />,
				onClose: () => contextApiRef.current.closeSlideOuts()
			}
		});
	};

	useEffect(() => {
		setDiff(
			diffArrays(
				(contentA ?? []).map((item) => item.craftercms?.id ?? item.key),
				(contentB ?? []).map((item) => item.craftercms?.id ?? item.key)
			)
		);
	}, [contentA, contentB]);

	return (
		<Box
			component="section"
			sx={{
				display: 'flex',
				width: '100%',
				justifyContent: 'center'
			}}
		>
			<Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1100px', gap: '10px' }}>
				{diff?.length ? (
					diff.map((part) =>
						part.value.map((id) => (
							<DiffCollectionItem
								key={id}
								state={isEmbeddedWithChanges(id) ? 'changed' : getItemDiffStatus(part)}
								primaryText={getItemLabel(contentById[id])}
								secondaryText={
									contentById[id].craftercms &&
									(isEmbedded(contentById[id]) ? (
										<FormattedMessage defaultMessage="Embedded" />
									) : (
										(contentById[id].craftercms?.path ?? contentById[id].value)
									))
								}
								onSelect={() => {
									if (isEmbedded(contentById[id])) {
										isEmbeddedWithChanges(id) ? onCompareEmbedded(id) : onViewEmbedded(id);
									}
								}}
								disableHighlight={!isEmbedded(contentById[id])}
							/>
						))
					)
				) : (
					<EmptyState title={<FormattedMessage defaultMessage="No items" />} />
				)}
			</Box>
		</Box>
	);
}

export default ContentInstanceComponents;
