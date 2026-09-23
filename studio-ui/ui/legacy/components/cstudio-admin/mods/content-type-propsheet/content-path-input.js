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
  const { React, ReactDOM } = CrafterCMSNext;
  const { useState } = React;

  function Selector({ initialValue, updateFn, defaultValue, rootPath, validations }) {
    const [value, setValue] = useState(initialValue);

    const onChange = (value) => {
      setValue(value);
      updateFn(value);
    };

    const onBlur = () => {
      let path = value;
      if (!validations.regex.test(value)) {
        path = rootPath + value;
      }
      onChange(value ? path : defaultValue);
    };

    const checkForMacros = (value) => {
      let isMacro = value.indexOf('{');
      if (isMacro !== -1) {
        value = value.substring(0, isMacro);
        value = value.endsWith('/') ? value.substring(0, value.length - 1) : value;
      }
      return value;
    };

    const openPathBrowser = () => {
      let unmount;
      const dialogContainer = document.createElement('div');
      CrafterCMSNext.render(dialogContainer, 'PathSelectionDialog', {
        open: true,
        rootPath,
        initialPath: value ? checkForMacros(value) : rootPath,
        onClose: () => unmount(),
        onOk: ({ path }) => {
          unmount();
          onChange(path);
        }
      }).then((done) => (unmount = done.unmount));
    };

    return (
      <>
        <input
          type="text"
          value={value}
          className="content-path-input--input"
          placeholder={defaultValue}
          onBlur={validations?.regex ? onBlur : null}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="content-path-input--icon" onClick={openPathBrowser}>
          <i className="fa fa-search" aria-hidden="true" />
        </button>
      </>
    );
  }

  function ContentPathInput(fieldName, container) {
    this.fieldName = fieldName;
    this.container = container;
    this.value = '';
  }

  ContentPathInput.prototype = {
    render(initialValue, updateFn, fName, itemId, defaultValue, typeControl, disabled, properties) {
      const element = $('<div class="repository-selector"/>').appendTo(this.container)[0];

      const onChange = (value) => {
        updateFn(null, { fieldName: this.fieldName, value });
      };

      const root = craftercms.libs.ReactDOMClient.createRoot(element);
      root.render(
        <Selector
          initialValue={initialValue}
          rootPath={properties.rootPath}
          updateFn={onChange}
          defaultValue={defaultValue}
          validations={properties.validations}
        />
      );

      this.value = value;
    },
    getValue() {
      return this.value;
    }
  };

  CStudioAuthoring.Module.moduleLoaded(
    'cstudio-console-tools-content-types-proptype-content-path-input',
    ContentPathInput
  );
})();
