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

CStudioAdminConsole.Tool.ContentTypes.PropertyType.Datasource =
  CStudioAdminConsole.Tool.ContentTypes.PropertyType.Datasource ||
  function (fieldName, containerEl, form, type) {
    this.fieldName = fieldName;
    this.containerEl = containerEl;
    this.form = form;

    const isTypeDetailed = type.includes(':');
    const typeData = type.split(':');
    this['interface'] = isTypeDetailed ? typeData[1] : '' + type;
    this.fieldValue = [];
    this.inputType = isTypeDetailed ? (typeData[2] === 'singleSelection' ? 'radio' : 'checkbox') : 'checkbox';

    return this;
  };

YAHOO.extend(
  CStudioAdminConsole.Tool.ContentTypes.PropertyType.Datasource,
  CStudioAdminConsole.Tool.ContentTypes.PropertyType,
  {
    render: function (value, updateFn, fName, itemId) {
      var type = this['interface'];
      var containerEl = this.containerEl;
      var valuesEl, controlEl;

      var datasources = this.form.datasources;

      // If the control is a node selector and the data source is a taxonomy, we don't want to show it because the node selector is not compatible with the taxonomy data source.
      var isControlNodeSelector = false;
      var findField = function (fields) {
        for (var i = 0; i < (fields || []).length; i++) {
          if (fields[i].id === itemId && fields[i].type === 'node-selector') {
            isControlNodeSelector = true;
          }
          findField(fields[i].fields);
        }
      };
      (this.form.sections || []).forEach(function (section) {
        findField(section.fields);
      });

      if (datasources.length) {
        this.fieldValue = !value
          ? []
          : typeof value == 'string'
            ? value.split(',').filter((name) => datasources.some((ds) => ds.id === name))
            : value;

        valuesEl = document.createElement('div');

        for (var i = 0; i < datasources.length; i++) {
          var datasource = datasources[i];
          if (datasource['interface'] === type && !(isControlNodeSelector && datasource.type === 'simpleTaxonomy')) {
            controlEl = this.createControl(datasource, updateFn, type, itemId);
            valuesEl.appendChild(controlEl);
          }
        }

        if (valuesEl.children.length <= 0) {
          this.createLabel(valuesEl);
        }
        containerEl.appendChild(valuesEl);
        YAHOO.util.Dom.addClass(containerEl, 'checkboxes');
      } else {
        valuesEl = document.createElement('div');
        containerEl.appendChild(valuesEl);
        this.createLabel(valuesEl);
      }
    },

    createLabel: function (containerEl) {
      var labelEl = document.createElement('span');
      labelEl.innerHTML = CMgs.format(langBundle, 'noDatasources');
      YDom.setStyle(labelEl, 'font-style', 'italic');
      containerEl.appendChild(labelEl);
    },

    createControl: function (datasource, updateFn, type, itemId) {
      var labelEl,
        cbEl,
        labelText,
        _self = this,
        controlId = `${datasource.type}_${datasource.id}`;

      labelEl = document.createElement('label');
      labelEl.setAttribute('for', controlId);

      labelText = document.createTextNode(datasource.title);

      cbEl = document.createElement('input');

      let clickFn;
      if (itemId === 'checkboxgroup' || this.inputType === 'radio') {
        cbEl.type = 'radio';
        if (!this.radioGroupName) {
          this.radioGroupName = CStudioAuthoring.Utils.generateUUID();
        }
        cbEl.name = this.radioGroupName;
        clickFn = function () {
          _self.removeAll();
          _self.addValue(this.value);
          updateFn(null, { fieldName: _self.fieldName, value: _self.fieldValue.toString() });
        };
      } else {
        cbEl.type = 'checkbox';

        clickFn = function () {
          if (this.checked) {
            if ($(this).parent().parent().find('input[type="checkbox"]:checked').length === 1) {
              _self.removeAll();
            }
            _self.addValue(this.value);
            updateFn(null, { fieldName: _self.fieldName, value: _self.fieldValue.toString() });
          } else {
            _self.removeValue(this.value);
            updateFn(null, { fieldName: _self.fieldName, value: _self.fieldValue.toString() });
          }
        };
      }

      cbEl.value = datasource.id;
      cbEl.id = controlId;

      if (this.fieldValue.indexOf(datasource.id) > -1) {
        cbEl.checked = true;
      }

      YAHOO.util.Event.on(cbEl, 'click', clickFn);

      labelEl.appendChild(cbEl);
      labelEl.appendChild(labelText);
      return labelEl;
    },

    addValue: function (elKey) {
      var idx = this.fieldValue.indexOf(elKey);
      if (0 > idx) this.fieldValue.push(elKey);
    },

    removeAll: function () {
      this.fieldValue.splice(0, this.fieldValue.length);
    },

    removeValue: function (elKey) {
      var idx = this.fieldValue.indexOf(elKey);
      this.fieldValue.splice(idx, 1);
    },

    getValue: function () {
      return this.fieldValue;
    }
  }
);

CStudioAuthoring.Module.moduleLoaded(
  'cstudio-console-tools-content-types-proptype-datasource',
  CStudioAdminConsole.Tool.ContentTypes.PropertyType.Datasource
);
