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

import { defineMessages, type MessageTag, type MessageValue } from 'react-intl';

// Side-effect defineMessages calls for formatjs extraction (values come from site config / UI XML).
defineMessages({
	siteTools: {
		id: 'siteTools.title',
		defaultMessage: 'Project Tools'
	},
	siteDashboard: {
		id: 'words.dashboard',
		defaultMessage: 'Dashboard'
	},
	configuration: {
		id: 'words.configuration',
		defaultMessage: 'Configuration'
	},
	workflowStates: {
		id: 'workflowStates.title',
		defaultMessage: 'Workflow States'
	},
	publishing: {
		id: 'words.publishing',
		defaultMessage: 'Publishing'
	},
	remoteRepositories: {
		id: 'remoteRepositories.title',
		defaultMessage: 'Remote Repositories'
	},
	preview: {
		id: 'words.preview',
		defaultMessage: 'Preview'
	},
	contentTypes: {
		id: 'dropTargetsMessages.contentTypes',
		defaultMessage: 'Content Types'
	},
	encryptionTools: {
		id: 'GlobalMenu.EncryptionToolEntryLabel',
		defaultMessage: 'Encryption Tool'
	},
	audit: {
		id: 'GlobalMenu.AuditEntryLabel',
		defaultMessage: 'Audit'
	},
	logConsole: {
		id: 'GlobalMenu.LogConsoleEntryLabel',
		defaultMessage: 'Log Console'
	},
	pluginManager: {
		id: 'PluginManagement.title',
		defaultMessage: 'Plugin Management'
	},
	settings: {
		id: 'words.settings',
		defaultMessage: 'Settings'
	},
	pages: {
		id: 'pathNavigatorTree.pages',
		defaultMessage: 'Pages'
	},
	components: {
		id: 'pathNavigatorTree.components',
		defaultMessage: 'Components'
	},
	taxonomy: {
		id: 'pathNavigatorTree.taxonomy',
		defaultMessage: 'Taxonomy'
	},
	staticAssets: {
		id: 'pathNavigatorTree.staticAssets',
		defaultMessage: 'Static Assets'
	},
	templates: {
		id: 'pathNavigatorTree.templates',
		defaultMessage: 'Templates'
	},
	scripts: {
		id: 'pathNavigatorTree.scripts',
		defaultMessage: 'Scripts'
	},
	audiencesPanelSegmentLabel: {
		id: 'previewAudiencesPanel.segmentLabel',
		defaultMessage: 'Segment'
	},
	audiencesPanelGuyValueLabel: {
		id: 'previewAudiencesPanel.guyValueLabel',
		defaultMessage: 'Guy'
	},
	audiencesPanelGalValueLabel: {
		id: 'previewAudiencesPanel.galValueLabel',
		defaultMessage: 'Gal'
	},
	audiencesPanelAnonymousValueLabel: {
		id: 'previewAudiencesPanel.anonymousValueLabel',
		defaultMessage: 'Anonymous'
	},
	audiencesPanelSegmentHelpText: {
		id: 'previewAudiencesPanel.segmentHelpText',
		defaultMessage: 'Setting the segment will change content targeting to the audience selected'
	},
	audiencesPanelNameLabel: {
		id: 'previewAudiencesPanel.nameLabel',
		defaultMessage: 'Name'
	},
	audiencesPanelNameHelpText: {
		id: 'previewAudiencesPanel.nameHelpText',
		defaultMessage: "Enter user's first and last name"
	}
});

defineMessages<{
	site: { readonly muted: MessageTag; readonly siteName: MessageValue };
}>({
	site: {
		id: 'launcher.siteSectionTitle',
		defaultMessage: 'Project <muted>• {siteName}</muted>'
	}
});
