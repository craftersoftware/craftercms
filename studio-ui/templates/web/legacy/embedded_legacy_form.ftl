<#--
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
<html>
<head>
	<script src="/studio/static-assets/scripts/ui-bootstrap-boot.js"></script>
	<script src="/studio/static-assets/libs/amplify/lib/amplify.core.js"></script>
	<script src="/studio/static-assets/yui/utilities/utilities.js"></script>
	<script src="/studio/static-assets/yui/container/container-min.js"></script>
	<script src="/studio/static-assets/yui/json/json-min.js"></script>
	<script src="/studio/static-assets/yui/yahoo/yahoo-min.js"></script>
	<script src="/studio/static-assets/libs/jquery/jquery.min.js"></script>
	<#include "/templates/web/common/page-fragments/studio-context.ftl" />
	<script src="/studio/static-assets/components/cstudio-common/common-api.js"></script>
	<script src="/studio/static-assets/scripts/crafter.js"></script>
	<script src="/studio/static-assets/scripts/animator.js"></script>
	<script src="/studio/static-assets/components/cstudio-components/loader.js"></script>
	<script src="/studio/static-assets/libs/bootstrap/popper.min.js"></script>
	<script src="/studio/static-assets/libs/bootstrap/bootstrap.min.js"></script>
	<script src="/studio/static-assets/libs/notify/notify.min.js"></script>
	<#-- Lang resources -->
	<#assign path="/studio/static-assets/components/cstudio-common/resources/" />
	<script src="${path}en/base.js"></script>
	<script src="${path}ko/base.js"></script>
	<script src="${path}es/base.js"></script>
	<script src="${path}de/base.js"></script>

	<script>
		window.IS_LEGACY_TOP_WINDOW = true;
	</script>
	<style>
		.studio-ice-dialog {
			margin-left: auto !important;
			bottom: 0 !important;
			left: 0 !important;
			right: 0 !important;
			top: 0 !important;
			height: 100% !important;
			width: 100% !important;
			position: fixed !important;
			border: none !important;
		}

		.studio-ice-dialog > .bd iframe {
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			width: 100%;
			height: 100%;
			border: none;
			outline: none;
			position: absolute;
		}

		.cstudio-template-editor-container {
			border: 0 !important;
			background: #f8f8f8 !important;
			box-shadow: none !important;
		}
	</style>
</head>
<body>
<#include "/static-assets/app/pages/legacy.html">
<script>
	document.addEventListener("CrafterCMS.CodebaseBridgeReady", () => {
		const { formatMessage } = CrafterCMSNext.i18n.intl;
		const { embeddedLegacyFormMessages } = CrafterCMSNext.i18n.messages;
		const path = CStudioAuthoring.Utils.getQueryVariable(location.search, 'path');
		const site = CStudioAuthoring.Utils.getQueryVariable(location.search, 'site');
		const type = CStudioAuthoring.Utils.getQueryVariable(location.search, 'type');
		const contentType = CStudioAuthoring.Utils.getQueryVariable(location.search, 'contentType');
		const readOnly = CStudioAuthoring.Utils.getQueryVariable(location.search, 'readonly') === 'true';
		const iceId = CStudioAuthoring.Utils.getQueryVariable(location.search, 'iceId');
		const selectedFields = CStudioAuthoring.Utils.getQueryVariable(location.search, 'selectedFields');
		const fieldsIndexes = CStudioAuthoring.Utils.getQueryVariable(location.search, 'fieldsIndexes');
		const newEmbedded = CStudioAuthoring.Utils.getQueryVariable(location.search, 'newEmbedded');
		const contentTypeId = CStudioAuthoring.Utils.getQueryVariable(location.search, 'contentTypeId');
		const isNewContent = CStudioAuthoring.Utils.getQueryVariable(location.search, 'isNewContent') === 'true';
		const LEGACY_FORM_DIALOG_CANCEL_REQUEST = 'LEGACY_FORM_DIALOG_CANCEL_REQUEST';

		CStudioAuthoring.OverlayRequiredResources.loadContextNavCss();

		function openDialog(path) {
			var modelId = CStudioAuthoring.Utils.getQueryVariable(location.search, 'modelId');
			var isHidden = CStudioAuthoring.Utils.getQueryVariable(location.search, 'isHidden') === 'true';
			var canEdit = CStudioAuthoring.Utils.getQueryVariable(location.search, 'canEdit') === 'true';
			var changeTemplate = CStudioAuthoring.Utils.getQueryVariable(location.search, 'changeTemplate');

			const embeddedData = newEmbedded ? JSON.parse(newEmbedded) : false;

			const aux = [];
			if (readOnly) aux.push({ name: 'readonly' });
			if (changeTemplate) aux.push({ name: 'changeTemplate', value: changeTemplate });
			if (canEdit) aux.push({ name: 'canEdit', value: canEdit });

			if (!isNewContent) {
				CStudioAuthoring.Service.lookupContentItem(
					site,
					path,
					{
						success: (contentTO) => {
							CStudioAuthoring.Operations.performSimpleIceEdit(
								contentTO.item,
								selectedFields ? JSON.parse(decodeURIComponent(selectedFields)) : iceId,
								true,
								{
									success: (response, editorId, name, value, draft, action) => {
										window.parent.postMessage({
											...response,
											type: 'EMBEDDED_LEGACY_FORM_SUCCESS',
											refresh: true,
											tab: type,
											action
										}, '*');
									},
									failure: error => {
										error && console.error(error);
										window.parent.postMessage({
											type: 'EMBEDDED_LEGACY_FORM_FAILURE',
											refresh: false,
											tab: type,
											action: 'failure',
											message: formatMessage(embeddedLegacyFormMessages.contentFormFailedToLoadErrorMessage)
										}, '*');
									},
									cancelled: (response) => {
										let close = true;
										if (response && response.close === false) {
											close = false;
										}
										window.parent.postMessage({
											type: 'EMBEDDED_LEGACY_FORM_CLOSE',
											refresh: false,
											close: close,
											tab: type,
											action: 'cancelled'
										}, '*');
									},
									renderComplete: () => {
										if (modelId || embeddedData) {
											CStudioAuthoring.InContextEdit.messageDialogs({
												type: 'OPEN_CHILD_COMPONENT',
												key: Boolean(modelId) ? modelId : null,
												iceId: selectedFields ? JSON.parse(decodeURIComponent(selectedFields)) : iceId,
												contentType: embeddedData ? embeddedData.contentType : null,
												edit: Boolean(modelId),
												selectorId: embeddedData ? embeddedData.fieldId : null,
												ds: embeddedData ? embeddedData.datasource : null,
												order: embeddedData ? embeddedData.index : null,
												callback: {
													renderComplete: 'EMBEDDED_LEGACY_FORM_RENDERED',
													pendingChanges: 'EMBEDDED_LEGACY_FORM_PENDING_CHANGES'
												}
											});
										} else {
											window.parent.postMessage({ type: 'EMBEDDED_LEGACY_FORM_RENDERED' }, '*');
										}
									},
									pendingChanges: () => {
										window.parent.postMessage({
											type: 'EMBEDDED_LEGACY_FORM_PENDING_CHANGES',
											action: 'pendingChanges'
										}, '*');
									},
									renderFailed(error) {
										window.parent.postMessage({ type: 'EMBEDDED_LEGACY_FORM_RENDER_FAILED', payload: { error } }, '*');
									},
									changeToEditMode() {
										window.parent.postMessage({ type: 'EMBEDDED_LEGACY_CHANGE_TO_EDIT_MODE' }, '*');
									},
									minimize: () => {
										window.parent.postMessage({
											type: 'EMBEDDED_LEGACY_MINIMIZE_REQUEST'
										}, '*');
									},
									isParent: true,
									id: type
								},
								aux,
								null,
								!!isHidden,
								fieldsIndexes ? JSON.parse(decodeURIComponent(fieldsIndexes)) : null
							);
						},
						failure: error => {
							error && console.error(error);
							window.parent.postMessage({
								type: 'EMBEDDED_LEGACY_FORM_FAILURE',
								refresh: false,
								tab: type,
								action: 'failure',
								message: formatMessage(embeddedLegacyFormMessages.contentFormFailedToLoadErrorMessage)
							}, '*');
						}
					},
					false, false
				);
			} else {
				CStudioAuthoring.Operations.openContentWebForm(
					contentTypeId,
					null,
					null,
					CStudioAuthoring.Operations.processPathsForMacros(path, null, true),
					false,
					false,
					{
						success: (response, editorId, name, value, draft, action) => {
							window.parent.postMessage({
								...response,
								type: 'EMBEDDED_LEGACY_FORM_SAVE',
								refresh: false,
								tab: type,
								redirectUrl: response.item?.browserUri,
								action,
								isNew: true
							}, '*');
						},
						failure: (error) => {
							error && console.error(error);
							window.parent.postMessage({
								type: 'EMBEDDED_LEGACY_FORM_FAILURE',
								refresh: false, tab: type, action: 'failure',
								message: formatMessage(embeddedLegacyFormMessages.contentFormFailedToLoadErrorMessage)
							}, '*');
						},
						cancelled: () => {
							window.parent.postMessage({
								close: true,
								type: 'EMBEDDED_LEGACY_FORM_CLOSE',
								refresh: false,
								tab: type,
								action: 'cancelled'
							}, '*');
						},
						renderComplete: () => {
							window.parent.postMessage({ type: 'EMBEDDED_LEGACY_FORM_RENDERED' }, '*');
						},
						pendingChanges: () => {
							window.parent.postMessage({
								type: 'EMBEDDED_LEGACY_FORM_PENDING_CHANGES',
								action: 'pendingChanges'
							}, '*');
						},
						id: type
					},
					null
				);
			}
		}

		window.addEventListener("message", (event) => {
			if (event.data.type === LEGACY_FORM_DIALOG_CANCEL_REQUEST) {
				CStudioAuthoring.InContextEdit.messageDialogs({ type: LEGACY_FORM_DIALOG_CANCEL_REQUEST })
			}
			if (event.data.type === 'LEGACY_FORM_DIALOG_RENAMED_CONTENT') {
				CStudioAuthoring.InContextEdit.messageDialogs(event.data, '*');
			}
		}, false);

		CrafterCMSNext.system.getStore().subscribe(() => {
			openDialog(path);
		});
	});
</script>
</body>
</html>
