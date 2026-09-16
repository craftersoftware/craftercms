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

import React, { useEffect, useMemo, useState } from 'react';
import { GraphiQL as GraphiQLComponent } from 'graphiql';
import 'graphiql/style.css';
import { explorerPlugin } from '@graphiql/plugin-explorer';
import '@graphiql/plugin-explorer/style.css';
import { buildClientSchema, getIntrospectionQuery, GraphQLSchema } from 'graphql';
import GlobalAppToolbar from '../GlobalAppToolbar';
import { FormattedMessage } from 'react-intl';
import Box from '@mui/material/Box';
import { toQueryString } from '../../utils/object';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import { defaultQuery } from './utils';
import useEnv from '../../hooks/useEnv';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { GlobalStyles } from '@mui/material';

export interface GraphiQLProps {
	url?: string;
	storageKey?: string;
	method?: string;
	embedded?: boolean;
	showAppsButton?: boolean;
	onSubmittingAndOrPendingChange?(value: onSubmittingAndOrPendingChangeProps): void;
}

function GraphiQL(props: GraphiQLProps) {
	const { guestBase } = useEnv();
	const site = useActiveSiteId();
	const {
		storageKey = site,
		showAppsButton,
		embedded = false,
		method = 'post',
		url = `${guestBase}/api/1/site/graphql${site ? `?crafterSite=${site}` : ''}`
	} = props;
	// We don't want to update the initialQuery.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const initialQuery = useMemo(() => window.localStorage.getItem(`${storageKey}graphiql:query`) ?? defaultQuery, []);
	const [schema, setSchema] = useState<GraphQLSchema>(null);
	const storage = useMemo(
		() =>
			({
				setItem: (key: string, value: any) => window.localStorage.setItem(`${storageKey}${key}`, value),
				getItem: (key: string) => window.localStorage.getItem(`${storageKey}${key}`),
				removeItem: (key: string) => window.localStorage.removeItem(`${storageKey}${key}`)
			}) as Storage,
		[storageKey]
	);
	const graphQLFetcher = useMemo(() => {
		const lowercaseMethod = method.toLowerCase();
		const then = (response: Response) => {
			try {
				return response.json();
			} catch (error) {
				return response;
			}
		};
		if (lowercaseMethod === 'get') {
			return (graphQLParams, opts?) => {
				return fetch(
					`${url}${toQueryString({
						query: encodeURIComponent(graphQLParams.query),
						variables: encodeURIComponent(JSON.stringify(graphQLParams.variables ?? '{}'))
					})}`,
					{
						method: 'get',
						headers: { 'Content-Type': 'application/json' }
					}
				).then(then);
			};
		} else {
			return (graphQLParams, opts?) => {
				return fetch(url, {
					method: 'post',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(graphQLParams)
				}).then(then);
			};
		}
	}, [url, method]);
	const onEditQuery = (newQuery: string) => {
		window.localStorage.setItem(`${storageKey}graphiql:query`, newQuery);
	};
	const explorer = explorerPlugin({
		showAttribution: false,
		initialIsOpen: false
	});

	useEffect(() => {
		graphQLFetcher({
			query: getIntrospectionQuery()
		}).then((result) => {
			setSchema(buildClientSchema(result.data));
		});
	}, [graphQLFetcher]);

	return (
		<>
			<GlobalStyles
				styles={{
					'[data-radix-popper-content-wrapper], react-portal [data-reach-tooltip], .graphiql-dialog': {
						zIndex: '1301 !important'
					}
				}}
			/>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					height: '100%'
				}}
			>
				{!embedded && (
					<GlobalAppToolbar
						title={<FormattedMessage id="words.graphQL" defaultMessage="GraphQL" />}
						showAppsButton={showAppsButton}
					/>
				)}
				<Box
					className="graphiql-container"
					sx={{
						height: 'calc(100% - 65px)',
						position: 'relative',
						'.title': {
							display: 'none'
						},
						'.doc-explorer-title-bar, .history-title-bar': {
							height: 'auto!important'
						},
						'.graphiql-plugin': {
							'.docExplorerWrap': {
								minWidth: '273px !important',
								maxWidth: '100%'
							},
							'.doc-explorer-title-bar .doc-explorer-rhs': {
								display: 'none'
							},
							'.graphiql-explorer-root': {
								padding: '0 !important',
								'& > div:first-child': {
									overflow: 'auto !important'
								},
								'.graphiql-operation-title-bar span input': {
									width: 'unset !important'
								}
							},
							'.doc-explorer-contents': {
								overflowY: 'hidden !important'
							}
						}
					}}
				>
					<GraphiQLComponent
						fetcher={graphQLFetcher}
						schema={schema}
						initialQuery={initialQuery}
						storage={storage}
						onEditQuery={onEditQuery}
						plugins={[explorer]}
					/>
				</Box>
			</Box>
		</>
	);
}

export default GraphiQL;
