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
	<title>${contentModel['internal-name']} - ${contentModel['common-title']!''}</title>
</head>
<body>
<div id="root"></div>
<#include "/static-assets/app/pages/legacy.html">
<script>
	document.addEventListener("CrafterCMS.CodebaseBridgeReady", () => {
		CrafterCMSNext.render('#root', 'SearchPage', { embedded: ${((RequestParameters.embedded!'false') == 'true')?string} }, false);
	});
</script>
</body>
</html>
