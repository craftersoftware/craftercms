![npm (scoped)](https://img.shields.io/npm/v/@craftercms/redux?style=plastic)

# @craftercms/redux

This package contains tools for integrating your application with Crafter Engine and Crafter Search using Redux as the state container.

## Usage

All of Crafter CMS packages can be used either via npm or in plain html/javascript via regular script imports.

- Install module using `yarn` or `npm`
  - Yarn: `yarn add @craftercms/redux`
  - npm: `npm install @craftercms/redux`
- Set the Crafter Configuration (site, baseUrl).
- Import and use the redux store provided by the library, or implement your own store.
- Import and use the action(s) you need.

The examples below assume usage in the style of using via npm. If you're using the bundles, 
directly importing as a script in the browser, these functions will be under the global variable
named `craftercms.redux` (i.e. `window.craftercms.redux`).

## Utilities

### createReduxStore
Creates a redux store with all the crafter-redux details attached. Optionally, custom app reducers and/or epics may be supplied to create the store as required by client application.

`createReduxStore(config: Object)`

| Parameters    |                |
| ------------- |:--------------:|
| config        | Configuration for the redux store |

Default config:

```json
  {
    namespace: 'craftercms',
    reduxDevTools: true,
    namespaceCrafterState: false
  }
```

#### Example

- Set the configuration for the redux store

```typescript
  import { crafterConf } from '@craftercms/classes';

  // This configuration will by used for all of the calls in the library. 
  crafterConf.configure({
    baseUrl: 'http://localhost:8090',  // By default - http://localhost:8080
    site: 'editorial'
  })
```

- Create redux store provided by the library

```typescript
  import { createReduxStore } from '@craftercms/redux';

  import { allReducers } from './your-reducers/reducers';
  import thunk from 'redux-thunk';  // Or your chosen middleware

  const store = createReduxStore({
    namespaceCrafterState: true,   // Set to true to namespace craftercms states
    namespace: "craftercms",       // Namespace label used for craftercms states
    reducerMixin: allReducers,     // Your reducers (to combine them with the redux store)
    reduxDevTools: true,           // Set to true if you want to use reduxDevTools extension
    additionalMiddleWare: [thunk]  // Your chosen middleware to combine it with the library store
  });

```

### getState
Retrieves the current redux store state.

`getState(store: Store)`

| Parameters    |                |
| ------------- |:--------------:|
| store           | Redux store where the state is going to be retrieved from |

#### Example

```typescript
  import { getState } from '@craftercms/redux';

  // store = Redux store created in previous example

  const state = getState(store);

```

## Action Creators

### getItem
Creates an action to get an Item from the content store.

`getItem(itemUrl: string)`

| Parameters    |                |
| ------------- |:--------------:|
| 
path           | The item’s path in the content store |

#### Example

- Dispatch action to get the index page from the site into your store

```typescript
  import { getItem } from '@craftercms/redux';

  const itemUrl = '/site/website/index.xml';

  store.dispatch(getItem(itemUrl));
```

### getChildren
Creates an action to get the list of Items directly under a folder into your store.

`getChildren(path: string)`

| Parameters    |                |
| ------------- |:--------------:|
| path           | The folder’s path |

#### Example

- Dispatch action to get the children under a folder into your store

```typescript
  import { getChildren } from '@craftercms/redux';

  const path = '/site/website';

  store.dispatch(getChildren(path));
```

### getTree
Creates an action to get the complete Item hierarchy under the specified folder in the content store.

`getTree({ path: string, depth: int })`

| Parameters    |                |
| ------------- |:--------------:|
| path           | The folder’s path |
| depth         | Amount of levels to include. Optional. Default is `1` |

#### Example

- Dispatch action to get the items tree under the root folder into your store

```typescript
  import { getTree } from '@craftercms/redux';

  const path = '/site/website';

  store.dispatch(getTree({ path, depth: 2 }));
```

### getNav
Creates an action to return the navigation tree with the specified depth for the specified store URL.

`getNav({ path: string, depth: int, currentPageUrl: string })`

| Parameters     |                |
| -------------- |:--------------:|
| path            | The folder’s path |
| depth          | Amount of levels to include. Optional. Default is `1` |
| currentPageUrl | The URL of the current page. Optional. Default is `''` |

#### Example

- Dispatch action to get the navigation tree of the root folder from the site (depth = 2)

```typescript
  import { getNav } from '@craftercms/redux';

  const path = '/site/website';

  store.dispatch(getNav({ path, depth: 2 }));
```

### getNavBreadcrumb
Creates an action to return the navigation items that form the breadcrumb for the specified store URL.

`getNavBreadcrumb({ path: string, root: string })`

| Parameters     |                |
| -------------- |:--------------:|
| path            | The folder’s path |
| root           | the root URL, basically the starting point of the breadcrumb. Optional. Default is `''` |

#### Example

- Dispatch action to get the breadcrumb for the root folder from the site

```typescript
  import { getNavBreadcrumb } from '@craftercms/redux';

  const path = '/site/website/health';

  store.dispatch(getNavBreadcrumb({ path }));
```

### search
Creates an action to return the result for a given query.

`search(query: Query)` 

| Parameters    |                |
| ------------- |:--------------:|
| query         | The query object |

#### Example

- Dispatch action to query for content

```typescript
  import { SearchService } from '@craftercms/search';
  import { search } from '@craftercms/redux';

  const query = SearchService.createQuery();
  query.query = "*:*";
  query.filterQueries = ['content-type:"/component/video"'];

  store.dispatch(search(query));
```

Store state while loading item

```json
  {
    craftercms: {
      items: {
        loading: {
          /site/website/index.xml: true
        },
        entries: { }
      }
    },
    ...
  }
```

Resulting store state

```json
  {
    craftercms: {
      items: {
        loading: {
          /site/website/index.xml: false
        },
        entries: {
          /site/website/index.xml: { ... }
        }
      }
    },
    ...
  }
```

- Get the tree under a specified folder from the site into your store

```typescript
  import { getTree } from '@craftercms/redux';

  const path = '/site/website';

  store.dispatch(getTree({ path }));
```

Store state while loading tree

```json
  {
    craftercms: {
      trees: {
        loading: {
          /site/website: true
        },
        entries: {},
        childIds: {}
      }
    },
    ...
  }
```

Resulting store state

```json
  {
    craftercms: {
      items: {
        loading: {
          /site/website: true
        },
        entries: {
          /site/website: { ... },
          /site/website/style: { ... },
          /site/website/health: { ... }
        },
        childIds: {
          /site/website : [
            "/site/website/style",
            "/site/website/health"
          ],
          /site/website/style: [],
          /site/website/health: []
        }
      }
    },
    ...
  }
```
