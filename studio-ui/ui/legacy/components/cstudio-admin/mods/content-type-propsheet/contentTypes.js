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
  const { React, ReactDOM, i18n } = CrafterCMSNext;
  const { useState, useMemo, useRef, useEffect } = React;

  const STAR = '*';

  function createLookupTableFromCVS(cvs) {
    return !cvs
      ? []
      : cvs.split(',').reduce(
          (lookupTable, id) => ({
            ...lookupTable,
            [id]: true
          }),
          {}
        );
  }

  function Selector({ contentTypes, onSelection, initialValue }) {
    const [keywords, setKeywords] = useState('');
    const [selected, setSelected] = useState(createLookupTableFromCVS(initialValue));

    const types = useMemo(
      () => [
        { name: STAR, label: 'Allow any component' },
        ...contentTypes.filter(
          (type) => type.type === 'component' && (type.name.includes(keywords) || type.label.includes(keywords))
        )
      ],
      [contentTypes, keywords]
    );

    const ref = useRef();

    const update = (id, isSelected) => {
      const isStar = id === STAR;
      const nextSelected = isStar ? {} : { ...selected };
      if (isSelected) {
        nextSelected[id] = isSelected;
      } else {
        delete nextSelected[id];
      }
      setSelected(nextSelected);
      onSelection && onSelection(Object.keys(nextSelected));
    };

    useEffect(() => {
      if (selected[STAR]) {
        Array.from(ref.current.querySelectorAll('input')).forEach((e) => {
          if (e.value !== STAR) {
            e.checked = false;
          }
        });
      }
    }, [selected]);

    return (
      <div ref={ref}>
        <div className="content-type-selector--search-wrapper">
          <input
            type="text"
            value={keywords}
            className="content-type-selector--search-input"
            placeholder={'Search components...'}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
        {types.map((contentType) => (
          <label key={`${contentType.name}_label`} className="content-type-selector--label">
            <input
              type="checkbox"
              value={contentType.name}
              className="content-type-selector--checkbox"
              checked={selected[contentType.name]}
              disabled={contentType.name === STAR ? false : selected[STAR]}
              onChange={(e) => update(e.target.value, e.target.checked)}
            />
            {contentType.label}
          </label>
        ))}
      </div>
    );
  }

  function ContentTypes(fieldName, container) {
    this.fieldName = fieldName;
    this.container = container;
    this.value = '';
  }

  ContentTypes.prototype = {
    render(value, updateFn) {
      const element = $('<div class="content-type-selector"/>').appendTo(this.container)[0];
      const contentTypes = CStudioAuthoring.Dialogs.DialogSelectContentType.contentTypes;
      const root = craftercms.libs.ReactDOMClient.createRoot(element);
      root.render(
        <Selector
          initialValue={value}
          contentTypes={contentTypes}
          onSelection={(selected) => {
            const value = (this.value = selected.join(','));
            updateFn(null, { fieldName: this.fieldName, value });
          }}
        />,
        element
      );
      this.value = value;
    },
    getValue() {
      return this.value;
    }
  };

  CStudioAuthoring.Module.moduleLoaded('cstudio-console-tools-content-types-proptype-contentTypes', ContentTypes);
})();
