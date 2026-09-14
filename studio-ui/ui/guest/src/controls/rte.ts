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

import { ElementRecord } from '../models/InContextEditing';
import * as iceRegistry from '../iceRegistry';
import { Editor, EditorEvent } from 'tinymce';
import * as contentController from '../contentController';
import { ContentTypeFieldValidations } from '@craftercms/studio-ui/models/ContentType';
import { fromTopic, post } from '../utils/communicator';
import { GuestStandardAction } from '../store/models/GuestStandardAction';
import { EMPTY, Observable, Subject, Subscription } from 'rxjs';
import { filter, startWith, take } from 'rxjs/operators';
import { nou } from '@craftercms/studio-ui/utils/object';
import { snackGuestMessage } from '@craftercms/studio-ui/state/actions/preview';
import { editComponentInline, exitComponentInlineEdit } from '../store/actions';
import { emptyFieldClass } from '../constants';
import { unlockItem } from '@craftercms/studio-ui/state/actions/content';
import { Editor as EditorReact } from '@tinymce/tinymce-react';
import { getTinyMceInitOptions } from '@craftercms/studio-ui/components/FormsEngine/lib/rteUtils';
import { getCurrentIntl } from '../utils/i18n';
import { RteSetup } from '../models/Rte';
import {
	cancelRteDataSourcePicker,
	rteDataSourcePickerResult,
	showRteDataSourcePicker
} from '@craftercms/studio-ui/state/actions/dialogs';
import { v4 as uuid } from 'uuid';

export function initTinyMCE(
	path: string,
	record: ElementRecord,
	validations: Partial<ContentTypeFieldValidations>,
	rteSetup?: RteSetup
): Observable<GuestStandardAction> {
	// Tinymce needs the document to be in standards mode to work, if it's not the case, we can't initialize it and we
	// show an error message instead.
	if (nou(document.doctype)) {
		console.error('Unable to initialize Rich Text Editor. Please contact your administrator for assistance.');
		post(
			snackGuestMessage({
				id: 'noDocTypeError',
				level: 'required'
			})
		);
		post(unlockItem({ path }));
		return EMPTY;
	}

	const dispatch$ = new Subject<GuestStandardAction>();
	const { field, model, contentTypeId } = iceRegistry.getReferentialEntries(record.iceIds[0]);
	const type = field?.type;
	const inlineElsRegex =
		/^(B|BIG|I|SMALL|TT|ABBR|ACRINYM|CITE|CODE|DFN|EM|KBD|STRONG|SAMP|VAR|A|BDO|BR|IMG|MAP|OBJECT|Q|SCRIPT|SPAN|SUB|SUP|BUTTON|INPUT|LABEL|SELECT|TEXTAREA)$/;
	const originalElement = record.element;
	const originalRawContent = originalElement.innerHTML;
	let rteEl = originalElement;
	const isRecordElInline = record.element.tagName.match(inlineElsRegex);
	const isRTE = type === 'rte';

	// If record element is of type inline (doesn't matter the display prop), replace it with a block element (div).
	// This is because of an issue happening with inline elements (for example a span tag even with 'display: block' style
	// was still causing an issue, and also for example a div element with 'display: inline' doesn't present the issue).
	// https://github.com/craftersoftware/craftercms/issues/5212
	if (isRecordElInline) {
		const recordEl = record.element;
		const blockEl = document.createElement('div');
		blockEl.innerHTML = recordEl.innerHTML;

		/*
		 * Get and copy only the inline styles (from the 'style' prop) of the element. If we want to retrieve all the styles
		 * (inline styles and styles applied from css files, etc.) we would use `window.getComputedStyle(element)`, but
		 * that may cause an issue because all the styles would become inline styles and have higher precedence than other
		 * styles (for example styles applied by XB).
		 * */
		const inlineStyles = recordEl.style;
		blockEl.style.cssText = Array.from(inlineStyles).reduce((str, property) => {
			return `${str}${property}:${inlineStyles.getPropertyValue(property)};`;
		}, '');

		// Copy original element className
		blockEl.className = recordEl.className;
		blockEl.style.display = 'inline-block';

		blockEl.style.minHeight = recordEl.offsetHeight + 'px';
		blockEl.style.minWidth = '10px';
		rteEl = blockEl;

		// Hide original element
		recordEl.style.display = 'none';
		recordEl.parentNode.insertBefore(rteEl, recordEl);
	}

	const controlPropsMap = {
		enableSpellCheck: 'browser_spellcheck'
	};
	const controlProps = {};
	Object.keys(controlPropsMap).forEach((key) => {
		if (field.properties?.[key]) {
			const propKey = controlPropsMap[key];
			controlProps[propKey] = field.properties[key].value;
		}
	});

	const external: { [id: string]: string } = {
		...rteSetup?.tinymceOptions?.external_plugins,
		acecode: '/studio/static-assets/js/tinymce-plugins/ace/plugin.min.js',
		editform: '/studio/static-assets/js/tinymce-plugins/editform/plugin.js',
		craftercms_paste_extension: '/studio/static-assets/js/tinymce-plugins/craftercms_paste_extension/plugin.js',
		template: '/studio/static-assets/js/tinymce-plugins/template/plugin.js',
		craftercms_paste: '/studio/static-assets/js/tinymce-plugins/craftercms_paste/plugin.js'
	};

	record.element.classList.remove(emptyFieldClass);

	// The editor runs inside the preview iframe, but data sources can only be resolved by the host:
	// their actions carry React nodes and closures over Studio dialogs that don't exist here. The
	// guest identifies the field, the host presents the picker and replies with the selected url.
	let isDataSourcePickerOpen = false;
	let dataSourcePickerRequestId: string = null;
	let dataSourcePickerSubscription: Subscription;
	function stopListeningToHostDataSourcePicker() {
		isDataSourcePickerOpen = false;
		dataSourcePickerRequestId = null;
		dataSourcePickerSubscription?.unsubscribe();
		dataSourcePickerSubscription = null;
	}
	/** Lets the host drop the request (and close what it presented for it) when there's no one left to reply to. */
	function cancelHostDataSourcePicker() {
		const id = dataSourcePickerRequestId;
		stopListeningToHostDataSourcePicker();
		if (id) {
			post(cancelRteDataSourcePicker({ id }));
		}
	}
	const openHostDataSourcePicker: EditorReact['props']['init']['file_picker_callback'] = (cb, value, meta) => {
		const id = uuid();
		// Replacing an in-flight request: let the host know the prior one will no longer be consumed.
		cancelHostDataSourcePicker();
		isDataSourcePickerOpen = true;
		dataSourcePickerRequestId = id;
		dataSourcePickerSubscription = fromTopic(rteDataSourcePickerResult.type)
			.pipe(
				filter(({ payload }) => payload?.id === id),
				take(1)
			)
			.subscribe(({ payload }) => {
				// `take(1)` already completed the subscription; only the picking state needs resetting.
				isDataSourcePickerOpen = false;
				dataSourcePickerRequestId = null;
				if (payload?.url) {
					cb(payload.url, { alt: payload.name });
				}
			});
		post(
			showRteDataSourcePicker({
				id,
				contentTypeId,
				fieldId: record.fieldId[0],
				filetype: meta.filetype,
				objectId: model?.craftercms?.id,
				path: model?.craftercms?.path
			})
		);
	};

	const setupId = rteSetup?.id ?? 'generic';
	const rteConfig = getTinyMceInitOptions(
		field,
		{
			setupId: {
				id: setupId,
				tinymceOptions: {
					// Tinymce typings for tinymce-react are wrong (not in sync with tinymce ones).
					...((rteSetup?.tinymceOptions as unknown as EditorReact['props']['init']) ?? {}),
					target: rteEl as any,
					deprecation_warnings: false,
					paste_as_text: !isRTE,
					paste_data_images: isRTE,
					toolbar: isRTE,
					menubar: isRTE,
					inline: true,
					code_editor_inline: false,
					paste_preprocess(editor, args) {
						const currentContent = editor.getContent({ format: 'text' });
						const pastedText = new DOMParser().parseFromString(args.content, 'text/html').body.textContent ?? '';
						const selectedContent = editor.selection.getContent({ format: isRTE ? 'html' : 'text' });
						const fullLength = currentContent.length + pastedText.length - selectedContent.length;
						const maxLengthExceeded = maxLength !== null && fullLength > maxLength;
						if (maxLengthExceeded) {
							post(
								snackGuestMessage({
									id: 'maxLength',
									level: 'required',
									values: {
										maxLength: `${fullLength}/${maxLength}`
									}
								})
							);
							args.content = args.content.substring(0, maxLength - (currentContent.length - selectedContent.length));
						}
					}
				}
			}
		},
		getCurrentIntl().locale,
		{},
		undefined,
		undefined,
		(editor: Editor) => {
			let changed = false;
			const pluginManager = window.tinymce.util.Tools.resolve('tinymce.PluginManager');
			const nonChars = [
				'Meta',
				'Alt',
				'Control',
				'Shift',
				'CapsLock',
				'Tab',
				'Escape',
				'ArrowLeft',
				'ArrowRight',
				'ArrowUp',
				'ArrowDown',
				'Dead',
				'Delete'
				// Added as needed when using this array...
				// 'Backspace',
				// 'Enter'
			].filter(Boolean);

			// Meant to avoid a hard refresh causing the item to stay locked. As more XB controls come to life,
			// this may not be the best place to handle this.
			const beforeUnloadFn = (event: BeforeUnloadEvent) => post(unlockItem({ path }));
			window.addEventListener('beforeunload', beforeUnloadFn, { capture: true, passive: true });

			function save() {
				const content = getContent();
				if (changed) {
					contentController.updateField(record.modelId, record.fieldId[0], record.index, content);
				}
			}

			function getContent() {
				return editor.getContent({ format: isRTE ? 'html' : 'text' });
			}

			function getSelectionContent() {
				return editor.selection.getContent({ format: isRTE ? 'html' : 'text' });
			}

			function destroyEditor() {
				editor.destroy(false);
			}

			function cancel({ saved }: { saved: boolean }) {
				const finalContent = saved ? getContent() : originalRawContent;

				cancelHostDataSourcePicker();
				destroyEditor();

				originalElement.innerHTML = finalContent;

				if (isRecordElInline) {
					// Remove the created blockElement and remove the display: none on original element
					rteEl.remove();
					record.element.style.display = '';
				}

				if (finalContent.trim() === '') {
					record.element.classList.add(emptyFieldClass);
				}

				window.removeEventListener('beforeunload', beforeUnloadFn, { capture: true });

				// The timeout prevents clicking the edit menu to be shown when clicking out of an RTE
				// with the intention to exit editing.
				setTimeout(() => {
					dispatch$.next(exitComponentInlineEdit({ path, saved }));
					dispatch$.complete();
					dispatch$.unsubscribe();
				}, 150);
			}

			function replaceLineBreaksIfApplicable(content: string) {
				if (type === 'textarea') {
					// Replace line breaks with <br> for textarea fields
					// Address line breaks in textarea fields: https://github.com/craftersoftware/craftercms/issues/6432
					editor.setContent(content.replaceAll('\n', '<br>'), { format: 'html' });
				} else if (isRTE) {
					// Set content in 'html' format for the editor to exec its internal cleanup mechanisms
					// For example, removal of potentially problematic line breaks which we're seeing cause the list plugin to crash (https://github.com/craftersoftware/craftercms/issues/6514)
					editor.setContent(content, { format: 'html' });
				}
			}

			editor.on('init', function () {
				const initialTinyContent = getContent();

				replaceLineBreaksIfApplicable(originalRawContent);

				editor.focus(false);
				editor.selection.select(editor.getBody(), true);
				editor.selection.collapse(false);

				// In some cases the 'blur' event is getting caught somewhere along
				// the way. Focusout seems to be more reliable.
				editor.on('focusout', (e: EditorEvent<FocusEvent & { forced?: boolean }>) => {
					// The data source picker renders on the host, outside of this iframe, so focus
					// legitimately leaves the editor while the author picks. Tearing it down here would
					// destroy the editor the pending selection is meant to be inserted into.
					if (isDataSourcePickerOpen) {
						return;
					}
					// Only consider 'focusout' events that are trusted and not at the bubbling phase.
					if (e.forced || (e.isTrusted && e.eventPhase !== 3)) {
						let relatedTarget = e.relatedTarget as HTMLElement;
						let saved = false;
						// The 'change' event is not triggering until focusing out in v6. Reported in here https://github.com/tinymce/tinymce/issues/9132
						changed = changed || getContent() !== initialTinyContent;
						if (
							!relatedTarget?.closest('.tox-tinymce') &&
							!relatedTarget?.closest('.tox') &&
							!relatedTarget?.classList.contains('tox-dialog__body-nav-item')
						) {
							if (validations?.required && !getContent().trim()) {
								post(
									snackGuestMessage({
										id: 'required',
										level: 'required',
										values: { field: record.label }
									})
								);
							} else if (changed) {
								saved = true;
								save();
							}
							e.stopImmediatePropagation();
							cancel({ saved });
						}
					}
				});

				editor.once('change', () => {
					changed = true;
				});

				editor.once('external_change', () => {
					changed = true;
				});

				if (type !== 'html') {
					// For plain text fields, remove keyboard shortcuts for formatting text
					// meta is used in tinymce for Ctrl (PC) and Command (macOS)
					// https://www.tiny.cloud/docs/advanced/keyboard-shortcuts/#editorkeyboardshortcuts
					editor.addShortcut('meta+b', '', '');
					editor.addShortcut('meta+i', '', '');
					editor.addShortcut('meta+u', '', '');
				}
			});

			editor.on('paste', (e) => {
				if (type === 'textarea') {
					// Doing this immediately (without the timeout) causes the content to be duplicated.
					// TinyMCE seems to be doing something internally that causes this.
					setTimeout(() => {
						const newContent = getContent();
						if (newContent.includes('\n')) {
							replaceLineBreaksIfApplicable(newContent);
							editor.selection.select(editor.getBody(), true);
							editor.selection.collapse(false);
						}
					}, 10);
				}
			});

			editor.on('keyup', (e) => {
				let content = getContent();
				if (validations?.required && content.trim() === '' && !nonChars.concat('Enter').includes(e.key)) {
					post(
						snackGuestMessage({
							id: 'required',
							level: 'suggestion',
							values: { field: record.label }
						})
					);
				}
			});

			editor.on('keydown', (e) => {
				let content: string, selection: string, numMaxLength: number;
				if (e.key === 'Escape') {
					e.stopImmediatePropagation();
					cancel({ saved: false });
				} else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
					e.preventDefault();
					// Timeout to avoid "Uncaught TypeError: Cannot read properties of null (reading 'getStart')"
					// Hypothesis is the focusout destroys the editor before some internal tiny thing runs.
					// @ts-ignore - Add "forced" property to be able to recognise this manually-triggered focusout on our handler.
					setTimeout(() => editor.fire('focusout', { forced: true }));
				} else if (e.key === 'Enter' && !isRTE && type !== 'textarea') {
					// Avoid new line in plain text fields
					e.preventDefault();
				} else if (
					validations?.maxLength &&
					!nonChars.concat('Backspace').includes(e.key) &&
					(content = getContent()).length + 1 > (numMaxLength = parseInt(validations.maxLength.value)) &&
					// If everything is selected and a key is pressed, essentially, it will
					// delete everything so no max-length problem
					((selection = getSelectionContent()) === '' || content.length - (selection.length + 1) > numMaxLength)
				) {
					post(
						snackGuestMessage({
							id: 'maxLength',
							level: 'required',
							values: { maxLength: `${content.length}/${validations.maxLength.value}` }
						})
					);
					e.stopPropagation();
					return false;
				}
			});

			editor.on('DblClick', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (e.target.nodeName === 'IMG') {
					window.tinymce.activeEditor.execCommand('mceImage');
				}
			});

			editor.on('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
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
		},
		openHostDataSourcePicker
	);

	const maxLength = validations?.maxLength ? parseInt(validations.maxLength.value) : null;
	// @ts-expect-error - Typings state the prop is wrong for the React integration, but the prop is correct.
	window.tinymce.init(rteConfig);

	return dispatch$.pipe(startWith({ type: editComponentInline.type }));
}
