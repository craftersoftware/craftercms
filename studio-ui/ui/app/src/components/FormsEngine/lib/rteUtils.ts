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

import { Editor } from '@tinymce/tinymce-react';
import { ContentTypeField, GlobalState, LookupTable } from '../../../models';
import { reversePluckProps } from '../../../utils/object';
import { getPropertyValue, getValidationValue } from './fieldPropertyUtils';
import type {
	DataSourceFieldContext,
	DataSourceSelection,
	ResolvedDataSourceAction,
	ResolvedDataSources
} from '../dataSources/types';
import { buildActionGroups, invokeActionChoice } from '../dataSources/actionAdapters';

export type OpenRteDataSourcePicker = (
	actions: readonly ResolvedDataSourceAction[],
	context: DataSourceFieldContext,
	onResult: (selection: DataSourceSelection | DataSourceSelection[] | null) => void
) => void;

// Maps application locales to their corresponding TinyMCE language codes.
const tinymceLangMap = {
	es: 'es',
	en: 'en',
	ko: 'ko_KR',
	de: 'de'
};

export function getTinyMceInitOptions(
	field: ContentTypeField,
	rteConfig: GlobalState['preview']['richTextEditor'], // GlobalState['preview']['richTextEditor']['']['']
	locale: string,
	defaultOptions?: Editor['props']['init'],
	dataSources?: ResolvedDataSources,
	openDataSourcePicker?: OpenRteDataSourcePicker,
	setup?: Editor['props']['init']['setup']
): Editor['props']['init'] {
	const setupId: string = getPropertyValue(field.properties, 'rteConfiguration', 'generic') as string;
	const height = getPropertyValue(field.properties, 'height', 300) as number;
	const autoGrow = getPropertyValue(field.properties, 'autoGrow', false) as boolean;
	const allowAddMedia = getValidationValue(field.validations, 'addMedia', true) as boolean;

	const defaultTinymceOptions = defaultOptions
		? { id: '', tinymceOptions: defaultOptions }
		: (Object.values(rteConfig)[0] ?? { id: '', tinymceOptions: {} });
	const tinymceOptions: Editor['props']['init'] =
		(rteConfig[setupId] ?? Object.values(rteConfig)[0])?.tinymceOptions ?? defaultTinymceOptions?.tinymceOptions ?? {};
	const controlProps: Partial<Editor['props']['init']> = {};
	if (typeof field.properties?.enableSpellCheck?.value === 'boolean') {
		controlProps.browser_spellcheck = field.properties.enableSpellCheck.value;
	}

	const external: LookupTable<string> = {
		...tinymceOptions.external_plugins,
		acecode: '/studio/static-assets/js/tinymce-plugins/ace/plugin.min.js',
		editform: '/studio/static-assets/js/tinymce-plugins/editform/plugin.js',
		craftercms_paste_extension: '/studio/static-assets/js/tinymce-plugins/craftercms_paste_extension/plugin.js',
		template: '/studio/static-assets/js/tinymce-plugins/template/plugin.js',
		craftercms_paste: '/studio/static-assets/js/tinymce-plugins/craftercms_paste/plugin.js'
	};
	// TODO: Tiny: must remove `autoresize_on_init`, `templates` from all configs
	const init: Editor['props']['init'] = {
		license_key: 'gpl',
		// Needs to be set to split when the editor is rendered in a scrollable container.
		// The `height` and `overflow` of the FormsEngine root breaks some of Tiny's internal rendering mechanics.
		ui_mode: 'split',
		language: tinymceLangMap[locale] ?? 'en',
		target: tinymceOptions.target,
		promotion: false,
		branding: false,
		// Templates plugin is deprecated but still available on v6, since it may be used, we'll keep it. Please
		// note that it will become premium on version 7.
		deprecation_warnings: true,
		height: height + 78,
		min_height: height + 78,
		plugins: ['craftercms_paste', tinymceOptions.plugins, autoGrow ? 'autoresize' : false].filter(Boolean).join(' '), // 'editform' plugin will always be loaded
		encoding: 'xml',
		paste_as_text: tinymceOptions?.paste_as_text ?? false,
		paste_data_images: true,
		paste_preprocess(plugin, args) {
			tinymceOptions.paste_preprocess?.(plugin, args);
			window.tinymce.activeEditor.plugins.craftercms_paste_extension?.paste_preprocess(plugin, args);
		},
		paste_postprocess(plugin, args) {
			// TODO: handle dragged datasources
			// if (args.node.outerText === '' && !args.internal && !_thisControl.editorImageDatasources.length) {
			// 	args.preventDefault();
			// 	_thisControl.editor.notificationManager.open({
			// 		text: _thisControl.formatMessage(_thisControl.messages.noDatasourcesConfigured),
			// 		timeout: 3000,
			// 		type: 'error'
			// 	});
			// } else {
			tinymceOptions.paste_postprocess?.(plugin, args);
			window.tinymce.activeEditor.plugins.craftercms_paste_extension?.paste_postprocess(plugin, args);
		},
		toolbar: tinymceOptions.toolbar,
		menubar: tinymceOptions.menubar ?? false,
		inline: tinymceOptions.inline,
		base_url: '/studio/static-assets/libs/tinymce',
		suffix: '.min',
		external_plugins: external,
		code_editor_inline: false,
		skin: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oxide-dark' : 'oxide',
		// skin_url: '/studio/static-assets/libs/tinymce',
		content_css: (tinymceOptions?.content_css as string | string[])?.length
			? tinymceOptions.content_css
			: window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'default',
		media_live_embeds: true,
		file_picker_types: 'image media',
		craftercms_paste_cleanup: tinymceOptions.craftercms_paste_cleanup ?? true, // If doesn't exist or if true => true
		// If the allowAddMedia validation is set to false, then the callback is not set, so the add media/file options won't be shown in the editor.
		file_picker_callback: allowAddMedia
			? function (cb, value, meta) {
					const propertyNames =
						meta.filetype === 'image'
							? ['imageManager']
							: meta.filetype === 'media'
								? ['videoManager', 'audioManager']
								: ['fileManager'];
					const actions =
						dataSources?.actions.filter((candidate) => propertyNames.includes(candidate.binding.propertyName)) ?? [];
					const applySelection = (selection: DataSourceSelection | DataSourceSelection[] | null) => {
						const selected = Array.isArray(selection) ? selection[0] : selection;
						if (selected?.kind === 'asset' && typeof selected.relativeUrl === 'string') cb(selected.relativeUrl);
						else if (selected?.kind === 'item' && typeof selected.path === 'string') cb(selected.path);
						else if (
							selected?.kind === 'variants' &&
							Array.isArray(selected.items) &&
							typeof selected.items[0]?.url === 'string'
						) {
							cb(selected.items[0].url);
						}
					};
					if (actions.length && dataSources?.context) {
						const grouped = buildActionGroups(actions);
						if (
							grouped.customActions.length === 0 &&
							grouped.groups.length === 1 &&
							grouped.groups[0].choices.length === 1
						) {
							invokeActionChoice(grouped.groups[0].choices[0], dataSources.context)
								.then(applySelection)
								.catch((error) => console.error('Unable to select rich-text media.', error));
						} else {
							openDataSourcePicker?.(actions, dataSources.context, applySelection);
						}
					} else {
						window.tinymce?.activeEditor?.notificationManager?.open({
							text: 'No data sources have been configured for this field.',
							timeout: 3000,
							type: 'error'
						});
						cb('');
					}
					//   // meta contains info about type (image, media, etc). Used to properly add DS to dialogs.
					//   // meta.filetype === 'file | image | media'
					//   const datasources = {};
					//   Object.values(field.validations).forEach((validation) => {
					//     if (
					//       [
					//         'allowImageUpload',
					//         'allowImagesFromRepo',
					//         'allowVideoUpload',
					//         'allowVideosFromRepo',
					//         'allowAudioUpload',
					//         'allowAudioFromRepo'
					//       ].includes(validation.id)
					//     ) {
					//       datasources[validation.id] = validation;
					//     }
					//   });
					//   const browseBtn = document.querySelector('.tox-dialog .tox-browse-url');
					//
					//   // post(
					//   //   showRtePickerActions({
					//   //     datasources,
					//   //     model,
					//   //     type: meta.filetype,
					//   //     rect: browseBtn.getBoundingClientRect()
					//   //   })
					//   // );
					//
					//   // message$
					//   //   .pipe(
					//   //     filter((e) => e.type === rtePickerActionResult.type),
					//   //     take(1)
					//   //   )
					//   //   .subscribe(({ payload }) => {
					//   //     if (payload) {
					//   //       cb(payload.path, { alt: payload.name });
					//   //     }
					//   //   });
				}
			: null,
		setup(editor) {
			const pluginManager = window.tinymce.util.Tools.resolve('tinymce.PluginManager');

			editor.on('DblClick', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (e.target.nodeName === 'IMG') {
					window.tinymce.activeEditor.execCommand('mceImage');
				}
			});

			// editor.on('click', (e) => {
			//   e.preventDefault();
			//   e.stopPropagation();
			// });

			editor.on('paste', () => {
				// console.log('content', getContent());
			});

			// Register 'templates_css' for a set of custom css styles (files) that will apply to the templates content
			editor.options.register('templates_css', { processor: 'string[]' });
			editor.options.set('templates_css', [
				window.matchMedia('(prefers-color-scheme: dark)').matches
					? '/studio/static-assets/libs/tinymce/skins/content/dark/content.min.css'
					: '/studio/static-assets/libs/tinymce/skins/content/default/content.min.css'
			]);

			// No point in waiting for `craftercms_tinymce_hooks` if the hook won't be loaded at all.
			external.craftercms_tinymce_hooks &&
				pluginManager.waitFor(
					'craftercms_tinymce_hooks',
					() => {
						const hooks = pluginManager.get('craftercms_tinymce_hooks');
						if (hooks) {
							pluginManager.get('craftercms_tinymce_hooks').setup?.(editor);
						} else {
							console.error(
								"The `craftercms_tinymce_hooks` was configured to be loaded but didn't load. Check the path is correct in the rte configuration file."
							);
						}
					},
					'loaded'
				);
			setup?.(editor);
		},
		...(tinymceOptions && {
			// Pluck non-serializable props (DOM `target`, callbacks) before cloning. Tiny mutates the
			// options object; cloning avoids crashes on immutable state (e.g. Redux) and keeps state clean.
			...JSON.parse(
				JSON.stringify(
					reversePluckProps(
						tinymceOptions,
						'target', // Target can't be changed; also a DOM node (circular / non-JSON).
						'inline', // Not using inline view doesn't behave well on XB, this setting shouldn't be changed.
						'setup',
						'base_url',
						'encoding',
						'autosave_ask_before_unload', // Auto-save options are removed since it is not supported in control.
						'autosave_interval',
						'autosave_prefix',
						'autosave_restore_when_empty',
						'autosave_retention',
						'file_picker_callback', // No file picker is set by default, and functions are not supported in config file. Files/images handlers currently not supported.
						'height', // Height is set to the size of content
						'paste_postprocess',
						'paste_preprocess',
						'paste_as_text', // Considered above,
						'images_upload_handler',
						'code_editor_inline',
						'plugins', // Considered/used above, mixed with our options
						'external_plugins', // Considered/used above, mixed with our options,
						'content_css' // Handled above, if no content_css is found it will use dark/default styles.
					)
				)
			)
		}),
		...controlProps
	};
	return init;
}
