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

/**
 *  Common API
 *  Utilities: General purpose functions
 *  Constants: General purpose Constants
 *  RequiredResources: part of the bootstrap, loads base required scripts/css
 *  SelectedContent: so much depends on contexual content, this object maintains that state
 *  Module: module system
 *  Events: All the events in the sysyem
 *  Operations: Reusable UI / Application level operations.  Call these not the services
 *  Service: All REST activity encapsulated within
 */
/** Shortcuts to YAHOO libraries **/
var YDom = YAHOO.util.Dom;
var YConnect = YAHOO.util.Connect;
var JSON = YAHOO.lang.JSON;
var YEvent = YAHOO.util.Event;
var ApproveType = false;

// Create the event.
var eventYS = document.createEvent('Event');
// Define that the event name is 'build'.
eventYS.initEvent('crafter.refresh', true, true);
eventYS.changeStructure = true;
eventYS.oldPath = null;
eventYS.typeAction = '';

// Create the event.
var eventNS = document.createEvent('Event');
// Define that the event name is 'build'.
eventNS.initEvent('crafter.refresh', true, true);
eventNS.changeStructure = false;
eventNS.typeAction = '';
eventNS.oldPath = null;

// Create the event.
var eventCM = document.createEvent('Event');
// Define that the event name is 'build'.
eventCM.initEvent('crafter.create.contenMenu', true, true);

var nodeOpen = false,
  studioTimeZone = null;

(function (undefined) {
  // Private functions
  var encodePathToNumbers = function (path) {
    var re1 = new RegExp('/', 'g');

    var res = path.replace(re1, '00'); // substitute all forward slash with '00'
    res = res.replace(/-/g, '111'); // substitute all dashes with '111'
    res = res.replace(/\./g, '010'); // substitute all periods with '010'
    return res;
  };

  var decodeNumbersToPath = function (pathWithNumbers) {
    var res = pathWithNumbers.replace(/00/g, '/');
    res = res.replace(/111/g, '-');
    res = res.replace(/010/g, '.');
    return res;
  };

  /**
   * authoring object
   */
  if (typeof CStudioAuthoring == 'undefined' || !CStudioAuthoring)
    CStudioAuthoring = {
      processing: false,
      compConfProcessing: false,

      /**
       * Registers 1 or more namespaces under the CStudioAuthoring Object and returns the last registered namespace object.
       * Note:
       *  - If the first parameter is false CStudioAuthoring will not be implied and the global scope would be the root
       *  - The method may receive multiple namespaces as parameter
       * i.e.
       *  - CStudioAuthoring.namespace("Events", "Utils.Docs", "CStudioAuthoring.Constants")
       *    creates => CStudioAuthoring.Events, CStudioAuthoring.Utils.Docs, CStudioAuthoring.Constants
       *  - CStudioAuthoring.namespace(false, "Events", "Utils.Docs", "CStudioAuthoring.Constants")
       *    creates => Events (window.Events), Utils.Docs (window.Utils.Docs), Constants (window.Constants)
       * @param {String} multiple_arguments The namespaces to create
       * @return {Object} the last namespace object created
       */
      namespace: function () {
        var imply = arguments[0] !== false,
          oRoot = imply ? CStudioAuthoring : window,
          a = arguments,
          o = null,
          j,
          k,
          d;
        for (var i = imply ? 0 : 1, l = a.length; i < l; i++) {
          d = a[i].split('.');
          o = oRoot;
          for (
            j = !imply ? 0 : d[0] == 'CStudioAuthoring' ? 1 : 0, // Imply CStudioAuthoring if not otherwise specified
              k = d.length;
            j < k;
            j++
          ) {
            !o[d[j]] && (o[d[j]] = {});
            o = o[d[j]];
          }
        }
        return o;
      },
      /**
       * Creates and initializes a specified namespace under the CStudioAuthoring object.
       * Note:
       *  - Namespace is only created/initialized if it didn't exist before
       *  - CStudioAuthoring namespace is always taken as the root object, is always implied even if not specified
       * i.e.
       *  - { "Events": {...}, "Utils.StringUtils": {...} } creates CStudioAuthoring.Events, CStudioAuthoring.Utils.StringUtils
       *    and initialize them with the paired value of the namespace (object key)
       * @param {Object} oNamespaces An object containing the namespaces to register & initialize
       */
      register: function (oNamespaces) {
        var np,
          oNamespace,
          exists = this.isSet,
          set = YAHOO.lang.augmentObject,
          rootnp = 'CStudioAuthoring.',
          aux;
        if (arguments.length == 1) {
          for (np in oNamespaces) {
            if (!exists(np, true)) {
              oNamespace = this.namespace(np);
              if (!(typeof oNamespaces[np] == 'function')) set(oNamespace, oNamespaces[np]);
              else {
                aux = np.substr(0, 16) !== rootnp ? rootnp + np : np;
                eval(aux + '=oNamespaces[np]');
              }
            }
          }
        } else {
          np = arguments[0];
          oNamespace = this.namespace(np);
          if (typeof arguments[1] != 'function') set(oNamespace, arguments[1]);
          else {
            aux = np.substr(0, 16) !== rootnp ? rootnp + np : np;
            eval(aux + '=arguments[1]');
          }
        }
        return oNamespace;
      },
      /**
       * Checks if a namespace (or anything) has a value different from undefined, if it has been initialized
       * @param {String} namespace The namespace to check to see if initialized. Non-String values will be evaluated for a value != undefined
       * @param {Boolean} imply If true, looks for the namespace inside the CStudioAuthoring object
       */
      isSet: function (namespace, imply) {
        var o = namespace;
        if (Object.prototype.toString.call(namespace) == '[object String]') {
          var props = namespace.split('.'),
            l = props.length;
          o = imply ? CStudioAuthoring : window;
          if (l == 1) return !!o[namespace];
          for (var i = 0; i < l && o !== undefined; ++i) o = o[props[i]];
          return o !== undefined;
        }
        return o !== undefined;
      }
    };

  var CSA = CStudioAuthoring;

  function CStudioConstant(value) {
    this.getValue = function () {
      return value;
    };
  }

  CStudioConstant.prototype.toString = function () {
    return this.getValue();
  };

  CStudioConstant.toString = function () {
    return 'CStudioAuthoring.Constant';
  };

  CSA.register({
    Constant: CStudioConstant,
    /**
     * authoring events
     */
    Events: {
      contextNavLoaded: new YAHOO.util.CustomEvent('contextNavLoadedEvent', CSA),
      contextNavReady: new YAHOO.util.CustomEvent('contextNavReadyEvent', CSA),
      moduleActiveContentReady: new YAHOO.util.CustomEvent('modActiveContentEvent', CSA),

      widgetScriptLoaded: new YAHOO.util.CustomEvent('widgetScript', CSA),
      moduleScriptLoaded: new YAHOO.util.CustomEvent('moduleScript', CSA),

      contentSelected: new YAHOO.util.CustomEvent('contentSelected', CSA),
      contentUnSelected: new YAHOO.util.CustomEvent('contentunSelected', CSA)
    },
    /**
     * general place for constants
     */
    Constants: {
      /*
       * Permission checking constants */
      PERMISSION_READ: new CStudioConstant('read'),
      PERMISSION_WRITE: new CStudioConstant('write'),
      PERMISSION_DELETE: new CStudioConstant('delete'),
      PERMISSION_CREATE_FOLDER: new CStudioConstant('create folder'),
      CONFIG_FILES_PATH: '/config/studio',
      CONFIG_FILES_PATH_ADMIN: '/config',
      CONFIG_SAMPLE_FILES_PATH_ADMIN: '/configuration/samples',
      IMAGE_VALID_EXTENSIONS: ['jpg', 'jpeg', 'gif', 'png', 'tiff', 'tif', 'bmp', 'svg', 'webp'],
      MAX_INT_VALUE: 2147483647,
      CACHE_TIME_CONFIGURATION: 900000,
      CACHE_TIME_PERMISSION: 900000,
      CACHE_TIME_GET_CONTENT_ITEM: 0,
      CACHE_TIME_GET_ROLES: 900000,
      MIMETYPES: {
        navPage: { class: 'fa-file' },
        floatingPage: { class: 'fa-file-o' },
        component: { class: 'fa-puzzle-piece' },
        taxonomy: { class: 'fa-tag' },
        unknown: { class: 'fa-file-text' },
        video: { class: 'fa-file-video-o' },
        image: { class: 'fa-file-image-o' },
        pdf: { class: 'fa-file-pdf-o' },
        powerpoint: { class: 'fa-file-powerpoint-o' },
        word: { class: 'fa-file-word-o' },
        excel: { class: 'fa-file-excel-o' },
        zip: { class: 'fa-file-archive-o' },
        js: { class: 'fa-file-code-o' },
        groovy: { class: 'fa-file-code-o' },
        css: { class: 'fa-css3' },
        ftl: { class: 'fa-file-code-o' },
        font: { class: 'fa-font' }
      },
      WORKFLOWICONS: {
        processing: 'fa-spinner fa-spin',
        locked: 'fa-lock',
        neverpublished: 'fa-plus',
        deleted: 'fa-ban',
        scheduled: 'fa-clock-o',
        inworkflow: 'fa-flag',
        edited: 'fa-pencil'
      },
      STATUS: {
        submittedStatus: 'submitted',
        scheduledStatus: 'scheduled',
        inWorkflowStatus: 'in workflow'
      },
      HEADERS: 'headers',
      AUTH_HEADERS: 'AUTH_HEADERS',
      SAML: 'SAML',
      DATASOURCE_URL: '/static-assets/components/cstudio-forms/data-sources/',
      CONTROL_URL: '/static-assets/components/cstudio-forms/controls/',
      GET_ALL_CONTENT_TYPES: 'getAllContentType'
    },
    /**
     * required resources, exension of the authoring environment bootstrap
     */
    OverlayRequiredResources: {
      css: [
        '/static-assets/themes/cstudioTheme/yui/assets/skin.css',
        '/static-assets/themes/cstudioTheme/css/contextNav.css',
        '/static-assets/yui/container/assets/container.css',
        '/static-assets/libs/jquery-ui/jquery-ui.min.css'
      ],
      js: [
        '/static-assets/yui/connection/connection-min.js',
        '/static-assets/yui/json/json-min.js',
        '/static-assets/yui/resize/resize-min.js',
        '/static-assets/yui/event-delegate/event-delegate-min.js',
        '/static-assets/yui/container/container_core-min.js',
        '/static-assets/yui/menu/menu-min.js',
        '/static-assets/yui/treeview/treeview-min.js',
        '/static-assets/yui/animation/animation-min.js',
        '/static-assets/yui/container/container-min.js',
        '/static-assets/yui/selector/selector-min.js',
        '/static-assets/yui/calendar/calendar-min.js',
        '/static-assets/components/cstudio-components/loader.js',
        '/static-assets/libs/notify/notify.min.js'
      ],
      /**
       * this CSS has dynamically defined contents so load order is important
       * Context must be available
       */
      loadContextNavCss: function () {
        CSA.Utils.addCss('/static-assets/styles/temp.css');
        CSA.Utils.addCss('/static-assets/styles/forms-engine.css');
        CSA.Utils.addCss('/static-assets/styles/bootstrap-5.3.css');
      },

      /**
       * load all the resources initially
       * required to run the authoring environment
       */
      loadRequiredResources: function () {
        for (var i = 0; i < this.css.length; i++) {
          CSA.Utils.addCss(this.css[i]);
        }
        for (var j = 0; j < this.js.length; j++) {
          CSA.Utils.addJavascript(this.js[j]);
        }
      }
    },
    Clipboard: {
      /**
       * constructor
       */
      init: function () {},
      /**
       * permissions to display the items on clipboard
       */
      getPermissions: function (path, callback) {
        CSA.Service.getUserPermissions(CStudioAuthoringContext.site, path, callback);
      }
    },
    /**
     * track content that is currently selected
     */
    SelectedContent: {
      selectedContent: null,

      /**
       * constructor
       */
      init: function () {
        this.selectedContent = [];
      },

      setContent: function (contentTO) {
        this.selectedContent = [contentTO];
        CSA.Events.contentSelected.fire(contentTO);

        var event = new CustomEvent('setContentDone');
        document.dispatchEvent(event);
      },

      /**
       * content is selected, track it
       */
      selectContent: function (contentTO, avoidEvent) {
        if (this.at(contentTO) == -1) {
          this.selectedContent.push(contentTO);
          if (!avoidEvent) {
            CSA.Events.contentSelected.fire(contentTO);
          }
        }
      },

      /**
       * content unselected, stop tracking it
       */
      unselectContent: function (contentTO, avoidEvent) {
        var position = this.at(contentTO);

        if (position != -1) {
          this.selectedContent.splice(position, 1);
          if (!avoidEvent) {
            CSA.Events.contentUnSelected.fire(contentTO);
          }
        }
      },

      /**
       * return the number of selected content items
       */
      getSelectedContentCount: function () {
        return this.selectedContent.length;
      },

      /**
       * return the selected content
       */
      getSelectedContent: function () {
        return this.selectedContent;
      },

      /**
       * return the position of the item
       */
      at: function (contentTO) {
        var retAt = -1;

        var atContentToId = CSA.Utils.createContentTOId(contentTO);

        for (var i = 0; i < this.selectedContent.length; i++) {
          var curContentTO = this.selectedContent[i];
          var curContentToId = CSA.Utils.createContentTOId(curContentTO);

          if (atContentToId == curContentToId) {
            retAt = i;
            break;
          }
        }

        return retAt;
      },

      /**
       * Unselects or clears all the selected items from the data structure
       *
       */
      clear: function () {
        this.selectedContent = [];
        CSA.Events.contentUnSelected.fire();
      }
    },
    /**
     * authoring module manager
     */
    Module: {
      loadedModules: new Array(),
      waitingForModule: new Array(),

      /**
       * either receive the Module Class or wait for it to be loaded
       */
      requireModule: function (moduleName, script, moduleConfig, callback) {
        var moduleClass = this.loadedModules[moduleName];

        if (!moduleClass) {
          if (!this.waitingForModule) {
            this.waitingForModule = [];
          }

          var waiting = this.waitingForModule[moduleName];

          if (!waiting) {
            waiting = [];
          }

          waiting.push({ callback: callback, moduleConfig: moduleConfig });
          this.waitingForModule[moduleName] = waiting;
          const onError = moduleConfig ? moduleConfig.onError : null;

          CSA.Utils.addJavascript(script, onError);
        } else {
          callback.moduleLoaded(moduleName, moduleClass, moduleConfig);
        }
      },

      /**
       * event that module has been loaded for those wating
       */
      moduleLoaded: function (moduleName, moduleClass) {
        this.loadedModules[moduleName] = moduleClass;

        try {
          var waiting = this.waitingForModule[moduleName];
          var waiter;

          if (waiting) {
            for (var i = 0; i < waiting.length; i++) {
              waiter = waiting[i];

              if (waiter.callback) {
                var config = waiter.moduleConfig ? waiter.moduleConfig : {};
                waiter.callback.moduleLoaded(moduleName, moduleClass, config);
              }
            }
          }
        } catch (err) {
          var msg = '';
          msg += 'Error while loading module: ' + moduleName + '\r\n';
          msg += 'Err:' + err + '\r\n';
          msg += 'callback:' + (waiter.callback ? waiter.callback : 'none') + '\r\n';
          msg += 'moduleClass:' + (waiter.moduleClass ? moduleClass.moduleClass : 'none') + '\r\n';
          msg += 'moduleConfig:' + (waiter.moduleConfig ? moduleClass.moduleConfig : 'none') + '\r\n';

          if (window.console && window.console.log) {
            window.console.log(msg);
          }
        }
      }
    },
    /**
     * common operations
     */
    Operations: {
      _showDialogueView: function (oRequest, setZIndex, dialogWidth) {
        var width = dialogWidth ? dialogWidth : '602px';
        var Loader = CSA.Env.Loader,
          moduleid = oRequest.controller;
        var fn = function () {
          var dialogueId = CSA.Utils.getScopedId(moduleid || 'view'),
            Controller,
            dialogue;
          Controller = CSA.Env.ModuleMap.get(moduleid);
          dialogue = new CSA.Component.Dialogue(dialogueId, {
            loadBody: {
              loaderFn: oRequest.fn,
              callback: function () {
                /* set timezone dynamically */
                if (arguments[0] && arguments[0].getResponseHeader && arguments[0].getResponseHeader.Timezone) {
                  var timeZoneText = arguments[0].getResponseHeader.Timezone;
                  if (timeZoneText) {
                    timeZoneText = timeZoneText.replace(/^\s+|\s+$/, '');
                    var oTimeZoneSpan = YDom.get('timeZone');
                    if (oTimeZoneSpan) {
                      oTimeZoneSpan.innerHTML = timeZoneText;
                    }
                  }
                }
                var view;
                if (Controller) {
                  view = new Controller({ context: dialogueId });
                  view.on('end', function () {
                    dialogue.destroy();
                  });
                }
                oRequest.callback && oRequest.callback.call(view, dialogue);
                dialogue.centreY();
              }
            },
            fixedcenter: true,
            width: width,
            modal: true,
            close: false,
            underlay: 'none',
            autofillheight: null
          });
          dialogue.render(document.body);
          dialogue.centreY();

          // set z-index to 101 so that dialog will display over context nav bar
          if (setZIndex && dialogue.element && dialogue.element.style.zIndex != '') {
            dialogue.element.style.setProperty('z-index', '1040', 'important');
            dialogue.mask.style.zIndex = '1030';
          }
        };
        var params = ['component-dialogue'];
        oRequest.controller && params.push(oRequest.controller);
        params.push(fn);
        Loader.use.apply(Loader, params);
      },

      simpleDialogTypeINFO: 'INFO',
      simpleDialogTypeWARN: 'WARN',
      simpleDialogTypeERROR: 'ERROR',

      showSimpleDialog: function (id, type, header, message, buttonsArray, dialogType, className, width, customZIndex) {
        var dialogId = id;

        if (!buttonsArray) {
          buttonsArray = [
            {
              text: 'OK',
              handler: destroyDialog,
              isDefault: false
            }
          ];
        }

        var dialog = new YAHOO.widget.SimpleDialog(dialogId, {
          width: width ? width : '400px',
          fixedcenter: true,
          visible: false,
          draggable: false,
          close: false,
          modal: true,
          text: message,
          icon: dialogType,
          constraintoviewport: true,
          buttons: buttonsArray
        });

        dialog.setHeader(header);
        dialog.render(document.body);

        var bdIcon = dialog.element.getElementsByClassName('fa')[0],
          bdHeight,
          element = dialog.element.getElementsByClassName('bd')[0],
          computedStyle = getComputedStyle(element);

        bdHeight = element.clientHeight; // height with padding
        bdHeight -= parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);

        if (dialogType) {
          if (bdHeight > bdIcon.offsetHeight) {
            bdIcon.style.marginBottom = bdHeight - 15 + 'px';
          }
        }

        if (className) {
          dialog.element.firstElementChild.className += ' ' + className;
        }

        dialog.show();

        if (customZIndex) {
          dialog.element.style.setProperty('z-index', customZIndex, 'important');
        } else {
          dialog.element.style.setProperty('z-index', '1042', 'important');
        }

        function escapeHandler(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            destroyDialog();
          }
        }

        function destroyDialog() {
          dialog.destroy();
          document.removeEventListener('keyup', escapeHandler, true);
        }

        document.addEventListener('keyup', escapeHandler, true);

        return dialog;
      },

      createNavBarDropDown: function (opt) {
        var dropdown = YDom.get(opt + '-dropdown');

        dropdown.onclick = function () {
          var className = ' ' + this.parentElement.className + ' ';

          if (~className.indexOf(' open ')) {
            this.parentElement.className = className.replace(' open ', ' ');
          } else {
            this.parentElement.className += ' open ';
          }

          document.body.addEventListener('click', dropdownCloser, false);

          function dropdownCloser(e) {
            var dropdownEl =
              e.target.id == opt + '-dropdown' ||
              e.target.parentElement.id == opt + '-dropdown' ||
              e.target.parentElement.parentElement.id == opt + '-dropdown';

            if (!dropdownEl) {
              document.body.removeEventListener('click', dropdownCloser, false);
              dropdown.parentElement.className = className.replace(' open ', ' ');
            }
          }
        };
      },

      translateContent: function (langBundle, specificSelector, dataAtt) {
        var elements,
          dataAtt = dataAtt ? dataAtt : 'data-translation';
        if (specificSelector) {
          elements = document.querySelectorAll(specificSelector + ' [' + dataAtt + ']');
        } else {
          elements = document.querySelectorAll('[' + dataAtt + ']');
        }

        for (var i = 0; i < elements.length; i++) {
          elements[i].innerHTML = CMgs.format(langBundle, elements[i].getAttribute(dataAtt));
        }
      },

      deleteContent: function (items, requestDelete, callback) {
        const eventIdSuccess = 'deleteDialogSuccess';
        const eventIdCancel = 'deleteDialogCancel';

        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_DELETE_DIALOG',
          payload: {
            open: true,
            items: items.map((item) => CrafterCMSNext.util.content.parseLegacyItemToSandBoxItem(item)),
            onSuccess: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventIdSuccess }
                },
                { type: 'CLOSE_DELETE_DIALOG' }
              ]
            },
            onClosed: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventIdCancel }
                },
                { type: 'DELETE_DIALOG_CLOSED' }
              ]
            }
          }
        });

        let unsubscribe, cancelUnsubscribe;

        unsubscribe = CrafterCMSNext.createLegacyCallbackListener(eventIdSuccess, (response) => {
          if (response) {
            eventNS.data = items;
            eventNS.typeAction = '';
            eventNS.oldPath = null;
            document.dispatchEvent(eventNS);
            cancelUnsubscribe();
            callback && callback();
            const messages = CrafterCMSNext.i18n.messages.itemSuccessMessages;
            const formatMessage = CrafterCMSNext.i18n.intl.formatMessage;
            CStudioAuthoring.Utils.showNotification(
              formatMessage(messages.itemDeleted, { count: 1 }),
              null,
              null,
              'default'
            );
          }
        });

        cancelUnsubscribe = CrafterCMSNext.createLegacyCallbackListener(eventIdCancel, () => {
          unsubscribe();
        });
      },

      viewContentHistory: function (contentObj, isWrite, rootPath) {
        const item = CrafterCMSNext.util.content.parseLegacyItemToSandBoxItem(contentObj);

        CrafterCMSNext.system.store.dispatch({
          type: 'BATCH_ACTIONS',
          payload: [
            {
              type: 'FETCH_USER_PERMISSIONS',
              payload: {
                path: item.path
              }
            },
            {
              type: 'FETCH_ITEM_VERSIONS',
              payload: {
                item,
                ...(rootPath && { rootPath })
              }
            },
            { type: 'SHOW_HISTORY_DIALOG' }
          ]
        });
      },

      viewConfigurationHistory: function (contentObj, isWrite) {
        const eventIdOnClose = 'showHistoryDialogConfigOnClose';
        const item = {
          path: contentObj.uri,
          label: contentObj.path.split('/').pop()
        };

        CrafterCMSNext.system.store.dispatch({
          type: 'BATCH_ACTIONS',
          payload: [
            {
              type: 'FETCH_USER_PERMISSIONS',
              payload: {
                path: item.path
              }
            },
            {
              type: 'FETCH_ITEM_VERSIONS',
              payload: {
                isConfig: true,
                environment: contentObj.environment,
                module: contentObj.module,
                item,
                rootPath: null
              }
            },
            {
              type: 'SHOW_HISTORY_DIALOG',
              payload: {
                onClosed: {
                  type: 'BATCH_ACTIONS',
                  payload: [
                    {
                      type: 'DISPATCH_DOM_EVENT',
                      payload: { id: eventIdOnClose }
                    },
                    { type: 'HISTORY_DIALOG_CLOSED' }
                  ]
                }
              }
            }
          ]
        });

        CrafterCMSNext.createLegacyCallbackListener(eventIdOnClose, () => {
          // TODO: we need to found a way to know when the dispatch to Revert finished and it is true
          // to call an OnSuccess Callback
          eventNS.data = contentObj;
          eventNS.typeAction = '';
          eventNS.oldPath = null;
          document.dispatchEvent(eventNS);
          amplify.publish('HISTORY_REVERT');
        });
      },

      approveCommon: function (site, items, approveType) {
        const _self = this;
        const scheduling = approveType ? 'custom' : 'now';

        const eventIdSuccess = 'publishDialogSuccess';
        const eventIdCancel = 'publishDialogCancel';
        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_PUBLISH_DIALOG',
          payload: {
            open: true,
            items: items.map((item) => CrafterCMSNext.util.content.parseLegacyItemToDetailedItem(item)),
            scheduling,
            onSuccess: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventIdSuccess }
                },
                { type: 'CLOSE_PUBLISH_DIALOG' }
              ]
            },
            onClosed: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventIdCancel }
                },
                { type: 'PUBLISH_DIALOG_CLOSED' }
              ]
            }
          }
        });

        let unsubscribe, cancelUnsubscribe;

        unsubscribe = CrafterCMSNext.createLegacyCallbackListener(eventIdSuccess, (response) => {
          _self.reloadItems(items, response);
          cancelUnsubscribe();
          const messages = CrafterCMSNext.i18n.messages.itemSuccessMessages;
          const formatMessage = CrafterCMSNext.i18n.intl.formatMessage;
          const isAdmin = CrafterCMSNext.system.store
            .getState()
            .user.rolesBySite[CrafterCMSNext.system.store.getState().sites.active].includes('admin');
          const environment = response.environment;
          const count = response.items.length;
          let message;
          if (response.schedule === 'now') {
            if (isAdmin) {
              message = formatMessage(messages.itemPublishedNow, {
                environment,
                count
              });
            } else {
              message = formatMessage(messages.itemRequestedToPublishNow, {
                environment,
                count
              });
            }
          } else {
            if (isAdmin) {
              message = formatMessage(messages.itemSchedulePublished, {
                environment,
                count
              });
            } else {
              message = formatMessage(messages.itemRequestedToSchedulePublish, {
                environment,
                count
              });
            }
          }
          CStudioAuthoring.Utils.showNotification(message, null, null, 'default');
        });

        cancelUnsubscribe = CrafterCMSNext.createLegacyCallbackListener(eventIdCancel, () => {
          unsubscribe();
        });
      },

      viewDependencies: function (site, items, approveType, defaultSelection) {
        // defaultSelection may be: 'depends-on' (default) or 'depends-on-me',
        const dependenciesShown = defaultSelection ? defaultSelection : 'depends-on';

        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_DEPENDENCIES_DIALOG',
          payload: {
            open: true,
            item: CrafterCMSNext.util.content.parseLegacyItemToSandBoxItem(items[0]),
            rootPath: CrafterCMSNext.util.path.getRootPath(items[0].path),
            dependenciesShown
          }
        });
      },

      submitContent: function (site, items) {
        const _self = this;

        const eventIdSuccess = 'publishDialogSuccess';
        const eventIdCancel = 'publishDialogCancel';
        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_PUBLISH_DIALOG',
          payload: {
            open: true,
            items: items.map((item) => CrafterCMSNext.util.content.parseLegacyItemToDetailedItem(item)),
            onSuccess: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventIdSuccess }
                },
                { type: 'CLOSE_PUBLISH_DIALOG' }
              ]
            },
            onClosed: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventIdCancel }
                },
                { type: 'PUBLISH_DIALOG_CLOSED' }
              ]
            }
          }
        });

        let unsubscribe, cancelUnsubscribe;

        unsubscribe = CrafterCMSNext.createLegacyCallbackListener(eventIdSuccess, (response) => {
          _self.reloadItems(items, response);
          cancelUnsubscribe();
        });

        cancelUnsubscribe = CrafterCMSNext.createLegacyCallbackListener(eventIdCancel, () => {
          unsubscribe();
        });
      },

      reloadItems: function (items, args) {
        var entities = { entities: [] };

        if (typeof items === 'string' || items instanceof String) {
          entities.entities.push({ item: items });
        } else {
          $.each(items, function () {
            entities.entities.push({ item: this.uri });
          });
        }

        eventNS.data = items;
        eventNS.typeAction = 'publish';
        CStudioAuthoring.Service.calculateDependencies(JSON.stringify(entities), {
          success: function (response) {
            var dependenciesObj = response.entities,
              dependencies = [];

            // add dependencies and their own dependencies
            $.each(dependenciesObj, function () {
              dependencies.push(this.item);
              $.each(this.dependencies, function () {
                dependencies.push(this.item);
              });
            });

            eventNS.dependencies = dependencies;
            document.dispatchEvent(eventNS);
            eventNS.dependencies = null;
          }
        });
      },

      /**
       * open a gallery search page
       */
      openGallerySearch: function (searchType, searchContext, select, mode, newWindow, callback, searchId) {
        var openInSameWindow = newWindow ? false : true;

        var searchUrl =
          CStudioAuthoringContext.authoringAppBaseUri + '/gallery?site=' + CStudioAuthoringContext.site + '&s=';

        if (searchType) {
          searchUrl += '&context=' + searchType;
        }

        if (searchContext.includeAspects && searchContext.includeAspects.length > 0) {
          searchUrl += '&includeAspects=';

          for (var i = 0; i < searchContext.includeAspects.length; i++) {
            searchUrl += searchContext.includeAspects[i];

            if (i < searchContext.includeAspects.length - 1) {
              searchUrl += '|';
            }
          }
        }

        if (searchContext.excludeAspects && searchContext.excludeAspects.length > 0) {
          searchUrl += '&includeAspects=';

          for (var j = 0; i < searchContext.excludeAspects.length; j++) {
            searchUrl += searchContext.excludeAspects[j];

            if (j < searchContext.excludeAspects.length - 1) {
              searchUrl += '|';
            }
          }
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.keywords)) {
          searchUrl += '&keywords=' + searchContext.keywords;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.sortBy)) {
          searchUrl += '&sortBy=' + searchContext.sortBy;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.type)) {
          searchUrl += '&type=' + searchContext.type;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.uploadTime)) {
          searchUrl += '&uploadTime=' + searchContext.uploadTime;
        }

        if (!CStudioAuthoring.Utils.isEmpty(select)) {
          searchUrl += '&selection=' + select;
        }

        if (!CStudioAuthoring.Utils.isEmpty(mode)) {
          searchUrl += '&mode=' + mode;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.itemsPerPage)) {
          searchUrl += '&ipp=' + searchContext.itemsPerPage;
        } else {
          searchUrl += '&ipp=20';
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.page)) {
          searchUrl += '&page=' + searchContext.page;
        } else {
          searchUrl += '&page=1';
        }

        if (searchContext.filters && searchContext.filters.length && searchContext.filters.length > 0) {
          for (var i = 0; i < searchContext.filters.length; i++) {
            var startDate = searchContext.filters[i].startDate;
            var endDate = searchContext.filters[i].endDate;

            if (
              (startDate != null && startDate != undefined && startDate != '') ||
              (endDate != null && endDate != undefined && endDate != '')
            ) {
              searchUrl +=
                '&' +
                searchContext.filters[i].qname +
                '=' +
                searchContext.filters[i].value +
                '|' +
                searchContext.filters[i].startDate +
                '|' +
                searchContext.filters[i].endDate;
            } else {
              searchUrl += '&' + searchContext.filters[i].qname + '=' + searchContext.filters[i].value;
            }
          }
        }

        // non filter URL data
        if (searchContext.nonFilters && searchContext.nonFilters.length && searchContext.nonFilters.length > 0) {
          for (var i = 0; i < searchContext.nonFilters.length; i++) {
            searchUrl += '&' + searchContext.nonFilters[i].qname + '=' + searchContext.nonFilters[i].value;
          }
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchId) && searchId != 'undefined') {
          searchUrl += '&searchId=' + searchId;
        } else {
          /* first time search called from other page : show empty result */
          if (!searchContext.filters || !searchContext.filters.length || searchContext.filters.length == 0)
            if (!searchContext.contextName || searchContext.contextName == 'undefined') searchUrl += '&presearch=false';
        }

        var childSearch = null;

        if (
          !searchId ||
          searchId == null ||
          searchId == 'undefined' ||
          !CStudioAuthoring.ChildSearchManager.searches[searchId]
        ) {
          childSearch = CStudioAuthoring.ChildSearchManager.createChildSearchConfig();
          childSearch.openInSameWindow = openInSameWindow;
          searchId = CStudioAuthoring.Utils.generateUUID();

          childSearch.searchId = searchId;
          childSearch.searchUrl = searchUrl + '&searchId=' + searchId;
          childSearch.saveCallback = callback;

          CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
        } else {
          if (window.opener) {
            if (window.opener.CStudioAuthoring) {
              var openerChildSearchMgr = window.opener.CStudioAuthoring.ChildSearchManager;

              if (openerChildSearchMgr) {
                childSearch = openerChildSearchMgr.searches[searchId];
                childSearch.searchUrl = searchUrl;

                openerChildSearchMgr.openChildSearch(childSearch);
              }
            }
          } else {
            childSearch = CStudioAuthoring.ChildSearchManager.searches[searchId];
            childSearch.searchUrl = searchUrl;

            CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
          }
        }
      },

      /**
       * open a search page
       */
      openSearch: function (searchContext, newWindow, callback, searchId) {
        var openInSameWindow = newWindow ? false : true;

        var searchUrl = CStudioAuthoringContext.authoringAppBaseUri + '/search?site=' + CStudioAuthoringContext.site;

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.mode)) {
          searchUrl += '&mode=' + searchContext.mode;
          if (searchContext.mode === 'select') {
            searchUrl += '&embedded=' + true;
          }
        }

        searchUrl += '&searchId=';

        searchUrl += '#/';

        const filters = searchContext.filters;
        if (!jQuery.isEmptyObject(searchContext.filters)) {
          searchUrl += `?filters=${encodeURIComponent(JSON.stringify(filters))}`;
        } else {
          searchUrl += '?';
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.keywords)) {
          searchUrl += '&keywords=' + searchContext.keywords;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.sortBy)) {
          searchUrl += '&sortBy=' + searchContext.sortBy;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.sortOrder)) {
          searchUrl += '&sortOrder=' + searchContext.sortOrder;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.page)) {
          searchUrl += '&offset=' + searchContext.offset;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.query)) {
          searchUrl += '&query=' + searchContext.query;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.path)) {
          searchUrl += '&path=' + encodeURIComponent(searchContext.path);
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchContext.preselectedPaths)) {
          searchUrl += `&preselectedPaths=${encodeURIComponent(JSON.stringify(searchContext.preselectedPaths))}`;
        }

        var childSearch = null;

        if (
          searchId == '' ||
          searchId == null ||
          searchId == 'undefined' ||
          !CStudioAuthoring.ChildSearchManager.searches[searchId]
        ) {
          childSearch = CStudioAuthoring.ChildSearchManager.createChildSearchConfig();
          childSearch.openInSameWindow = openInSameWindow;
          searchId = CStudioAuthoring.Utils.generateUUID();
          searchUrl = searchUrl.replace('&searchId=', '&searchId=' + searchId);
          childSearch.searchId = searchId;
          childSearch.searchUrl = searchUrl;
          childSearch.saveCallback = callback;

          CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
        } else {
          if (window.opener) {
            if (window.opener.CStudioAuthoring) {
              var openerChildSearchMgr = window.opener.CStudioAuthoring.ChildSearchManager;

              if (openerChildSearchMgr) {
                childSearch = openerChildSearchMgr.searches[searchId];
                childSearch.searchUrl = searchUrl;

                openerChildSearchMgr.openChildSearch(childSearch);
              }
            }
          } else {
            childSearch = CStudioAuthoring.ChildSearchManager.searches[searchId];
            childSearch.searchUrl = searchUrl;

            CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
          }
        }
      },

      /**
       * open a browse page
       */
      openBrowse: function (searchType, path, select, mode, newWindow, callback, searchId) {
        var searchContext = CStudioAuthoring.Service.createSearchContext();

        var openInSameWindow = newWindow ? false : true;

        var searchUrl =
          CStudioAuthoringContext.authoringAppBaseUri + '/browse?site=' + CStudioAuthoringContext.site + '&s=';

        if (searchType) {
          searchUrl += '&context=' + searchType;
        }

        if (!CStudioAuthoring.Utils.isEmpty(select)) {
          searchUrl += '&selection=' + select;
        }

        if (!CStudioAuthoring.Utils.isEmpty(mode)) {
          searchUrl += '&mode=' + mode;
        }

        if (path) {
          searchUrl += '&PATH=' + path;
        }

        if (!CStudioAuthoring.Utils.isEmpty(searchId) && searchId != 'undefined') {
          searchUrl += '&searchId=' + searchId;
        } else {
          /* first time search called from other page : show empty result */
          if (!searchContext.filters || !searchContext.filters.length || searchContext.filters.length == 0)
            if (!searchContext.contextName || searchContext.contextName == 'undefined') searchUrl += '&presearch=false';
        }

        var childSearch = null;

        if (
          !searchId ||
          searchId == null ||
          searchId == 'undefined' ||
          !CStudioAuthoring.ChildSearchManager.searches[searchId]
        ) {
          childSearch = CStudioAuthoring.ChildSearchManager.createChildSearchConfig();
          childSearch.openInSameWindow = openInSameWindow;
          searchId = CStudioAuthoring.Utils.generateUUID();

          childSearch.searchId = searchId;
          childSearch.searchUrl = searchUrl + '&searchId=' + searchId;
          childSearch.saveCallback = callback;

          CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
        } else {
          if (window.opener) {
            if (window.opener.CStudioAuthoring) {
              var openerChildSearchMgr = window.opener.CStudioAuthoring.ChildSearchManager;

              if (openerChildSearchMgr) {
                childSearch = openerChildSearchMgr.searches[searchId];
                childSearch.searchUrl = searchUrl;

                openerChildSearchMgr.openChildSearch(childSearch);
              }
            }
          } else {
            childSearch = CStudioAuthoring.ChildSearchManager.searches[searchId];
            childSearch.searchUrl = searchUrl;

            CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
          }
        }
      },

      /**
       * Open BrowseFilesDialog component
       */
      openBrowseFilesDialog: function (props) {
        let unmount;
        const dialogContainer = document.createElement('div');
        window.top.postMessage({ type: 'EMBEDDED_LEGACY_FORM_DISABLE_ON_CLOSE' }, '*');
        CrafterCMSNext.render(dialogContainer, 'BrowseFilesDialog', {
          ...props,
          open: true,
          onSuccess: (result) => {
            props.onSuccess?.(result);
            unmount();
          },
          onClose: () => {
            window.top.postMessage({ type: 'EMBEDDED_LEGACY_FORM_ENABLE_ON_CLOSE' }, '*');
            props.onClose?.();
            unmount();
          }
        }).then(function (done) {
          return (unmount = done.unmount);
        });
      },

      /**
       * open a browse page for WebDAV repo
       */
      openWebDAVBrowse: function (path, profileId, mode, newWindow, callback, filter = 'none') {
        var searchId = null;

        var openInSameWindow = newWindow ? false : true;

        var browseUrl =
          CStudioAuthoringContext.authoringAppBaseUri + '/browseWebDAV?site=' + CStudioAuthoringContext.site;

        if (path) {
          browseUrl += '&path=' + path;
        }

        if (profileId) {
          browseUrl += '&profileId=' + profileId;
        }

        if (filter !== 'none') {
          browseUrl += '&filter=' + filter;
        }

        if (!CStudioAuthoring.Utils.isEmpty(mode)) {
          browseUrl += '&mode=' + mode;
        }

        var childSearch = null;

        if (
          !searchId ||
          searchId == null ||
          searchId == 'undefined' ||
          !CStudioAuthoring.ChildSearchManager.searches[searchId]
        ) {
          childSearch = CStudioAuthoring.ChildSearchManager.createChildSearchConfig();
          childSearch.openInSameWindow = openInSameWindow;
          searchId = CStudioAuthoring.Utils.generateUUID();

          childSearch.searchId = searchId;
          childSearch.searchUrl = browseUrl + '&searchId=' + searchId;
          childSearch.saveCallback = callback;

          CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
        } else {
          if (window.opener) {
            if (window.opener.CStudioAuthoring) {
              var openerChildSearchMgr = window.opener.CStudioAuthoring.ChildSearchManager;

              if (openerChildSearchMgr) {
                childSearch = openerChildSearchMgr.searches[searchId];
                childSearch.searchUrl = browseUrl;

                openerChildSearchMgr.openChildSearch(childSearch);
              }
            }
          } else {
            childSearch = CStudioAuthoring.ChildSearchManager.searches[searchId];
            childSearch.searchUrl = browseUrl;

            CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
          }
        }
      },

      /**
       * open a browse page for S3 repo
       */
      openS3Browse: function (profileId, path, mode, newWindow, callback, filter = 'none') {
        var searchId = null;

        var openInSameWindow = newWindow ? false : true;

        var browseUrl = CStudioAuthoringContext.authoringAppBaseUri + '/browseS3?site=' + CStudioAuthoringContext.site;

        if (profileId) {
          browseUrl += '&profileId=' + profileId;
        }

        if (path) {
          browseUrl += '&path=' + path;
        }

        if (filter !== 'none') {
          browseUrl += '&filter=' + filter;
        }

        if (!CStudioAuthoring.Utils.isEmpty(mode)) {
          browseUrl += '&mode=' + mode;
        }

        var childSearch = null;

        if (
          !searchId ||
          searchId == null ||
          searchId == 'undefined' ||
          !CStudioAuthoring.ChildSearchManager.searches[searchId]
        ) {
          childSearch = CStudioAuthoring.ChildSearchManager.createChildSearchConfig();
          childSearch.openInSameWindow = openInSameWindow;
          searchId = CStudioAuthoring.Utils.generateUUID();

          childSearch.searchId = searchId;
          childSearch.searchUrl = browseUrl + '&searchId=' + searchId;
          childSearch.saveCallback = callback;

          CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
        } else {
          if (window.opener) {
            if (window.opener.CStudioAuthoring) {
              var openerChildSearchMgr = window.opener.CStudioAuthoring.ChildSearchManager;

              if (openerChildSearchMgr) {
                childSearch = openerChildSearchMgr.searches[searchId];
                childSearch.searchUrl = browseUrl;

                openerChildSearchMgr.openChildSearch(childSearch);
              }
            }
          } else {
            childSearch = CStudioAuthoring.ChildSearchManager.searches[searchId];
            childSearch.searchUrl = browseUrl;

            CStudioAuthoring.ChildSearchManager.openChildSearch(childSearch);
          }
        }
      },

      /**
       * Based on content item, returns preview url properly
       *
       * @param contentTO {object} item data
       * @param useAppBase {boolean} if false, forces url to be returned without baseUri
       *
       * return {string}
       */
      getPreviewUrl: function (contentTO, useAppBase, noReplaceExtension) {
        var url = '';
        var baseUri = useAppBase === false ? '' : CStudioAuthoringContext.previewAppBaseUri;
        var filename = encodeURI(contentTO.pathSegment ? contentTO.pathSegment : contentTO.name);
        if (CStudioAuthoring.Utils.endsWith(filename, '.xml')) {
          url = baseUri + contentTO.browserUri;

          url = noReplaceExtension ? url : url.replace('.xml', '.html');

          if (contentTO.document && contentTO.assets && contentTO.assets.length == 1) {
            url = baseUri + contentTO.assets[0].uri;
          }
        } else {
          url = baseUri + encodeURI(contentTO.uri);
        }
        return url || '/';
      },

      /**
       * given a transfer object, open a preview URL
       */
      openPreview: function (contentTO, windowId, soundTone, inContextEdit, targetWindowId) {
        if (!targetWindowId) {
          // if no target is supplied assume local call
          // basically mimics behavior before target was implmented
          targetWindowId = window.name;
        }

        var url = this.getPreviewUrl(contentTO);

        if (inContextEdit) {
          window.location.reload();
        } else {
          // remove server name and port etc
          if (url.indexOf('//') != -1) {
            url = url.replace('//', '--x--');
            url = url.substring(url.indexOf('/'));
            if (url.indexOf('--x--') != -1) {
              url = '/';
            }
          }
          const state = CrafterCMSNext.system.store.getState();
          window.location = CrafterCMSNext.util.system.getSystemLink({
            systemLinkId: 'preview',
            authoringBase: state.env.authoringBase,
            site: CStudioAuthoringContext.site,
            page: url
          });
        }
      },

      /**
       * open a content form
       * @param formId is the form ID
       * @param id contentID (path or id) if available otherwise null
       * @param nodeRef nodeRef if available otherwise null
       * @param path is the contextual path where the context should be created
       * @param edit true/false is this an edit or a new?
       * @param popup true false, open as a popup
       * @param respLabel is the user viewable name that is sent back from the form (should map to a field ID)
       * @param respValue is the ID that is sent back from the form (should map to a field ID)
       * @param callback is the callback that should be fired when the form is closed
       * @param newly added includeMetaData
       */
      openContentWebForm: function (
        formId,
        id,
        nodeRef,
        path,
        edit,
        asPopup,
        callback,
        auxParams,
        includeMetaData,
        isFlattenedInclude
      ) {
        var readOnly = false;

        auxParams = auxParams ? auxParams : [];

        for (var j = 0; j < auxParams.length; j++) {
          if (auxParams[j].name === 'readonly') {
            readOnly = true;
          }
        }

        if (readOnly) {
          CStudioAuthoring.Operations.openContentWebFormWithPermission(
            formId,
            id,
            nodeRef,
            path,
            edit,
            asPopup,
            callback,
            'true',
            auxParams,
            includeMetaData,
            isFlattenedInclude
          );
        } else {
          // Check permissions etc.
          var permissionPath = '';
          if (!CStudioAuthoring.Utils.isEmpty(id)) {
            permissionPath = id;
          } else {
            permissionPath = path;
          }
          CStudioAuthoring.Service.getUserPermissions(CStudioAuthoringContext.site, permissionPath, {
            success: function (results) {
              var isWrite = CStudioAuthoring.Service.isWrite(results.permissions);
              if (isWrite) {
                readOnly = 'false';
              } else {
                readOnly = 'true';
              }
              CStudioAuthoring.Operations.openContentWebFormWithPermission(
                formId,
                id,
                nodeRef,
                path,
                edit,
                asPopup,
                callback,
                readOnly,
                auxParams,
                includeMetaData,
                isFlattenedInclude
              );
            },
            failure: function () {
              CStudioAuthoring.Operations.openContentWebFormWithPermission(
                formId,
                id,
                nodeRef,
                path,
                edit,
                asPopup,
                callback,
                'true',
                auxParams,
                includeMetaData,
                isFlattenedInclude
              );
            }
          });
        }
      },

      /**
       * open a content form
       * @param formId is the form ID
       * @param id contentID (path or id) if available otherwise null
       * @param nodeRef nodeRef if available otherwise null
       * @param path is the contextual path where the context should be created
       * @param edit true/false is this an edit or a new?
       * @param asPopup true false, open as a popup
       * @param callback is the callback that should be fired when the form is closed
       * @param readOnly Permission to indicate how the form is going to be opened
       * @param respLabel is the user viewable name that is sent back from the form (should map to a field ID)
       * @param respValue is the ID that is sent back from the form (should map to a field ID)
       * @param newly added includeMetaData
       */
      openContentWebFormWithPermission: function (
        formId,
        id,
        nodeRef,
        path,
        edit,
        asPopup,
        callback,
        readOnly,
        auxParams,
        includeMetaData,
        isFlattenedInclude
      ) {
        if (!auxParams) {
          auxParams = [];
        }

        if (id) {
          CStudioAuthoring.Service.lookupContentItem(
            CStudioAuthoringContext.site,
            path,
            {
              success: function (contentTO) {
                CStudioAuthoring.Operations.performSimpleIceEdit(
                  contentTO.item,
                  null, // field
                  this.isEdit,
                  this.callback,
                  this.aux,
                  isFlattenedInclude
                );
              },
              failure: function (response) {
                callback.failure(response);
              },
              isEdit: edit,
              callback: callback,
              aux: auxParams
            },
            false,
            false
          );
        } else {
          // new item
          CStudioAuthoring.Operations.performSimpleIceEdit(
            { contentType: formId, uri: path },
            null, // field
            false, // isEdit
            callback,
            auxParams, // aux
            isFlattenedInclude
          );
        }
      },

      /**
       * this method will open a form with the legacy form server
       * this method is maintained for backward compatability and for extremely complex use cases
       */
      openContentWebFormLegacyFormServer: function (
        formId,
        id,
        noderef,
        path,
        edit,
        asPopup,
        callback,
        readOnly,
        auxParams,
        includeMetaData
      ) {
        CStudioAuthoring.Operations.showSimpleDialog(
          'error-dialog',
          CStudioAuthoring.Operations.simpleDialogTypeINFO,
          CMgs.format(formsLangBundle, 'notification'),
          CMgs.format(formsLangBundle, 'legacyFormNoSupported'),
          null, // use default button
          YAHOO.widget.SimpleDialog.ICON_INFO,
          'studioDialog'
        );
      },

      addMetadata: function (params) {
        if (typeof CStudioForms != 'undefined' && CStudioForms) {
          var metadataControl = CStudioForms.nodeManagers['page-metadata'];
          if (metadataControl) {
            if (metadataControl.hasPageId() && metadataControl.hasPageIdGroup()) {
              metadataControl.addToParams(params);
            }
          }
        }
        return params;
      },

      hasParam: function (params, name) {
        for (var i = 0; i < params.length; i++) {
          if (params[i].name == name) return true;
        }
        return false;
      },

      /**
       * create a new taxonomy item
       */
      newTaxonomy: function (site, modelName, level, newCb) {
        var openDialogCb = {
          moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
            dialogClass.showDialog(moduleConfig.site, moduleConfig.modelName, moduleConfig.level, moduleConfig.newCb);
          }
        };

        var moduleConfig = {
          site: site,
          modelName: modelName,
          level: level,
          newCb: newCb
        };

        CStudioAuthoring.Module.requireModule(
          'dialog-new-taxonomy',
          '/static-assets/components/cstudio-dialogs/new-taxonomy.js',
          moduleConfig,
          openDialogCb
        );
      },

      performSimpleIceEdit: function (
        item,
        field,
        isEdit,
        callback,
        aux,
        isFlattenedInclude,
        openHidden,
        fieldsIndexes
      ) {
        let topWindow = getTopLegacyWindow();
        var editorId = CStudioAuthoring.Utils.generateUUID();

        if (callback) {
          CStudioAuthoring.InContextEdit.registerIceCallback(editorId, callback);
        }

        var id = CSA.Utils.getScopedId(),
          controller = 'viewcontroller-in-context-edit',
          animator,
          view;

        isEdit = typeof isEdit === 'undefined' ? true : isEdit;

        var $modal = $(`<div class="studio-form-modal" ${openHidden ? `style="visibility: hidden"` : ''}>
                   <div class="no-ice-mask"></div>
                    <div
                    class="studio-ice-dialog studio-ice-container-${editorId}"
                    style="display: none; height: ${$(window).height() * 0.75}px"
                    >
                    <div class="bd overlay" id="${id}"></div>
                    </div>
              </div>`);

        if (aux && aux.length) {
          for (var j = 0; j < aux.length; j++) {
            if (aux[j].ontop) {
              $modal.find('.studio-ice-dialog').css('z-index', 1042);
            }
          }
        }

        animator = new crafter.studio.Animator($modal.find('.studio-ice-dialog'));

        !callback &&
          (callback = {
            success: function () {
              if (CStudioAuthoringContext.isPreview) {
                CStudioAuthoringContext.Service.refreshPreview();
              } else {
                window.location.reload();
              }
            }
          });

        $modal.appendTo(topWindow.document.body);

        animator.fadeIn();

        CSA.Env.Loader.use(controller, function () {
          topWindow.studioFormZorder = topWindow.studioFormZorder ? topWindow.studioFormZorder + 1 : 9999;
          var template =
            '<iframe ' +
            /**/ 'id="in-context-edit-editor-' +
            editorId +
            '" ' +
            /**/ 'frameborder="0" ' +
            /**/ 'style="z-index:' +
            topWindow.studioFormZorder +
            ';" ' +
            /**/ 'onload="CStudioAuthoring.InContextEdit.autoSizeIceDialog();"' +
            '>' +
            '</iframe>';

          $modal.find('.bd').html(template);

          var Controller = CSA.Env.ModuleMap.get(controller);

          view = new Controller({ context: id, editorId: editorId });

          view.initializeContent(
            item,
            field,
            CStudioAuthoringContext.site,
            isEdit,
            callback,
            $modal.find('.studio-ice-container-' + editorId),
            aux,
            editorId,
            isFlattenedInclude,
            fieldsIndexes
          );

          view.on('end', function () {
            $modal.remove();
          });

          view.on('updateContent', function (evt, args) {
            callback.success();
          });

          if ($.fn.resizable) {
            $modal.find('.studio-ice-dialog').resizable({
              minHeight: 50,
              grid: [10000, 1],
              create: function (event, ui) {},
              start: function (event, ui) {
                $('#engineWindow', topWindow.document).css('pointer-events', 'none');
                $('#in-context-edit-editor-' + editorId, topWindow.document).css('pointer-events', 'none');
              },
              stop: function (event, ui) {
                $('#engineWindow', topWindow.document).css('pointer-events', 'auto');
                $('#in-context-edit-editor-' + editorId, topWindow.document).css('pointer-events', 'auto');
              },
              handles: 'e, s, se'
            });
          }
        });
      },

      openDiff: function (site, path, version, versionTO, escaped) {
        let topWindow = getTopLegacyWindow();
        topWindow.studioFormZorder = topWindow.studioFormZorder ? topWindow.studioFormZorder + 1 : 9999;
        var id = CSA.Utils.getScopedId(),
          animator,
          editorId = CStudioAuthoring.Utils.generateUUID(),
          $modal = $(
            '<div><div class="no-ice-mask"></div><div class="studio-ice-dialog studio-ice-container" id="studio-ice-container-' +
              editorId +
              '" style="display:none;"><div class="bd"></div></div></div>'
          ),
          template =
            '<iframe name="diffDialog" id="in-context-edit-editor-' +
            editorId +
            '" frameborder="0" style="z-index:' +
            topWindow.studioFormZorder +
            ';" onload="CStudioAuthoring.FilesDiff.autoSizeIceDialog(\'' +
            editorId +
            '\');"></iframe>',
          parentEl = topWindow.document.body,
          diffUrl;

        animator = new crafter.studio.Animator($modal.find('.studio-ice-container'));

        window.setTimeout(function () {
          $(function () {
            $modal.find('.studio-ice-dialog').each(function () {
              var $this = $(this);
              $this.resizable({
                minHeight: 50,
                grid: [10000, 1],
                start: function (event, ui) {
                  $('#engineWindow').css('pointer-events', 'none');
                  $('#in-context-edit-editor-' + editorId)
                    .css('pointer-events', 'none')
                    .height('');
                },
                stop: function (event, ui) {
                  $('#engineWindow').css('pointer-events', 'auto');
                  $('#in-context-edit-editor-' + editorId).css('pointer-events', 'auto');
                }
              });
            });
          });
        }, 1000);

        $modal.find('.bd').html(template).end().appendTo(parentEl);
        $modal.find('.studio-ice-container').css('z-index', 1040);

        $('body').on('diff-end', function () {
          $modal.remove();
        });

        diffUrl = CStudioAuthoringContext.baseUri + '/diff?site=' + site + '&path=' + path + '&version=' + version;
        diffUrl = versionTO ? diffUrl + '&versionTO=' + versionTO : diffUrl;
        diffUrl += '&mode=iframe';
        diffUrl += escaped ? '&escaped=true' : '';

        window.open(diffUrl, 'diffDialog');

        animator.slideInDown();
      },

      _openIframe: function (url, name, showCollapseBtn = true) {
        let topWindow = getTopLegacyWindow();
        var id = CSA.Utils.getScopedId(),
          animator,
          editorId = CStudioAuthoring.Utils.generateUUID(),
          modalTpl =
            '<div class="studio-iframe-view">' +
            '   <div class="overlay">' +
            '   </div>' +
            '   <div class="studio-ice-dialog studio-ice-container studio-ice-container-' +
            editorId +
            '" id="studio-ice-container-' +
            editorId +
            '">' +
            '<div class="bd">';

        if (showCollapseBtn) {
          modalTpl += '<input id="colExpButton" class="btn btn-default" type="button" value="Collapse">';
        }
        modalTpl += '</div></div></div>';
        ($modal = $(modalTpl)),
          (template =
            '<iframe name="' +
            name +
            '" id="in-context-edit-editor-' +
            editorId +
            '" frameborder="0" style="z-index:' +
            topWindow.studioFormZorder +
            ';" onload="CStudioAuthoring.FilesDiff.autoSizeIceDialog(\'' +
            editorId +
            '\');"></iframe>'),
          (parentEl = topWindow.document.body);

        animator = new crafter.studio.Animator($modal.find('.studio-ice-container'));

        window.setTimeout(function () {
          $(function () {
            $modal.find('.studio-ice-dialog').resizable({
              minHeight: 50,
              grid: [10000, 1],
              start: function (event, ui) {
                $('#engineWindow', topWindow.document).css('pointer-events', 'none');
                $('#in-context-edit-editor-' + editorId, topWindow.document)
                  .css('pointer-events', 'none')
                  .height('');
              },
              stop: function (event, ui) {
                $('#engineWindow', topWindow.document).css('pointer-events', 'auto');
                $('#in-context-edit-editor-' + editorId, topWindow.document).css('pointer-events', 'auto');
              }
            });
          }, 1000);

          $modal.on('click', '#colExpButton', function () {
            var dialog = window.parent.$('.studio-ice-container-' + editorId),
              dialogContainer = dialog.parent(),
              controlContainer = dialog.find('.bd'),
              colExpButtonBtn = $('#colExpButtonBtn'),
              overlayContainer = dialogContainer.find('.overlay'),
              iframe = dialog.find('iframe');

            if (!controlContainer.hasClass('collapseForm')) {
              CStudioAuthoring.Utils.Cookies.createCookie('formEngineHeight', $(dialog).height().toString());
              $(dialog).css('cssText', $(dialog).attr('style') + 'height: 65px !important');
              controlContainer.addClass('collapseForm');
              overlayContainer && overlayContainer.addClass('overlay-collapsed');
              overlayContainer.hide();
            } else {
              $(dialog).height(parseInt(CStudioAuthoring.Utils.Cookies.readCookie('formEngineHeight')));
              controlContainer.removeClass('collapseForm');
              overlayContainer && overlayContainer.removeClass('overlay-collapsed');
              overlayContainer.show();
            }
          });
        });

        $modal.find('.bd').append(template).end().appendTo(parentEl);
        $modal.find('.studio-ice-container').css('z-index', 1035);

        getTopLegacyWindow().iframeOpener = window;
        window.open(url, name);

        animator.slideInDown();
      },

      getImageRequest: function (data) {
        var callback = {
          success: function (oResponse) {
            data.image.src = data.url;
          },
          failure: function (oResponse) {
            var secondCallback = {
              success: function (oResponse) {
                data.image.src = data.url;
              },
              failure: function (oResponse) {
                data.image.src = data.url;
              }
            };
            setTimeout(function () {
              CStudioAuthoring.Service.getImageRequest({ url: data.url, callback: secondCallback });
            }, 700);
          }
        };
        CStudioAuthoring.Service.getImageRequest({ url: data.url, callback: callback });
      },

      getloadItems: function (data) {
        var callback = {
          success: function (oResponse) {},
          failure: function (oResponse) {}
        };
        CStudioAuthoring.Service.getImageRequest({ url: data.url, callback: callback });
      },

      /**
       * create content for a given site, at a given path
       * opens a dialog if needed or goes directly to the form if no
       * template selection is require (only one option
       */
      createNewContentForType: function (site, path, type, asPopup, formSaveCb, childForm) {
        var auxParams = [];
        if (childForm && childForm == true) {
          auxParams = [{ name: 'childForm', value: 'true' }];
        }

        CStudioAuthoring.Operations.openContentWebForm(type, null, null, path, false, asPopup, formSaveCb, auxParams);
      },
      /**
       * create content for a given site, at a given path
       * opens a dialog if needed or goes directly to the form if no
       * template selection is require (only one option
       */
      createNewContent: function (
        site,
        path,
        asPopup,
        formSaveCb,
        childForm,
        isFlattenedInclude,
        filterCB,
        baseRepoPath
      ) {
        var auxParams = [];
        if (childForm && childForm == true) {
          auxParams = [{ name: 'childForm', value: 'true' }];
        }

        var callback = {
          success: function (contentTypes) {
            if (filterCB) {
              contentTypes = contentTypes.filter(filterCB);
            }

            if (contentTypes.length == 0) {
              var dialogEl = document.getElementById('errMissingRequirements');
              if (!dialogEl) {
                var dialog = new YAHOO.widget.SimpleDialog('errMissingRequirements', {
                  width: '400px',
                  fixedcenter: true,
                  visible: false,
                  draggable: false,
                  close: false,
                  modal: true,
                  text: CMgs.format(formsLangBundle, 'noContentTypes') + ' ' + path,
                  icon: YAHOO.widget.SimpleDialog.ICON_BLOCK,
                  constraintoviewport: true,
                  buttons: [
                    {
                      text: CMgs.format(formsLangBundle, 'ok'),
                      handler: function () {
                        this.hide();
                      },
                      isDefault: false
                    }
                  ]
                });
                dialog.setHeader(CMgs.format(formsLangBundle, 'cancelDialogHeader'));
                dialog.render(document.body);
                dialogEl = document.getElementById('errMissingRequirements');
                dialogEl.dialog = dialog;
              }
              dialogEl.dialog.show();
            } else if (contentTypes.length == 1) {
              var formId = contentTypes[0].form;

              CStudioAuthoring.Operations.openContentWebForm(
                formId,
                null,
                null,
                path,
                false,
                asPopup,
                formSaveCb,
                auxParams,
                null,
                isFlattenedInclude
              );
            } else {
              var selectTemplateCb = {
                success: function (selectedTemplate) {
                  if (path === CStudioAuthoring.Constants.GET_ALL_CONTENT_TYPES) {
                    path = '';
                    if (baseRepoPath) {
                      path = `${baseRepoPath}/${selectedTemplate.replace(/\//g, '_').substr(1)}`;
                    }
                  }
                  CStudioAuthoring.Operations.openContentWebForm(
                    selectedTemplate,
                    null,
                    null,
                    path,
                    false,
                    this.asPopup,
                    this.formSaveCb,
                    auxParams,
                    null,
                    isFlattenedInclude
                  );
                },

                failure: function () {
                  this.formSaveCb.failure();
                },

                formSaveCb: formSaveCb,
                asPopup: asPopup
              };

              var selectTemplateDialogCb = {
                moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
                  dialogClass.showDialog(moduleConfig.contentTypes, path, false, moduleConfig.selectTemplateCb, false);
                }
              };

              var moduleConfig = {
                contentTypes: contentTypes,
                selectTemplateCb: selectTemplateCb
              };

              CStudioAuthoring.Module.requireModule(
                'dialog-select-template',
                '/static-assets/components/cstudio-dialogs/select-content-type.js',
                moduleConfig,
                selectTemplateDialogCb
              );
            }
          },

          failure: function () {}
        };

        CStudioAuthoring.Service.lookupAllowedContentTypesForPath(site, path, callback);
      },

      /**
       * edit content
       * => openContentWebForm
       * =>=> openContentWebFormWithPermission
       * =>=>=> performSimpleIceEdit
       * =>=>=>=> viewcontroller-in-context-edit.initializeContent
       * =>=>=>=>=> constructUrlWebFormSimpleEngine
       */
      editContent: function (
        formId,
        site,
        mimeType,
        nodeRef,
        path,
        asPopup,
        callback,
        auxParams,
        mode,
        isFlattenedInclude
      ) {
        var CSA = CStudioAuthoring,
          uri = path.replace('//', '/'),
          params = { site: site || CStudioAuthoringContext.site, path: path };
        
        if (uri.indexOf('/site') === 0) {
          CSA.Operations.openContentWebForm(
            formId,
            path,
            nodeRef,
            path,
            true,
            asPopup,
            callback,
            auxParams,
            isFlattenedInclude
          );
        } else if (CStudioAuthoring.Utils.isEditableFormAsset(mimeType)) {
          CStudioAuthoring.Operations.openCodeEditor({
            path: uri,
            mode: CrafterCMSNext.util.content.getEditorMode(mimeType),
            onSuccess: () => {
              if (CStudioAuthoringContext.isPreview) {
                CStudioAuthoring.Operations.refreshPreview();
              } else {
                CStudioAuthoring.SelectedContent.init();
              }
              callback?.success?.(nodeRef);
            }
          });
        }
      },

      /**
       * view content
       */
      viewContent: function (formId, site, id, noderef, path, asPopup, callback, auxParams) {
        if (!auxParams) {
          auxParams = [];
        }

        auxParams[auxParams.length] = { name: 'readonly', value: 'true' };

        CStudioAuthoring.Operations.openContentWebForm(formId, id, noderef, path, true, asPopup, callback, auxParams);
      },

      /**
       * open code editor
       */
      openCodeEditor: function (payload) {
        const customEventId = 'codeEditorDialogEventId';

        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_CODE_EDITOR_DIALOG',
          payload: {
            ...payload,
            onSuccess: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: customEventId, type: 'onSuccess' }
                }
              ]
            },
            onClose: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'POP_CODE_EDITOR_DIALOG',
                  payload: { id: 'CODE_EDITOR_DIALOG' }
                },
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: customEventId, type: 'onClose' }
                }
              ]
            }
          }
        });

        CrafterCMSNext.createLegacyCallbackListener(customEventId, ({ type }) => {
          if (type === 'onSuccess') {
            payload.onSuccess?.();
          } else {
            payload.onClose?.();
          }
        });
      },

      /* submit content moved up, next to approveCommon */

      /**
       * reject content
       */
      rejectContent: function (site, contentItems) {
        const eventIdSuccess = 'rejectDialogSuccess';

        const sandboxItems = CrafterCMSNext.util.content.parseLegacyItemToSandBoxItem(contentItems);

        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_REJECT_DIALOG',
          payload: {
            open: true,
            items: sandboxItems,
            onRejectSuccess: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'SHOW_REJECT_ITEM_SUCCESS_NOTIFICATION',
                  payload: {
                    count: sandboxItems.length
                  }
                },
                {
                  type: 'LEGACY_DIALOG_CALLBACK',
                  payload: { id: eventIdSuccess }
                },
                { type: 'CLOSE_REJECT_DIALOG' }
              ]
            }
          }
        });

        CrafterCMSNext.createLegacyCallbackListener(eventIdSuccess, () => {
          if (CStudioAuthoringContext.isPreview) {
            CStudioAuthoring.Operations.refreshPreview();
          }
          eventNS.data = CStudioAuthoring.SelectedContent.getSelectedContent();
          document.dispatchEvent(eventNS);
          const messages = CrafterCMSNext.i18n.messages.itemSuccessMessages;
          const formatMessage = CrafterCMSNext.i18n.intl.formatMessage;
          CStudioAuthoring.Utils.showNotification(formatMessage(messages.itemRejected, { count: 1 }));
        });
      },

      /**
       * reload the page action for dialog box buttons.
       */
      pageReload: function (flow, nodeName) {
        if (flow) {
          var panel = YDom.getElementsByClassName('yui-panel-container')[0];
          var auxParentPath = '';
          if (
            panel &&
            (panel.style.visibility == 'visible' || panel.style.visibility == '') &&
            flow != 'deleteSchedule'
          ) {
            panel.style.visibility = 'hidden';
          }

          if (flow == 'deleteSchedule') {
            if (
              CStudioAuthoringContext.isPreview &&
              CStudioAuthoringContext.isPreview == true &&
              CStudioAuthoringContext.role === 'admin'
            ) {
              var deletedPage = document.location.href;
              var deletedNodeName = deletedPage.split('/')[deletedPage.split('/').length - 1];
              if (deletedNodeName.lastIndexOf('&') != -1) {
                deletedNodeName = deletedNodeName.split('&')[0];
              }
              deletedPage = deletedPage.replace(CStudioAuthoringContext.previewAppBaseUri, '');
              var parentPath = '';
              if (deletedPage.charAt(deletedPage.length - 1) == '/') {
                deletedPage = deletedPage.substring(0, deletedPage.length - 1);
              }
              parentPath = deletedPage.substring(0, deletedPage.lastIndexOf('/'));
              parentPath = parentPath == '/studio/preview#/?page=' ? parentPath + '/' : parentPath;
              parentPath = CStudioAuthoringContext.previewAppBaseUri + parentPath;
              if (deletedPage.lastIndexOf('/&') == -1 && nodeName == deletedNodeName) {
                document.location = parentPath;
              }
              return;
            }
          }
        }

        var tempMask = document.createElement('div');
        tempMask.style.backgroundColor = '#ccc';
        tempMask.style.opacity = '0.3';
        tempMask.style.position = 'absolute';
        tempMask.style.top = '0';
        tempMask.style.left = '0';
        tempMask.style.height = '100%';
        tempMask.style.width = '100%';
        tempMask.style.zIndex = '9999';
        tempMask.style.paddingTop = '300px';
        tempMask.style.textAlign = 'center';

        var loadingImageEl = document.createElement('img');
        loadingImageEl.src =
          contextPath +
          CStudioAuthoringContext.baseUri +
          '/static-assets/themes/cstudioTheme/images/treeview-loading.gif';
        tempMask.appendChild(loadingImageEl);

        //document.body.appendChild(tempMask);
        //window.location.reload(true);
        //document.dispatchEvent(eventNS);
      },

      uploadAsset: function (site, path, isUploadOverwrite, uploadCb, fileTypes) {
        const eventId = 'uploadAsset.event.singleFileUploadDialog';
        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_SINGLE_FILE_UPLOAD_DIALOG',
          payload: {
            open: true,
            site: site,
            path: path,
            fileTypes: fileTypes,
            onUploadComplete: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventId, type: 'uploadComplete' }
                },
                {
                  type: 'CLOSE_SINGLE_FILE_UPLOAD_DIALOG'
                }
              ]
            },
            onClose: {
              type: 'BATCH_ACTIONS',
              payload: [
                {
                  type: 'DISPATCH_DOM_EVENT',
                  payload: { id: eventId, type: 'close' }
                },
                {
                  type: 'CLOSE_SINGLE_FILE_UPLOAD_DIALOG'
                }
              ]
            }
          }
        });

        craftercms.utils.dom.createCustomDocumentEventListener(eventId, (result) => {
          if (result.type === 'uploadComplete') {
            let uploaded = result.successful[0];
            if (!uploaded.fileExtension) {
              uploaded.fileExtension = uploaded.extension;
            }
            if (!uploaded.fileName) {
              uploaded.fileName = uploaded.name;
            }
            uploadCb.success(uploaded);
          }
        });
      },

      /**
       *  opens a dialog to upload an asset
       */
      openUploadDialog: function (site, path, isUploadOverwrite, callback, fileTypes) {
        var serviceUri = CStudioAuthoring.Service.writeContentServiceUrl;

        var openUploadDialogCb = {
          moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
            dialogClass.showDialog(
              moduleConfig.site,
              moduleConfig.path,
              moduleConfig.serviceUri,
              moduleConfig.callback,
              moduleConfig.isUploadOverwrite,
              moduleConfig.fileTypes
            );
          }
        };

        var moduleConfig = {
          path: encodeURI(path),
          site: site,
          serviceUri: serviceUri,
          fileTypes: fileTypes,
          callback: callback,
          isUploadOverwrite: isUploadOverwrite
        };

        CSA.Utils.addCss('/static-assets/libs/cropper/dist/cropper.css');
        CSA.Utils.addCss('/static-assets/themes/cstudioTheme/css/icons.css');

        CStudioAuthoring.Module.requireModule(
          'upload-dialog',
          '/static-assets/components/cstudio-dialogs/upload-asset-dialog.js',
          moduleConfig,
          openUploadDialogCb
        );
        CStudioAuthoring.Module.requireModule('jquery-cropper', '/static-assets/libs/cropper/dist/cropper.js');
      },

      cropperImage: function (site, Message, imageData, imageWidth, imageHeight, aspectRatio, repoImage, callback) {
        CStudioAuthoring.Operations.openCropDialog(
          site,
          Message,
          imageData,
          imageWidth,
          imageHeight,
          aspectRatio,
          repoImage,
          callback
        );
      },

      /**
       *  opens a dialog to crop an image
       */
      openCropDialog: function (site, Message, imageData, imageWidth, imageHeight, aspectRatio, repoImage, callback) {
        var openCropperDialogCb = {
          moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
            dialogClass.showDialog(
              moduleConfig.site,
              moduleConfig.message,
              moduleConfig.imageData,
              moduleConfig.imageWidth,
              moduleConfig.imageHeight,
              moduleConfig.aspectRatio,
              moduleConfig.repoImage,
              moduleConfig.callback
            );
          }
        };

        var moduleConfig = {
          site: site,
          message: Message,
          imageData: imageData,
          imageWidth: imageWidth,
          imageHeight: imageHeight,
          aspectRatio: aspectRatio,
          repoImage: repoImage,
          callback: callback
        };

        CSA.Utils.addCss('/static-assets/libs/cropper/dist/cropper.css');
        CSA.Utils.addCss('/static-assets/themes/cstudioTheme/css/icons.css');

        CStudioAuthoring.Module.requireModule(
          'crop-dialog',
          '/static-assets/components/cstudio-dialogs/crop-dialog.js',
          moduleConfig,
          openCropperDialogCb
        );
        CStudioAuthoring.Module.requireModule('pako', '/static-assets/libs/pako.js');
        CStudioAuthoring.Module.requireModule('upng', '/static-assets/libs/upng.js');
        CStudioAuthoring.Module.requireModule('jquery-cropper', '/static-assets/libs/cropper/dist/cropper.js');
      },

      uploadWebDAVAsset: function (site, path, profileId, uploadCb, fileTypes) {
        CStudioAuthoring.Operations.openWebDAVUploadDialog(site, path, profileId, uploadCb, fileTypes);
      },

      /**
       *  opens a dialog to upload an asset
       */
      openWebDAVUploadDialog: function (site, path, profileId, callback, fileTypes) {
        var serviceUri = CStudioAuthoring.Service.writeWebDAVContentUri.replace('{siteId}', site);

        var openUploadDialogCb = {
          moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
            dialogClass.showDialog(
              moduleConfig.site,
              moduleConfig.path,
              moduleConfig.profile,
              moduleConfig.serviceUri,
              moduleConfig.callback,
              moduleConfig.fileTypes
            );
          }
        };

        var moduleConfig = {
          path: encodeURI(path),
          site: site,
          profile: profileId,
          fileTypes: fileTypes,
          serviceUri: serviceUri,
          callback: callback
        };

        CSA.Utils.addCss('/static-assets/themes/cstudioTheme/css/icons.css');

        CStudioAuthoring.Module.requireModule(
          'upload-webdav-dialog',
          '/static-assets/components/cstudio-dialogs/uploadWebDAV-dialog.js',
          moduleConfig,
          openUploadDialogCb
        );
      },

      uploadS3Asset: function (site, path, profileId, uploadCb, params) {
        CStudioAuthoring.Operations.openS3UploadDialog(site, path, profileId, uploadCb, params);
      },

      /**
       *  opens a dialog to upload an asset
       */
      openS3UploadDialog: function (site, path, profileId, callback, params) {
        var params = params ? params : {};
        serviceUri =
          params && params.transcode
            ? CStudioAuthoring.Service.videoTranscode.replace('{siteId}', site)
            : CStudioAuthoring.Service.writeS3ContentUri.replace('{siteId}', site);

        var openUploadDialogCb = {
          moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
            dialogClass.showDialog(
              moduleConfig.site,
              moduleConfig.path,
              moduleConfig.profile,
              moduleConfig.serviceUri,
              moduleConfig.callback,
              moduleConfig.params
            );
          }
        };

        var moduleConfig = {
          path: path ? encodeURI(path) : '',
          site: site,
          profile: profileId,
          serviceUri: serviceUri,
          callback: callback,
          params: params
        };

        CSA.Utils.addCss('/static-assets/themes/cstudioTheme/css/icons.css');

        CStudioAuthoring.Module.requireModule(
          'upload-S3-dialog',
          '/static-assets/components/cstudio-dialogs/uploadS3-dialog.js',
          moduleConfig,
          openUploadDialogCb
        );
      },

      /**
       * handle macros in file paths
       */
      processPathsForMacros: function (path, model, useUUID) {
        const urlParams = new URLSearchParams(window.location.search);
        const pathParam = urlParams.get('path');
        // pathParam may be an objectId (embedded components)
        const isPath = pathParam.startsWith('/');
        const fullParentPath = isPath ? pathParam : urlParams.get('parentPath');
        return CrafterCMSNext.util.path.processPathMacros({
          path,
          useUUID,
          fullParentPath,
          objectId: model?.objectId,
          objectGroupId: model?.objectGroupId
        });
      },

      /**
       * updates sidebar tree cookie that keeps its state
       * @param {*} tree - tree that the cookie will be updated
       * @param {*} cookieKey - cookey key of the tree that will be updated (depends of tree)
       * @param {*} path - path to be added into the tree cookie (state) -> item uri
       */
      updateTreeCookiePath: function (treeName, cookieKey, path) {
        var url = path,
          treeCookieName,
          treeCookie,
          cookieRoot = [],
          storage = CStudioAuthoring.Storage;

        treeCookieName = CStudioAuthoringContext.site + '-' + treeName + '-opened';
        treeCookie = storage.read(treeCookieName);
        treeCookie = treeCookie !== '' ? JSON.parse(treeCookie) : {};

        if (treeCookie[cookieKey] && treeCookie[cookieKey].indexOf('root-folder') !== -1) {
          treeCookie.sitewebsite = treeCookie.sitewebsite.splice(1, 0);
        }

        // validate if is page and if has folder (ends with index.xml)
        if (url.indexOf('index.xml') !== -1) {
          //remove everything after last-1 '/'
          parsedUrl = url.substr(0, url.lastIndexOf('/'));
          parsedUrl = parsedUrl.substr(0, parsedUrl.lastIndexOf('/'));
        } else {
          //remove everything after last '/'
          parsedUrl = url.substr(0, url.lastIndexOf('/'));
        }

        if (!treeCookie['root-folder']) {
          cookieRoot.push('root-folder');
          treeCookie['root-folder'] = cookieRoot;
        }

        // key doesn't exist in cookie
        if (!treeCookie[cookieKey] && parsedUrl != '/site') {
          treeCookie[cookieKey] = [];
        }
        // in entry doesn't exist in key
        if (treeCookie[cookieKey] && !treeCookie[cookieKey].includes(parsedUrl) && parsedUrl != '/site') {
          var override = false,
            addToCookie = true,
            existingEntry;

          // validate if a path of the cookie is sub-path of the new entry or viceversa
          // if EXISTING is part of NEW entry -> delete EXISTING and add new
          // if NEW is part of EXISTING entry -> don't add NEW
          // EXISTING = parsedUrl, NEW = existingEntry
          for (var x = 0; x < treeCookie[cookieKey].length; x++) {
            existingEntry = treeCookie[cookieKey][x];

            if (parsedUrl.indexOf(existingEntry) === 0) {
              // delete entry so it can be replaced
              treeCookie[cookieKey] = treeCookie[cookieKey].filter((item) => item !== existingEntry);
            } else if (existingEntry.indexOf(parsedUrl) === 0) {
              addToCookie = false;
            }
          }

          if (addToCookie) {
            treeCookie[cookieKey].push(parsedUrl);
          }
        }
        storage.write(treeCookieName, JSON.stringify(treeCookie), 360);
      },
      showPreviewAsset: function (sandboxItem) {
        if (
          craftercms.utils.content.isImage(sandboxItem.path) ||
          craftercms.utils.content.isVideo(sandboxItem) ||
          craftercms.utils.content.isPdfDocument(sandboxItem.mimeType)
        ) {
          // View media
          craftercms.getStore().dispatch({
            type: 'SHOW_PREVIEW_DIALOG',
            payload: {
              open: true,
              type: craftercms.utils.content.isImage(sandboxItem.path)
                ? 'image'
                : craftercms.utils.content.isVideo(sandboxItem)
                  ? 'video'
                  : 'pdf',
              title: sandboxItem.label,
              url: sandboxItem.path
            }
          });
        } else {
          // View code
          craftercms.getStore().dispatch({
            type: 'SHOW_PREVIEW_DIALOG',
            payload: {
              open: true,
              type: 'editor',
              title: sandboxItem.label,
              url: sandboxItem.path,
              path: sandboxItem.path,
              mode: craftercms.utils.content.getEditorMode(sandboxItem.mimeType)
            }
          });
        }
      }
    },
    /**
     * all services are encapsulated here
     * There should be no use of REST outside this API
     */
    Service: {
      /**
       * Private method for formating a URL with the context site and URI
       * @param url
       */
      _formatURL: function (url) {
        return CStudioAuthoring.StringUtils.keyFormat(url, {
          site: CStudioAuthoringContext.site,
          base: CStudioAuthoringContext.baseUri
        });
      },

      getViewCommon: function (url, callback, site) {
        if (site) {
          url += '&site={site}';
        }

        var srv = CStudioAuthoring.Service,
          url = srv._formatURL(url);

        CrafterCMSNext.util.ajax.get(url).subscribe(
          (response) => {
            callback.success(response.response);
          },
          (error) => {
            callback.failure(error);
          }
        );
      },

      getImageRequest: function (data) {
        CSA.Service.getViewCommon(data.url, data.callback, false);
      },

      // constants
      defaultNavContext: 'default',

      // UI (legacy pattern)
      contextServiceUri: '/context-nav',
      getComponentPreviewServiceUrl: '/crafter-controller/component',

      // service uris

      // content services
      // READ OPS
      getContentUri: '/api/1/services/api/1/content/get-content.json',
      lookupContentItemServiceUri: '/api/1/services/api/1/content/get-item.json',
      searchServiceUrl: '/api/2/search/{siteId}/search.json',
      writeContentServiceUrl: '/api/1/services/api/1/content/write-content.json',
      allContentTypesForSite: '/api/1/services/api/1/content/get-content-types.json',
      allowedContentTypesForPath: '/api/1/services/api/1/content/get-content-types.json',

      lookupFoldersServiceUri: '/api/1/services/api/1/content/get-pages.json', // NEED A SERVICE

      //WEBDAV
      writeWebDAVContentUri: '/api/2/webdav/{siteId}/upload',

      //S3
      writeS3ContentUri: '/api/2/aws/{siteId}/s3/upload.json',
      videoTranscode: '/api/2/aws/{siteId}/mediaconvert/upload',

      // ORDER SERVICES
      // READ
      getServiceOrderUrl: '/api/1/services/api/1/content/get-item-orders.json',
      getNextOrderSequenceUrl: '/api/1/services/api/1/content/get-next-item-order.json',

      //WRITE
      reorderServiceSubmitUrl: '/api/1/services/api/1/content/reorder-items.json',

      // Preview Services
      previewSyncAllServiceUrl: '/api/1/services/api/1/preview/sync-site.json',
      syncRepoServiceUrl: '/api/1/services/api/1/repo/sync-from-repo.json',

      // Quick Create
      getQuickCreateURL: '/api/2/content/{siteId}/list_quick_create_content.json',

      // Plugin
      getPluginURL: '/1/plugin/{siteId}/file',

      /**
       * lookup authoring role. having 'admin' role in one of user roles will return admin. otherwise it will return contributor
       * this method is used in preview overlay
       *
       */
      lookupAuthoringRole: function (site, user, callback) {
        var serviceCallback = {
          success: function (response) {
            var contentResults = {};
            contentResults.roles = response;
            var roles = contentResults;
            var role = 'contributor';
            if (roles != undefined) {
              for (var i = 0; i < roles.length; i++) {
                if (roles[i] == 'admin') {
                  role = 'admin';
                  break;
                }
              }
            }
            contentResults.role = role;
            callback.success(contentResults);
          },

          failure: function (response) {
            callback.failure(response);
          }
        };

        CStudioAuthoring.Service.getUserRoles(serviceCallback);
      },

      /**
       * get domain name
       */
      getDomainName: function (site) {
        CStudioAuthoring.Operations.showSimpleDialog(
          'info-dialog',
          CStudioAuthoring.Operations.simpleDialogTypeINFO,
          CMgs.format(formsLangBundle, 'notification'),
          CMgs.format(formsLangBundle, 'getDomainNameError'),
          null, // use default button
          YAHOO.widget.SimpleDialog.ICON_INFO,
          'studioDialog'
        );
      },

      /**
       * add the appropriate base to the service
       */
      createServiceUri: function (service) {
        var uri = CStudioAuthoringContext.baseUri + service;
        uri += uri.indexOf('?') == -1 ? '?' : '&';

        return uri;
      },

      createEngineServiceUri: function (service) {
        return CStudioAuthoringContext.previewAppBaseUri + service;
      },

      /**
       * pretty Formatting for HTML markup
       */
      prettyFormatHtmlMarkup: function (markup, callback) {
        var html = markup;
        html = html.replace(/\s{2,}/g, ' ');
        html = html.replace(/\r/g, '');
        html = html.replace(/\n/g, '');
        html = html.replace(/\t/g, '');

        var newHtml = '';
        var tagStag = [];

        var containerTags = ['p', 'ul', 'ol', 'li', 'div', 'b', 'table', 'tr', 'td', 'th'];
        var inScript = false;
        var inComment = false;
        var inClosingTag = false;
        var inAtomTag = false;
        var inContainerTag = false;
        var indent = 0;

        // function to determin if
        var isContainingTagFn = function (tagName) {
          var retContainerTag = false;

          for (var j = 0; j < containerTags.length; j++) {
            if (tagName == containerTags[j]) {
              retContainerTag = true;
              break;
            }
          }

          return retContainerTag;
        };

        for (var i = 0; i < html.length; i++) {
          var curChar = html.substring(i, i + 1);

          // look for closings so we can add line breaks
          if (curChar == '<' && inScript == false && inComment == false) {
            var spacePos;
            var bracketPos;
            var pos;
            var tagName;

            // parse tag name
            if (html.substring(i, i + 2) == '</') {
              spacePos = html.indexOf(' ', i);
              bracketPos = html.indexOf('>', i);
              pos = spacePos != -1 && spacePos <= bracketPos ? spacePos : bracketPos;
              tagName = html.substring(pos, i + 2);
            } else {
              spacePos = html.indexOf(' ', i);
              bracketPos = html.indexOf('>', i);
              pos = spacePos <= bracketPos ? spacePos : bracketPos;
              tagName = html.substring(pos, i + 1);
            }

            if (html.substring(i, i + 2) == '</') {
              inClosingTag = true;

              if (isContainingTagFn(tagName)) {
                indent--;
              }
            } else {
              if (tagName == 'br') {
                inAtomTag = true;
              } else {
                if (isContainingTagFn(tagName)) {
                  inContainerTag = true;
                  indent++;
                }
              }
            }
          }

          // add line breaks
          if (curChar == '>' && tagName != 'a' && tagName != 'span' && (inClosingTag || inAtomTag || inContainerTag)) {
            newHtml += curChar + '\r\n';

            // add indent
            for (var k = 0; k < indent; k++) {
              newHtml += '   ';
            }

            inClosingTag = false;
            inAtomTag = false;
            inContainerTag = false;
          } else {
            newHtml += curChar;
          }
        }

        callback.success(newHtml);
      },

      /**
       * write content Asset (NON XML)
       */
      writeContentAsset: function () {
        var serviceUri = this.writeContentAssetServiceUrl;
        // this method is not done.  upload asset is a form based api
        // this api will need to create a hidden form to make this api work
        // see dialog upload asset for example
      },

      /**
       * this method exists for legacy reasons.  Do not call it, use the actual service instead
       */
      createWriteServiceUrl: function (
        path,
        filename,
        oldPath,
        contentType,
        site,
        createFolders,
        draft,
        duplicate,
        unlock
      ) {
        var url =
          this.writeContentServiceUrl +
          '?site=' +
          site +
          '&path=' +
          path +
          '&fileName=' +
          filename +
          '&contentType=' +
          contentType +
          '&createFolders=' +
          createFolders +
          '&draft=' +
          draft +
          '&duplicate=' +
          duplicate +
          '&unlock=' +
          unlock;

        if (oldPath && oldPath != null) {
          url += '&old=' + oldPath;
        }

        return encodeURI(url);
      },

      /**
       * write content (XML)
       * Path is where you want the content to go
       * filename is the name of the file specifically
       * oldpath is OPTIONAL and is used if you are doing a rename on write
       * content is THE CONTENT
       * contentType is MIMETYPE for assets or CONTENTTYPE for XML
       * site is the site
       * createfolders TRUE if any missing paths should be created
       * draft TRUE if item is not yet saved to working area
       * duplicate TRUE if you are duplicating an existing item
       * unlock TRUE if item should be unlocked after the write
       */
      writeContent: function (
        path,
        filename,
        oldPath,
        content,
        contentType,
        site,
        createFolders,
        draft,
        duplicate,
        unlock,
        callback
      ) {
        var serviceUri = this.createWriteServiceUrl(
          path,
          filename,
          oldPath,
          contentType,
          site,
          createFolders,
          draft,
          duplicate,
          unlock
        );

        CrafterCMSNext.util.ajax.post(this.createServiceUri(serviceUri), content).subscribe(
          function (response) {
            callback.success(response.response);
          },
          function (err) {
            callback.failure(err);
          }
        );
      },

      /**
       * lookup configuration
       */
      lookupConfigurtion: function (site, configPath, callback) {
        CrafterCMSNext.services.configuration.fetchConfigurationJSON(site, configPath, 'studio').subscribe(
          (config) => {
            const configRootKey = Object.keys(config)[0];
            callback.success(config[configRootKey]);
            try {
              var CMgs = CStudioAuthoring.Messages,
                previewLangBundle = previewLangBundle
                  ? previewLangBundle
                  : CMgs.getBundle('previewTools', CStudioAuthoringContext.lang);
              CStudioAuthoring.Operations.translateContent(previewLangBundle);
            } catch (err) {}
          },
          (e) => {
            if (callback.failure) {
              callback.failure(e);
            }
          }
        );
      },

      /**
       * lookup configuration
       */
      getConfiguration: function (site, configPath, callback) {
        CrafterCMSNext.services.configuration.fetchConfigurationJSON(site, configPath, 'studio').subscribe(
          (config) => {
            const configRootKey = Object.keys(config)[0];
            callback.success(config[configRootKey]);
          },
          () => {
            if (callback.failure) {
              callback.failure();
            }
          }
        );
      },

      /**
       * unlock the content item
       */
      unlockContentItem: function (site, path, callback) {
        CrafterCMSNext.services.content.unlock(site, encodeURI(path)).subscribe(
          function () {
            callback.success();
          },
          function () {
            callback.failure();
          }
        );
      },

      /**
       * given a site id and a path look up the available taxonomy types
       */
      lookupAllowedTaxonomyTypesForPath: function (path, callback) {
        CStudioAuthoring.Service.lookupGlobalConfigurtion(
          '/taxonomies-config.xml',

          {
            success: function (config) {
              this.callback.success(config);
            },

            failure: function () {
              this.callback.failure();
            },

            context: this,
            callback: callback
          }
        );
      },

      /**
       * Constructs get-content service url with the given path as a parameter
       */
      createGetContentServiceUri: function (path) {
        return (
          CStudioAuthoringContext.baseUri +
          this.getContentUri +
          '?site=' +
          CStudioAuthoringContext.site +
          '&path=' +
          encodeURI(path) +
          '&edit=false' +
          '&ticket=' +
          CStudioAuthoring.Utils.Cookies.readCookie('ccticket')
        );
      },

      /**
       *  Returns the item content
       *  If edit equals true, tries to lock the content
       */
      getContent: function (path, edit, callback) {
        CrafterCMSNext.services.content
          .fetchContentXML(CStudioAuthoringContext.site, encodeURI(path), {
            lock: edit === 'true' || edit === true
          })
          .subscribe(
            function (content) {
              callback.success(content);
            },
            function (err) {
              callback.failure(err);
            }
          );
      },
      /**
       * determine if content exists
       */
      contentExists: function (path, callback) {
        CrafterCMSNext.services.content.checkPathExistence(CStudioAuthoringContext.site, path).subscribe(
          function (response) {
            callback.exists(response);
          },
          function (response) {
            callback.failure(response);
          }
        );
      },

      /**
       * pull component preview from preview server
       */
      getComponentPreview: function (componentId, callback) {
        var serviceUrl = this.getComponentPreviewServiceUrl;
        // adding to uid to prevent cached response
        serviceUrl += '?path=' + componentId + '&uid=' + CStudioAuthoring.Utils.generateUUID() + '&preview=true';
        var serviceCallback = {
          success: function (response) {
            var result = response.responseText;
            callback.success(result);
          },
          failure: function (response) {
            callback.failure(response);
          }
        };

        var cObj = YConnect.asyncRequest('GET', serviceUrl, serviceCallback);
        setTimeout(function () {
          YConnect.abort(cObj, serviceCallback);
        }, 20000);
      },

      previewServerSyncAll: function (site, callback) {
        var serviceUrl = this.previewSyncAllServiceUrl;
        serviceUrl += '?site=' + site;

        CrafterCMSNext.util.ajax.post(this.createServiceUri(serviceUrl)).subscribe(
          (response) => {
            callback.success(response.response);
          },
          (response) => {
            callback.failure(response);
          }
        );
      },

      syncFromRepo: function (site, callback) {
        var serviceUrl = this.syncRepoServiceUrl;
        var postData = {
          site_id: site
        };

        CrafterCMSNext.util.ajax.postJSON(this.createServiceUri(serviceUrl), postData).subscribe(
          (response) => {
            callback.success(response.response);
          },
          (response) => {
            callback.failure(response);
          }
        );
      },
      calculateDependencies: function (data, callback) {
        var serviceUrl =
          '/api/1/services/api/1/dependency/calculate-dependencies.json' + '?site_id=' + CStudioAuthoringContext.site;

        CrafterCMSNext.util.ajax.postJSON(`/studio${serviceUrl}`, data).subscribe(
          (response) => {
            callback.success(response.response);
          },
          (error) => {
            callback.failure(error);
          }
        );
      },

      getUserPermissions: function (site, path, callback) {
        craftercms.services.users.fetchMyPermissions(site).subscribe({
          next: (response) => {
            callback.success({ permissions: response });
          },
          error: (response) => {
            callback.failure(response);
          }
        });
      },

      /**
       * look at perms to see if there is a write in the group
       */
      isWrite: function (permissions) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] === 'content_write') {
            return true;
          }
        }

        return false;
      },

      validatePermission: function (permissions, permission) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] == permission) {
            return true;
          }
        }

        return false;
      },

      createFlatMap: function (itemArray) {
        var _pupulateMap = function (itemArray, map) {
          for (var i = 0; i < itemArray.length; i++) {
            var item = itemArray[i];
            map[item.uri] = item;
            if (item.children.length > 0) {
              _pupulateMap(item.children, map);
            }
          }
        };
        var map = {};
        _pupulateMap(itemArray, map);
        return map;
      },
      getChildren: function (parentItem, flatMap) {
        var children = new Array();
        for (var key in flatMap) {
          var aItem = flatMap[key];
          if (aItem.mandatoryParent == parentItem.uri) {
            children.push(aItem);
          }
        }
        return children;
      },

      /**
       * get user roles
       */
      getUserRoles: function (callback, user) {
        const roles = CrafterCMSNext.system.store.getState().user.rolesBySite[CStudioAuthoringContext.site];

        if (roles) {
          callback.success(roles);
        } else {
          console.error(`No roles were found for current user in site '${CStudioAuthoringContext.site}'`);
        }
      },

      /**
       * get Quick Create
       */
      getQuickCreate: function (callback) {
        var serviceUrl = this.getQuickCreateURL.replace('{siteId}', CStudioAuthoringContext.site);

        CrafterCMSNext.util.ajax.get(this.createServiceUri(serviceUrl)).subscribe(
          function (response) {
            var results = response.response;
            results = results.items;
            callback.success(results);
          },
          function (response) {
            callback.failure(response);
          }
        );
      },

      /**
       * get version history for given content path
       */
      getVersionHistory: function (site, contentTO, callback) {
        CrafterCMSNext.services.content.fetchItemHistory(site, contentTO.uri).subscribe(
          function (response) {
            callback.success(response);
          },
          function (response) {
            callback.failure(response);
          }
        );
      },

      /**
       * get current version history for given content path
       */
      getCurrentVersion: function (site, uri, callback) {
        var contentTO = { uri: uri };

        this.getVersionHistory(site, contentTO, {
          success: function (response) {
            callback.success(response[0].versionNumber);
          }
        });
      },

      /**
       * retrieve the content for a given contextual nav context
       */
      retrieveContextualNavContent: function (navContext, callback) {
        navContext = navContext ? navContext : this.defaultNavContext;
        var serviceUrl = this.contextServiceUri + '?site=' + CStudioAuthoringContext.site + '&context=' + navContext;
        YConnect.asyncRequest('GET', this.createServiceUri(serviceUrl), {
          success: function (oResponse) {
            var navContent = oResponse.responseText;
            callback.success(navContent);
          },
          failure: function (response) {
            callback.failure(response);
          }
        });
      },

      /**
       * given a context, retrieve the site dropdown context
       */
      retrieveContextNavConfiguration: function (context, callback) {
        const site = CStudioAuthoringContext.site;
        const path = '/context-nav/contextual-nav.xml';

        CrafterCMSNext.services.configuration.fetchConfigurationJSON(site, path, 'studio').subscribe(
          (config) => {
            const configRootKey = Object.keys(config)[0];
            const configContext = config[configRootKey].context;

            if (!configContext.length) {
              callback.success(configContext);
            }
          },
          () => {
            if (callback.failure) {
              callback.failure();
            }
          }
        );
      },

      /**
       * given a context, retrieve the site dropdown context
       */
      retrieveSiteDropdownConfiguration: function (context, callback) {
        if (this.contextNavInitialized) {
          if (!this.contextNavConfig.contexts.length) {
            callback.success(this.contextNavConfig.contexts.context);
          } else {
            callback.success(this.contextNavConfig.contexts[0]);
          }
        } else {
          CStudioAuthoring.Service.lookupConfigurtion(CStudioAuthoringContext.site, '/context-nav/sidebar.xml', {
            success: function (config) {
              this.context.contextNavConfig = config;
              this.context.contextNavInitialized = true;

              if (!config.contexts.context.length) {
                this.callback.success(config.contexts.context);
              } else {
                this.callback.success(config.contexts.context[0]);
              }
            },

            failure: function () {
              this.callback.failure();
            },

            context: this,
            callback: callback
          });
        }
      },

      /**
       * finds the site-content menu root path from item-path
       */
      getDropDownParentPathFromItemPath: function (dropdownConfig, path) {
        var groups = dropdownConfig.groups,
          j,
          k,
          a,
          b,
          c,
          menuItems,
          modules;

        if (!groups.length) {
          groups = new Array();
          groups[0] = dropdownConfig.groups.group;
        }

        for (var i = 0, a = groups.length; i < a; i++) {
          menuItems = groups[i].menuItems;
          if (!menuItems.length) {
            menuItems = new Array();
            menuItems[0] = groups[i].menuItems.menuItem;
          }

          for (j = 0, b = menuItems.length; j < b; j++) {
            modules = menuItems[j].modulehooks;
            if (!modules.length) {
              modules = new Array();
              modules[0] = menuItems[j].modulehooks.moduleHook;
            }

            for (k = 0, c = modules.length; k < c; k++) {
              if (modules[k].params) {
                var ppath = modules[k].params.path;
                if (path.indexOf(ppath) > -1) return ppath;
              }
            }
          }
        }
        return '';
      },

      /**
       * retrieve site-dropdown and match parent
       */
      matchDropdownParentNode: function (path) {
        var retPath = '';
        this.retrieveSiteDropdownConfiguration('default', {
          success: function (config) {
            retPath = CStudioAuthoring.Service.getDropDownParentPathFromItemPath(config, path);
          },

          failure: function () {},

          context: this
        });
        return retPath;
      },

      /**
       * content-menu parent path
       */
      menuParentPathKeyFromItemUrl: function (path) {
        return this.matchDropdownParentNode(path) + '-latest-opened-path';
      },

      /**
       * lookup Content item
       */
      lookupContentItem: function (site, path, callback, isDraft, populateDependencies) {
        // Path is decoded because it may come encoded or decoded. So, if not encoded, path stays the
        // same. Then, knowing that path is decoded, gets encoded. That way we avoid encoded paths to be
        // encoded again.
        path = decodeURI(path);

        CrafterCMSNext.services.content.fetchLegacyItem(site, encodeURI(path)).subscribe(
          function (response) {
            try {
              callback.success(
                {
                  item: response
                },
                callback.argument
              );
            } catch (err) {}
          },
          function () {
            if (callback.failure) {
              callback.failure('Error loading data', callback.argument);
            }
          }
        );
      },

      /**
       * lookup folders
       */
      lookupSiteFolders: function (site, path, depth, order, callback, populateDependencies) {
        if (depth) {
          var serviceUri =
            this.lookupFoldersServiceUri + '?site=' + site + '&path=' + path + '&depth=' + depth + '&order=' + order;
        } else {
          var serviceUri = this.lookupFoldersServiceUri + '?site=' + site + '&path=' + path + '&order=' + order;
        }

        if (populateDependencies != undefined && !populateDependencies) {
          serviceUri = serviceUri + '&populateDependencies=false';
        }

        CrafterCMSNext.system
          .getStore()
          .pipe(CrafterCMSNext.rxjs.switchMap(() => CrafterCMSNext.util.ajax.get(this.createServiceUri(serviceUri))))
          .subscribe({
            next: function (response) {
              callback.success(response.response, callback.argument);
            },
            error: function () {
              callback.failure(response, callback.argument);
            }
          });
      },

      /**
       * lookup pages
       */
      lookupSiteContent: function (site, path, depth, order, callback) {
        CrafterCMSNext.services.content
          .fetchLegacyItemsTree(site, path, {
            depth,
            order
          })
          .subscribe(
            function (response) {
              callback.success(
                {
                  item: response
                },
                callback.argument
              );
            },
            function (response) {
              callback.failure(response, callback.argument);
            }
          );
      },

      // is this really a service and not a util, can we rename it to something descriptive?
      isCreateFolder: function (permissions) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] === 'folder_create') {
            return true;
          }
        }
        return false;
      },

      // is this really a service and not a util, can we rename it to something descriptive?
      isUserAllowed: function (permissions) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] == 'not allowed') {
            return false;
          }
        }
        return true;
      },

      // is this really a service and not a util, can we rename it to something descriptive?
      isDeleteAllowed: function (permissions) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] === 'content_delete') {
            return true;
          }
        }
        return false;
      },

      // is this really a service and not a util, can we rename it to something descriptive?
      isPublishAllowed: function (permissions) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] == 'publish') {
            return true;
          }
        }
        return false;
      },

      // is this really a service and not a util, can we rename it to something descriptive?
      isCreateContentAllowed: function (permissions) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] === 'content_create') {
            return true;
          }
        }
        return false;
      },

      // is this really a service and not a util, can we rename it to something descriptive?
      isChangeContentTypeAllowed: function (permissions) {
        for (var i = 0; i < permissions.length; i++) {
          if (permissions[i] == 'change content type') {
            return true;
          }
        }
        return false;
      },

      /**
       * Maps a modern ContentType (from form-definition) back to the LegacyContentType shape
       * previously returned by get-content-types.json.
       * Fields that lived only in config.xml (removed) use best-effort defaults.
       */
      asLegacyContentType: function (contentType) {
        var thumbnail = contentType.thumbnailFileName || '';
        return {
          allowedRoles: [],
          // contentAsFolder was previously in config.xml; pages historically defaulted to true.
          contentAsFolder: contentType.type === 'page',
          copyDepedencyPattern: ((contentType['copy-dependencies'] && contentType['copy-dependencies']['copy-dependency']) || []).map(
            function (d) {
              return d.pattern;
            }
          ),
          deleteDependencyPattern: ((contentType['delete-dependencies'] && contentType['delete-dependencies']['delete-dependency']) || []).map(
            function (d) {
              return d.pattern;
            }
          ),
          form: contentType.id,
          formPath: '/content-types' + contentType.id + '/form-definition.xml',
          imageThumbnail: thumbnail,
          label: contentType.name,
          lastUpdated: '',
          modelInstancePath: '/content-types' + contentType.id + '/',
          name: contentType.id,
          noThumbnail: !thumbnail,
          nodeRef: null,
          pathExcludes: (contentType.paths && contentType.paths.excludes && contentType.paths.excludes.pattern) || [],
          pathIncludes: (contentType.paths && contentType.paths.includes && contentType.paths.includes.pattern) || [],
          previewable: contentType.previewable || false,
          quickCreate: contentType.quickCreate || false,
          quickCreatePath: contentType.quickCreatePath || '',
          type: contentType.type,
          useRoundedFolder: ''
        };
      },

      /**
       * lookup content type metadata
       */
      lookupContentType: function (site, type, callback) {
        var self = this;
        CrafterCMSNext.services.contentTypes.fetchContentTypes(site).subscribe(
          function (contentTypes) {
            var contentType = contentTypes.find(function (ct) {
              return ct.id === type;
            });
            if (contentType) {
              callback.success(self.asLegacyContentType(contentType));
            } else {
              callback.failure({ message: 'Content type not found: ' + type });
            }
          },
          function (err) {
            callback.failure(err);
          }
        );
      },

      /**
       * given a site id returns the available All content types
       */
      getAllContentTypesForSite: function (site, callback) {
        var self = this;
        CrafterCMSNext.services.contentTypes.fetchContentTypes(site).subscribe(
          function (contentTypes) {
            callback.success(contentTypes.map(self.asLegacyContentType.bind(self)));
          },
          function (error) {
            callback.failure(error);
          }
        );
      },

      /**
       * given a site id and a path look up the available content types
       */
      lookupAllowedContentTypesForPath: function (site, path, callback) {
        var CMgs = CStudioAuthoring.Messages;
        var formsLangBundle = CStudioAuthoring.Messages.getBundle('forms', CStudioAuthoringContext.lang);

        var serviceUri = this.allowedContentTypesForPath + '?site=' + site;

        if (path != CStudioAuthoring.Constants.GET_ALL_CONTENT_TYPES) {
          if (!path.match('.xml$')) path = path + '/';
          serviceUri += '&path=' + path;
        }

        CrafterCMSNext.util.ajax.get(this.createServiceUri(serviceUri)).subscribe(
          (response) => {
            if (response.response.length > 0) {
              callback.success(response.response);
            } else {
              CStudioAuthoring.Operations.showSimpleDialog(
                'error-dialog',
                CStudioAuthoring.Operations.simpleDialogTypeINFO,
                CMgs.format(formsLangBundle, 'notification'),
                CMgs.format(formsLangBundle, 'contentTypesEmpty'),
                null, // use default button
                YAHOO.widget.SimpleDialog.ICON_BLOCK,
                'studioDialog'
              );
              callback.failure();
            }
          },
          (response) => {
            callback.failure(response);
          }
        );
      },

      /**
       * given a site id and a path look up the available content types
       */
      setWindowState: function (userId, pageId, widgetId, stateName, stateValue) {
        var stateId = userId + '-' + pageId + '-' + widgetId + '-' + stateName;

        localStorage.setItem(stateId, stateValue);
      },

      /**
       * given a site id and a path look up the available content types
       */
      getWindowState: function (userId, pageId, widgetId, stateName, callback) {
        var stateId = userId + '-' + pageId + '-' + widgetId + '-' + stateName;
        var stateValue = '';

        stateValue = localStorage.getItem(stateId);

        return stateValue;
      },

      /**
       * return all taxonomies
       */
      getTaxonomies: function (site, callback) {
        CStudioAuthoring.Operations.showSimpleDialog(
          'notImplemented-dialog',
          CStudioAuthoring.Operations.simpleDialogTypeINFO,
          CMgs.format(formsLangBundle, 'notification'),
          CMgs.format(formsLangBundle, 'notImplemented'),
          [
            {
              text: 'OK',
              handler: function () {
                this.hide();
                callback.failure();
              },
              isDefault: false
            }
          ],
          YAHOO.widget.SimpleDialog.ICON_BLOCK,
          'studioDialog'
        );
      },

      /**
       * given a site id and a path retrive the navigation order
       */
      reorderServiceRequest: function (site, path, order, callback) {
        if (!path.match('.xml$')) path = path + '/';

        var serviceUri = this.reorderServiceSubmitUrl + '?site=' + site + '&order=' + order + '&path=' + path;

        CrafterCMSNext.util.ajax.get(this.createServiceUri(serviceUri)).subscribe(
          function (response) {
            callback.success(response.response);
          },
          function (response) {
            callback.failure(response);
          }
        );
      },

      getOrderServiceRequest: function (site, path, order, callback) {
        if (!path.match('.xml$')) path = path + '/';

        var serviceUri = this.getServiceOrderUrl + '?site=' + site + '&order=' + order + '&path=' + path;

        CrafterCMSNext.util.ajax.get(this.createServiceUri(serviceUri)).subscribe(
          function (response) {
            callback.success(response.response);
          },
          function (response) {
            callback.failure(response);
          }
        );
      },

      /*
       * given a site path retrieves the next sequence order number
       */
      getNextOrderSequenceRequest: function (site, path, callback) {
        var serviceUri = this.getNextOrderSequenceUrl + '?site=' + site + '&parentpath=' + path;

        CrafterCMSNext.util.ajax.get(this.createServiceUri(serviceUri)).subscribe(
          function (response) {
            callback.success(parseFloat(response.response.nextValue));
          },
          function (response) {
            callback.failure(response);
          }
        );
      },

      /**
       *  create the panel on the call back of reorder service request
       */
      reorderServiceCreatePanel: function (panelid, contentTypes, site, control) {
        var createDialogOrder = {
          moduleLoaded: function (moduleName, dialogClass, moduleConfig) {
            dialogClass.layout(moduleConfig);
            dialogClass.content(moduleConfig.id, moduleConfig.contentItems, moduleConfig);
            dialogClass.create(moduleConfig.id);
          }
        };

        var moduleConfig = {
          contentItems: contentTypes,
          site: site,
          id: panelId,
          control: control
        };

        CStudioAuthoring.Module.requireModule(
          'dialog-nav-order',
          '/static-assets/components/cstudio-dialogs/page-nav-order-panel.js',
          moduleConfig,
          createDialogOrder
        );
      },

      /**
       * returns a empty search context
       */
      createSearchContext: function () {
        return {
          searchTypes: [],
          keywords: '',
          filters: [],
          nonFilters: [],
          sortBy: '',
          sortAscending: true,
          page: 1,
          pageSize: 20
        };
      },

      /**
       * execute a search
       */
      search: function (site, searchQuery, callback) {
        var serviceUrl = this.searchServiceUrl.replace('{siteId}', site);

        CrafterCMSNext.util.ajax.postJSON(CStudioAuthoring.Service.createServiceUri(serviceUrl), searchQuery).subscribe(
          (response) => {
            callback.success(response.response);
          },
          (response) => {
            callback.failure(response);
          }
        );
      }
    },

    /**
     * Authoring Utility methods
     */
    Utils: {
      _counter: 0,
      addedCss: [],
      addedJs: [],
      noop: function () {},

      /**
       * Verifies if the user has a specific permission
       * @param permission {CStudioAuthoring.Constant} The permission to check whether user has it or not.
       * @param userPermssions {Array} The collection of permissions the user is granted
       * @return {boolean} true if user has the permission, false if not
       */
      hasPerm: function (permission, permssions) {
        if (permission instanceof CStudioConstant) {
          var has = false;
          CSA.Utils.each(permssions, function (index, value) {
            if (value === permission.toString() || value === permission.getValue()) {
              has = true;
              return false; // exit the loop
            }
          });
          return has;
        } else {
          throw 'Invalid Argument Exception: The permission to check must be of type ' + CStudioConstant;
        }
      },

      /**
       * Returns a page scope unique integer
       */
      getScopedInt: function () {
        return this._counter++;
      },
      /**
       * Returns a page scope unique identifier. May
       * be used to uniquely identify a DOM element which
       * doesn't have an id
       * @param prefix {String} A text to prepend to the unique ID
       * @return {String} A unique string within the page scope
       */
      getScopedId: function (prefix) {
        return [prefix || '', '_', this.getScopedInt()].join('');
      },
      /**
       * Utility to iterate through arrays or objects. Returning
       * false in the iterator would break the loop. The iterator
       * gets called with the value of the current iteration as context
       * unless a different context is supplied
       * @param o {Object|Array} The object or array to iterate through
       * @param iterator {Function} Function to execute upon each value in the array/object
       * @param context {Object} Inside the supplied iterator "this" will refer to it
       */
      each: function (o, iterator, context) {
        if (YAHOO.lang.isArray(o)) {
          for (var i = 0, l = o.length; i < l; i++) {
            var r = iterator.call(context || o[i], i, o[i]);
            if (r === false) break;
          }
        } else if (YAHOO.lang.isObject(o)) {
          for (var key in o) {
            var r = iterator.call(context || o[key], key, o[key]);
            if (r === false) break;
          }
        }
      },
      /**
       * True if user agent has native JSON parsing support else false
       */
      nativeUAJSONSupport: window.JSON && JSON.toString() == '[object JSON]',
      decode: function (jsonstring) {
        if (this.nativeUAJSONSupport) {
          return JSON.parse(jsonstring);
        } else {
          return eval('(' + jsonstring + ')');
        }
      },
      encode: function (object) {
        if (this.nativeUAJSONSupport) {
          return JSON.stringify(object);
        } else {
          try {
            return YAHOO.lang.JSON.stringify(object);
          } catch (e) {
            throw 'CStudioAuthorig.Utils.encode: YAHOO.lang.JSON is missing';
          }
        }
      },
      isAdmin: function () {
        return CStudioAuthoringContext.role == 'admin';
      },
      getIconFWClasses: function (item) {
        if (!item) return '';

        var CSA = CStudioAuthoring,
          classes = ['status-icon'],
          _each = CSA.Utils.each,
          dashed = CSA.StringUtils.toDashes,
          states = [
            'submitted',
            'inProgress',
            'scheduled',
            'deleted',
            'disabled',
            'asset',
            'component',
            'floating',
            'document',
            'submittedForDeletion',
            'inFlight'
          ],
          name;

        _each(states, function (i, state) {
          item[state] && classes.push(dashed(state));
        });
        name = classes.join(' ');

        if (CSA.Utils.isItemLocked(item)) {
          name += '-lock';
        }
        if (item.container && item.name != 'index.xml') {
          name = 'status-icon folder';
        }

        if (item.container && item.name != 'index.xml') {
          name = 'status-icon folder';
        }

        if (item.isComponent && item.contentType !== 'folder') {
          name = name + ' component';
        }

        return name;
      },

      isItemLocked: function (item) {
        // TODO We need a better way of checking this
        return item.lockOwner != '';
      },

      /**
       * get the width of the screen
       */
      viewportWidth: function () {
        var viewportwidth;

        if (typeof window.innerWidth != 'undefined') {
          viewportwidth = window.innerWidth;
        } else if (
          typeof document.documentElement != 'undefined' &&
          typeof document.documentElement.clientWidth != 'undefined' &&
          document.documentElement.clientWidth != 0
        ) {
          viewportwidth = document.documentElement.clientWidth;
        } else {
          viewportwidth = document.getElementsByTagName('body')[0].clientWidth;
        }

        return viewportwidth;
      },

      /**
       * fire the given callback when the given element becomes visible to the user
       */
      registerEventOnIsVisible: function (el, callback) {
        var y = Dom.getY(el);

        var o = new YAHOO.util.CustomEvent(
          'element finder',

          null,

          true,

          YAHOO.util.CustomEvent.FLAT
        );

        o.subscribe(callback);

        function f() {
          var top = document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop;

          var vpH = Dom.getViewportHeight();

          var view = parseInt(vpH + top);

          if (view >= y) {
            o.fire(view);
          }
        }

        Event.on(window, 'scroll', f);
      },

      /**
       * Adds a DOM event to a given element
       * @param {HTMLElement} el      the element to bind the handler to
       * @param {string}      type   the type of event handler
       * @param {function}    fn      the callback to invoke
       * @param {boolen}      capture capture or bubble phase
       */
      addEventListener: (function () {
        if (window.addEventListener) {
          return function (el, sType, fn, capture) {
            el.addEventListener(sType, fn, capture);
          };
        } else if (window.attachEvent) {
          return function (el, sType, fn, capture) {
            el.attachEvent('on' + sType, fn);
          };
        } else {
          return function () {};
        }
      })(),

      /**
       * Remove all child nodes from an element
       */
      emptyElement: function (el) {
        while (el.hasChildNodes()) {
          el.removeChild(el.firstChild);
        }
        return;
      },

      /**
       * Remove all child nodes from an element that have a specific attribute value
       */
      removeSpecificElements: function (el, attr) {
        var attrVal;
        if (el.hasChildNodes()) {
          for (var i = 0; i < el.childNodes.length; ) {
            attrVal = el.childNodes[i].getAttribute(attr);
            if (!!attrVal) {
              // Attribute value is defined and it's not an empty string
              el.removeChild(el.childNodes[i]);
            } else {
              i++;
            }
          }
        }
        return;
      },

      /**
       * utility method to check arrays for values
       */
      arrayContains: function (value, array) {
        var i = array.length;
        while (i--) {
          if (array[i] == value) {
            return true;
          }
        }

        return false;
      },

      /**
       * Add parameters to any provided url : URL?message=Hello
       */
      addURLParameter: function (url, parameterName, parameterValue) {
        var separator = url.indexOf('?') !== -1 ? '&' : '?';
        return url + separator + parameterName + '=' + parameterValue;
      },

      /**
       * dynamically add a javascript file
       */
      addJavascript: function (script, onError) {
        if (!this.arrayContains(script, this.addedJs)) {
          this.addedJs.push(script);

          if (!script.includes('http')) {
            script = CStudioAuthoringContext.baseUri + script;
            // The `buildFileUrl` util returns a full api url (without the origin).
            // Passing it to `addJavascript` method, for example from requireModule(), the url ends up with `/studio` twice.
            // Prefer not to detect simply `/studio/studio`, and avoiding hard coding api urls, I'm using buildFileUrl() result to detect this issue.
            const pluginFileApiUrlBase = craftercms.services.plugin.buildFileUrl('', '', '', '', '').split('?')[0];
            script = script.replace(`/studio${pluginFileApiUrlBase}`, pluginFileApiUrlBase);
          }

          var headID = document.getElementsByTagName('head')[0];
          var newScript = document.createElement('script');
          newScript.type = 'text/javascript';
          newScript.src = script;
          newScript.onerror = onError
            ? function (e) {
                onError(e);
              }
            : null;
          if (script.indexOf('undefined.js') === -1) {
            headID.appendChild(newScript);
          }
        }
      },
      /**
       * Get a script's path
       * @param scriptName - script name including the .js extension
       * @return full script path (including protocol and server name) or null
       */
      getScriptPath: function (scriptName) {
        var scripts = document.getElementsByTagName('SCRIPT'),
          scriptName = scriptName.replace(/(.js)$/, '\\$1'),
          scriptNameRegExp = new RegExp(scriptName + '$'),
          pathRegExp = new RegExp('(.*)' + scriptName + '$'),
          path = null;

        if (scripts && scripts.length > 0) {
          for (var i in scripts) {
            if (scripts[i].src && scripts[i].src.match(scriptNameRegExp)) {
              path = scripts[i].src.replace(pathRegExp, '$1');
            }
          }
        }
        return path;
      },
      /**
       * dynamically add a css file
       */
      addCss: function (css) {
        if (!this.arrayContains(css, this.addedCss)) {
          this.addedCss.push(css);

          if (css.indexOf('http') == -1) {
            css = CStudioAuthoringContext.baseUri + css;
          }

          var headID = document.getElementsByTagName('head')[0];
          var cssNode = document.createElement('link');
          cssNode.type = 'text/css';
          cssNode.rel = 'stylesheet';
          cssNode.href = css;
          cssNode.media = 'screen';
          headID.appendChild(cssNode);
        }
      },
      /**
       * generate uuid part
       */
      generateUUIDPart: function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
      },
      /**
       * generate pho UUID
       */
      generateUUID: function () {
        return (
          this.generateUUIDPart() +
          this.generateUUIDPart() +
          '-' +
          this.generateUUIDPart() +
          '-' +
          this.generateUUIDPart() +
          '-' +
          this.generateUUIDPart() +
          '-' +
          this.generateUUIDPart() +
          this.generateUUIDPart() +
          this.generateUUIDPart()
        );
      },

      /**
       * given a page or component path retrieves the parent path
       */
      getParentPath: function (relativePath) {
        var parentPath = relativePath;
        if (relativePath) {
          if (relativePath.lastIndexOf('.xml') > -1) {
            var index = relativePath.lastIndexOf('/');
            if (index > 0) {
              var fileName = relativePath.substring(index + 1);
              var path = relativePath.substring(0, index);
              if (fileName === 'index.xml') {
                var secondIndex = path.lastIndexOf('/');
                if (secondIndex > 0) {
                  path = path.substring(0, secondIndex);
                }
              }
              parentPath = path;
            }
          }
        }

        return parentPath;
      },

      /**
       * get parameters from url - returns map
       */
      getUrlParams: function () {
        var urlParams,
          match,
          pl = /\+/g, // Regex for replacing addition symbol with a space
          search = /([^&=]+)=?([^&]*)/g,
          decode = function (s) {
            return decodeURIComponent(s.replace(pl, ' '));
          },
          query = window.location.search.substring(1),
          key,
          value;

        urlParams = {};
        while ((match = search.exec(query))) {
          (key = decode(match[1])), (value = decode(match[2]));

          // if urlPamars at position already exists
          if (urlParams[key]) {
            // if current value is string - create array and add both
            if (typeof urlParams[key] === 'string') {
              var valuesArray = [];
              valuesArray.push(urlParams[key]);
              valuesArray.push(value);
              urlParams[key] = valuesArray;
            } else {
              urlParams[key].push(value);
            }
          } else {
            urlParams[key] = value;
          }
        }
        return urlParams;
      },

      /**
       * get query variable
       */
      getQueryVariable: function (query, variable) {
        variable = variable.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regexS = '[\\?&]' + variable + '=([^&#]*)';
        var regex = new RegExp(regexS);
        var results = regex.exec(decodeURIComponent(query));

        if (results == null) return '';
        else return results[1];
      },

      getQueryParameterByName: function (name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
          results = regex.exec(location.search);
        return results == null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
      },

      getQueryParameterURL: function (name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
          results = regex.exec(location.hash);
        return results == null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
      },

      getQueryParameterURLParentWindow: function (name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
          results = regex.exec(parent.window.location.hash);
        return results == null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
      },

      replaceQueryParameterURL: function (url, param_name, new_value) {
        var base = url.substr(0, url.indexOf('?'));
        var query = url.substr(url.indexOf('?') + 1, url.length);
        var a_query = query.split('&');
        for (var i = 0; i < a_query.length; i++) {
          var name = a_query[i].split('=')[0];
          var value = a_query[i].split('=')[1];
          if (name == param_name) a_query[i] = param_name + '=' + new_value;
        }
        return base + '?' + a_query.join('&');
      },

      /**
       * format a date
       */
      formatDateFromString: function (dateTime, timeFormat) {
        try {
          if (timeFormat != 'full') {
            var updatedDateTime = '';

            if (dateTime != undefined && dateTime != '') {
              var itemDateTime = dateTime.split('T');
              var itemDate = itemDateTime[0].replace(/-/g, '/');
              var itemTime = itemDateTime[1].split(':', 2);
              var tt = '';

              var simpleTimeFormatFlag = false;
              var tooltipformat = false;
              if (timeFormat != undefined && timeFormat == 'tooltipformat') {
                tooltipformat = true;
              } else if ((timeFormat != undefined && timeFormat != '') || timeFormat == 'simpleformat') {
                simpleTimeFormatFlag = true;
              }

              if (itemTime[0] >= 12) {
                tt = 'P';
                itemTime[0] = itemTime[0] - 12;
                if (itemTime[0] == 0) itemTime[0] = itemTime[0] + 12;
                if (itemTime[0] < 10) {
                  itemTime[0] = '0' + itemTime[0];
                }
              } else {
                tt = 'A';
                if (itemTime[0] == 0) itemTime[0] = 12;
              }

              var myDate = new Date(itemDate); // TODO: Needs to be checked!!!
              var d = myDate.getDate();
              var m = myDate.getMonth() + 1;
              var y = myDate.getFullYear();

              if (m < 10) m = '0' + m;

              if (d < 10) d = '0' + d;

              if (simpleTimeFormatFlag) {
                // if simple time format pass mm/dd/yy format

                var newDate = m + '/' + d + '/' + y;
                updatedDateTime = newDate;
              } else if (tooltipformat) {
                //date format for tooltip

                var year = y + '';
                var newDate =
                  (isNaN(m) ? m : parseInt(m, 10)) + '/' + (isNaN(d) ? d : parseInt(d, 10)) + '/' + year.substr(2);
                updatedDateTime = newDate + ' ' + itemTime[0] + ':' + itemTime[1] + '' + tt + '  ';
              } else {
                var newDate = m + '/' + d;
                updatedDateTime = newDate + ' ' + itemTime[0] + ':' + itemTime[1] + '' + tt + '  ';
              }
            } else {
              var myDate = new Date(itemDate);
              var d = myDate.getDate();
              var m = myDate.getMonth() + 1;
              var y = myDate.getFullYear();

              if (m < 10) m = '0' + m;

              if (d < 10) d = '0' + d;

              var newDate = m + '/' + d;
            }

            return updatedDateTime;
          } else {
            var dateTime = new Date(dateTime),
              weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
              months = [
                'January',
                'February',
                'March',
                'April',
                'May',
                'June',
                'July',
                'August',
                'September',
                'October',
                'November',
                'December'
              ],
              weekDay = weekdays[dateTime.getDay()],
              month = months[dateTime.getMonth()],
              day = dateTime.getDate(),
              year = dateTime.getFullYear(),
              hours = dateTime.getHours(),
              minutes = dateTime.getMinutes() < 10 ? '0' + dateTime.getMinutes() : dateTime.getMinutes(),
              seconds = dateTime.getSeconds() < 10 ? '0' + dateTime.getSeconds() : dateTime.getSeconds(),
              tt,
              time,
              timezone = /\((.*)\)/.exec(dateTime.toString())[1];

            if (hours >= 12) {
              tt = 'PM';
              hours = hours - 12;
              if (hours == 0) hours = hours + 12;
              if (hours < 10) {
                hours = '0' + hours;
              }
            } else {
              tt = 'AM';
              if (hours == 0) hours = 12;
            }

            time = hours + ':' + minutes + ':' + seconds + ' ' + tt;

            return weekDay + ', ' + month + ' ' + day + ', ' + year + ', ' + time + ' ' + timezone;
          }
        } catch (err) {
          return dateTime;
        }
      },

      /**
       * format a date from UTC to config Date
       */
      formatDateFromUTC: function (date, timeZone) {
        const locale = CrafterCMSNext.system.store.getState().uiConfig.locale;
        const options = locale.dateTimeFormatOptions;
        const localeCode = locale.localeCode;

        if (timeZone) {
          options.timeZone = timeZone;
        }

        return new Intl.DateTimeFormat(localeCode, options).format(new Date(date));
      },

      /**
       * format a date to UTC
       */
      parseDateToUTC: function (dateTime, newTimeZone, formatSize, format) {
        try {
          var currentDate = moment.tz(dateTime, format, newTimeZone),
            newDate;

          if (formatSize === 'full') {
            newDate = currentDate.clone().tz('Etc/UTC').format('dddd, MMMM DD, YYYY, hh:mm:ss A');
            newDate = newDate + ' (Etc/UTC)';
          } else {
            if (formatSize === 'large') {
              newDate = currentDate.clone().tz('Etc/UTC').format('MM/DD/YYYY HH:mm:ss');
            } else {
              if (formatSize === 'medium') {
                newDate = currentDate.clone().tz('Etc/UTC').format('MM/DD/YYYY hh:mm a');
              } else {
                newDate = currentDate.clone().tz('Etc/UTC').format('MM-DD hh:mm a');
              }
            }
          }
          return newDate != 'Invalid date' ? newDate : '';
        } catch (err) {
          console.log(err);
        }
      },

      formatDateFromStringNullToEmpty: function (dateTime, timeFormat) {
        if (dateTime == 'null' || dateTime == null || dateTime == undefined || dateTime == '') return '';
        else return this.formatDateFromString(dateTime, timeFormat);
      },

      /**
       * format date to ISO
       */
      formatDateToISO: function (dateTime) {
        return moment.parseZone(dateTime).toISOString();
      },

      /**
       * format date to Studio format
       */
      formatDateToStudio: function (dateTime) {
        var date =
          moment.parseZone(dateTime).format('MM/DD/YYYY HH:mm:ss') != 'Invalid date'
            ? moment.parseZone(dateTime).format('MM/DD/YYYY HH:mm:ss')
            : dateTime;
        return date;
      },

      formatFileSize: function (size) {
        var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
        return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
      },

      /**
       * create loading icon
       */
      createLoadingIcon: function () {
        var imgEl = document.createElement('i');
        imgEl.className += ' fa fa-spinner fa-spin fa-3x fa-fw loading';
        imgEl.id = 'loadingElt';
        document.body.appendChild(imgEl);
      },

      /**
       * remove loading icon
       */
      removeLoadingIcon: function () {
        var publishLoading = document.getElementById('loadingElt');
        if (publishLoading) {
          publishLoading.parentNode.removeChild(publishLoading);
        }
      },

      // Get the date/time formatting for the time converting service
      getConvertFormat: function (includeDate) {
        var format = includeDate ? 'MM/dd/yyyy%20HH:mm:ss' : 'HH:mm:ss';
        return format;
      },

      // Get a date/time string to use with the time converting service
      getDateTimeString: function (date, time) {
        // There should always be a time value or else, we risk calculating the date value incorrectly; but, just in case ...
        var dateTimeStr = date ? date + (time ? '%20' + time : '%2000:00:00') : '' + time;
        return dateTimeStr;
      },

      /**
       * create yui based datepicker
       */
      yuiCalendar: function (sourceElement, eventToFire, TargetElement, afterRender) {
        //Dom.get("settime").checked = true;

        var datePicker = Dom.get(sourceElement);
        over_cal = false; // flag for blur events
        targetField = Dom.get(TargetElement);

        Event.addListener(sourceElement, eventToFire, function () {
          //create a calendar outer container and apply styles to position absolute
          var calendarContainer = document.createElement('div');
          calendarContainer.id = 'calendarContainer';
          calendarContainer.className = 'calendarContainer';

          //create a wrapper to display the calendar
          var calendarWrapper = document.createElement('div');
          calendarWrapper.id = 'calendarWrapper';

          //append the wrapper inside the container
          calendarContainer.appendChild(calendarWrapper);

          //append container to source elements parent node
          datePicker.parentNode.appendChild(calendarContainer);

          //init calendar
          newCalendar = new YAHOO.widget.Calendar(sourceElement, 'calendarWrapper');
          /** added to prevent past date selection*/
          var todaysDate = new Date();
          todaysDate = todaysDate.getMonth() + 1 + '/' + todaysDate.getDate() + '/' + todaysDate.getFullYear();
          newCalendar.cfg.setProperty('mindate', todaysDate);

          //attach select event and listeners
          newCalendar.selectEvent.subscribe(getDate, targetField, true);
          newCalendar.renderEvent.subscribe(setupListeners, newCalendar, true);

          //attach calendar events
          Event.addListener(sourceElement, 'blur', hideCalendar);
          Event.addListener(sourceElement, eventToFire, showCalendar);

          newCalendar.render();

          function setupListeners() {
            Event.addListener('calendarContainer', 'mouseover', function () {
              over_cal = true;
            });

            Event.addListener('calendarContainer', 'mouseout', function () {
              over_cal = false;
            });
          }

          function hideCalendar() {
            if (!over_cal) {
              Dom.setStyle('calendarContainer', 'display', 'none');
            }
          }

          function getDate(type, args, obj) {
            var rowDate = args.toString();
            var splitRowDate = rowDate.split(',');
            var selYear = splitRowDate[0];
            var selMonth = splitRowDate[1];
            var selDay = splitRowDate[2];

            var selectedDate = selMonth + '/' + selDay + '/' + selYear;

            targetField.value = selectedDate;
            Dom.get('settime').checked = true;
            Dom.get('datepicker').style.border = '1px solid #0176B1';
            Dom.get('datepicker').style.color = '#000000';
            Dom.get('timepicker').style.border = '1px solid #0176B1';
            Dom.get('timepicker').style.color = '#000000';
            //reset and hide calendar
            over_cal = false;
            hideCalendar();
          }

          function showCalendar(ev) {
            var tar = Event.getTarget(ev);
            cur_field = tar;

            Dom.setStyle('calendarContainer', 'display', 'block');
          }
        });
      },

      /**
       * Bind an element (input) to a series of events. Whenever any of these elements are triggered
       * the cursor position will be stored in the element.
       *
       * Return: the element (or false, if the element doesn't exist)
       */

      initCursorPosition: function (elementId, events) {
        var getSelectionStart = function (o) {
          if (o.createTextRange) {
            var r = document.selection.createRange().duplicate();
            r.moveEnd('character', o.value.length);
            if (r.text == '') return o.value.length;
            return o.value.lastIndexOf(r.text);
          } else return o.selectionStart;
        };

        var addCursorPosListener = function (el, event) {
          YEvent.addListener(el, event, function () {
            var cursorPos = getSelectionStart(el);
            el.setAttribute('data-cursor', cursorPos);
          });
        };

        var el = YDom.get(elementId);

        if (el) {
          if (events.constructor.toString().indexOf('Array') != -1 && events.length > 0) {
            for (var i = 0; i < events.length; i++) {
              addCursorPosListener(el, events[i]);
            }
          }
          return el;
        } else {
          return false;
        }
      },

      /**
       * create timepicker increment and decrement helper
       * that increse the input time
       */

      textFieldTimeIncrementHelper: function (triggerEl, targetEl, event, keyCode) {
        var incrementHandler = function (type, args) {
          /* CSTUDIO-401: Removing default action when using arrow keys
                     if (args) {
                     var e = args[1];    // the actual event object
                     YEvent.preventDefault(e);   // Prevent the default action
                     }
                     */

          var timePicker = YDom.get(targetEl),
            timeValue = timePicker.value,
            cursorPosition;

          if (timeValue != 'Time...' && timeValue != '') {
            var timeValueArray = timeValue.split(/[: ]/),
              hourValue = timeValueArray[0],
              minuteValue = timeValueArray[1],
              secondValue = timeValueArray[2],
              amPmValue = timeValueArray[3];

            cursorPosition = timePicker.getAttribute('data-cursor');

            if (cursorPosition > -1 && cursorPosition < 3) {
              if (hourValue.charAt(0) == '0') hourValue = hourValue.charAt(1);

              hourValue = (parseInt(hourValue) % 12) + 1;

              if (hourValue.toString().length < 2) hourValue = '0' + hourValue;
              else hourValue = hourValue.toString();
            } else if (cursorPosition > 2 && cursorPosition < 6) {
              if (minuteValue.charAt(0) == '0') minuteValue = minuteValue.charAt(1);

              if (parseInt(minuteValue) == 59) {
                minuteValue = parseInt(minuteValue) % 59;
              } else {
                minuteValue = (parseInt(minuteValue) % 59) + 1;
              }

              if (minuteValue.toString().length < 2) minuteValue = '0' + minuteValue;
              else minuteValue = minuteValue.toString();
            } else if (cursorPosition > 5 && cursorPosition < 9) {
              if (secondValue.charAt(0) == '0') secondValue = secondValue.charAt(1);

              if (parseInt(secondValue) == 59) {
                secondValue = parseInt(secondValue) % 59;
              } else {
                secondValue = (parseInt(secondValue) % 59) + 1;
              }

              if (secondValue.toString().length < 2) secondValue = '0' + secondValue;
              else secondValue = secondValue.toString();
            } else if (cursorPosition > 8) {
              amPmValue = amPmValue == 'a.m.' ? 'p.m.' : 'a.m.';
            }

            timePicker.value = hourValue + ':' + minuteValue + ':' + secondValue + ' ' + amPmValue;
          }
        };

        YEvent.addListener(triggerEl, event, incrementHandler);

        if (keyCode) {
          // Add keyboard support, incomplete --CSTUDIO-401
          klInc = new YAHOO.util.KeyListener(targetEl, { keys: keyCode }, incrementHandler);
          klInc.enable();
        }
      },

      /**
       * create timepicker decrement and decrement helper
       * that decrese the input time
       */

      textFieldTimeDecrementHelper: function (triggerEl, targetEl, event, keyCode) {
        var decrementHandler = function (type, args) {
          /* CSTUDIO-401: Removing default action when using arrow keys
                     if (args) {
                     var e = args[1];    // the actual event object
                     YEvent.preventDefault(e);   // Prevent the default action
                     }
                     */

          var timePicker = YDom.get(targetEl),
            timeValue = timePicker.value,
            cursorPosition;

          if (timeValue != 'Time...' && timeValue != '') {
            var timeValueArray = timeValue.split(/[: ]/),
              hourValue = timeValueArray[0],
              minuteValue = timeValueArray[1],
              secondValue = timeValueArray[2],
              amPmValue = timeValueArray[3];

            cursorPosition = timePicker.getAttribute('data-cursor');

            if (cursorPosition > -1 && cursorPosition < 3) {
              if (hourValue.charAt(0) == '0') hourValue = hourValue.charAt(1);

              if (parseInt(hourValue) == 1) {
                hourValue = 12;
              } else {
                hourValue = (parseInt(hourValue) - 1) % 12;
              }

              if (hourValue.toString().length < 2) hourValue = '0' + hourValue;
              else hourValue = hourValue.toString();
            } else if (cursorPosition > 2 && cursorPosition < 6) {
              if (minuteValue.charAt(0) == '0') minuteValue = minuteValue.charAt(1);

              if (parseInt(minuteValue) == 0) {
                minuteValue = 59;
              } else {
                minuteValue = (parseInt(minuteValue) - 1) % 59;
              }

              if (minuteValue.toString().length < 2) minuteValue = '0' + minuteValue;
              else minuteValue = minuteValue.toString();
            } else if (cursorPosition > 5 && cursorPosition < 9) {
              if (secondValue.charAt(0) == '0') secondValue = secondValue.charAt(1);

              if (parseInt(secondValue) == 0) {
                secondValue = 59;
              } else {
                secondValue = (parseInt(secondValue) - 1) % 59;
              }

              if (secondValue.toString().length < 2) secondValue = '0' + secondValue;
              else secondValue = secondValue.toString();
            } else if (cursorPosition > 8) {
              if (amPmValue == 'a.m.') amPmValue = 'p.m.';
              else amPmValue = 'a.m.';
            }

            timePicker.value = hourValue + ':' + minuteValue + ':' + secondValue + ' ' + amPmValue;
          }
        };

        YEvent.addListener(triggerEl, event, decrementHandler);

        if (keyCode) {
          // Add keyboard support, incomplete --CSTUDIO-401
          klDec = new YAHOO.util.KeyListener(targetEl, { keys: keyCode }, decrementHandler);
          klDec.enable();
        }
      },

      /**
       * create timepicker that format the input time
       */
      textFieldTimeHelper: function (sourceElement, eventToFire, targetElement) {
        //Dom.get("settime").checked = true;
        var Dom = YAHOO.util.Dom,
          Event = YAHOO.util.Event,
          timePicker = Dom.get(sourceElement);
        //patterns to match the time format
        var timeParsePatterns = [
          // Now
          {
            re: /^now/i,
            example: new Array('now'),
            handler: function () {
              return new Date();
            }
          },
          // p.m.
          {
            re: /(\d{1,2}):(\d{1,2}):(\d{1,2})(?:p| p)/,
            example: new Array('9:55:00 pm', '12:55:00 p.m.', '9:55:00 p', '11:5:10pm', '9:5:1p'),
            handler: function (bits) {
              var d = new Date();
              var h = parseInt(bits[1], 10);
              d.setHours(h);
              d.setMinutes(parseInt(bits[2], 10));
              d.setSeconds(parseInt(bits[3], 10));
              return d + '~p.m.';
            }
          },
          // p.m., no seconds
          {
            re: /(\d{1,2}):(\d{1,2})(?:p| p)/,
            example: new Array('9:55 pm', '12:55 p.m.', '9:55 p', '11:5pm', '9:5p'),
            handler: function (bits) {
              var d = new Date();
              var h = parseInt(bits[1], 10);
              d.setHours(h);
              d.setMinutes(parseInt(bits[2], 10));
              d.setSeconds(0);
              return d + '~p.m.';
            }
          },
          // p.m., hour only
          {
            re: /(\d{1,2})(?:p| p)/,
            example: new Array('9 pm', '12 p.m.', '9 p', '11pm', '9p'),
            handler: function (bits) {
              var d = new Date();
              var h = parseInt(bits[1], 10);
              d.setHours(h);
              d.setMinutes(0);
              d.setSeconds(0);
              return d + '~p.m.';
            }
          },
          // hh:mm:ss
          {
            re: /(\d{1,2}):(\d{1,2}):(\d{1,2})/,
            example: new Array('9:55:00', '19:55:00', '19:5:10', '9:5:1', '9:55:00 a.m.', '11:55:00a'),
            handler: function (bits) {
              var d = new Date();
              var h = parseInt(bits[1], 10);
              if (h == 12) {
                //h = 0;
              }
              d.setHours(h);
              d.setMinutes(parseInt(bits[2], 10));
              d.setSeconds(parseInt(bits[3], 10));
              return d + '~a.m.';
            }
          },
          // hh:mm
          {
            re: /(\d{1,2}):(\d{1,2})/,
            example: new Array('9:55', '19:55', '19:5', '9:55 a.m.', '11:55a'),
            handler: function (bits) {
              var d = new Date();
              var h = parseInt(bits[1], 10);
              if (h == 12) {
                //h = 0;
              }
              d.setHours(h);
              d.setMinutes(parseInt(bits[2], 10));
              d.setSeconds(0);
              return d + '~a.m.';
            }
          },
          // hhmmss
          {
            re: /(\d{1,6})/,
            example: new Array('9', '9a', '9am', '19', '1950', '195510', '0955'),
            handler: function (bits) {
              var d = new Date();
              var h = bits[1].substring(0, 2);
              var m = parseInt(bits[1].substring(2, 4), 10);
              var s = parseInt(bits[1].substring(4, 6), 10);
              if (isNaN(m)) {
                m = 0;
              }
              if (isNaN(s)) {
                s = 0;
              }
              if (h == 12) {
                //h = 0;
              }
              d.setHours(parseInt(h, 10));
              d.setMinutes(parseInt(m, 10));
              d.setSeconds(parseInt(s, 10));
              return d + '~a.m.';
            }
          }
        ];
        var isShiftPlusTabPressed = false;
        var isTabPressed = false;
        // attach the event to call the main function
        Event.addListener(sourceElement, eventToFire, function () {
          //parse the value using patterns and retrive the date with format
          var inputTime = parseTimeString(this.value);

          if (inputTime == undefined) {
            CStudioAuthoring.Operations.showSimpleDialog(
              'timeFormatError-dialog',
              CStudioAuthoring.Operations.simpleDialogTypeINFO,
              CMgs.format(formsLangBundle, 'notification'),
              '( ' + this.value + ' ) ' + CMgs.format(formsLangBundle, 'timeFormatError'),
              [
                {
                  text: 'OK',
                  handler: function () {
                    this.hide();
                    Dom.get(targetElement).value = '';
                    var oTimeIncBtn = Dom.get('timeIncrementButton');
                    if (!isShiftPlusTabPressed && isTabPressed && oTimeIncBtn) {
                      oTimeIncBtn.focus();
                      isTabPressed = false;
                    } else {
                      var oDatePicker = Dom.get('datepicker');
                      if (isShiftPlusTabPressed && oDatePicker) {
                        oDatePicker.focus();
                        isShiftPlusTabPressed = false;
                      }
                    }
                    return;
                  },
                  isDefault: false
                }
              ],
              YAHOO.widget.SimpleDialog.ICON_BLOCK,
              'studioDialog'
            );
          } else {
            var finalTimeFormat = inputTime.split('~');
            var timeStamp = setTimeStamp(new Date(finalTimeFormat[0]), finalTimeFormat[1]);
            //Check for 12 hours format time
            var timeSplit = timeStamp.split(':');
            if (timeSplit.length == 3) {
              var hours = parseInt(timeSplit[0], 10);
              if (hours == 0 || hours > 12) {
                CStudioAuthoring.Operations.showSimpleDialog(
                  'timeFormatError-dialog',
                  CStudioAuthoring.Operations.simpleDialogTypeINFO,
                  CMgs.format(formsLangBundle, 'notification'),
                  '( ' + this.value + ' ) ' + CMgs.format(formsLangBundle, 'timeFormatError'),
                  [
                    {
                      text: 'OK',
                      handler: function () {
                        this.hide();
                        Dom.get('timepicker').focus();
                        var oTimeIncBtn = Dom.get('timeIncrementButton');
                        if (!isShiftPlusTabPressed && isTabPressed && oTimeIncBtn) {
                          oTimeIncBtn.focus();
                          isTabPressed = false;
                        } else {
                          var oDatePicker = Dom.get('datepicker');
                          if (isShiftPlusTabPressed && oDatePicker) {
                            oDatePicker.focus();
                            isShiftPlusTabPressed = false;
                          }
                        }
                        return;
                      },
                      isDefault: false
                    }
                  ],
                  YAHOO.widget.SimpleDialog.ICON_BLOCK,
                  'studioDialog'
                );
              }
            }
            //set the value
            Dom.get(targetElement).value = timeStamp;
          }
        });

        //on focus of the target element clean the field
        Event.addListener(targetElement, 'focus', function () {
          Dom.get('settime').checked = true;
          Dom.get('datepicker').style.border = '1px solid #0176B1';
          Dom.get('datepicker').style.color = '#000000';
          Dom.get('timepicker').style.border = '1px solid #0176B1';
          Dom.get('timepicker').style.color = '#000000';
          if (Dom.get(targetElement).value == 'Time...') Dom.get(targetElement).value = '';
        });

        //on focus of the target element clean the field
        Event.addListener(targetElement, 'keypress', function (evt) {
          if (evt.shiftKey && evt.keyCode == 9) {
            isShiftPlusTabPressed = true;
          } else {
            isShiftPlusTabPressed = false;
          }
          if (evt.keyCode == 9) {
            isTabPressed = true;
          } else {
            isTabPressed = false;
          }
        });

        //Parses a string to figure out the time it represents
        function parseTimeString(s) {
          for (var i = 0; i < timeParsePatterns.length; i++) {
            var re = timeParsePatterns[i].re;
            var handler = timeParsePatterns[i].handler;
            var bits = re.exec(s);
            if (bits) {
              return handler(bits);
            }
          }
        }

        // set the timestamp and format for the output
        function setTimeStamp(timeStamp, timeFormat) {
          return (
            padAZero(timeStamp.getHours()) +
            ':' +
            padAZero(timeStamp.getMinutes()) +
            ':' +
            padAZero(timeStamp.getSeconds()) +
            ' ' +
            timeFormat
          );
        }

        //padd a zero if single digit found on hour/minute/seconds
        function padAZero(s) {
          s = s.toString();
          if (s.length == 1) {
            return '0' + s;
          } else {
            return s;
          }
        }
      },

      /**
       * return true if value starts with second valuie
       */
      startsWith: function (value, startsWith) {
        return value.match('^' + startsWith) == startsWith;
      },

      /**
       *  ends with
       */
      endsWith: function (stringValue, match) {
        if (match != null) {
          return stringValue.length >= match.length && stringValue.substr(stringValue.length - match.length) == match;
        } else {
          return -1;
        }
      },

      /**
       * close the current window
       */
      closeWindow: function () {
        window.open('', '_self');
        window.close();
      },

      /**
       * return the Y Position of an element
       */
      getY: function (el) {
        var val = 0;

        while (el != null) {
          val += el.offsetTop;
          el = el.offsetParent;
        }

        return val;
      },

      /**
       * return the x,y coords of an element
       */
      findPos: function (obj) {
        var curleft = (curtop = 0);

        if (obj.offsetParent) {
          do {
            curleft += obj.offsetLeft;
            curtop += obj.offsetTop;
          } while ((obj = obj.offsetParent));
        }

        return [curleft, curtop];
      },

      /**
       * Get elements by class name
       * original code: http://code.google.com/u/robnyman/
       * License: MIT
       */
      getElementsByClassName: function (className, tag, elm) {
        if (document.getElementsByClassName) {
          getElementsByClassName = function (className, tag, elm) {
            elm = elm || document;
            var elements = elm.getElementsByClassName(className),
              nodeName = tag ? new RegExp('\\b' + tag + '\\b', 'i') : null,
              returnElements = [],
              current;
            for (var i = 0, il = elements.length; i < il; i += 1) {
              current = elements[i];
              if (!nodeName || nodeName.test(current.nodeName)) {
                returnElements.push(current);
              }
            }
            return returnElements;
          };
        } else if (document.evaluate) {
          getElementsByClassName = function (className, tag, elm) {
            tag = tag || '*';
            elm = elm || document;
            var classes = className.split(' '),
              classesToCheck = '',
              xhtmlNamespace = 'http://www.w3.org/1999/xhtml',
              namespaceResolver = document.documentElement.namespaceURI === xhtmlNamespace ? xhtmlNamespace : null,
              returnElements = [],
              elements,
              node;
            for (var j = 0, jl = classes.length; j < jl; j += 1) {
              classesToCheck += "[contains(concat(' ', @class, ' '), ' " + classes[j] + " ')]";
            }
            try {
              elements = document.evaluate('.//' + tag + classesToCheck, elm, namespaceResolver, 0, null);
            } catch (e) {
              elements = document.evaluate('.//' + tag + classesToCheck, elm, null, 0, null);
            }
            while ((node = elements.iterateNext())) {
              returnElements.push(node);
            }
            return returnElements;
          };
        } else {
          getElementsByClassName = function (className, tag, elm) {
            tag = tag || '*';
            elm = elm || document;
            var classes = className.split(' '),
              classesToCheck = [],
              elements = tag === '*' && elm.all ? elm.all : elm.getElementsByTagName(tag),
              current,
              returnElements = [],
              match;
            for (var k = 0, kl = classes.length; k < kl; k += 1) {
              classesToCheck.push(new RegExp('(^|\\s)' + classes[k] + '(\\s|$)'));
            }
            for (var l = 0, ll = elements.length; l < ll; l += 1) {
              current = elements[l];
              match = false;
              for (var m = 0, ml = classesToCheck.length; m < ml; m += 1) {
                match = classesToCheck[m].test(current.className);
                if (!match) {
                  break;
                }
              }
              if (match) {
                returnElements.push(current);
              }
            }
            return returnElements;
          };
        }

        return getElementsByClassName(className, tag, elm);
      },

      /**
       * return true if value is undefined, null or an empty string
       */
      isEmpty: function (value) {
        return !value || value == null || value == '';
      },

      /**
       * return true if html render empty string
       */
      isEmptyHtml: function (html) {
        if (html === '') return true;
        const textarea = document.createElement('textarea');
        const div = document.createElement('div');
        textarea.innerHTML = html;
        // Remove spaces
        div.innerHTML = textarea.value.replace(/\s/g, '');
        // Remove empty elements (elements like <img src=""/> are not removed)
        $(div).find('*:empty').remove();
        return $(div).is(':empty');
      },

      /**
       * given a list of content items, return an XML
       */
      createContentItemsXml: function (contentItems) {
        var xmlString = '<items>';

        for (var i = 0; i < contentItems.length; i++) {
          xmlString = xmlString + '<item uri="' + contentItems[i].uri + '"/>';
        }

        xmlString += '</items>';

        return xmlString;
      },

      /**
       * given a list of content items, return an json
       */
      createContentItemsJson: function (contentItems) {
        var itemsJson = '[ ';

        for (var i = 0; i < contentItems.length; i++) {
          var itemJson;
          if (i > 0) itemsJson = itemsJson + ',';
          itemJson = '{ uri : "' + contentItems[i].uri + '" }';
          itemsJson = itemsJson + ' ' + itemJson;
        }
        itemsJson = itemsJson + ' ]';
        return itemsJson;
      },

      /**
       * when caching content TOs we want a URI we can count on.  Not all content is
       * referenced the same way so building composite key allows us to have simple / common
       * approach to loading and storing content without concern for the type
       */
      createContentTOId: function (contentTO) {
        var id = contentTO.id ? contentTO.id : '';
        var noderef = contentTO.id ? '' : ''; // this is hold over code from client, not 2.x
        var uri = contentTO.uri ? contentTO.uri : '';

        return id + '-' + noderef + '-' + uri;
      },

      /**
       * get full name from search result content TO
       */
      getAuthorFullNameFromContentTOItem: function (contentTOItem) {
        var lastName = !CStudioAuthoring.Utils.isEmpty(contentTOItem.userLastName) ? contentTOItem.userLastName : '';
        var separator =
          !CStudioAuthoring.Utils.isEmpty(contentTOItem.userLastName) &&
          !CStudioAuthoring.Utils.isEmpty(contentTOItem.userFirstName)
            ? ', '
            : '';
        var firstName = !CStudioAuthoring.Utils.isEmpty(contentTOItem.userFirstName) ? contentTOItem.userFirstName : '';

        return lastName + separator + firstName;
      },

      /**
       * for a given tree node look up the last item
       */
      getContentItemStatus: function (contentTO, navbarStatus) {
        var status = new Object();
        status.string = '';
        status.key = '';

        if (contentTO.deleted == true) {
          status.string + CMgs.format(siteDropdownLangBundle, 'statusDeleted');
          status.key = 'statusDeleted';
          return status;
        } else if (contentTO.submittedForDeletion == true) {
          if (contentTO.scheduled == true) {
            status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusScheduledForDelete');
            status.key = status.key + 'statusScheduledForDelete';
          } else {
            status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusSubmittedForDelete');
            status.key = status.key + 'statusSubmittedForDelete';
          }

          //Disabled string not required in status to show on nav bar
          if (!navbarStatus && contentTO.disabled == true) {
            status.string = status.string + ' ' + CMgs.format(siteDropdownLangBundle, 'statusAndDisabled');
            status.key = status.key + ' ' + 'statusAndDisabled';
          }
          return status;
        } else if (contentTO.inFlight == true) {
          status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusProcessing');
          status.key = status.key + 'statusProcessing';
          //Disabled string not required in status to show on nav bar
          if (!navbarStatus && contentTO.disabled == true) {
            status.string = status.string + ' ' + CMgs.format(siteDropdownLangBundle, 'statusAndDisabled');
            status.key = status.key + ' ' + 'statusAndDisabled';
          }
          return status;
        } else if (contentTO.inProgress == true) {
          status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusInProgress');
          status.key = status.key + 'statusInProgress';
        } else if (contentTO.live == true) {
          status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusLive');
          status.key = status.key + 'statusLive';
        }

        if (contentTO.submitted == true) {
          if (contentTO.inProgress == true) {
            status.string = '';
            status.key = '';
          } else {
            if (status.string.length > 0) {
              status.string = status.string + ' ' + CMgs.format(siteDropdownLangBundle, 'statusAnd') + ' ';
              status.key = status.key + ' ';
            }
          }

          status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusSubmitted');
          status.key = status.key + 'statusSubmitted';
          if (contentTO.submittedToEnvironment) {
            status.string += ' - ' + contentTO.submittedToEnvironment.replace(/\b\w/g, (l) => l.toUpperCase());
          }
        }

        if (contentTO.scheduled == true) {
          if (contentTO.inProgress == true) {
            status.string = '';
            status.key = '';
          }

          if (status.string.length > 0) {
            status.string = status.string + ' ' + CMgs.format(siteDropdownLangBundle, 'statusAnd') + ' ';
            status.key = status.key + ' ';
          }

          status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusScheduled');
          status.key = status.key + 'statusScheduled';
          if (contentTO.submittedToEnvironment) {
            status.string += ' - ' + contentTO.submittedToEnvironment.replace(/\b\w/g, (l) => l.toUpperCase());
          }

          if (contentTO.submitted && contentTO.scheduled) {
            status.string = CMgs.format(siteDropdownLangBundle, 'statusSubmitted');
            status.key = 'statusSubmitted';
            if (contentTO.submittedToEnvironment) {
              status.string += ' - ' + contentTO.submittedToEnvironment.replace(/\b\w/g, (l) => l.toUpperCase());
            }
          }
        }

        //Disabled string not required in status to show on nav bar
        if (!navbarStatus && contentTO.disabled == true) {
          if (status.string.length > 0) {
            status.string = status.string + ' ' + CMgs.format(siteDropdownLangBundle, 'statusAnd') + ' ';
            status.key = status.key + ' ';
          }

          status.string = status.string + CMgs.format(siteDropdownLangBundle, 'statusDisabled');
          status.key = status.key + 'statusDisabled';
        }

        if (status.string == '') {
          status.string = CMgs.format(siteDropdownLangBundle, 'statusLive');
          status.key = 'statusLive';
        }

        return status;
      },

      getContentItemWorkflowStatus: function (contentTO) {
        var statusObj = contentTO.statusObj,
          workflowIcons = CSA.Constants.WORKFLOWICONS,
          statusClass = '';

        if (!statusObj) {
          statusObj = {
            deleted: contentTO.deleted,
            scheduled: contentTO.scheduled,
            disabled: contentTO.disabled,
            inFlight: contentTO.inFlight,
            inProgress: contentTO.inProgress,
            live: contentTO.live,
            lockOwner: contentTO.lockOwner,
            submitted: contentTO.submitted
          };
        }

        if (statusObj.lockOwner && '' !== statusObj.lockOwner) {
          //locked
          statusClass = workflowIcons.locked + ' locked';
        } else if (statusObj.inFlight) {
          //processing
          statusClass = workflowIcons.processing + ' fa-spin processing';
        } else if (statusObj.submitted) {
          //in workflow - progress
          statusClass = workflowIcons.inworkflow + ' in-workflow';
        } else if (statusObj.scheduled) {
          //scheduled
          statusClass = workflowIcons.scheduled + ' el-scheduled';
        } else if (contentTO.isNew) {
          //never published
          statusClass = workflowIcons.neverpublished + ' never-published';
        } else if (statusObj.live) {
          //live
          statusClass = 'live';
        } else if (statusObj.deleted) {
          //deleted
          statusClass = workflowIcons.deleted + ' deleted';
        } else if (statusObj.inProgress) {
          //edited
          statusClass = workflowIcons.edited + ' edited';
        }

        return statusClass;
      },

      isFont: function (treeNodeTO) {
        var fontTypes = [
          'application/x-font-ttf',
          'application/x-font-truetype',
          'application/x-font-opentype',
          'application/x-font-woff',
          'application/x-font-woff2',
          'application/vnd.ms-fontobject',
          'application/font-sfnt',
          'application/x-font-otf'
        ];

        return fontTypes.indexOf(treeNodeTO.mimeType) > -1;
      },

      getContentItemIcon: function (treeNodeTO) {
        var defaultIcons = CSA.Constants.MIMETYPES,
          customIcons = CSA.mimeTypes,
          mainIconClass,
          customStyle,
          iconConfig = {
            icon: {}
          };

        if ((treeNodeTO.isAsset || 'unknown' === treeNodeTO.contentType) && treeNodeTO.mimeType) {
          //assets - when outside from static assets folder isAsset
          //         is false, so on unknown it's considered an asset
          var mimetype = treeNodeTO.mimeType;
          mimetype = mimetype ? mimetype : treeNodeTO.name;

          if (mimetype.match(/\bvideo\b/)) {
            mainIconClass = defaultIcons.video.class;
          } else if (this.isFont(treeNodeTO)) {
            mainIconClass = defaultIcons.font.class;
          } else if (mimetype.match(/\bimage\b/)) {
            mainIconClass = defaultIcons.image.class;
          } else if (mimetype.match(/\bpdf\b/)) {
            mainIconClass = defaultIcons.pdf.class;
          } else if (mimetype.match(/\bpresentationml\b/)) {
            mainIconClass = defaultIcons.powerpoint.class;
          } else if (mimetype.match(/\bwordprocessingml\b/)) {
            mainIconClass = defaultIcons.word.class;
          } else if (mimetype.match(/\bspreadsheetml\b/)) {
            mainIconClass = defaultIcons.excel.class;
          } else if (mimetype.match(/\bzip\b/)) {
            mainIconClass = defaultIcons.zip.class;
          } else if (mimetype.match(/\bjavascript\b/)) {
            mainIconClass = defaultIcons.js.class;
          } else if (mimetype.match(/\bgroovy\b/)) {
            mainIconClass = defaultIcons.groovy.class;
          } else if (mimetype.match(/\bcss\b/)) {
            mainIconClass = defaultIcons.css.class;
          } else if (mimetype.match(/\bfreemarker\b/)) {
            mainIconClass = defaultIcons.ftl.class;
          } else {
            mainIconClass = defaultIcons.unknown.class;
          }

          if (customIcons[mimetype]) {
            if (customIcons[mimetype].class) {
              mainIconClass = customIcons[mimetype].class;
            }
            if (customIcons[mimetype].styles) {
              customStyle = customIcons[mimetype].styles;
            }
          }
        } else {
          if (customIcons[treeNodeTO.contentType]) {
            //support any local overrides for content type styling
            mainIconClass = customIcons[treeNodeTO.contentType].class;
            customStyle = customIcons[treeNodeTO.contentType].style;
          } else if (treeNodeTO.isComponent) {
            //isLevelDescriptor - also component
            mainIconClass = defaultIcons.component.class;
          } else if (treeNodeTO.isPage) {
            if (
              (treeNodeTO.style && treeNodeTO.style.match(/\bfloating\b/)) ||
              treeNodeTO.isFloating ||
              treeNodeTO.floating
            ) {
              mainIconClass = defaultIcons.floatingPage.class;
            } else {
              mainIconClass = defaultIcons.navPage.class;
            }
          } else if (treeNodeTO.contentType && treeNodeTO.contentType.toLowerCase().indexOf('taxonomy') !== -1) {
            mainIconClass = defaultIcons.taxonomy.class;
          }
        }

        iconConfig.icon.class = mainIconClass;

        if (customStyle) {
          iconConfig.icon.styles = customStyle;
        }

        iconConfig.icon.stackedclass = this.getContentItemWorkflowStatus(treeNodeTO);

        return CStudioAuthoring.Utils.createIcon(iconConfig, '', 'cs-item-icon');
      },

      /**
       * given a node, return the proper classes for the item's state
       */
      getContentItemClassName: function (contentTO) {
        var name = 'status-icon ';
        if (contentTO.component != true) {
          if (contentTO.document == true) name = name + ' document ';
          else name = name + 'page';

          if (contentTO.floating == true) {
            name = name + ' floating ';
          }
          if (contentTO.deleted == true || contentTO.submittedForDeletion == true) {
            name = name + ' deleted ';
          }
          if ((contentTO.submitted == true || contentTO.scheduled == true) && contentTO.floating == false) {
            if (contentTO.submitted == true) {
              name = name + ' submitted ';
            }
            if (contentTO.scheduled == true) {
              name = name + ' scheduled ';
            }
          } else {
            if (contentTO.deleted != true && contentTO.inProgress == true) {
              name = name + ' in-progress ';
            }
          }
        } else {
          if (contentTO.container == true) {
            name = ' parentFolder ';
          } else {
            if (contentTO.component == true) {
              name = name + ' component ';
              if (contentTO.deleted == true || contentTO.submittedForDeletion) {
                name = name + ' deleted ';
              }
              if (contentTO.submitted == true || contentTO.scheduled == true) {
                if (contentTO.submitted == true) {
                  name = name + ' submitted ';
                }

                if (contentTO.scheduled == true) {
                  name = name + ' scheduled ';
                }
              } else {
                if (contentTO.deleted != true && contentTO.inProgress == true) {
                  name = name + ' in-progress';
                }
              }
            }
          }
        }

        if (contentTO.lockOwner != '') {
          name = name + '-lock';
        }

        name += ' acn';

        if (contentTO.component != true) {
          if (contentTO.document == true) name = name + '-document';
          else name = name + '-page';

          if (contentTO.floating == true) {
            name = name + '-floating';
          }
          if (contentTO.deleted == true || contentTO.submittedForDeletion == true) {
            name = name + '-deleted';
          }
          if ((contentTO.submitted == true || contentTO.scheduled == true) && contentTO.floating == false) {
            if (contentTO.submitted == true) {
              name = name + '-submitted';
            }
            if (contentTO.scheduled == true) {
              name = name + '-scheduled';
            }
          } else {
            if (contentTO.deleted != true && contentTO.inProgress == true) {
              name = name + '-progress';
            }
          }
        } else {
          if (contentTO.container == true) {
            name = 'parentFolder';
          } else {
            if (contentTO.component == true) {
              name = name + '-component';
              if (contentTO.deleted == true || contentTO.submittedForDeletion) {
                name = name + '-deleted';
              }
              if (contentTO.submitted == true || contentTO.scheduled == true) {
                if (contentTO.submitted == true) {
                  name = name + '-submitted';
                }

                if (contentTO.scheduled == true) {
                  name = name + '-scheduled';
                }
              } else {
                if (contentTO.deleted != true && contentTO.inProgress == true) {
                  name = name + '-progress';
                }
              }
            }
          }
        }

        if (contentTO.lockOwner != '') {
          name = name + '-lock';
        }

        if (contentTO.disabled == true) {
          name = name + ' strike-dashboard-item';
        }

        return name;
      },

      getScheduledDateTimeUI: function (dateValue, timeValue) {
        var dateValueArray = dateValue.split('/');
        var timeValueArray = timeValue.split(' ');
        var timeSplit = timeValueArray[0].split(':');

        var schedDate = new Date(
          dateValueArray[2],
          dateValueArray[0] - 1,
          dateValueArray[1],
          timeSplit[0],
          timeSplit[1],
          timeSplit[2],
          ''
        );

        ///////////////////////////////////////////////////////////////////////////////////
        // getMonth is zero based, so adding 1 with it to show proper month in the html. //
        //////////////////////////////////////////////////////////////////////////////////
        var schedDateMonth = schedDate.getMonth() + 1;
        if (schedDateMonth < 10) {
          schedDateMonth = '0' + schedDateMonth;
        }

        var schedDateDay = schedDate.getDate();
        if (schedDateDay < 10) {
          schedDateDay = '0' + schedDateDay;
        }

        var meridian = 'AM';
        if (timeValueArray[1] == 'p.m.') {
          meridian = 'PM';
        }

        var hours = parseInt(timeSplit[0], 10);
        if (hours < 10) {
          hours = '0' + hours;
        }

        var mins = parseInt(timeSplit[1], 10);
        if (mins < 10) {
          mins = '0' + mins;
        }

        var scheduledDate = schedDateMonth + '/' + schedDateDay + ' ' + hours + ':' + mins + ' ' + meridian;

        return scheduledDate;
      },

      getTimeZoneConfig: function () {
        if (!studioTimeZone) {
          CStudioAuthoring.Service.getConfiguration(CStudioAuthoringContext.site, '/site-config.xml', {
            success: function (config) {
              studioTimeZone =
                config.locale?.dateTimeFormatOptions?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
            }
          });
        }
      },

      buildToolTip: function (
        itemNameLabel,
        label,
        contentType,
        style,
        status,
        editedDate,
        modifier,
        lockOwner,
        schedDate,
        icon
      ) {
        label = CrafterCMSNext.util.string.escapeHTML(label);
        label = label.replace(new RegExp(' ', 'g'), '&nbsp;');

        if (!contentType) {
          contentType = '';
        }

        if (contentType.indexOf('/page/') != -1) contentType = contentType.replace('/page/', '') + '&nbsp;(Page)';

        if (contentType.indexOf('/component/') != -1)
          contentType = contentType.replace('/component/', '') + '&nbsp;(Component)';

        var iconHTML = icon ? icon.outerHTML : "<span class='{2}'>";

        var toolTipMarkup = [
          "<table class='width300 acn-tooltip'>",
          '<tr>',
          "<td class='acn-width280 acn-name' colspan='2'><strong>{1}</strong></td>",
          '</tr>',
          "<tr><td class='acn-width80'><strong>Content&nbsp;Type:</strong> </td>",
          "<td class='acn-width200' style='text-transform: capitalize;'>{8}</td>",
          '<tr>'
        ].join('');

        if (status) {
          toolTipMarkup += [
            "<tr><td class='acn-width83'><strong>Status:</strong></td>",
            "<td class='acn-width200'>",
            iconHTML,
            '</span>',
            "<span style='padding-left:2px;'>{3}</span></td></tr>",
            '</tr>'
          ].join('');
        }

        if (modifier && modifier != null && modifier.trim() != '') {
          toolTipMarkup += [
            "<td class='acn-width80'><strong>Last Edited:</strong> </td>",
            "<td class='acn-width200'>{4}</td>",
            '</tr><tr>',
            "<td class='acn-width80'><strong>Edited by:</strong> </td>",
            "<td class='acn-width200'>{5}</td>",
            '</tr>'
          ].join('');
        }

        if ((lockOwner || '').trim() !== '') {
          toolTipMarkup += [
            '<tr>',
            "<td class='acn-width80'><strong>Locked by:</strong> </td>",
            "<td class='acn-width200'>{6}</td>",
            '</tr>'
          ].join('');
        }

        if (schedDate) {
          toolTipMarkup += [
            '<tr>',
            "<td class='acn-width80'><strong>Scheduled:<strong> </td>",
            "<td class='acn-width200'>{7}</td></tr>"
          ].join('');
        }

        toolTipMarkup += '</table>';

        return CStudioAuthoring.StringUtils.format(
          toolTipMarkup,
          itemNameLabel,
          label,
          style,
          status,
          editedDate,
          modifier,
          lockOwner,
          schedDate,
          contentType
        );
      },

      getTooltipContent: function (item) {
        var status = this.getContentItemStatus(item).string;
        var style = this.getIconFWClasses(item);
        var internalName = item.internalName;
        var contentType = item.contentType;
        var label = '';
        var formattedEditDate = '';
        var modifier = '';
        var fileName = '';
        var formattedSchedDate = '';
        var retTitle = '';
        var itemNameLabel = 'Page';
        var lockOwner = '';

        if (item.component) {
          itemNameLabel = 'Component';
        } else if (item.document) {
          itemNameLabel = 'Document';
        }

        if (internalName == 'crafter-level-descriptor.level.xml') {
          internalName = 'Section Defaults';
        }

        if (item.newFile) {
          label = internalName + '*';
        } else {
          label = internalName;
        }

        // this API will replace double quotes with ASCII character
        // to resolve page display issue
        label = CStudioAuthoring.Utils.replaceWithASCIICharacter(label);

        if (item.container == true) {
          fileName = item.name;
        }

        //spilt status and made it as comma seperated items.
        var statusStr = status;
        if (status.indexOf(' and ') != -1) {
          var statusArray = status.split(' and ');
          if (statusArray && statusArray.length >= 2) {
            statusStr = '';
            for (var statusIdx = 0; statusIdx < statusArray.length; statusIdx++) {
              if (statusIdx == statusArray.length - 1) {
                statusStr += statusArray[statusIdx];
              } else {
                statusStr += statusArray[statusIdx] + ', ';
              }
            }
          }
        }

        if (item.userFirstName != undefined && item.userLastName != undefined) {
          modifier = item.userFirstName + ' ' + item.userLastName;
        }

        if (item.lockOwner != undefined) {
          lockOwner = item.lockOwner;
        }

        if (item.lastEditDateAsString != '' && item.lastEditDateAsString != undefined) {
          formattedEditDate = this.formatDateFromString(item.lastEditDateAsString, 'tooltipformat');
        } else if (item.eventDate != '' && item.eventDate != undefined) {
          formattedEditDate = this.formatDateFromString(item.eventDate, 'tooltipformat');
        }

        if (item.scheduled == true) {
          formattedSchedDate = this.formatDateFromString(item.scheduledDate, 'tooltipformat');

          retTitle = this.buildToolTip(
            itemNameLabel,
            label,
            contentType,
            style,
            statusStr,
            formattedEditDate,
            modifier,
            lockOwner,
            formattedSchedDate
          );
        } else {
          retTitle = this.buildToolTip(
            itemNameLabel,
            label,
            contentType,
            style,
            statusStr,
            formattedEditDate,
            modifier,
            lockOwner
          );
        }
        return retTitle;
      },

      showLoadingImage: function (elementId) {
        if (YDom.get(elementId + '-loading')) {
          YDom.get(elementId + '-loading').style.display = 'block';
        }
      },

      hideLoadingImage: function (elementId) {
        if (YDom.get(elementId + '-loading')) {
          YDom.get(elementId + '-loading').style.display = 'none';
        }
      },

      /** takes String as param and escapes all JSON sensitive character in that String **/
      escapeJSONSensitiveCharacter: function (str) {
        if (CStudioAuthoring.Utils.isEmpty(str)) return str;
        return str
          .replace(/\\/g, '\\\\')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\f/g, '\\f')
          .replace(/"/g, '\\"')
          .replace(/'/g, "\\'")
          .replace(/\&/g, '\\&');
      },

      replaceWithASCIICharacter: function (str) {
        if (CStudioAuthoring.Utils.isEmpty(str)) return str;
        return str.replace(/"/g, '&#34;');
      },

      setDefaultFocusOn: function (focusedButton) {
        if (!focusedButton) return;
        focusedButton.focus();
        /*
         * after dialog rendered, default focused button outline style not displaying in firefox4
         * This code block adds focus outline manually and on blur, we should remove added styles.
         */
        var oDiv = document.createElement('div');
        oDiv.style.display = 'none';
        var stylePrefix = '#none';
        if (focusedButton.id != undefined && focusedButton.id != '') {
          stylePrefix = '#' + focusedButton.id;
        } else if (focusedButton.className != undefined && focusedButton.className != '') {
          stylePrefix = '.' + focusedButton.className;
        }
        oDiv.innerHTML = '<style>' + stylePrefix + '::-moz-focus-inner { border:1px dotted; }</style>';
        focusedButton.parentNode.appendChild(oDiv);
        focusedButton.onblur = function (evt) {
          oDiv.parentNode.removeChild(oDiv);
          focusedButton.onblur = null;
        };
      },

      // More configuration on https://notifyjs.com/
      showNotification: function (message, positionx, positiony, type, originalx, originaly, classElt) {
        CrafterCMSNext.system.store.dispatch({
          type: 'SHOW_SYSTEM_NOTIFICATION',
          payload: {
            message,
            anchorOrigin: {
              vertical: positionx,
              horizontal: positiony
            },
            variant: type
          }
        });
      },

      showConfirmNotification: function (message, confirmText, callback) {
        const id = CStudioAuthoring.Utils.generateUUID();
        const styleName = 'material-snackbar-confirm';
        //Creating NotifyStyle
        $.notify.addStyle(styleName, {
          html:
            '<div>' +
            "<div class='message' data-notify-html='title'/>" +
            "<div class='actions'>" +
            "<button class='yes btn btn-primary' data-notify-text='button'></button>" +
            "<button class='no btn btn-default' data-notify-text='close' >" +
            CrafterCMSNext.i18n.intl.formatMessage({
              id: 'words.close',
              defaultMessage: 'Close'
            }) +
            '</button>' +
            '</div>' +
            '</div>'
        });

        $.notify(
          {
            title: message,
            button: confirmText
          },
          {
            className: id,
            autoHide: false,
            style: styleName,
            clickToHide: false,
            showAnimation: 'fadeIn',
            hideAnimation: 'fadeOut'
          }
        );

        const onOk = function () {
          $(this).trigger('notify-hide');
          callback && callback();
        };

        const onCancel = function () {
          $(this).trigger('notify-hide');
        };

        setTimeout(() => {
          $(document).off('click', `.notifyjs-${styleName}-${id} .no`, onCancel);
          $(document).off('click', `.notifyjs-${styleName}-${id} .yes`, onOk);
        }, 8500);

        $(document).on('click', `.notifyjs-${styleName}-${id} .no`, onCancel);

        $(document).on('click', `.notifyjs-${styleName}-${id} .yes`, onOk);
      },

      showConfirmDialog: function (/*
        title, body, callback, okButtonText, cancelButtonText
        { title, body, onOk, onCancel, okButtonText, cancelButtonText }
      */) {
        const { title, body, onOk, onCancel, okButtonText, cancelButtonText } =
          typeof arguments[0] === 'object'
            ? arguments[0]
            : {
                title: arguments[0],
                body: arguments[1],
                onOk: arguments[2],
                okButtonText: arguments[3],
                cancelButtonText: arguments[4]
              };

        const confirmDialogEvent = 'commonAPIConfirmDialogEvent';

        if (onOk) {
          CrafterCMSNext.system.store.dispatch({
            type: 'SHOW_CONFIRM_DIALOG',
            payload: {
              open: true,
              title,
              body,
              okButtonText,
              cancelButtonText,
              onOk: {
                type: 'BATCH_ACTIONS',
                payload: [
                  {
                    type: 'DISPATCH_DOM_EVENT',
                    payload: { id: confirmDialogEvent, type: 'ok' }
                  },
                  {
                    type: 'CLOSE_CONFIRM_DIALOG'
                  }
                ]
              },
              onCancel: {
                type: 'CLOSE_CONFIRM_DIALOG'
              },
              onClosed: {
                type: 'BATCH_ACTIONS',
                payload: [
                  {
                    type: 'DISPATCH_DOM_EVENT',
                    payload: { id: confirmDialogEvent, type: 'cancel' }
                  },
                  { type: 'CONFIRM_DIALOG_CLOSED' }
                ]
              }
            }
          });

          craftercms.utils.dom.createCustomDocumentEventListener(confirmDialogEvent, ({ type }) => {
            if (type === 'ok') {
              onOk?.();
            } else {
              onCancel?.();
            }
          });
        } else {
          CrafterCMSNext.system.store.dispatch({
            type: 'SHOW_CONFIRM_DIALOG',
            payload: {
              open: true,
              title,
              body,
              onOk: {
                type: 'CLOSE_CONFIRM_DIALOG'
              },
            }
          });
        }
      },

      addPopover: function ($element, title, content) {
        $element
          .popover({
            title,
            content,
            trigger: 'manual'
          })
          .on('inserted.bs.popover', function () {
            var $pop = $(this);
            $('<div class="help__popover-mask"/>')
              .click(function () {
                $('.help__popover-mask').remove();
                $pop.popover('hide');
              })
              .appendTo('body');
          })
          .on('hide.bs.popover', function () {
            $('.help__popover-mask').remove();
          })
          .click(function () {
            $(this).popover('show');
          });
      },

      isReviewer: function (cb) {
        var callback = {
          success: function (data) {
            var roles = data,
              isRev = false,
              topRoles = false;
            for (var i = 0; i < roles.length; i++) {
              if (
                roles[i].toLocaleLowerCase() == 'admin' ||
                roles[i].toLocaleLowerCase() == 'developer' ||
                roles[i].toLocaleLowerCase() == 'publisher' ||
                roles[i].toLocaleLowerCase() == 'author'
              ) {
                topRoles = true;
              }
              if (roles[i].toLocaleLowerCase() == 'reviewer' && !topRoles) {
                isRev = true;
                break;
              } else {
                isRev = false;
              }
            }
            cb(isRev);
          },
          failure: function (response) {
            console.log(response);
          }
        };

        CStudioAuthoring.Service.getUserRoles(callback);
      },

      /**
       * Icons
       */
      createIcon: function (conf, defaultIcon, containerClass) {
        var iconContainer = document.createElement('div'),
          iconElt = document.createElement('span'),
          styles = conf && conf.icon ? conf.icon.styles : null;
        YDom.addClass(iconContainer, 'icon-container');
        if (!conf || !conf.icon || (conf && conf.icon && !conf.icon.stackedclass)) {
          YDom.addClass(iconElt, 'status-icon mr9 fa');
          YDom.addClass(iconElt, conf && conf.icon && conf.icon.class ? conf.icon.class : defaultIcon);
        } else {
          var icon1 = document.createElement('span'),
            icon2 = document.createElement('span'),
            icon1Size;
          YDom.addClass(iconElt, 'status-icon mr9 studio-fa-stack');
          YDom.addClass(icon1, 'fa studio-fa-stack-2x');
          YDom.addClass(icon1, conf && conf.icon && conf.icon.class ? conf.icon.class : defaultIcon);
          YDom.addClass(icon2, 'fa studio-fa-stack-1x');
          YDom.addClass(icon2, conf.icon.stackedclass ? conf.icon.stackedclass : defaultIcon);
          icon1Size = styles && styles['font-size'] ? styles['font-size'] : null;
          if (icon1Size) {
            icon2.style['font-size'] = icon1Size.replace('px', '') - 4 + 'px';
          }
          iconElt.appendChild(icon1);
          iconElt.appendChild(icon2);
        }

        if (containerClass) {
          YDom.addClass(iconContainer, ' ' + containerClass);
        }

        if (styles) {
          for (var key in styles) {
            if (styles.hasOwnProperty(key)) {
              iconElt.style[key] = styles[key];
            }
          }
        }
        iconContainer.appendChild(iconElt);
        return iconContainer;
      },

      /**
       * Is Editable Form Asset
       */
      isEditableFormAsset: function (mimeType) {
        return (
          mimeType &&
          (mimeType.match(/^text\//) ||
            mimeType === 'application/javascript' ||
            mimeType === 'application/x-javascript+xml' ||
            mimeType === 'application/xml' ||
            mimeType === 'application/json' ||
            mimeType === 'application/x-sh')
        );
      },

      /**
       * Previewing an image/video on a popup dialog, needs a container with corresponding markup
       * TODO: document needed markup
       * @param source {string} Asset path.
       * @param type {string} Asset Mime type.
       * @param container {jQuery} The popup element
       */
      previewAssetDialog: function (source, type) {
        var $container = $('.cstudio-image-popup-overlay'),
          $mediaContainer,
          CMgs = CStudioAuthoring.Messages,
          formsLangBundle = CStudioAuthoring.Messages.getBundle('previewTools', CStudioAuthoringContext.lang),
          destroy,
          clickHandler,
          escHandler;

        if ($container.length === 0) {
          $container = $(
            '<div class="cstudio-image-popup-overlay" style="display: none;">' +
              '<div class="cstudio-image-pop-up">' +
              '<div>' +
              '<span class="close fa fa-close"></span>' +
              '</div>' +
              '<div class="media-container"></div>' +
              '</div>' +
              '</div>'
          );

          $('body').append($container);
        }

        $mediaContainer = $container.find('.media-container');
        $container.removeClass('cstudio-video-popup-overlay');

        if (type.match(/\bvideo\b/)) {
          var playerOptions = {
              autoplay: true,
              controls: true,
              src: source,
              width: 400,
              height: 240
            },
            div = document.createElement('div');

          $container.addClass('cstudio-video-popup-overlay');
          $mediaContainer.append(div);
          CrafterCMSNext.render(div, 'AsyncVideoPlayer', {
            playerOptions: playerOptions,
            nonPlayableMessage: CMgs.format(formsLangBundle, 'videoProcessed')
          });
        } else {
          $mediaContainer.append('<img alt="" src="' + source + '"/>');
        }

        $container.show();

        destroy = function () {
          $(document).unbind('click', clickHandler);
          $(document).unbind('keyup', escHandler);
        };

        clickHandler = function (e) {
          if (e.target !== this) return;

          $container.remove();
          destroy();
        };

        escHandler = function (e) {
          if (e.keyCode === 27) {
            $container.remove();
            destroy();
          }
        };

        // Close - on button click
        $container.one('click', '.close', function () {
          $container.remove();
          destroy();
        });

        // Close - on click outside dialog
        $container.bind('click', clickHandler);

        // Close - on escape
        $(document).bind('keyup', escHandler);
      },

      decreaseFormDialog: function () {
        if (window.frameElement) {
          var id = window.frameElement.getAttribute('id').split('-editor-')[1];
          if ($('#ice-body').length > 0 && $($('.studio-ice-container-' + id, parent.document)[0]).height() > 212) {
            $($('.studio-ice-container-' + id, parent.document)[0]).height(212);
          }
        }
      },

      form: {
        getPluginInfo: function (item, url, pluginType) {
          var path,
            prefix,
            name,
            missingProp = [],
            isPlugin = false;

          if (item.plugin != null) {
            isPlugin = true;
            name = item.plugin.name;
            path = CStudioAuthoring.Service.getPluginURL.replace('{siteId}', CStudioAuthoringContext.site);
            prefix = name;
            if (item.plugin.type) {
              path += '?type=' + item.plugin.type;
            } else {
              missingProp.push('Type');
            }
            if (item.plugin.name) {
              path += '&name=' + name;
            } else {
              missingProp.push('Name');
            }
            if (item.plugin.filename) {
              path += '&filename=' + item.plugin.filename;
            } else {
              missingProp.push('File name');
            }

            if (item.plugin.pluginId) {
              path += '&pluginId=' + item.plugin.pluginId;
            }

            if (missingProp.length > 0) {
              path = '';
            }
          } else {
            name = item.name ? item.name : item;
            path = url + name + '.js';
            prefix = 'cstudio-forms-controls-' + name;
          }

          return { path, prefix, name, missingProp, isPlugin };
        },

        getPluginError: function (errorObject, CMgs, formsLangBundle) {
          var message = "<div class='postfixErrorContainer'>" + CMgs.format(formsLangBundle, 'pluginError') + '<ul>',
            propertiesMessage;

          if (errorObject.control.length > 0) {
            for (var i = 0; errorObject.control.length > i; i++) {
              propertiesMessage =
                errorObject.control[i].length > 1
                  ? CMgs.format(formsLangBundle, 'propertiesMessage')
                  : CMgs.format(formsLangBundle, 'propertyMessage');
              message +=
                '<li>' +
                '' +
                /***/ '<strong>' +
                CMgs.format(formsLangBundle, 'control') +
                '</strong>' +
                errorObject.control[i]
                  .toString()
                  .replace(/,/g, ', ')
                  .replace(/,([^,]*)$/, ' and$1') +
                /***/ propertiesMessage +
                '</li>';
            }
          }

          if (errorObject.datasource.length > 0) {
            for (var i = 0; errorObject.datasource.length > i; i++) {
              propertiesMessage =
                errorObject.datasource[i].length > 1
                  ? CMgs.format(formsLangBundle, 'propertiesMessage')
                  : CMgs.format(formsLangBundle, 'propertyMessage');
              message +=
                '<li>' +
                /***/ '<strong>' +
                CMgs.format(formsLangBundle, 'datasource') +
                '</strong>' +
                errorObject.datasource[i]
                  .toString()
                  .replace(/,/g, ', ')
                  .replace(/,([^,]*)$/, ' and$1') +
                /***/ propertiesMessage +
                '</li>';
            }
          }

          message +=
            /**/ '</ul>' +
            /**/ "<p class='descriptionMessage' >" +
            CMgs.format(formsLangBundle, 'pluginErrorSolution') +
            '</p>' +
            '</div>';

          var $html = $('<div />', { html: message });
          $html.find('a').attr('href', CStudioAuthoringContext.baseUri + '/site-config');

          CStudioAuthoring.Operations.showSimpleDialog(
            'errorPostfix-dialog',
            CStudioAuthoring.Operations.simpleDialogTypeINFO,
            CMgs.format(formsLangBundle, 'notification'),
            $html.html(),
            null, // use default button
            YAHOO.widget.SimpleDialog.ICON_BLOCK,
            'studioDialog'
          );
        }
      },
      debounce: (func, timeout = 300) => {
        let timer;
        return (...args) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            func.apply(this, args);
          }, timeout);
        };
      }
    },
    'Utils.Doc': {
      /**
       * given a select object and a value, set the select box
       */
      setSelectValue: function (selectEl, value) {
        if (selectEl) {
          for (var i = 0; i < selectEl.length; i++) {
            if (selectEl[i].value == value) {
              selectEl.selectedIndex = i;
              break;
            }
          }
        }
      }
    },
    /**
     * common sort query string parameter format
     **/
    'Utils.formatSortKey': {
      init: function (value) {
        switch (value) {
          case 'Page Name':
            newValue = 'internalName';
            break;

          case 'Last Edited By':
            newValue = 'userLastName';
            break;

          case 'URL':
            newValue = 'browserUri';
            break;

          case 'Last Edited':
            newValue = 'eventDate';
            break;

          case 'Edit':
            newValue = 'eventDate';
            break;
        }

        return newValue;
      }
    },
    /**
     * Useful String manipulation utilities
     **/
    StringUtils: {
      isString: function (value) {
        return Object.prototype.toString.call(value) === '[object String]';
      },
      format: function (format) {
        var args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/\{(\d+)\}/g, function (match, index) {
          return args[index];
        });
      },
      /**
       * Formats a string with placeholders with the given function
       * note: Iterator function must return the replacement value
       * or the complete match if no operation was performed
       * @param {String} format The text to format
       * @param {Function} iterator The function that formats each placeholder
       * @returns {String} The formatted text
       */
      advFormat: function (format, iterator) {
        return format.replace(/\{.*?\}/g, function (match, index) {
          return iterator(match.substr(1, match.length - 2), index);
        });
      },
      keyFormat: function (format, oHash) {
        return this.advFormat(format, function (match) {
          return oHash[match] || match;
        });
      },
      /**
       * Transforms a string separated by the supplied char into camelcase.
       * If no separation char is supplied then dash is assumed.
       * @param str {String} String to transfor
       * @param separator {String} the separator char
       */
      toCamelcase: function (str, separator) {
        !separator && (separator = '-');
        var parts = str.split(separator),
          len = parts.length;
        if (len == 1) return parts[0];
        var camel = [];
        camel.push(str.charAt(0) == separator ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1) : parts[0]);
        for (var i = 1; i < len; i++) camel.push(parts[i].charAt(0).toUpperCase() + parts[i].substring(1));
        return camel.join('');
      },
      toDashes: function (str) {
        return str
          .replace(/::/g, '/')
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
          .replace(/([a-z\d])([A-Z])/g, '$1-$2')
          .toLowerCase();
      },
      truncate: function (str, size) {
        return str.length <= size ? str : str.substr(0, size - 3) + '...';
      }
    },
    /**
     * Various storage utilities making use of HTML5 localstorage
     * if supported or falling back to cookies if not
     **/
    Storage: {
      /**
       * Shorcut to the localStorage object if available
       **/
      ls: window.localStorage,
      /**
       * Stores a value with the provided key in the browser's local storage or
       * falling back to cookies if localstorage is not supported
       * @param {String} key The key to store the value with
       * @param {String} value The value to store
       * @param {Number} hours In case cookie fallback needed, optionally specify a expiration time for the cookie in hours
       * @return The stored value
       **/
      store: function (key, value, hours) {
        if (this.ls) {
          try {
            this.ls.setItem(key, value);
          } catch (e) {
            if (e == QUOTA_EXCEEDED_ERR) {
              CStudioAuthoring.Operations.showSimpleDialog(
                'error-dialog',
                CStudioAuthoring.Operations.simpleDialogTypeINFO,
                CMgs.format(formsLangBundle, 'notification'),
                CMgs.format(formsLangBundle, 'localStoreExceeded'),
                null, // use default button
                YAHOO.widget.SimpleDialog.ICON_BLOCK,
                'studioDialog'
              );
            }
            this.write(key, value, hours);
          }
        } else {
          this.write(key, value, hours);
        }
        return value;
      },
      /**
       * Retrieves the value associated with the provided key. If localstorage is not supported
       * looks for the value as a cookie
       * @param {String} key The key to retrieve the associated value
       * @return The value associated to the key or an empty string
       **/
      retrieve: function (key) {
        var value;
        if (this.ls) {
          value = this.ls.getItem(key);
        }
        if (value === null || value === undefined) value = this.read(key);
        return value;
      },
      /**
       * Deletes an entry from the localstorage or a cookie if localstorage is not supported
       * @param {String} key The key to delete
       * @return The deleted value
       **/
      del: function (key) {
        var value;
        if (this.ls) {
          value = this.ls.getItem(key);
          delete this.ls.removeItem(key);
        }
        if (value === undefined) value = this.eliminate(key);
        return value;
      },
      /**
       * Reads a cookie from the client computer
       * @param {String} name The name of the cookie to retrieve
       * @return The read value
       */
      read: function (name) {
        var cookieValue = '';
        var search = name + '=';
        if (document.cookie.length > 0) {
          var offset = document.cookie.indexOf(search);
          if (offset != -1) {
            offset += search.length;
            var end = document.cookie.indexOf(';', offset);
            if (end == -1) end = document.cookie.length;
            cookieValue = decodeURIComponent(document.cookie.substring(offset, end));
          }
        }
        return cookieValue;
      },
      /**
       * Writes a cookie to the client computer
       * @param {String} name The name for the new cookie
       * @param {String} value The cookie's value
       * @param {Number} hours Hours from the moment of registration
       * @return The stored value
       */
      write: function (name, value, hours) {
        var expire, domainVal;
        if (hours) {
          expire = new Date(new Date().getTime() + hours * 3600000).toGMTString();
        } else {
          // IE9 doesn't like an empty expire value (i.e. it won't create the cookie)
          // For IE9, creating a cookie with an expire value set to half an hour (0.5 hours)
          expire =
            YAHOO.env.ua.ie == 9
              ? new Date(new Date().getTime() + CStudioAuthoring.Utils.Cookies.durationHours(0.5)).toGMTString()
              : '';
        }
        domainVal =
          CStudioAuthoringContext.cookieDomain.indexOf('.') > -1
            ? 'domain=' + CStudioAuthoringContext.cookieDomain
            : '';
        document.cookie = CStudioAuthoring.StringUtils.format(
          '{0}={1}; expires={2}; path=/; ' + domainVal,
          name,
          encodeURIComponent(value),
          expire
        );
        return value;
      },
      /**
       * Eliminates the specified cookie
       * @param {String} key The cookie name to delete
       * @return The eliminated value
       **/
      eliminate: function (name) {
        var value = this.read(name); // retrieve the value before deleting
        this.write(name, '', -168); // Set expiration to a week before now
        return value;
      }
    },
    /**
     * Collection of utilities for dealing with cookies
     */
    'Utils.Cookies': {
      /**
       * given a unit, return enough millis for that unit of hours
       */
      durationHours: function (unit) {
        // 60 * 60 * 1000 = 3600000
        return 3600000 * unit;
      },
      /**
       * given a unit, return enough millis for that unit of hours
       */
      durationDays: function (unit) {
        // 24 * 60 * 60 * 1000 = 86400000
        return 86400000 * unit;
      },
      /**
       * write a cookie
       */
      createCookie: function (name, value, duration) {
        var expires, date, domainVal;
        if (duration) {
          date = new Date();
          date.setTime(date.getTime() + duration);
          expires = date.toGMTString();
        } else {
          // IE doesn't like an empty expire value (i.e. it won't create the cookie)
          // For IE, creating a cookie with an expire value set to half an hour (0.5 hours)
          expires = YAHOO.env.ua.ie
            ? new Date(new Date().getTime() + CStudioAuthoring.Utils.Cookies.durationHours(0.5)).toGMTString()
            : '';
        }
        domainVal =
          CStudioAuthoringContext.cookieDomain.indexOf('.') > -1
            ? 'domain=' + CStudioAuthoringContext.cookieDomain
            : '';
        if (expires) {
          document.cookie = [name, '=', value, '; expires=', expires, '; path=/; ' + domainVal].join('');
        } else {
          document.cookie = [name, '=', value, '; path=/; ' + domainVal].join('');
        }
      },
      /**
       * read a cookie
       */
      readCookie: function (name) {
        var nameEQ = name + '=';
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
          var c = ca[i];
          while (c.charAt(0) == ' ') c = c.substring(1, c.length);
          if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
      },
      /**
       * destroy a cookie
       */
      eraseCookie: function (name) {
        var domainVal =
          CStudioAuthoringContext.cookieDomain.indexOf('.') > -1
            ? 'domain=' + CStudioAuthoringContext.cookieDomain
            : '';
        document.cookie = name + '=null; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; ' + domainVal;
      }
    },
    /**
     * pass the correct parameter for sortAscDesc
     **/
    'Utils.sortByAsc': {
      init: function (sortBy, widgetId) {
        var previousSortedBy = YDom.get('sortedBy-' + widgetId).innerHTML;
        var previousSortType = YDom.get('sort-type-' + widgetId).innerHTML;
        var currentSortBy = sortBy ? sortBy : null;

        if (currentSortBy == null) return false;
        currentSortBy = currentSortBy.replace('-' + widgetId, '');

        if (previousSortedBy == currentSortBy) {
          if (previousSortType == 'true') {
            currentSortType = 'false';
          } else {
            currentSortType = 'true';
          }
        } else {
          currentSortType = 'false';
        }

        return currentSortType;
      }
    },
    /**
     * manages child searches
     */
    ChildSearchManager: {
      searches: [],
      /**
       * create a new child form configuration
       */
      createChildSearchConfig: function () {
        return { searchId: '', searchUrl: '', openAsTab: '', saveCallback: null };
      },
      /**
       * signal seach close
       * @param searchId name of search
       * @param value returned
       */
      signalSearchClose: function (searchId, contentTOs) {
        var childSearchConfig = this.searches[searchId];

        childSearchConfig.saveCallback.success(searchId, contentTOs);
      },
      /**
       * open child search
       * @parm form configuration
       */
      openChildSearch: function (childSearchConfig) {
        if (this.searches == null) {
          this.searches = new Array();
        }

        this.searches[childSearchConfig.searchId] = childSearchConfig;

        if (childSearchConfig.openInSameWindow) {
          newWindow = document.location = childSearchConfig.searchUrl;
        } else {
          var newWindow;
          CStudioAuthoring.Operations._openIframe(childSearchConfig.searchUrl, childSearchConfig.searchId, false); // TODO: test name on iframe
        }
      }
    },
    /**
     * Child form Manager
     */
    ChildFormManager: {
      forms: {},
      /**
       * create a new child form configuration
       */
      createChildFormConfig: function () {
        return {
          formName: '',
          formUrl: '',
          openAsTab: '',
          windowHeight: '',
          windowWidth: '',
          windowTitle: '',
          windowName: '',
          formSaveCallback: null
        };
      },
      /**
       * signal form close
       * @param formName name of form
       * @param value returned
       */
      signalFormClose: function (formName, name, value) {
        var childFormConfig = this.forms[formName];

        if (childFormConfig) {
          childFormConfig.formSaveCallback.success(formName, name, value);
        }
      },

      /*
       * @return formId : the form id if the form is open; if not, false
       */
      getChildFormByName: function (windowName) {
        var form = null;

        if (this.forms) {
          for (var formId in this.forms) {
            form = this.forms[formId];
            if (form.windowName == windowName) {
              return formId;
            }
          }
        }
        return false;
      },

      /**
       * open child form
       * @parm form configuration
       */
      openChildForm: function (childFormConfig) {
        this.forms = this.forms || {};

        var formId = childFormConfig.form;
        var childFormId;

        if (childFormConfig.windowName == null || childFormConfig.windowName == '') {
          // formId is encoded such that any '/' or '-' are removed, since IE doesn't
          // accept these characters in a window name
          childFormConfig.windowName = encodePathToNumbers(formId);
        } else {
          childFormConfig.windowName = encodePathToNumbers(childFormConfig.windowName);
        }

        childFormId = this.getChildFormByName(childFormConfig.windowName);
        childFormConfig.windowRef = window.open(childFormConfig.formUrl, childFormConfig.windowName);

        if (!childFormId) {
          this.forms[formId] = childFormConfig;
        } else {
          if (this.forms[childFormId].windowRef.closed) {
            // A child name with the same window name was created previously, but it doesn't reference
            // a window any more => delete the reference to this child form
            delete this.forms[childFormId];
            this.forms[formId] = childFormConfig;
          }
        }
      }
    },
    /**
     * Preview refresh mechanism
     */
    WindowManagerProxy: {
      lastKey: null,
      flash: false,
      title: document.title,
      currentWindowLocation: document.location,

      init: function () {
        if (typeof CStudioAuthoringContext == 'undefined') {
          YAHOO.lang.later(1000, this, CSA.WindowManagerProxy.init);
        } else {
          if (!window.name || window.name == '') {
            window.name = CStudioAuthoring.Utils.generateUUID();
          }

          CSA.Utils.Cookies.eraseCookie('cstudio-main-window');

          // Check if user is to be notified.
          this.notify = CSA.Utils.Cookies.readCookie('cstudio-preview-notify');
          if (this.notify != null) {
            CStudioAuthoring.Utils.Cookies.eraseCookie('cstudio-preview-notify');
            if (document.location.href.indexOf(CStudioAuthoringContext.authoringAppBaseUri) == -1) {
              // in some cases where common-api.js is not included in preview
              // this message shows up on the dashboard because the cookie does not get erased.
              // The basic assumption here is preview is not rooted below authoring url
              YAHOO.lang.later(2000, this, function () {
                CStudioAuthoring.Operations.showSimpleDialog(
                  'previewLoaded-dialog',
                  CStudioAuthoring.Operations.simpleDialogTypeINFO,
                  CMgs.format(formsLangBundle, 'notification'),
                  CMgs.format(formsLangBundle, 'previewLoaded'),
                  null, // use default button
                  YAHOO.widget.SimpleDialog.ICON_INFO,
                  'studioDialog'
                );
              });
            }
          }

          YAHOO.lang.later(
            1000,
            this,
            function () {
              var cookie = CSA.Utils.Cookies.readCookie('cstudio-main-window');
              if (cookie != null) {
                var pieces = cookie.split('|');

                var key = pieces[0];
                var loc = pieces[1];
                var tone = pieces[2];
                var signalToWindowId = pieces[3];

                if (signalToWindowId == window.name && (this.lastKey == null || this.lastKey != key)) {
                  CStudioAuthoring.Utils.Cookies.createCookie('cstudio-main-window-location', loc);
                  document.location = loc;
                }

                this.lastKey = key;
              }
            },
            [],
            1000
          );
        }
      }
    },

    /**
     * added service to get node icon.
     */
    IconService: {
      getItemIcon: function (item) {
        var itemIconClass = 'navPage';
        if (item.document) {
          itemIconClass = 'document';
        } else if (item.floating) {
          itemIconClass = 'ttFloating';
        } else if (item.component) {
          itemIconClass = 'ttComponent';
        } else {
          itemIconClass = 'tt';
        }

        if (item.deleted || item.submittedForDeletion) {
          itemIconClass += 'Deleted';
        }
        if (item.submitted || item.scheduled) {
          if (item.submitted) {
            itemIconClass += 'Submitted';
          }
          if (item.scheduled) {
            itemIconClass += 'Scheduled';
          }
        } else if (!item.deleted && item.inProgress) {
          itemIconClass += 'InProgress';
        }

        // If no flag is set, then it should be live item
        if (!item.deleted && !item.submitted && !item.scheduled && !item.inProgress) {
          itemIconClass = 'navPage';
        }

        itemIconClass += ' icon';

        return itemIconClass;
      }
    }
  });
  CSA.Clipboard.init();
  CSA.SelectedContent.init();
  /**
   * form command bar
   * @param containerId
   *    id of the container that will hold command bar
   * @addSpacer
   *   add spacer between form and controls
   */
  CSA.register({
    CommandToolbar: function (containerId, addSpacer) {
      this.init(containerId, addSpacer);
    }
  });
  /**
   * initialize the form command toolbar
   * @param {String} id ID of the container element for the toolbar
   */
  CSA.CommandToolbar.prototype.init = function (id, addSpacer) {
    this.container = document.getElementById(id);
    this.controlBox = null;
    if (this.container != null) {
      if (addSpacer == true) {
        var formControlSpacer = document.createElement('div');
        formControlSpacer.id = 'formBottomSpacer';
        formControlSpacer.style.height = '30px';
        this.container.appendChild(formControlSpacer);
      }

      var xformfooterWrapper = document.createElement('div');
      xformfooterWrapper.id = 'xformfooterWrapper';
      this.container.appendChild(xformfooterWrapper);

      var xformfooterheader = document.createElement('div');
      xformfooterheader.id = 'xformfooterheader';
      xformfooterWrapper.appendChild(xformfooterheader);

      var submissionControls = document.createElement('div');
      submissionControls.id = 'submission-controls';
      this.controlBox = submissionControls;
      YDom.addClass(this.controlBox, 'cstudio-form-controls-button-container');
      xformfooterheader.appendChild(submissionControls);
    }
  };
  /**
   * add a new control to the end of the controls
   * @param controlId
   *    id of button
   * @param label
   *    label on button
   * @param actionCallback
   *    function to be executed when button is pushed
   */
  CSA.CommandToolbar.prototype.addControl = function (controlId, label, actionCallback) {
    if (this.controlBox != null) {
      //var buttonControl = document.createElement("button");
      var buttonControl = document.createElement('input');
      buttonControl.id = controlId;
      buttonControl.type = 'button';
      buttonControl.className = 'cstudio-xform-button';
      //buttonControl.innerHTML = label;
      buttonControl.value = label;
      YDom.addClass(buttonControl, 'cstudio-form-control-button ');
      YDom.addClass(buttonControl, 'btn btn-default');
      this.controlBox.appendChild(buttonControl);

      buttonControl.onclick = function () {
        if (actionCallback.click) {
          actionCallback.click();
        } else {
          actionCallback();
        }
      };
    }
  };

  /**
   * disable an existing control
   * i.e. the controlId to be disabled
   * @param controlId
   *    id of button
   */
  CSA.CommandToolbar.prototype.disableControl = function (controlId) {
    if (this.controlBox != null) {
      var buttonControl = document.getElementById(controlId);

      if (buttonControl != null) {
        buttonControl.className = 'cstudio-xform-button-disabled';
        buttonControl.onclick = function () {};
      }
    }
  };

  if (!window.opener) {
    CSA.WindowManagerProxy.init();
  }

  /* Registering Request Timeout values for go live service request */
  CSA.register({
    'Request.Timeout': {
      GoLiveTimeout: 180000
    }
  });
})();

/**
 * simple internationalization mechanism
 */
CStudioAuthoring.Messages = CStudioAuthoring.Messages || {
  bundles: {},

  registerBundle: function (namespace, lang, bundle) {
    var M = CStudioAuthoring.Messages;

    if (!M.bundles[namespace]) {
      M.bundles[namespace] = {};
    }

    M.bundles[namespace][lang] = bundle;
  },

  getBundle: function (namespace, lang) {
    var bundle;
    var M = CStudioAuthoring.Messages;
    var namespace = M.bundles[namespace];
    if (namespace) {
      bundle = namespace[lang];

      if (bundle && lang != 'en') {
        // fallback
        bundle.fallbackBundle = namespace['en'];
      } else {
        bundle = namespace['en'];
      }
    }

    return bundle;
  },

  format: function (bundle, messageId, a, b, c, d, e, f, g) {
    var formattedMessage = messageId;
    var spaceRegex = new RegExp(' ', 'g');
    var starRegex = new RegExp('\\*', 'g');
    var key = messageId.replace(spaceRegex, '');
    key = key.replace(starRegex, '');

    if (bundle[key]) {
      formattedMessage = bundle[key];
    } else if (bundle.fallbackBundle && bundle.fallbackBundle[key]) {
      formattedMessage = bundle.fallbackBundle[key];
    }

    if (a) formattedMessage = formattedMessage.replace('{0}', a);
    if (b) formattedMessage = formattedMessage.replace('{1}', b);
    if (c) formattedMessage = formattedMessage.replace('{2}', c);
    if (d) formattedMessage = formattedMessage.replace('{3}', d);
    if (e) formattedMessage = formattedMessage.replace('{4}', e);
    if (f) formattedMessage = formattedMessage.replace('{5}', f);
    if (g) formattedMessage = formattedMessage.replace('{6}', g);

    return formattedMessage;
  },

  display: function (bundle, messageId, a, b, c, d, e, f, g) {
    var formattedMessage = CStudioAuthoring.Messages.format(bundle, messageId, a, b, c, d, e, f, g);
    document.write(formattedMessage);
  }
};

CStudioAuthoring.InContextEdit = {
  messagesSubscription: null,

  messageDialogs: (message) => {
    let topWindow = getTopLegacyWindow();
    amplify.publish('FORM_ENGINE_MESSAGE_POSTED', message);
    topWindow.iceDialogs &&
      topWindow.iceDialogs.forEach(({ iframe }) => {
        iframe && iframe.contentWindow && iframe.contentWindow.postMessage(message, location.origin);
      });
  },

  registerDialog: function (editorId, context) {
    let topWindow = getTopLegacyWindow();
    const iframe = topWindow.document.getElementById(`in-context-edit-editor-${editorId}`);
    if (!topWindow.iceDialogs) {
      topWindow.iceDialogs = [];
    }
    topWindow.iceDialogs.push({ key: editorId, value: context, iframe, stackNumber: topWindow.iceDialogs.length + 1 });
  },

  getDialog: function (editorId) {
    let topWindow = getTopLegacyWindow();
    return topWindow.iceDialogs.find((dialog) => dialog.key === editorId);
  },

  getDialogs: function () {
    let topWindow = getTopLegacyWindow();
    return topWindow.iceDialogs;
  },

  registerIceCallback: function (editorId, callback) {
    let topWindow = getTopLegacyWindow();
    if (!topWindow.iceCallback) {
      topWindow.iceCallback = [];
    }

    topWindow.iceCallback[editorId] = callback;
    topWindow.iceCallback[topWindow.iceCallback.length] = { key: editorId, value: callback };
  },

  getIceCallback: function (editorId) {
    let topWindow = getTopLegacyWindow();
    var iceWindowCallback;

    if (topWindow.iceCallback) {
      iceWindowCallback = topWindow.iceCallback[editorId];
    }

    return iceWindowCallback;
  },

  unstackDialog: function (editorId) {
    let topWindow = getTopLegacyWindow();
    if (topWindow.iceDialogs) {
      let dialog = topWindow.iceDialogs.find((dialog) => dialog.key === editorId);
      if (dialog) {
        topWindow.iceDialogs = topWindow.iceDialogs.filter((dialog) => dialog.key !== editorId);
        dialog.value.end();
        return true;
      } else {
        return false;
      }
    }
  },

  collapseDialog: function (editorId) {
    var dialog = window.parent.$('.studio-ice-container-' + editorId),
      controlBar = $('#formContainer .cstudio-form-controls-container')[0],
      ctrlBar = $(controlBar),
      colExpButtonBtn = $('#colExpButtonBtn'),
      overlayContainer = dialog.find('.overlay');

    if (!ctrlBar.hasClass('collapseForm')) {
      CStudioAuthoring.Utils.Cookies.createCookie('formEngineHeight', $(dialog).height().toString());
      $(dialog).attr('style', 'height: 57px !important');
      ctrlBar.css({ backgroundColor: '#7E9DBB' });
      ctrlBar.addClass('collapseForm');
      overlayContainer && overlayContainer.addClass('overlay-collapsed');
    } else {
      if (parseInt(CStudioAuthoring.Utils.Cookies.readCookie('formEngineHeight')) < 50) {
        $(dialog).height(300);
      } else {
        $(dialog).height(parseInt(CStudioAuthoring.Utils.Cookies.readCookie('formEngineHeight')));
      }
      ctrlBar.css({ backgroundColor: '#f8f8f8' });
      ctrlBar.removeClass('collapseForm');
      overlayContainer && overlayContainer.removeClass('overlay-collapsed');
    }
  },

  isDialogCollapsed: function () {
    const $controlBar = $('#formContainer .cstudio-form-controls-container').first();
    return $controlBar.hasClass('collapseForm');
  },

  regions: [],

  initializeEditRegion: function (regionElId, formField, regionLabel) {
    this.regions.push({ id: regionElId, formId: formField, label: regionLabel });

    var regionEl = document.getElementById(regionElId);
    var registerEl = document.createElement('div');
    registerEl.style.display = 'none';

    var controlBoxEl = document.createElement('div');

    var editControlEl = document.createElement('img');
    editControlEl.src = '/proxy/authoring/static-assets/themes/cstudioTheme/images/edit.png';

    var contentItem;
    var itemIsLoaded = true;

    if (formField.indexOf(':') == -1) {
      contentItem = CStudioAuthoring.SelectedContent.getSelectedContent()[0];
    } else {
      contentItem = formField.substring(0, formField.indexOf(':'));
      formField = formField.substring(formField.indexOf(':') + 1);
      itemIsLoaded = false;
    }

    editControlEl.content = {
      field: formField,
      item: contentItem,
      itemIsLoaded: itemIsLoaded
    };

    editControlEl.onclick = CStudioAuthoring.InContextEdit.editControlClicked;

    controlBoxEl.appendChild(editControlEl);
    var contentBoxEl = document.createElement('div');
    contentBoxEl.innerHTML = regionEl.innerHTML;

    regionEl.innerHTML = '';
    regionEl.appendChild(controlBoxEl);
    regionEl.appendChild(contentBoxEl);

    controlBoxEl.style.display = 'none';

    var iceToolsModuleCb = {
      moduleLoaded: function (moduleName, moduleClass, moduleConfig) {
        CStudioAuthoring.IceTools.IceToolsOffEvent.subscribe(function () {
          controlBoxEl.style.display = 'none';
        });

        CStudioAuthoring.IceTools.IceToolsOnEvent.subscribe(function () {
          controlBoxEl.style.display = 'inline';
          controlBoxEl.style.width = '20px';
        });
      }
    };

    CStudioAuthoring.Module.requireModule(
      'ice-tools-controller',
      '/static-assets/components/cstudio-preview-tools/ice-tools.js',
      0,
      iceToolsModuleCb
    );
  },

  editControlClicked: function () {
    if (this.content.itemIsLoaded == true) {
      CStudioAuthoring.Operations.performSimpleIceEdit(
        CStudioAuthoring.SelectedContent.getSelectedContent()[0],
        this.content.field
        //isEdit
        //callback
        //aux
      );
    } else {
      var lookupContentCb = {
        success: function (contentTO) {
          CStudioAuthoring.Operations.performSimpleIceEdit(
            contentTO.item,
            this.field
            //isEdit
            //callback
            //aux
          );
        },
        failure: crafter.noop,
        field: this.content.field
      };

      CStudioAuthoring.Service.lookupContentItem(
        CStudioAuthoringContext.site,
        this.content.item,
        lookupContentCb,
        false
      );
    }
  },

  initializeComponentEditRegion: function (regionElId, regionLabel) {
    var id = regionElId.replace('cstudio-component-', '');

    var lookupContentCb = {
      success: function (contentTO) {
        var regionEl = document.getElementById(regionElId);
        var registerEl = document.createElement('div');
        registerEl.style.display = 'none';

        var controlBoxEl = document.createElement('div');

        var editControlEl = document.createElement('img');
        editControlEl.src = '/proxy/authoring/static-assets/themes/cstudioTheme/images/edit-component.png';
        controlBoxEl.style.display = 'inline';
        controlBoxEl.style.cursor = 'pointer';

        var editTemplateControlEl = document.createElement('img');
        editTemplateControlEl.src = '/proxy/authoring/static-assets/themes/cstudioTheme/images/icons/code-edit.gif';
        controlBoxEl.style.cursor = 'pointer';

        var onSaveCb = {
          success: function () {
            if (!CStudioAuthoringContext.channel || CStudioAuthoringContext.channel == 'web') {
              document.location = document.location;
            } else {
              var cb = {
                moduleLoaded: function (moduleName, moduleClass, moduleConfig) {
                  try {
                    moduleClass.render();
                  } catch (e) {}
                },

                self: this
              };

              CStudioAuthoring.Module.requireModule(
                'medium-panel-' + CStudioAuthoringContext.channel,
                '/static-assets/components/cstudio-preview-tools/mods/agent-plugins/' +
                  channel.value +
                  '/' +
                  CStudioAuthoringContext.channel +
                  '.js',
                0,
                cb
              );
            }
          },
          failure: function () {}
        };

        editControlEl.onclick = function () {
          CStudioAuthoring.Operations.performSimpleIceEdit(
            contentTO.item
            // field
            // isEdit
            // callback
            // aux
          );
        };

        editTemplateControlEl.onclick = function () {
          let path = contentTO.item.renderingTemplates[0].uri;

          if (CStudioAuthoringContext.channel && CStudioAuthoringContext.channel != 'web') {
            path = path.substring(0, path.lastIndexOf('.ftl')) + '-' + CStudioAuthoringContext.channel + '.ftl';
          }

          CStudioAuthoring.Operations.openCodeEditor({
            path,
            mode: CrafterCMSNext.util.content.getEditorMode(contentTO.item.mimeType),
            onSuccess: () => {
              onSaveCb.success();
            }
          });
        };

        controlBoxEl.appendChild(editControlEl);
        controlBoxEl.appendChild(editTemplateControlEl);
        var contentBoxEl = document.createElement('div');
        contentBoxEl.innerHTML = regionEl.innerHTML;

        regionEl.innerHTML = '';
        regionEl.appendChild(controlBoxEl);
        regionEl.appendChild(contentBoxEl);

        controlBoxEl.style.display = 'none';

        var iceToolsModuleCb = {
          moduleLoaded: function (moduleName, moduleClass, moduleConfig) {
            CStudioAuthoring.IceTools.IceToolsOffEvent.subscribe(function () {
              controlBoxEl.style.display = 'none';
            });

            CStudioAuthoring.IceTools.IceToolsOnEvent.subscribe(function () {
              regionEl.style.display = 'inline-block';
              controlBoxEl.style.display = 'inline';
            });
          }
        };

        CStudioAuthoring.Module.requireModule(
          'ice-tools-controller',
          '/static-assets/components/cstudio-preview-tools/ice-tools.js',
          0,
          iceToolsModuleCb
        );
      },
      failure: function () {}
    };

    CStudioAuthoring.Service.lookupContentItem(CStudioAuthoringContext.site, id, lookupContentCb, false);
  },

  autoInitializeEditRegions: function () {
    var iceEls = YAHOO.util.Dom.getElementsByClassName('cstudio-ice', null, document.body);

    if (iceEls) {
      for (var i = 0; i < iceEls.length; ++i) {
        CStudioAuthoring.InContextEdit.initializeEditRegion(iceEls[i].id, iceEls[i].id);
      }
    }

    var componentIceEls = YAHOO.util.Dom.getElementsByClassName('cstudio-component-ice', null, document.body);

    for (var i = 0; componentIceEls && i < componentIceEls.length; i++) {
      CStudioAuthoring.InContextEdit.initializeComponentEditRegion(componentIceEls[i].id, componentIceEls[i].id);
    }
  },

  autoSizeIceDialog: function (editorId) {
    var el = document.getElementById('in-context-edit-editor-' + editorId);
    var containerEl = document.getElementById('viewcontroller-in-context-edit-' + editorId + '_0_c');
    if (!containerEl) return;

    var height = YAHOO.util.Dom.getViewportHeight() - 200;

    containerEl.style.height = height + 'px';
    el.style.height = height + 'px';
    var iframeDoc = el.contentWindow.document;
    el.style.width = iframeDoc.body.scrollWidth + 100 + 'px';

    iframeDoc.activeElement.parentNode.style.background = '#F0F0F0';
    iframeDoc.activeElement.style.background = '#F0F0F0';
    window.scrollBy(0, 1);
  }
};

CStudioAuthoring.FilesDiff = {
  autoSizeIceDialog: function (editorId) {
    var el = document.getElementById('in-context-edit-editor-' + editorId);
    var containerEl = document.getElementById('studio-ice-container-' + editorId);
    if (!containerEl) return;

    var height = YAHOO.util.Dom.getViewportHeight() - 90;

    containerEl.style.height = height + 'px';
    //el.style.height = height+'px';
    window.scrollBy(0, 1);
  }
};

(function (w) {
  var Dom = YAHOO.util.Dom,
    Event = YAHOO.util.Event;

  var CrafterStudioUtils = w.CStudioAuthoring.Utils,
    aElements = [],
    getStyle = Dom.getStyle,
    isString = YAHOO.lang.isString,
    offset = function (elem) {
      var aXY = Dom.getXY(elem);
      return {
        left: aXY[0],
        top: aXY[1]
      };
    },
    height = function (elem) {
      var v = elem.offsetHeight;
      /* TODO: required to consider other elements to really get this value */
      return v;
    },
    width = function (elem) {
      var v = elem.offsetWidth;
      /* TODO: required to consider other elements to really get this value */
      return v;
    },
    isVisible;

  var div = document.createElement('div'),
    tds,
    trustOffsets;

  div.innerHTML = "<table><tr><td style='padding:0;border:0;display:none'></td><td>t</td></tr></table>";
  tds = div.getElementsByTagName('td');

  trustOffsets = tds[0].offsetHeight === 0;

  tds[0].style.display = '';
  tds[1].style.display = 'none';

  trustOffsets = trustOffsets && tds[0].offsetHeight === 0;

  isVisible = function (element) {
    var width = element.offsetWidth,
      height = element.offsetHeight;
    return !(
      (width === 0 && height === 0) ||
      (!trustOffsets && (element.style.display || getStyle('display') === 'none'))
    );
  };

  var scroll = function () {
    if (!aElements.length) {
      return CrafterStudioUtils._removeScrollListener();
    }

    var a = Dom.getDocumentScrollLeft(),
      b = Dom.getDocumentScrollTop(),
      viewportH = Dom.getViewportHeight(),
      viewportW = Dom.getViewportWidth();

    for (var i = 0, l = aElements.length; i < l; ++i) {
      var elem = aElements[i];
      if (isVisible(elem)) {
        var o = offset(elem),
          x = o.left,
          y = o.top,
          _w = width(elem),
          _h = height(elem),
          yAxisCondition = y <= viewportH + b && b <= y + _h;

        if (yAxisCondition && !elem._hasBeenNotified) {
          // trigger
          elem._hasBeenNotified = true;
          elem._onVisibleHandler();
        }
      }
    }
  };

  CrafterStudioUtils.isVisible = isVisible;
  CrafterStudioUtils.onVisible = function (elem, handler) {
    if (isString(elem)) elem = document.getElementById(elem);
    if (elem && handler) {
      elem._onVisibleHandler = handler;
      aElements.push(elem);
      CrafterStudioUtils._addScrollListener();
      scroll();
    }
  };
  CrafterStudioUtils._addScrollListener = function () {
    if (!CrafterStudioUtils._addScrollListener.listeningScroll) {
      Event.addListener(w, 'scroll', scroll);
      CrafterStudioUtils._addScrollListener.listeningScroll = true;
    }
  };
  CrafterStudioUtils._removeScrollListener = function () {
    Event.removeListener(w, 'scroll', scroll);
    CrafterStudioUtils._addScrollListener.listeningScroll = false;
  };

  CrafterStudioUtils._addScrollListener.listeningScroll = false;
})(window);

/* Create crafterSite cookie on DOM Ready (so CStudioAuthoringContext object is available) */
(function (w) {
  // Parameter 'win' of the anonymous function will be the object passed as parameter 'w'
  YAHOO.util.Event.onDOMReady(function (e, args, win) {
    CrafterCMSNext.system.getStore().subscribe((store) => {
      if (!(!window.ActiveXObject && 'ActiveXObject' in window)) {
        const state = store.getState();
        CrafterCMSNext.util.auth.setSiteCookie(win.CStudioAuthoringContext.site, state.env.useBaseDomain);
      }
      CStudioAuthoring.Utils.getTimeZoneConfig();
    });
  }, w);
})(window);

function getTopLegacyWindow(nextWindow) {
  try {
    if (nextWindow === window.top) return nextWindow;
    else if (nextWindow && nextWindow.IS_LEGACY_TOP_WINDOW) {
      return nextWindow;
    } else if (nextWindow) {
      return getTopLegacyWindow(nextWindow.parent);
    } else {
      return getTopLegacyWindow(window);
    }
  } catch {
    return window.top;
  }
}

if (!window.location.pathname.includes('/studio/search') && !window.location.pathname.includes('/studio/legacy/form')) {
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof CrafterCMSNext === 'undefined') {
      document.addEventListener('CrafterCMS.CodebaseBridgeReady', function () {
        CrafterCMSNext.renderBackgroundUI({ mountLegacyConcierge: true });
      });
    } else {
      CrafterCMSNext.renderBackgroundUI({ mountLegacyConcierge: true });
    }
  });
}
