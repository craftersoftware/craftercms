![npm (scoped)](https://img.shields.io/npm/v/@craftercms/search?style=plastic)

# @craftercms/search

This package contains tools for integrating your application with Crafter Search.

## Usage

All of Crafter CMS packages can be used either via npm or in plain html/javascript via regular script imports.

### Via npm

- Install module using `yarn` or `npm`
  - `yarn add @craftercms/search` or
  - `npm install @craftercms/search`
- Import and use the service(s) you need

### Via html script imports

- Download the bundle and import them in your page.
- The bundles declare a global variable named `craftercms`. You can access all craftercms' packages and functions under this root.
- The `search` package depends on `rxjs`, `@craftercms/utils`, `@craftercms/classes`; make sure to import those too before the `search` script.

**Tip**: Once you've imported the scripts, type `craftercms` on your browser's dev tools console to inspect the package(s)

#### Vanilla html/js example

 ```html
<script src="https://unpkg.com/rxjs"></script>
<script src="https://unpkg.com/@craftercms/utils"></script>
<script src="https://unpkg.com/@craftercms/classes"></script>
<script src="https://unpkg.com/@craftercms/content"></script>
<script src="https://unpkg.com/@craftercms/search"></script>
<script>
  (function ({ search, content }, { operators }) {

    const { map } = operators;
    const { search, createQuery } = search;
    const { parseDescriptor, preParseSearchResults } = content;

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

  })(craftercms, rxjs);
</script>
```

## Package Index

The examples below assume usage in the style of using via npm. If you're using the bundles,
directly importing as a script in the browser, these functions will be under the global variable
named `craftercms.search` (i.e. `window.craftercms.search`).

### search
Returns the result for a given query.

`search(query: Query)`

| Parameters    |                                                                                                                                                                                 |
| ------------- |:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| query         |                                                                                The query object                                                                                 |
| config        | Crafter configuration. Optional. Default value in [CrafterConfig](https://github.com/craftersoftware/craftercms/blob/support/4.x/js-sdk/packages/models/src/crafter-config.ts). |

#### Returns

Map model

#### Examples

- Connect to Crafter Search to query for content with ELASTIC SEARCH:

```typescript
  import { crafterConf } from '@craftercms/classes';
  import { search, createQuery } from '@craftercms/search';
  import { map } from 'rxjs/operators';
  import { parseDescriptor, preParseSearchResults } from '@craftercms/content';

  // First, set the Crafter configuration to cache your config.
  // All subsequent calls to `getConfig` will use that configuration.
  crafterConf.configure({
    baseUrl: 'http://localhost:8080',
    site: 'wordify'
  });

  const query = 'lorem';
  const fields = ['headline_s', 'blurb_t'];
  const contentTypes = ['/page/post', '/component/post'];
  search(
    createQuery({
      query: {
        'bool': {
          'filter': [
            { 'bool': { 'should': contentTypes.map(id => ({ 'match': { 'content-type': id } })) } },
            { 'multi_match': { 'query': query, 'fields': fields } }
          ]
        }
      }
    }),
    // If you didn't pre-configure, you may send config values as second param here
    // { baseUrl: 'http://localhost:8080', site: 'wordify' }
  ).pipe(
    map(({ hits, ...rest }) => {
      return {
        ...rest,
        hits: hits.map(({ _source }) => parseDescriptor(
          preParseSearchResults(_source)
        ))
      };
    })
  ).subscribe((results) => {
    console.log(results);
  });
```

You may use a different config by supplying the config object at the service call invoking time.

```typescript
  import { search, createQuery } from '@craftercms/search';

  //Create query
  const query = createQuery({
    "query" : {
        "match_all" : {}
    }
  });

  search(query, { baseUrl: 'http://localhost:8080', site: 'editorial' }).subscribe((results) => {
    // ...
  });
```
