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
import { message$, post } from '../utils/communicator';
import { GuestStandardAction } from '../store/models/GuestStandardAction';
import { Observable, Subject } from 'rxjs';
import { filter, startWith, take } from 'rxjs/operators';
import { reversePluckProps } from '@craftercms/studio-ui/utils/object';
import { showEditDialog, snackGuestMessage } from '@craftercms/studio-ui/state/actions/preview';
import { RteSetup } from '../models/Rte';
import { editComponentInline, exitComponentInlineEdit } from '../store/actions';
import { emptyFieldClass } from '../constants';
import { rtePickerActionResult, showRtePickerActions } from '@craftercms/studio-ui/state/actions/dialogs';
import { unlockItem } from '@craftercms/studio-ui/state/actions/content';
import { getPreviewURLFromPath } from '@craftercms/studio-ui/utils/path';

export function initTinyMCE(
  path: string,
  record: ElementRecord,
  validations: Partial<ContentTypeFieldValidations>,
  rteSetup?: RteSetup
): Observable<GuestStandardAction> {
  const dispatch$ = new Subject<GuestStandardAction>();
  const { field, model } = iceRegistry.getReferentialEntries(record.iceIds[0]);
  const type = field?.type;
  const inlineElsRegex =
    /^(B|BIG|I|SMALL|TT|ABBR|ACRINYM|CITE|CODE|DFN|EM|KBD|STRONG|SAMP|VAR|A|BDO|BR|IMG|MAP|OBJECT|Q|SCRIPT|SPAN|SUB|SUP|BUTTON|INPUT|LABEL|SELECT|TEXTAREA)$/;
  const originalElement = record.element;
  const originalRawContent = originalElement.innerHTML;
  let rteEl = originalElement;
  const isRecordElInline = record.element.tagName.match(inlineElsRegex);

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

  const openEditForm = () => {
    post({
      type: showEditDialog.type,
      payload: {
        selectedFields: [field.id]
      }
    });
  };

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

  window.tinymce.init({
    license_key: 'gpl',
    target: rteEl,
    promotion: false,
    branding: false,
    // Templates plugin is deprecated but still available on v6, since it may be used, we'll keep it. Please
    // note that it will become premium on version 7.
    deprecation_warnings: false,
    // For some reason this is not working.
    // body_class: 'craftercms-rich-text-editor',
    plugins: ['craftercms_paste editform', rteSetup?.tinymceOptions?.plugins].filter(Boolean).join(' '), // 'editform' plugin will always be loaded
    paste_as_text: type !== 'html',
    paste_data_images: type === 'html',
    paste_preprocess(plugin, args) {
      window.tinymce.activeEditor.plugins.craftercms_paste_extension?.paste_preprocess(plugin, args);
    },
    paste_postprocess(plugin, args) {
      window.tinymce.activeEditor.plugins.craftercms_paste_extension?.paste_postprocess(plugin, args);
    },
    toolbar: type === 'html',
    menubar: false,
    inline: true,
    base_url: '/studio/static-assets/libs/tinymce',
    suffix: '.min',
    external_plugins: external,
    code_editor_inline: false,
    skin: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oxide-dark' : 'oxide',
    media_live_embeds: true,
    file_picker_types: 'image media',
    craftercms_paste_cleanup: rteSetup?.tinymceOptions?.craftercms_paste_cleanup ?? true, // If doesn't exist or if true => true
    file_picker_callback: function (cb, value, meta) {
      // meta contains info about type (image, media, etc). Used to properly add DS to dialogs.
      // meta.filetype === 'file | image | media'
      const datasources = {};
      Object.values(field.validations).forEach((validation) => {
        if (
          [
            'allowImageUpload',
            'allowImagesFromRepo',
            'allowVideoUpload',
            'allowVideosFromRepo',
            'allowAudioUpload',
            'allowAudioFromRepo',
            'allowFilesFromRepo'
          ].includes(validation.id)
        ) {
          datasources[validation.id] = validation;
        }
      });
      const browseBtn = document.querySelector('.tox-dialog .tox-browse-url');

      post(
        showRtePickerActions({
          datasources,
          model,
          type: meta.filetype,
          rect: browseBtn.getBoundingClientRect()
        })
      );

      message$
        .pipe(
          filter((e) => e.type === rtePickerActionResult.type),
          take(1)
        )
        .subscribe(({ payload }) => {
          if (payload) {
            // For selections of pages or components from the 'Insert link' dialog, use the preview URL (the actual page or component link)
            // instead of the repoURL returned by the browse dialog.
            const path = meta.filetype === 'file' ? getPreviewURLFromPath(payload.path) : payload.path;
            cb(path, { alt: payload.name });
          }
        });
    },
    setup(editor: Editor) {
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
        return editor.getContent({ format: type === 'html' ? 'html' : 'text' });
      }

      function getSelectionContent() {
        return editor.selection.getContent({ format: type === 'html' ? 'html' : 'text' });
      }

      function destroyEditor() {
        editor.destroy(false);
      }

      function cancel({ saved }: { saved: boolean }) {
        const finalContent = saved ? getContent() : originalRawContent;

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
        } else if (type === 'html') {
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
        const maxLength = validations?.maxLength ? parseInt(validations.maxLength.value) : null;
        const text = (
          e.clipboardData ||
          // @ts-ignore
          window.clipboardData
        ).getData('text');
        if (maxLength && text.length > maxLength) {
          post(
            snackGuestMessage({
              id: 'maxLength',
              level: 'required',
              values: { maxLength: text.length === maxLength ? text.length : `${text.length}/${maxLength}` }
            })
          );
        }
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
        // TODO: It'd be great to be able to select the piece of the pasted content that falls out of the max-length.
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
        } else if (e.key === 'Enter' && type !== 'html' && type !== 'textarea') {
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
    ...(rteSetup?.tinymceOptions && {
      ...reversePluckProps(
        // Tiny seems to somehow mutate the options object which would cause crashes when attempting
        // to mutate immutable object (possibly from redux). Also, we don't want the state to get mutated.
        JSON.parse(JSON.stringify(rteSetup.tinymceOptions)),
        'target', // Target can't be changed
        'inline', // Not using inline view doesn't behave well on pageBuilder, this setting shouldn't be changed.
        'setup',
        'base_url',
        'encoding',
        'autosave_ask_before_unload', // Auto-save options are removed since it is not supported in control.
        'autosave_interval',
        'autosave_prefix',
        'autosave_restore_when_empty',
        'autosave_retention',
        'file_picker_callback', // No file picker is set by default, and functions are not supported in config file.
        'height', // Height is set to the size of content
        'file_picker_callback', // Files/images handlers currently not supported
        'paste_postprocess',
        'images_upload_handler',
        'code_editor_inline',
        'plugins', // Considered/used above, mixed with our options
        'external_plugins' // Considered/used above, mixed with our options
      )
    }),
    ...controlProps,
    openEditForm
  });

  return dispatch$.pipe(startWith({ type: editComponentInline.type }));
}
