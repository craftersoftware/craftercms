# Changelog

## 5.0.0
* [utils/resource] Removed `createFakeResource`, `createResource` and `createResourceBundle` utils.
* [utils/content]:
  * Removed `parseLegacyItemToBaseItem`, `parseLegacyItemToSandBoxItem` and `parseLegacyItemToDetailedItem`. Replaced by `parseLegacyItemToContentItem`.
  * Moved `PathNavigator/utils.ts` `isVideo`, `isAudio` and `isPdfDocument` functions to `utils/content.ts`.
  * Removed `parseLegacyItemToContentItem` and `getLegacyItemSystemType`.
* [utils/path]:
  * Removed `getPasteItemFromPath` and `addToPasteItem`.
* [components]
  * Removed `pages/QuickCreateMenu` component.
  * Removed `SuspenseWithEmptyState` and `WithEmptyState` components.
  * Removed `resource` prop from StoreProvider
  * Removed `styles` prop from `ErrorState`, `ApiResponseErrorState`, `BlueprintForm`, `LoadingState`, `ConfirmDialog`, `AlertDialog`
  `LauncherSection`, `AceEditor`, `ItemDisplay`, `PasswordRequirementsDisplay`, `PublishDialogForm`, `ItemStateIcon`, `ResizeableDrawer`,
  `GlobalAppToolbar`, `ViewToolbar`, `PublishingStatusAvatar`, `ItemPublishingTargetIcon` and `EmptyState`. Replaced by`sxs` prop.
  * Removed `sectionStyles` and `tileStyles` props from `LauncherGlobalNav`. Replaced with `sectionSxs` and `tileSxs`.
  * Added `sxs` prop to `CrafterCMSLogo`, `SiteSwitcherSelect`, `ConfirmDialog`, `ContextMenu`, `BlueprintForm`, `ErrorState`,
  `GlobalAppToolbar`, `ItemActionsMenu`, `ItemDisplay`, `ItemMegaMenuUI`, `ItemPublishingTargetIcon`, `ItemStateIcon`, `LauncherSectionUI`,
  `LauncherSiteCard`, `LauncherTile`, `LoadingState`, `LoginForm`, `LogoAndMenuBundleButton`, `PagesSearchAhead`, `PasswordRequirementsDisplay`,
  `PathNavigator`, `PathNavigatorBreadcrumbs`, `PathNavigatorHeader`, `PathNavigatorList`, `PathNavigatorUI`, `PathNavigatorTree`,
  `PathNavigatorTreeItem`, `PathNavigatorTreeUI`, `PublishDialogForm`, `PublishingStatusAvatar`, `PublishingStatusTile`, `ResizeableDrawer`,
  `SearchBar`, `SingleItemSelector`, `SiteTools`, `ToolPanel`, `ViewToolbar` and `CrafterCMSIcon`.
  * Added `sx` prop to `FilterDropdown`, `PathNavigatorHeader`, `SiteTools`, `SiteSearchFilters` and `PublishingStatusAvatar`.
  * Removed `RejectDialog` component. Now handled by `PublishingPackageReviewDialog`.
  * Removed `emailOnApprove` option from `PublishDialog` form.
  * Removed `PublishDialog/styles.ts` file.
  * `PackageDetailsDialog`: Updated `packageId` prop to be of type `number`.
  * `PublishOnDemandForm`: Removed `bulkPublishCommentRequired` and `publishByCommitCommentRequired` props.
  * `PublishingQueue/FilterDropdown`: Removed `filterStates` and `handleEnterKey` props.
  * `PublishingQueue/PublishingPackage`: Removed `id`, `schedule`, `approver`, `state`, `environment`, `comment`, `filesPerPackage` and `setFilesPerPackage` properties. Added `pkg` property of type `PublishPackage`.
  * `PackageDetailsDialog`: Update packageId prop to be of type number.
  * Removed `WorkflowCancellationDialog`. Replaced by `ViewPackagesDialog`.
  * Removed `UnlockPublisherDialog` component.
  * `PackageItems`: Component no longer shows the publishing target icon for items.
  * [ChangeContentTypeDialog] `rootPath`, `compact`, `selectedContentType` props removed. Prop `initialCompact` added.
  * [ContentTypesFilter] Completely redone. Props are now same as @mui/material/SelectProps
  * [NewContentCard] Removed
  * [ContentTypesGrid] Removed
  * [ContentTypesLoader] Removed
  * [NewContentDialog] Props `rootPath`, `compact` removed. Prop `initialCompact` added.
    * Prop `onContentTypeSelected` changed its signature from sending an object with `authoringBase`, `path`, `isNewContent`, `contentTypeId`, `onSaveSuccess` to `{ path: string; contentType: ContentType }`
  * [CompareVersions] Removed.
  * [EnhancedDialog] Removed unused `id` prop.
  * [CompareVersionsDialog] Added `subtitle`, `selectionContent`, and `fields` properties.
  * [ViewVersionDialog] Added `onClose` property.
  * [ViewVersionDialogContainer] Added `contentTypesBranch`, `showXml` and `data` properties.
  * [DeleteDialog] Removed `childItems` and `dependentItems` props. Dependencies are not in redux state anymore.
  * [RenameAssetDialog] Removed `dependantItems` and `fetchingDependantItems` props. Dependencies are not in redux state anymore.
  * [PublishingStatusTile] Removed `enabled` and `status` properties. Replaced with `publishingStatus` (type `PublishingStatus`).
  * [PublishDialog]
    * Added `buildPathTrees` util that builds a tree structure from a list of paths, grouping them by root directories.
  * [PublishDialogForm]
    * Removed `state`, `published`, `publishingTargetsStatus`, `onPublishingChannelsFailRetry`, `submissionCommentRequired`, `publishingChannels` and `onChange` props. Added `onSubmit`, `formState`, `onInputChange`, `onDateTimePickerChange`, `showRequestApproval`, `isPromote`, and `onFetchedPublishedTargets` props.
    * Updated `PublishFormProps` type to `PublishDialogFormProps` interface.
  * [PublishingStatusButtonUI] Removed `numberOfItems`, `totalItems` and `status` properties. Added `published` and `currentTask` properties.
  * Added dialogs: `CancelPackageDialog`, `BulkCancelPackageDialog`, `PublishPackageReviewDialog`, `PublishingPackageResubmitDialog`, `ViewPackagesDialog`.
  * [RenameAssetDialog] Removed `path` and `value` properties. Replaced with `item` property.
  * [ItemDisplay] Updated `item` prop to be of type `LightItem | ContentItem`.
  * `PathNavigator/PathNavigatorTree`: Updated `label` prop to be of type `TranslationOrText`.
  * `PathNavigatorTreeUI/PathNavigatorUI/PathNavigatorTreeHeader`: Updated `title` prop to be of type `string | ReactNode`.
  * Removed `LegacyComponentsPanel` component.
  * [EditGroupDialogUI] Updated `onFetchMoreUsers` prop return type to `Promise`.
  * [PackageItemsList] Updated `loadNextPage` prop return type to `Promise`.
  * [TransferListColumn] Updated `onFetchMore` prop return type to `Promise`.
  * [DependenciesDialog] Updated `dependencies` prop to be of type `ContentItem[] | LightItem[]` and `renderAction` prop to be of type `(item: ContentItem | LightItem) => ReactNode`.
  * [RenameContentDialogContainer] Updated `dependantItems` prop to be of type `LightItem[]`.
  * [RenameItemView] Updated `dependantItems` prop to be of type `LightItem[]`.
  * Removed `CopyDialog` component.
  * [TypeList] Added `disableSelected` prop.
  * [UserManagement] Removed delete user functionality. Only `enable`/`disable` users is allowed.
* [hooks]
  * Removed `useLogicResource` hook.
  * Removed `useSelectorResource` hook.
  * Removed `useQuickCreateListResource` hook.
  * Removed `useSystemVersionResource` hook.
  * Removed `useResolveWhenNoNullResource` hook.
  * Renamed `useDetailedItem` to `useContentItem`.
  * Removed `useDetailedItems` hook. Use `useFetchContentItems` instead.
  * Renamed `useFetchSandboxItems` to `useFetchContentItems`.
* Upgrade to the latest version to date of the following libraries:
  * @mui/icons-material
  * @mui/lab
  * @mui/material
  * @mui/x-data-grid
  * @mui/x-date-pickers
  * @mui/x-tree-view
  * Uppy
  * GraphiQL
  * react-window
* Moved getPersonFullName to utils/object
* FE2 TODO: image=>image-picker, text=>input, etc services/contentType typeMap removed
* Removed WidgetDialogContextType, WidgetDialogContext, useWidgetDialogContext. Use `useEnhancedDialogContext` instead.
* [services]
  * `publishing/fetchPackages` filters param updated to be a Partial of `target`, `states`, `approvalStates`, `submitter`, `reviewer`, `isScheduled`, `sort`, `offset` and `limit`.
  `environment` is now `target` and `path` was removed from filters param.
  * `publishing/fetchPackage`: `packageId` is now of type `number`.
  * Updated `workflow/approve`: Now it receives `packageId` as a parameter.
  * Updated `workflow/reject`: Now it receives `packageId` as a parameter instead of `items`.
  * Removed `workflow/publish` and `workflow/requestPublish`, replaced by `publishing/publish` and `publishing/publish`.
  * Removed `publishing/cancelPackage` service, replaced by `workflow/cancel`.
  * Removed `publishing/start` and `publishing/stop` services, replaced by `publishing/enable`.
  * Removed `publishing/bulkGoLive`, `publishing/publishByCommits` and `publishing/publishAll` services, replaced by `publishing/publish`.
  * Removed `content/fetchWorkflowAffectedItems` service. Now workflow affected validation is checked against packages using `workflow/fetchAffectedPackages`.
  * Removed `publishing/clearLock` service.
  * Removed `cmis` services.
  * Removed `content/uploadToCMIS` service.
  * Removed `models/CMIS` service.
  * Renamed `content/fetchDetailedItem` to `fetchContentItem`.
  * Renamed `content/fetchItemsByPath` to `fetchContentItems`.
  * Removed `content/fetchSandboxItem`. Replaced by `fetchContentItem`.
  * Removed `content/fetchDetailedItems`. Replaced by `fetchContentItems`.
  * Removed `content/changeContentType`.
  * Updated `dashboard/fetchPublishingHistoryPackageItems` `packageId` parameter to be of type `number`.
  * Updated `dependencies/fetchDependencies` `items` parameter to be of type `string[]`, renamed variable to `paths`
  * Updated `publishing/fetchPackage` `packageId` parameter to be of type `number`, and added the parameter `data`.
  * Updated `publishing/fetchPackages` `filters` parameter to be required, and removed the filters object props `environment` and `path`. Added filters object props `target`, `approvalStates`, `submitter`, `reviewer`, `isScheduled` and `sort`.
  * Removed `sites/fetchLegacySite`. Replaced by `sites/fetchSite`.
  * Updated `configuration/fetchProductLanguages` to use API v2 (`/api/2/system/available_languages`)
  * Updated `dependencies/fetchDependencies` to use API v2 (`/studio/api/2/dependency/{siteId}/publish_dependencies`)
  * Updated `dependencies/fetchSimpleDependencies` to use API v2 (`/studio/api/2/dependency/{siteId}/dependencies`)
  * Updated `dependencies/fetchDependant` to use API v2 (`/studio/api/2/dependency/{siteId}/dependent_items`)
  * Removed `content/fetchLegacyItemsTree` service.
  * Removed `users/trash` service.
* `PublishingItem` interface changes:
  * `approver` is now `reviewer`, of type Person.
  * `comment` is removed, and now there's `reviewerComment` and `submitterComment`.
  * `environment` is now `target`.
  * `items` is now of type `PublishingItem[]`.
  * `state` is now `approvalState`.
  * Added `title`, `submittedOn`, `reviewedOn`,`packageState`, `reviewer`, `liveError`, `stagingError`, `publishedOn`, `packageType`, `commitId`, `publishedStagingCommitId` and `publishedLiveCommitId` props.
* `PublishFormData` interface change: Added `title` prop.
* ExpiredItem interface change: changed `sandboxItem` prop to `contentItem`.
* Removed `SandboxItem` and `DetailedItem` interfaces, replaced by `ContentItem`.
* `DeleteDialogBaseProps` and `FetchDeleteDependenciesResponse` interfaces: Update `childItems` and `dependentItems` to be of type `LightItem[]`.
* `CalculatedPackageResponse` interface: Update `hardDependencies`, `softDependencies` and `items` to be of type `LightItem[]`.
* `approvePublish` and `rejectPublish` are no longer item actions in BaseItem's `availableActionsMap` property.
* [SiteDashboard/utils] Renamed `getValidatedSelectionState` to `getItemsValidatedSelectionState`.
* [state]
  * `actions/content`:
    * Renamed `fetchDetailedItem` action to `fetchContentItem`. Action string changed from `FETCH_DETAILED_ITEM` to `FETCH_CONTENT_ITEM`.
    * Renamed `reloadDetailedItem` action to `reloadContentItem`. Action string changed from `RELOAD_DETAILED_ITEM` to `RELOAD_CONTENT_ITEM`.
    * Renamed `fetchDetailedItemComplete` action to `fetchContentItemComplete`. Action string changed from `FETCH_DETAILED_ITEM_COMPLETE` to `FETCH_CONTENT_ITEM_COMPLETE`.
    * Renamed `fetchSandboxItems` to `fetchContentItems`. Action string changed from `FETCH_SANDBOX_ITEMS` to `FETCH_CONTENT_ITEMS`.
    * Renamed `fetchSandboxItemsComplete` to `fetchContentItemsComplete`. Action string changed from `FETCH_SANDBOX_ITEMS_COMPLETE` to `FETCH_CONTENT_ITEMS_COMPLETE`.
    * Removed `fetchSandboxItem` action. Replaced by `fetchContentItem`.
    * Removed `fetchDetailedItemComplete` action. Replaced by `fetchContentItemComplete`.
    * Removed `fetchDetailedItems` action. Replaced by `fetchContentItems`.
    * Removed `fetchDetailedItemsComplete` action. Replaced by `fetchContentItemsComplete`.
    * Removed `completeDetailedItem` action.
    * Updated `setClipboard` and `restoreClipboard` action payload, removed `paths` and added `includeChildren` property.
  * `actions/dialogs`:
    * Updated `historyDialogUpdate` action type to `UPDATE_HISTORY_DIALOG`.
    * Removed `fetchDeleteDependencies`, `fetchDeleteDependenciesComplete`, `fetchDeleteDependenciesFailed` actions.
    * Updated `newContentCreationComplete` action payload to be `{ item: LegacyItem; redirectUrl: string }`.
    * Updated `updateEditDialogConfig` action type to `UPDATE_EDIT_DIALOG`.
    * Updated `fetchRenameAssetDependants` action payload to be `{ path: string; dialogId: string }`.
    * Updated `updateSingleFileUploadDialog` action payload to be `Partial<CreateFileStateProps>`
    * Created `updateLauncher` action.
    * Removed `showCopyDialog`, `closeCopyDialog`, `copyDialogClosed` and `updateCopyDialog` actions.
  * `actions/system`:
    * Updated `showEditItemSuccessNotification` action payload to be `{ action: CommonSaveOptions; }`.
    * Removed `workflowEvent`. Replaced by `workflowEventSubmit`, `workflowEventDirectPublish`, `workflowEventApprove`, `workflowEventReject`, `workflowEventCancel`.
  * `actions/preview`:
    * `requestWorkflowCancellationDialog`: Removed `path`, replaced by `item`.
* [models/Publishing]
  * `Package`: Updated id to be of type `number`.
  * `CurrentFilters`: Removed `environment`, `path`, `state` and `page` properties. Added `target`, `states`, `approvalStates`, `submitter`, `reviewer`, `isScheduled`, `sort` and `offset` properties.
  * `PublishingStatusCodes`: Removed `processing`, `queued`, `error` and `readyWithErrors`.
  * `PublishingStatus`:
    * Removed `status`, `lockOwner`, `lockTTL`, `publishingTarget`, `submissionId`, `numberOfItems`, and `totalItems`. Added `currentTask` property.
    * Updated `state` property to be of type `'READY' | 'IN_PROGRESS' | 'COMPLETED'`.
  * `PublishFormData`: Added `title` property.
  * `PublishingTarget`: updated `name` property to be of type `'live' | 'staging'`.
  * `PublishingParams`: Removed `optionalDependencies` and `sendEmailNotifications` properties. Added `paths`, `commitIds`, `requestApproval`, `publishAll` and `title` properties.
* [models/Site]
  * Removed `LegacySite` model. Use `BackendSite` model instead.
* [models/GlobalState]
  * Updated `Clipboard` interface: removed `paths` property, added `includeChildren` property.
* [common-api.js]
  * Removed `CStudioAuthoring.Operations.uploadCMISAsset` and `CStudioAuthoring.Operations.openCMISUploadDialog`.
* Removed LegacyVersionDialog and the entire associated `/studio/diff` route
* [ItemDisplay/utils]
  * Updated `getItemPublishingTargetText` to return a string. It now receives `formatMessage` as a parameter.
  * Updated `getItemStateText` to return a string. It now receives `formatMessage` as a parameter.
* Removed `react-swipeable-views` packages and replaced it with a new forwardRef `PluginMediaCarousel` component.

## 4.2.0

* [utils/xml] Upgrade prettier to v3x which changed from sync apis to async
  * `serialize` no longer formats code
  * `beautify` is now async
* [components]
  * HostUI removed, merged with Host (its container component)
  * EditModeSwitcherUI removed, merged with EditModeSwitcher (its container component)
  * Removed Legacy Dashboard components:
    * `LegacyApprovedScheduledDashlet`
    * `LegacyAwaitingApprovalDashlet`
    * `LegacyInReviewDashlet`
    * `LegacyRecentActivityDashlet`
    * `LegacyRecentActivityDashlet`
    * `LegacyRecentlyPublishedDashlet`
    * `LegacyUnpublishedDashlet`
  * Removed `documentDomain` property from ExperienceBuilder component and its usage in `PreviewConcierge` component
  * `WorkflowCancellationDialogUI`: prop `items` type changed from an async Resource to sync SandboxItem array.
  * `AuthorFilter` removed, merged with ActivityDashlet
  * `UsersAutocomplete` removed
  * `UploadDialog`: Added `autoProceed` prop to enable/disable automatic upload after file selection
  * `DropDownMenuButton` component:
    * Internal structure changed so that ListItem wraps the ListItemButton
    * `listItemProps` are routed to the list `ListItem` component instead of the `ListItemButton`
    * Added `listItemButtonProps` property
  * `DraggablePanelListItem` prop `onMenu` send the pointer event as its first and only argument instead of the anchor element attached to the event. Can get element through `event.currentTarget`.
  * `DateTimePicker` was moved & renamed to `DateTimeTimeZonePicker` to better reflect its functionality and to avoid collision with MUI's DateTimePicker.
    *  Components that used the previous version now use the new DateTimeTimeZonePicker (i.e. CreatePreviewTokenDialog, CreateTokenDialogContainer, PublishDialogForm, PublishDialogContainer, FormEngineControls/DateTime, AudiencesPanelUI)
* [services] Removed services associated with v1 APIs:
  * `fetchLegacyGetGoLiveItems`
  * `fetchLegacyUserActivities`
  * `fetchLegacyScheduledItems`
  * `fetchPendingApprovalPackageItems`
  * `fetchLegacyDeploymentHistory`
  * `getUserPermissions`
    * Use `fetchMyPermissions` instead
  * [services/contentTypes] Add `fetchContentType` service
* [state]
  * `actions/dialogs`: Renamed `updateEditConfig` action to `updateEditDialogConfig`
* [hooks]
  * `usePreviewUrlControl`: Removed `history` prop. Retrieval of search and navigate (previously called 'push') is now done internally.
* Removed deprecated `aws-file-upload` and `aws-video` upload controls.
* Migrated the Studio UI build to Vite/SWC
* Rollup's XB build to use SWC
* Upgraded target compilation to ES2022, dropping many code transforms for features that are supported by most modern browsers such as nullish coalescing, optional chaining, object spreading and destructuring.
* The `allowedContentTypes` ContentTypeField validation changed from being an array to a Record<contentTypeId, { embedded?: true; shared?: true; sharedExisting?: true; }>
* Remove legacy `browseCMIS` dialog and `openCMISBrowse` function from common-api.
* Remove `CMIS-repo`, `CMIS-upload`, `img-cmis-repo`, `img-CMIS-upload`, `video-cmis-repo` and `video-CMIS-upload` datasources.
* `ICEConfig` TypeScript `interface` changed to be `type`. It now accepts either the (model) or (modelId & path).
* The `acecode` TinyMCE plugin (for code-highlighted Rich Text Editor code editing), renders the code exactly as Tiny provides without decoding entities.
* `compareVersion` action creator was removed as the action is no longer in use and handled.
* Many dependencies and peerDependencies have been updated to in most cases a newer **major** release.
  * [@craftercms/studio-ui] @craftercms/uppy@4.2.0, @graphiql/plugin-explorer@^3.0.1, @mui/x-data-grid@^7.13.0, @mui/x-date-pickers@^7.13.0, @mui/x-tree-view@^7.13.0, @prettier/plugin-xml@3.3.0, @reduxjs/toolkit@^2.2.5, @types/ace@^0.0.52, @types/react@^18.3.2, @types/react-dom@^18.3.0, @types/react-swipeable-views@^0.13.5, @types/video.js@^7.3.58, clsx@^2.1.1, fast-xml-parser@^4.3.6, graphiql@^3.2.2, graphql@^16.8.1, graphql-ws@^5.16.0, marked@^12.0.2, marked-highlight@^2.1.1, moment-timezone@^0.5.45, nanoid@^5.0.7, prettier@^3.2.5, react-hotkeys-hook@^4.5.0, tss-react@^4.9.10, query-string@^9.0.0, react-redux@^9.1.2, react-router-dom@^6.0.0, redux@^5.0.1, redux-observable@^3.0.0-rc.2, video.js@^8.12.0
  * [@craftercms/experience-builder] @craftercms/classes@4.2.0, @craftercms/content@4.2.0, @craftercms/ice@4.2.0, @craftercms/search@4.2.0, @craftercms/studio-ui@4.2.0, @reduxjs/toolkit@^2.2.5, @rollup/plugin-alias@^5.1.0, @types/react-dom@^18.3.0, react-hotkeys-hook@^4.5.0, react-is@^18.3.1, uuid@^10.0.0, react-redux@^9.1.2, redux@^5.0.1, redux-observable@^3.0.0-rc.2
  * [@craftercms/search] uuid@^10.0.0
  * [@craftercms/redux] @reduxjs/toolkit@^2.2.2, redux@^5.0.1, redux-observable@^3.0.0-rc.2
  * [@craftercms/classes] query-string@^9.1.0

## 4.1.6
* `ICEConfig` TypeScript `interface` changed to be `type`. It now accepts either the (model) or (modelId & path).

## 4.1.5
* [common-api.js]
  * `CStudioAuthoring.Utils.showConfirmDialog`: Added function overload to receive a `props` style object as first and only argument. The props argument would contain all ConfirmDialog props. Original set of arguments still supported for backward compatibility.
* Removed `item` property from EditModeSwitch component and its usage in `PreviewSettingsPanel` component
* `pathNavigatorTreeFetchPathChildrenFailed` action creator payload requires a `path` property.

## 4.1.4
  * `UploadDialog`: Added props `endpoint`, `method`, `headers`, `meta`, `allowedMetaFields`, `useFormData`, `fieldName` and `onFileAdded` for additional control over the upload process.

## 4.1.3

* HostUI removed and merged into Host
* Upgraded yarn
* Upgrade to the latest version to date of the following libraries:
  * @mui/*
  * jquery
  * moment
  * ace
  * bootstrap
* Replace Navigators to work with new bulk children fetcher api
* `utils/content/parseContentXML` & `utils/content/parseElementByContentType`: new argument added to the bottom of the arguments list: `unflattenedPaths`. The argument should be an object that will be populated by the method with `path: object` pairs for the unflattened content items whose data is incomplete while processing.
  * This argument is likely to be required in next versions of the package.
* **Breaking Changes**
  * `services/content/insertComponent`: function now requires the parent document content type and the path argument moves to being earlier in the argument list.
    The shifting of the arguments seeks a more coherent argument order, grouping parent-related arguments first, followed by inserted instance related arguments, and finally supportive arguments last.
    * **Previously**: siteId, parentModelId, parentFieldId, targetIndex, **_insertedItemContentType_**, **_insertedContentInstance_**, _**parentDocPath**_, isSharedInstance, shouldSerializeValueFn?
    * **Now**: siteId, _**parentDocPath**_, parentModelId, parentFieldId, targetIndex, _**parentContentType**_, _**insertedContentInstance**_, _**insertedItemContentType**_, isSharedInstance, shouldSerializeValueFn?
  * `services/content/insertInstance`: function now requires the parent document content type and the path argument moves to being earlier in the argument list.
    The shifting of the arguments seeks a more coherent argument order, grouping parent-related arguments first, followed by inserted instance related arguments, and finally supportive arguments last.
    * **Previously**: siteId, parentModelId, parentFieldId, targetIndex, insertedInstance, _**parentDocPath**_, datasource?
    * **Now**: siteId, _**parentDocPath**_, parentModelId, parentFieldId, targetIndex, _**parentContentType**_, insertedInstance, datasource?
  * `components/LegacyComponentsPanel/utils/fetchAndInsertContentInstance`: the function now requires the parent content type id as its last argument. Note this whole component module is likely to be removed in the future.

## 4.1.2

* Update return type of configuration/fetchHistory and content/fetchItemHistory to `ItemHistoryEntry[]`.
* Update content/fetchItemHistory service to use new `/studio/api/2/content/item_history` API.
* Removed deprecated `Guest` component. Use `ExperienceBuilder`.
* Removed deprecated RenderField prop `format`. Use `render`.

## 4.1.1

* SandboxItem and DetailedItem changes:
  * Update `creator` and `modifier` props to be of type `Person`.
  * Add `submitter` prop of type `Person`.
  * Add `dateSubmitted` prop of type string.
* Update PendingApprovalDashlet and ScheduledDashlet to use new `submitter` and `dateSubmitted` props.
