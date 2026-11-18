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
import React, { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowDown';
import { camelize } from '../../utils/string';
import { Filter as FilterType, SearchFacet } from '../../models/Search';
import CheckIcon from '@mui/icons-material/Check';
import { LookupTable } from '../../models/LookupTable';
import SiteSearchSortBy from '../SiteSearchSortBy';
import SiteSearchSortOrder from '../SiteSearchSortOrder';
import SiteSearchFilter from '../SiteSearchFilter';
import PathSelector from '../SiteSearchPathSelector';
import Button from '@mui/material/Button';
import MuiAccordion, { accordionClasses } from '@mui/material/Accordion';
import MuiAccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Divider from '@mui/material/Divider';
import { useSpreadState } from '../../hooks/useSpreadState';
import { styled } from '@mui/material/styles';
import useContentTypes from '../../hooks/useContentTypes';
import { getMimeTypeTranslation } from '../../utils/mimeTypes';
import Box from '@mui/material/Box';
import { SORT_AUTO } from '../Search/utils';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';

interface SiteSearchFiltersProps {
	className?: string;
	facets: SearchFacet[];
	sx?: SxProps<Theme>;
	sortBy?: string;
	sortOrder?: string;
	mode: string;
	checkedFilters: object;
	selectedPath: string;
	setSelectedPath(path: string): void;
	clearFilters(): void;
	setCheckedFilters(checkedFilters: object): any;
	handleFilterChange(filter: FilterType, isFilter?: boolean): any;
	handleClearClick(filter: string): void;
}

const AccordionSummary = styled(MuiAccordionSummary)(() => ({
	[`&.${accordionSummaryClasses.expanded}`]: {
		minHeight: 0,
		[`& .${accordionSummaryClasses.content}`]: {
			margin: '12px 0'
		}
	}
}));

const Accordion = styled(MuiAccordion)(() => ({
	[`&.${accordionClasses.expanded}`]: { margin: 'auto' }
}));

const messages: any = defineMessages({
	path: {
		id: 'words.path',
		defaultMessage: 'Path'
	},
	sortBy: {
		id: 'searchFilter.sortBy',
		defaultMessage: 'Sort By'
	},
	relevance: {
		id: 'words.relevance',
		defaultMessage: 'Relevance'
	},
	internalName: {
		id: 'searchFilter.internalName',
		defaultMessage: 'Name'
	},
	width: {
		id: 'words.width',
		defaultMessage: 'Width'
	},
	contentType: {
		id: 'searchFilter.contentType',
		defaultMessage: 'Content Type'
	},
	mimeType: {
		id: 'searchFilter.mimeType',
		defaultMessage: 'MIME Type'
	},
	size: {
		id: 'searchFilter.size',
		defaultMessage: 'Content Size'
	},
	lastEditDate: {
		id: 'searchFilter.lastEditDate',
		defaultMessage: 'Last Edit Date'
	},
	height: {
		id: 'words.height',
		defaultMessage: 'Height'
	},
	clearFilters: {
		id: 'searchFilter.clearFilters',
		defaultMessage: 'Clear Filters'
	},
	expandAll: {
		id: 'common.expandAll',
		defaultMessage: 'Expand All'
	},
	collapseAll: {
		id: 'common.collapseAll',
		defaultMessage: 'Collapse All'
	}
});

const filterToFacet = (filterKey, filterValue) => {
	const isMultiple = typeof filterValue === 'object';
	const isDate = !isMultiple && filterValue.includes('TODATE');
	const isRange = !isMultiple && !isDate && filterValue.includes('TO');
	const name = filterKey;
	let values = {};

	if (isMultiple) {
		Object.keys(filterValue).forEach((value) => {
			values[value] = 0;
		});
	} else if (isDate) {
		const deserializedValue = filterValue.match(/(.+)TODATE(.+)ID(.+)/);
		const id = deserializedValue[3].replace(filterKey, '');
		const from = deserializedValue[1] === 'null' ? null : deserializedValue[1];
		const to = deserializedValue[2] === 'null' ? null : deserializedValue[2];

		values[id] = {
			count: 0,
			from,
			to
		};
	} else {
		const deserializedValue = filterValue.match(/(.+)?TO(.+)?/);
		const rangeStart = deserializedValue[1];
		const rangeEnd = deserializedValue[2];
		const id = `${rangeStart ?? '*'}-${rangeEnd ?? '*'}`;

		values[id] = {
			count: 0,
			from: rangeStart ?? null,
			to: rangeEnd ?? null
		};
	}

	return {
		date: isDate,
		multiple: isMultiple,
		name,
		range: isRange,
		values
	};
};

export function SiteSearchFilters(props: SiteSearchFiltersProps) {
	// region const { ... } = props
	const {
		sortBy,
		sortOrder,
		facets,
		handleFilterChange,
		mode,
		checkedFilters,
		setCheckedFilters,
		clearFilters,
		handleClearClick,
		selectedPath,
		setSelectedPath,
		sx
	} = props;
	// endregion
	const { formatMessage } = useIntl();
	const [expanded, setExpanded] = useSpreadState({
		sortBy: false,
		path: false
	});
	const contentTypes = useContentTypes();

	let filterKeys: string[] = [];
	let facetsLookupTable: LookupTable = {};
	const facetLabelLookup: LookupTable = {};
	const parsedSelectedPath = selectedPath?.trim().replace('.+', '').replace(/\/$/, '');
	// Don't want the root path set everytime select path changes. Only when select mode is first detected for it to get set once.
	// TODO: Ultimately, the rootPath should change to be driven by a different explicit prop other than `mode`.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const rootPath = useMemo(() => (mode === 'select' ? parsedSelectedPath : null), [mode]);

	const addFacetValuesLabels = (facet) => {
		Object.keys(facet.values).forEach((value) => {
			let label = value;
			if (facet.name === 'content-type') {
				label = contentTypes?.[value]?.name ?? value;
			} else if (facet.name === 'mime-type') {
				label = getMimeTypeTranslation(value, formatMessage);
			}
			facetLabelLookup[value] = label;
		});
	};

	facets.forEach((facet) => {
		filterKeys.push(facet.name);
		facetsLookupTable[facet.name] = facet;
		addFacetValuesLabels(facet);
	});

	// Add filters already selected not coming from facets
	Object.keys(checkedFilters).forEach((filterKey) => {
		if (!filterKeys.includes(filterKey)) {
			filterKeys.push(filterKey);
			facetsLookupTable[filterKey] = filterToFacet(filterKey, checkedFilters[filterKey]);
		}
	});

	const handleExpandClick = (item: string) => {
		setExpanded({ [item]: !expanded[item] });
	};

	const pathToFilter = (path: string) => {
		if (path) {
			if (path.endsWith('/')) {
				return `${path}.+`;
			} else {
				return `${path}/.+`;
			}
		} else {
			return undefined;
		}
	};

	const onPathSelected = (path: string) => {
		handleFilterChange({
			name: 'path',
			value: pathToFilter(path)
		});
		setSelectedPath(path);
	};

	const expandCollapseAll = (expand: boolean) => {
		const state: any = {};
		state.path = expand;
		state.sortBy = expand;
		filterKeys.forEach((key) => {
			state[key] = expand;
		});
		setExpanded(state);
	};

	return (
		<Box>
			<Box sx={{ p: 1, display: 'flex', justifyContent: 'space-evenly', ...sx }}>
				<Button size="small" onClick={() => expandCollapseAll(true)}>
					{formatMessage(messages.expandAll)}
				</Button>
				<Button size="small" onClick={() => expandCollapseAll(false)}>
					{formatMessage(messages.collapseAll)}
				</Button>
				<Button
					size="small"
					disabled={Object.keys(checkedFilters).length === 0 && !Boolean(selectedPath)}
					onClick={clearFilters}
				>
					{formatMessage(messages.clearFilters)}
				</Button>
			</Box>
			<Divider sx={{ width: 'auto', margin: '0 10px' }} />
			<Accordion expanded={expanded.sortBy} elevation={0} onChange={() => handleExpandClick('sortBy')}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography sx={{ display: 'flex', fontWeight: 600, alignItems: 'center' }}>
						{formatMessage(messages.sortBy)}
						{sortBy && <CheckIcon />}
					</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<>
						<SiteSearchSortBy sortBy={sortBy} filterKeys={filterKeys} handleFilterChange={handleFilterChange} />
						{sortBy && sortBy !== SORT_AUTO && (
							<SiteSearchSortOrder sortOrder={sortOrder} sortBy={sortBy} handleFilterChange={handleFilterChange} />
						)}
					</>
				</AccordionDetails>
			</Accordion>
			<Accordion expanded={expanded.path} elevation={0} onChange={() => handleExpandClick('path')}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography sx={{ display: 'flex', fontWeight: 600, alignItems: 'center' }}>
						{formatMessage(messages.path)}
						{selectedPath && <CheckIcon />}
					</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<PathSelector value={parsedSelectedPath} onPathSelected={onPathSelected} rootPath={rootPath} />
				</AccordionDetails>
			</Accordion>
			{filterKeys.map((key: string) => {
				const camelizedKey = camelize(key);
				return (
					<Accordion key={key} expanded={expanded[key] ?? false} elevation={0} onChange={() => handleExpandClick(key)}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography sx={{ display: 'flex', fontWeight: 600, alignItems: 'center' }}>
								{camelizedKey in messages ? formatMessage(messages[camelizedKey]) : key}
								{checkedFilters[key] && <CheckIcon />}
							</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<SiteSearchFilter
								facet={key}
								handleFilterChange={handleFilterChange}
								checkedFilters={checkedFilters}
								setCheckedFilters={setCheckedFilters}
								facetsLookupTable={facetsLookupTable}
								facetLabelLookup={facetLabelLookup}
								handleClearClick={handleClearClick}
							/>
						</AccordionDetails>
					</Accordion>
				);
			})}
		</Box>
	);
}

export default SiteSearchFilters;
