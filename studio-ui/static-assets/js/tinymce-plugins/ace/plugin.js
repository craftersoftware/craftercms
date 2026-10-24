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

(function () {
	const PLUGIN_NAME = 'acecode';

	tinymce.addI18n('en', {
		'code-editor': 'Code Editor',
		'toggle-code-view': 'Toggle code view mode',
		fullscreen: 'Fullscreen',
		'exit-fullscreen': 'Exit fullscreen',
		'code-editor-name': 'Code editor',
		'code-editor-instructions':
			'Press Esc then Tab to leave the editor. Press Enter to edit. Tab indents while editing.',
		'code-editor-instructions-readonly': 'Press Esc then Tab to leave the editor. Press Enter to move into the editor.',
		'code-editor-gutter': 'Editor gutter. Press Enter to use the controls. Press Esc to leave the gutter.'
	});
	tinymce.addI18n('es', {
		'code-editor': 'Editor de Código',
		'toggle-code-view': 'Alternar el modo de vista de código',
		fullscreen: 'Pantalla completa',
		'exit-fullscreen': 'Salir de pantalla completa',
		'code-editor-name': 'Editor de código',
		'code-editor-instructions':
			'Pulse Esc y después Tab para salir del editor. Pulse Enter para editar. Tab sangra mientras edita.',
		'code-editor-instructions-readonly':
			'Pulse Esc y después Tab para salir del editor. Pulse Enter para entrar en el editor.',
		'code-editor-gutter': 'Margen del editor. Pulse Enter para usar los controles. Pulse Esc para salir del margen.'
	});
	tinymce.addI18n('de', {
		'code-editor': 'Code-Editor',
		'toggle-code-view': 'Codeansichtsmodus umschalten',
		fullscreen: 'Vollbild',
		'exit-fullscreen': 'Vollbildmodus beenden',
		'code-editor-name': 'Code-Editor',
		'code-editor-instructions':
			'Drücken Sie Esc und dann Tab, um den Editor zu verlassen. Drücken Sie die Eingabetaste zum Bearbeiten. Tab rückt beim Bearbeiten ein.',
		'code-editor-instructions-readonly':
			'Drücken Sie Esc und dann Tab, um den Editor zu verlassen. Drücken Sie die Eingabetaste, um in den Editor zu wechseln.',
		'code-editor-gutter':
			'Editor-Randleiste. Drücken Sie die Eingabetaste, um die Steuerelemente zu verwenden. Drücken Sie Esc, um die Randleiste zu verlassen.'
	});
	tinymce.addI18n('ko_KR', {
		'code-editor': '코드 편집기',
		'toggle-code-view': '코드 보기 모드 전환',
		fullscreen: '전체 화면',
		'exit-fullscreen': '전체 화면 종료',
		'code-editor-name': '코드 편집기',
		'code-editor-instructions':
			'편집기를 나가려면 Esc를 누른 다음 Tab을 누르세요. 편집하려면 Enter를 누르세요. 편집 중 Tab은 들여쓰기입니다.',
		'code-editor-instructions-readonly':
			'편집기를 나가려면 Esc를 누른 다음 Tab을 누르세요. 편집기로 들어가려면 Enter를 누르세요.',
		'code-editor-gutter': '편집기 여백입니다. 컨트롤을 사용하려면 Enter를 누르세요. 여백을 나가려면 Esc를 누르세요.'
	});

	// Keep in sync with studio-ui/ui/app/src/components/editorKeyboard/aceKeyboard.ts.
	// This plugin is loaded as a classic script and cannot import that module.
	const ACE_HINT_CLASS = 'craftercms-code-editor-hint';
	const ACE_HINT_STYLE_ID = 'craftercms-code-editor-hint-styles';
	let aceHintSequence = 0;
	// Specificity beats `.tox-dialog .ace_editor * { font: ... !important }`.
	const ACE_HINT_CSS = `
.ace_editor > .${ACE_HINT_CLASS},
.tox-dialog .ace_editor > .${ACE_HINT_CLASS},
.acecode-inline .ace_editor > .${ACE_HINT_CLASS} {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 6;
	box-sizing: border-box;
	margin: 0;
	padding: 4px 8px;
	pointer-events: none;
	font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important;
	font-size: 12px !important;
	font-weight: 400 !important;
	line-height: 20px !important;
	white-space: normal !important;
	background: #f4f4f5;
	color: #333;
	border-top: 1px solid #d0d0d0;
}
.ace_editor.ace_dark > .${ACE_HINT_CLASS},
.ace_editor.ace-tomorrow-night > .${ACE_HINT_CLASS},
.ace_editor.ace-nord-dark > .${ACE_HINT_CLASS} {
	background: #252526;
	color: #e6e6e6;
	border-top-color: #3c3c3c;
}
`;

	function pinAceHintInset(renderer, hintHeight) {
		const bar = renderer.scrollBarH && renderer.scrollBarH.getHeight ? renderer.scrollBarH.getHeight() : 0;
		const bottom = hintHeight + bar + 'px';
		if (renderer.scroller) {
			renderer.scroller.style.bottom = bottom;
		}
		if (renderer.$gutter) {
			renderer.$gutter.style.bottom = hintHeight + 'px';
		}
		if (renderer.scrollBarH && renderer.scrollBarH.element) {
			renderer.scrollBarH.element.style.bottom = hintHeight + 'px';
		}
		if (renderer.scrollBarV && renderer.scrollBarV.element) {
			renderer.scrollBarV.element.style.bottom = bottom;
		}
	}

	function syncAceHintInset(aceEditor, hint) {
		const renderer = aceEditor.renderer;
		if (!renderer) {
			return;
		}
		const hintHeight = Math.ceil(hint.getBoundingClientRect().height);
		if (!hintHeight) {
			return;
		}
		if (renderer.$extraHeight !== hintHeight) {
			renderer.$extraHeight = hintHeight;
			if (typeof aceEditor.resize === 'function') {
				aceEditor.resize(true);
			}
		}
		pinAceHintInset(renderer, hintHeight);
	}

	function applyAceKeyboardAccessibility(aceEditor, translate) {
		if (!aceEditor) {
			return;
		}
		const readOnly = aceEditor.getOption('readOnly') === true;
		const editorName = translate('code-editor-name');
		const instructions = translate(readOnly ? 'code-editor-instructions-readonly' : 'code-editor-instructions');
		const gutterLabel = translate('code-editor-gutter');
		const scroller = aceEditor.renderer && aceEditor.renderer.scroller;
		const gutter = aceEditor.renderer && aceEditor.renderer.$gutter;
		const container = aceEditor.container;
		let keyboardMode = false;
		try {
			aceEditor.setOption('textInputAriaLabel', editorName);
			keyboardMode = aceEditor.getOption('enableKeyboardAccessibility') === true;
			if (!keyboardMode) {
				aceEditor.setOption('enableKeyboardAccessibility', true);
				keyboardMode = aceEditor.getOption('enableKeyboardAccessibility') === true;
			}
		} catch (e) {
			keyboardMode = false;
		}
		if (!keyboardMode && !aceEditor.__craftercmsLegacyExit) {
			aceEditor.__craftercmsLegacyExit = true;
			const textInput = aceEditor.textInput && aceEditor.textInput.getElement();
			if (textInput) {
				textInput.tabIndex = -1;
			}
			if (scroller) {
				scroller.tabIndex = 0;
				scroller.setAttribute('role', 'group');
				scroller.addEventListener('keyup', (event) => {
					if (event.key === 'Enter') {
						aceEditor.focus();
					}
				});
			}
			aceEditor.commands.addCommand({
				name: 'crafterExitEditor',
				bindKey: { win: 'Esc', mac: 'Esc' },
				readOnly: true,
				exec(ed) {
					ed.blur();
					if (scroller) {
						scroller.focus();
					}
				}
			});
		}
		if (scroller) {
			scroller.setAttribute('aria-label', editorName);
		}
		if (gutter) {
			gutter.setAttribute('aria-label', gutterLabel);
		}
		const textInput = aceEditor.textInput && aceEditor.textInput.getElement();
		if (textInput) {
			textInput.setAttribute('aria-label', editorName);
		}
		if (aceEditor.renderer && aceEditor.renderer.setScrollMargin) {
			aceEditor.renderer.setScrollMargin(0, 0, 0, 0);
		}
		if (!container) {
			return;
		}
		const doc = container.ownerDocument;
		if (!doc.getElementById(ACE_HINT_STYLE_ID)) {
			const style = doc.createElement('style');
			style.id = ACE_HINT_STYLE_ID;
			style.textContent = ACE_HINT_CSS;
			(doc.head || doc.documentElement).appendChild(style);
		}
		let hint = container.querySelector(':scope > .' + ACE_HINT_CLASS);
		if (!hint) {
			hint = doc.createElement('div');
			hint.className = ACE_HINT_CLASS;
			hint.id = ACE_HINT_CLASS + '-' + ++aceHintSequence;
			container.appendChild(hint);
		}
		hint.textContent = instructions;
		hint.removeAttribute('title');
		hint.removeAttribute('aria-hidden');
		if (scroller) {
			scroller.setAttribute('aria-describedby', hint.id);
		}
		if (textInput) {
			textInput.setAttribute('aria-describedby', hint.id);
		}
		if (!container.dataset.craftercmsEsc) {
			container.dataset.craftercmsEsc = 'true';
			let escFromEditor = false;
			container.addEventListener(
				'keydown',
				(event) => {
					if (event.key === 'Escape' && event.target !== scroller) {
						escFromEditor = true;
					}
				},
				true
			);
			container.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' && event.target !== scroller) {
					event.stopPropagation();
				}
			});
			container.addEventListener('keyup', (event) => {
				if (event.key === 'Escape' && escFromEditor) {
					escFromEditor = false;
					event.stopPropagation();
				}
			});
		}
		if (!container.dataset.craftercmsHintInset) {
			container.dataset.craftercmsHintInset = 'true';
			if (aceEditor.renderer && aceEditor.renderer.on) {
				aceEditor.renderer.on('resize', () => {
					const current = container.querySelector(':scope > .' + ACE_HINT_CLASS);
					if (current) {
						pinAceHintInset(aceEditor.renderer, Math.ceil(current.getBoundingClientRect().height));
					}
				});
			}
			if (typeof ResizeObserver !== 'undefined') {
				const observer = new ResizeObserver(() => syncAceHintInset(aceEditor, hint));
				observer.observe(hint);
			}
		}
		syncAceHintInset(aceEditor, hint);
	}

	tinymce.PluginManager.add(PLUGIN_NAME, function (editor, url) {
		const aceModes = {
			inline: null,
			fullscreen: null
		};
		const aceConfig = {
			theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'ace/theme/nord_dark' : 'ace/theme/eclipse',
			mode: 'ace/mode/html',
			options: {
				wrap: editor.getParam('code_editor_wrap'),
				displayIndentGuides: true,
				showPrintMargin: false
			}
		};
		const inlineMode = editor.getParam('code_editor_inline');
		const icons = {
			sourceCode:
				'<svg width="24" height="24" style="fill: rgb(34, 47, 62);"><g fill-rule="nonzero"><path d="M9.8 15.7c.3.3.3.8 0 1-.3.4-.9.4-1.2 0l-4.4-4.1a.8.8 0 010-1.2l4.4-4.2c.3-.3.9-.3 1.2 0 .3.3.3.8 0 1.1L6 12l3.8 3.7zM14.2 15.7c-.3.3-.3.8 0 1 .4.4.9.4 1.2 0l4.4-4.1c.3-.3.3-.9 0-1.2l-4.4-4.2a.8.8 0 00-1.2 0c-.3.3-.3.8 0 1.1L18 12l-3.8 3.7z"></path></g></svg>',
			resize:
				'<svg width="20px" height="20px" viewBox="0 0 25 25"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><path d="M4,5 C4,4.71874859 4.0963532,4.4817718 4.2890625,4.2890625 C4.4817718,4.0963532 4.71874859,4 5,4 L11,4 C11.2812514,4 11.5182282,4.0963532 11.7109375,4.2890625 C11.9036468,4.4817718 12,4.71874859 12,5 C12,5.28125141 11.9036468,5.5182282 11.7109375,5.7109375 C11.5182282,5.9036468 11.2812514,6 11,6 L7.421875,6 L18,16.578125 L18,13 C18,12.7187486 18.0963532,12.4817718 18.2890625,12.2890625 C18.4817718,12.0963532 18.7187486,12 19,12 C19.2812514,12 19.5182282,12.0963532 19.7109375,12.2890625 C19.9036468,12.4817718 20,12.7187486 20,13 L20,19 C20,19.2812514 19.9036468,19.5182282 19.7109375,19.7109375 C19.5182282,19.9036468 19.2812514,20 19,20 L13,20 C12.7187486,20 12.4817718,19.9036468 12.2890625,19.7109375 C12.0963532,19.5182282 12,19.2812514 12,19 C12,18.7187486 12.0963532,18.4817718 12.2890625,18.2890625 C12.4817718,18.0963532 12.7187486,18 13,18 L16.578125,18 L6,7.421875 L6,11 C6,11.2812514 5.9036468,11.5182282 5.7109375,11.7109375 C5.5182282,11.9036468 5.28125141,12 5,12 C4.71874859,12 4.4817718,11.9036468 4.2890625,11.7109375 C4.0963532,11.5182282 4,11.2812514 4,11 L4,5 Z" fill="#000000"/></g></svg>'
		};

		const onAction = (context, editor) => {
			const isFullscreen = editor.plugins.fullscreen.isFullscreen();
			if (isFullscreen || !inlineMode) {
				showDialog(editor, isFullscreen);
			} else {
				toggleCode(context, editor);
			}
		};

		let isActive = true;
		editor.ui.registry.addButton(PLUGIN_NAME, {
			icon: 'sourcecode',
			tooltip: editor.translate('toggle-code-view'),
			onAction: function () {
				onAction(this, editor);
			}
		});
		editor.ui.registry.addMenuItem(PLUGIN_NAME, {
			icon: 'sourcecode',
			text: editor.translate('code-editor'),
			onAction: function () {
				onAction(this, editor);
			}
		});

		const getContent = (editor) => {
			return editor.getContent({ source_view: true });
		};

		document.querySelector(`#${CSS.escape(editor.id)}`).addEventListener('change', () => {
			editor.setContent($(this).val());
		});

		const toggleCode = (elem, editor) => {
			isActive = !isActive;
			const aceID = 'ace-editor-' + editor.id;

			const editorTextareaEl = document.querySelector(`#${CSS.escape(editor.id)}`);

			if (!isActive) {
				// Code mode
				editor.mode.set('readonly');
				editorTextareaEl.value = getContent(editor);
				editorTextareaEl.style.height = editor.getDoc().documentElement.scrollHeight;

				if (typeof ace !== 'undefined') {
					editorTextareaEl.classList.add('hidden');

					const aceContainer = document.createElement('div');
					aceContainer.id = `${aceID}-inline-container`;
					aceContainer.className = 'acecode-inline';
					aceContainer.innerHTML =
						`<div class="inline-container-header">` +
						`<button id="${aceID}-toggleCode" class="acecode-inline-btn toggle" ` +
						`  title="${editor.translate('toggle-code-view')}" type="button" tabIndex="-1" ` +
						'>' +
						icons.sourceCode +
						'</button>' +
						`<button id="${aceID}-fullscreenMode" class="acecode-inline-btn fullscreen"` +
						`  title="${editor.translate('fullscreen')}" type="button" tabIndex="-1"` +
						'>' +
						icons.resize +
						'</button></div>' +
						`<div id="${aceID}"></div>`;

					editorTextareaEl.parentElement.insertBefore(aceContainer, editor.container);

					document.querySelector(`#${CSS.escape(aceID)}-toggleCode`).addEventListener('click', () => {
						toggleCode(elem, editor);
					});

					document.querySelector(`#${CSS.escape(aceID)}-fullscreenMode`).addEventListener('click', () => {
						showDialog(editor);
					});

					const aceEditor = ace.edit(aceID);
					aceModes.inline = aceEditor;

					aceEditor.$blockScrolling = 'Infinity';
					aceEditor.setTheme(aceConfig.theme);
					aceEditor.session.setMode(aceConfig.mode);
					aceEditor.setValue(editorTextareaEl.value, 1);
					aceEditor.setOptions({
						...aceConfig.options,
						minLines: Math.round(300 / 17),
						maxLines: Math.round(300 / 17)
					});
					aceEditor.on('change', function () {
						let value = aceEditor.getValue();
						editorTextareaEl.value = value;
						editor.setContent(value);
						editor.dispatch('external_change');
					});
					applyAceKeyboardAccessibility(aceEditor, (key) => editor.translate(key));

					editor.container.classList.add('hidden');
				}
			} else {
				// Editor mode
				editor.mode.set('design');
				editorTextareaEl.classList.add('hidden');
				if (typeof ace !== 'undefined') {
					const aceEditor = ace.edit(aceID);
					aceEditor.destroy();

					const aceContainer = document.querySelector(`#${aceID}-inline-container`);
					aceContainer.parentElement.removeChild(aceContainer);
				}

				editor.container.classList.remove('hidden');
			}
		};

		const showDialog = function (editor, fullscreenMode) {
			editor.windowManager.open({
				title: editor.translate('code-editor'),
				size: 'large',
				body: {
					type: 'panel',
					items: [
						{
							type: 'htmlpanel',
							html: '<div id="mce-ace-editor-block"></div>',
							name: 'code'
						}
					]
				},
				buttons: []
			});

			const dialog = document.getElementsByClassName('tox-dialog--width-lg')[0];

			const dialogCloseIcon = dialog.querySelector('.tox-dialog__header button');

			// Inline mode is the one used in forms (when on ICE inlineMode is set to false to always use modal)
			if (inlineMode) {
				if (fullscreenMode) {
					dialogCloseIcon.setAttribute('title', editor.translate('toggle-code-view'));
					dialogCloseIcon.querySelector('.tox-icon').innerHTML = icons.sourceCode;
				} else {
					dialogCloseIcon.setAttribute('title', editor.translate('exit-fullscreen'));
					dialogCloseIcon.querySelector('.tox-icon').innerHTML = icons.resize;
				}
			}
			// Fullscreen only when TinyMCE is fullscreen, or when expanding from inline code view.
			// FE2 uses dialog mode (`code_editor_inline: false`) and should keep TinyMCE's large dialog.
			if (fullscreenMode || inlineMode) {
				dialog.classList.add('fullscreen');
			}
			dialog.classList.add('acecode');
			const aceEditor = ace.edit('mce-ace-editor-block');
			aceModes.fullscreen = aceEditor;
			aceEditor.setTheme(aceConfig.theme);
			aceEditor.getSession().setMode(aceConfig.mode);
			aceEditor.setOptions(aceConfig.options);
			aceEditor.getSession().setValue(getContent(editor));
			applyAceKeyboardAccessibility(aceEditor, (key) => editor.translate(key));

			const editorTextareaEl = document.querySelector(`#${CSS.escape(editor.id)}`);
			aceEditor.on('change', function () {
				let value = aceEditor.getValue();
				editorTextareaEl.value = value;
				editor.setContent(value);

				if (inlineMode) {
					aceModes.inline.getSession().setValue(aceEditor.getValue());
				}
			});
		};
	});
})();
