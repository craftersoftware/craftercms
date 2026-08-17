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

import type { ContentTypeField, ContentTypeSection, PublishPackage } from '../../../models';
import LookupTable from '../../../models/LookupTable';
import ContentType from '../../../models/ContentType';
import validateFieldValue, { FieldValidityState } from './validators';
import { getPropertyValue } from './fieldPropertyUtils';
import { catchError, forkJoin, map, Observable, of, Subject, switchMap } from 'rxjs';
import {
	FormRequirementsResponse,
	FormsEngineAtoms,
	FormsEngineEditContextProps,
	FormsEngineItemMetaContextProps,
	FormsEngineSourceMap,
	ItemContext,
	StableFormContext,
	StableFormContextProps,
	StableGlobalContext,
	StableGlobalContextProps
} from './formsEngineContext';
import { fetchContentItem, fetchContentXML, fetchDescriptorXML, lock, unlock } from '../../../services/content';
import { AjaxError } from 'rxjs/ajax';
import { fetchAffectedPackages } from '../../../services/workflow';
import { Dispatch as ReduxDispatch } from 'redux';
import { IntlShape } from 'react-intl/src/types';
import { showSystemNotification, showUnlockItemSuccessNotification } from '../../../state/actions/system';
import { atom, Atom, PrimitiveAtom, useAtomValue, useStore as useJotaiStore } from 'jotai';
import React, { ReactNode, RefObject, useContext, useEffect, useRef } from 'react';
import { fromString, getInnerHtml } from '../../../utils/xml';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import alertDialogUrl from '../../../assets/warning.svg';
import PrimaryButton from '../../PrimaryButton';
import { FormattedMessage } from 'react-intl';
import { AlertDialogProps } from '../../AlertDialog';
import { Theme } from '@mui/material/styles';
import { AtomWithStorage, JotaiStore } from '../types';
import {
	ContentTypeNotFoundError,
	InvalidParamsError,
	ItemNotFoundError,
	NoSiteIdError,
	PropsChangedError,
	systemFieldsNotInType,
	UnknownError,
	XmlKeys
} from './formConsts';
import { v4 as uuid } from 'uuid';
import { atomWithStorage } from 'jotai/utils';
import { useDispatch } from 'react-redux';
import type { FormsEngineProps } from '../FormsEngine';
import usePreviousValue from '../../../hooks/usePreviousValue';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { areAllPairsEqual } from '../../../utils/array';
import { deserializeContentDoc } from './valueRetrievers';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import ApiResponse from '../../../models/ApiResponse';
import {
	getFormsEngineCloseAfterSave,
	getFormsEngineCollapseToCKey,
	getFormsEngineMinimizeAfterSave
} from '../../../utils/state';
import { createComponentId } from '../../../utils/system';
import { showErrorDialog } from '../../../state/actions/dialogs';
import { ensureSingleSlash } from '../../../utils/string';
import { isPagePath } from '../../../utils/path';
import { nou } from '../../../utils/object';
import type { DescriptorContentType } from '../../ContentTypeManagement/utils';
import controlDescriptors from '../../ContentTypeManagement/descriptors/controls';

/**
 * Returns the scroll container for the form's container.
 * TODO: After much tweaking and testing, managed to get the form container box itself to be the scrolling element. Asses removal.
 **/
export function getScrollContainer(container: HTMLElement): HTMLElement {
	return container;
}

/**
 * Creates a lookup table of section expanded state atoms, indexed by section name (e.g. `{ "Hero": atom(true), "SEO": atom(false) }`)
 */
export const buildSectionExpandedStateAtoms = (contentTypeSections: ContentTypeSection[]) => {
	return contentTypeSections.reduce(
		(sectionExpandedState, section) => {
			sectionExpandedState[section.id] = atom(section.expandByDefault);
			return sectionExpandedState;
		},
		{} as Record<string, PrimitiveAtom<boolean>>
	);
};

export const internalLockContentService: (siteId: string, path: string) => Observable<FormsEngineEditContextProps> = (
	siteId,
	path
) =>
	lock(siteId, path).pipe(
		map(() => ({ locked: true, lockError: null })),
		catchError((error: AjaxError) => {
			// switch (error.status) {
			//   case 404: {
			//     throw error;
			//   }
			//   case 409: {
			//     // content already locked...
			//   }
			// }
			return of({ locked: false, lockError: error.response?.response });
		}),
		switchMap((lockResult) =>
			fetchAffectedPackages(siteId, path).pipe(
				map((affectedPackages) => ({ ...lockResult, affectedPackages })),
				catchError((error) => of({ ...lockResult, affectedPackages: null, lockError: error.response?.response }))
			)
		)
	);

export const internalUnlockContentService: (siteId: string, path: string) => Observable<FormsEngineEditContextProps> = (
	siteId: string,
	path: string
) =>
	unlock(siteId, path).pipe(
		map(() => ({ locked: false, lockError: null })),
		catchError((error) => of({ locked: true, lockError: error.response?.response }))
	);

export function createSourceMap(descriptorXml: string): FormsEngineSourceMap {
	const descriptorDom = fromString(descriptorXml);
	const sourceMap: FormsEngineSourceMap = {};
	descriptorDom.querySelectorAll(':scope > [crafter-source]').forEach((element) => {
		if (element.innerHTML.trim() === '') {
			// Seen `folder-name` in the descriptor getting inherited in the case of Home.
			// Home's <folder-name /> tag is empty and the merger puts in the level descriptor folder-name — despite it being emtpy too.
			return;
		}
		sourceMap[element.tagName] = element.getAttribute('crafter-source');
	});
	return sourceMap;
}

export const createPathInProject = (fullPath: string) => {
	/* Example:
	 *   item.path = '/site/website/headless-cms-solutions/enterprise/index.xml'
	 *   pieces = item.path.split('/').slice(3)
	 *     ==> ['headless-cms-solutions', 'enterprise', 'index.xml']
	 *   pieces.slice(0, result.length - 2)
	 *     ==> ['headless-cms-solutions'] */
	const pieces = fullPath
		.split('/')
		// .slice(3) removes the first empty string created by the leading slash (''),
		// 'site', and whatever comes after (e.g. 'components' in /site/components,
		// or 'website' in /site/website).
		.slice(3);
	// .slice(0, length - 2) removes the folder name and file name.
	// In the case of no folder name, it will return an empty string.
	return `/${pieces.slice(0, pieces.length - 2).join('/')}/`.replace(/\/+/g, '/');
};

export const displayFormBeingSavedSnack = (dispatch: ReduxDispatch, formatMessage: IntlShape['formatMessage']) => {
	dispatch(
		showSystemNotification({ message: formatMessage({ defaultMessage: 'Content is being saved, please wait...' }) })
	);
};

/** Calculates the height for the main form wrapper */
export const getTargetHeight = (isDialog: boolean, isFullScreen: boolean, theme: Theme) =>
	isDialog ? `calc(100vh - ${isFullScreen ? 0 : theme.spacing(4)})` : '100%';

export type ValidatorsData = { siteId: string; contentTypesById: LookupTable<ContentType> };

/**
 * Creates the value and validity atoms for a give field.
 **/
export function createFieldAtoms(
	field: ContentTypeField,
	initialValue: unknown,
	formContextRef: RefObject<
		Pick<StableFormContextProps, 'fieldUpdates$' | 'changedFieldIds' | 'originalValues' | 'atoms' | 'itemMeta'>
	>,
	validatorsData?: ValidatorsData
): [PrimitiveAtom<unknown>, Atom<Promise<FieldValidityState>>] {
	let isInitialization = true;
	const valueAtom = atom(initialValue);
	const validationAtom = atom(async (get) => {
		// TODO: It would be best for this to be in a different place and be a sort of effect.
		const value = get(valueAtom);
		if (isInitialization) {
			isInitialization = false;
		} else {
			if (field.id === XmlKeys['fileName']) {
				const currentFileName = get(formContextRef.current.atoms.fileName);
				const originalPath = formContextRef.current.itemMeta.path;

				if (nou(originalPath)) {
					// If no originalPath exists => creating content
					if (currentFileName) {
						formContextRef.current.changedFieldIds.add(field.id);
					} else {
						formContextRef.current.changedFieldIds.delete(field.id);
					}
				} else {
					// If originalPath exists, validate if differs from original value
					const isPage = isPagePath(originalPath);
					const originalFileName = getFileNameValueFromPath(originalPath, isPage);
					if (currentFileName !== originalFileName) {
						formContextRef.current.changedFieldIds.add(field.id);
					} else {
						formContextRef.current.changedFieldIds.delete(field.id);
					}
				}
			} else if (value !== formContextRef.current.originalValues[field.id]) {
				formContextRef.current.changedFieldIds.add(field.id);
			} else {
				formContextRef.current.changedFieldIds.delete(field.id);
			}
			formContextRef.current.fieldUpdates$.next(field.id);
		}
		return validateFieldValue(field, value, {
			siteId: validatorsData?.siteId,
			contentTypesById: validatorsData?.contentTypesById,
			itemMeta: formContextRef.current.itemMeta as FormsEngineItemMetaContextProps,
			fileName: formContextRef.current.atoms.fileName ? get(formContextRef.current.atoms.fileName) : ''
		});
	});
	return [valueAtom, validationAtom];
}

/** Creates the readonly flag property atom based on the lock result atom */
export const createReadonlyAtom = (lockedResultAtom: Atom<FormsEngineEditContextProps>) =>
	atom((get) => !get(lockedResultAtom).locked);

/**
 * Creates a Jotai atom for the file name based on the given path.
 *
 * @param {string} path - The full path of the file.
 * @returns {PrimitiveAtom<string>} - A Jotai atom containing the file name extracted from the path.
 *
 */
export const createFileNameAtom = (path: string): PrimitiveAtom<string> => {
	const isPage = isPagePath(path);
	return atom(getFileNameValueFromPath(path, isPage));
};

/**
 * Retrieves the base path from a given file path.
 *
 * @param {string} path - The full file path to process.
 * @param {boolean} isPage - A flag indicating whether the path corresponds to a page.
 * @returns {string} - The base path extracted from the input path.
 *
 */
export const getBasePath = (path: string, isPage: boolean): string => {
	// If home page
	if (path === '/site/website/index.xml' && isPage) return '/site/website/';

	const pathParts = path.split('/');
	return isPage
		? pathParts.slice(0, pathParts.length - 2).join('/') + '/'
		: pathParts.slice(0, pathParts.length - 1).join('/') + '/';
};

/**
 * Extracts the file name from a given file path.
 *
 * @param {string} path - The full file path to process.
 * @param {boolean} isPage - A flag indicating whether the path corresponds to a page.
 * @returns {string} - The file name extracted from the path. Returns an empty string if the path corresponds to the home page.
 *
 */
export const getFileNameValueFromPath = (path: string, isPage: boolean): string => {
	// If home page, return empty string
	if (path === '/site/website/index.xml' && isPage) return '';

	const basePath = getBasePath(path, isPage);
	return path.replace(basePath, '').replace(isPage ? '/index.xml' : '.xml', '');
};

/**
 * Computes the full path for a file based on its name, type, and base path.
 *
 * @param {string} fileName - The name of the file (without extension or directory).
 * @param {boolean} isPage - A flag indicating whether the file represents a page.
 * @param {string} basePath - The base path of the file.
 * @returns {string} - The computed full path for the file.
 *
 */
export const computePathFromFileName = (fileName: string, isPage: boolean, basePath: string): string => {
	const fullFileName = isPage ? `${fileName}/index.xml` : `${fileName}.xml`;
	return ensureSingleSlash(`${basePath}/${fullFileName}`);
};

export function createFormStackData(mixin?: Partial<StableFormContextProps>): StableFormContextProps {
	const data: StableFormContextProps = {
		atoms: null,
		changedFieldIds: new Set<string>(),
		fieldUpdates$: new Subject<string>(),
		itemMeta: null,
		originalValues: null,
		props: null,
		state: null,
		...mixin
	};
	return data;
}

// TODO: This is useful for the whole system. Move.
export function showAlert({
	message,
	children,
	dispatch
}: {
	message?: string;
	children?: ReactNode;
	dispatch: ReduxDispatch;
}) {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('AlertDialog'),
			allowFullScreen: false,
			allowMinimize: false,
			props: {
				body: message,
				children,
				imageUrl: alertDialogUrl,
				sxs: { image: { pb: 1 } },
				buttons: (
					<PrimaryButton fullWidth autoFocus onClick={() => dispatch(popDialog({ id }))}>
						<FormattedMessage defaultMessage="Accept" />
					</PrimaryButton>
				)
			} as Partial<AlertDialogProps>
		})
	);
}

export function useShowAlert() {
	const dispatch = useDispatch();
	return (messageOrProps: string | Omit<Parameters<typeof showAlert>[0], 'dispatch'>) => {
		const props = typeof messageOrProps === 'string' ? { message: messageOrProps } : messageOrProps;
		showAlert({ ...props, dispatch });
	};
}

/** Retrieves the value of an atom from the supplied jotai store */
export const getFieldAtomValue = (atom: Atom<unknown>, store: JotaiStore) => store.get(atom);

/**
 * Retrieves the values from the form atoms and returns them in a lookup table.
 */
export const extractAtomValues: (store: JotaiStore, valueAtoms: LookupTable<Atom<unknown>>) => LookupTable<unknown> = (
	store,
	valueAtoms
) =>
	Object.entries(valueAtoms).reduce((values, [fieldId, valueAtom]) => {
		values[fieldId] = store.get(valueAtom);
		return values;
	}, {});

/**
 * Retrieves all the data requirements to show an update form
 * TODO: Create a backend API to fetch this data at once.
 */
export function fetchUpdateRequirements({
	siteId,
	path,
	modelId,
	readonly,
	contentTypesById,
	changeTypeId
}: {
	siteId: string;
	path: string;
	modelId: string;
	readonly: boolean;
	contentTypesById: LookupTable<ContentType>;
	changeTypeId?: string;
}): Observable<FormRequirementsResponse> {
	// Good to start with the lock so that posterior fetch of the item comes with the lock status. If we need
	// to fetch the content type, will need the item first to determine its content type id, but currently relying
	// on a separate load for all content types. Alternatively, we could fetch all types here too if we get a form
	// requirements service.
	return (
		readonly
			? of({ locked: false, lockError: null, affectedPackages: null } as FormsEngineEditContextProps)
			: internalLockContentService(siteId, path)
	).pipe(
		switchMap((lockResult) =>
			forkJoin([
				fetchContentItem(siteId, path),
				of(lockResult),
				// TODO: Check if these two are redundant
				fetchContentXML(siteId, path),
				fetchDescriptorXML(siteId, path, { flatten: false })
				// TODO: Assess removal:
				// fetchConfigurationXML(siteId, `/content-types${item.contentTypeId}/form-definition.xml`, 'studio'),
				// fetchContentType(siteId, item.contentTypeId),
				// of(null)
				// importPlugin({
				//   site: siteId,
				//   type: 'examples',
				//   name: 'forms-engine',
				//   file: 'index.js',
				//   id: 'org.craftercms'
				// }).catch(() => null)
			])
		),
		map(([item, lockResult, contentXml, descriptorXml]) => {
			let contentType = contentTypesById[changeTypeId ?? item.contentTypeId];
			if (!contentType) {
				throw ContentTypeNotFoundError;
			}
			let contentDom: XMLDocument | Element = fromString(contentXml);
			if (modelId) {
				contentDom = contentDom.querySelector(`[id="${modelId}"]`);
				contentType = contentTypesById[getInnerHtml(contentDom.querySelector(':scope > content-type'))];
			}
			const contentObject = deserializeContentDoc(contentDom);
			const sourceMap = createSourceMap(descriptorXml);
			const props: FormRequirementsResponse = {
				item,
				contentXml,
				contentObject,
				sourceMap,
				locked: lockResult.locked,
				lockError: lockResult.lockError,
				affectedPackages: lockResult.affectedPackages,
				// If opening as readonly, lock result is of no consequence. If opened for edit, will set to readonly
				// if there was an error locking the content (the item is not locked).
				// readonly: readonly || !lockResult.locked,
				contentType,
				pathInSite: createPathInProject(path)
			};
			return props;
		})
	);
}

/**
 * Creates a FormsEngineAtoms object with default values. Allows overriding defaults via `mixin` argument.
 **/
export function createFormsEngineAtoms(
	username: string,
	mixin: Partial<FormsEngineAtoms> & Pick<FormsEngineAtoms, 'readonly' | 'lockResult' | 'fileName'>
): FormsEngineAtoms {
	const atoms: FormsEngineAtoms = {
		isSubmitting: atom(false),
		hasPendingChanges: atom(false),
		valueByFieldId: {},
		validationByFieldId: {},
		versionComment: atom(''),
		expandedStateBySectionId: {},
		tableOfContentsDrawerOpen: atom(false),
		isLargeContainer: atom(false),
		useCollapsedToC: atom((get) => (get(atoms.isLargeContainer) ? get(atoms.collapseToC) : true)),
		collapseToC: atomWithStorage(getFormsEngineCollapseToCKey(username), false, undefined, {
			getOnInit: true
		}) as unknown as AtomWithStorage,
		closeAfterSave: atomWithStorage(getFormsEngineCloseAfterSave(username), true, undefined, {
			getOnInit: true
		}) as unknown as AtomWithStorage,
		minimizeAfterSave: atomWithStorage(getFormsEngineMinimizeAfterSave(username), false, undefined, {
			getOnInit: true
		}) as unknown as AtomWithStorage,
		...mixin
	};
	return atoms;
}

/**
 * Creates the value and validity atoms for a field and sets them on to the target object.
 **/
export function setFieldAtoms(
	stableFormContextRef: RefObject<StableFormContextProps>,
	contentType: ContentType,
	fieldLookup: LookupTable<ContentTypeField>,
	fieldId: string,
	atomsTarget: FormsEngineAtoms,
	value: unknown,
	validatorsData?: ValidatorsData,
	isAdditional?: boolean
): void {
	let field = fieldLookup[fieldId];
	if (!field) {
		// TODO: Discuss `folder-name`. When should it be here, when not? Could/should we remove?
		if (fieldId === 'folder-name') {
			field = {
				defaultValue: undefined,
				description: '',
				fields: undefined,
				helpText: '',
				properties: undefined,
				sortable: false,
				type: '',
				validations: undefined,
				values: undefined,
				id: 'folder-name',
				name: 'Folder Name'
			};
		} else if (isAdditional) {
			field = {
				defaultValue: undefined,
				description: '',
				fields: undefined,
				helpText: '',
				properties: undefined,
				sortable: false,
				type: '',
				validations: undefined,
				values: undefined,
				id: fieldId,
				name: fieldId
			};
		} else {
			!systemFieldsNotInType.includes(fieldId) &&
				console.warn(`Field ${fieldId} not found in content type "${contentType.name}" (${contentType.id})`);
			return;
		}
	}
	const [valueAtom, validityAtom] = createFieldAtoms(field, value, stableFormContextRef, validatorsData);
	atomsTarget.valueByFieldId[fieldId] = valueAtom;
	atomsTarget.validationByFieldId[fieldId] = validityAtom;
}

export type SystemPropsObject = Pick<
	Record<XmlKeys, string | boolean>,
	| XmlKeys.modelId
	| XmlKeys.internalName
	| XmlKeys.contentTypeId
	| XmlKeys.displayTemplate
	| XmlKeys.templateNotRequired
	| XmlKeys.mergeStrategy
	| XmlKeys.dateCreated
	| XmlKeys.dateCreatedDt
	| XmlKeys.dateModified
	| XmlKeys.dateModifiedDt
	| XmlKeys.savedAsDraft
	| XmlKeys.disabled
	| XmlKeys.placeInNav
	| XmlKeys.navLabel
>;

/**
 * Creates an object with all the base content item system props (objectId, content-type, etc.)
 * Assigns the supplied values if provided.
 **/
export function createObjectWithSystemProps(
	contentType: ContentType,
	mixin?: Partial<SystemPropsObject>
): SystemPropsObject {
	const dateIsoString = new Date().toISOString();
	const contentObject: SystemPropsObject = {
		[XmlKeys.modelId]: mixin?.[XmlKeys.modelId] ?? uuid(),
		[XmlKeys.internalName]: mixin?.[XmlKeys.internalName] ?? '',
		[XmlKeys.contentTypeId]: contentType.id,
		[XmlKeys.displayTemplate]: contentType.displayTemplate ?? '',
		[XmlKeys.templateNotRequired]: contentType.displayTemplate ? 'false' : 'true',
		[XmlKeys.mergeStrategy]: contentType.mergeStrategy ?? 'inherit-levels',
		[XmlKeys.dateCreated]: mixin?.[XmlKeys.dateCreated] ?? dateIsoString,
		[XmlKeys.dateCreatedDt]: mixin?.[XmlKeys.dateCreatedDt] ?? dateIsoString,
		[XmlKeys.dateModified]: mixin?.[XmlKeys.dateModified] ?? dateIsoString,
		[XmlKeys.dateModifiedDt]: mixin?.[XmlKeys.dateModifiedDt] ?? dateIsoString,
		[XmlKeys.savedAsDraft]: mixin?.[XmlKeys.savedAsDraft] ?? 'false',
		// TODO: These are part of the type
		[XmlKeys.disabled]: mixin?.[XmlKeys.disabled] ?? false,
		[XmlKeys.placeInNav]: mixin?.[XmlKeys.placeInNav] ?? false,
		[XmlKeys.navLabel]: mixin?.[XmlKeys.navLabel] ?? ''
	};
	return contentObject;
}

export function produceChangedFieldsMessage(changedFieldNames: string[]): string {
	if (changedFieldNames.length === 0) return '';
	return changedFieldNames.length > 1
		? `Updated ${changedFieldNames.slice(0, -1).join(', ')} and ${changedFieldNames[changedFieldNames.length - 1]}`
		: `Updated ${changedFieldNames[changedFieldNames.length - 1]}`;
}

/**
 * Inspects the form props, and that there is an active siteId, to ensure validity and ability to render a form correctly.
 **/
export function useValidateFormProps(props: Partial<FormsEngineProps>): void {
	const siteId = useActiveSiteId();
	const previousProps = usePreviousValue(props);
	const propsChangedRef = useRef(false);
	const { create, update, repeat, fieldsToRender, readonly } = props;
	if (!siteId) {
		throw NoSiteIdError;
	} else if (
		// Missing or bad combination of props
		[create, update, repeat].filter(Boolean).length !== 1 ||
		// Update prop but no path
		(update && !update.path?.trim()) ||
		// Create prop but no path or content type id
		(create && (!create.path?.trim() || !create.contentTypeId?.trim())) ||
		// Repeat prop but no field id
		(repeat && !repeat.fieldId?.trim())
	) {
		throw InvalidParamsError;
	} else if (
		propsChangedRef.current ||
		(previousProps &&
			// Note: Make sure to include all relevant props here
			!areAllPairsEqual([
				[create, previousProps.create],
				[fieldsToRender, previousProps.fieldsToRender],
				[readonly, previousProps.readonly],
				[repeat?.fieldId, previousProps.repeat?.fieldId],
				[repeat?.values, previousProps.repeat?.values],
				[update?.modelId, previousProps.update?.modelId],
				[update?.path, previousProps.update?.path],
				[update?.values, previousProps.update?.values]
			]))
	) {
		propsChangedRef.current = true;
		throw PropsChangedError;
	}
}

/**
 * Inspects the error symbol and returns a message to display to the user.
 **/
export function getMessageForErrorSymbol(errorSymbol: unknown): ReactNode {
	// TODO: Should errors allow parameters? e.g. show the path that wasn't found, or the type id?
	switch (errorSymbol) {
		case ItemNotFoundError:
			return <FormattedMessage defaultMessage="The item was not found" />;
		case ContentTypeNotFoundError:
			return <FormattedMessage defaultMessage="The content type was not found" />;
		case InvalidParamsError:
			return <FormattedMessage defaultMessage="The form was opened with an incorrect set of arguments" />;
		case NoSiteIdError:
			return <FormattedMessage defaultMessage="No CrafterCMS project was specified" />;
		case PropsChangedError:
			return <FormattedMessage defaultMessage="Dynamic updates of the FormsEngine props are not supported" />;
		case UnknownError:
		default:
			return <FormattedMessage defaultMessage="An error occurred preparing the form" />;
	}
}

export interface ShouldUnlockArguments {
	isRepeatMode: boolean;
	isCreateMode: boolean;
	readonly: boolean;
	isEmbedded: boolean;
	isStackedForm: boolean;
	isParentReadonly: boolean;
	siteId: string;
	isRenamed: boolean;
	saveAsDraft: boolean;
	invalidForm: boolean;
	itemSavedAsDraft: boolean;
}

/**
 * Determines if an item should be unlocked when its form is being unmounted.
 **/
export function shouldUnlockItem(props: ShouldUnlockArguments): boolean {
	const {
		isRepeatMode,
		isCreateMode,
		readonly,
		isEmbedded,
		isStackedForm,
		isParentReadonly,
		isRenamed,
		saveAsDraft,
		invalidForm,
		itemSavedAsDraft
	} = props;
	return (
		!invalidForm &&
		!saveAsDraft &&
		!isRenamed &&
		!isRepeatMode &&
		!isCreateMode &&
		!readonly &&
		!itemSavedAsDraft &&
		// Note these "Or" statements below build on top of the previous one (i.e. it only gets to the next if the previous is false).
		// If it's not embedded, unlock the item.
		(!isEmbedded ||
			// If is embedded but not stacked, unlock as the embedded is the root form.
			!isStackedForm ||
			// If the parent form is readonly, release the lock to put the parent back in sync with its readonly mode.
			isParentReadonly)
	);
}

/**
 * When the consumer component is being unmounted, checks if it should be unlocked and unlocks if so.
 * @param props {FormsEngineProps}
 **/
export function useUnlockOnClose(
	props: FormsEngineProps & { saveAsDraft?: boolean; invalidForm?: boolean; itemSavedAsDraft?: boolean }
) {
	const { create, update, repeat, stackIndex = 0, saveAsDraft = false, invalidForm, itemSavedAsDraft } = props;
	const itemPath = useContext(ItemContext)?.path;
	const { atoms } = useContext(StableFormContext);
	const { formsStackData } = useContext(StableGlobalContext);
	const store = useJotaiStore();
	const isEmbedded = Boolean(update?.modelId);
	const isCreateMode = Boolean(create?.path);
	const isRepeatMode = Boolean(repeat?.fieldId);
	const isStackedForm = stackIndex > 0;
	const dispatch = useDispatch();
	const readonly = useAtomValue(atoms.readonly);
	const siteId = useActiveSiteId();
	// Check fileName atom to determine if renamed (renamedPath context is not updated until saving, so if we use that here
	// it will have an outdated value).
	const currentFileName = useAtomValue(atoms.fileName);
	const isRenamed = itemPath ? currentFileName !== getFileNameValueFromPath(itemPath, isPagePath(itemPath)) : false;

	const unlockEffectRefs = useUpdateRefs<ShouldUnlockArguments & { dispatch: ReduxDispatch }>({
		dispatch,
		isRepeatMode,
		isCreateMode,
		readonly,
		isEmbedded,
		isStackedForm,
		isParentReadonly: formsStackData[stackIndex - 1] ? store.get(formsStackData[stackIndex - 1].atoms.readonly) : false,
		siteId,
		isRenamed,
		saveAsDraft,
		invalidForm,
		itemSavedAsDraft
	});
	useEffect(
		() => () => {
			if (shouldUnlockItem(unlockEffectRefs.current)) {
				unlock(unlockEffectRefs.current.siteId, itemPath).subscribe({
					next: () => {
						unlockEffectRefs.current.dispatch(showUnlockItemSuccessNotification());
					},
					error: (e) => {
						// If error is 404, assume rename (itemPath changed, and the renamed item is not locked) and do not show error dialog.
						if (e.status !== 404) {
							unlockEffectRefs.current.dispatch(showErrorDialog({ error: e.response?.response }));
						}
					}
				});
			}
		},
		[itemPath, unlockEffectRefs, saveAsDraft]
	);
}

/**
 * Generates a simple "save comment" stating the fields that having been modified.
 * TODO: plugin AI, or improve/revise comment generation.
 **/
export function generateDefaultChangesComment(
	contentTypeFields: LookupTable<ContentTypeField>,
	fieldsToRenderSubset: ContentTypeField[],
	changedFieldIds: Set<string>,
	currentMessage: string
): string | undefined {
	let fieldsToRender = contentTypeFields;
	if (fieldsToRenderSubset) {
		fieldsToRender = {};
		fieldsToRenderSubset.forEach((field) => {
			fieldsToRender[field.id] = field;
		});
	}
	const fieldsChangedNames: string[] = Array.from(changedFieldIds).flatMap(
		(fieldId) => fieldsToRender[fieldId]?.name ?? []
	);
	const newMessage = produceChangedFieldsMessage(fieldsChangedNames);
	if (
		// If message is blank, no point in checking if the user has altered the message.
		currentMessage !== '' &&
		// A repeated field is reporting changes, no need to set
		(currentMessage === newMessage ||
			// The version comment hasn't been manually altered by the user (i.e. if the current message is the same
			// as the message generated without the last field added to changedFieldIds, we can assume the message
			// has not been altered by user input)
			currentMessage !== produceChangedFieldsMessage(fieldsChangedNames.slice(0, -1)))
	) {
		// Do not set a new message
		return;
	}
	return newMessage;
}

/**
 * Produces the "save comment" for content being created at the supplied page URL (file name). An empty page URL
 * produces the generic comment new content forms start off with.
 **/
export function produceCreationMessage(pageUrl: string, formatMessage: IntlShape['formatMessage']): string {
	return pageUrl
		? formatMessage({ defaultMessage: 'Created {pageUrl}' }, { pageUrl })
		: formatMessage({ defaultMessage: 'Created content' });
}

/**
 * Generates the default "save comment" for content being created, based on the page URL (file name) it will be
 * created at.
 * @param pageUrl The current value of the file name field.
 * @param currentMessage The version comment currently held by the form.
 * @param lastGeneratedMessage The comment this function generated last, used to detect user input on the comment.
 * @returns The new comment, or undefined when the comment should be left untouched.
 **/
export function generateDefaultCreationComment(
	pageUrl: string,
	currentMessage: string,
	lastGeneratedMessage: string,
	formatMessage: IntlShape['formatMessage']
): string | undefined {
	const newMessage = pageUrl
		? formatMessage({ defaultMessage: 'Created {pageUrl}' }, { pageUrl })
		: formatMessage({ defaultMessage: 'Created content' });
	if (
		// Nothing to change
		currentMessage === newMessage ||
		// If message is blank, no point in checking if the user has altered the message.
		(currentMessage !== '' &&
			// The version comment has been manually altered by the user (i.e. if the current message isn't the last
			// message generated here, we can assume the message has been altered by user input)
			currentMessage !== lastGeneratedMessage)
	) {
		// Do not set a new message
		return;
	}
	return newMessage;
}

/**
 * Creates a summary of the state the current stacked form being rendered (last one on the stack)
 **/
export function getCurrentChildFormStateSummary(
	store: JotaiStore,
	formsStackData: StableGlobalContextProps['formsStackData']
): {
	isSubmitting: boolean;
	hasPendingChanges: boolean;
	readonly: boolean;
} {
	return {
		isSubmitting: store.get(formsStackData[formsStackData.length - 1].atoms.isSubmitting),
		hasPendingChanges: store.get(formsStackData[formsStackData.length - 1].atoms.hasPendingChanges),
		readonly: store.get(formsStackData[formsStackData.length - 1].atoms.readonly)
	};
}

/**
 * Creates a unique `key` (to be used as the key prop on a ReactNode[]) for stacked forms.
 **/
export function createStackedFormKey(currentStackedFormProps: FormsEngineProps, stackFormCount: number): string {
	if (currentStackedFormProps.update) {
		return `${currentStackedFormProps.update.path}_${currentStackedFormProps.update.modelId ?? ''}_${stackFormCount}`;
	} else if (currentStackedFormProps.create) {
		return `${currentStackedFormProps.create.path}_${currentStackedFormProps.create.contentTypeId}_${stackFormCount}`;
	} else if (currentStackedFormProps.repeat) {
		return `${currentStackedFormProps.repeat.fieldId}_${stackFormCount}`;
	}
	return;
}

export function getNodeIndex(element: Element): number {
	let index = 0;
	let sibling = element.previousElementSibling;
	while (sibling) {
		index++;
		sibling = sibling.previousElementSibling;
	}
	return index;
}

export function prepareEmbeddedItemForm(props: {
	username: string;
	contentType: ContentType;
	locked: boolean;
	lockError: ApiResponse;
	affectedPackages: PublishPackage[];
	update: FormsEngineProps['update'];
	parentStackData: StableFormContextProps;
	stableFormContextRef: RefObject<StableFormContextProps>;
	parentPathInSite: string;
	siteId: string;
	contentTypesById?: LookupTable<ContentType>;
	customControls?: LookupTable<DescriptorContentType>;
}): { atoms: FormsEngineAtoms; values: LookupTable<unknown>; itemMeta: FormsEngineItemMetaContextProps } {
	const {
		username,
		contentType,
		update,
		parentStackData,
		stableFormContextRef,
		parentPathInSite,
		locked,
		lockError,
		affectedPackages,
		siteId,
		contentTypesById,
		customControls
	} = props;
	const lockResultAtom = atom<FormsEngineEditContextProps>({
		locked,
		lockError,
		affectedPackages
	});
	const atoms = createFormsEngineAtoms(username, {
		lockResult: lockResultAtom,
		readonly: createReadonlyAtom(lockResultAtom),
		expandedStateBySectionId: buildSectionExpandedStateAtoms(contentType.sections),
		fileName: atom(update.modelId)
	});
	const values = { ...update.values };
	const validatorsData = { siteId, contentTypesById };

	const descriptors = resolveControlDescriptors(customControls);
	const additionalFieldsIds: string[] = [];
	// Retrieve all additional fields ids from the contentType fields.
	Object.values(contentType.fields).forEach((field) => {
		const descriptor = descriptors[field.type];
		if (!descriptor) return;
		additionalFieldsIds.push(...getAdditionalFieldsIdsFromDescriptor(field.id, descriptor));
	});
	// Ensure descriptor additional fields exist in values so atoms are created (same as main/repeat bootstrap).
	additionalFieldsIds.forEach((additionalFieldId) => {
		if (!(additionalFieldId in values)) {
			values[additionalFieldId] = undefined;
		}
	});

	Object.entries(values).forEach(([fieldId, value]) => {
		const isAdditionalField = additionalFieldsIds.includes(fieldId);
		// System fields (e.g. content-type, display-template, etc.) are not part of the content type, but are part of the content object. We don't need atoms or validity checks for these.
		if (!contentType.fields[fieldId] && !isAdditionalField) return;
		setFieldAtoms(
			stableFormContextRef,
			contentType,
			contentType.fields,
			fieldId,
			atoms,
			value,
			validatorsData,
			isAdditionalField
		);
	});
	const xmlDoc = fromString(parentStackData.itemMeta.contentXml);
	const element = xmlDoc.querySelector(`[id="${update.modelId}"]`);
	const fieldId = element.parentElement.parentElement.tagName; // <root><fieldId><item><component/></item></fieldId></root>, so (component.parentElement = item).parentElement = fieldId
	const index = getNodeIndex(element.parentElement); // Get the position of the `item` tag
	const contentObject = (
		parentStackData.itemMeta.contentObject[fieldId] as { item: Array<{ component: LookupTable<unknown> }> }
	).item[index].component;
	return {
		atoms,
		values,
		itemMeta: {
			id: values[XmlKeys.modelId] as string,
			path: update.path,
			sourceMap: null,
			pathInSite: parentPathInSite,
			contentType,
			contentXml: element.outerHTML,
			contentObject
		}
	};
}

export { getPropertyValue, getValidationValue } from './fieldPropertyUtils';

/**
 * Determines if a field is read-only based on the form's read-only state or the field's properties.
 *
 * @param field {ContentTypeField} - The field whose read-only status is being checked.
 * @param formReadonly {boolean} - A flag indicating whether the entire form is in read-only mode.
 * @returns {boolean} - `true` if the field is read-only, either due to the form's state or the field's properties; otherwise, `false`.
 */
export function isFieldReadOnly(field: ContentTypeField, formReadonly: boolean): boolean {
	return formReadonly || (getPropertyValue(field.properties, 'readonly') as boolean);
}

/**
 * Constructs the full path for a content item based on its type, base path, and file name.
 *
 * This function determines the appropriate path format based on the content type.
 * If the content type is a "page", the path will include an `index.xml` file within a folder.
 * Otherwise, the path will include the file name with a `.xml` extension directly.
 *
 * @param {string} basePath - The base path where the content item resides.
 * @param {string} fileName - The name of the file (without extension or directory).
 * @param {ContentType} contentType - The content type object, which determines the path format.
 * @returns {string} - The constructed full path for the content item.
 *
 */
export function composePathForType(basePath: string, fileName: string, contentType: ContentType): string {
	if (contentType.type === 'page') {
		return ensureSingleSlash(`${basePath}/${fileName}/index.xml`);
	} else {
		return ensureSingleSlash(`${basePath}/${fileName}.xml`);
	}
}

export function getAdditionalFieldsIdsFromDescriptor(fieldId: string, descriptor: DescriptorContentType): string[] {
	const additionalFields = descriptor.metadata?.additionalFields ?? [];
	return additionalFields.map((additionalField) => processAdditionalFieldMacro(fieldId, additionalField));
}

/**
 * Merges ui.xml custom control descriptors under code-default descriptors.
 * Code defaults win on key collision so OOB controls are not overridden by ui.xml entries.
 */
export function resolveControlDescriptors(
	customControls?: LookupTable<DescriptorContentType>
): LookupTable<DescriptorContentType> {
	return { ...customControls, ...controlDescriptors };
}

// TODO: are there going to be other placeholders besides {id}?
export function processAdditionalFieldMacro(parentFieldId: string, fieldId: string): string {
	return fieldId.replaceAll('{id}', parentFieldId);
}
