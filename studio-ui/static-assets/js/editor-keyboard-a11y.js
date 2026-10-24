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

/**
 * Legacy-forms TinyMCE keyboard helper. Loaded by templates/web/form.ftl and
 * called from cstudio-forms/controls/rte.js.
 *
 * Keep in sync with studio-ui/ui/app/src/components/editorKeyboard/tinyMceKeyboard.ts
 * and the fallback in content-type-propsheet/richText.js.
 * Does not change iframe or body tabindex (that blocked typing in Chrome).
 */
(function () {
	var STYLE_ID = 'craftercms-tinymce-target-size';
	var MENUBAR_SELECTOR = '.tox-menubar';
	var TOOLBAR_SELECTOR = '.tox-toolbar, .tox-toolbar-overlord, .tox-toolbar__overflow';
	var TARGET_SIZE_CSS =
		'.tox .tox-split-button__chevron,' +
		'.tox.tox-platform-touch .tox-split-button__chevron,' +
		'.tox .tox-tbtn__select-chevron,' +
		'.tox .tox-listbox__select-chevron{' +
		'width:24px !important;min-width:24px !important;}';

	function ensureTinyMceTargetSizeStyles(doc) {
		if (!doc || doc.getElementById(STYLE_ID)) {
			return;
		}
		var style = doc.createElement('style');
		style.id = STYLE_ID;
		style.textContent = TARGET_SIZE_CSS;
		(doc.head || doc.documentElement).appendChild(style);
	}

	function isIn(target, selector) {
		return target && target.closest && target.closest(selector);
	}

	function installTinyMceKeyboard(editor) {
		if (!editor || editor.__craftercmsKeyboardInstalled) {
			return;
		}
		editor.__craftercmsKeyboardInstalled = true;
		var element = editor.getElement && editor.getElement();
		ensureTinyMceTargetSizeStyles((element && element.ownerDocument) || document);

		var roots = [];
		function onChromeKey(event) {
			if (event.key !== 'Escape') {
				return;
			}
			var body = editor.getBody && editor.getBody();
			var target = event.target;
			if (body && (target === body || (body.contains && body.contains(target)))) {
				return;
			}
			var inMenubar = isIn(target, MENUBAR_SELECTOR);
			var inToolbar = isIn(target, TOOLBAR_SELECTOR);
			if (!inMenubar && !inToolbar) {
				return;
			}
			if (event.type === 'keydown' && inToolbar && !inMenubar) {
				editor.focus();
			}
			event.stopPropagation();
		}

		function addRoot(root) {
			if (!root || roots.indexOf(root) !== -1) {
				return;
			}
			roots.push(root);
			root.addEventListener('keydown', onChromeKey);
			root.addEventListener('keyup', onChromeKey);
		}

		function onInit() {
			addRoot(editor.getContainer && editor.getContainer());
			addRoot(editor.editorContainer);
		}

		function onRemove() {
			roots.forEach(function (root) {
				root.removeEventListener('keydown', onChromeKey);
				root.removeEventListener('keyup', onChromeKey);
			});
			roots = [];
		}

		editor.on('init', onInit);
		editor.on('remove', onRemove);
	}

	window.craftercmsEditorKeyboard = window.craftercmsEditorKeyboard || {};
	window.craftercmsEditorKeyboard.installTinyMceKeyboard = installTinyMceKeyboard;
})();
