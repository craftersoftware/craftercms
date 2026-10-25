<!--
  ~ Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
  ~
  ~ This program is free software: you can redistribute it and/or modify
  ~ it under the terms of the GNU General Public License version 3 as published by
  ~ the Free Software Foundation.
  ~
  ~ This program is distributed in the hope that it will be useful,
  ~ but WITHOUT ANY WARRANTY; without even the implied warranty of
  ~ MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  ~ GNU General Public License for more details.
  ~
  ~ You should have received a copy of the GNU General Public License
  ~ along with this program.  If not, see <http://www.gnu.org/licenses/>.
  -->

<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8"/>
	<link rel="shortcut icon" href="/studio/static-assets/img/favicon.ico">
	<meta name="viewport" content="width=device-width, initial-scale=1"/>
	<meta name="theme-color" content="#000000"/>
	<title>${contentModel['internal-name']} - ${contentModel['common-title']!'CrafterCMS'}</title>
</head>
<body>
<div id="root"></div>
<#include "/static-assets/app/pages/legacy.html">
<script>
	document.addEventListener("CrafterCMS.CodebaseBridgeReady", () => {
		const { createElement, Fragment } = craftercms.libs.React;
		const { Typography, Box } = craftercms.libs.MaterialUI;
		const { ViewToolbar, LauncherOpenerButton, SiteDashboard, DocumentationLink } = CrafterCMSNext.components;
		const CrafterCMSIcon = craftercms.icons.CrafterCMSIcon;
		function Root() {
			return createElement(
				Fragment,
				{},
				createElement(
					ViewToolbar,
					{},
					createElement(Box, { sx: { display: 'flex', alignItems: 'center' } },
						createElement(CrafterCMSIcon, { style: { marginRight: '5px' } }, 'Site Dashboard'),
						createElement(Typography, { variant: 'h5' }, 'Site Dashboard')
					),
					createElement(DocumentationLink),
					createElement(LauncherOpenerButton, { siteRailPosition: 'left', icon: 'apps' })
				),
				createElement(SiteDashboard, { showHelpLink: false })
			);
		}
		CrafterCMSNext.render('#root', Root, {}, false);
	});
</script>
</body>
</html>
