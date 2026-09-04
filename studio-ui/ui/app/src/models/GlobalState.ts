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

import { LookupTable } from './LookupTable';
import { EnhancedUser } from './User';
import { Site } from './Site';
import ContentType from './ContentType';
import { WidthAndHeight } from './WidthAndHeight';
import { ElasticParams, MediaItem } from './Search';
import ContentInstance from './ContentInstance';
import { ContentTypeDropTarget } from './ContentTypeDropTarget';
import { ErrorDialogStateProps } from '../components/ErrorDialog/ErrorDialog';
import { MinimizedDialogsStateProps } from './MinimizedTab';
import { NewContentDialogStateProps } from '../components/NewContentDialog/utils';
import { EntityState } from './EntityState';
import { ApiResponse } from './ApiResponse';
import { VersionsStateProps } from './Version';
import QuickCreateItem from './content/QuickCreateItem';
import { PathNavigatorStateProps } from '../components/PathNavigator';
import { ContentItem } from './Item';
import { PathSelectionDialogStateProps } from '../components/PathSelectionDialog/PathSelectionDialog';
import { WidgetDescriptor } from './WidgetDescriptor';
import { ItemMenuStateProps } from '../components/ItemActionsMenu';
import { ItemMegaMenuStateProps } from '../components/ItemMegaMenu';
import { LauncherStateProps } from '../components/Launcher';
import { PublishingStatusDialogStateProps } from '../components/PublishingStatusDialog';
import { SystemIconDescriptor } from '../components/SystemIcon';
import { AjaxError } from 'rxjs/ajax';
import { PathNavigatorTreeStateProps } from '../components/PathNavigatorTree';
import { WidgetDialogStateProps } from '../components/WidgetDialog/utils';
import { CodeEditorDialogStateProps } from '../components/CodeEditorDialog/utils';
import { PublishDialogStateProps } from '../components/PublishDialog/utils';
import { DeleteDialogStateProps } from '../components/DeleteDialog/utils';
import { CreateFolderStateProps } from '../components/CreateFolderDialog/utils';
import { DependenciesDialogStateProps } from '../components/DependenciesDialog/utils';
import { HistoryDialogStateProps } from '../components/HistoryDialog/utils';
import { ViewVersionDialogStateProps } from '../components/ViewVersionDialog/utils';
import { CompareVersionsDialogStateProps } from '../components/CompareVersionsDialog/utils';
import { ConfirmDialogStateProps } from '../components/ConfirmDialog/utils';
import { ChangeContentTypeDialogStateProps } from '../components/ChangeContentTypeDialog/utils';
import { CreateFileStateProps } from '../components/CreateFileDialog/utils';
import { UploadDialogStateProps } from '../components/UploadDialog/util';
import { PreviewDialogStateProps } from '../components/PreviewDialog/utils';
import { EditSiteDialogStateProps } from '../components/EditSiteDialog/utils';
import { LegacyFormDialogStateProps } from '../components/LegacyFormDialog/utils';
import { SingleFileUploadDialogStateProps } from '../components/SingleFileUploadDialog';
import { ModelHierarchyMap } from '../utils/content';
import { UIBlockerStateProps } from '../components/UIBlocker';
import { RenameAssetStateProps } from '../components/RenameAssetDialog';
import Person from './Person';
import { BrokenReferencesDialogStateProps } from '../components/BrokenReferencesDialog/types';
import AllowedContentTypesData from './AllowedContentTypesData';
import { Editor } from '@tinymce/tinymce-react';
import { ElementType } from 'react';
import { PublishingPackageReviewDialogStateProps } from '../components/PublishPackageReviewDialog/types';
import { CancelPackageDialogStateProps } from '../components/CancelPackageDialog';
import { BulkCancelPackageDialogStateProps } from '../components/BulkCancelPackageDialog';
import { PublishingPackageResubmitDialogStateProps } from '../components/PublishingPackageResubmitDialog/types';
import { PackageDetailsDialogStateProps } from '../components/PackageDetailsDialog';
import { ViewPackagesDialogStateProps } from '../components/ViewPackagesDialog';
import type { FolderMoveAlertDialogStateProps } from '../components/FolderMoveAlertDialog/FolderMoveAlertDialog';
import type { PublishingStatus } from './Publishing';
import type { Archetype } from '../components/ContentTypeManagement/descriptors/archetypes';
import type { DescriptorContentType } from '../components/ContentTypeManagement/utils';

export type HighlightMode = 'all' | 'move';

export interface PagedEntityState<T = any> extends EntityState<T> {
	page: any;
	pageNumber: number;
	count: number;
	query: ElasticParams;
}

export interface EditSelection {
	modelId: string;
	fieldId: string[];
	index: string | number;
	coordinates: { x: number; y: number };
}

export interface GuestData {
	url: string;
	origin: string;
	models: LookupTable<ContentInstance>;
	hierarchyMap: ModelHierarchyMap;
	modelIdByPath: LookupTable<string>;
	modelId: string;
	path: string;
	selected: EditSelection[];
	itemBeingDragged: number;
	/**
	 * Stores the modifier person for the main XB model from the moment is loaded (guest check's in) onwards.
	 * used to determine if the content item was modified in the background and it editing should be disabled.
	 */
	mainModelModifier: Person;
	allowedContentTypes: LookupTable<AllowedContentTypesData>;
	contentTypesUpdated: boolean;
}

// TODO:
//   Assess extracting these props from `GuestData` to avoid reloading models
//   that were already fetched on previews pages as Guest checks in and out.
// export interface GuestModels {
//   models: LookupTable<ContentInstance>;
//   childrenMap: LookupTable<string[]>;
//   modelIdByPath: LookupTable<string>;
// }

export interface Clipboard {
	type: 'CUT' | 'COPY';
	includeChildren?: boolean;
	sourcePath: string;
}

export interface DialogStackItem<P = unknown> {
	id: string;
	component: string | ElementType<P>;
	allowMinimize?: boolean;
	allowFullScreen?: boolean;
	props: P;
}

export interface GlobalState {
	auth: {
		error: ApiResponse;
		active: boolean;
		expiresAt: number;
		isFetching: boolean;
	};
	user: EnhancedUser;
	sites: {
		active: string;
		isFetching: boolean;
		byId: LookupTable<Site>;
	};
	content: {
		quickCreate: {
			error: ApiResponse;
			isFetching: boolean;
			items: QuickCreateItem[];
		};
		itemsByPath: LookupTable<ContentItem>;
		clipboard: Clipboard;
		itemsBeingFetchedByPath: LookupTable<boolean>;
	};
	contentTypes: EntityState<ContentType>;
	env: {
		authoringBase: string;
		logoutUrl: string;
		guestBase: string;
		xsrfHeader: string;
		xsrfArgument: string;
		siteCookieName: string;
		previewLandingBase: string;
		version: string;
		packageBuild: string;
		packageVersion: string;
		packageBuildDate: string;
		useBaseDomain: boolean;
		activeEnvironment: string;
		passwordRequirementsMinComplexity: number;
		footerHtml: string;
		socketConnected: boolean;
	};
	preview: {
		editMode: boolean;
		highlightMode: HighlightMode;
		showToolsPanel: boolean;
		toolsPanelPageStack: WidgetDescriptor[];
		toolsPanelWidth: number;
		icePanelWidth: number;
		icePanelStack: WidgetDescriptor[];
		hostSize: WidthAndHeight;
		guest: GuestData;
		assets: PagedEntityState<MediaItem>;
		audiencesPanel: {
			isFetching: boolean;
			isApplying: boolean;
			error: ApiResponse;
			model: ContentInstance;
			applied: boolean;
		};
		components: PagedEntityState<ContentInstance>;
		dropTargets: {
			selectedContentType: string;
			byId: LookupTable<ContentTypeDropTarget>;
		};
		toolsPanel: {
			widgets: WidgetDescriptor[];
		};
		toolbar: {
			leftSection: {
				widgets: WidgetDescriptor[];
			};
			middleSection: {
				widgets: WidgetDescriptor[];
			};
			rightSection: {
				widgets: WidgetDescriptor[];
			};
		};
		icePanel: {
			widgets: WidgetDescriptor[];
		};
		richTextEditor: LookupTable<{ id: string; tinymceOptions: Editor['props']['init'] }>;
		editModePadding: boolean;
		windowSize: number;
		xbDetectionTimeoutMs: number;
		error: {
			code: number;
			message: string;
		};
		keyboardShortcutsEnabled: boolean;
		createContentCompactView: boolean;
	};
	previewNavigation: {
		currentUrlPath: string;
		historyBackStack: string[];
		historyForwardStack: string[];
		// Flags when the back/forwards buttons were pressed (null otherwise) to determinate how to modify history stacks.
		historyNavigationType: 'back' | 'forward';
	};
	versions: VersionsStateProps;
	dialogStack: {
		ids: string[];
		byId: LookupTable<DialogStackItem<unknown>>;
	};
	dialogs: {
		minimizedTabs: MinimizedDialogsStateProps;
		history: HistoryDialogStateProps;
		viewVersion: ViewVersionDialogStateProps;
		compareVersions: CompareVersionsDialogStateProps;
		itemMenu: ItemMenuStateProps;
		itemMegaMenu: ItemMegaMenuStateProps;
		launcher: LauncherStateProps;
		uiBlocker: UIBlockerStateProps;
	};
	uiConfig: {
		error: ApiResponse;
		isFetching: boolean;
		currentSite: string;
		siteLocales: {
			error: ApiResponse;
			isFetching: boolean;
			localeCodes: string[];
			defaultLocaleCode: string;
		};
		upload: {
			timeout: number;
			maxActiveUploads: number;
			maxSimultaneousUploads: number;
		};
		locale: {
			localeCode: string;
			dateTimeFormatOptions: Intl.DateTimeFormatOptions;
		};
		publishing: {
			publishCommentRequired: boolean;
			deleteCommentRequired: boolean;
			bulkPublishCommentRequired: boolean;
			publishByCommitCommentRequired: boolean;
			publishEverythingCommentRequired: boolean;
			submissionCommentMaxLength: number;
		};
		cdataEscapedFieldPatterns: string[];
		references: LookupTable;
		xml: string;
		remoteGitBranch: string;
		/** Custom/config control descriptors keyed by control type id (from UI config). */
		controls: LookupTable<DescriptorContentType>;
	};
	pathNavigator: LookupTable<PathNavigatorStateProps>;
	pathNavigatorTree: LookupTable<PathNavigatorTreeStateProps>;
	dashboard: {
		widgets?: WidgetDescriptor[];
		mainSection?: {
			widgets: WidgetDescriptor[];
		};
	};
	globalNavigation: {
		error: AjaxError;
		items: Array<{ icon: SystemIconDescriptor; id: string; label: string }>;
		isFetching: boolean;
	};
	publishing: {
		isFetching: boolean;
		enabled: PublishingStatus['enabled'];
		published: PublishingStatus['published'];
		currentTask: PublishingStatus['currentTask'];
	};
}

export default GlobalState;
