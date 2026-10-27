![npm (scoped)](https://img.shields.io/npm/v/@craftercms/ice?style=plastic)

# @craftercms/ice

Contains JavaScript utilities to use Crafter CMS' in-context editing in your apps and sites

**Note**: All methods of this package work with [Content Instance](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/ContentInstance.ts) as data structure they understand (the model param). Use in conjunction with `parseDescriptor` and `preParseSearchResults` from `@craftercms/content` to obtain such data structure.

## Usage

All of Crafter CMS packages can be used either via npm or in plain html/javascript via regular script imports.

### Via npm

- `yarn add @craftercms/ice` or `npm install @craftercms/ice`
- `import` or `require` the functions you wish.

### Via html script imports

- Download the bundle and import them in your page.
- The bundles declare a global variable named `craftercms`. You can access all craftercms' packages and functions under this root.
- The `ice` package depends on rxjs, make sure to import rxjs too before the `ice` script.
 
**Tip**: Once you've imported the scripts, type `craftercms` on your browser's dev tools console to inspect the package(s)
 
#### Vanilla html/js example
 ```html
<div id="myFeature"></div>
<script src="https://unpkg.com/rxjs"></script>
<script src="https://unpkg.com/@craftercms/utils"></script>
<script src="https://unpkg.com/@craftercms/classes"></script>
<script src="https://unpkg.com/@craftercms/content"></script>
<script src="https://unpkg.com/@craftercms/ice"></script>
<script>
  (function ({ content, ice }, { operators }) {

    content.getItem(
      '/site/website/index.xml',
      { baseUrl: 'http://localhost:8080', site: 'editorial' }
    ).pipe(
      operators.map(content.parseDescriptor)
    ).subscribe((model) => {
      const attrs = ice.getICEAttributes({ model, parentModelId: '/site/website/index.xml' });
      const elem = document.querySelector('#myFeature');
      Object.entries(attrs).forEach(([attr, value]) => {
        elem.setAttribute(attr, value);
      });
      Object.entries(model).forEach(([fieldId, value]) => {
        if (fieldId !== 'craftercms') {
          const el = document.createElement('div');
          el.innerText = `${fieldId}: ${value}`;
          elem.appendChild(el);
        }
      });
    });

  })(craftercms, rxjs);
</script>
```

## Package Index

The examples below assume usage in the style of using via npm. If you're using the bundles, 
directly importing as a script in the browser, these functions will be under the global variable
named `craftercms.ice` (i.e. `window.craftercms.ice`).

### fetchIsAuthoring

Interrogates the current origin server to determine if the site/app is running in Crafter CMS authoring environment (Preview). Positive reply (`true`) means is authoring; assume you need to add pencils and import other authoring tools. False means is delivery and all authoring tools should be disabled.

#### Example

```typescript
import { fetchIsAuthoring } from '@craftercms/ice';

fetchIsAuthoring().then((isAuthoring) => {
  console.log(`You're currently in ${isAuthoring ? 'authoring' : 'delivery'}.`);
});
```  

### getIceAttributes

Use this function to obtain the attributes that you need to add to your HTML element(s) to put pencils for In Context Editing.

#### Example

```typescript
  import { from, forkJoin } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { getICEAttributes, fetchIsAuthoring, repaintPencils } from '@craftercms/ice';
  import { getItem, parseDescriptor } from '@craftercms/content';

  forkJoin({
    isAuthoring: from(fetchIsAuthoring()),
    model: getItem('/site/website/index.xml', { site: 'editorial' }).pipe(map(parseDescriptor))
  }).subscribe(({ isAuthoring, model }) => {
  
    const page = document.querySelector('#main');
    if (page) {
      const homepageEditPencil = getICEAttributes({ model, isAuthoring });
      Object.entries(homepageEditPencil).forEach(([attr, value]) => {
        page.setAttribute(attr, value);
      });
      repaintPencils();
    }
  
  });
```

### getDropZoneAttributes

Use this function to obtain the attributes that you need to add to your HTML element(s) to mark them as an item selector drop zone.

#### Example

```typescript
  import { from, forkJoin } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { getICEAttributes, getDropZoneAttributes, fetchIsAuthoring, repaintPencils } from '@craftercms/ice';
  import { getItem, parseDescriptor } from '@craftercms/content';

  forkJoin({
    isAuthoring: from(fetchIsAuthoring()),
    model: getItem('/site/website/index.xml', { site: 'editorial' }).pipe(map(parseDescriptor))
  }).subscribe(({ isAuthoring, model }) => {
  
    const features = document.querySelector('.features');
    if (features) {

      const homepageFeaturesDropZone = getDropZoneAttributes({ model, isAuthoring, zoneName: 'features_o' });
      Object.entries(homepageFeaturesDropZone).forEach(([attr, value]) => {
        features.setAttribute(attr, value);
      });

      const items = features.querySelectorAll('article');
      items.forEach((item) => {
        const pencil = getICEAttributes({ model, isAuthoring });
        Object.entries(pencil).forEach(([attr, value]) => {
          item.setAttribute(attr, value);
        });
      });
        
      repaintPencils();

    }

  });
```

### addAuthoringSupport

Use this method to include the necessary scripts to enable Crafter CMS authoring support (i.e. pencils, drag & drop, etc.) on your site/app. This function does not check whether you're in authoring or delivery. You should check that prior to invoking.

#### Example 

```typescript jsx
import React, { useEffect } from 'react';
import { isAuthoring } from '../utils';
import { addAuthoringSupport } from '@craftercms/ice';

function App() {
  useEffect(() => {
    if (isAuthoring()) {
      // This is a react example but you may use addAuthoringSupport outside of react
      addAuthoringSupport().then(() => {
        // Feel free to discard the promise if you don't need 
        console.log('Authoring tools have loaded and are ready to use.');
      });
    }
  }, []);
  return (
    {/* ... */}
  );
}
```

### repaintPencils

Re-renders all pencils

#### Example

```typescript jsx
import { repaintPencils } from '@craftercms/ice';

new Carousel({
  element: '#myElement',
  // ...other settings
  onSlideChange: () => {
    // Update pencils so current slide pencil is visible and prev slide is gone.
    repaintPencils();
  }
});
```

### reportNavigation

Report up to Crafter Studio that navigation has occurred.

Useful primarily for SPAs when there's no page reload, but the page context changes.

### Example

```typescript
import { reportNavigation } from '@craftercms/ice';

function DynamicRoute(props) {
  const { match, location } = props;
  let url = match.path.includes(':')
    ? match.path.substring(0, match.path.indexOf(':') -1)
    : match.url;
  useEffect(() => {
    reportNavigation(url);
  }, [url]);
  return (
    ...
  );
}
```

## @craftercms/ice/react

React bindings for pencils and drop zones. Requires React 16.8.0 or above (hooks release). Not available for class components, use the plain methods described above part of this same package.

### useICE

Use this function to obtain the attributes that you need to add to your HTML element(s) to put pencils for In Context Editing.

Make sure to use the parseDescriptor function from `@craftercms/content` as that's the structure these hooks understand.

#### Example

```typescript jsx
  import React, { useEffect, useState } from 'react';
  import { from, forkJoin } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { fetchIsAuthoring } from '@craftercms/ice';
  import { useICE } from '@craftercms/ice/react';
  import { getItem, parseDescriptor } from '@craftercms/content';
  
  function App() {
    const [state, setState] = useState();
    useEffect(() => {
      forkJoin({
        isAuthoring: from(fetchIsAuthoring()),
        model: getItem('/site/website/index.xml', { site: 'editorial' }).pipe(map(parseDescriptor))
      }).subscribe(({ isAuthoring, model }) => {
        setState({ isAuthoring, model });
      });
    }, []);
    return (
      state ? <HomePage /> : 'Loading...'
    );
  }
  
  function HomePage(props) {
    const { isAuthoring, model } = props;
    const { props: pencil } = useICE({ isAuthoring, model });
    return  (
      <div {...pencil}>
        {/* ... */}
      </div>
    );
  }
  
```

### useDropZone

Use this function to obtain the attributes that you need to add to your HTML element(s) to mark them as an item selector drop zone.

Make sure to use the parseDescriptor function from `@craftercms/content` as that's the structure these hooks understand.

```typescript jsx
  import React, { useEffect, useState } from 'react';
  import { from, forkJoin } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { fetchIsAuthoring } from '@craftercms/ice';
  import { useICE, useDropZone } from '@craftercms/ice/react';
  import { getItem, parseDescriptor } from '@craftercms/content';
  
  function App() {
    const [state, setState] = useState();
    useEffect(() => {
      forkJoin({
        isAuthoring: from(fetchIsAuthoring()),
        model: getItem('/site/website/index.xml', { site: 'editorial' }).pipe(map(parseDescriptor))
      }).subscribe(({ isAuthoring, model }) => {
        setState({ isAuthoring, model });
      });
    }, []);
    return (
      state ? <HomePage /> : 'Loading...'
    );
  }
  
  function HomePage(props) {
    const { isAuthoring, model } = props;
    const { props: pencil } = useICE({ isAuthoring, model });
    const { props: dz } = useDropZone({ isAuthoring, model, fieldId: 'features_o' });
    return  (
      <div {...pencil}>
        <section className="features" {...dz}>
          {
            model.features_o.map((feature) => <Feature model={feature} isAuthoring={isAuthoring} />)
          }
        </section>
      </div>
    );
  }
  
  function Feature(props) {
    const { isAuthoring, model } = props;
    const { props: pencil } = useICE({ isAuthoring, model });
    return  (
      <article {...pencil}>
        <h2>{model.title_s}</h2>
        <p>{model.body_s}</p>
      </article>
    );
  }
```
