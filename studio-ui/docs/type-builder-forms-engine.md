# Type Builder & Forms Engine — Agent Context

> Living backbone for TB/FE modernization work. **Read this first** in any new agent/session before changing related code. Keep it current: update _Open decisions_, _Progress_, and _Known pitfalls_ when you learn something durable.

Last updated: 2026-08-03

---

## 1. What these systems are

Crafter Studio is the authoring UI for CrafterCMS.

| Role                  | Purpose                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Type Builder (TB)** | Models _Content Types_ (pages, components, …). Authors of the CMS use it to define structure.       |
| **Forms Engine (FE)** | Takes a content type’s form definition and renders the authoring form. Saving produces content XML. |

Pipeline:

```text
TB (edit type)
  → writes type artifacts under /config/studio/content-types/<objectType>/<typeName>/
  → form-definition.xml (+ today: config.xml)
       ↓
FE (edit content)
  → reads type definition + existing content (or empty for create)
  → renders form UI
  → saves content XML (e.g. /site/website/.../index.xml)
```

Sample artifacts in this repo: `samples/form-definition.xml`, `samples/config.xml`, `samples/index.xml`, `samples/site-config-tools.xml`.

Local sandbox site for inspection:

`/Users/rart/Workspace/craftercms/4.x/crafter-authoring/data/repos/sites/crafterqai/sandbox`

| Concern       | Path in site                                                 |
| ------------- | ------------------------------------------------------------ |
| Content       | `/site/website`, `/site/components`, …                       |
| Content types | `/config/studio/content-types/{page\|component}/<typeName>/` |
| Studio config | `/config/studio/` (`ui.xml`, `site-config.xml`, …)           |
| Templates     | `/templates/web/...`                                         |

Typical type folder contents:

- `form-definition.xml` — form model (sections, fields, datasources, type-level properties)
- `config.xml` — type registry / metadata (target: **absorb into form-definition and drop**)
- optional: `controller.groovy`, thumbnail image, `form-controller.js`

---

## 2. Centric files (legacy vs next)

### Legacy (YUI / static-assets)

| Module       | Entry                                                          |
| ------------ | -------------------------------------------------------------- |
| Type Builder | `static-assets/components/cstudio-admin/mods/content-types.js` |
| Forms Engine | `static-assets/components/cstudio-forms/forms-engine.js`       |

### Next (React / `ui/app`)

| Module           | Reality check        | Entry / package                                                                                                                    |
| ---------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Forms Engine** | Actively implemented | `ui/app/src/components/FormsEngine/` — centric: `FormsEngine.tsx`                                                                  |
| **Type Builder** | Actively implemented | `ui/app/src/components/ContentTypeManagement/` — shell: `ContentTypeManagement.tsx`; centric editor: `components/EditTypeView.tsx` |

- TB reuses FE internals to edit type/field properties via virtual forms (`TypeBuilderFormsEngine.tsx`, descriptors).

### FE layout (high signal)

```text
FormsEngine/
  FormsEngine.tsx          # shell, stack, load, layout modes
  FormsEngineDialog.tsx
  types.ts
  components/              # FormLayout, headers, SectionAccordion, SaveCard, …
  controls/                # Text, RTE, NodeSelector, Repeat, ImagePicker, …
  dataSourceHooks/
  lib/
    formsEngineContext.ts  # React contexts
    formUtils.tsx          # atoms, load/save prep, locks
    controlHelpers.tsx     # renderFieldControl
    controlMap.ts / dataSourceMap.ts
    valueRetrievers.ts / valueSerializers.ts / validators.ts
    useSaveForm.tsx
    formConsts.ts          # XmlKeys, errors
```

State: Jotai atoms + React context (`StableFormContext`, `ItemMetaContext`, …). Redux for site/content-types catalog and dialogs.

### TB (ContentTypeManagement) layout (high signal)

```text
ContentTypeManagement/
  ContentTypeManagement.tsx   # list | edit | create; can fall back to legacy iframe
  utils.ts                    # serialize/deserialize helpers, TypePropsToEdit, paths
  controlMap.ts / suffixesMap.ts
  descriptors/                # control & datasource “virtual type” descriptors
    controls/  dataSources/  archetypes.ts
  controls/                   # TB-specific property editors (paths, template, …)
  components/                 # EditTypeView, TypeList, TypeBuilderFormsEngine, …
  proposal.xml                # design notes for site-config-tools / plugins
  config.xml                  # annotated sample of what to keep/move/drop from config.xml
```

Shared XML helpers also appear under `ui/app/src/components/XmlTools/`.

Domain model: `ui/app/src/models/ContentType.ts` (`ContentType`, `LegacyFormDefinition`, `SerializeToXmlContentTypeStructure`, …).

Constants:

- Content types base path: `/config/studio/content-types` (`CONTENT_TYPES_BASE_PATH` in CTM `utils.ts`)

---

## 3. Artifacts & data flow

### form-definition.xml

Root `<form>` with roughly:

- Identity: `title`, `description`, `objectType`, `content-type`, `imageThumbnail`, `quickCreate`, `quickCreatePath`
- Type properties: `display-template`, `no-template-required`, `merge-strategy` (today under `<properties>`)
- `<sections>` → `<fields>` (controls with `<properties>` / `<constraints>`)
- `<datasources>`

FE loads this (via Studio APIs / content-type catalog) to build the author form. FE save writes **content** XML, not the form definition.

### config.xml (to be removed)

Root `<content-type>` with registry-ish metadata, e.g.:

- Dupes of form-definition: `label`, `form`, thumbnail, quickCreate\*
- Removal candidates (legacy noise): `form-path`, `model-instance-path`, `file-extension`, `content-as-folder`, `previewable`, `noThumbnail`
- Move into form-definition: `controller`, `paths` (includes/excludes)

Annotated working notes: `ui/app/src/components/ContentTypeManagement/config.xml`.

**Blocker (known):** backend still consumes `config.xml` fields (`form`, thumbnail, `paths`, …). UI already serializes several former-config fields into the form-definition structure (`SerializeToXmlContentTypeStructure` marks `controller`, `paths`, deps, `previewable`), but **Allowed Destinations** UI is gated until config.xml can be dropped (see comments in `descriptors/controls/commonDescriptors.ts`).

### Content XML (FE output)

Example: `samples/index.xml`. Root is `page` / `component` / etc. Includes system fields (`content-type`, `display-template`, `objectId`, `file-name`, `internal-name`, …) plus author fields. Embedded components may be inlined; shared components referenced via includes.

Field id suffixes (`_s`, `_html`, `_o`, `_dt`, …) matter for indexing/Engine — see `suffixesMap.ts` / FE serializers.

---

## 4. Strategic objectives (current effort)

1. **Modern FE** — React FormsEngine replacing `forms-engine.js` (substantial progress).
2. **Modern TB** — ContentTypeManagement replacing `content-types.js` (in progress; legacy toggle still exists).
3. **Single type artifact** — fold `config.xml` into `form-definition.xml` and delete `config.xml` (requires Studio **backend** alignment, not UI-only).
4. **Descriptors / site-config-tools** — control & datasource listing + property forms driven by code defaults + optional XML overrides/plugins (`proposal.xml`, crawl → walk → run).

Out of scope unless asked: Engine delivery / Freemarker templates beyond how TB stores `display-template`.

---

## 5. How TB and FE couple

- TB **produces** type XML; FE **consumes** it for authoring.
- TB **embeds FE** to edit the type itself and each field’s properties: descriptors define virtual content types; `TypeBuilderFormsEngine` hosts FE controls.
- Shared concerns: `XmlKeys`, value serializers/retrievers, control maps, validation keys.
- Changes to form-definition shape or field XML must stay coherent across:
  - CTM serialize (`prepareSerializeToXmlTypeObject` / `buildContentTypeXml`)
  - content-type parse / `ContentType` model
  - FE value retrieve/serialize/validate
  - (eventually) backend type APIs that today still read `config.xml`

### 5.1 Do not conflate these extension concerns

There are four related but distinct mechanisms:

1. **Control catalog / descriptor** — what TB lists and which property form it presents when modeling a field.
2. **Control runtime** — the implementation FE renders when an author edits content.
3. **Data source catalog / descriptor vs runtime** — TB edits a DS definition, while FE must execute/interpret that definition for a consuming control.
4. **Form controller** — content-type-specific behavior (`form-controller.js`), separate from a control/DS plugin and from the server-side `controller.groovy`.

### 5.2 Legacy Type Builder: catalog and plugin discovery

Verified configuration source: `/config/studio/administration/site-config-tools.xml` (the repo sample is `samples/site-config-tools.xml`).

Flow:

1. `static-assets/components/cstudio-admin/base.js` calls `lookupConfigurtion(..., '/administration/site-config-tools.xml')`.
2. `buildModules` loads the `content-types` tool and passes that tool's complete XML-derived config object into `content-types.js`.
3. `renderContentTypeTools(config)` reads `config.controls.control` and `config.datasources.datasource`.
4. Each catalog entry is resolved by `CStudioAuthoring.Utils.form.getPluginInfo`:
   - built-in control: `/static-assets/components/cstudio-forms/controls/<name>.js`
   - built-in DS: `/static-assets/components/cstudio-forms/data-sources/<name>.js`
   - plugin: `/studio/1/plugin/file?...` assembled from `type`, `name`, `filename`, optional `pluginId`
5. `CStudioAuthoring.Module.requireModule` injects the script, waits for `moduleLoaded(prefix, Class)`, and caches the class globally in `loadedModules`.
6. TB instantiates a fake control/DS to introspect behavior:
   - controls: `getName`, `getLabel`, `getSupportedProperties`, `getSupportedConstraints`, `getSupportedPostFixes`, etc.
   - data sources: `getName`, `getLabel`, `getInterface`, `getSupportedProperties`.
7. Dragging an item into a type copies its executable object's defaults plus the catalog's `<plugin>` metadata into the in-memory form definition. Saving writes that plugin declaration into `form-definition.xml`.

`site-config-tools.xml` is therefore primarily the **legacy TB palette/catalog**, not the legacy FE's runtime registry. It chooses what TB offers and provides the plugin coordinates TB persists into the type.

### 5.3 Legacy Forms Engine: runtime controls and data sources

The type's `form-definition.xml` is the runtime manifest.

#### Controls

For every field, `_renderField`:

1. Calls `getPluginInfo(field, CONTROL_URL, 'control')`.
2. Resolves either the built-in script from `field.type` or the plugin URL from `field.plugin`.
3. Obtains the constructor through the global module registry.
4. Instantiates a control with the common constructor contract:
   `(fieldId, form, section, properties, constraints, readOnly, pencilMode)`.
5. Calls `initialize`, then sets the model/default value.

Plugin controls and built-ins participate in essentially the same runtime protocol. The plugin declaration travels with the field, so FE does not need the original TB catalog to execute it.

#### Data sources

Before fields render, `_loadDatasources` iterates `form.definition.datasources`, dynamically loads each built-in/plugin class, instantiates it as:

`new DataSourceClass(datasourceId, form, properties)`

and registers the object in `form.datasourceMap[id]`. It publishes `/datasource/loaded` for controls waiting on an asynchronous DS.

The base `CStudioFormDatasource` is intentionally small (`getInterface`, `getName`, `getLabel`, `getSupportedProperties`, path macro processing). Concrete DS objects expose operational capabilities consumed by controls, for example:

- item DS: `getList(callback)` and sometimes `add(control)`
- media/repository DS: browse/upload/search-specific methods
- `interface` (`item`, `image`, `video`, `audio`, …) lets TB filter compatible DS choices

This is dynamic but not a perfectly uniform abstraction: controls still know capability methods and some DS families. Its key virtue is that behavior lives on the loaded DS object instead of in a central switch over every DS type.

Load-mechanism quirks (legacy FE):

- built-in/plugin **controls** typically go through `requireModule`, with external plugin controls also using dynamic `import('/studio...')`
- **datasources** typically load via `jQuery.getScript` (or a cached module) rather than the same control path
- TB palette always uses `requireModule` for both

#### Legacy plugin transport

`getPluginInfo` is shared by TB and FE. A declaration contains:

- `type`
- `name`
- `filename`
- optional `pluginId`

The plugin script must register the expected module prefix through `CStudioAuthoring.Module.moduleLoaded`. Missing coordinates are reported; loaded modules are cached.

TB availability checks for plugin controls compare against `control.plugin.name` (not the outer `<name>`), so palette identity and persisted `field.type` must stay aligned.

#### Form controllers

Legacy FE loads `/content-types/<type>/config.xml`; when `<controller>true</controller>`:

1. It fetches the type's `form-controller.js` through the authenticated form-controller API.
2. It executes the returned script through a Blob-backed `<script>`.
3. The script must register `${formId}-controller`.
4. FE constructs it and calls `initialize(form)`.
5. `isFieldRelevant(field)` can suppress fields/repeats.
6. `onBeforeSave()` can manipulate/validate state and veto save by returning `false`.

This is distinct from `controller.groovy`, which is a server-side content-type controller.

### 5.4 New Type Builder: current configuration and descriptors

The current implementation **does use `/config/studio/ui.xml`**, confirmed in `EditTypeView.tsx`:

1. `fetchSiteUiConfig` fetches `/ui.xml`.
2. TB selects `widget[id="craftercms.components.ContentTypeManagement"] > configuration`.
3. It parses `controls`, `controlExclusions`, `dataSources`, and `dataSourceExclusions`.
4. Built-in property-form descriptors are compiled TypeScript under `ContentTypeManagement/descriptors/{controls,dataSources}`.
5. XML `<descriptor>` objects are normalized by `parseConfigPlugins` and used as additional/custom descriptors.

Current behavior differs from the intent documented in `proposal.xml`:

- The proposal's preferred approach says code defaults should appear without configuration and XML should only add/override/exclude.
- `PickControlDialog` and `PickDataSourceDialog` currently include a built-in only when that id is present in `ui.xml`; absent config does **not** expose all code defaults.
- Descriptor override/deep-merge semantics are not implemented. Lookup precedence is also inconsistent by operation:
  - insert / open field or DS editor: code descriptor first, then config
  - commit field edits / some serialize helpers: config descriptor first, then code
- Configured `<plugin>` coordinates from `ui.xml` are copied onto newly inserted fields (`field.properties.plugin`) and data sources (`DataSource.plugin`) via `extractPluginLocatorFromConfigEntry` in `EditTypeView`.
- `EditTypeView` fetches `/ui.xml` directly via the configuration service; it does **not** read Redux `uiConfig`. Global Studio may also fetch the same file, so two parallel loads are possible.

The checked-in `ContentTypeManagement/site-config-tools.xml` is a legacy/reference artifact. It is not what `EditTypeView` fetches. Code descriptors currently list more built-ins than the legacy site-config-tools sample (e.g. `aws-file-upload`, `colorPicker`, `pages`).

### 5.5 New Forms Engine: dynamic controls and the FE2 data-source runtime

#### Controls

New FE has two resolution paths in `controlHelpers.tsx` / `controlPluginLoader.ts`:

- built-in: static `controlMap` → React component, plus static `controlDataSourceBindings[field.type]`
- plugin field (`field.properties.plugin`): `importPlugin(locator)` → `registerPlugin` installs `descriptor.controls[field.type]` → render component + bindings. Control lookup key is **`field.type`** (not widget id). Descriptor-only: no bare React component as `default`.

Plugin bundles are cached by file URL. `registerPlugin` registers bindings for each control type key; `ControlWrapper` resolves `ControlProps.dataSources` before render. Built-in bindings stay in the static table; plugin controls ship bindings on the descriptor control entry.

Example: `samples/fe2-control-plugin.example.mjs`.

The runtime control contract is `ControlProps` (`value`, `setValue`, `field`, `contentType`, `readonly`, `autoFocus`, optional `dataSources`). Host helpers:

- `window.craftercms.formsEngine.dataSources` — DS module registry
- `window.craftercms.formsEngine.controls` — `getControl(type)`, `registerDataSourceBindings`, `getDataSourceBindings`

This path is functional for plugin metadata already present in a form definition. `customControlMap` exists as an override seam used by Type Builder descriptor forms. Validators, value retrievers, and serializers remain static maps/switches, so a truly novel control may still need more than a React component + bindings export.

Additional current FE control gaps:

- `hasJsController` is parsed onto the `ContentType` model but not consumed by React FE
- Item/media controls group resolved actions by manager binding + intent (browse/search/upload/create). Every displayed choice retains its owning action; plugin `MenuItem`/`Dialog` actions use a standalone custom lane.

`proposal.xml` sketches a `craftercms.components.FormsEngine` widget with a configurable control/validator map, but no current new-FE code path was found that reads that widget configuration.

#### Data sources

Phase 0 of the FE2 data-source runtime now provides the extension platform under
`components/FormsEngine/dataSources/`:

- versioned `DataSourceModule`, configured `DataSourceInstance`, action, capability, selection, service, and binding contracts;
- a duplicate-safe module registry; plugin DS types load via `importPlugin` → `PluginDescriptor.dataSources` (see plugins companion §9);
- ordered field binding resolution using control metadata (`itemManager`, `imageManager`, `videoManager`, `datasource`, and RTE managers);
- built-in bindings in `controlDataSourceBindings`, plugin-control bindings from `PluginDescriptor.controls` / runtime registry;
- interface matching, explicit resolution errors, asynchronous action resolution, and `ControlProps.dataSources` injection;
- promise-based shared browse/search/upload/create services;
- public host surfaces at `window.craftercms.formsEngine.dataSources` and `.controls`;
- typed DS plugin locators with parse/serialize preservation.

The configured `DataSource` remains the form-definition record:

`{ id, type, title, interface, properties, plugin? }`

It becomes executable only after the runtime resolves its type to a registered or dynamically imported `DataSourceModule`.

Built-in `DataSourceModule`s are registered for all TB descriptors (except dead `flash-desktop-upload`, which ships as a stub). Consumers do not switch on configured DS type:

- Resolution stamps each action with a stable `actionKey` (`dataSourceId::actionId`) and its binding.
- `buildActionGroups` creates one presentation group per manager binding + intent while retaining an owner-bound `DataSourceActionChoice` for every concrete option.
- NodeSelector keeps its richer create/type/path picker, but browse/search/upload and create acceptance invoke the selected owning action. Duplicate-looking create destinations expose the contributing datasource rather than silently merging behavior.
- ImagePicker, VideoPicker, TranscodedVideoPicker, and RTE use grouped choices; custom `MenuItem`/`Dialog` actions remain standalone.
- Dropdown / CheckboxGroup / LinkedDropdown use `instance.list`. Dropdown/LinkedDropdown may render multiple bound list groups; CheckboxGroup follows the TB/legacy single-datasource contract and uses the first list group only.
- `createContent` resolves after the nested form saves or closes, allowing create actions to return semantic selections to the control.

Legacy item-picker summaries are now a NodeSelector presentation adapter only. They carry owner-bound choices and are not an execution contract. Metadata-only media consolidation is retired.

Datasource identity is retained at runtime by each choice but is deliberately **not yet persisted** into FE2/XB content XML. Restoring FE1's node-selector `item.datasource` round-trip is a separate compatibility change.

Unknown ids, unknown types, plugin-load failures, and interface mismatches surface as `dataSources.errors` on the field. `checkBuiltInDataSourceRegistryCompleteness()` warns in development when a TB descriptor lacks an FE module.

Type Builder copies plugin coordinates from `ui.xml` catalog entries when inserting controls and data sources; existing coordinates survive parse → edit → serialize.

By contrast, control plugin metadata is explicitly moved to `field.properties.plugin`, dynamically loaded by FE, and serialized back out.

#### Form controllers

**Status:** design decided below; **not implemented**. `FormsEngine.tsx` still lists loading/execution as a TODO. `hasJsController` is parsed but unused at FE2 runtime.

There is also a current naming/behavior mismatch in new TB:

- `hasJsController` and its descriptor are labelled “Client-side Controller” and serialize as `<controller>`;
- `TypeJsControllerSelector` currently opens `controller.groovy`, not `form-controller.js`;
- `editTypeController` supports both filenames, but the selector calls only the Groovy path.

Treat form-controller support and Groovy controller editing as separate problems. See **§5.9** for the FE2 form-controller design.

### 5.6 Old-world virtues worth preserving

- **Site-level discovery:** administrators can add catalog entries/plugins without rebuilding Studio.
- **Self-contained runtime manifest:** plugin coordinates are copied into `form-definition.xml`; FE can execute a type independently of the TB catalog.
- **Behavioral DS plugins:** DS behavior is encapsulated behind a loaded object/capability contract instead of centralized type switches.
- **Shared extension protocol:** built-ins and plugins use the same constructor/module lifecycle.
- **TB introspection:** one implementation declares its label, compatibility interface, properties, constraints, and suffixes.
- **Caching and failure isolation:** module caching plus explicit loaded/not-loaded tracking.

Legacy liabilities not to reproduce: global registries, YUI inheritance, script injection/Blob execution, `eval`, weakly typed method contracts, inconsistent naming, and controls reaching into DS-specific APIs.

### 5.7 Design constraints for the next extension model

Future design work should provide:

1. Separate but linked descriptors for **TB configuration UI** and **FE runtime behavior**.
2. A first-class, typed DS plugin/runtime contract; no switch on every concrete DS id.
3. Capability/interface matching so controls request `item`, `image`, `browse`, `upload`, etc., without knowing implementation ids.
4. Plugin coordinates preserved explicitly in the `DataSource` model and XML round-trip.
5. A registry populated from code defaults + `ui.xml` additions/overrides/exclusions, with deterministic precedence.
6. Extension seams for control rendering **and** associated validators/retrievers/serializers.
7. Explicit form-controller lifecycle hooks designed for React/state semantics.
8. Compatibility/migration rules for existing form definitions and FE1 plugins (FE1 control classes are not React-compatible).

### 5.8 Plugin packaging and modern Studio runtime

Detailed companion: [`type-builder-forms-engine-plugins.md`](type-builder-forms-engine-plugins.md).

Keep three mechanisms distinct:

1. A **project plugin package** (`craftercms-plugin.yaml` + `authoring/`) copies assets into a site and may auto-wire XML configuration.
2. A **modern Studio UI plugin bundle** exports a `PluginDescriptor`; `Widget`/`plugin.ts` imports it and registers widgets, locales, scripts, and stylesheets.
3. An **FE control/DS plugin** is selected by TB and persisted in `form-definition.xml`; legacy FE loads a YUI class, while new FE control loading expects a default-exported React component.

Important findings:

- Current public FE control/DS plugin docs describe the legacy `CStudioForms`/`CStudioAuthoring.Module.moduleLoaded` contract.
- Existing `form-control` / `form-datasource` package installation auto-wires `site-config-tools.xml`, but new TB discovers its catalog from `ui.xml`.
- New FE control and DS plugins load through `importPlugin` / `PluginDescriptor.controls` and `.dataSources` (not the widget registry).
- FE2 control/DS plugins use `PluginDescriptor`; form controllers do **not** (see §5.9).
- The local `authoring-ui-plugin-examples` `component-library` is the representative modern bundle/build pattern.
- Package id, asset locator, runtime `PluginDescriptor.id`, widget id, and FE type/name are separate identities and must not be conflated.
- A project plugin can deliver content types and a type-local `form-controller.js`; FE2 still loads that file by type identity, not via `importPlugin`.

### 5.9 FE2 form-controller design (decided)

Form controllers stay **content-type-local**, not catalog plugins. They are siblings of `form-definition.xml` / `controller.groovy`, gated by `<controller>true</controller>` → `contentType.hasJsController`.

#### Why not `PluginDescriptor`

Controls and data sources are reusable types selected from a TB catalog and referenced from many forms. A form controller is authored for **one** content type, lives in that type’s folder, and has no catalog entry. Reusing `importPlugin` would invent fake plugin coordinates for a single type-scoped script and conflate two extension kinds.

A project plugin may still *ship* a content type folder that includes `form-controller.js`; installation copies the type. Runtime loading remains “fetch this type’s controller file,” not “resolve a plugin locator.”

#### File & gate

| Piece | Contract |
|-------|----------|
| Flag | `hasJsController` / serialized `<controller>true\|false</controller>` |
| Path in site | `/config/studio/content-types/{contentTypeId}/form-controller.js` |
| Fetch API | Existing authenticated endpoint: `/studio/api/2/configuration/content_types/{site}/form_controller?contentTypeId=…` (`getFetchLegacyFormControllerUrl` — un-deprecate / rename for FE2) |
| When to load | Form bootstrap, only if `hasJsController === true` |
| On failure | Log + continue without controller (same soft-fail posture as FE1) |

Do **not** use a bare `<script src>` against that API (auth token / cookies); FE1 already moved to `getText` + Blob for that reason.

#### Module format (FE2 only)

Export an ESM module. Default export (or named `formController`) is a `FormController` object — **not** a YUI class and **not** a `PluginDescriptor`.

All hooks may be sync or async. Host always `await`s them.

```ts
type MaybePromise<T> = T | Promise<T>;

interface FormController {
  /** Bump when breaking the host↔controller contract. */
  apiVersion: 1;
  /**
   * Called once after form context/atoms exist.
   * May return a cleanup (or a Promise of cleanup) invoked on form unmount / stack pop.
   */
  initialize?(ctx: FormControllerContext): MaybePromise<void | (() => void)>;
  /**
   * Return false to omit the field (or repeat definition) from the rendered form.
   * Default true. Async allowed — host awaits before first field paint for that form.
   */
  isFieldRelevant?(field: ContentTypeField, ctx: FormControllerContext): MaybePromise<boolean>;
  /**
   * Return false / rejected promise to veto save.
   * Called in `useSaveForm` after client validation snapshot, before XML write.
   */
  onBeforeSave?(ctx: FormControllerContext): MaybePromise<boolean>;
}

// form-controller.js
export default {
  apiVersion: 1,
  async initialize(ctx) { /* may await; optional cleanup return */ },
  async isFieldRelevant(field, ctx) { return true; },
  async onBeforeSave(ctx) { return true; }
};
```

**Async notes:**

- `initialize` and `onBeforeSave` **must** support async (minimum bar).
- `isFieldRelevant` is also async-capable for consistency; if any field check returns a Promise, the host awaits relevance for the whole form (or section batch) before rendering fields — show the normal form loading state until settled.
- Rejected promises: treat like failure — log, soft-fail for `initialize` / relevance (field stays visible / no controller), veto save for `onBeforeSave`.

**FE1 scripts are not loadable.** They register via `CStudioAuthoring.Module.moduleLoaded('{typeId}-controller', Class)` and extend `CStudioForms.FormController`. Same migration stance as FE1 DS → `DataSourceModule`: rewrite to the FE2 export. No dual-loader in v1 of this feature.

#### Where the file lives and how FE2 loads it

**On disk (site repo):**

```
/config/studio/content-types/{contentTypeId}/form-controller.js
```

Example: `/config/studio/content-types/page/home/form-controller.js`.

That is the authoring artifact TB creates/edits. It is **not** under `static-assets/plugins/…` and is **not** fetched with `buildFileUrl` / `importPlugin`.

**Over the network:** Studio serves that file only through the authenticated configuration API (so the browser call includes session/auth):

```
GET /studio/api/2/configuration/content_types/{site}/form_controller?contentTypeId={contentTypeId}
```

Helper today: `getFetchLegacyFormControllerUrl(site, contentTypeId)` in `services/contentTypes.ts` (un-deprecate / rename for FE2). Body is the raw JS source of `form-controller.js`.

**In FE2 code (to implement):**

| Piece | Location |
|-------|----------|
| Loader | New `FormsEngine/lib/formControllerLoader.ts` (or similar) — fetch text → Blob ESM `import` → cache |
| Call site | Form bootstrap in `FormsEngine.tsx` / `FormBootstrap` (where content type + value atoms are already known), **before** field render |
| Relevance | Section/field mapping path that builds the visible field list |
| Save | `lib/useSaveForm.tsx` before `buildContentXml` / write |
| Types | `FormController` / `FormControllerContext` next to other FE types |

**Load sequence:**

1. Form opens; content type is available. If `!contentType.hasJsController` → skip (no network call).
2. Loader calls the form_controller API for `{ siteId, contentTypeId }` (cache hit → reuse).
3. Response text → `Blob` (`application/javascript`) → object URL → `import(/* @vite-ignore */ blobUrl)` as ESM → revoke URL.
4. Resolve `module.default ?? module.formController`; validate `apiVersion` (`1` or missing-as-1).
5. Cache by `siteId + contentTypeId` for the session.
6. `await initialize(ctx)`; keep returned cleanup on the form stack entry.
7. Later: `await isFieldRelevant(...)` per field; `await onBeforeSave(ctx)` on save.

Why Blob instead of pointing `<script>` / `import()` at the API URL: that endpoint requires auth; a raw script/module request does not reliably carry the same credentials FE1 needed — hence authenticated `getText` then Blob module (same constraint as FE1’s current loader).

Host helpers may live under `window.craftercms.formsEngine.formControllers` (load/clear cache) for tests and debugging — optional, not required for authors.

#### `FormControllerContext` (host-provided)

Give controllers a narrow API over FE2 state — do not pass the raw YUI `form` or the full Jotai store:

| Surface | Purpose |
|---------|---------|
| `siteId`, `contentType`, `path`, `mode` | Identity (`create` \| `edit` \| `embedded` \| `repeat`) + readonly |
| `getValues()` / `getValue(fieldId)` / `setValue(fieldId, value)` | Read/write current field atoms |
| `getField(fieldId)` / `getContentType(id?)` | Field/type metadata |
| `isCreateMode`, `isEmbedded`, `readonly` | Mode flags |
| Later (optional) | `subscribe(fieldId, cb)`, snackbar/dispatch helpers |

Controllers must not import React or reach into DOM for field visibility; relevance is declarative via `isFieldRelevant`.

#### Integration points in FE2

| Hook | Where |
|------|-------|
| Load + `await initialize` | New loader called from `FormsEngine` / `FormBootstrap` after atoms exist, before field render |
| Cleanup | Form unmount / stack pop |
| `await isFieldRelevant` | When mapping `contentType.sections` → visible fields (same place FE already strips `file-name` for embeds); wait before paint if any check is async |
| `await onBeforeSave` | `useSaveForm`, after validity snapshot / draft decision, **before** `buildContentXml` / write; veto restores submitting UI and stops |

Repeat-group / embedded child forms: load the **child type’s** controller when that type has `hasJsController`, with `mode: 'embedded' | 'repeat'`. Do not run the parent controller’s `isFieldRelevant` on child fields.

#### TB companion fixes (required for authors)

1. **Client-side Controller** UI must edit/create `form-controller.js`, not `controller.groovy`.
2. Keep Groovy (`controller.groovy`) as a separate type property/action (server-side).
3. Toggling `hasJsController` on should ensure the JS file exists (reuse `editTypeController(..., 'javascript')`).
4. Optionally offer a stub FE2 controller template when creating the file.

#### Non-goals (initial)

- Registering form controllers on `PluginDescriptor`
- Auto-adapting FE1 `moduleLoaded` controllers
- Running controller code in the Type Builder virtual forms themselves
- Persisting controller source inside `form-definition.xml`

---

## 6. Local reference site

Site id/path: `crafterqai` sandbox under 4.x authoring data (path above).

Useful examples:

- Component type with thumbnail: `.../content-types/component/3ColFeatureGrid/`
- Page content: `.../site/website/.../index.xml`
- Matches samples’ `3ColFeatureGrid` / freeForm-style pages

When validating XML shape changes, compare a live type folder + a saved content item side-by-side with `samples/`.

---

## 7. Agent operating guide

### Recommended workflow for multi-agent / multi-session work

1. **Canonical context = this markdown file** (versioned in repo). Not a Canvas: canvases are great for one-off visual analysis, poor as a shared durable backbone.
2. **Thin Cursor rule** (`.cursor/rules/type-builder-forms-engine.mdc`) auto-attaches on TB/FE globs and tells the agent to read this doc first.
3. **Start every new agent** with an explicit pointer, e.g.
   `Read docs/type-builder-forms-engine.md, then <task>. Update the Progress / Open decisions sections when done.`
4. **One concern per agent/PR** when possible (e.g. “FE NodeSelector save path” vs “drop config.xml backend contract”). Cross-cutting XML schema work should land decisions here before large implementations.
5. **After durable discoveries**, append to _Progress_ or _Open decisions_ in the same change set (or immediately after). Do not rely on chat transcripts alone.
6. Optional later: split a `docs/tb-fe-decision-log.md` if this file grows past ~easy skim; keep this file as the map + current state.

### When editing

- Prefer next React modules; treat legacy JS as behavior reference / fallback, not the destination.
- Match existing patterns (MUI, react-intl, RxJS services, Jotai in FE).
- Avoid drive-by refactors outside the task.

### Quick “where do I look?”

| Question                          | Start here                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Author form shell / save / stack  | `FormsEngine/FormsEngine.tsx`, `lib/useSaveForm.tsx`, `lib/formUtils.tsx`                             |
| Control rendering                 | `lib/controlHelpers.tsx`, `lib/controlMap.ts`, `controls/*`                                           |
| Legacy plugin URL/module protocol | `cstudio-common/common-api.js` (`getPluginInfo`, `Module`)                                            |
| Legacy DS runtime                 | `forms-engine.js` (`_loadDatasources`), `cstudio-forms/data-sources/*`                                |
| New FE DS interpretation          | `FormsEngine/dataSourceHooks/*`                                                                       |
| Content XML in/out                | `lib/valueRetrievers.ts`, `lib/valueSerializers.ts`                                                   |
| Type list / edit UI               | `ContentTypeManagement.tsx`, `components/EditTypeView.tsx`                                            |
| New TB catalog configuration      | `EditTypeView.tsx` (`fetchSiteUiConfig`), `/config/studio/ui.xml`                                     |
| Type XML out                      | `ContentTypeManagement/utils.ts` (`prepareSerializeToXmlTypeObject`)                                  |
| Control property forms            | `descriptors/controls/*`, `TypeBuilderFormsEngine.tsx`                                                |
| config.xml merge plan             | `ContentTypeManagement/config.xml`, `commonDescriptors.ts` comments, `ContentType.ts` serialize types |
| Plugin packaging / runtime        | `docs/type-builder-forms-engine-plugins.md`, `services/plugin.ts`, `components/Widget/Widget.tsx`     |
| Plugin / listing design           | `proposal.xml`, `samples/site-config-tools.xml`                                                       |
| Legacy behavior                   | `content-types.js`, `forms-engine.js`                                                                 |

---

## 8. Open decisions / known constraints

- [ ] **Backend still requires `config.xml`** for several properties; UI cannot fully drop it yet.
- [ ] **Allowed Destinations / paths / copy-delete deps / previewable** UI section intentionally incomplete until config merge is unblocked.
- [x] Define a typed dynamic DS runtime/plugin contract; current FE consumers hard-code DS ids in hooks. → `DataSourceModule` + actions/capabilities; controls consume `ControlProps.dataSources`.
- [x] Preserve DS plugin metadata in the model, new-TB insertion, and XML serialization.
- [x] **Single plugin model for FE data sources** — `PluginDescriptor.dataSources` registered by `registerPlugin`; `loadDataSourceModule` demand-loads via `importPlugin` only.
- [x] **Single plugin model for FE controls** — `PluginDescriptor.controls` registered by `registerPlugin`; `controlPluginLoader` demand-loads via `importPlugin` + `field.type` lookup. See [`fe2-control-plugin-single-model-implementation.md`](fe2-control-plugin-single-model-implementation.md).
- [ ] **Lib-style plugins** — eager load without dummy widgets + stable host path for `utils`. See plugins companion §9.8 items 2–3.
- [ ] Reconcile new TB's code-default catalog proposal with current `ui.xml` allow-list behavior.
- [ ] Implement/clarify descriptor merge precedence and plugin-coordinate propagation from `ui.xml` (and make lookup order consistent across insert/edit/save).
- [ ] Decide whether `EditTypeView` should consume Redux `uiConfig` instead of fetching `/ui.xml` independently.
- [x] **Form-controller design** — type-local FE2 ESM (`FormController` hooks), fetch via form_controller API, not `PluginDescriptor`. See §5.9. Implementation still open.
- [ ] Implement FE2 form-controller load + lifecycle (`initialize` / `isFieldRelevant` / `onBeforeSave`) per §5.9; separate clearly from `controller.groovy`.
- [ ] Align project-plugin auto-wiring with TB2 catalog discovery (`site-config-tools.xml` vs `ui.xml`) and define FE1 package migration.
- [ ] Normalize plugin identity/locator vocabulary and resolve `file` vs `filename` across XML, frontend, docs, and backend.
- [ ] Fix the `hasJsController` / “Client-side Controller” UI path currently opening `controller.groovy` (and wire FE2 to consume the flag).
- [ ] Fill or explicitly retire null/unimplemented FE control-map entries.
- [ ] Descriptor override strategy (proposal A deep-merge vs B full replace) — see `proposal.xml`; lean crawl→walk.
- [ ] `LegacyFormDefinition` vs `SerializeToXmlContentTypeStructure` overlap — TODOs in `ContentType.ts` about consolidating after XML changes.
- [ ] Section `id` / `color` added in TB2 — ensure round-trip and legacy compatibility.

---

## 9. Progress log

Keep newest first. One short bullet per meaningful session.

- **2026-08-03** — Refined §5.9: all `FormController` hooks may be async (host awaits); clarified on-disk path, form_controller API, and FE2 loader call site (`formControllerLoader` from form bootstrap — not `importPlugin`).
- **2026-08-03** — Decided FE2 form-controller design (§5.9): keep type-local `form-controller.js` gated by `hasJsController`; load via authenticated form_controller API + ESM Blob import; export `FormController` hooks (`initialize`, `isFieldRelevant`, `onBeforeSave`) — **not** a `PluginDescriptor`. FE1 YUI controllers are incompatible (migrate by rewrite). TB must fix Client-side Controller to edit `form-controller.js` instead of Groovy. Implementation still TODO.
- **2026-07-31** — Implemented FE control plugins on the single `PluginDescriptor` model: `controls` + `ControlPluginContribution`, `registerPluginControls`, control contribution registry, `controlPluginLoader` rewritten to `importPlugin` + `field.type` lookup (removed raw `import(url)` / bare default component). Sample: `samples/fe2-control-plugin.example.mjs`.
- **2026-07-31** — Documented FE control plugin convergence spec (`fe2-control-plugin-single-model-implementation.md`): `PluginDescriptor.controls`, registry + `registerPluginControls`, rewrite `controlPluginLoader` to mirror DS `loadDataSourceModule`. Updated plugins companion §9.6/§9.8 and open decisions.
- **2026-07-30** — Implemented single plugin model for FE data sources: `PluginDescriptor.dataSources`, `registerPlugin` installs into the DS registry, `loadDataSourceModule` only calls `importPlugin` + type lookup (removed bare-module packaging). Also fixed NodeSelector Create for shared-content with empty Default Type (`allowedCreatePaths`), and content-types reactivity for wildcard create actions.
- **2026-07-27** — Documented the project-plugin package/install layer, modern `PluginDescriptor`/widget runtime, official FE1 control/DS contracts, and local `authoring-ui-plugin-examples` build flow in the plugin companion doc. Confirmed current FE2 controls use a separate direct-import convention, FE2 has no DS plugin runtime, legacy package auto-wiring targets `site-config-tools.xml`, and the example repo's `forms-engine` bundle is not connected to current FE. Follow-up from deeper review: non-React/`craftercms.define` registration paths, `build/` vs `dist/` outputs, Plugin Host app examples, and `fe-control-plugin.js` as an FE1 reference.
- **2026-07-24** — Documented legacy/new control, DS, plugin, and form-controller architecture. Confirmed legacy TB catalog comes from `administration/site-config-tools.xml`; new TB reads `ui.xml`. New FE dynamically loads control plugins but interprets inert DS records through hard-coded consumer switches; DS plugin round-trip and form controllers are not implemented. Follow-up notes: descriptor lookup precedence is inconsistent by operation; `EditTypeView` bypasses Redux `uiConfig`; several FE control-map entries remain null.
- **2026-07-24** — Created this context doc + Cursor rule for multi-agent handoff. Next TB is ContentTypeManagement, centered on `components/EditTypeView.tsx`. Primary near-term theme: unify type definition into form-definition.xml (blocked on backend config.xml usage).
