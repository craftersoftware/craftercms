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

(function () {
	const i18n = CrafterCMSNext.i18n,
		formatMessage = i18n.intl.formatMessage,
		contentTypesMessages = i18n.messages.contentTypesMessages,
		words = i18n.messages.words,
		defaultFields = ['file-name', 'internal-name', 'placeInNav', 'navLabel'];

	const WORK_AREA_HTML = '<div id="content-type-canvas"></div><div id="content-type-tools"></div>';

	CStudioAdminConsole.isDirty = false;
	CStudioAdminConsole.contentTypeSelected = '';
	CStudioAdminConsole.isPostfixAvailable = false;

	window.addEventListener('beforeunload', function (e) {
		confirmationMessage = 'If you leave before saving, your changes will be lost.';

		if (!CStudioAdminConsole.isDirty) {
			return undefined;
		}

		(e || window.event).returnValue = confirmationMessage; // Gecko + IE
		return confirmationMessage; // Gecko + Webkit, Safari, Chrome etc.
	});

	const onSetDirty = (value) => {
		CStudioAdminConsole.isDirty = value;

		// Update close/cancel button, when dirty => cancel, when not dirty => close
		const cancelBtn = document.getElementById('contentTypeEditorCancelBtn');
		if (cancelBtn) {
			cancelBtn.value = CMgs.format(langBundle, value ? 'cancel' : 'close');
		}

		window.top.postMessage(
			{
				type: 'CONTENT_TYPES_ON_SUBMITTING_OR_PENDING_CHANGES_MESSAGE',
				payload: { hasPendingChanges: value }
			},
			'*'
		);
	};

	function moduleLoaded() {
		CStudioAdminConsole.Tool.ContentTypes = function (config, el) {
			this.containerEl = el;
			this.config = config;
			this.types = [];
			return this;
		};

		getPostfixData();

		/**
		 * Overarching class that drives the content type tools
		 */
		YAHOO.extend(CStudioAdminConsole.Tool.ContentTypes, CStudioAdminConsole.Tool, {
			renderWorkarea: function () {
				getPostfixData();

				var workareaEl = document.getElementById('cstudio-admin-console-workarea');

				workareaEl.innerHTML = `
          <section class="site-config-landing-page">
            <header>
              <button id="createNewContentTypeButton" class="btn btn-outlined btn-outlined-primary">
                <i class="fa fa-plus-circle"></i>
                <span class="ng-binding">${CMgs.format(langBundle, 'createNewType')}</span>
              </button>
            </header>
            <div id="openExistingInlineTarget"></div>
          </section>
        `;

				this.onOpenExistingClick(true);

				$('#createNewContentTypeButton').click(() => {
					this.onNewClick();
				});
			},

			componentsValidation: function (formDef) {
				var sections = formDef.sections,
					datasources = formDef.datasources,
					idError = [],
					datasourceIdError = [],
					flagTitleError = false,
					currentField,
					postfixError = [],
					postfixes,
					postfixesFlag = false,
					fileNameError = true,
					internalNameError = true;

				for (var i = 0; i < sections.length; i++) {
					for (var j = 0; j < sections[i].fields.length; j++) {
						currentField = sections[i].fields[j];
						postfixesFlag = false;

						if (!currentField.title || currentField.title == '') {
							flagTitleError = true;
						}
						if ((!currentField.id || currentField.id == '') && currentField.title && currentField.title != '') {
							idError.push(currentField.title);
						}

						if (
							(currentField.id || currentField.id !== '') &&
							currentField.title &&
							currentField.title !== '' &&
							!CStudioAdminConsole.ignorePostfixFields.includes(currentField.id)
						) {
							const type = currentField.type,
								controls = this.config.controls.control,
								postfixes = CStudioAdminConsole.getPostfixes(type, controls);

							if (postfixes) {
								for (var k = 0; k < postfixes.length; k++) {
									if (currentField.id.indexOf(postfixes[k]) > -1) {
										postfixesFlag = true;
										break;
									}
								}
								if (!postfixesFlag && postfixes.length > 0) {
									postfixError.push({ title: currentField.title, type: currentField.type });
								}
							}
						}

						// If it's a repeating group, validate fields - We have no nested repeating groups,
						// so it's only 1 level
						if (currentField.type === 'repeat' && currentField.fields.length > 0) {
							var currentSubField;
							for (var x = 0; x < currentField.fields.length; x++) {
								currentSubField = currentField.fields[x];
								if (!currentSubField.title || currentSubField.title == '') {
									flagTitleError = true;
								}
								if (
									(!currentSubField.id || currentSubField.id == '') &&
									currentSubField.title &&
									currentSubField.title != ''
								) {
									idError.push(currentSubField.title);
								}
							}
						}

						if (currentField.type === 'file-name' || currentField.type === 'auto-filename') {
							fileNameError = false;
						}

						if (currentField.id === 'internal-name' || formDef.contentType === '/component/level-descriptor') {
							internalNameError = false;
						}
					}
				}

				for (var i = 0; i < datasources.length; i++) {
					if (!datasources[i].title || datasources[i].title == '') {
						flagTitleError = true;
					}
					if ((!datasources[i].id || datasources[i].id == '') && datasources[i].title && datasources[i].title != '') {
						datasourceIdError.push(datasources[i].title);
					}
				}

				return {
					flagTitleError,
					idError,
					datasourceIdError,
					postfixError,
					fileNameError,
					internalNameError
				};
			},

			templateValidation: function (formDef) {
				var properties = formDef.properties,
					flagTemplateError = false;

				for (var i = 0; i < properties.length; i++) {
					if (properties[i].name == 'display-template' && properties[i].value !== '') {
						flagTemplateError = true;
					}
					// if no-template-required property exists and has value "true"
					if (properties[i].name == 'no-template-required' && properties[i].value === 'true') {
						flagTemplateError = true;
					}
				}

				return { flagTemplateError };
			},

			closeEditor: function () {
				onSetDirty(false);
				this.renderWorkarea();
				CStudioAdminConsole.CommandBar.hide();
			},

			updateFormDefProp: function (propName, value, reloadPropExplorer) {
				const typeProps = CStudioAdminConsole.selectedFormDef.properties;
				const prop = typeProps.find((prop) => prop.name === propName);
				prop.value = value;

				if (reloadPropExplorer) {
					this.renderContentTypeTools(this.config);
				}
			},

			openExistingItemRender: function (contentType) {
				var _self = this;

				this.loadFormDefinition(contentType, {
					success: function (formDef) {
						// render content type container in canvas
						this.context.renderContentTypeVisualContainer(formDef);
						CStudioAdminConsole.selectedFormDef = formDef;

						// render tools on right
						this.context.renderContentTypeTools(this.context.config);


						const onSave = (type) => {
							function saveFn(type) {
								var xmlFormDef =
										CStudioAdminConsole.Tool.ContentTypes.FormDefMain.serializeDefinitionToXml(formDef);

								var doc = $.parseXML('<xml/>');
								var json = { key1: 1, key2: 2 };
								var xml = doc.getElementsByTagName('xml')[0];
								var key, elem;

								for (key in json) {
									if (json.hasOwnProperty(key)) {
										elem = doc.createElement(key);
										$(elem).text(json[key]);
										xml.appendChild(elem);
									}
								}

								var defPath = '/content-types' + formDef.contentType + '/form-definition.xml';

								CrafterCMSNext.services.configuration.writeConfiguration(
									CStudioAuthoringContext.site,
									defPath,
									'studio',
									xmlFormDef
								).subscribe(
									() => {
										onSetDirty(false);
										CStudioAuthoring.Utils.showNotification(
											CMgs.format(langBundle, 'saved'),
											'top',
											'left',
											'success',
											48,
											197,
											'saveContentType'
										);
										window.top.postMessage(
											{
												type: 'CONTENT_TYPES_ON_SAVED',
												saveType: type
											},
											'*'
										);
										if (type === 'saveAndClose') {
											_self.closeEditor();
										}
									},
									() => {
										CStudioAuthoring.Operations.showSimpleDialog(
											'errorDialog-dialog',
											CStudioAuthoring.Operations.simpleDialogTypeINFO,
											CMgs.format(langBundle, 'notification'),
											CMgs.format(langBundle, 'saveFailed'),
											null, // use default button
											YAHOO.widget.SimpleDialog.ICON_BLOCK,
											'studioDialog'
										);
									}
								);
							}

							var validation = _self.componentsValidation(formDef);
							var istemplate = _self.templateValidation(formDef);

							let errorMessage = validation.fileNameError
								? `<li>${formatMessage(contentTypesMessages.fileNameErrorMessage)}</li>`
								: '';

							errorMessage += validation.internalNameError
								? `<li>${formatMessage(contentTypesMessages.internalNameErrorMessage)}</li>`
								: '';

							errorMessage += validation.flagTitleError
								? `<li>${formatMessage(contentTypesMessages.flagTitleError)}</li>`
								: '';

							errorMessage +=
								validation.idError.length > 0
									? `<li>${formatMessage(contentTypesMessages.idError)} ${validation.idError
											.map((s) => CrafterCMSNext.util.string.escapeHTML(s))
											.join(', ')}</li>`
									: '';

							errorMessage +=
								validation.datasourceIdError.length > 0
									? `<li>${formatMessage(contentTypesMessages.datasourceIdError)} ${validation.datasourceIdError
											.map((s) => CrafterCMSNext.util.string.escapeHTML(s))
											.join(', ')}</li>`
									: '';

							errorMessage +=
								validation.postfixError.length > 0 && CStudioAdminConsole.isPostfixAvailable
									? `<li>${_self.postfixErrorMessage(validation.postfixError)}</li>`
									: '';

							if (errorMessage !== '') {
								errorMessage = `${formatMessage(contentTypesMessages.saveFailed)}</br><ul>${errorMessage}</ul>`;

								CStudioAuthoring.Operations.showSimpleDialog(
									'errorTitle-dialog',
									CStudioAuthoring.Operations.simpleDialogTypeINFO,
									formatMessage(words.notification),
									errorMessage,
									null, // use default button
									YAHOO.widget.SimpleDialog.ICON_BLOCK,
									'studioDialog'
								);
							} else {
								// if there are no errors, check for templateError (that has different dialog)
								if (!istemplate.flagTemplateError) {
									let unmount;
									const elem = document.createElement('div');

									const React = craftercms.libs.React;
									const createElement = React.createElement;
									const PrimaryButton = craftercms.components.PrimaryButton;
									const SecondaryButton = craftercms.components.SecondaryButton;

									const saveButton = createElement(
										PrimaryButton,
										{
											fullWidth: true,
											onClick: () => {
												_self.updateFormDefProp('no-template-required', 'true', type !== 'saveAndClose');
												saveFn(type);
												unmount();
											}
										},
										type === 'save'
											? formatMessage(contentTypesMessages.templateNotRequiredSave)
											: type === 'saveAndClose'
												? formatMessage(contentTypesMessages.templateNotRequiredSaveAndClose)
												: formatMessage(contentTypesMessages.templateNotRequiredSaveAndMinimize)
									);

									const customEventId = 'createFileDialogEventId';
									const createTemplateButton = createElement(
										PrimaryButton,
										{
											fullWidth: true,
											onClick: () => {
												unmount();
												CrafterCMSNext.system.store.dispatch({
													type: 'SHOW_CREATE_FILE_DIALOG',
													payload: {
														path: '/templates/web',
														type: 'template',
														onCreated: {
															type: 'BATCH_ACTIONS',
															payload: [
																{
																	type: 'DISPATCH_DOM_EVENT',
																	payload: { id: customEventId, type: 'onCreated' }
																},
																{ type: 'CLOSE_CREATE_FILE_DIALOG' }
															]
														},
														onClose: {
															type: 'BATCH_ACTIONS',
															payload: [
																{
																	type: 'DISPATCH_DOM_EVENT',
																	payload: { id: customEventId, type: 'close' }
																},
																{ type: 'CLOSE_CREATE_FILE_DIALOG' }
															]
														}
													}
												});

												craftercms.utils.dom.createCustomDocumentEventListener(customEventId, (response) => {
													if (response.type === 'onCreated') {
														const { fileName, path } = response;
														const templateUrl = `${path}/${fileName}`;

														CStudioAuthoring.Operations.openCodeEditor({
															path: templateUrl,
															contentType,
															mode: 'ftl',
															onSuccess: () => {
																_self.updateFormDefProp('display-template', templateUrl, type !== 'saveAndClose');
																saveFn(type);
															},
															onClose: () => {
																// When closing, update the template (since template is already created) and save,
																// but do not close/minimize the editor.
																_self.updateFormDefProp('display-template', templateUrl, true);
																saveFn('save');
															}
														});
													}
												});
											}
										},
										formatMessage(contentTypesMessages.createATemplate)
									);

									const chooseTemplateButton = createElement(
										PrimaryButton,
										{
											fullWidth: true,
											onClick: () => {
												CStudioAuthoring.Operations.openBrowseFilesDialog({
													path: '/templates/web',
													onSuccess: ({ path }) => {
														_self.updateFormDefProp('display-template', path, type !== 'saveAndClose');
														saveFn(type);
														unmount();
													},
													onClose: () => unmount()
												});
											}
										},
										formatMessage(contentTypesMessages.chooseExistingTemplate)
									);

									const stayButton = createElement(
										SecondaryButton,
										{
											fullWidth: true,
											onClick: () => unmount()
										},
										formatMessage(contentTypesMessages.stayEditing)
									);

									CrafterCMSNext.render(elem, 'AlertDialog', {
										open: true,
										title: formatMessage(contentTypesMessages.missingTemplateTitle),
										body: formatMessage(contentTypesMessages.missingTemplateBody),
										buttons: [saveButton, createTemplateButton, chooseTemplateButton, stayButton]
									}).then((done) => (unmount = done.unmount));
								} else {
									// otherwise, save
									saveFn(type);
								}
							}
						};
						const onKeyDown = (e) => {
							const isOSX = /mac/i.test(navigator.platform);
							if ((isOSX ? e.metaKey : e.ctrlKey) && e.key === 's') {
								e.preventDefault();
								onSave('save');
							}
						};

						// Ctrl/Command + S hotkey
						document.addEventListener('keydown', onKeyDown);

						// render save bar
						CStudioAdminConsole.CommandBar.render([
							{
								label: CMgs.format(langBundle, 'close'),
								id: 'contentTypeEditorCancelBtn',
								class: 'btn-default',
								fn: function () {
									if (CStudioAdminConsole.isDirty) {
										CStudioAuthoring.Utils.showConfirmDialog({
											title: CMgs.format(langBundle, 'notification'),
											body: CMgs.format(langBundle, 'contentTypeModifiedWarn'),
											onOk: () => {
												// Revert state
												onSetDirty(false);
												_self.openExistingItemRender(CStudioAdminConsole.contentTypeSelected);
											}
										});
									} else {
										_self.closeEditor();
									}
									document.removeEventListener('keydown', onKeyDown);
								}
							},
							{
								label: CMgs.format(langBundle, 'save'),
								class: 'btn-primary',
								multiChoice: true,
								fn: function (e, type) {
									onSave(type);
								}
							}
						]);

						$('#cstudio-admin-console-command-bar').addClass('content-types-command-bar');

						amplify.publish('/content-type/loaded');

						// _self.loadConfig(contentType, {
						// 	success: function (config) {
								
						// 	},
						// 	failure: function (e) {
						// 		console.error('Error loading config', e);
						// 	}
						// });
					},

					failure: function ({ response }) {
						craftercms.getStore().dispatch({
							type: 'SHOW_ERROR_DIALOG',
							payload: { error: response.response }
						});
						_self.renderWorkarea();
					},

					context: this
				});
			},

			postfixErrorMessage: (postfixArray) => {
				let html = '<div class="postfixErrorContainer">' + CMgs.format(langBundle, 'postfixError') + '</br>',
					controls = CStudioAdminConsole.Tool.ContentTypes.propertySheet.config.controls.control;

				html += '<ul>';
				for (var i = 0; i < postfixArray.length; i++) {
					let postfixes = CStudioAdminConsole.getPostfixes(postfixArray[i].type, controls),
						description =
							postfixes.length > 1
								? CMgs.format(langBundle, 'optionsPostfixError')
								: CMgs.format(langBundle, 'optionPostfixError');
					html +=
						'<li>' +
						'<strong>' +
						postfixArray[i].title +
						':</strong> ' +
						description +
						postfixes
							.toString()
							.replace(/,/g, ', ')
							.replace(/,([^,]*)$/, ' and$1');
					+'</li>';
				}
				html += '</ul>';
				html += '</div>';

				return html;
			},

			/**
			 * load form definition from repository
			 * @param formId
			 *    path to the form you want to render
			 */
			loadFormDefinition: function (formId, cb) {
				CStudioForms.Util.loadFormDefinition(formId, cb);
			},

			/**
			 * load Config from repository
			 * @param formId
			 *    path to the form you want to render
			 */
			loadConfig: function (formId, cb) {
				CStudioForms.Util.loadConfig(formId, cb);
			},

			/**
			 * render canvas and content type
			 */
			renderContentTypeVisualContainer: function (formDef) {
				var canvasEl = document.getElementById('content-type-canvas');
				var visual = new CStudioAdminConsole.Tool.ContentTypes.FormVisualization(formDef, canvasEl);
				CStudioAdminConsole.Tool.ContentTypes.visualization = visual;

				visual.render(this.config);
			},

			/**
			 * Allows toggling in the control and datasources panels
			 */
			togglePanel: function (evt) {
				var target = evt.currentTarget;
				var targetIcon = YDom.getChildren(target)[0];
				var targetBody = YDom.getNextSibling(target);

				if (YDom.hasClass(targetIcon, 'ttClose')) {
					YDom.removeClass(targetIcon, 'ttClose');
					YDom.addClass(targetIcon, 'ttOpen');
					targetBody.style.display = 'none';
				} else {
					YDom.removeClass(targetIcon, 'ttOpen');
					YDom.addClass(targetIcon, 'ttClose');
					targetBody.style.display = 'block';
				}
			},

			/**
			 * render tools on the right
			 */
			renderContentTypeTools: function (config) {
				var controls = config.controls.control;
				var datasources = config.datasources.datasource;
				var formSection = config.formSection;
				var repeatSection = config.repeatSection;
				var toolbarEl = document.getElementById('content-type-tools');
				var self = this;
				var pluginError = {};
				pluginError.control = [];
				pluginError.datasource = [];

				if (!controls.length) {
					controls = [controls.control];
				}

				if (!datasources.length) {
					datasources = [datasources.datasource];
				}

				toolbarEl.innerHTML = `
          <div id="type-properties-container" class="content-type-tools-panel">
            <h4 id="properties-tools-panel">
              <span class="content-type-tools-panel-icon ttClose"></span>
              ${CMgs.format(langBundle, 'propertiesExplorer')}
            </h4>
            <div id="properties-container"></div>
          </div>
          <div class="content-type-tools-panel">
            <h4 id="control-tools-panel">
              <span class="content-type-tools-panel-icon ttClose"></span>
              ${CMgs.format(langBundle, 'controls')}
            </h4>
            <div>
              <input id="controlsSearchInput" class="content-types--controls--search-input" type="text" value="" placeholder="Search controls...">
              <div id="widgets-container"></div>
            </div>
          </div>
          <div class="content-type-tools-panel">
            <h4 id="datasources-tools-panel">
              <span class="content-type-tools-panel-icon ttClose"></span>
              ${CMgs.format(langBundle, 'datasources')}
            </h4>
            <div>
              <input id="datasourcesSearchInput" class="content-types--controls--search-input" type="text" value="" placeholder="Search data sources...">
              <div id="datasources-container"></div>
            </div>
          </div>
        `;

				YAHOO.util.Event.addListener('properties-tools-panel', 'click', this.togglePanel, this, true);
				YAHOO.util.Event.addListener('control-tools-panel', 'click', this.togglePanel, this, true);
				YAHOO.util.Event.addListener('datasources-tools-panel', 'click', this.togglePanel, this, true);

				let $controls = null;
				let $dataSources = null;
				const { fromEvent, map, debounceTime } = CrafterCMSNext.rxjs;
				fromEvent(document.querySelector('#controlsSearchInput'), 'keyup')
					.pipe(
						debounceTime(200),
						map((e) => e.target.value.trim().toLowerCase())
					)
					.subscribe((value) => {
						if ($controls === null) {
							$controls = $('#widgets-container .control');
						}
						if (value === '') {
							$controls.show();
						} else {
							$controls.hide().filter(`[data-label*="${value}"]`).show();
						}
					});
				fromEvent(document.querySelector('#datasourcesSearchInput'), 'keyup')
					.pipe(
						debounceTime(200),
						map((e) => e.target.value.trim().toLowerCase())
					)
					.subscribe((value) => {
						if ($dataSources === null) {
							$dataSources = $('#datasources-container .datasource');
						}
						if (value === '') {
							$dataSources.show();
						} else {
							$dataSources.hide().filter(`[data-label*="${value}"]`).show();
						}
					});

				var propertiesPanelEl = document.getElementById('properties-container');
				var propertySheet = new CStudioAdminConsole.PropertySheet(
					propertiesPanelEl,
					CStudioAdminConsole.Tool.ContentTypes.visualization.definition,
					this.config
				);
				CStudioAdminConsole.Tool.ContentTypes.propertySheet = propertySheet;

				var controlsPanelEl = document.getElementById('widgets-container');

				// add standard section control
				var formContainerEl = document.createElement('div');
				controlsPanelEl.appendChild(formContainerEl);
				YDom.addClass(formContainerEl, 'control');
				formContainerEl.innerHTML = CMgs.format(langBundle, 'formSection');
				formContainerEl.setAttribute('data-label', CMgs.format(langBundle, 'formSection').toLowerCase());
				var dd = new DragAndDropDecorator(formContainerEl);
				YDom.addClass(formContainerEl, 'control-section');
				var iconEltFormSection = CStudioAuthoring.Utils.createIcon(formSection, 'fa-cube');
				formContainerEl.insertBefore(iconEltFormSection, formContainerEl.firstChild);

				// add repeat control
				var repeatContainerEl = document.createElement('div');
				controlsPanelEl.appendChild(repeatContainerEl);
				YDom.addClass(repeatContainerEl, 'control');
				repeatContainerEl.innerHTML = CMgs.format(langBundle, 'repeatingGroup');
				repeatContainerEl.setAttribute('data-label', CMgs.format(langBundle, 'repeatingGroup').toLowerCase());
				var dd = new DragAndDropDecorator(repeatContainerEl);
				YDom.addClass(repeatContainerEl, 'new-control-type');
				YDom.addClass(repeatContainerEl, 'repeating-group');
				repeatContainerEl.prototypeField = {
					type: 'repeat',

					getName: function () {
						return 'repeat';
					},
					getSupportedProperties: function () {
						return [
							{
								label: CMgs.format(langBundle, 'minOccurs'),
								name: 'minOccurs',
								type: 'string',
								defaultValue: '0'
							},
							{ label: CMgs.format(langBundle, 'maxOccurs'), name: 'maxOccurs', type: 'string', defaultValue: '*' }
						];
					},
					getSupportedConstraints: function () {
						return [];
					}
				};
				var iconEltRepeatSection = CStudioAuthoring.Utils.createIcon(repeatSection, 'fa-cube');
				repeatContainerEl.insertBefore(iconEltRepeatSection, repeatContainerEl.firstChild);

				var formClickFn = function (evt) {
					fieldEvent = false;
					formItemSelectedEvent.fire(this, true);
				};

				formClickFn();

				// makes me wonder if this control constructor is too 'smart'?
				// basically we dont care about registering these fields in this use case
				var fakeComponentOwner = {
					registerField: function () {}
				};
				CStudioAdminConsole.Tool.ContentTypes.types = [];

				var rememberIdxF = function (callback) {
					return function (idx) {
						callback(idx);
					};
				};

				for (var j = 0; j < controls.length; j++) {
					try {
						var controlContainerEl = document.createElement('div'),
							pluginInfo = '';
						controlsPanelEl.appendChild(controlContainerEl);

						pluginInfo = CStudioAuthoring.Utils.form.getPluginInfo(
							controls[j],
							CStudioAuthoring.Constants.CONTROL_URL,
							'control'
						);

						rememberIdxF(function (idx) {
							var cb = {
								moduleLoaded: function (moduleName, moduleClass, moduleConfig) {
									try {
										var tool = new moduleClass('fake', {}, fakeComponentOwner, [], [], []),
											plugin = controls[idx].plugin ? controls[idx].plugin : null;
										tool.moduleClass = moduleClass;
										CStudioAdminConsole.Tool.ContentTypes.types[tool.getName()] = tool;
										if (plugin) {
											CStudioAdminConsole.Tool.ContentTypes.types[tool.getName()].plugin = plugin;
										}
										const controlEl = this.controlContainerEl;
										YDom.addClass(controlEl, 'control');
										controlEl.innerHTML = tool.getLabel();

										controlEl.setAttribute('data-label', tool.getLabel().toLowerCase());

										var dd = new DragAndDropDecorator(controlEl);
										tool.id = tool.getFixedId();
										controlEl.prototypeField = tool;
										controls[idx].supportedPostFixes = tool.getSupportedPostFixes ? tool.getSupportedPostFixes() : [];

										YDom.addClass(controlEl, 'new-control-type');
										YDom.addClass(
											controlEl,
											tool.getName().replace(/\//g, '').replace(/\s+/g, '-').toLowerCase() + '-control'
										);

										var iconElt = CStudioAuthoring.Utils.createIcon(controls[idx], 'fa-cube');
										controlEl.insertBefore(iconElt, controlEl.firstChild);
									} catch (e) {}
								},

								context: this,
								controlContainerEl: controlContainerEl
							};
							CStudioAuthoring.Module.requireModule(
								pluginInfo.prefix,
								pluginInfo.path,
								{ config: pluginInfo.name },
								cb
							);
						})(j);
					} catch (err) {
						console.log(err);
					}

					if (pluginInfo.missingProp.length > 0) {
						pluginError.control.push(pluginInfo.missingProp);
					}
				}

				var dd = new DragAndDropDecorator('widget');

				var dsourcePanelEl = document.getElementById('datasources-container');

				CStudioAdminConsole.Tool.ContentTypes.datasources = [];

				for (var l = 0; l < datasources.length; l++) {
					try {
						var dsourceContainerEl = document.createElement('div'),
							pluginInfo = '';
						dsourcePanelEl.appendChild(dsourceContainerEl);

						pluginInfo = CStudioAuthoring.Utils.form.getPluginInfo(
							datasources[l],
							CStudioAuthoring.Constants.DATASOURCE_URL,
							'datasource'
						);

						rememberIdxF(function (idx) {
							var cb = {
								moduleLoaded: function (moduleName, moduleClass, moduleConfig) {
									try {
										var datasource = new moduleClass('', {}, [], []),
											plugin = datasources[idx].plugin ? datasources[idx].plugin : null;
										CStudioAdminConsole.Tool.ContentTypes.datasources[datasource.getName()] = datasource;
										if (plugin) {
											CStudioAdminConsole.Tool.ContentTypes.datasources[datasource.getName()].plugin = plugin;
										}
										YDom.addClass(this.dsourceContainerEl, 'datasource');
										YDom.addClass(this.dsourceContainerEl, 'new-datasource-type');
										this.dsourceContainerEl.innerHTML = datasource.getLabel();
										this.dsourceContainerEl.setAttribute('data-label', datasource.getLabel().toLowerCase());
										YDom.addClass(
											this.dsourceContainerEl,
											datasource.getLabel().replace(/\//g, '').replace(/\s+/g, '-').toLowerCase()
										);
										$(this.dsourceContainerEl).attr('data-item-id', datasource.getName());

										var dd = new DragAndDropDecorator(this.dsourceContainerEl);
										this.dsourceContainerEl.prototypeDatasource = datasource;
										var iconElt = CStudioAuthoring.Utils.createIcon(datasources[idx], 'fa-database');
										this.dsourceContainerEl.insertBefore(iconElt, this.dsourceContainerEl.firstChild);
									} catch (e) {}
								},

								context: this,
								dsourceContainerEl: dsourceContainerEl
							};

							CStudioAuthoring.Module.requireModule(
								pluginInfo.prefix,
								pluginInfo.path,
								{ config: pluginInfo.name },
								cb
							);
						})(l);
					} catch (err) {}

					if (pluginInfo.missingProp.length > 0) {
						pluginError.datasource.push(pluginInfo.missingProp);
					}
				}

				var dd = new DragAndDropDecorator('datasource');

				if (pluginError.control.length > 0 || pluginError.datasource.length > 0) {
					CStudioAuthoring.Utils.form.getPluginError(pluginError, CMgs, formsLangBundle);
				}
			},

			/**
			 * action that is fired when the user clicks on the open existing item in the context nav
			 */
			onOpenExistingClick: function (inline) {
				const me = this;
				var path = '/';

				var openExistingItemRender = this.context
					? this.context.openExistingItemRender.bind(this.context)
					: this.openExistingItemRender.bind(this);

				var onOpenExistingClick = this.context
					? this.context.onOpenExistingClick.bind(this.context)
					: this.onOpenExistingClick.bind(this);

				var chooseTemplateCb = {
					success: function (contentTypes) {
						me.config.contentTypes = contentTypes;
						var selectTemplateDialogCb = {
							moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
								$('#openExistingInlineTarget').html('<div/>');
								if (inline) {
									dialogClass.showDialog(
										moduleConfig.contentTypes,
										path,
										false,
										moduleConfig.selectTemplateCb,
										false,
										document.querySelector('#openExistingInlineTarget > div')
									);
								} else {
									dialogClass.showDialog(moduleConfig.contentTypes, path, false, moduleConfig.selectTemplateCb, false);
								}
							}
						};

						var typeSelectedCb = {
							success: function (typeSelected) {
								$('#cstudio-admin-console-workarea').html(WORK_AREA_HTML);
								openExistingItemRender(typeSelected);
								CStudioAdminConsole.contentTypeSelected = typeSelected;
							},
							failure: function () {},
							close() {
								if ($('.site-config-landing-page').length) {
									onOpenExistingClick(true);
								}
							},
							context: this.context.context
						};

						var moduleConfig = {
							contentTypes: contentTypes,
							selectTemplateCb: typeSelectedCb
						};

						CStudioAuthoring.Module.requireModule(
							'dialog-select-template',
							'/static-assets/components/cstudio-dialogs/select-content-type.js',
							moduleConfig,
							selectTemplateDialogCb
						);
					},
					failure: function () {},
					context: this
				};

				if (CStudioAdminConsole.isDirty) {
					CStudioAuthoring.Operations.showSimpleDialog(
						'error-dialog',
						CStudioAuthoring.Operations.simpleDialogTypeINFO,
						CMgs.format(langBundle, 'notification'),
						CMgs.format(langBundle, 'contentTypeModifiedWarn'),
						[
							{
								text: CMgs.format(formsLangBundle, 'yes'),
								handler: function () {
									onSetDirty(false);
									CStudioAuthoring.Service.getAllContentTypesForSite(CStudioAuthoringContext.site, chooseTemplateCb);
									this.destroy();
								},
								isDefault: false
							},
							{
								text: CMgs.format(formsLangBundle, 'no'),
								handler: function () {
									this.destroy();
								},
								isDefault: false
							}
						],
						YAHOO.widget.SimpleDialog.ICON_WARN,
						'studioDialog'
					);
				} else {
					onSetDirty(false);
					CStudioAuthoring.Service.getAllContentTypesForSite(CStudioAuthoringContext.site, chooseTemplateCb);
				}
			},

			/**
			 * action that is fired when user clicks on new item in context nav
			 */
			onNewClick: function () {
				const context = this.context || this;

				var dialogLoadedCb = {
					moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
						$('#openExistingInlineTarget').html('<div/>');
						dialogClass.showDialog(
							{
								success: function (type) {
									$('#cstudio-admin-console-workarea').html(WORK_AREA_HTML);
									context.openExistingItemRender(type);
									window.top.postMessage(
										{
											type: 'CONTENT_TYPES_ON_CREATED'
										},
										'*'
									);
								},
								failure: function () {},
								close(didCreate) {
									if (!didCreate && $('.site-config-landing-page').length) {
										$('#openExistingInlineTarget').html('<div/>');
										context.onOpenExistingClick(true);
									}
								},
								context: moduleConfig.context
							},
							moduleConfig.context.config
						);
					}
				};

				var moduleConfig = { context };

				if (CStudioAdminConsole.isDirty) {
					CStudioAuthoring.Operations.showSimpleDialog(
						'error-dialog',
						CStudioAuthoring.Operations.simpleDialogTypeINFO,
						CMgs.format(langBundle, 'notification'),
						CMgs.format(langBundle, 'contentTypeModifiedWarn'),
						[
							{
								text: CMgs.format(formsLangBundle, 'yes'),
								handler: function () {
									onSetDirty(false);
									CStudioAuthoring.Module.requireModule(
										'new-content-type-dialog',
										'/static-assets/components/cstudio-dialogs/new-content-type.js',
										moduleConfig,
										dialogLoadedCb
									);
									this.destroy();
								},
								isDefault: false
							},
							{
								text: CMgs.format(formsLangBundle, 'no'),
								handler: function () {
									this.destroy();
								},
								isDefault: false
							}
						],
						YAHOO.widget.SimpleDialog.ICON_WARN,
						'studioDialog'
					);
				} else {
					onSetDirty(false);
					CStudioAuthoring.Module.requireModule(
						'new-content-type-dialog',
						'/static-assets/components/cstudio-dialogs/new-content-type.js',
						moduleConfig,
						dialogLoadedCb
					);
				}
			}
		});

		var formItemSelectedEvent = new YAHOO.util.CustomEvent('onFormItemSelected');

		/**
		 * class that drives form visualization
		 */
		CStudioAdminConsole.Tool.ContentTypes.FormVisualization = function (formDef, containerEl) {
			this.containerEl = containerEl;
			this.definition = formDef;

			return this;
		};

		CStudioAdminConsole.Tool.ContentTypes.FormVisualization.prototype = {
			/**
			 * render form visualization
			 */
			render: function (config) {
				var that = this;
				this.config = this.config ? this.config : config;
				if (CStudioAdminConsole.Tool.ContentTypes.FormDefMain.dragActionTimer) {
					// If the drag action timer is set, changes are still occurring to the form
					// Call the render method again in a few milliseconds
					setTimeout(function () {
						that.render();
					}, 10);
				}
				this.containerEl.innerHTML = '';
				//Remove old subscriptors to prevent garbage
				formItemSelectedEvent.unsubscribeAll();

				var formVisualContainerEl = document.createElement('div');
				YDom.addClass(formVisualContainerEl, 'content-type-visual-container');
				this.containerEl.appendChild(formVisualContainerEl);
				this.formVisualContainerEl = formVisualContainerEl;
				var formTarget = new YAHOO.util.DDTarget(formVisualContainerEl);

				var header = document.createElement('header');
				header.style.position = 'relative';

				var formNameEl = document.createElement('div');
				YDom.addClass(formNameEl, 'content-form-name');
				formNameEl.textContent = this.definition.title;

				var divPropertiesEl = document.createElement('div');
				YDom.addClass(divPropertiesEl, 'content-form-link');

				var linkPropertiesEl = document.createElement('a');
				linkPropertiesEl.innerHTML = CMgs.format(langBundle, 'basicContentTypeProp');
				divPropertiesEl.appendChild(linkPropertiesEl);

				var deleteTypeApp = document.createElement('div');
				deleteTypeApp.classList.add('delete-type-container');
				deleteTypeApp.style.position = 'absolute';
				deleteTypeApp.style.top = '0';
				deleteTypeApp.style.right = '0';
				deleteTypeApp.style.bottom = '0';

				header.appendChild(formNameEl);
				header.appendChild(divPropertiesEl);
				header.appendChild(deleteTypeApp);
				formVisualContainerEl.appendChild(header);

				let unmount;
				CrafterCMSNext.render(deleteTypeApp, 'DeleteContentTypeButton', {
					contentType: {
						id: this.definition.contentType,
						name: this.definition.title
					},
					onComplete() {
						window.top.postMessage(
							{
								type: 'CONTENT_TYPES_ON_DELETED'
							},
							'*'
						);
						CStudioAdminConsole.CommandBar.hide();
						CStudioAdminConsole.renderWorkArea(null, {
							tool: CStudioAdminConsole.toolsModules['content-types']
						});
					}
				}).then((result) => (unmount = result.unmount));

				formVisualContainerEl.definition = this.definition;

				var formClickFn = function (evt) {
					fieldEvent = false;
					formItemSelectedEvent.fire(this);
				};

				var formSelectedFn = function (evt, selectedEl, isBasicLink) {
					if (fieldEvent == true) return;

					var listeningEl = arguments[2];

					if (selectedEl[0] != listeningEl && !isBasicLink) {
						YDom.removeClass(listeningEl, 'content-type-visual-form-container-selected');
					} else {
						YDom.addClass(listeningEl, 'content-type-visual-form-container-selected');
						CStudioAdminConsole.Tool.ContentTypes.propertySheet.render(listeningEl.definition);
					}
				};

				formItemSelectedEvent.subscribe(formSelectedFn, formVisualContainerEl);
				YAHOO.util.Event.on(formVisualContainerEl, 'click', formClickFn);
				YAHOO.util.Event.on(linkPropertiesEl, 'click', formClickFn);

				this.renderSections();

				var datasourcesContainerEl = document.createElement('div');
				YDom.addClass(datasourcesContainerEl, 'content-type-datasources-container');
				formVisualContainerEl.appendChild(datasourcesContainerEl);
				datasourcesContainerEl.definition = this.definition;

				var datasourcesNameEl = document.createElement('span');
				YDom.addClass(datasourcesNameEl, 'content-section-name');
				datasourcesNameEl.textContent = CMgs.format(langBundle, 'datasources');
				datasourcesContainerEl.appendChild(datasourcesNameEl);
				var tar = new YAHOO.util.DDTarget(datasourcesContainerEl);

				this.renderDatasources(datasourcesContainerEl);

				var bottomSpacerEl = document.createElement('div');
				bottomSpacerEl.style.minHeight = '100px';
				formVisualContainerEl.appendChild(bottomSpacerEl);
			},

			/**
			 * render data source objects
			 */
			renderDatasources: function (datasourcesContainerEl) {
				var datasources = this.definition.datasources;

				for (var i = 0; i < datasources.length; i++) {
					var datasource = datasources[i];
					var datasourceEl = document.createElement('div');
					YDom.addClass(datasourceEl, 'content-type-visual-datasource-container');
					datasourcesContainerEl.appendChild(datasourceEl);

					var datasourceNameEl = document.createElement('span');
					YDom.addClass(datasourceNameEl, 'content-datasource-name');
					datasourceNameEl.textContent = datasource.title;
					datasourceEl.appendChild(datasourceNameEl);

					var datasourceTypeEl = document.createElement('span');
					YDom.addClass(datasourceTypeEl, 'content-datasource-type');
					datasourceTypeEl.innerHTML = datasource.type + ' (' + datasource['interface'] + ')';
					datasourceEl.appendChild(datasourceTypeEl);

					var dsNameEl = document.createElement('span');
					YDom.addClass(dsNameEl, 'content-datasource-variable');
					dsNameEl.innerHTML = datasource.id;
					datasourceEl.appendChild(dsNameEl);

					datasourceEl.datasource = datasource;
					datasource.datasourceContainerEl = datasourceEl;

					var fieldClickFn = function (evt) {
						fieldEvent = true;
						formItemSelectedEvent.fire(this);
						YAHOO.util.Event.stopEvent(evt);
					};

					var fieldSelectedFn = function (evt, selectedEl) {
						var listeningEl = arguments[2];

						if (selectedEl[0] != listeningEl) {
							YDom.removeClass(listeningEl, 'content-type-visual-datasource-container-selected');

							// remove delete control
							var deleteEl = YDom.getElementsByClassName('deleteControl', null, listeningEl)[0];

							if (deleteEl) {
								deleteEl.parentNode.removeChild(deleteEl);
							}
						} else {
							YDom.addClass(listeningEl, 'content-type-visual-datasource-container-selected');
							try {
								CStudioAdminConsole.Tool.ContentTypes.propertySheet.render(listeningEl.datasource);
							} catch (errPropRender) {}

							// add delete control
							var deleteEl = YDom.getElementsByClassName('deleteControl', null, listeningEl)[0];

							if (!deleteEl) {
								deleteEl = document.createElement('i');
								YDom.addClass(deleteEl, 'deleteControl fa fa-times-circle');
								listeningEl.appendChild(deleteEl);

								var deleteFieldFn = function (evt) {
									CStudioAdminConsole.Tool.ContentTypes.FormDefMain.deleteDatasource(this.parentNode.datasource);
									CStudioAdminConsole.Tool.ContentTypes.visualization.render();
									CStudioAdminConsole.Tool.ContentTypes.propertySheet.renderEmpty();
									YAHOO.util.Event.stopEvent(evt);
								};

								YAHOO.util.Event.on(deleteEl, 'click', deleteFieldFn);
							}
						}
					};

					formItemSelectedEvent.subscribe(fieldSelectedFn, datasourceEl);
					YAHOO.util.Event.on(datasourceEl, 'click', fieldClickFn);
				}
			},

			/**
			 * render form visualization (sections)
			 */
			renderSections: function () {
				var sections = this.definition.sections;
				var reSectionTitle = new RegExp(CStudioForms.Util.defaultSectionTitle + ' \\d+');

				for (var i = 0; i < sections.length; i++) {
					var section = sections[i];
					var sectionContainerEl = document.createElement('div');

					if (!section.title || reSectionTitle.test(section.title)) {
						section.title = CStudioForms.Util.defaultSectionTitle;
						section.timestamp = Number(new Date()); // Save a timestamp to append to the default section name later on
					}

					YDom.addClass(sectionContainerEl, 'content-type-visual-section-container');
					this.formVisualContainerEl.appendChild(sectionContainerEl);

					var sectionNameEl = document.createElement('span');
					YDom.addClass(sectionNameEl, 'content-section-name');
					sectionNameEl.textContent = section.title;
					sectionContainerEl.appendChild(sectionNameEl);

					section.sectionContainerEl = sectionContainerEl;
					sectionContainerEl.section = section;

					var dd = new DragAndDropDecorator(sectionContainerEl);
					var tar = new YAHOO.util.DDTarget(sectionContainerEl);

					this.renderFields(section);

					var sectionClickFn = function (evt) {
						fieldEvent = false;
						formItemSelectedEvent.fire(this);
						YAHOO.util.Event.stopEvent(evt);
					};

					var sectionSelectedFn = function (evt, selectedEl) {
						var listeningEl = arguments[2];

						if (selectedEl[0] != listeningEl) {
							YDom.removeClass(listeningEl, 'content-type-visual-section-container-selected');

							// remove delete control
							// Adding the class delete-control-section to prevent get the delete control of its children
							var deleteEl = YDom.getElementsByClassName('delete-control-section', null, listeningEl)[0];

							if (deleteEl) {
								deleteEl.parentNode.removeChild(deleteEl);
							}
						} else {
							YDom.addClass(listeningEl, 'content-type-visual-section-container-selected');
							CStudioAdminConsole.Tool.ContentTypes.propertySheet.render(listeningEl.section);

							// add delete control
							var deleteEl = YDom.getElementsByClassName('delete-control-section', null, listeningEl)[0];

							if (!deleteEl) {
								deleteEl = document.createElement('i');
								YDom.addClass(deleteEl, 'deleteControl fa fa-times-circle');
								YDom.addClass(deleteEl, 'delete-control-section');
								listeningEl.insertBefore(deleteEl, listeningEl.children[0]);

								var deleteFieldFn = function (evt) {
									onSetDirty(true);
									CStudioAdminConsole.Tool.ContentTypes.FormDefMain.deleteSection(this.parentNode.section);
									CStudioAdminConsole.Tool.ContentTypes.visualization.render();
									CStudioAdminConsole.Tool.ContentTypes.propertySheet.renderEmpty();
									YAHOO.util.Event.stopEvent(evt);
								};

								YAHOO.util.Event.on(deleteEl, 'click', deleteFieldFn);
							}
						}
					};

					formItemSelectedEvent.subscribe(sectionSelectedFn, sectionContainerEl);
					YAHOO.util.Event.on(sectionContainerEl, 'click', sectionClickFn);
				}
			},

			/**
			 * render form visualization (fields)
			 */
			renderFields: function (section) {
				var fields = section.fields;

				for (var i = 0; i < fields.length; i++) {
					var field = fields[i];

					if (field) {
						if (field.type != 'repeat') {
							// trypical case
							this.renderField(section, field);
						} else {
							// item is a repeat: this is like a section in that it's a container but
							// needs to sit in and be ordered with fields
							this.renderRepeat(section, field);
						}
					}
				}
			},

			/**
			 * render a field
			 */
			renderRepeat: function (section, field) {
				var fieldContainerEl = document.createElement('div');

				YDom.addClass(fieldContainerEl, 'content-type-visual-repeat-container');
				section.sectionContainerEl.appendChild(fieldContainerEl);
				field.fieldContainerEl = fieldContainerEl;
				field.sectionContainerEl = fieldContainerEl;
				field.section = section;
				fieldContainerEl.field = field; // will act like a field
				fieldContainerEl.section = field; // will also act like a section since it can contain fields

				var fieldNameEl = document.createElement('span');
				YDom.addClass(fieldNameEl, 'content-field-name');

				var minValue = field.properties[0] && field.properties[0].value != '' ? field.properties[0].value : '0';
				var maxValue = field.properties[0] && field.properties[1].value != '' ? field.properties[1].value : '*';

				fieldNameEl.textContent =
					field.title + ' ' + CMgs.format(langBundle, 'repeatingGroup') + ' [' + minValue + ' ... ' + maxValue + ']';
				fieldContainerEl.appendChild(fieldNameEl);

				var fieldClickFn = function (evt) {
					fieldEvent = true;
					formItemSelectedEvent.fire(this);
					YAHOO.util.Event.stopEvent(evt);
				};

				this.renderFields(field);

				var fieldSelectedFn = function (evt, selectedEl) {
					var listeningEl = arguments[2];

					if (selectedEl[0] != listeningEl) {
						YDom.removeClass(listeningEl, 'content-type-visual-repeat-container-selected');

						// remove delete control
						// Adding the class delete-control-repeat to prevent get the delete control of its children
						var deleteEl = YDom.getElementsByClassName('delete-control-repeat', null, listeningEl)[0];

						if (deleteEl) {
							deleteEl.parentNode.removeChild(deleteEl);
						}
					} else {
						YDom.addClass(listeningEl, 'content-type-visual-repeat-container-selected');
						CStudioAdminConsole.Tool.ContentTypes.propertySheet.render(listeningEl.field);

						// add delete control
						var deleteEl = YDom.getElementsByClassName('delete-control-repeat', null, listeningEl)[0];

						if (!deleteEl) {
							deleteEl = document.createElement('i');
							YDom.addClass(deleteEl, 'deleteControl fa fa-times-circle');
							YDom.addClass(deleteEl, 'delete-control-repeat');
							listeningEl.insertBefore(deleteEl, listeningEl.children[0]);

							var deleteFieldFn = function (evt) {
								onSetDirty(true);
								CStudioAdminConsole.Tool.ContentTypes.FormDefMain.deleteField(this.parentNode.field);
								CStudioAdminConsole.Tool.ContentTypes.visualization.render();
								CStudioAdminConsole.Tool.ContentTypes.propertySheet.renderEmpty();
								YAHOO.util.Event.stopEvent(evt);
							};

							YAHOO.util.Event.on(deleteEl, 'click', deleteFieldFn);
						}
					}
				};

				formItemSelectedEvent.subscribe(fieldSelectedFn, fieldContainerEl);
				YAHOO.util.Event.on(fieldContainerEl, 'click', fieldClickFn);

				var dd = new DragAndDropDecorator(fieldContainerEl);
				var tar = new YAHOO.util.DDTarget(fieldContainerEl);
			},

			/**
			 * render a field
			 */
			renderField: function (section, field) {
				const defaultField = defaultFields.includes(field.id);

				var fieldContainerEl = document.createElement('div');

				YDom.addClass(fieldContainerEl, 'content-type-visual-field-container');
				defaultField && YDom.addClass(fieldContainerEl, 'default-field');
				section.sectionContainerEl.appendChild(fieldContainerEl);
				field.fieldContainerEl = fieldContainerEl;
				field.section = section;
				fieldContainerEl.field = field;

				var fieldNameEl = document.createElement('span');
				YDom.addClass(fieldNameEl, 'content-field-name');
				fieldNameEl.textContent = field.title;
				fieldContainerEl.appendChild(fieldNameEl);

				var fieldTypeEl = document.createElement('span');
				YDom.addClass(fieldTypeEl, 'content-field-type');
				fieldTypeEl.dataset.fieldType = field.id;
				fieldTypeEl.textContent = field.type;
				fieldContainerEl.appendChild(fieldTypeEl);

				var fieldNameEl = document.createElement('span');
				YDom.addClass(fieldNameEl, 'content-field-variable');
				fieldNameEl.textContent = field.id;
				fieldContainerEl.appendChild(fieldNameEl);

				var dd = new DragAndDropDecorator(fieldContainerEl);
				var tar = new YAHOO.util.DDTarget(fieldContainerEl);

				const controlExists =
					this.config.controls.control.filter((control) => {
						const controlName = control.plugin ? control.plugin.name : control.name;
						return controlName === field.type;
					}).length > 0;
				if (!controlExists) {
					$(fieldContainerEl)
						.addClass('disabled')
						.append(
							`<span class="control-not-available">${formatMessage(contentTypesMessages.controlNotAvailable)}</span>`
						);
				}

				var fieldClickFn = function (evt) {
					fieldEvent = true;
					formItemSelectedEvent.fire(this);
					YAHOO.util.Event.stopEvent(evt);
				};

				var fieldSelectedFn = function (evt, selectedEl) {
					var listeningEl = arguments[2];

					if (selectedEl[0] != listeningEl) {
						YDom.removeClass(listeningEl, 'content-type-visual-field-container-selected');

						// remove delete control
						var deleteEl = YDom.getElementsByClassName('deleteControl', null, listeningEl)[0];

						if (deleteEl) {
							deleteEl.parentNode.removeChild(deleteEl);
						}

						// remove switchFileName
						var switchFileNameEl = YDom.getElementsByClassName('switch-filename', null, listeningEl)[0];

						if (switchFileNameEl) {
							switchFileNameEl.parentNode.removeChild(switchFileNameEl);
						}
					} else {
						YDom.addClass(listeningEl, 'content-type-visual-field-container-selected');
						CStudioAdminConsole.Tool.ContentTypes.propertySheet.render(listeningEl.field);

						// add delete control
						var deleteEl = YDom.getElementsByClassName('deleteControl', null, listeningEl)[0];

						let showDeleteBtn = !defaultField;
						// if is a default field, and there are more than one in the content-type, delete button should be displayed
						if (defaultField) {
							showDeleteBtn = $(`.content-type-visual-container [data-field-type='${field.id}']`).length > 1;
						}

						if (!deleteEl && showDeleteBtn) {
							deleteEl = document.createElement('i');
							YDom.addClass(deleteEl, 'deleteControl fa fa-times-circle');

							listeningEl.appendChild(deleteEl);

							var deleteFieldFn = function (evt) {
								onSetDirty(true);
								CStudioAdminConsole.Tool.ContentTypes.FormDefMain.deleteField(this.parentNode.field);
								CStudioAdminConsole.Tool.ContentTypes.visualization.render();
								CStudioAdminConsole.Tool.ContentTypes.propertySheet.renderEmpty();
								YAHOO.util.Event.stopEvent(evt);
							};

							YAHOO.util.Event.on(deleteEl, 'click', deleteFieldFn);
							YAHOO.util.Event.stopEvent(evt);
						}

						if (field.id === 'file-name') {
							var switchFileNameEl = YDom.getElementsByClassName('switch-filename', null, listeningEl)[0];

							if (!switchFileNameEl) {
								switchFileNameEl = document.createElement('i');
								YDom.addClass(switchFileNameEl, 'switch-filename fa fa-exchange');

								listeningEl.appendChild(switchFileNameEl);

								const newType = listeningEl.field.type === 'file-name' ? 'auto-filename' : 'file-name';

								$(switchFileNameEl).tooltip({
									title: formatMessage(contentTypesMessages.switchToMessage, { type: newType })
								});

								var switchFileNameFn = function () {
									CStudioAdminConsole.Tool.ContentTypes.FormDefMain.editField(this.parentNode.field, {
										type: newType
									});

									CStudioAdminConsole.Tool.ContentTypes.visualization.render();
									$(switchFileNameEl).tooltip('dispose');
								};

								YAHOO.util.Event.on(switchFileNameEl, 'click', switchFileNameFn);
							}
						}
					}
				};

				formItemSelectedEvent.subscribe(fieldSelectedFn, fieldContainerEl);
				$(fieldContainerEl).not('.disabled').on('click', fieldClickFn);
			}
		};

		function getPostfixData() {
			CStudioAuthoring.Service.getConfiguration(CStudioAuthoringContext.site, '/site-config.xml', {
				success: function (config) {
					CStudioAdminConsole.isPostfixAvailable =
						config['form-engine'] && config['form-engine']['field-name-postfix'] === 'true' ? true : false;
					CStudioAdminConsole.ignorePostfixFields =
						config['form-engine'] && config['form-engine']['ignore-postfix-fields']
							? config['form-engine']['ignore-postfix-fields'].field
							: [];
				}
			});
		}

		/**
		 * drag and drop controls
		 */
		DragAndDropDecorator = function (id, sGroup, config) {
			DragAndDropDecorator.superclass.constructor.call(this, id, sGroup, config);

			this.logger = this.logger || YAHOO;
			var el = this.getDragEl();
			YAHOO.util.Dom.setStyle(el, 'opacity', 0.67); // The proxy is slightly transparent

			this.goingUp = false;
			this.lastY = 0;
		};

		YAHOO.extend(DragAndDropDecorator, YAHOO.util.DDProxy, {
			startDrag: function (x, y) {
				// make the proxy look like the source element
				var dragEl = this.getDragEl();
				var clickEl = this.getEl();
				dragEl.innerHTML = clickEl.innerHTML;
			},

			endDrag: function (e) {
				var srcEl = this.getEl();
				var proxy = this.getDragEl();

				// Show the proxy element and animate it to the src element's location
				YAHOO.util.Dom.setStyle(proxy, 'visibility', '');
				var a = new YAHOO.util.Motion(
					proxy,
					{
						points: {
							to: YAHOO.util.Dom.getXY(srcEl)
						}
					},
					0.2,
					YAHOO.util.Easing.easeOut
				);
				var proxyid = proxy.id;
				var thisid = this.id;

				// Hide the proxy and show the source element when finished with the animation
				a.onComplete.subscribe(function () {
					YAHOO.util.Dom.setStyle(proxyid, 'visibility', 'hidden');
					YAHOO.util.Dom.setStyle(thisid, 'visibility', '');
				});
				a.animate();
			},

			onDragDrop: function (e, id) {
				var formDef = CStudioAdminConsole.Tool.ContentTypes.FormDefMain;
				var _self = this;

				if (YAHOO.util.DDM.interactionInfo.drop.length > 0) {
					//processDrop = true;
					id = YAHOO.util.DDM.interactionInfo.drop[YAHOO.util.DDM.interactionInfo.drop.length - 1].id;
				}

				// The position of the cursor at the time of the drop (YAHOO.util.Point)
				var pt = YAHOO.util.DragDropMgr.interactionInfo.point;

				// The region occupied by the source element at the time of the drop
				var region = YAHOO.util.DragDropMgr.interactionInfo.sourceRegion;

				if (region) {
					// Check to see if we are over the source element's location.  We will
					// append to the bottom of the list once we are sure it was a drop in
					// the negative space (the area of the list without any list items)
					if (!region.intersect(pt)) {
						var handled = true;
						var destEl = YAHOO.util.Dom.get(id);
						var destDD = YAHOO.util.DragDropMgr.getDDById(id);
						var srcEl = this.getEl();
						var item = null;

						if (destEl) {
							if (YAHOO.util.Dom.hasClass(srcEl, 'control-section')) {
								// new control from toolbar
								if (
									!YAHOO.util.Dom.hasClass(destEl, 'content-type-visual-field-container') &&
									!YAHOO.util.Dom.hasClass(destEl, 'content-type-visual-section-container') &&
									!YAHOO.util.Dom.hasClass(destEl, 'content-type-datasources-container')
								) {
									var form = destEl.section ? destEl.section.form : destEl.definition;
									item = CStudioAdminConsole.Tool.ContentTypes.FormDefMain.insertNewSection(form);
									handled = true;
								}
							} else if (YAHOO.util.Dom.hasClass(srcEl, 'new-control-type')) {
								// new control from toolbar
								var form = null;

								if (destEl.section) {
									form = destEl.section;
								} else if (destEl.field) {
									form = destEl.field.section;
								}

								if (form != null) {
									item = CStudioAdminConsole.Tool.ContentTypes.FormDefMain.insertNewField(form, srcEl.prototypeField);
									handled = true;
								}
							} else if (YAHOO.util.Dom.hasClass(srcEl, 'new-datasource-type')) {
								var form = null;

								if (
									!YAHOO.util.Dom.hasClass(destEl, 'content-type-visual-field-container') &&
									!YAHOO.util.Dom.hasClass(destEl, 'content-type-visual-section-container')
								) {
									if (destEl.definition) {
										form = destEl.definition;
									} else if (destEl.field) {
										form = destEl.field.section.form;
									} else if (destEl.section) {
										form = destEl.section.form;
									}
								}

								if (form != null && srcEl.prototypeDatasource.getName() !== 'child-content') {
									item = CStudioAdminConsole.Tool.ContentTypes.FormDefMain.insertNewDatasource(
										form,
										srcEl.prototypeDatasource
									);
								}
								handled = true;
							}

							if ($(srcEl).hasClass('control')) {
								$('#controlsSearchInput').val('');
								$('#widgets-container .control').show();
							} else if ($(srcEl).hasClass('datasource')) {
								$('#datasourcesSearchInput').val('');
								$('#datasources-container .datasource').show();
							}

							if (handled == true) {
								if (srcEl.prototypeDatasource && srcEl.prototypeDatasource.getName() === 'child-content') {
									CStudioAdminConsole.Tool.ContentTypes.visualization.render();
									CStudioAuthoring.Operations.showSimpleDialog(
										'child-content-deprecated-dialog',
										CStudioAuthoring.Operations.simpleDialogTypeINFO,
										formatMessage(contentTypesMessages.notice),
										this.contentChildDeprecatedMessage(),
										[
											{
												text: formatMessage(contentTypesMessages.useSharedContent),
												handler: function () {
													this.destroy();
													CStudioAdminConsole.Tool.ContentTypes.propertySheet.renderNewItem(
														form,
														$('[data-item-id="shared-content"]').get(0).prototypeDatasource
													);
												},
												isDefault: false
											},
											{
												text: formatMessage(contentTypesMessages.useEmbeddedContent),
												handler: function () {
													this.destroy();
													CStudioAdminConsole.Tool.ContentTypes.propertySheet.renderNewItem(
														form,
														$('[data-item-id="embedded-content"]').get(0).prototypeDatasource
													);
												},
												isDefault: false
											},
											{
												text: formatMessage(contentTypesMessages.useChildContent),
												handler: function () {
													this.destroy();
													CStudioAdminConsole.Tool.ContentTypes.propertySheet.renderNewItem(
														form,
														srcEl.prototypeDatasource
													);
												},
												isDefault: true
											}
										],
										YAHOO.widget.SimpleDialog.ICON_WARN,
										'studioDialog',
										'600px'
									);
								} else if (item) {
									CStudioAdminConsole.Tool.ContentTypes.visualization.render();
									CStudioAdminConsole.Tool.ContentTypes.propertySheet.render(item);
								}
							}

							destDD.isEmpty = false;
							YAHOO.util.DragDropMgr.refreshCache();
						}
					}
				}
			},

			onDrag: function (e) {
				// Keep track of the direction of the drag for use during onDragOver
				var y = YAHOO.util.Event.getPageY(e);

				if (y < this.lastY) {
					this.goingUp = true;
				} else if (y > this.lastY) {
					this.goingUp = false;
				}

				this.lastY = y;
			},

			onDragEnter: function (e, id) {
				var that = this,
					srcEl = this.getEl(),
					destEl = YAHOO.util.Dom.get(id),
					formDef = CStudioAdminConsole.Tool.ContentTypes.FormDefMain,
					func = null;

				if (
					YDom.isAncestor('content-type-canvas', srcEl) &&
					YDom.isAncestor('content-type-canvas', destEl) &&
					srcEl !== destEl &&
					!YDom.isAncestor(id, srcEl)
				) {
					// Only process enter events for elements that are not ancestors or the elements themselves.
					// Leave out the proxy elements (only children of content-type-canvas)

					if (YDom.hasClass(srcEl, 'content-type-visual-field-container')) {
						if (
							YDom.hasClass(destEl, 'content-type-visual-field-container') ||
							YDom.hasClass(destEl, 'content-type-visual-repeat-container') ||
							YDom.hasClass(destEl, 'content-type-visual-section-container')
						) {
							if (YDom.hasClass(destEl, 'content-type-visual-field-container')) {
								func = 'moveField';
							} else {
								func = 'moveInside';
							}
						}
					} else if (YDom.hasClass(srcEl, 'content-type-visual-repeat-container')) {
						if (
							YDom.hasClass(destEl, 'content-type-visual-field-container') ||
							YDom.hasClass(destEl, 'content-type-visual-repeat-container') ||
							YDom.hasClass(destEl, 'content-type-visual-section-container')
						) {
							// Only let the repeat groups around items that are outside repeats (under a section) or around
							// other repeats
							if (
								(YDom.hasClass(destEl, 'content-type-visual-field-container') &&
									YDom.hasClass(destEl.parentNode, 'content-type-visual-section-container')) ||
								YDom.hasClass(destEl, 'content-type-visual-repeat-container')
							) {
								func = 'moveField';
							} else if (YDom.hasClass(destEl, 'content-type-visual-section-container')) {
								func = 'moveInside';
							}
						}
					} else if (YDom.hasClass(srcEl, 'content-type-visual-section-container')) {
						if (YDom.hasClass(destEl, 'content-type-visual-section-container')) {
							func = 'moveField';
						}
					}

					if (func) {
						// Function was set, therefore there must be a valid interaction

						if (!formDef.dragActionTimer) {
							formDef.dragActionTimer = formDef.createDragAction(func, srcEl, destEl, this.goingUp);
						} else {
							if (formDef.isChanging) {
								// drag action timer was set and currently changes are being made to the form definition and the UI
								// call this method again in a few milliseconds
								setTimeout(function () {
									that.onDragEnter(e, id);
								}, 10);
							} else {
								// reset drag action timer that was previosly set
								clearTimeout(formDef.dragActionTimer);
								formDef.dragActionTimer = formDef.createDragAction(func, srcEl, destEl, this.goingUp);
							}
						}
					}
				}
			},

			onDragOut: function (e, id) {
				var that = this,
					srcEl = this.getEl(),
					destEl = YAHOO.util.Dom.get(id),
					formDef = CStudioAdminConsole.Tool.ContentTypes.FormDefMain,
					func = null;

				if (
					YDom.isAncestor('content-type-canvas', srcEl) &&
					YDom.isAncestor('content-type-canvas', destEl) &&
					srcEl !== destEl &&
					srcEl.parentNode === destEl
				) {
					// Only process out events for items coming out from repeat groups that contain them
					// Leave out the proxy element (only children of content-type-canvas)

					if (YDom.hasClass(srcEl, 'content-type-visual-field-container')) {
						if (YDom.hasClass(destEl, 'content-type-visual-repeat-container')) {
							func = 'moveOutside';
						}
					}

					if (func) {
						// Function was set, therefore there must be a valid interaction
						if (!formDef.dragActionTimer) {
							formDef.dragActionTimer = formDef.createDragAction(func, srcEl, destEl, this.goingUp);
						} else {
							if (formDef.isChanging) {
								// drag action timer was set and currently changes are being made to the form definition and the UI
								// call this method again in a few milliseconds
								setTimeout(function () {
									that.onDragOut(e, id);
								}, 10);
							} else {
								// reset drag action timer that was previosly set
								clearTimeout(formDef.dragActionTimer);
								formDef.dragActionTimer = formDef.createDragAction(func, srcEl, destEl, this.goingUp);
							}
						}
					}
				}
			},

			contentChildDeprecatedMessage: () => {
				let html = ' <div>' + formatMessage(contentTypesMessages.contenTypeWarningMessage) + '</div>';
				return html;
			}
		});

		CStudioAdminConsole.PropertySheet = function (containerEl, form, config) {
			this.containerEl = containerEl;
			this.form = form;
			this.config = config;
		};

		/**
		 * property sheet object
		 */
		CStudioAdminConsole.PropertySheet.prototype = {
			/**
			 * Use when an Item is removed to clean the property sheet
			 */
			renderEmpty: function () {
				if (this.containerEl) {
					this.containerEl.innerHTML = '';
					YAHOO.util.Dom.setStyle(this.containerEl, 'height', 'auto');
				}
			},

			/**
			 * main render method
			 */
			render: function (item) {
				this.containerEl.innerHTML = '';

				try {
					var sheetEl = document.createElement('div');
					this.containerEl.appendChild(sheetEl);

					if (item) {
						if (item.fieldContainerEl && item.type == 'repeat') {
							// item is a repeat group field
							this.renderRepeatPropertySheet(item, sheetEl);
						} else if (item.fieldContainerEl) {
							// item is a field
							this.renderFieldPropertySheet(item, sheetEl);
						} else if (item.sectionContainerEl) {
							// item is a section
							this.renderSectionPropertySheet(item, sheetEl);
						} else if (item.datasourceContainerEl) {
							// item is a datasource
							this.renderDatasourcePropertySheet(item, sheetEl);
						} else {
							// item is the form
							this.renderFormPropertySheet(item, sheetEl);
						}
					}
				} catch (err) {
					CStudioAuthoring.Operations.showSimpleDialog(
						'error-dialog',
						CStudioAuthoring.Operations.simpleDialogTypeINFO,
						CMgs.format(langBundle, 'notification'),
						err,
						null, // use default button
						YAHOO.widget.SimpleDialog.ICON_BLOCK,
						'studioDialog'
					);
				}
			},

			renderPostfixesVariable: (type) => {
				let label = CMgs.format(langBundle, 'variableName');

				let controls = CStudioAdminConsole.Tool.ContentTypes.propertySheet.config.controls.control,
					renderPostfixes = CStudioAdminConsole.getPostfixes(type, controls),
					identifier = `.label-${label.replace(/\//g, '').replace(/\s+/g, '-').toLowerCase()}`,
					xml = '<table class="quick-create-help">';

				for (var i = 0; i < renderPostfixes.length; i++) {
					let postfixDescription = CStudioAdminConsole.renderPostfixDescriptions()[renderPostfixes[i]]
						? CStudioAdminConsole.renderPostfixDescriptions()[renderPostfixes[i]]
						: '';

					xml +=
						`<tr>` +
						/**/ `<th> ${renderPostfixes[i]} </th>` +
						/**/ `<td> ${postfixDescription} </td>` +
						/**/ `<td>` +
						/****/ `<button ` +
						/******/ `onclick="CStudioAdminConsole.cleanPostfix('${identifier}', '${type}'); CStudioAdminConsole.helpInsert(this, '${identifier}')" ` +
						/******/ `data-insert="${renderPostfixes[i]}" ` +
						/******/ `class="btn btn-default quick-create-help__insert-btn" ` +
						/******/ `type="button" ` +
						/******/ `aria-label="${formatMessage(contentTypesMessages.insertExpressionMessage)}" ` +
						/******/ `title="${formatMessage(contentTypesMessages.insertExpressionMessage)}"` +
						/****/ `>` +
						/******/ `<i class="fa fa-plus-circle" aria-hidden="true"></i>` +
						/****/ `</button>` +
						/**/ `</td>` +
						`</tr>`;
				}
				xml += '</table>';

				return xml;
			},

			renderQuickCreatePattern: function () {
				var identifier = '.label-destination-path-pattern';

				return (
					`<table class="quick-create-help">` +
					`<tr>` +
					/**/ `<th>{objectId}</th>` +
					/**/ `<td>${CMgs.format(langBundle, 'objectIdPattern')}</td>` +
					/**/ `<td>` +
					/****/ `<button onclick="CStudioAdminConsole.helpInsert(this, '${identifier}')" data-insert="{objectId}/" class="btn btn-default quick-create-help__insert-btn" type="button" aria-label="${formatMessage(
						contentTypesMessages.insertExpressionMessage
					)}" title="${formatMessage(contentTypesMessages.insertExpressionMessage)}">` +
					/******/ `<i class="fa fa-plus-circle" aria-hidden="true"></i>` +
					/****/ `</button>` +
					/**/ `</td>` +
					`</tr>` +
					`<tr>` +
					/**/ `<th>{year}</th>` +
					/**/ `<td>${CMgs.format(langBundle, 'yearPattern')}</td>` +
					/**/ `<td>` +
					/****/ `<button onclick="CStudioAdminConsole.helpInsert(this, '${identifier}')" data-insert="{year}/" class="btn btn-default quick-create-help__insert-btn" type="button" aria-label="${formatMessage(
						contentTypesMessages.insertExpressionMessage
					)}" title="${formatMessage(contentTypesMessages.insertExpressionMessage)}">` +
					/******/ `<i class="fa fa-plus-circle" aria-hidden="true"></i>` +
					/****/ `</button>` +
					/**/ `</td>` +
					`</tr>` +
					`<tr>` +
					/**/ `<th>{month}</th>` +
					/**/ `<td>${CMgs.format(langBundle, 'monthPattern')}</td>` +
					/**/ `<td>` +
					/****/ `<button onclick="CStudioAdminConsole.helpInsert(this, '${identifier}')" data-insert="{month}/" class="btn btn-default quick-create-help__insert-btn" type="button" aria-label="${formatMessage(
						contentTypesMessages.insertExpressionMessage
					)}" title="${formatMessage(contentTypesMessages.insertExpressionMessage)}">` +
					/******/ `<i class="fa fa-plus-circle" aria-hidden="true"></i>` +
					/****/ `</button>` +
					/**/ `</td>` +
					`</tr>` +
					`<tr>` +
					/**/ `<th>{yyyy}</th>` +
					/**/ `<td>${CMgs.format(langBundle, 'yyyyPattern')}</td>` +
					/**/ `<td>` +
					/****/ `<button onclick="CStudioAdminConsole.helpInsert(this, '${identifier}')" data-insert="{yyyy}/" class="btn btn-default quick-create-help__insert-btn" type="button" aria-label="${formatMessage(
						contentTypesMessages.insertExpressionMessage
					)}" title="${formatMessage(contentTypesMessages.insertExpressionMessage)}">` +
					/******/ `<i class="fa fa-plus-circle" aria-hidden="true"></i>` +
					/****/ `</button>` +
					/**/ `</td>` +
					`</tr>` +
					`<tr>` +
					/**/ `<th>{mm}</th>` +
					/**/ `<td>${CMgs.format(langBundle, 'mmPattern')}</td>` +
					/**/ `<td>` +
					/****/ `<button onclick="CStudioAdminConsole.helpInsert(this, '${identifier}')" data-insert="{mm}/" class="btn btn-default quick-create-help__insert-btn" type="button" aria-label="${formatMessage(
						contentTypesMessages.insertExpressionMessage
					)}" title="${formatMessage(contentTypesMessages.insertExpressionMessage)}">` +
					/******/ `<i class="fa fa-plus-circle" aria-hidden="true"></i>` +
					/****/ `</button>` +
					/**/ `</td>` +
					`</tr>` +
					`<tr>` +
					/**/ `<th>{dd}</th>` +
					/**/ `<td>${CMgs.format(langBundle, 'ddPattern')}</td>` +
					/**/ `<td>` +
					/****/ `<button onclick="CStudioAdminConsole.helpInsert(this, '${identifier}')" data-insert="{dd}/" class="btn btn-default quick-create-help__insert-btn" type="button" aria-label="${formatMessage(
						contentTypesMessages.insertExpressionMessage
					)}" title="${formatMessage(contentTypesMessages.insertExpressionMessage)}">` +
					/******/ `<i class="fa fa-plus-circle" aria-hidden="true"></i>` +
					/****/ `</button>` +
					/**/ `</td>` +
					`</tr>` +
					`</table>`
				);
			},

			renderFormPropertySheet: function (item, sheetEl) {
				this.createRowHeading(CMgs.format(langBundle, 'formBasics'), sheetEl);
				this.createRowFn(
					CMgs.format(langBundle, 'formTitle'),
					'title',
					item.title,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.title = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'description'),
					'description',
					item.description,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.description = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'objectType'),
					'objectType',
					item.objectType,
					'',
					'readonly',
					sheetEl,
					function (e, el) {
						item.objectType = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'contentType'),
					'content-type',
					item.contentType,
					'',
					'readonly',
					sheetEl,
					function (e, el) {
						item['content-type'] = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'previewImage'),
					'imageThumbnail',
					item.imageThumbnail && item.imageThumbnail != 'undefined' ? item.imageThumbnail : '',
					'',
					'image',
					sheetEl,
					function (e, el) {
						item.imageThumbnail = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'config'),
					'config',
					'config.xml',
					item.contentType,
					'config',
					sheetEl,
					function (e, el) {
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'controller'),
					'controller',
					'controller.groovy',
					item.contentType,
					'controller',
					sheetEl,
					function (e, el) {
						onSetDirty(true);
					}
				);

				for (var i = 0; i < item.properties.length; i++) {
					var property = item.properties[i];

					if (property.name == 'content-type') {
						continue; // Do not add content-type as property
					}

					var itemProperty = '';
					for (var j = 0; j < item.properties.length; j++) {
						if (item.properties[j].name == property.name) {
							itemProperty = item.properties[j];
							break;
						}
					}

					var updatePropertyFn = function (name, value) {
						var propFound = false;
						for (var l = 0; l < item.properties.length; l++) {
							if (item.properties[l].name === name) {
								propFound = true;
								item.properties[l].value = value;
								onSetDirty(true);
								break;
							}
						}

						if (!propFound) {
							item.properties[item.properties.length] = { name: name, value: value };
						}
					};

					var value = itemProperty.value ? itemProperty.value : '';
					var propertyLabel = '';
					if (property.label === 'Display Template') {
						propertyLabel = 'displayTemplate';
					} else if (property.label === 'No Template Required') {
						propertyLabel = 'noTemplateRequired';
					} else if (property.label === 'Merge Strategy') {
						propertyLabel = 'mergeStrategy';
					} else if (property.label === 'Show In Nav') {
						propertyLabel = 'showInNav';
					} else if (property.label === 'Descriptor Mapper') {
						propertyLabel = 'descriptorMapper';
					} else {
						propertyLabel = property.label;
					}
					this.createRowFn(
						CMgs.format(langBundle, propertyLabel),
						property.name,
						value,
						item.defaultValue,
						property.type,
						sheetEl,
						function (e, el) {
							updatePropertyFn(el.fieldName, el.value);
						}
					);
				}

				this.createRowHeading(CMgs.format(langBundle, 'quickCreate'), sheetEl);

				this.createRowFn(
					CMgs.format(langBundle, 'showQuickCreate'),
					'quickCreate',
					item.quickCreate,
					'',
					'boolean',
					sheetEl,
					function (e, el) {
						item.quickCreate = el.value;
						onSetDirty(true);
					}
				);

				this.createRowFn(
					CMgs.format(langBundle, 'destinationPath'),
					'quickCreatePath',
					item.quickCreatePath ? item.quickCreatePath : '',
					'',
					'string',
					sheetEl,
					function (e, el) {
						const invalidMacros = [
							{ regex: /{objectId}/, macro: 'objectId' },
							{ regex: /{parentPath(\[.*])?}/, macro: 'parentPath' },
							{ regex: /{objectGroupId(2)?}/, macro: 'objectGroupId' }
						];
						const newPath = el.value;
						const invalidMacrosInPath = [];
						invalidMacros.forEach(({ macro, regex }) => {
							if (newPath.match(regex)) {
								invalidMacrosInPath.push(macro);
								el.value = el.value.replace(regex, '');
							}
						});
						if (invalidMacrosInPath.length > 0) {
							CStudioAuthoring.Utils.showNotification(
								formatMessage(contentTypesMessages.invalidMacros, { macros: invalidMacrosInPath.join(', ') }),
								'top',
								'left',
								'info',
								48,
								197
							);
						}
						item.quickCreatePath = el.value;
						onSetDirty(true);
					},
					true,
					CMgs.format(langBundle, 'pattern'),
					this.renderQuickCreatePattern
				);
			},

			renderDatasourcePropertySheet: function (item, sheetEl) {
				function getSelectedOption(valueArray, isString) {
					var val = null;

					if (isString && typeof valueArray === 'string') {
						valueArray = JSON.parse(valueArray);
					}

					[].forEach.call(valueArray, function (obj) {
						if (obj.selected) {
							val = obj.value;
						}
					});
					return val;
				}

				function updateSelected(defaultArray, selectedDefault, selectedValue) {
					var sdobj, svobj;

					if (selectedDefault != selectedValue) {
						// If the selected values are the same in the default array and the value array, then
						// just return the default array; otherwise, update the selected values in the default array.
						for (var idx in defaultArray) {
							if (defaultArray[idx].value == selectedDefault) {
								sdobj = defaultArray[idx];
							}
							if (defaultArray[idx].value == selectedValue) {
								svobj = defaultArray[idx];
							}
						}
						if (svobj) {
							// Only change the selected objects inside the default array if the selected value
							// from the value array exists in the default array; otherwise, leave the default array as is.
							svobj.selected = true; // Update the selected value in the default array
							sdobj.selected = false; // Remove original selection in the default array
						}
					}
					return defaultArray;
				}

				var valueSelected, defaultSelected;

				this.createRowHeading(CMgs.format(langBundle, 'datasourceBasics'), sheetEl);
				this.createRowFn(
					CMgs.format(langBundle, 'title'),
					'title',
					item.title,
					'',
					'variable',
					sheetEl,
					function (e, el) {
						onSetDirty(true);
						if (YDom.hasClass(el, 'property-input-title')) {
							item.title = el.value;
						} else {
							item.id = el.value;
						}
					}
				);
				this.createRowFn(CMgs.format(langBundle, 'id'), 'name', item.id, '', 'variable', sheetEl, function (e, el) {
					item.id = el.value;
					onSetDirty(true);
				});

				this.createRowHeading(CMgs.format(langBundle, 'properties'), sheetEl);
				var type = CStudioAdminConsole.Tool.ContentTypes.datasources[item.type];
				var properties = type.getSupportedProperties();

				for (var i = 0; i < properties.length; i++) {
					var property = properties[i];

					// find property value in instance
					var itemProperty = null; //Initialize null to prevent wrong assignments
					for (var j = 0; j < item.properties.length; j++) {
						if (item.properties[j].name == property.name) {
							itemProperty = item.properties[j];
							break;
						}
					}

					if (itemProperty !== null) {
						if (!Array.isArray(property.defaultValue)) {
							value = itemProperty.value ? itemProperty.value : '';
						} else {
							// Default value is an array (e.g. key-value-list)
							// Update the value in case the default value has changed
							valueSelected = getSelectedOption(itemProperty.value, true);
							defaultSelected = getSelectedOption(property.defaultValue);

							value = updateSelected(property.defaultValue, defaultSelected, valueSelected);
						}
					} else {
						// The property does not currently exist in the model instance => probably a new property added to the content type
						// Add it to the model instance, using the property's default values
						value = property.defaultValue ? property.defaultValue : '';
						item.properties[item.properties.length] = {
							name: property.name,
							value: value,
							type: property.type
						};
					}

					var updatePropertyFn = function (name, value) {
						var propFound = false;
						for (var l = 0; l < item.properties.length; l++) {
							if (item.properties[l].name === name) {
								onSetDirty(true);
								propFound = true;
								item.properties[l].value = value;
								break;
							}
						}

						if (!propFound) {
							item.properties[item.properties.length] = { name: name, value: value };
						}
					};

					this.createRowFn(
						property.label,
						property.name,
						value,
						property.defaultValue,
						property.type,
						sheetEl,
						function (e, el) {
							updatePropertyFn(el.fieldName, el.value);
						},
						null,
						null,
						null,
						null,
						null,
						property
					);
				}
			},

			renderSectionPropertySheet: function (item, sheetEl) {
				var reSectionTitle = new RegExp(CStudioForms.Util.defaultSectionTitle + ' \\d+');

				if (!item.title || reSectionTitle.test(item.title)) {
					item.title = CStudioForms.Util.defaultSectionTitle;
					item.timestamp = Number(new Date()); // Save a timestamp to append to the default section name later on
				}

				this.createRowHeading(CMgs.format(langBundle, 'sectionBasics'), sheetEl);
				this.createRowFn(
					CMgs.format(langBundle, 'title'),
					'title',
					item.title,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.title = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'description'),
					'description',
					item.description,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.description = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'defaultOpen'),
					'defaultOpen',
					item.defaultOpen,
					false,
					'boolean',
					sheetEl,
					function (e, el) {
						item.defaultOpen = el.value;
						onSetDirty(true);
					}
				);
			},

			renderRepeatPropertySheet: function (item, sheetEl) {
				if (item.id == undefined) {
					item.id = '';
				}

				const itemPostFixes = CStudioAdminConsole.getPostfixes(item.type),
					showPostFixes =
						itemPostFixes && itemPostFixes.length > 0 && !CStudioAdminConsole.ignorePostfixFields.includes(item.id);

				this.createRowHeading('Repeat Group Basics', sheetEl);
				this.createRowFn(
					CMgs.format(langBundle, 'title'),
					'title',
					item.title,
					'',
					'variable',
					sheetEl,
					function (e, el) {
						onSetDirty(true);
						if (YDom.hasClass(el, 'property-input-title')) {
							item.title = el.value;
						} else {
							item.id = el.value;
						}
					},
					false,
					null,
					null,
					item.type
				);
				this.createRowFn(
					CMgs.format(langBundle, 'variableName'),
					'id',
					item.id,
					'',
					'variable',
					sheetEl,
					function (e, el) {
						item.id = el.value;
						onSetDirty(true);
					},
					showPostFixes,
					'Postfixes',
					this.renderPostfixesVariable(item.type)
				);

				this.createRowFn(
					CMgs.format(langBundle, 'iceGroup'),
					'iceGroup',
					item.iceId ?? '',
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.iceId = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'description'),
					'description',
					item.description,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.description = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'minOccurs'),
					'minOccurs',
					item.properties[0].value,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.properties[0].value = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'maxOccurs'),
					'maxOccurs',
					item.properties[1].value,
					'*',
					'string',
					sheetEl,
					function (e, el) {
						item.properties[1].value = el.value;
						onSetDirty(true);
					}
				);
			},

			renderFieldPropertySheet: function (item, sheetEl) {
				const defaultField = defaultFields.includes(item.id);
				const controls = CStudioAdminConsole.Tool.ContentTypes.propertySheet.config.controls.control,
					itemPostFixes = CStudioAdminConsole.getPostfixes(item.type, controls),
					showPostFixes =
						itemPostFixes && itemPostFixes.length > 0 && !CStudioAdminConsole.ignorePostfixFields.includes(item.id);

				this.itemId = item.id;
				this.createRowHeading(CMgs.format(langBundle, 'fieldBasics'), sheetEl);
				this.createRowFn(
					CMgs.format(langBundle, 'title'),
					'title',
					item.title,
					'',
					'variable',
					sheetEl,
					function (e, el) {
						onSetDirty(true);
						if (YDom.hasClass(el, 'property-input-title')) {
							item.title = el.value;
						} else {
							item.id = el.value;
						}
					},
					false,
					null,
					null,
					item.type
				);
				this.createRowFn(
					CMgs.format(langBundle, 'variableName'),
					'id',
					item.id,
					'',
					'variable',
					sheetEl,
					function (e, el) {
						item.id = el.value;
						onSetDirty(true);
					},
					showPostFixes,
					formatMessage(contentTypesMessages.postfixes),
					this.renderPostfixesVariable(item.type),
					null,
					defaultField
				);
				this.createRowFn(
					CMgs.format(langBundle, 'iceGroup'),
					'iceGroup',
					item.iceId ?? '',
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.iceId = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'description'),
					'description',
					item.description,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.description = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(
					CMgs.format(langBundle, 'defaultValue'),
					'defaultValue',
					item.defaultValue,
					'',
					'string',
					sheetEl,
					function (e, el) {
						item.defaultValue = el.value;
						onSetDirty(true);
					}
				);
				this.createRowFn(CMgs.format(langBundle, 'help'), 'help', item.help, '', 'richText', sheetEl, function (e, el) {
					item.help = el.value;
					onSetDirty(true);
				});

				//////////////////////
				this.createRowHeading(CMgs.format(langBundle, 'properties'), sheetEl);
				var type = CStudioAdminConsole.Tool.ContentTypes.types[item.type];
				var properties = type.getSupportedProperties(),
					property,
					itemProperty,
					value;

				for (var i = 0; i < properties.length; i++) {
					// Loop through the properties supported by the content type
					property = properties[i];

					for (var j = item.properties.length - 1; j >= 0; j--) {
						itemProperty = null;

						// Loop through the properties of the corresponding model instance to find the current property value
						if (item.properties[j].name == property.name) {
							itemProperty = item.properties[j];
							break;
						}
					}

					if (itemProperty != null) {
						if (itemProperty.type === 'dropdown' && !Array.isArray(itemProperty.value)) {
							value = itemProperty.value ? JSON.parse(itemProperty.value) : '';
						} else {
							value = itemProperty.value ? itemProperty.value : '';
						}
					} else {
						// The property does not currently exist in the model instance => probably a new property added to the content type
						// Add it to the model instance, using the property's default values
						value = property.defaultValue ? property.defaultValue : '';
						item.properties[item.properties.length] = {
							name: property.name,
							value: value,
							type: property.type
						};
					}

					var updatePropertyFn = function (name, value) {
						for (var l = item.properties.length - 1; l >= 0; l--) {
							if (item.properties[l].name === name && item.properties[l].value !== value) {
								onSetDirty(true);
								item.properties[l].value =
									typeof value == 'object' && !Array.isArray(value) ? JSON.stringify(value) : value;
								break;
							}
						}
					};

					this.createRowFn(
						CMgs.format(langBundle, property.label),
						property.name,
						value,
						property.defaultValue,
						property.type,
						sheetEl,
						function (e, el) {
							updatePropertyFn(el.fieldName, el.value);
						},
						null,
						null,
						null,
						null,
						null,
						property
					);
				}

				//////////////////////////////////////////////////////
				this.createRowHeading(CMgs.format(langBundle, 'constraints'), sheetEl);

				var constraints = type.getSupportedConstraints();

				for (var i = 0; i < constraints.length; i++) {
					var constraint = constraints[i];

					var itemConstraint = null;
					for (var j = 0; j < item.constraints.length; j++) {
						if (item.constraints[j].name == constraint.name) {
							itemConstraint = item.constraints[j];
							break;
						}
					}

					var value = '';
					if (itemConstraint && itemConstraint.value) {
						value = itemConstraint.value;
					}

					var updateConstraintFn = function (name, value) {
						var constraintFound = false;
						for (l = 0; l < item.constraints.length; l++) {
							if (item.constraints[l].name === name) {
								constraintFound = true;
								onSetDirty(true);
								item.constraints[l].value = value;
								break;
							}
						}

						if (!constraintFound) {
							item.constraints[item.constraints.length] = { name: name, value: value };
						}
					};

					this.createRowFn(
						constraint.label,
						constraint.name,
						value,
						constraint.defaultValue,
						constraint.type,
						sheetEl,
						function (e, el) {
							updateConstraintFn(el.fieldName, el.value);
						}
					);
				}
			},

			/**
			 * render a property sheet heading
			 */
			createRowHeading: function (label, containerEl) {
				var propertyHeadingEl = document.createElement('div');
				YAHOO.util.Dom.addClass(propertyHeadingEl, 'property-heading');
				containerEl.appendChild(propertyHeadingEl);
				propertyHeadingEl.innerHTML = label;
			},

			/**
			 * render a property sheet row
			 */
			createRowFn: function (
				label,
				fName,
				value,
				defaultValue,
				type,
				containerEl,
				fn,
				help,
				helpTitle,
				helpHTML,
				typeControl,
				disabled,
				properties
			) {
				var itemId = this.itemId;
				var helpIcon = '';
				var propertyContainerEl = document.createElement('div');
				YAHOO.util.Dom.addClass(propertyContainerEl, 'property-wrapper');
				if (label.length > 24) {
					YAHOO.util.Dom.addClass(propertyContainerEl, 'large');
				}
				containerEl.appendChild(propertyContainerEl);

				var labelEl = document.createElement('div');
				YAHOO.util.Dom.addClass(labelEl, 'property-label');
				YAHOO.util.Dom.addClass(labelEl, 'label-' + label.replace(/\//g, '').replace(/\s+/g, '-').toLowerCase());
				labelEl.innerHTML = label;

				if (help) {
					labelEl.innerHTML += '&nbsp;';

					$(
						'<button class="quick-create-help__trigger" id="help-' +
							fName +
							'" type="button" aria-label="Help">' +
							/**/ '<i class="fa fa-question-circle" aria-hidden="true"></i>' +
							'</button>'
					)
						.popover({
							sanitize: false,
							container: 'body',
							title:
								`<span>${helpTitle}</span>` +
								`<button type="button" class="close fa fa-times" onclick="$(\'#help-${fName}\').popover('hide');"/>`,
							html: true,
							content: helpHTML,
							placement: 'left',
							trigger: 'manual'
						})
						.appendTo(labelEl)
						.on('inserted.bs.popover', function () {
							var $pop = $(this);
							$('<div class="quick-create-help__popover-mask"/>')
								.click(function () {
									$('.quick-create-help__popover-mask').remove();
									$pop.popover('hide');
								})
								.appendTo('body');
						})
						.on('hide.bs.popover', function () {
							$('.quick-create-help__popover-mask').remove();
						})
						.click(function () {
							$(this).popover('show');
						});
				}

				propertyContainerEl.appendChild(labelEl);

				var propTypeCb = {
					moduleLoaded: function (moduleName, moduleClass, moduleConfig) {
						try {
							var propControl = new moduleClass(fName, propertyContainerEl, this.self.form, type);
							propControl.render(value, fn, fName, itemId, defaultValue, typeControl, disabled, properties);
						} catch (e) {
							console.error(e);
						}
					},
					self: this
				};

				var propType = type;

				if (type.indexOf('datasource:') !== -1) {
					propType = 'datasource';
				}

				CStudioAuthoring.Module.requireModule(
					'cstudio-console-tools-content-types-proptype-' + propType,
					'/static-assets/components/cstudio-admin/mods/content-type-propsheet/' + propType + '.js',
					{},
					propTypeCb
				);
			},

			/**
			 * render a property sheet heading
			 */
			renderNewItem: function (form, prototypeDatasource) {
				var item = CStudioAdminConsole.Tool.ContentTypes.FormDefMain.insertNewDatasource(form, prototypeDatasource);
				CStudioAdminConsole.Tool.ContentTypes.visualization.render();
				CStudioAdminConsole.Tool.ContentTypes.propertySheet.render(item);
			}
		};

		CStudioAdminConsole.Tool.ContentTypes.PropertyType = {};

		CStudioAdminConsole.Tool.ContentTypes.PropertyType.prototype = {
			render: function (value) {},

			getValue: function () {
				return '';
			},

			handleDependencyPopover: function (element, dependency, show) {
				const hidePopover = () => {
					$(element).parent().popover('hide');
				};

				if (show) {
					$(element)
						.parent()
						.popover({
							content: formatMessage(contentTypesMessages.dependsOn, { dependency }),
							container: 'body',
							placement: 'left',
							trigger: 'hover'
						});

					$('#content-type-tools').on('scroll', hidePopover);
				} else {
					$('#content-type-tools').off('scroll', hidePopover);
					$(element).parent().popover('dispose');
				}
			},

			// TODO: handle validations with other types
			dependencyStatus: function (dependencyEl) {
				const status = {
					dependencyMet: false,
					supported: true
				};

				if (dependencyEl && dependencyEl.type) {
					switch (dependencyEl.type) {
						case 'text':
							status.dependencyMet = dependencyEl.value !== '';
							break;
						case 'checkbox':
							status.dependencyMet = dependencyEl.checked;
							break;
						default:
							status.supported = false;
							break;
					}
				} else {
					status.supported = false;
				}

				return status;
			},

			handleDependency: function (dependency, valueEl, properties, fieldToUpdate, emptyValue, updateFieldFn) {
				const _self = this;
				const dependencyStatus = _self.dependencyStatus(dependency);
				const isDependencyMet = dependencyStatus.dependencyMet;

				if (dependencyStatus.supported) {
					valueEl.disabled = !isDependencyMet;
					this.handleDependencyPopover(valueEl, properties.dependsOn, !isDependencyMet);
					dependency.addEventListener('propertyUpdate', (e) => {
						const isDependencyMet = _self.dependencyStatus(dependency).dependencyMet;

						const dependencyLabel = e.target.getAttribute('data-label')
							? e.target.getAttribute('data-label')
							: properties.dependsOn;

						valueEl.disabled = !isDependencyMet;
						valueEl[fieldToUpdate] = !isDependencyMet ? emptyValue : valueEl[fieldToUpdate];
						_self.handleDependencyPopover(valueEl, dependencyLabel, !isDependencyMet);

						updateFieldFn(e, valueEl);
					});
				} else {
					console.log(
						`[content-types.js] Control dependency not implemented for input of type "${properties.dependsOn}". Dependency will be ignored.`
					);
				}
			}
		};

		/**
		 * This class does the actual manipulation of the datastructure that is the form
		 * The rendering and UI figure out what to manipulate and in what ways and then call
		 * this class's methods to get the job done.
		 */
		CStudioAdminConsole.Tool.ContentTypes.FormDefMain = {
			isChanging: false,

			dragActionTimer: null,

			createDragAction: function (func, src, dest, goingUp) {
				var that = this,
					f = func,
					s = src,
					d = dest,
					gu = goingUp,
					timerDelay = 300; // 300 milliseconds

				var timer = setTimeout(function () {
					that.isChanging = true;
					that[f](s, d, gu, function () {
						YAHOO.util.DragDropMgr.refreshCache();
						that.isChanging = false;
						that.dragActionTimer = null;
					}); // callback at the end to restore isChanging and dragActionTimer values
					that = f = s = d = gu = null; // avoid mem leaks
				}, timerDelay);

				return timer;
			},

			insertNewDatasource: function (form, datasourcePrototype) {
				onSetDirty(true);
				var newDataSource = {
					id: '',
					title: '',
					properties: [],
					type: datasourcePrototype.getName(),
					form: form
				};
				newDataSource['interface'] = datasourcePrototype.getInterface();

				if (datasourcePrototype.plugin) {
					newDataSource.plugin = datasourcePrototype.plugin;
				}

				var supportedProps = datasourcePrototype.getSupportedProperties();
				for (var i = 0; i < supportedProps.length; i++) {
					var supportedProperty = supportedProps[i];
					//Assign default value if it exists
					var val = supportedProperty.defaultValue ? supportedProperty.defaultValue : '';
					newDataSource.properties[newDataSource.properties.length] = {
						name: supportedProperty.name,
						value: val,
						type: supportedProperty.type
					};
				}

				form.datasources[form.datasources.length] = newDataSource;

				return newDataSource;
			},

			/**
			 * delete a datasource
			 */
			deleteDatasource: function (datasource) {
				onSetDirty(true);
				var index = this.findDatasourceIndex(datasource);

				datasource.form.datasources.splice(index, 1);
			},

			/**
			 * insert a field
			 */
			insertNewField: function (section, fieldPrototype) {
				onSetDirty(true);
				if (section.type && section.type == 'repeat' && fieldPrototype.getName() == 'repeat') {
					// you cannot add repeats to repeats at this time
					return;
				}

				var newField = {
					constraints: [],
					defaultValue: '',
					description: '',
					help: '',
					iceId: '',
					id: fieldPrototype.id,
					properties: [],
					title: '',
					type: fieldPrototype.getName(),
					section: section
				};

				if (fieldPrototype.plugin) {
					newField.plugin = fieldPrototype.plugin;
				}

				if (fieldPrototype.getName() == 'repeat') {
					newField.fields = [];
				}

				var supportedProps = fieldPrototype.getSupportedProperties();
				for (var i = 0; i < supportedProps.length; i++) {
					var supportedProperty = supportedProps[i];
					//Assign default value if it exists
					var value = supportedProperty.defaultValue ? supportedProperty.defaultValue : '';
					newField.properties[newField.properties.length] = {
						name: supportedProperty.name,
						value: value,
						type: supportedProperty.type,
						defaultValue: supportedProperty.defaultValue
					};
				}

				var supportedConstraints = fieldPrototype.getSupportedConstraints();
				for (var j = 0; j < supportedConstraints.length; j++) {
					var supportedConstraint = supportedConstraints[j];
					newField.constraints[newField.constraints.length] = {
						name: supportedConstraint.name,
						value: '',
						type: supportedConstraint.type
					};
				}

				section.fields[section.fields.length] = newField;

				return newField;
			},

			moveField: function (srcEl, destEl, goingUp, callback) {
				onSetDirty(true);
				var src = srcEl.field ? srcEl.field : srcEl.section ? srcEl.section : null;
				var dest = destEl.field ? destEl.field : destEl.section ? destEl.section : null;

				if (src && dest) {
					// We make sure the source and destination elements are properly formed
					if (goingUp) {
						YDom.insertBefore(srcEl, destEl); // insert above
						this.moveFieldLogic(src, dest, true);
					} else {
						YDom.insertAfter(srcEl, destEl);
						this.moveFieldLogic(src, dest, false);
					}
				}
				if (typeof callback == 'function') {
					callback();
				}
			},

			/**
			 * move a field before or after another field
			 */
			moveFieldLogic: function (srcEl, destEl, before) {
				onSetDirty(true);
				if (srcEl.form) {
					// Moving sections; only section containers have the form attribute
					var srcElIndex = this.findSectionIndex(srcEl);
					srcEl.form.sections.splice(srcElIndex, 1);

					// insert it in to the new section
					var destElIndex = this.findSectionIndex(destEl);
					if (!before) {
						destElIndex++;
					}
					destEl.form.sections.splice(destElIndex, 0, srcEl);
				} else {
					// Moving items or repeat containers
					// Get the source item and remove it from its section
					var srcElIndex = this.findFieldIndex(srcEl);
					srcEl.section.fields.splice(srcElIndex, 1);

					// insert it in to the new section
					var destElIndex = this.findFieldIndex(destEl);
					if (!before) {
						destElIndex++;
					}
					destEl.section.fields.splice(destElIndex, 0, srcEl);
					srcEl.section = destEl.section;
				}
			},

			moveInside: function (srcEl, destEl, goingUp, callback) {
				onSetDirty(true);
				if (goingUp) {
					var lastChild = YDom.getLastChildBy(destEl, function (el) {
						return el.nodeName == 'DIV';
					});
					if (lastChild) {
						YDom.insertAfter(srcEl, lastChild);
					} else {
						destEl.appendChild(srcEl);
					}
					this.moveInsideLogic(srcEl.field, destEl.section, false);
				} else {
					var firstChild = YDom.getFirstChildBy(destEl, function (el) {
						return el.nodeName == 'DIV';
					});
					if (firstChild) {
						YDom.insertBefore(srcEl, firstChild);
					} else {
						destEl.appendChild(srcEl);
					}
					this.moveInsideLogic(srcEl.field, destEl.section, true);
				}

				if (typeof callback == 'function') {
					callback();
				}
			},

			/**
			 * move a field inside a container (repeat or section)
			 */
			moveInsideLogic: function (srcEl, container, insertFirst) {
				onSetDirty(true);
				// Get the source item and remove it from it's section
				var srcElIndex = this.findFieldIndex(srcEl);
				srcEl.section.fields.splice(srcElIndex, 1);

				// insert item in new section
				if (insertFirst) {
					container.fields.splice(0, 0, srcEl);
				} else {
					container.fields[container.fields.length] = srcEl;
				}
				srcEl.section = container;
			},

			moveOutside: function (srcEl, destEl, goingUp, callback) {
				onSetDirty(true);
				if (goingUp) {
					YDom.insertBefore(srcEl, destEl);
					this.moveOutsideLogic(srcEl.field, destEl.section, true);
				} else {
					YDom.insertAfter(srcEl, destEl);
					this.moveOutsideLogic(srcEl.field, destEl.section, false);
				}

				if (typeof callback == 'function') {
					callback();
				}
			},

			/**
			 * move a field outside its container (into the container's parent)
			 */
			moveOutsideLogic: function (srcEl, container, insertFirst) {
				onSetDirty(true);
				var srcElIndex = this.findFieldIndex(srcEl),
					containerIndex = this.findFieldIndex(container);

				if (container.section) {
					// We need the container's parent to move the item into

					// Remove field from container
					srcEl.section.fields.splice(srcElIndex, 1);
					if (!insertFirst) {
						containerIndex++;
					}
					// Insert field into container's parent
					container.section.fields.splice(containerIndex, 0, srcEl);
					srcEl.section = container.section;
				}
			},

			/**
			 * insert new section
			 */
			insertNewSection: function (form) {
				onSetDirty(true);
				var section = {
					description: '',
					title: '',
					defaultOpen: false,
					fields: [],
					form: form
				};

				form.sections[form.sections.length] = section;

				return section;
			},

			/**
			 * delete a section
			 */
			deleteField: function (field) {
				onSetDirty(true);
				var index = this.findFieldIndex(field);
				field.section.fields.splice(index, 1);
			},

			/**
			 * edit a field
			 */
			editField: function (field, update) {
				onSetDirty(true);
				var index = this.findFieldIndex(field);
				field.section.fields[index] = {
					...field.section.fields[index],
					...update
				};
			},

			/**
			 * delete a section
			 */
			deleteSection: function (section) {
				onSetDirty(true);
				var index = this.findSectionIndex(section);

				section.form.sections.splice(index, 1);
			},

			/**
			 * determine where in the form a datasource is
			 */
			findDatasourceIndex: function (datasource) {
				var index = -1;
				var datasources = datasource.form.datasources;

				for (var i = 0; i < datasources.length; i++) {
					if (datasources[i] == datasource) {
						index = i;
						break;
					}
				}

				return index;
			},

			/**
			 * determine where in the section a field is
			 */
			findFieldIndex: function (field) {
				var index = -1;
				if (field && field.section) {
					var fields = field.section.fields;

					for (var i = 0; i < fields.length; i++) {
						if (fields[i] === field) {
							index = i;
							break;
						}
					}
				}
				return index;
			},

			/**
			 * determine where in the form a section is
			 */
			findSectionIndex: function (section) {
				var index = -1;
				var sections = section.form.sections;

				for (var i = 0; i < sections.length; i++) {
					if (sections[i] == section) {
						index = i;
						break;
					}
				}
				return index;
			},

			/**
			 * render the definition as XML to be saved in the REPO
			 * formatting needs to come out of this and go in a function
			 */
			serializeDefinitionToXml: function (definition) {
				var quickCreate = definition.quickCreate ? definition.quickCreate : 'false';
				var quickCreatePath = definition.quickCreatePath ? definition.quickCreatePath : '';
				var xml = '<form>\r\n';
				xml +=
					'\t<title>' +
					CStudioForms.Util.escapeXml(definition.title) +
					'</title>\r\n' +
					'\t<description>' +
					CStudioForms.Util.escapeXml(definition.description) +
					'</description>\r\n' +
					'\t<objectType>' +
					definition.objectType +
					'</objectType>\r\n' +
					'\t<content-type>' +
					definition.contentType +
					'</content-type>\r\n' +
					'\t<imageThumbnail>' +
					(definition.imageThumbnail ?? '') +
					'</imageThumbnail>\r\n' +
					'\t<quickCreate>' +
					quickCreate +
					'</quickCreate>\r\n' +
					'\t<quickCreatePath>' +
					quickCreatePath +
					'</quickCreatePath>\r\n' +
					'\t<properties>';
				for (var i = 0; i < definition.properties.length; i++) {
					var property = definition.properties[i];
					if (property && property.name && property.name != 'content-type') {
						xml += '\t\t<property>\r\n';
						xml += '\t\t\t<name>' + property.name + '</name>\r\n';
						xml += '\t\t\t<label>' + CStudioForms.Util.escapeXml(property.label) + '</label>\r\n';
						xml += '\t\t\t<value>' + CStudioForms.Util.escapeXml(property.value) + '</value>\r\n';
						xml += '\t\t\t<type>' + property.type + '</type>\r\n';
						xml += '\t\t</property>\r\n';
					}
				}
				xml += '\t</properties>\r\n';

				xml += '\t<sections>';
				for (var j = 0; j < definition.sections.length; j++) {
					xml += this.renderSectionToXml(definition.sections[j]);
				}
				xml += '\t</sections>\r\n';
				xml += '\t<datasources>';
				for (var k = 0; k < definition.datasources.length; k++) {
					xml += this.renderDatasourceToXml(definition.datasources[k]);
				}
				xml += '\t</datasources>\r\n';

				xml += '</form>\r\n';

				return xml;
			},

			/**
			 * render the Config as XML to be saved in the REPO
			 * formatting needs to come out of this and go in a function
			 */
			serializeConfigToXml: function (config, formDef) {
				var xml = '<content-type name="' + formDef['content-type'] + '" is-wcm-type="true">\r\n';

				xml +=
					'\t<label>' +
					CStudioForms.Util.escapeXml(formDef.title) +
					'</label>\r\n' +
					'\t<form>' +
					CStudioForms.Util.escapeXml(formDef['content-type']) +
					'</form>\r\n' +
					'\t<form-path>' +
					CStudioForms.Util.escapeXml(config['form-path']) +
					'</form-path>\r\n' +
					'\t<model-instance-path>' +
					CStudioForms.Util.escapeXml(config['model-instance-path']) +
					'</model-instance-path>\r\n' +
					'\t<file-extension>' +
					CStudioForms.Util.escapeXml(config['file-extension']) +
					'</file-extension>\r\n' +
					'\t<content-as-folder>' +
					CStudioForms.Util.escapeXml(config['content-as-folder']) +
					'</content-as-folder>\r\n' +
					'\t<previewable>' +
					CStudioForms.Util.escapeXml(config.previewable) +
					'</previewable>\r\n' +
					'\t<quickCreate>' +
					CStudioForms.Util.escapeXml(formDef.quickCreate) +
					'</quickCreate>\r\n' +
					'\t<quickCreatePath>' +
					CStudioForms.Util.escapeXml(formDef.quickCreatePath) +
					'</quickCreatePath>\r\n';

				xml += `\t<!-- Specifies whether a form-controller.js is present in the type definition and should be loaded by the Forms Engine -->\n`;
				xml += `\t<controller>${config.controller === 'true'}</controller>\n`;

				if (formDef.imageThumbnail && formDef.imageThumbnail != '' && formDef.imageThumbnail != 'undefined') {
					xml +=
						'\t<noThumbnail>' +
						CStudioForms.Util.escapeXml('false') +
						'</noThumbnail>\r\n' +
						'\t<image-thumbnail>' +
						formDef.imageThumbnail +
						'</image-thumbnail>\r\n';
				} else {
					xml += '\t<noThumbnail>true</noThumbnail>\r\n' + '\t<image-thumbnail></image-thumbnail>\r\n';
				}

				if (config.paths) {
					xml += '\t<paths>\r\n';

					if (config.paths.excludes) {
						xml += '\t\t<excludes>\r\n';

						if (config.paths.excludes.pattern instanceof Array) {
							for (var x = 0; x < config.paths.excludes.pattern.length; x++) {
								xml +=
									'\t\t\t<pattern>' + CStudioForms.Util.escapeXml(config.paths.excludes.pattern[x]) + '</pattern>\r\n';
							}
						} else {
							xml += '\t\t\t<pattern>' + CStudioForms.Util.escapeXml(config.paths.excludes.pattern) + '</pattern>\r\n';
						}

						xml += '\t\t</excludes>\r\n';
					}
					if (config.paths.includes) {
						xml += '\t\t<includes>\r\n';

						if (config.paths.includes.pattern instanceof Array) {
							for (var x = 0; x < config.paths.includes.pattern.length; x++) {
								xml +=
									'\t\t\t<pattern>' + CStudioForms.Util.escapeXml(config.paths.includes.pattern[x]) + '</pattern>\r\n';
							}
						} else {
							xml += '\t\t\t<pattern>' + CStudioForms.Util.escapeXml(config.paths.includes.pattern) + '</pattern>\r\n';
						}

						xml += '\t\t</includes>\r\n';
					}

					xml += '\t</paths>\r\n';
				}

				if (config['delete-dependencies']) {
					xml += '\t<delete-dependencies>\r\n';

					if (config['delete-dependencies']['delete-dependency']) {
						if (config['delete-dependencies']['delete-dependency'] instanceof Array) {
							for (var x = 0; x < config['delete-dependencies']['delete-dependency'].length; x++) {
								xml += '\t\t<delete-dependency>\r\n';

								if (config['delete-dependencies']['delete-dependency'][x]['pattern']) {
									xml +=
										'\t\t\t<pattern>' +
										CStudioForms.Util.escapeXml(config['delete-dependencies']['delete-dependency'][x]['pattern']) +
										'</pattern>\r\n';
								}
								if (config['delete-dependencies']['delete-dependency'][x]['remove-empty-folder']) {
									xml +=
										'\t\t\t<remove-empty-folder>' +
										CStudioForms.Util.escapeXml(
											config['delete-dependencies']['delete-dependency'][x]['remove-empty-folder']
										) +
										'</remove-empty-folder>\r\n';
								}
								xml += '\t\t</delete-dependency>\r\n';
							}
						} else {
							xml += '\t\t<delete-dependency>\r\n';
							if (config['delete-dependencies']['delete-dependency']['pattern']) {
								xml +=
									'\t\t\t<pattern>' +
									CStudioForms.Util.escapeXml(config['delete-dependencies']['delete-dependency']['pattern']) +
									'</pattern>\r\n';
							}
							if (config['delete-dependencies']['delete-dependency']['remove-empty-folder']) {
								xml +=
									'\t\t\t<remove-empty-folder>' +
									CStudioForms.Util.escapeXml(
										config['delete-dependencies']['delete-dependency']['remove-empty-folder']
									) +
									'</remove-empty-folder>\r\n';
							}
							xml += '\t\t</delete-dependency>\r\n';
						}
					}
					xml += '\t</delete-dependencies>\r\n';
				}

				if (config['copy-dependencies']) {
					xml += '\t<copy-dependencies>\r\n';

					if (config['copy-dependencies']['copy-dependency']) {
						if (config['copy-dependencies']['copy-dependency'] instanceof Array) {
							for (var x = 0; x < config['copy-dependencies']['copy-dependency'].length; x++) {
								xml += '\t\t<copy-dependency>\r\n';

								if (config['copy-dependencies']['copy-dependency'][x]['pattern']) {
									xml +=
										'\t\t\t<pattern>' +
										CStudioForms.Util.escapeXml(config['copy-dependencies']['copy-dependency'][x]['pattern']) +
										'</pattern>\r\n';
								}
								if (config['copy-dependencies']['copy-dependency'][x]['target']) {
									xml +=
										'\t\t\t<target>' +
										CStudioForms.Util.escapeXml(config['copy-dependencies']['copy-dependency'][x]['target']) +
										'</target>\r\n';
								}
								xml += '\t\t</copy-dependency>\r\n';
							}
						} else {
							xml += '\t\t<copy-dependency>\r\n';
							if (config['copy-dependencies']['copy-dependency']['pattern']) {
								xml +=
									'\t\t\t<pattern>' +
									CStudioForms.Util.escapeXml(config['copy-dependencies']['copy-dependency']['pattern']) +
									'</pattern>\r\n';
							}
							if (config['copy-dependencies']['copy-dependency']['target']) {
								xml +=
									'\t\t\t<target>' +
									CStudioForms.Util.escapeXml(config['copy-dependencies']['copy-dependency']['target']) +
									'</target>\r\n';
							}
							xml += '\t\t</copy-dependency>\r\n';
						}
					}
					xml += '\t</copy-dependencies>\r\n';
				}

				xml += '</content-type>\r\n';

				return xml;
			},

			/**
			 * render the xml for a section
			 */
			renderSectionToXml: function (section) {
				var sectionTitle =
					section.title != CStudioForms.Util.defaultSectionTitle
						? section.title
						: section.title + ' ' + section.timestamp;
				var xml =
					'\t\t<section>\r\n' +
					'\t\t\t<title>' +
					CStudioForms.Util.escapeXml(sectionTitle) +
					'</title>\r\n' +
					'\t\t\t<description>' +
					CStudioForms.Util.escapeXml(section.description) +
					'</description>\r\n' +
					'\t\t\t<defaultOpen>' +
					section.defaultOpen +
					'</defaultOpen>\r\n' +
					'\t\t\t<fields>\r\n';
				for (var i = 0; i < section.fields.length; i++) {
					if (section.fields[i]) {
						if (section.fields[i].type != 'repeat') {
							xml += this.renderFieldToXml(section.fields[i]);
						} else {
							xml += this.renderRepeatToXml(section.fields[i]);
						}
					}
				}
				xml += '\t\t\t</fields>\r\n' + '\t\t</section>\r\n';

				return xml;
			},

			/**
			 * render a field as xml
			 */
			renderFieldToXml: function (field) {
				// Instantiate control to get its additional fields.
				const controlClass = CStudioAdminConsole.Tool.ContentTypes.types[field.type].moduleClass;
				const control = new controlClass(
					field.id,
					{},
					{
						registerField: function () {}
					},
					[],
					[],
					[]
				);
				const additionalFields = control.getAdditionalFields?.() ?? [];

				var xml = '';
				const iceId = field.iceId ?? '';

				if (field) {
					xml +=
						'\t\t\t\t<field>\r\n' +
						'\t\t\t\t\t<type>' +
						field.type +
						'</type>\r\n' +
						'\t\t\t\t\t<id>' +
						field.id +
						'</id>\r\n' +
						'\t\t\t\t\t<iceId>' +
						iceId +
						'</iceId>\r\n' +
						'\t\t\t\t\t<title>' +
						CStudioForms.Util.escapeXml(field.title) +
						'</title>\r\n' +
						'\t\t\t\t\t<description>' +
						CStudioForms.Util.escapeXml(field.description) +
						'</description>\r\n' +
						'\t\t\t\t\t<defaultValue>' +
						CStudioForms.Util.escapeXml(field.defaultValue) +
						'</defaultValue>\r\n' +
						'\t\t\t\t\t<help>' +
						CStudioForms.Util.escapeXml(field.help) +
						'</help>\r\n';
					if (field.plugin) {
						xml += '\t\t\t\t\t<plugin>\r\n';
						if (field.plugin.pluginId) {
							xml += '\t\t\t\t\t\t<pluginId>' + field.plugin.pluginId + '</pluginId>\r\n';
						}
						if (field.plugin.type) {
							xml += '\t\t\t\t\t\t<type>' + field.plugin.type + '</type>\r\n';
						}
						if (field.plugin.name) {
							xml += '\t\t\t\t\t\t<name>' + field.plugin.name + '</name>\r\n';
						}
						if (field.plugin.filename) {
							xml += '\t\t\t\t\t\t<filename>' + field.plugin.filename + '</filename>\r\n';
						}
						xml += '\t\t\t\t\t</plugin>\r\n';
					}
					xml += '\t\t\t\t\t<properties>\r\n';
					for (var i = 0; i < field.properties.length; i++) {
						var property = field.properties[i];
						if (property) {
							var value = property.value;
							if (value === '[]') {
								value = '';
							}

							if (typeof value != 'string') {
								value = JSON.stringify(value);
							}

							xml +=
								'\t\t\t\t\t\t<property>\r\n' +
								'\t\t\t\t\t\t\t<name>' +
								property.name +
								'</name>\r\n' +
								'\t\t\t\t\t\t\t<value>' +
								CStudioForms.Util.escapeXml(value) +
								'</value>\r\n' +
								'\t\t\t\t\t\t\t<type>' +
								property.type +
								'</type>\r\n' +
								'\t\t\t\t\t\t</property>\r\n';
						}
					}
					xml += '\t\t\t\t\t</properties>\r\n' + '\t\t\t\t\t<constraints>\r\n';
					for (var j = 0; j < field.constraints.length; j++) {
						var constraint = field.constraints[j];
						if (constraint) {
							xml +=
								'\t\t\t\t\t\t<constraint>\r\n' +
								'\t\t\t\t\t\t\t<name>' +
								constraint.name +
								'</name>\r\n' +
								'\t\t\t\t\t\t\t<value><![CDATA[' +
								constraint.value +
								']]></value>\r\n' +
								'\t\t\t\t\t\t\t<type>' +
								constraint.type +
								'</type>\r\n' +
								'\t\t\t\t\t\t</constraint>\r\n';
						}
					}
					xml += '\t\t\t\t\t</constraints>\r\n';
					if (additionalFields.length > 0) {
						xml += '\t\t\t\t\t<additionalFields>\r\n';
						additionalFields.forEach((field) => {
							xml += '\t\t\t\t\t\t<id>' + field + '</id>\r\n';
						});
						xml += '\t\t\t\t\t</additionalFields>\r\n';
					}
					xml += '\t\t\t\t</field>\r\n';
				}
				return xml;
			},

			/**
			 * render a repeat as xml
			 */
			renderRepeatToXml: function (repeat) {
				var xml = '';

				if (repeat) {
					var minValue = repeat.properties[0] && repeat.properties[0].value != '' ? repeat.properties[0].value : '0';
					var maxValue = repeat.properties[0] && repeat.properties[1].value != '' ? repeat.properties[1].value : '*';

					xml +=
						'\t\t\t\t<field>\r\n' +
						'\t\t\t\t\t<type>' +
						repeat.type +
						'</type>\r\n' +
						'\t\t\t\t\t<id>' +
						repeat.id +
						'</id>\r\n' +
						'\t\t\t\t\t<iceId>' +
						repeat.iceId +
						'</iceId>\r\n' +
						'\t\t\t\t\t<title>' +
						CStudioForms.Util.escapeXml(repeat.title) +
						'</title>\r\n' +
						'\t\t\t\t\t<description>' +
						CStudioForms.Util.escapeXml(repeat.description) +
						'</description>\r\n' +
						'\t\t\t\t\t<minOccurs>' +
						minValue +
						'</minOccurs>\r\n' +
						'\t\t\t\t\t<maxOccurs>' +
						maxValue +
						'</maxOccurs>\r\n';

					xml += '\t\t\t\t\t<properties>\r\n';
					for (var i = 0; i < repeat.properties.length; i++) {
						var property = repeat.properties[i];
						if (property) {
							xml +=
								'\t\t\t\t\t\t<property>\r\n' +
								'\t\t\t\t\t\t\t<name>' +
								property.name +
								'</name>\r\n' +
								'\t\t\t\t\t\t\t<value>' +
								CStudioForms.Util.escapeXml(property.value) +
								'</value>\r\n' +
								'\t\t\t\t\t\t\t<type>' +
								property.type +
								'</type>\r\n' +
								'\t\t\t\t\t\t</property>\r\n';
						}
					}
					xml += '\t\t\t\t\t</properties>\r\n';

					xml += '\t\t\t\t\t<fields>\r\n';
					for (var i = 0; i < repeat.fields.length; i++) {
						xml += this.renderFieldToXml(repeat.fields[i]);
					}
					xml += '\t\t\t\t\t</fields>\r\n' + '\t\t\t\t</field>\r\n';
				}
				return xml;
			},

			/**
			 * render a datasource as xml
			 */
			renderDatasourceToXml: function (datasource) {
				var xml = '';

				if (datasource) {
					xml +=
						'\t\t\t\t<datasource>\r\n' +
						'\t\t\t\t\t<type>' +
						datasource.type +
						'</type>\r\n' +
						'\t\t\t\t\t<id>' +
						datasource.id +
						'</id>\r\n' +
						'\t\t\t\t\t<title>' +
						CStudioForms.Util.escapeXml(datasource.title) +
						'</title>\r\n' +
						'\t\t\t\t\t<interface>' +
						datasource['interface'] +
						'</interface>\r\n';
					if (datasource.plugin) {
						xml += '\t\t\t\t\t<plugin>\r\n';
						if (datasource.plugin.type) {
							xml += '\t\t\t\t\t\t<type>' + datasource.plugin.type + '</type>\r\n';
						}
						if (datasource.plugin.name) {
							xml += '\t\t\t\t\t\t<name>' + datasource.plugin.name + '</name>\r\n';
						}
						if (datasource.plugin.filename) {
							xml += '\t\t\t\t\t\t<filename>' + datasource.plugin.filename + '</filename>\r\n';
						}
						if (datasource.plugin.pluginId) {
							xml += '\t\t\t\t\t\t<pluginId>' + datasource.plugin.pluginId + '</pluginId>\r\n';
						}
						xml += '\t\t\t\t\t</plugin>\r\n';
					}
					xml += '\t\t\t\t\t<properties>\r\n';
					for (var i = 0; i < datasource.properties.length; i++) {
						var property = datasource.properties[i];
						if (property) {
							var value = property.value;

							if (typeof value != 'string') {
								value = JSON.stringify(value);
							}

							xml +=
								'\t\t\t\t\t\t<property>\r\n' +
								'\t\t\t\t\t\t\t<name>' +
								property.name +
								'</name>\r\n' +
								'\t\t\t\t\t\t\t<value>' +
								CStudioForms.Util.escapeXml(value) +
								'</value>\r\n' +
								'\t\t\t\t\t\t\t\t<type>' +
								property.type +
								'</type>\r\n' +
								'\t\t\t\t\t\t</property>\r\n';
						}
					}
					xml += '\t\t\t\t\t</properties>\r\n' + '\t\t\t\t</datasource>\r\n';
				}
				return xml;
			}
		};

		CStudioAdminConsole.helpInsert = function (button, identifier) {
			var $button = $(button);
			const $input = $(identifier).parent().find('input');
			$input.val($input.val() + $button.attr('data-insert'));

			$input.trigger('update_variable');
		};

		CStudioAdminConsole.cleanPostfix = (identifier, type) => {
			const $input = $(identifier).siblings('input'),
				controls = CStudioAdminConsole.Tool.ContentTypes.propertySheet.config.controls.control,
				postfixes = CStudioAdminConsole.getPostfixes(type, controls),
				currentPostfix = postfixes.filter((postfix) => $input.val().endsWith(postfix)),
				hasPostfix = currentPostfix.length > 0;

			if (hasPostfix) {
				const replace = currentPostfix + '([^' + currentPostfix + ']*)$',
					re = new RegExp(replace, 'i');

				for (var k = 0; k <= postfixes.length; k++) {
					if (currentPostfix.indexOf(postfixes[k]) > -1) {
						$input.val($input.val().replace(re, ''));
					}
				}
			}
		};

		CStudioAdminConsole.getPostfixes = (type, controls) => {
			let postfixes = [];

			if (type === 'repeat') {
				postfixes = ['_o'];
			} else {
				postfixes =
					controls && controls.find((x) => x.name === type)
						? controls.find((x) => x.name === type).supportedPostFixes
						: [];
			}

			return postfixes;
		};

		CStudioAdminConsole.renderPostfixDescriptions = function () {
			var renderPostfixDescriptions = {
				_i: CMgs.format(langBundle, 'iDescription'),
				_s: CMgs.format(langBundle, 'sDescription'),
				_l: CMgs.format(langBundle, 'lDescription'),
				_t: CMgs.format(langBundle, 'tDescription'),
				_b: CMgs.format(langBundle, 'bDescription'),
				_f: CMgs.format(langBundle, 'fDescription'),
				_d: CMgs.format(langBundle, 'dDescription'),
				_dt: CMgs.format(langBundle, 'dtDescription'),
				_to: CMgs.format(langBundle, 'toDescription'),
				_html: CMgs.format(langBundle, 'htmlDescription'),
				_o: CMgs.format(langBundle, 'oDescription'),
				_en: CMgs.format(langBundle, 'enDescription'),
				_txt: CMgs.format(langBundle, 'txtDescription')
			};

			return renderPostfixDescriptions;
		};

		CStudioAuthoring.Module.moduleLoaded('cstudio-console-tools-content-types', CStudioAdminConsole.Tool.ContentTypes);
	}

	CStudioAuthoring.Module.requireModule(
		'cstudio-forms-engine',
		'/static-assets/components/cstudio-forms/forms-engine.js',
		{},
		{ moduleLoaded }
	);
})();
