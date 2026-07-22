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

import { defineMessages, MessageDescriptor } from 'react-intl';
import { getCurrentIntl } from '../utils/i18n';

export function translateElements(
	elements: Element[],
	messages: { [key: string]: MessageDescriptor },
	formats: any = {}
) {
	messages = Object.entries(messages).reduce((table: any, [key, descriptor]) => {
		table[descriptor.id] = descriptor;
		return table;
	}, {});
	elements.forEach((elem) => {
		const key = elem.getAttribute('data-i18n');
		if (key) {
			const message = getCurrentIntl().formatMessage(messages[key], formats);
			elem.innerHTML = Array.isArray(message) ? message.join('') : message;
		}
	});
}

export const passwordRequirementMessages = defineMessages({
	hasNumbers: {
		id: 'passwordRequirement.hasNumbers',
		defaultMessage: 'Must contain at least one number'
	},
	hasLowercase: {
		id: 'passwordRequirement.hasLowercase',
		defaultMessage: 'Must contain at least one lowercase letter'
	},
	hasUppercase: {
		id: 'passwordRequirement.hasUppercase',
		defaultMessage: 'Must contain at least one uppercase letter'
	},
	hasSpecialChars: {
		id: 'passwordRequirement.hasSpecialChars',
		defaultMessage: 'Must contain at least one special character {chars}'
	},
	noSpaces: {
		id: 'passwordRequirement.noSpaces',
		defaultMessage: 'Must not contain whitespaces'
	},
	minLength: {
		id: 'passwordRequirement.minLength',
		defaultMessage: 'Length must be at least {min} characters'
	},
	maxLength: {
		id: 'passwordRequirement.maxLength',
		defaultMessage: 'Length must not exceed {max} characters'
	},
	minMaxLength: {
		id: 'passwordRequirement.minMaxLength',
		defaultMessage: 'Length must be between {minLength} and {maxLength} characters'
	},
	passwordValidation: {
		id: 'passwordRequirement.passwordValidation',
		defaultMessage: 'Password Validation'
	},
	validPassword: {
		id: 'passwordRequirement.validPassword',
		defaultMessage: 'Requirements met'
	},
	invalidPassword: {
		id: 'passwordRequirement.invalidPassword',
		defaultMessage: 'Requirements are not met'
	},
	notBlank: {
		id: 'passwordRequirement.noBlank',
		defaultMessage: 'Must not be blank'
	},
	validationPassing: {
		id: 'passwordRequirement.validationPassing',
		defaultMessage: 'Validation passing'
	},
	fulfillAllReqErrorMessage: {
		id: 'passwordRequirement.fulfillAllReqErrorMessage',
		defaultMessage: 'Please fulfill all password requirements.'
	},
	unnamedGroup: {
		id: 'passwordRequirement.unnamedGroup',
		defaultMessage: 'Condition not described'
	},
	passwordConfirmationMismatch: {
		id: 'passwordRequirement.passwordConfirmationMismatch',
		defaultMessage: "Passwords don't match"
	}
});

export const numericInputControlMessages = defineMessages({
	minimun: {
		id: 'numericInputControl.childContent',
		defaultMessage: 'Minimum'
	},
	maximun: {
		id: 'numericInputControl.maximun',
		defaultMessage: 'Maximum'
	},
	noDecimalsErrMessage: {
		id: 'numericInputControl.noDecimalsErrMessage',
		defaultMessage: "Decimals aren't allowed on this input."
	}
});

export const sharedContentDSMessages = defineMessages({
	sharedContent: {
		id: 'sharedContentDS.sharedContent',
		defaultMessage: 'Shared Content'
	}
});

export const embeddedContentDSMessages = defineMessages({
	embeddedContent: {
		id: 'embeddedContentDS.embeddedContent',
		defaultMessage: 'Embedded Content'
	}
});

export const contentTypesMessages = defineMessages({
	notice: {
		id: 'contentType.notice',
		defaultMessage: 'Notice'
	},
	contenTypeWarningMessage: {
		id: 'contentType.contentTypeWarningMessage',
		defaultMessage:
			'Please note Child Content datasource is being phased out of CrafterCMS. For components that need to be shared across pages or components, please use Shared Content instead. For components that belong exclusively to this content object, please use Embedded Content.'
	},
	useSharedContent: {
		id: 'contentType.useSharedContent',
		defaultMessage: 'Use Shared Content'
	},
	useEmbeddedContent: {
		id: 'contentType.useEmbeddedContent',
		defaultMessage: 'Use Embedded Content'
	},
	useChildContent: {
		id: 'contentType.useChildContent',
		defaultMessage: 'Use Deprecated Control Anyway'
	},
	saveFailed: {
		id: 'contentType.saveFailed',
		defaultMessage: 'Save Failed'
	},
	fileNameErrorMessage: {
		id: 'contentType.fileNameErrorMessage',
		defaultMessage:
			'Content types require a file name. Please add either a "File Name" or "Auto Filename" control to this content type definition.'
	},
	internalNameErrorMessage: {
		id: 'contentType.internalNameErrorMessage',
		defaultMessage: 'This content type requires an Internal Name.'
	},
	flagTitleError: {
		id: 'contentType.flatTitleError',
		defaultMessage: 'Please fill every title for fields and datasources.'
	},
	idError: {
		id: 'contentType.idError',
		defaultMessage: 'Please fill variable name for: '
	},
	noTemplateAssoc: {
		id: 'contentType.noTemplateAssoc',
		defaultMessage:
			'There is no template associated with this content type. Click Save to proceed with save operation or Continue to update the content type (under Basic Content Type Properties) with a template.'
	},
	continueEditing: {
		id: 'contentType.continueEditing',
		defaultMessage: 'Continue Editing'
	},
	width: {
		id: 'contentType.width',
		defaultMessage: 'Width'
	},
	height: {
		id: 'contentType.height',
		defaultMessage: 'Height'
	},
	autoGrow: {
		id: 'contentType.autoGrow',
		defaultMessage: 'Auto Grow'
	},
	enableSpellCheck: {
		id: 'contentType.enableSpellCheck',
		defaultMessage: 'Enable Spell Check'
	},
	forceRootBlockP: {
		id: 'contentType.forceRootBlockP',
		defaultMessage: 'Force Root Block p Tag'
	},
	forcePNewLines: {
		id: 'contentType.forcePNewLines',
		defaultMessage: 'Force p tags New Lines'
	},
	forceBRNewLines: {
		id: 'contentType.forceBRNewLines',
		defaultMessage: 'Force br New Lines'
	},
	supportedChannels: {
		id: 'contentType.supportedChannels',
		defaultMessage: 'Supported Channels'
	},
	RTEConfiguration: {
		id: 'contentType.RTEConfiguration',
		defaultMessage: 'RTE Configuration'
	},
	imageManager: {
		id: 'contentType.imageManager',
		defaultMessage: 'Image Manager'
	},
	videoManager: {
		id: 'contentType.videoManager',
		defaultMessage: 'Video Manager'
	},
	fileManager: {
		id: 'contentType.fileManager',
		defaultMessage: 'File Manager'
	},
	siteConfigLandingMessage: {
		id: 'siteConfig.landingMessage',
		defaultMessage: 'Please choose a tool from the left.'
	},
	insertExpressionMessage: {
		id: 'siteConfig.insertExpressionMessage',
		defaultMessage: 'Insert Expression'
	},
	switchToMessage: {
		id: 'siteConfig.switchToMessage',
		defaultMessage: 'Switch to {type}'
	},
	invalidNumber: {
		id: 'siteConfig.invalidNumber',
		defaultMessage: '"{value}" is not a valid number.'
	},
	postfixes: {
		id: 'siteConfig.postfixes',
		defaultMessage: 'Postfixes'
	},
	controlNotAvailable: {
		id: 'siteConfig.controlNotAvailable',
		defaultMessage: 'Control not available'
	},
	loadModuleError: {
		id: 'siteConfig.loadModuleError',
		defaultMessage: 'Unable to load "{tool}". Check project tools configuration.'
	},
	toolNotFound: {
		id: 'siteConfig.toolNotFound',
		defaultMessage: '"{tool}" tool not found.'
	},
	dependsOn: {
		defaultMessage: 'This property references "{dependency}"'
	},
	minValueError: {
		id: 'contentType.minSizeError',
		defaultMessage: "Minimum value can't be higher than maximum value"
	},
	maxValueError: {
		id: 'contentType.maxSizeError',
		defaultMessage: "Maximum value can't be lower than minimum value"
	},
	missingTemplateTitle: {
		id: 'contentType.missingTemplateTitle',
		defaultMessage: 'Missing Template'
	},
	missingTemplateBody: {
		id: 'contentType.missingTemplateBody',
		defaultMessage:
			'Confirm a template is not required for this content type. Failing to assign a template would cause rendering issues on templated apps.'
	},
	templateNotRequiredSave: {
		id: 'contentType.templateNotRequiredSave',
		defaultMessage: 'Template not required, save'
	},
	templateNotRequiredSaveAndClose: {
		id: 'contentType.templateNotRequiredSaveAndClose',
		defaultMessage: 'Template not required, save & close'
	},
	templateNotRequiredSaveAndMinimize: {
		id: 'contentType.templateNotRequiredSaveAndMinimize',
		defaultMessage: 'Template not required, save & minimize'
	},
	createATemplate: {
		id: 'contentType.createATemplate',
		defaultMessage: 'Create a template'
	},
	chooseExistingTemplate: {
		id: 'contentType.chooseExistingTemplate',
		defaultMessage: 'Choose existing template'
	},
	stayEditing: {
		id: 'contentType.stayEditing',
		defaultMessage: 'Stay & continue editing'
	},
	audioManager: {
		defaultMessage: 'Audio Manager'
	},
	invalidMacros: {
		defaultMessage: 'The following invalid macros were removed: {macros}'
	}
});

export const words = defineMessages({
	notification: {
		id: 'words.notification',
		defaultMessage: 'Notification'
	},
	confirm: {
		id: 'words.confirm',
		defaultMessage: 'Confirm'
	},
	cancel: {
		id: 'words.cancel',
		defaultMessage: 'Cancel'
	},
	clear: {
		id: 'words.clear',
		defaultMessage: 'Clear'
	},
	update: {
		id: 'words.update',
		defaultMessage: 'Update'
	},
	save: {
		id: 'words.save',
		defaultMessage: 'Save'
	},
	reset: {
		id: 'words.reset',
		defaultMessage: 'Reset'
	},
	close: {
		id: 'words.close',
		defaultMessage: 'Close'
	},
	yes: {
		id: 'words.yes',
		defaultMessage: 'Yes'
	},
	no: {
		id: 'words.no',
		defaultMessage: 'No'
	},
	browse: {
		id: 'words.browse',
		defaultMessage: 'Browse'
	},
	upload: {
		id: 'words.upload',
		defaultMessage: 'Upload'
	},
	reason: {
		id: 'words.reason',
		defaultMessage: 'Reason'
	},
	select: {
		id: 'words.select',
		defaultMessage: 'Select'
	},
	view: {
		id: 'words.view',
		defaultMessage: 'View'
	}
});

export const simpleTaxonomyDSMessages = defineMessages({
	label: {
		id: 'simpleTaxonomyDS.label',
		defaultMessage: 'Taxonomy Selector'
	},
	unableLoad: {
		id: 'simpleTaxonomyDS.unableLoad',
		defaultMessage: 'The system was unable to load {file}.'
	},
	required: {
		id: 'simpleTaxonomyDS.required',
		defaultMessage: 'Required'
	},
	componentPath: {
		id: 'simpleTaxonomyDS.componentPath',
		defaultMessage: 'Component Path'
	},
	dataType: {
		id: 'simpleTaxonomyDS.dataType',
		defaultMessage: 'Data Type'
	},
	string: {
		id: 'simpleTaxonomyDS.string',
		defaultMessage: 'String'
	},
	integer: {
		id: 'simpleTaxonomyDS.integer',
		defaultMessage: 'Integer'
	},
	float: {
		id: 'simpleTaxonomyDS.float',
		defaultMessage: 'Float'
	},
	date: {
		id: 'simpleTaxonomyDS.date',
		defaultMessage: 'Date'
	},
	html: {
		id: 'simpleTaxonomyDS.html',
		defaultMessage: 'Data Type'
	},
	simpleTaxonomy: {
		id: 'simpleTaxonomyDS.simpleTaxonomy',
		defaultMessage: 'Simple Taxonomy'
	}
});

export const browseSearchMessages = defineMessages({
	lookUpParentError: {
		id: 'browseSearchMessages.lookUpChildError',
		defaultMessage: 'Unable to lookup child form callback for search: {searchId}'
	},
	lookUpChildError: {
		id: 'browseSearchMessages.lookUpParentError',
		defaultMessage: 'Unable to lookup parent context for search: {searchId}'
	}
});

export const formEngineMessages = defineMessages({
	inProgressConfirmation: {
		id: 'formEngine.inProgressConfirmation',
		defaultMessage: 'Another form is currently open & minimized. Please close the current form before opening another'
	},
	saveDraftCompleted: {
		id: 'formEngine.saveDraftCompleted',
		defaultMessage: 'Draft Save Completed'
	},
	save: {
		id: 'formEngine.save',
		defaultMessage: 'Save as Draft'
	},
	saveAndClose: {
		id: 'formEngine.saveAndClose',
		defaultMessage: 'Save & Close'
	},
	saveAndPreview: {
		id: 'formEngine.saveAndPreview',
		defaultMessage: 'Save & Preview'
	},
	saveAndMinimize: {
		id: 'formEngine.saveAndMinimize',
		defaultMessage: 'Save & Minimize'
	},
	saveDraft: {
		id: 'formEngine.saveDraft',
		defaultMessage: 'Save Draft'
	},
	createPolicy: {
		id: 'formEngine.createPolicy',
		defaultMessage:
			'The {originalPath} path goes against project policies. Suggested modified path is: "{path}". Would you like to use the suggested path?'
	},
	policyError: {
		id: 'formEngine.policyError',
		defaultMessage: 'The {path} path goes against project policies.'
	},
	formNotReadyForSaving: {
		id: 'formEngine.formNotReadyForSaving',
		defaultMessage: 'Form is not ready for saving. Please try again momentarily or use the cancel button.'
	},
	useMVS: {
		id: 'formEngine.useMVS',
		defaultMessage: 'Use _mvs postfix (backward compat)'
	},
	edit: {
		id: 'words.edit',
		defaultMessage: 'Edit'
	},
	embeddedComponent: {
		id: 'common.embeddedComponent',
		defaultMessage: 'Embedded component'
	},
	nodeSelectorItemNotFound: {
		defaultMessage: 'Item "{internalName}" doesn\'t exist'
	},
	removeItemFromNodeSelector: {
		defaultMessage: 'Remove from {controlLabel}'
	},
	keepItemInNodeSelector: {
		defaultMessage: 'Ignore'
	},
	maxItemsReached: {
		defaultMessage:
			'A max of {maxSize} {maxSize, plural, one {item is} other {items are}} allowed. Please remove items to fit the limit before trying to add more.'
	},
	inWorkflowWarning: {
		defaultMessage: 'The item is part of one or more publishing packages. Editing it will cancel the packages.'
	}
});

export const dragAndDropMessages = defineMessages({
	componentNotWelcomeWithinDropZone: {
		id: 'dragAndDropMessages.componentNotWelcomeWithinDropZone',
		defaultMessage: 'The drop zone does not support this type of component. Check your content model.'
	},
	embeddedComponentsDndNotSupported: {
		id: 'dragAndDropMessages.embeddedComponentsDndNotSupported',
		defaultMessage: "Drag and drop on embedded components it's not supported yet. Please use the forms to edit content."
	},
	embeddedComponentsDragWithinParentOnly: {
		id: 'dragAndDropMessages.embeddedComponentsDragWithinParentOnly',
		defaultMessage:
			'On this release, embedded components may only be dragged within their current parent. Please use the forms to edit content.'
	},
	moveOutEmbeddedComponentsNotSupported: {
		id: 'dragAndDropMessages.moveOutEmbeddedComponentsNotSupported',
		defaultMessage:
			'Moving components out of an embedded drop zone component is not supported yet. Please use the forms to edit content.'
	},
	embeddedComponentsDeleteChildNotSupported: {
		id: 'dragAndDropMessages.embeddedComponentsDeleteChildNotSupported',
		defaultMessage:
			'Deleting components from an embedded drop zone component is not supported yet. Please use the forms to edit content.'
	},
	contentTypeNotFound: {
		id: 'dragAndDropMessages.contentTypeNotFound',
		defaultMessage:
			'The content type id was not found in your template. Drag and drop will be impaired. More info at https://craftercms.com/docs/current/by-role/developer/upgrade/upgrading-in-context-editing.html.'
	},
	pathNotFound: {
		id: 'dragAndDropMessages.pathNotFound',
		defaultMessage:
			'Path is missing. Drag and drop will be impaired. More info at https://craftercms.com/docs/current/by-role/developer/upgrade/upgrading-in-context-editing.html.'
	},
	objectIdNotFound: {
		id: 'dragAndDropMessages.objectIdNotFound',
		defaultMessage:
			'Object id is missing. Drag and drop will be impaired. More info at https://craftercms.com/docs/current/by-role/developer/upgrade/upgrading-in-context-editing.html.'
	}
});

export const internalNameControlMessages = defineMessages({
	label: {
		id: 'internalNameControl.label',
		defaultMessage: 'Internal Name'
	},
	displaySize: {
		id: 'internalNameControl.displaySize',
		defaultMessage: 'Display Size'
	},
	maxLength: {
		id: 'internalNameControl.maxLength',
		defaultMessage: 'Max Length'
	}
});

export const checkboxGroupControlMessages = defineMessages({
	datasource: {
		id: 'checkboxGroupControl.datasource',
		defaultMessage: 'Data Source'
	},
	showSelectAll: {
		id: 'checkboxGroupControl.showSelectAll',
		defaultMessage: 'Show "Select All"'
	},
	listDirection: {
		id: 'checkboxGroupControl.listDirection',
		defaultMessage: 'List Direction'
	},
	horizontal: {
		id: 'checkboxGroupControl.horizontal',
		defaultMessage: 'Horizonal'
	},
	vertical: {
		id: 'checkboxGroupControl.vertical',
		defaultMessage: 'Vertical'
	},
	readonly: {
		id: 'checkboxGroupControl.readonly',
		defaultMessage: 'Read Only'
	}
});

export const transcodedVideoPickerControlMessages = defineMessages({
	label: {
		id: 'transcodedVideoPickerControl.label',
		defaultMessage: 'Transcoded Video'
	}
});

export const globalMenuMessages = defineMessages({
	'home.globalMenu.sites': {
		id: 'words.projects',
		defaultMessage: 'Projects'
	},
	'home.globalMenu.users': {
		id: 'words.users',
		defaultMessage: 'Users'
	},
	'home.globalMenu.groups': {
		id: 'words.groups',
		defaultMessage: 'Groups'
	},
	'home.globalMenu.audit': {
		id: 'words.audit',
		defaultMessage: 'Audit'
	},
	'home.globalMenu.logging-levels': {
		id: 'globalMenu.loggingLevelsEntryLabel',
		defaultMessage: 'Logging Levels'
	},
	'home.globalMenu.log-console': {
		id: 'globalMenu.logConsoleEntryLabel',
		defaultMessage: 'Log Console'
	},
	'home.globalMenu.globalConfig': {
		id: 'globalMenu.globalConfigEntryLabel',
		defaultMessage: 'Global Config'
	},
	'home.globalMenu.encryptionTool': {
		id: 'globalMenu.encryptionTool',
		defaultMessage: 'Encryption Tool'
	},
	'home.globalMenu.tokenManagement': {
		id: 'globalMenu.tokenManagement',
		defaultMessage: 'Token Management'
	},
	'home.about-us': {
		id: 'words.about',
		defaultMessage: 'About'
	},
	'home.settings': {
		id: 'globalMenu.settings',
		defaultMessage: 'Account'
	},
	login: {
		id: 'words.login',
		defaultMessage: 'Login'
	},
	'login.recover': {
		id: 'globalMenu.recover',
		defaultMessage: 'Password Recovery'
	}
});

globalMenuMessages['home.globalMenu.about-us'] = globalMenuMessages['home.about-us'];
globalMenuMessages['home.globalMenu.settings'] = globalMenuMessages['home.settings'];

export const fileNameControlMessages = defineMessages({
	urlChangeWaring: {
		id: 'fileNameControl.urlChangeWarning',
		defaultMessage: 'Changing this value may result in broken references and links.'
	}
});

export const rteControlMessages = defineMessages({
	escapeScripts: {
		id: 'rteControlMessages.escapeScripts',
		defaultMessage: 'Escape Scripts'
	},
	requiredField: {
		id: 'rteControlMessages.requiredField',
		defaultMessage: 'Field is Required'
	},
	incompatibleDatasource: {
		id: 'rteControlMessages.incompatibleDatasource',
		defaultMessage:
			'The data source configured for browse is not compatible with the Rich Text Editor. Please contact your administrator.'
	},
	noDatasourcesConfigured: {
		id: 'rteControlMessages.noDatasourcesConfigured',
		defaultMessage: 'No sources configured for this editor.'
	},
	chooseSource: {
		id: 'rteControlMessages.chooseSource',
		defaultMessage: 'Choose a Source'
	},
	dropImageUploaded: {
		id: 'rteControlMessages.dropImageUploaded',
		defaultMessage: '{title} was successfully uploaded.'
	}
});

export const embeddedLegacyFormMessages = defineMessages({
	contentFormFailedToLoadErrorMessage: {
		id: 'embeddedLegacyFormMessages.openContentFormFailedError',
		defaultMessage:
			'An error occurred opening the content form. Please try again momentarily. Contact the administrator if the error persists.'
	}
});

export const componentsMessages = defineMessages({
	components: {
		id: 'componentsMessages.components',
		defaultMessage: 'Components'
	},
	createNewEmbedded: {
		id: 'componentsMessages.createNewEmbedded',
		defaultMessage: 'Create new embedded'
	},
	createNewShared: {
		id: 'componentsMessages.createNewShared',
		defaultMessage: 'Create new shared'
	},
	allowShared: {
		defaultMessage: 'Allow New Shared'
	},
	allowEmbedded: {
		id: 'componentsMessages.allowEmbedded',
		defaultMessage: 'Allow Embedded'
	},
	enableBrowse: {
		defaultMessage: 'Enable Browsing Shared'
	},
	enableSearch: {
		defaultMessage: 'Allow Searching Shared'
	},
	baseRepositoryPath: {
		defaultMessage: 'Path for New Items'
	},
	baseBrowsePath: {
		id: 'componentsMessages.baseBrowsePath',
		defaultMessage: 'Base Browse Path'
	},
	contentTypes: {
		id: 'componentsMessages.contentTypes',
		defaultMessage: 'Content Types'
	},
	tags: {
		id: 'componentsMessages.tags',
		defaultMessage: 'Tags'
	},
	browseExisting: {
		id: 'componentsMessages.browseExisting',
		defaultMessage: 'Browse existing'
	},
	searchExisting: {
		id: 'componentsMessages.searchExisting',
		defaultMessage: 'Search existing components'
	}
});

export const localeSelectorControlMessages = defineMessages({
	label: {
		id: 'localeSelectorControl.label',
		defaultMessage: 'Locale Selector'
	},
	requiredError: {
		id: 'localeSelectorControl.requiredError',
		defaultMessage: 'Field is Required'
	}
});

export const controlsCommonMessages = defineMessages({
	escapeContent: {
		id: 'controlsCommonMessages.escapeContent',
		defaultMessage: 'Escape Content'
	}
});

export const itemSuccessMessages = defineMessages({
	itemDeleted: {
		id: 'item.delete',
		defaultMessage:
			'{count, plural, one {The selected item is being deleted and will be removed soon} other {The selected items are being deleted and will be removed soon}}'
	},
	itemPublishedNow: {
		id: 'item.publishedNow',
		defaultMessage:
			'{count, plural, one {The selected item has been published to {environment}. It will be visible soon} other {The selected items have been published to {environment}. They will be visible soon}}'
	},
	itemRequestedToPublishNow: {
		id: 'item.requestedToPublishNow',
		defaultMessage:
			'{count, plural, one {The selected item has been requested to be published to {environment}} other {The selected items have been requested to be published to {environment}}}'
	},
	itemRequestedToSchedulePublish: {
		id: 'item.requestedToSchedulePublish',
		defaultMessage:
			'{count, plural, one {The selected item has been scheduled to go {environment}} other {The selected items have been scheduled to go {environment}}}'
	},
	itemSchedulePublished: {
		id: 'item.schedulePublished',
		defaultMessage:
			'{count, plural, one {The selected item has been scheduled to go {environment}} other {The selected items have been scheduled to go {environment}}}'
	},
	itemCreated: {
		id: 'item.created',
		defaultMessage: 'Item created successfully'
	},
	itemEdited: {
		id: 'item.edited',
		defaultMessage: 'Item updated successfully'
	},
	itemCopied: {
		id: 'item.copied',
		defaultMessage: '{count, plural, one {Item copied to clipboard} other {Items copied to clipboard}}'
	},
	itemPasted: {
		id: 'item.pasted',
		defaultMessage: 'Item pasted successfully'
	},
	itemUnlocked: {
		id: 'item.unlocked',
		defaultMessage: 'Item unlocked successfully'
	},
	itemDuplicated: {
		id: 'item.duplicated',
		defaultMessage: 'Item duplicated successfully'
	},
	itemCut: {
		id: 'item.cut',
		defaultMessage: 'Item cut successfully'
	},
	itemRejected: {
		id: 'item.rejected',
		defaultMessage: '{count, plural, one {Item rejected successfully} other {Items rejected successfully}}'
	},
	itemReverted: {
		id: 'item.reverted',
		defaultMessage: 'Item reverted successfully'
	},
	itemContentTypeChanged: {
		id: 'item.contentTypeChanged',
		defaultMessage: 'Item type changed successfully'
	},
	itemSavedAsDraft: {
		id: 'item.savedAsDraft',
		defaultMessage: 'Draft saved. Required fields left blank may cause errors when previewed or deployed.'
	},
	folderCreated: {
		id: 'folder.created',
		defaultMessage: 'Folder created successfully'
	}
});

export const audioDSMessages = defineMessages({
	uploadLabel: {
		defaultMessage: 'Audio Uploaded from Desktop'
	},
	browseLabel: {
		defaultMessage: 'Audio From Repository'
	},
	uploadError: {
		defaultMessage: 'An error occurred while uploading the audio file.'
	}
});
