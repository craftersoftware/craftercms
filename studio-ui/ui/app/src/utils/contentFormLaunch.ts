/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import type { CommonSaveOptions } from '../components/MultiChoiceSaveButton/MultiChoiceSaveButton';

/** Same set as {@link CommonSaveOptions}. Draft-ness is a separate flag on the save result. */
export type ContentFormSaveAction = CommonSaveOptions;

/**
 * What the dialog did, from the close and minimize checkboxes. Close wins.
 * A save with neither checkbox reports `save` (the form stayed open).
 */
export function contentFormSaveAction(flags: { close: boolean; minimize: boolean }): ContentFormSaveAction {
	return flags.close ? 'saveAndClose' : flags.minimize ? 'saveAndMinimize' : 'save';
}

export interface ContentFormLaunchInput {
	path: string;
	isNewContent?: boolean;
	contentTypeId?: string;
	isEmbedded?: boolean;
	modelId?: string;
	changeTemplate?: string;
	readonly?: boolean;
	/** Fields to show. Experience Builder posts the zone's field id list. */
	selectedFields?: readonly string[];
	/** Repeat-item index. Nested indexes such as `"1.2"` are not applied. */
	index?: string | number;
}

type FormsEngineLaunchTarget = {
	readonly: boolean;
	/** Passed through unchanged. The form resolves dotted ids once the content type is loaded. */
	fieldIds?: string[];
	repeatIndex?: string | number;
} & (
	| { create: { path: string; contentTypeId: string }; update?: undefined }
	| { update: { path: string; modelId?: string; changeTypeId?: string }; create?: undefined }
);

function selectedFieldList(value: ContentFormLaunchInput['selectedFields']): string[] | undefined {
	return value?.length ? [...value] : undefined;
}

/**
 * Edit and change-template follow-ups. The form already announces a draft, so that
 * save skips the success notification. The other work (refresh, caller callback) still runs.
 */
export function saveSuccessFollowUps<Notification, FollowUp>(
	draft: boolean | undefined,
	notification: Notification,
	followUps: readonly FollowUp[]
): Array<Notification | FollowUp> {
	return draft === true ? [...followUps] : [notification, ...followUps];
}

/**
 * Maps a content-form launch onto Forms Engine props. Field scope is applied by the
 * form's visibility model (`fieldIds` / `repeatIndex`); this function does not look
 * at the content type.
 *
 * `index` and the save-result `draft` / `action` are part of this contract. #9213's
 * `ShowContentFormProps` does not have them yet; add them there instead of dropping
 * them here. `showContentFormAction` should call this instead of hardcoding
 * `'saveAndClose'` and `fieldToScroll: selectedFields[0]`.
 */
export function formsEnginePropsFromLaunch(props: ContentFormLaunchInput): FormsEngineLaunchTarget {
	const fieldIds = selectedFieldList(props.selectedFields);
	const targeting = {
		readonly: props.readonly ?? false,
		...(fieldIds ? { fieldIds } : {}),
		...(props.index !== undefined && props.index !== '' ? { repeatIndex: props.index } : {})
	};
	if (props.isNewContent) {
		return { ...targeting, create: { path: props.path, contentTypeId: props.contentTypeId ?? '' } };
	}
	if (props.isEmbedded || props.modelId) {
		return { ...targeting, update: { path: props.path, modelId: props.modelId } };
	}
	return { ...targeting, update: { path: props.path, changeTypeId: props.changeTemplate } };
}
