/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { h } from 'preact';
import { Dashboard as UppyDashboard, ThumbnailGenerator } from 'uppy';
import { findAllDOMElements } from '@uppy/core/utils';
import { defaultPickerIcon } from '@uppy/core/provider-views';
import locale from './locale';
import DashboardUI from '../components/Dashboard';

const defaultOptions = {
	target: 'body',
	metaFields: [],
	thumbnailWidth: 280,
	thumbnailType: 'image/jpeg',
	waitForThumbnailsBeforeUpload: false,
	defaultPickerIcon,
	showLinkToFileUploadResult: false,
	hideProgressDetails: false,
	hideUploadButton: false,
	hideCancelButton: false,
	hideRetryButton: false,
	hidePauseResumeButton: false,
	hideProgressAfterFinish: false,
	note: null,
	singleFileFullScreen: true,
	disableStatusBar: false,
	disableInformer: false,
	disableThumbnailGenerator: false,
	fileManagerSelectionType: 'files',
	proudlyDisplayPoweredByUppy: true,
	showSelectedFiles: true,
	showRemoveButtonAfterComplete: false,
	showNativePhotoCameraButton: false,
	showNativeVideoCameraButton: false,
	theme: 'light',
	autoOpen: null,
	disabled: false,
	disableLocalFiles: false,
	nativeCameraFacingMode: '',
	onDragLeave: () => {},
	onDragOver: () => {},
	onDrop: () => {},
	plugins: [],

	// Dynamic default options, they have to be defined in the constructor (because
	// they require access to the `this` keyword), but we still want them to
	// appear in the default options so TS knows they'll be defined.
	doneButtonHandler: undefined,
	onRequestCloseModal: null,

	// defaultModalOptions
	inline: false,
	animateOpenClose: true,
	browserBackButtonClose: false,
	closeAfterFinish: false,
	closeModalOnClickOutside: false,
	disablePageScrollWhenModalOpen: true,
	trigger: null,

	// defaultInlineOptions
	width: 750,
	height: 550
};

export class Dashboard extends UppyDashboard {
	constructor(uppy, opts) {
		const autoOpen = opts?.autoOpen ?? null;
		super(uppy, { ...defaultOptions, ...opts, autoOpen });
		this.id = this.opts.id || 'Dashboard';
		this.title = 'Dashboard';
		this.type = 'orchestrator';

		this.defaultLocale = locale;

		// Dynamic default options:
		if (this.opts.doneButtonHandler === undefined) {
			// `null` means "do not display a Done button", while `undefined` means
			// "I want the default behavior". For this reason, we need to differentiate `null` and `undefined`.
			this.opts.doneButtonHandler = () => {
				this.uppy.clear();
				this.requestCloseModal();
			};
		}
		this.opts.onRequestCloseModal ??= () => this.closeModal();

		this.i18nInit();
	}

	addFiles = (files) => {
		let descriptors = files.map((file) => {
			// When uploading via drag and drop, uppy uses `relativePath` as the prop for the actual relative path, for
			// browse uploads, it uses `webkitRelativePath`.
			const relativePath = file.relativePath ?? file.webkitRelativePath ?? null;
			const path = relativePath
				? this.opts.path + relativePath.substring(0, relativePath.lastIndexOf('/'))
				: this.opts.path;
			const fullPath = `${path.endsWith('/') ? path : path + '/'}${file.name}`;
			return {
				source: this.id,
				name: file.name,
				type: file.type,
				data: file,
				meta: {
					// path of the file relative to the ancestor directory the user selected.
					// e.g. 'docs/Old Prague/airbnb.pdf'
					relativePath: file.relativePath || file.webkitRelativePath || null,
					// craftercms/uppy - sitePolicy custom value
					validating: true,
					path: fullPath
				}
			};
		});

		const maxActiveUploads = this.opts.maxActiveUploads;
		const uppyFiles = this.uppy.getFiles();

		const inProgressFiles = Object.keys(uppyFiles).filter((file) => {
			return !uppyFiles[file].progress.uploadComplete && uppyFiles[file].progress.uploadStarted;
		});

		if (inProgressFiles.length + descriptors.length > maxActiveUploads) {
			const availableUploads = maxActiveUploads - inProgressFiles.length;
			descriptors = descriptors.slice(0, availableUploads);
			this.opts.onMaxActiveUploadsReached?.();
		}

		try {
			this.uppy.addFiles(descriptors);
		} catch (err) {
			this.uppy.log(err);
		}
	};

	handleComplete = ({ failed }) => {
		// craftercms/uppy - custom code
		const files = this.uppy.getFiles();
		let completeFiles = 0;
		let invalidFiles = 0;
		files.forEach((file) => {
			if (file.progress.uploadComplete) {
				completeFiles++;
			}
			if (file.meta.allowed === false || file.meta.suggestedName || file.meta.overwriteRequired) {
				invalidFiles++;
			}
		});
		const allFilesCompleted = files.length === completeFiles + invalidFiles;
		// end craftercms/uppy - custom code

		if (allFilesCompleted && !failed?.length) {
			// All uploads are done
			if (this.opts.closeAfterFinish) {
				this.requestCloseModal();
			}
			this.opts.onPendingChanges(false);
		}
	};

	// craftercms/uppy - check path existence custom code
	checkPathAndUpload = (fileId, path, invalidFiles, { onUploadStarted, onComplete } = {}) => {
		const complete = () => onComplete?.();

		const startUpload = () => {
			this.uppy.retryUpload(fileId);
			onUploadStarted?.();
			complete();
		};

		if (!this.opts.checkPathExistence) {
			startUpload();
			return;
		}

		this.opts.checkPathExistence(this.opts.site, path).subscribe({
			next: (exists) => {
				if (exists) {
					invalidFiles[fileId] = true;
					this.uppy.setFileMeta(fileId, {
						allowed: true,
						overwriteRequired: true
					});
					this.setPluginState({ invalidFiles: { ...invalidFiles } });
					complete();
				} else {
					startUpload();
				}
			},
			error: (err) => {
				invalidFiles[fileId] = true;
				const detail =
					err?.response?.response?.message ??
					(typeof err?.response?.response === 'string' ? err.response.response : null) ??
					err?.message ??
					this.i18n('pathExistenceCheckFailed');
				this.uppy.setFileMeta(fileId, {
					allowed: false,
					message: detail
				});
				this.setPluginState({ invalidFiles: { ...invalidFiles } });
				this.opts.onPathExistenceError?.(err);
				complete();
			}
		});
	};

	// craftercms/uppy - site policy custom code
	validateFilesPolicy = (files) => {
		if (files.length === 0) return;
		const fileIdLookup = {};
		const invalidFiles = { ...this.getPluginState().invalidFiles };
		let uploading = false;
		let pendingExistenceChecks = 0;
		let finalized = false;

		const finalizeExistenceChecks = () => {
			if (finalized) return;
			finalized = true;
			this.opts.onPendingChanges(uploading);
			this.setPluginState({ invalidFiles });
		};

		const onExistenceCheckComplete = () => {
			pendingExistenceChecks--;
			if (pendingExistenceChecks === 0) {
				finalizeExistenceChecks();
			}
		};

		this.opts
			.validateActionPolicy(
				this.opts.site,
				files.map((file) => {
					let target = file.meta.path;
					fileIdLookup[target] = file.id;
					return {
						type: 'CREATE',
						target,
						contentMetadata: {
							fileSize: file.size
						}
					};
				})
			)
			.subscribe((response) => {
				pendingExistenceChecks = response.filter(
					({ allowed, modifiedValue }) => allowed && modifiedValue === null && this.opts.checkPathExistence
				).length;

				response.forEach(({ allowed, modifiedValue, target, message }) => {
					let fileId = fileIdLookup[target];
					this.uppy.setFileMeta(fileId, {
						validating: false,
						allowed,
						message,
						...(modifiedValue && { suggestedName: modifiedValue.replace(/^.*[\\\/]/, '') })
					});
					if (allowed && modifiedValue === null) {
						if (this.opts.checkPathExistence) {
							this.checkPathAndUpload(fileId, target, invalidFiles, {
								onUploadStarted: () => {
									uploading = true;
								},
								onComplete: onExistenceCheckComplete
							});
						} else {
							this.uppy.retryUpload(fileId);
							uploading = true;
						}
					} else {
						invalidFiles[fileId] = true;
					}
				});
				if (pendingExistenceChecks === 0) {
					finalizeExistenceChecks();
				}
			});
	};

	validateAndRetry = (fileID) => {
		const invalidFiles = { ...this.getPluginState().invalidFiles };
		const file = this.uppy.getFile(fileID);
		const suggestedName = file.meta.suggestedName;
		const initialPath = file.meta.path;
		const path = initialPath.substring(0, initialPath.lastIndexOf('/')) + '/' + suggestedName;
		invalidFiles[fileID] = false;
		this.setPluginState({ invalidFiles });
		this.uppy.setFileMeta(fileID, {
			allowed: true,
			suggestedName: null,
			name: suggestedName,
			path
		});
		this.checkPathAndUpload(fileID, path, invalidFiles, {
			onUploadStarted: () => {
				this.opts.onPendingChanges(true);
			}
		});
	};

	confirmOverwrite = (fileID) => {
		const invalidFiles = { ...this.getPluginState().invalidFiles };
		invalidFiles[fileID] = false;
		this.setPluginState({ invalidFiles });
		this.uppy.setFileMeta(fileID, { overwriteRequired: null });
		this.uppy.retryUpload(fileID);
		this.opts.onPendingChanges(true);
	};

	validateAndRemove = (fileID) => {
		const invalidFiles = { ...this.getPluginState().invalidFiles };
		if (invalidFiles[fileID]) {
			invalidFiles[fileID] = false;
		}
		this.setPluginState({ invalidFiles });
		this.uppy.removeFile(fileID);
	};

	cancelPending = () => {
		const invalidFiles = { ...this.getPluginState().invalidFiles };
		this.uppy.getFiles().forEach((file) => {
			if (!file.progress.uploadComplete) {
				if (invalidFiles[file.id]) {
					invalidFiles[file.id] = false;
				}
				this.uppy.removeFile(file.id);
			}
		});
		this.setPluginState({ invalidFiles });
		this.opts.onPendingChanges(false);
	};

	clearCompleted = () => {
		this.uppy.getFiles().forEach((file) => {
			if (file.progress.uploadComplete) {
				this.uppy.removeFile(file.id);
			}
		});
	};

	rejectAll = () => {
		const invalidFiles = { ...this.getPluginState().invalidFiles };
		Object.keys(invalidFiles).forEach((fileID) => {
			if (invalidFiles[fileID]) {
				invalidFiles[fileID] = false;
				this.uppy.removeFile(fileID);
			}
		});
		this.setPluginState({ invalidFiles });
	};

	confirmAll = () => {
		const invalidFiles = { ...this.getPluginState().invalidFiles };
		let uploading = false;
		let pendingPathChecks = 0;
		let finalized = false;

		const finalizePathChecks = () => {
			if (finalized) return;
			finalized = true;
			if (uploading) this.opts.onPendingChanges(true);
		};

		const onPathCheckComplete = () => {
			pendingPathChecks--;
			if (pendingPathChecks === 0) {
				finalizePathChecks();
			}
		};

		Object.keys(invalidFiles).forEach((fileID) => {
			if (invalidFiles[fileID]) {
				invalidFiles[fileID] = false;
				const file = this.uppy.getFile(fileID);
				if (!file) {
					return;
				}
				if (file.meta.overwriteRequired) {
					this.uppy.setFileMeta(fileID, { overwriteRequired: null });
					this.uppy.retryUpload(fileID);
					uploading = true;
				} else if (file.meta.allowed) {
					const suggestedName = file.meta.suggestedName;
					const initialPath = file.meta.path;
					const basePath = initialPath.substring(0, initialPath.lastIndexOf('/'));
					const path = `${basePath}/${suggestedName}`;
					this.uppy.setFileMeta(fileID, {
						allowed: true,
						suggestedName: null,
						name: suggestedName,
						path
					});
					pendingPathChecks++;
					this.checkPathAndUpload(fileID, path, invalidFiles, {
						onUploadStarted: () => {
							uploading = true;
						},
						onComplete: onPathCheckComplete
					});
				} else {
					this.uppy.removeFile(fileID);
				}
			}
		});
		this.setPluginState({ invalidFiles });
		if (pendingPathChecks === 0) {
			finalizePathChecks();
		}
	};

	#generateLargeThumbnailIfSingleFile = () => {
		if (this.opts.disableThumbnailGenerator) {
			return;
		}

		const LARGE_THUMBNAIL = 600;
		const files = this.uppy.getFiles();

		if (files.length === 1) {
			const thumbnailGenerator = this.uppy.getPlugin(`${this.id}:ThumbnailGenerator`);
			thumbnailGenerator?.setOptions({ thumbnailWidth: LARGE_THUMBNAIL });
			const fileForThumbnail = { ...files[0], preview: undefined };
			thumbnailGenerator?.requestThumbnail(fileForThumbnail).then(() => {
				thumbnailGenerator?.setOptions({
					thumbnailWidth: this.opts.thumbnailWidth
				});
			});
		}
	};

	#openFileEditorWhenFilesAdded = (files) => {
		const firstFile = files[0];

		const { metaFields } = this.getPluginState();
		const isMetaEditorEnabled = metaFields && metaFields.length > 0;
		const isImageEditorEnabled = this.canEditFile(firstFile);

		if (isMetaEditorEnabled && this.opts.autoOpen === 'metaEditor') {
			this.toggleFileCard(true, firstFile.id);
		} else if (isImageEditorEnabled && this.opts.autoOpen === 'imageEditor') {
			this.openFileEditor(firstFile);
		}
	};

	initEvents = () => {
		// Modal open button
		if (this.opts.trigger && !this.opts.inline) {
			const showModalTrigger = findAllDOMElements(this.opts.trigger);
			if (showModalTrigger) {
				showModalTrigger.forEach((trigger) => trigger.addEventListener('click', this.openModal));
			} else {
				this.uppy.log(
					'Dashboard modal trigger not found. Make sure `trigger` is set in Dashboard options, unless you are planning to call `dashboard.openModal()` method yourself',
					'warning'
				);
			}
		}

		this.startListeningToResize();
		document.addEventListener('paste', this.handlePasteOnBody);

		this.uppy.on('plugin-added', this.#addSupportedPluginIfNoTarget);
		this.uppy.on('plugin-remove', this.removeTarget);
		this.uppy.on('file-added', this.hideAllPanels);
		this.uppy.on('dashboard:modal-closed', this.hideAllPanels);
		this.uppy.on('complete', this.handleComplete);

		this.uppy.on('files-added', this.#generateLargeThumbnailIfSingleFile);
		this.uppy.on('file-removed', this.#generateLargeThumbnailIfSingleFile);
		this.uppy.on('files-added', this.validateFilesPolicy);

		// ___Why fire on capture?
		//    Because this.ifFocusedOnUppyRecently needs to change before onUpdate() fires.
		document.addEventListener('focus', this.recordIfFocusedOnUppyRecently, true);
		document.addEventListener('click', this.recordIfFocusedOnUppyRecently, true);

		if (this.opts.inline) {
			this.el.addEventListener('keydown', this.handleKeyDownInInline);
		}

		if (this.opts.autoOpen) {
			this.uppy.on('files-added', this.#openFileEditorWhenFilesAdded);
		}
	};

	removeEvents = () => {
		const showModalTrigger = findAllDOMElements(this.opts.trigger);
		if (!this.opts.inline && showModalTrigger) {
			showModalTrigger.forEach((trigger) => trigger.removeEventListener('click', this.openModal));
		}

		this.stopListeningToResize();
		document.removeEventListener('paste', this.handlePasteOnBody);
		window.removeEventListener('popstate', this.handlePopState, false);

		this.uppy.off('plugin-added', this.#addSupportedPluginIfNoTarget);
		this.uppy.off('plugin-remove', this.removeTarget);
		this.uppy.off('file-added', this.hideAllPanels);
		this.uppy.off('dashboard:modal-closed', this.hideAllPanels);
		this.uppy.off('complete', this.handleComplete);

		this.uppy.off('files-added', this.#generateLargeThumbnailIfSingleFile);
		this.uppy.off('file-removed', this.#generateLargeThumbnailIfSingleFile);
		this.uppy.off('files-added', this.validateFilesPolicy);

		document.removeEventListener('focus', this.recordIfFocusedOnUppyRecently);
		document.removeEventListener('click', this.recordIfFocusedOnUppyRecently);

		if (this.opts.inline) {
			this.el.removeEventListener('keydown', this.handleKeyDownInInline);
		}

		if (this.opts.autoOpen) {
			this.uppy.off('files-added', this.#openFileEditorWhenFilesAdded);
		}
	};

	#attachRenderFunctionToTarget = (target) => {
		const plugin = this.uppy.getPlugin(target.id);
		return {
			...target,
			icon: plugin.icon || this.opts.defaultPickerIcon,
			render: plugin.render
		};
	};

	#isTargetSupported = (target) => {
		const plugin = this.uppy.getPlugin(target.id);
		// If the plugin does not provide a `supported` check, assume the plugin works everywhere.
		if (typeof plugin.isSupported !== 'function') {
			return true;
		}
		return plugin.isSupported();
	};

	#getAcquirers = (targets) => {
		return targets
			.filter((target) => target.type === 'acquirer' && this.#isTargetSupported(target))
			.map(this.#attachRenderFunctionToTarget);
	};

	#getProgressIndicators = (targets) => {
		return targets.filter((target) => target.type === 'progressindicator').map(this.#attachRenderFunctionToTarget);
	};

	#getEditors = (targets) => {
		return targets.filter((target) => target.type === 'editor').map(this.#attachRenderFunctionToTarget);
	};

	render = (state) => {
		const pluginState = this.getPluginState();
		const { files, capabilities, allowNewUpload } = state;
		const {
			newFiles,
			uploadStartedFiles,
			completeFiles,
			erroredFiles,
			inProgressFiles,
			inProgressNotPausedFiles,
			processingFiles,

			isUploadStarted,
			isAllComplete,
			isAllPaused
		} = this.uppy.getObjectOfFilesPerState();

		if (isAllComplete) {
			this.opts.onPendingChanges(false);
		}
		const hasInvalidFiles = Object.values(pluginState.invalidFiles).some((value) => value);
		const acquirers = this.#getAcquirers(pluginState.targets);
		const progressindicators = this.#getProgressIndicators(pluginState.targets);
		const editors = this.#getEditors(pluginState.targets);

		let theme;
		if (this.opts.theme === 'auto') {
			theme = capabilities.darkMode ? 'dark' : 'light';
		} else {
			theme = this.opts.theme;
		}

		if (['files', 'folders', 'both'].indexOf(this.opts.fileManagerSelectionType) < 0) {
			this.opts.fileManagerSelectionType = 'files';
			console.warn(
				`Unsupported option for "fileManagerSelectionType". Using default of "${this.opts.fileManagerSelectionType}".`
			);
		}

		return DashboardUI({
			state,
			isHidden: pluginState.isHidden,
			files,
			newFiles,
			uploadStartedFiles,
			completeFiles,
			erroredFiles,
			inProgressFiles,
			inProgressNotPausedFiles,
			processingFiles,
			isUploadStarted,
			isAllComplete,
			isAllPaused,
			totalFileCount: Object.keys(files).length,
			totalProgress: state.totalProgress,
			allowNewUpload,
			acquirers,
			theme,
			disabled: this.opts.disabled,
			disableLocalFiles: this.opts.disableLocalFiles,
			direction: this.opts.direction,
			activePickerPanel: pluginState.activePickerPanel,
			showFileEditor: pluginState.showFileEditor,
			saveFileEditor: this.saveFileEditor,
			closeFileEditor: this.closeFileEditor,
			disableInteractiveElements: this.disableInteractiveElements,
			animateOpenClose: this.opts.animateOpenClose,
			isClosing: pluginState.isClosing,
			progressindicators,
			editors,
			autoProceed: this.uppy.opts.autoProceed,
			id: this.id,
			closeModal: this.requestCloseModal,
			handleClickOutside: this.handleClickOutside,
			handleInputChange: this.handleInputChange,
			handlePaste: this.handlePaste,
			inline: this.opts.inline,
			showPanel: this.showPanel,
			hideAllPanels: this.hideAllPanels,
			i18n: this.i18n,
			i18nArray: this.i18nArray,
			uppy: this.uppy,
			note: this.opts.note,
			recoveredState: state.recoveredState,
			metaFields: pluginState.metaFields,
			resumableUploads: capabilities.resumableUploads || false,
			individualCancellation: capabilities.individualCancellation,
			isMobileDevice: capabilities.isMobileDevice,
			// region header
			onMinimized: this.opts.onMinimized,
			onClose: this.opts.onClose,
			title: this.opts.title,
			// endregion
			// region Site policy props - craftercms/uppy custom code
			cancelPending: this.cancelPending,
			clearCompleted: this.clearCompleted,
			validateAndRetry: this.validateAndRetry,
			confirmOverwrite: this.confirmOverwrite,
			rejectAll: this.rejectAll,
			confirmAll: this.confirmAll,
			invalidFiles: pluginState.invalidFiles ?? {},
			hasInvalidFiles,
			// endregion
			fileCardFor: pluginState.fileCardFor,
			toggleFileCard: this.toggleFileCard,
			toggleAddFilesPanel: this.toggleAddFilesPanel,
			showAddFilesPanel: pluginState.showAddFilesPanel,
			saveFileCard: this.saveFileCard,
			openFileEditor: this.openFileEditor,
			canEditFile: this.canEditFile,
			width: this.opts.width,
			height: this.opts.height,
			showLinkToFileUploadResult: this.opts.showLinkToFileUploadResult,
			fileManagerSelectionType: this.opts.fileManagerSelectionType,
			proudlyDisplayPoweredByUppy: this.opts.proudlyDisplayPoweredByUppy,
			showRemoveButtonAfterComplete: this.opts.showRemoveButtonAfterComplete,
			containerWidth: pluginState.containerWidth,
			containerHeight: pluginState.containerHeight,
			areInsidesReadyToBeVisible: pluginState.areInsidesReadyToBeVisible,
			parentElement: this.el,
			allowedFileTypes: this.uppy.opts.restrictions.allowedFileTypes,
			maxNumberOfFiles: this.uppy.opts.restrictions.maxNumberOfFiles,
			requiredMetaFields: this.uppy.opts.restrictions.requiredMetaFields,
			showSelectedFiles: this.opts.showSelectedFiles,
			showNativePhotoCameraButton: this.opts.showNativePhotoCameraButton,
			showNativeVideoCameraButton: this.opts.showNativeVideoCameraButton,
			nativeCameraFacingMode: this.opts.nativeCameraFacingMode,
			singleFileFullScreen: this.opts.singleFileFullScreen,
			handleRequestThumbnail: this.handleRequestThumbnail,
			handleCancelThumbnail: this.handleCancelThumbnail,
			// drag props
			isDraggingOver: pluginState.isDraggingOver,
			handleDragOver: this.handleDragOver,
			handleDragLeave: this.handleDragLeave,
			handleDrop: this.handleDrop,
			externalMessages: this.opts.externalMessages,
			// informer props
			disableInformer: this.opts.disableInformer,
			// status-bar props
			disableStatusBar: this.opts.disableStatusBar,
			hideProgressDetails: this.opts.hideProgressDetails,
			hideUploadButton: this.opts.hideUploadButton,
			hideRetryButton: this.opts.hideRetryButton,
			hidePauseResumeButton: this.opts.hidePauseResumeButton,
			hideCancelButton: this.opts.hideCancelButton,
			hideProgressAfterFinish: this.opts.hideProgressAfterFinish,
			doneButtonHandler: this.opts.doneButtonHandler,
			validateFilesPolicy: this.validateFilesPolicy
		});
	};

	#addSpecifiedPluginsFromOptions = () => {
		const { plugins } = this.opts;

		plugins.forEach((pluginID) => {
			const plugin = this.uppy.getPlugin(pluginID);
			if (plugin) {
				plugin.mount(this, plugin);
			} else {
				this.uppy.log(
					`[Uppy] Dashboard could not find plugin '${pluginID}', make sure to uppy.use() the plugins you are specifying`,
					'warning'
				);
			}
		});
	};

	#autoDiscoverPlugins = () => {
		this.uppy.iteratePlugins(this.#addSupportedPluginIfNoTarget);
	};

	#addSupportedPluginIfNoTarget = (plugin) => {
		// Only these types belong on the Dashboard,
		// we wouldn’t want to try and mount Compressor or Tus, for example.
		const typesAllowed = ['acquirer', 'editor'];
		if (plugin && !plugin.opts?.target && typesAllowed.includes(plugin.type)) {
			const pluginAlreadyAdded = this.getPluginState().targets.some(
				(installedPlugin) => plugin.id === installedPlugin.id
			);
			if (!pluginAlreadyAdded) {
				plugin.mount(this, plugin);
			}
		}
	};

	#getThumbnailGeneratorOpts() {
		const { thumbnailWidth, thumbnailHeight, thumbnailType, waitForThumbnailsBeforeUpload } = this.opts;
		return {
			thumbnailWidth,
			thumbnailHeight,
			thumbnailType,
			waitForThumbnailsBeforeUpload,
			// If we don't block on thumbnails, we can lazily generate them
			lazy: !waitForThumbnailsBeforeUpload
		};
	}

	#getThumbnailGeneratorId() {
		return `${this.id}:ThumbnailGenerator`;
	}

	install = () => {
		// Set default state for Dashboard
		this.setPluginState({
			isHidden: true,
			fileCardFor: null,
			activeOverlayType: null,
			showAddFilesPanel: false,
			activePickerPanel: undefined,
			showFileEditor: false,
			metaFields: this.opts.metaFields,
			targets: [],
			// We'll make them visible once .containerWidth is determined
			areInsidesReadyToBeVisible: false,
			isDraggingOver: false,
			// Site Policy Props - craftercms/uppy custom code
			invalidFiles: {}
		});

		const { inline, closeAfterFinish } = this.opts;
		if (inline && closeAfterFinish) {
			throw new Error(
				'[Dashboard] `closeAfterFinish: true` cannot be used on an inline Dashboard, because an inline Dashboard cannot be closed at all. Either set `inline: false`, or disable the `closeAfterFinish` option.'
			);
		}

		const { allowMultipleUploads, allowMultipleUploadBatches } = this.uppy.opts;
		if ((allowMultipleUploads || allowMultipleUploadBatches) && closeAfterFinish) {
			this.uppy.log(
				'[Dashboard] When using `closeAfterFinish`, we recommended setting the `allowMultipleUploadBatches` option to `false` in the Uppy constructor. See https://uppy.io/docs/uppy/#allowMultipleUploads-true',
				'warning'
			);
		}

		const { target } = this.opts;

		if (target) {
			this.mount(target, this);
		}

		if (!this.opts.disableThumbnailGenerator) {
			this.uppy.use(ThumbnailGenerator, {
				id: this.#getThumbnailGeneratorId(),
				...this.#getThumbnailGeneratorOpts()
			});
		}

		// Dark Mode / theme
		this.darkModeMediaQuery =
			typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

		const isDarkModeOnFromTheStart = this.darkModeMediaQuery ? this.darkModeMediaQuery.matches : false;
		this.uppy.log(`[Dashboard] Dark mode is ${isDarkModeOnFromTheStart ? 'on' : 'off'}`);
		this.setDarkModeCapability(isDarkModeOnFromTheStart);

		if (this.opts.theme === 'auto') {
			this.darkModeMediaQuery?.addListener(this.handleSystemDarkModeChange);
		}

		this.#addSpecifiedPluginsFromOptions();
		this.#autoDiscoverPlugins();
		this.initEvents();
	};
}
