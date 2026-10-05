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

<#assign pSite = RequestParameters.site!''>
<#assign pType = RequestParameters.type!''>
<#assign pName = RequestParameters.name!''>
<#assign pFile = RequestParameters.file!'index.js'>
<#assign pPluginId = RequestParameters.pluginId!''>
<#if pSite == '' || pType == '' || pName == ''>
	<@layout title="Error - ${contentModel['common-title']!''}">
		<script>
			document.addEventListener('CrafterCMS.CodebaseBridgeReady', () => {
				printError({ title: 'Query arguments site, type and name are mandatory to render a plugin' })
			});
		</script>
	</@layout>
<#elseif pSite?? && pType?? && pName?? && pFile?ends_with('.html')>
	<#if pPluginId == ''>
		<#assign html = applicationContext.configurationService.getConfigurationAsString(
			pSite,
			"studio",
			"/plugins/${pType}/${pName}/${pFile}",
			""
		)!"CONTENT_NOT_FOUND"
		/>
	<#else>
		<#assign html = applicationContext.configurationService.getConfigurationAsString(
			pSite,
			"studio",
			"/static-assets/plugins/${pPluginId?replace('.', '/')}/${pType}/${pName}/${pFile}",
			""
		)!"CONTENT_NOT_FOUND"
		/>
	</#if>
	<#if html = "CONTENT_NOT_FOUND">
		<@layout title="Not Found - ${contentModel['common-title']!''}">
			<script>
				document.addEventListener('CrafterCMS.CodebaseBridgeReady', () => {
					printError({
						title: 'Unable to render the requested plugin.',
						message: (
							'Please check that the url has all the necessary params (site, type, name and file), ' +
							'that these values are correct and that you\'ve committed all your work to the site repo.'
						)
					})
				});
			</script>
		</@layout>
	<#else>
		${html}
	</#if>
<#else>
	<@layout title="${pName?replace('-', ' ')?cap_first} - ${contentModel['common-title']!''}">
		<script>
			document.addEventListener('CrafterCMS.CodebaseBridgeReady', () => {
				window.CRAFTER_CMS_PLUGIN_PAGE = true;
				(function () {
					const { render } = CrafterCMSNext;
					const { utils } = craftercms;
					const qs = utils.path.parseQueryString();
					utils.auth.setRequestForgeryToken();

					const script = document.createElement('script');

					script.src = '/studio/1/plugin/${pSite}/file?type=${pType}&name=${pName}&filename=${pFile}<#if pPluginId?has_content>&pluginId=${pPluginId}</#if>';

					script.onload = function () {
						if (['yes', 'true', 'enable', '1'].includes(qs.monitor)) {
							const elem = document.createElement('div');
							document.body.appendChild(elem);
							render(elem, 'AuthMonitor');
						}
					};

					script.onerror = function () {
						console.error('Script failed to load. The query string is attached to this error.', qs);
						printError({
							title: 'Unable to render the requested plugin.',
							message: (
								'Please check that the url has all the necessary params (site, type, name and file), ' +
								'that these values are correct and that you\'ve committed all your work to the site repo.'
							)
						});
					};

					document.head.appendChild(script);

				})();
			});
		</script>
	</@layout>
</#if>

<#macro layout title>
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8" />
		<link rel="shortcut icon" href="/studio/static-assets/img/favicon.ico">
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="theme-color" content="#000000" />
		<title>${title}</title>
		<style>
			html, body, #root {
				margin: 0;
				padding: 0;
				height: 100%;
			}
			* {
				box-sizing: border-box;
			}
			.craftercms-error-state {
				max-width: 500px;
				margin: 40px auto;
			}
			.craftercms-error-state-image {
				width: 300px
			}
		</style>
	</head>
	<body>
	<#include "/static-assets/app/pages/legacy.html">
	<script>
		function printError(props) {
			const elem = document.createElement('div');
			document.body.appendChild(elem);
			CrafterCMSNext.render(elem, 'ErrorState', {
				imageUrl: '/studio/static-assets/images/warning_state.svg',
				classes: { root: 'craftercms-error-state', image: 'craftercms-error-state-image' },
				...props
			});
		}
	</script>
	<#nested />
	</body>
	</html>
</#macro>
