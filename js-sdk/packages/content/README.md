![npm (scoped)](https://img.shields.io/npm/v/@craftercms/content?style=plastic)

# @craftercms/content

This package contains services for retrieving content and navigation using APIs offered by Crafter CMS.

## Usage

All of Crafter CMS packages can be used either via npm or in plain html/javascript via regular script imports.

### Via npm

- Install module using `yarn` or `npm`
  - Yarn: `yarn add @craftercms/content`
  - npm: `npm install @craftercms/content`
- Import and use the service(s) you need

### Via html script imports

- Download the bundle and import them in your page.
- The bundle declare a global variable named `craftercms`. You can access all craftercms' packages and functions under this root.
- The `content` package depends on `rxjs`, `@craftercms/utils`, `@craftercms/classes`; make sure to import those too before the `content` script.

**Tip**: Once you've imported the scripts, type `craftercms` on your browser's dev tools console to inspect the package(s)

#### Vanilla html/js example
 ```html
<div id="myFeature"></div>
<script src="https://unpkg.com/rxjs"></script>
<script src="https://unpkg.com/@craftercms/utils"></script>
<script src="https://unpkg.com/@craftercms/classes"></script>
<script src="https://unpkg.com/@craftercms/content"></script>
<script>
  (function ({ content }, { operators }) {

    content.getItem(
      '/site/website/index.xml',
      { baseUrl: 'http://localhost:8080', site: 'editorial' }
    ).pipe(
      operators.map(content.parseDescriptor)
    ).subscribe((model) => {
      const elem = document.querySelector('#myFeature');
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

### Service pre-configuration
You may pre-configure content services to a certain configuration to then you may omit the config param on subsequent calls to services

```typescript
  import { Item } from '@craftercms/models';
  import { getItem } from '@craftercms/content';
  import { crafterConf } from '@craftercms/classes';

  // Configure crafter services "globally". Your config will be cached.
  // All content services use the specified configuration on subsequent calls.
  crafterConf.configure({
    baseUrl: 'http://authoring.company.com',
    site: 'editorial'
  });

  // Second param "config" will use "http://authoring.company.com" as
  // crafter base url and "editorial" as the site to query
  getItem('/site/website/index.xml').subscribe((item: Item) => {
    console.log(item);
  });
```

## Package Index

The examples below assume usage in the style of using via npm. If you're using the bundles,
directly importing as a script in the browser, these functions will be under the global variable
named `craftercms.content` (i.e. `window.craftercms.content`).

### parseDescriptor
Parse a [Descriptor](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/descriptor.ts), [Item](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/item.ts) or a GraphQL response into a [Content Instance](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/ContentInstance.ts). It could also be a collection of any of these types.

`parseDescriptor(response: Descriptor | Item | GraphQLResponse | Descriptor[] | Item[] | GraphQLResponse)`

| Parameters    |                |
| ------------- |:--------------:|
| response      | The response of a getItem, getDescriptor or GraphQL fetch call |

#### Returns

[ContentInstance](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/ContentInstance.ts)

#### Examples

- If you want a cleaner/parsed response, you may use `parseDescriptor` util to parse the response for you. You may use it to parse getItem, getDescriptor or GraphQL responses.

```typescript
  import { map } from 'rxjs/operators';
  import { ContentInstance } from '@craftercms/models';
  import { getChildren, getItem, parseDescriptor } from '@craftercms/content';

  getItem('/site/website/index.xml', { site: 'editorial' }).pipe(
    map(parseDescriptor)
  ).subscribe((content: ContentInstance) => {
    console.log(content);
  });

  getChildren('/site/website', { site: 'editorial' }).pipe(
    map(parseDescriptor)
  ).subscribe((content: ContentInstance[]) => {
    console.log(content);
  });
```

### preParseSearchResults
Inspects and parses elasticsearch hits and pre-parses objects before they can be sent to parseDescriptor
@see https://github.com/craftersoftware/craftercms/issues/4057

```js
import { createQuery, search } from '@craftercms/search';
import { parseDescriptor, preParseSearchResults } from '@craftercms/content';

search(
  createQuery({
    query: {
      bool: {
        filter: [/*...*/]
      }
    }
  }),
  { baseUrl: 'http://localhost:8080', site: 'editorial' }
).pipe(
  map(({ hits, ...rest }) => ({
    ...rest,
    hits: hits.map(({ _source }) => parseDescriptor(
      preParseSearchResults(_source)
    ))
  }))
).subscribe((results) => {
  // Do stuff with results...
});
```

### Get Item
Get an Item from the content store.

`getItem(path: string, config?: CrafterConfig)`

| Parameters    |                                                                                                                                                                                 |
| ------------- |:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| path          |                                                                      The item’s path in the content store                                                                       |
| config        | Crafter configuration. Optional. Default value in [CrafterConfig](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/crafter-config.ts). |

#### Returns

[Item](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/item.ts) - from the content store

#### Examples

- Get the index page from the site:

```typescript
  import { Item } from '@craftercms/models';
  import { getItem } from '@craftercms/content';

  getItem('/site/website/index.xml', { site: 'editorial' }).subscribe((item: Item) => {
    console.log(item);
  });
```

- If you want a cleaner/parsed response, you may use `parseDescriptor` util to parse the response for you.

```typescript
  import { map } from 'rxjs/operators';
  import { ContentInstance } from '@craftercms/models';
  import { getItem, parseDescriptor } from '@craftercms/content';

  getItem('/site/website/index.xml', { site: 'editorial' }).pipe(
    map(parseDescriptor)
  ).subscribe((content: ContentInstance) => {
    console.log(content);
  });
```

### Get Descriptor
Get the descriptor data of an Item in the content store.

`getDescriptor(path: string, config?: CrafterConfig)`

| Parameters    |                |
| ------------- |:--------------:|
| path          | The item’s path in the content store |
| config        | Crafter configuration. Optional. Default value in [here](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#CrafterConfig). |

#### Returns

[Descriptor](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#Descriptor) - from the content store

#### Examples

- Get the index page from the site:

```typescript
  import { map } from 'rxjs/operators';
  import { getDescriptor, parseDescriptor } from '@craftercms/content';
  import { Descriptor, ContentInstance } from '@craftercms/models';

  // Example 1: Supplying config inline, Descriptor response...
  getDescriptor('/site/website/index.xml', { site: 'editorial' }).subscribe((descriptor: Descriptor) => {
    console.log(descriptor);
  });

  // Example 2:
  // - Omit config (must have configured earlier @see Usage section above)
  // - Parse the response
  getDescriptor('/site/website/index.xml').pipe(
    map(parseDescriptor) // Optional. Use for a cleaner parsed response.
  ).subscribe((content: ContentInstance) => {
    console.log(content);
  });
```

### Get Children
Get the list of Items directly under a folder in the content store.

`getChildren(path: string, config?: CrafterConfig)`

| Parameters    |                |
| ------------- |:--------------:|
| path          | The folder’s path |
| config        | Crafter configuration. Optional. Default value in [here](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#CrafterConfig). |

#### Returns

[Item](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#Item)[] - List of Items from the content store

#### Examples

- Get the children items under root folder from the site:

```typescript
  import { getChildren } from '@craftercms/content';

  // Example 1: Supplying config inline
  getChildren('/site/website', { site: 'editorial' }).subscribe((children) => {
    console.log(children);
  });

  // Example 2: Omits the config param (must have been previously configured, see Usage section above)
  getChildren('/site/website').subscribe((children) => {
    console.log(children);
  });
```

### Get Tree
Get the complete Item hierarchy under the specified folder in the content store.

`getTree(path: string, depth?: number, config?: Partial<CrafterConfig>)`

| Parameters    |                |
| ------------- |:--------------:|
| path          | The folder’s path |
| depth         | Amount of levels to include. Optional. Default is `1` |
| config        | Crafter configuration. Optional. Default value in [here](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#CrafterConfig). |

#### Returns

[Item](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#Item) - from the content store

#### Examples

- Get the items tree under root folder from the site:

```typescript
  import { getTree } from '@craftercms/content';

  // This call will get 3 levels of the tree under the specified folder

  // Example 1: Config supplied inline
  getTree('/site/website', 3, { site: 'editorial' }).subscribe((tree) => {
    console.log(tree);
  });

  // Example 2: Services pre-configured (see "Usage" section above), config param omitted.
  getTree('/site/website', 3).subscribe((tree) => {
    console.log(tree);
  });
```

### Get Navigation Tree
Returns the navigation tree with the specified depth for the specified store URL.

`getNavTree(path: string, depth?: number, currentPageUrl?: string, config?: CrafterConfig)`

| Parameters     |                |
| -------------- |:--------------:|
| path           | The folder’s path |
| depth          | Amount of levels to include. Optional. Default is `1` |
| currentPageUrl | The URL of the current page. Optional. Default is `''` |
| config         | Crafter configuration. Optional. Default value in [here](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#CrafterConfig). |

#### Returns

[NavigationItem](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#NavigationItem) - from the content store

#### Examples

- Get the navigation tree of the root folder from the site (depth = 3):

```typescript
  import { getNavTree } from '@craftercms/content';

  // Example 1: Config supplied inline
  getNavTree('/site/website', 3, '', { site: 'editorial', baseUrl: 'http://localhost:8080', headers: {} }).subscribe((tree) => {
    console.log(tree);
  });

  // Example 2: Services pre-configured (see "Usage" section above), config param omitted.
  getNavTree('/site/website', 3).subscribe((tree) => {
    console.log(tree);
  });
```

### Get Navigation Breadcrumb
Returns the navigation items that form the breadcrumb for the specified store URL.

`getNavBreadcrumb(path: string, root?: string, config?: CrafterConfig)`

| Parameters     |                |
| -------------- |:--------------:|
| path            | The folder’s path |
| root           | the root URL, basically the starting point of the breadcrumb. Optional. Default is `''` |
| config        | Crafter configuration. Optional. Default value in [here](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#CrafterConfig). |

#### Returns

[NavigationItem](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#NavigationItem)[] - List of NavigationItem from the content store

#### Examples

- Get the breadcrumb for the root folder from the site:

```typescript
  import { getNavBreadcrumb } from '@craftercms/content';

  // Example 1: Config supplied inline
  getNavBreadcrumb('/site/website').subscribe((navBreadcrumb) => {
    console.log(navBreadcrumb);
  });

  // Example 2: Services pre-configured (see "Usage" section above), config param omitted.
  getNavBreadcrumb('/site/website').subscribe((navBreadcrumb) => {
    console.log(navBreadcrumb);
  });
```

### Transform
Transforms a URL, based on the current site’s configuration.

- `urlTransform(transformerName: string, path: string, config?: Partial<CrafterConfig>)`

| Parameters      |                |
| --------------- |:--------------:|
| transformerName | Name of the transformer to apply |
| path             | URL that will be transformed |
| config        | Crafter configuration. Optional. Default value in [here](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/README.md#CrafterConfig). |

#### Returns

string - URL transformed according to transformer applied.

#### Examples

- Transform a store path into a render path

```typescript
  import { urlTransform } from '@craftercms/content';

  // Example 1: Config supplied inline
  urlTransform('storeUrlToRenderUrl', '/site/website/style/index.xml', { site: 'editorial' }).subscribe((webUrl) => {
    console.log(webUrl); // "/style"
  });

  // Example 2: Services pre-configured (see "Usage" section above), config param omitted.
  urlTransform('storeUrlToRenderUrl', '/site/website/style/index.xml').subscribe((webUrl) => {
    console.log(webUrl); // "/style"
  });
```

- Transform a render path into a store path

```typescript
  import { urlTransform } from '@craftercms/content';

  // Assuming that you already set the configuration (as explained above)

  // Example 1: Config supplied inline
  urlTransform('renderUrlToStoreUrl', '/technology', { site: 'editorial' }).subscribe((path) => {
    console.log(path); // "/site/website/technology/index.xml"
  });

  // Example 2: Services pre-configured (see "Usage" section above), config param omitted.
  urlTransform('renderUrlToStoreUrl', '/technology').subscribe((path) => {
    console.log(path); // "/site/website/technology/index.xml"
  })
```
