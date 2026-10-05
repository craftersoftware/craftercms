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

import LauncherTile, { LauncherTileProps } from '../LauncherTile';
import { getSimplifiedVersion } from '../../utils/string';
import React, { useEffect, useState } from 'react';
import TranslationOrText from '../../models/TranslationOrText';
import { useIntl } from 'react-intl';
import { LauncherSectionUI, LauncherSectionUIProps } from '../LauncherSection/LauncherSectionUI';
import { getLauncherSectionLink, urlMapping } from '../LauncherSection/utils';
import { messages } from '../LauncherSection/utils';
import { closeLauncher } from '../../state/actions/dialogs';
import { useDispatch } from 'react-redux';
import ApiResponseErrorState from '../ApiResponseErrorState';
import { globalMenuMessages } from '../../env/i18n-legacy';
import Skeleton from '@mui/material/Skeleton';
import { useEnv } from '../../hooks/useEnv';
import { useSystemVersion } from '../../hooks/useSystemVersion';
import { useGlobalNavigation } from '../../hooks/useGlobalNavigation';

export interface LauncherGlobalNavProps {
	title?: TranslationOrText;
	onTileClicked?(e: React.MouseEvent<HTMLAnchorElement | HTMLSpanElement>, id: string, label: string): any;
	tileSxs?: LauncherTileProps['sxs'];
	sectionSxs?: LauncherSectionUIProps['sxs'];
}

function LauncherGlobalNav(props: LauncherGlobalNavProps) {
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const { authoringBase } = useEnv();
	const version = useSystemVersion();
	const onTileClicked = props.onTileClicked ?? (() => dispatch(closeLauncher()));
	const { items, error } = useGlobalNavigation();
	const [activeItemId, setActiveItemId] = useState('');
	useEffect(() => {
		const idLookup = {};
		Object.entries(urlMapping).forEach(([id, hash]) => (idLookup[hash] = id));
		function hashchange() {
			const hash = window.location.hash;
			setActiveItemId(idLookup[hash]);
		}
		hashchange();
		window.addEventListener('hashchange', hashchange, false);
	}, []);
	if (!error && !items) {
		const style = { margin: 5, width: 120, height: 100, display: 'inline-flex' };
		return (
			<>
				<Skeleton style={style} />
				<Skeleton style={style} />
				<Skeleton style={style} />
				<Skeleton style={style} />
			</>
		);
	} else if (error) {
		return <ApiResponseErrorState error={error.response ?? error} />;
	}
	return (
		<LauncherSectionUI sxs={props?.sectionSxs} title={props.title ?? formatMessage(messages.global)}>
			{items.map((item) => (
				<LauncherTile
					key={item.id}
					active={activeItemId === item.id}
					title={globalMenuMessages[item.id] ? formatMessage(globalMenuMessages[item.id]) : item.id}
					icon={item.icon}
					link={getLauncherSectionLink(item.id, authoringBase)}
					onClick={(e: React.MouseEvent<HTMLAnchorElement | HTMLSpanElement>) => onTileClicked(e, item.id, item.label)}
					sxs={props.tileSxs}
				/>
			))}
			<LauncherTile
				title={formatMessage(messages.docs)}
				icon={{ id: 'craftercms.icons.Docs' }}
				link={`https://craftercms.com/docs`}
				target="_blank"
				sxs={props.tileSxs}
			/>
		</LauncherSectionUI>
	);
}

export default LauncherGlobalNav;
