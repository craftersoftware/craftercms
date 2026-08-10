# SDK Changelog

## @craftercms/content@4.4.1
- Fix the published README for links to work on npmjs.com

## @craftercms/content@4.4.0
- "Get Descriptor" API is deprecated and will be removed (use getItem instead)
- New `crafterConf.flatten` property which controls the `flatten` parameter of content services to recursively include linked content items

## @craftercms/redux@4.4.0
- "Get Descriptor" API is deprecated (use getItem instead)

## @craftercms/classes@4.4.0
- New `crafterConf.flatten` property which controls the `flatten` parameter of content services to recursively include linked content items

## 4.2.0
* [@craftercms/redux]:
  * getTree action payload is now an object with `url` and `depth` properties.
  * getNav action payload is now an object with `url`, `depth` and `cyrrebtPageUrl` properties.
  * getNavBreadcrumb action payload is now an object with `url` and `root` properties.

## 4.1.3

- Dependency updates
- Sync ContentInstance with the one on @craftercms/studio-ui

## 4.1.2-support.2

### @craftercms/classes
- Allow for an entire set of fetch config to be provided via crafterConf to be used in all GET requests (SdkService.httpGet)

## 4.1.2-1

- Update react peer dependency to correct expression (^18)

## 4.1.2

- No updates

## 4.1.1

- Update dependencies to address security vulnerabilities

## 4.1.0

### @craftercms/classes
- Update search API endpoint from `/api/1/site/search/search.json` to `api/1/site/elasticsearch/search`.

### @craftercms/content
- `urlTransform`, `getTree`, `getItem`, `getChildren` fix config argument to accept partial CrafterConfig
- Update createQuery usage examples without SearchEngine parameter.

### @craftercms/models
- Update Endpoints interface `ELASTICSEARCH` property to `SEARCH`.

### @craftercms/search
- Remove ElasticQuery query implementation for ElasticSearch.
- Use `Query` class instead of removed `ElasticQuery` class in `createQuery` function.
- Update createQuery usage examples without SearchEngine parameter.

## 4.0.3

### All packages
- Switching SDK versioning to follow the CrafterCMS release version 

### @craftercms/content
- Update `parseProps` (internally used by `parseDescriptor`) to include `orderDefault_f` (parsed as `orderInNav`) in the resulting ContentInstance.
- Update `parseProps` and `parseDescriptor` options to receive `systemPropMap`, `ignoredProps`, `systemProps` to be used during parsing.
  - Note: modifying these props will require you to _open_ the `ContentInstance` interface and extend it accordingly.
- Improve `parseDescriptor` signatures definitions
- Parse values of `orderInNav` and `disabled` to their target data types (float and boolean, respectively).
- Export `extractContent` and `extractChildren` functions.
- Export the default `systemPropMap`, `ignoredProps`, `systemProps`.

## 2.0.7

### @craftercms/content
- Fix `getDescriptor` crashing when `config` isn't supplied.

## 2.0.6

### @craftercms/content

- Add `fetchModelByPath` and `fetchModelByUrl` shortcuts methods
- Improve `parseDescriptor` typings
- Improve `urlTransform` typings

### @craftercms/classes

- Add basic `crafterConf` docs

## 2.0.5

### @craftercms/content
- Add prop data type parsing to `parsedDescriptor`

### @craftercms/ice
- Add v4 support to `addAuthoringSupport`

## 2.0.4

### @craftercms/content
- Fix `flatten` argument to getDescriptor getting lost/ignored

### @craftercms/models
- Move types from other files into models package
- Adding missing properties to NavigationItem interface

## 2.0.3

### @craftercms/classes
- Change SDKService.httpGet to use fetch instead of rxjs.ajax
- Fix fetch's mode (for cors)
- Extend support for other fetch modes
- Switch from using URLSearchParams to using query-string for the same purpose

## 2.0.2
- Allow CORs
  - Use `crafterConf.configure({ cors: true, ... })` to enable CORs mode.
- Fix `fetchIsAuthoring` and `addAuthoringSupport` not retrieving for baseUrl from `crafterConf`.

## 2.0.1

### @craftercms/redux
- Upgrade to redux-observable 2

## 2.0.0

### All packages
- Update to rxjs @ ^7

### @craftercms/search
- Remove support for Solr

## 1.2.4

### @craftercms/content
- Add ability to specify `flatten` for the `content_store/descriptor` endpoint (via the config argument of the function).
- Make `parseDescriptor` be able to handle the deserialization products of the [recent `crafter-source` & `crafter-source-content-type-id` attribute additions](https://github.com/craftersoftware/craftercms/issues/4093).

### @craftercms/ice
- [bugfix] Handle calls to `repaintPencils` before the dependency loader has been configured to avoid incorrect paths to load scripts/css from.
- Extend support to react 17 (peerDependencies).

### misc
- Upgrade to typescript 4+
    - Fix type check issues that arose from upgrade.

## 1.2.3

### @craftercms/ice
- Add `package.json` to `react` folder for prettier import usage and module bundler support

### @craftercms/content
- Improve robustness of `parseDescriptor` function
- Adds `preParseSearchResults` function

### misc
- Added docs to package readme files for plain html/js usage
- Removed the `browser` field from `package.json` files so bundlers can make use of es6 modules and tree shaking
- Add npm badge to README files

## 1.2.2

### @craftercms/ice
- Adds `reportNavigation` util for SPAs to report the current URL as the app navigates.

### misc
- [internal] Bumps acorn version

## 1.2.1

### @craftercms/ice
- Added validation addAuthoringSupport require.js load event
- `getICEAttributes`
  - Auto calculates the label if not supplied based on the model param
  - Validates parentModelId and path (model.craftercms.path) and throws console errors to help developers use the right values
  - Adds a _secret_ second argument so that wrapping utilities can identify themselves and errors as the entry point of the error

### @craftercms/utils
- Renames misc/composeUrl param renamed for more accurate semantics

### @craftercms/content
- `parseDescriptor`
  - Fixes issue  where repeat group items with inner node selectors weren't parsed
  - Improvements in `getItem` service parsing and component detection algorithms for `getItem` and `getDescriptor`
  - Adds ability to parse a `getTree` response into a flat content instance array
  - Adds `getChildren` response recognition and throws with non-parsable responses

## 1.2.0

### @craftercms/classes
- SDKService refactored as stand alone functions; no need to use as class now though you may still use in the same way as in previous release if you prefer (backward compatible).

### @craftercms/content
- Services refactored as stand alone functions; no need to use as class now though you may still use in the same way as in previous release if you prefer (backward compatible).
- New `parseDescriptor` method which parses a `getDescriptor`, `getItem` or `GraphQL` response into a Content Instance (@see models/Content Instance).

### @craftercms/ice
- First published
- Publishing generic Crafter CMS In Context Editing (ICE) attribute retrieval functions for pencils and drop zones (drag and drop)
    - getIceAttributes, 
    - getDropZoneAttributes
    - import/use in code by doing 
        - `import { getIceAttributes } from '@craftercms/ice';`
        - `import { getDropZoneAttributes } from '@craftercms/ice';`
- Publishing generic util functions
    - repaintPencils: Repaints/repositions Crafter CMS In Context Editing pencils 
    - fetchIsAuthoring: Interrogates the current origin server to determine if the site/app is running in Crafter CMS authoring or delivery environments
    - addAuthoringSupport: Includes the necessary scripts to enable Crafter CMS authoring support
    - `import { repaintPencils, fetchIsAuthoring, addAuthoringSupport } from '@craftercms/ice';` as needed
- Publishing React specific bindings via custom hooks:
    - useICE, 
    - useDropZone
    - Import/use in code by doing
        - `import { useICE } from '@craftercms/ice/esm5/react';`
        - `import { useDropZone } from '@craftercms/ice/esm5/react';`
- For direct usage in HTML `<script/>` tags, use the umd build
    ```html
    <script src="{path-to-your-scripts}/ice/bundles/ice.umd.js"></script>
    <!-- ice/react requires the main ice script -->
    <script src="{path-to-your-scripts}/ice/bundles/react/index.umd.js"></script>
    ```
- Notice the multi-platform builds published under
    - bundles (umd)
    - esm5 (module)
    - es2015 (esm2015)
    - fesm5
    - fesm2015

### @craftercms/models
- Removed unpublished createLookupTable function; moved to @craftercms/utils
- ContentInstance model added

### @craftercms/redux
- redux, redux-observable & rxjs upgraded

### @craftercms/search
- Service refactored as stand alone functions; no need to use as class now though you may still use in the same way as in previous release if you prefer (backward compatible).

### @craftercms/utils
- Publishes createLookupTable util

### Global
- Internal Yarn workspace set up
- RxJS upgrade for all packages which have it as a dependency
- Rollup config adjustments
- Build script updates to print rollup output
- Added `index.js` to fesm distributions
- License updates

