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
import { GraphiQL as GraphiQLComponent } from 'graphiql';
import 'graphiql/style.css';
import { createTransport } from '@graphiql/toolkit';
import GlobalAppToolbar from '../GlobalAppToolbar';
import { FormattedMessage } from 'react-intl';
import Box from '@mui/material/Box';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import { defaultQuery } from './utils';
import useEnv from '../../hooks/useEnv';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { GlobalStyles } from '@mui/material';
import '../MonacoEditor/setupMonacoWorkers';

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
	const storage = useMemo(
		() =>
			({
				setItem: (key: string, value: any) => window.localStorage.setItem(`${storageKey}${key}`, value),
				getItem: (key: string) => window.localStorage.getItem(`${storageKey}${key}`),
				removeItem: (key: string) => window.localStorage.removeItem(`${storageKey}${key}`)
			}) as Storage,
		[storageKey]
	);
	const transport = useMemo(() => {
		const httpMethod = method.toLowerCase() === 'get' ? 'GET' : 'POST';
		return createTransport({
			url,
			method: httpMethod,
			// Skip OPTIONS discovery against the delivery endpoint.
			supportedMethods: httpMethod === 'GET' ? ['GET', 'POST'] : ['POST']
		});
	}, [url, method]);
	const onEditQuery = (newQuery: string) => {
		window.localStorage.setItem(`${storageKey}graphiql:query`, newQuery);
	};

	return (
		<>
			<GlobalStyles
				styles={{
					'[data-radix-popper-content-wrapper], .graphiql-dialog': {
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
						height: embedded ? '100%' : 'calc(100% - 65px)',
						position: 'relative',
						minHeight: 0
					}}
				>
					<GraphiQLComponent
						transport={transport}
						initialQuery={initialQuery}
						defaultQuery={defaultQuery}
						storage={storage}
						onEditQuery={onEditQuery}
					/>
				</Box>
			</Box>
		</>
	);
}

export default GraphiQL;
