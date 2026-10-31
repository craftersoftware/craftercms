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

CStudioAdminConsole.Tool.ContentTypes.PropertyType.RichText =
	CStudioAdminConsole.Tool.ContentTypes.PropertyType.RichText ||
	function (fieldName, containerEl) {
		this.fieldName = fieldName;
		this.containerEl = containerEl;
		return this;
	};

YAHOO.extend(
	CStudioAdminConsole.Tool.ContentTypes.PropertyType.RichText,
	CStudioAdminConsole.Tool.ContentTypes.PropertyType,
	{
		render: function (value, updateFn) {
			this.value = value;
			this.updateFn = updateFn;
			var containerEl = this.containerEl;
			var valueEl = document.createElement('input');
			YAHOO.util.Dom.addClass(valueEl, 'content-type-property-sheet-property-value');
			YDom.setStyle(valueEl, 'font-style', 'italic');
			containerEl.appendChild(valueEl);
			valueEl.value = this.valueToString(value);
			valueEl.context = this;
			valueEl.fieldName = this.fieldName;
			// don't let the user type anything
			YAHOO.util.Event.on(
				valueEl,
				'keydown',
				function (evt) {
					YAHOO.util.Event.stopEvent(evt);
				},
				valueEl
			);
			YAHOO.util.Event.on(valueEl, 'focus', this.showEdit, this);
			this.valueEl = valueEl;
		},

		getValue: function () {
			return this.value;
		},

		valueToString: function (value) {
			var strValue = '';

			if (!Array.isArray(value) && value !== '') {
				strValue = CMgs.format(langBundle, 'editMessage') + '...';
			} else {
				strValue = CMgs.format(langBundle, 'setMessage') + '...';
			}

			return strValue;
		},

		showEdit: function () {
			var _self = this;
			var richTextDialogEl = document.getElementById('richTextDialog');
			if (!richTextDialogEl) {
				var maskEl = document.createElement('div');
				maskEl.id = 'keyValueDialogMask';
				maskEl.style.display = 'block';
				richTextDialogEl = document.createElement('div');
				richTextDialogEl.id = 'richTextDialog';
				YAHOO.util.Dom.addClass(richTextDialogEl, 'rich-text-dialog');
				YAHOO.util.Dom.addClass(richTextDialogEl, 'seethrough');

				document.body.appendChild(maskEl);
				document.body.appendChild(richTextDialogEl);

				richTextDialogEl.value = '';
				richTextDialogEl.value = _self.context.value;
			}

			richTextDialogEl.style.display = 'block';
			richTextDialogEl.innerHTML = '';

			var titleEl = document.createElement('div');
			YAHOO.util.Dom.addClass(titleEl, 'property-dialog-title');
			titleEl.innerHTML = CMgs.format(formsLangBundle, 'adminHelpDialogTitle');
			richTextDialogEl.appendChild(titleEl);

			var richTextDialogContainerEl = document.createElement('div');
			richTextDialogContainerEl.id = 'richTextBodyDialog';
			YAHOO.util.Dom.addClass(richTextDialogContainerEl, 'property-dialog-body-container');
			richTextDialogEl.appendChild(richTextDialogContainerEl);

			this.context.renderText();

			var buttonContainerEl = document.createElement('div');
			YAHOO.util.Dom.addClass(buttonContainerEl, 'property-dialog-button-container');
			richTextDialogEl.appendChild(buttonContainerEl);

			var cancelEl = document.createElement('div');
			cancelEl.style.marginRight = '6px';
			YAHOO.util.Dom.addClass(cancelEl, 'btn btn-default');
			cancelEl.innerHTML = CMgs.format(formsLangBundle, 'cancel');
			buttonContainerEl.appendChild(cancelEl);

			YAHOO.util.Event.on(
				cancelEl,
				'click',
				function (evt) {
					_self.context.cancel();
				},
				cancelEl
			);

			var saveEl = document.createElement('div');
			saveEl.style.marginRight = '16px';
			YAHOO.util.Dom.addClass(saveEl, 'btn btn-primary');
			saveEl.innerHTML = CMgs.format(formsLangBundle, 'save');
			buttonContainerEl.appendChild(saveEl);
			YAHOO.util.Event.on(
				saveEl,
				'click',
				function (evt) {
					_self.context.save();
				},
				saveEl
			);
		},

		renderText: function () {
			// TODO: Add rte control
			var richTextDialogEl = document.getElementById('richTextDialog');
			var dialogContainerEl = document.getElementById('richTextBodyDialog');
			YDom.setStyle(dialogContainerEl, 'text-align', 'center');

			var rteContainerEl = document.createElement('div');
			rteContainerEl.id = 'richTextDialogRteContainer';
			dialogContainerEl.appendChild(rteContainerEl);
			YDom.addClass(rteContainerEl, 'text-mode');
			YDom.addClass(rteContainerEl, 'rte-active');
			YDom.setStyle(rteContainerEl, 'text-align', 'center');
			YDom.setStyle(rteContainerEl, 'display', 'inline-block');
			YDom.setStyle(rteContainerEl, 'width', '90%');

			var _self = this;
			var rteUniqueInitClass = CStudioAuthoring.Utils.generateUUID();
			var value = richTextDialogEl.value;
			var inputEl = document.createElement('textarea');
			rteContainerEl.appendChild(inputEl);
			YDom.addClass(inputEl, rteUniqueInitClass);
			YDom.addClass(inputEl, 'cstudio-form-control-input');
			richTextDialogEl.inputEl = inputEl;

			tinymce.init({
				target: inputEl,
				promotion: false,
				branding: false,
				deprecation_warnings: false,
				height: 400,
				encoding: 'xml',
				force_p_newlines: true,
				force_br_newlines: false,
				forced_root_block: false,
				resize: false,
				plugins: ['lists'],
				toolbar1:
					'formatselect | bold italic strikethrough forecolor backcolor | link | alignleft aligncenter alignright alignjustify | numlist bullist outdent indent | removeformat',
				valid_elements: 'ul,ol,li,img[src,style,class],p,br,strong/b,a[href|target=_blank],em,s,h1,h2,h3,h4,h5,h6,pre',
				setup: function (editor) {
					// Loaded by templates/web/legacy-site-config.ftl before this module runs.
					window.craftercmsEditorKeyboard?.installTinyMceKeyboard(editor);
					editor.on('init', function (e) {
						_self.editor = editor;
						editor.setContent(value);
					});
				}
			});
		},

		cancel: function () {
			var richTextDialogEl = document.getElementById('richTextDialog');
			var keyValueDialogMaskEl = document.getElementById('keyValueDialogMask');
			richTextDialogEl.parentNode.removeChild(keyValueDialogMaskEl);
			richTextDialogEl.parentNode.removeChild(richTextDialogEl);
		},

		save: function () {
			var richTextDialogEl = document.getElementById('richTextDialog');
			var keyValueDialogMaskEl = document.getElementById('keyValueDialogMask');
			if (this.editor) {
				richTextDialogEl.value = this.editor.getContent();
			}
			this.value = richTextDialogEl.value;
			this.valueEl.value = this.valueToString(this.value);
			richTextDialogEl.parentNode.removeChild(keyValueDialogMaskEl);
			richTextDialogEl.parentNode.removeChild(richTextDialogEl);
			this.updateFn(null, { fieldName: this.fieldName, value: this.value });
		}
	}
);

CStudioAuthoring.Module.moduleLoaded(
	'cstudio-console-tools-content-types-proptype-richText',
	CStudioAdminConsole.Tool.ContentTypes.PropertyType.RichText
);
