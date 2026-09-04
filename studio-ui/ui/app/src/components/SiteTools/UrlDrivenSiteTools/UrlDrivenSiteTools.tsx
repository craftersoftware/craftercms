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
import { useGlobalAppState } from '../../GlobalApp';
import useReference from '../../../hooks/useReference';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import useEnv from '../../../hooks/useEnv';
import SiteTools, { Tool } from '../SiteTools';
import { getSystemLink } from '../../../utils/system';
import { useLocation, useNavigate } from 'react-router';
import { SiteToolsContext, SiteToolsContextProps } from '../siteToolsContext';

interface UrlDrivenSiteToolsProps {
	footerHtml?: string;
}

export function UrlDrivenSiteTools(props: UrlDrivenSiteToolsProps = {}) {
	const { footerHtml: footerHtmlProp } = props;
	const { footerHtml: envFooterHtml } = useEnv();
	const footerHtml = footerHtmlProp ?? envFooterHtml ?? '';
	const [width, setWidth] = useState(240);
	const location = useLocation();
	const [activeToolId, setActiveToolId] = useState(location.pathname.replace('/', ''));
	const [{ openSidebar }] = useGlobalAppState();
	const tools: Tool[] = useReference('craftercms.siteTools')?.tools;
	const site = useActiveSiteId();
	const { authoringBase } = useEnv();
	const navigate = useNavigate();
	const contextValue = useMemo<SiteToolsContextProps>(
		() => ({ setTool: (id) => navigate(id), activeToolId }),
		[navigate, activeToolId]
	);

	useEffect(() => {
		setActiveToolId(location.pathname.replace('/', ''));
	}, [location]);

	const onNavItemClick = (id: string) => {
		navigate(id);
	};

	const onBackClick = () => {
		window.location.href = getSystemLink({
			site,
			authoringBase,
			systemLinkId: 'preview'
		});
	};

	return (
		<SiteToolsContext.Provider value={contextValue}>
			<SiteTools
				site={site}
				sidebarWidth={width}
				onWidthChange={setWidth}
				onNavItemClick={onNavItemClick}
				onBackClick={onBackClick}
				activeToolId={activeToolId}
				footerHtml={footerHtml}
				openSidebar={openSidebar || !activeToolId}
				tools={tools}
				mountMode="page"
			/>
		</SiteToolsContext.Provider>
	);
}

export default UrlDrivenSiteTools;
