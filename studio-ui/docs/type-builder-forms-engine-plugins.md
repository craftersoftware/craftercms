# Type Builder & Forms Engine — Plugin Architecture

> Companion to [`type-builder-forms-engine.md`](type-builder-forms-engine.md). Read this before designing or changing dynamic controls, data sources, FE form controllers, plugin loading, or TB plugin discovery.

Last updated: 2026-07-31

## 1. Why plugins are part of the core design

CrafterCMS developers can extend Studio through project plugins. For TB/FE, plugins are not an edge case:

- TB must discover plugin controls and data sources, show them in its catalog, and expose configuration forms for them.
- TB must persist enough identity/configuration in `form-definition.xml` for FE to use the selected extension later.
- FE must load and execute the plugin implementation, connect it to form state, validate/serialize its values, and isolate failures.
- Installing/uninstalling a plugin must wire/unwire the appropriate project configuration without corrupting existing types.

Official documentation:

- [Plugins](https://craftercms.com/docs/current/by-role/developer/composable/extensions/plugins.html)
- [Crafter Studio Plugin Examples](https://craftercms.com/docs/current/by-role/developer/composable/extensions/resources/plugin-ui-example.html)

Local examples:

`/Users/rart/Workspace/authoring-ui-plugin-examples`

## 2. Separate the three plugin mechanisms

### 2.1 Project plugin package

A project plugin is an installable file bundle described by `craftercms-plugin.yaml` (`descriptorVersion: 2`). The descriptor contains marketplace metadata, compatible CrafterCMS versions/editions, and optional `installation` entries.

Installation copies authoring assets into the site repository. Relevant mapping:

```
plugin source:
  authoring/static-assets/...

installed site:
  /config/studio/static-assets/plugins/<plugin-id-path>/...
```

Plugins can also deliver content types and therefore type-local files such as `form-definition.xml`, `config.xml`, `controller.groovy`, thumbnails, and potentially `form-controller.js`.

The `installation` block performs declarative XML auto-wiring. Important fields:

- `type`: e.g. `preview-app`, `form-control`, `form-datasource`
- `parentXpath`: insertion parent where required
- `elementXpath`: identity/removal test for install/uninstall
- `element`: XML subtree to add

Historically:

- `form-control` adds a `<control>` to `administration/site-config-tools.xml`
- `form-datasource` adds a `<datasource>` there
- modern UI widgets add `<widget>` declarations to `ui.xml`

This installer contract must evolve with TB's move from `site-config-tools.xml` to `ui.xml`; otherwise existing plugin packages will install successfully but remain invisible to new TB.

### 2.2 General modern Studio UI plugin

A modern UI bundle default-exports (or exports as `plugin`) a `PluginDescriptor`:

```ts
interface PluginDescriptor {
	id: string;
	locales?: Record<string, object>;
	widgets?: Record<string, React.ComponentType | NonReactWidgetRecord>;
	scripts?: Array<string | object>;
	stylesheets?: Array<string | object>;
	/** Author-contributed helpers (underscore-style). Typed today; host publish/eager-load still open. */
	utils?: Record<string, unknown>;
	/** FE2 DS modules — keyed by DS type id; installed by registerPlugin. */
	dataSources?: Record<string, DataSourceModule>;
	/** FE2 controls — keyed by control type id (= field.type); installed by registerPlugin. */
	controls?: Record<string, ControlPluginContribution>;
}
```

`widgets` may be omitted when the bundle is a library or FE contribution package (see §9). Demand-loading a DS or control plugin does not require rendering a widget from that bundle. Eager load for lib-only plugins (no form field referencing them) is still an open follow-up.

`ui.xml` typically references a bundle through a widget's plugin locator:

```xml
<widget id="org.example.someWidget">
  <plugin
    id="org.example"
    type="examples"
    name="library"
    file="index.js"
  />
</widget>
```

The `Widget` host:

1. checks the global component registry for the widget id;
2. if absent, calls `importPlugin(pluginLocator)`;
3. dynamically imports the bundle from the site plugin-file API;
4. registers the descriptor's widgets, locales, scripts, and stylesheets;
5. renders the newly registered widget.

`ui/app/src/services/plugin.ts` provides:

- `buildFileUrl` / `createFileBuilder` — plugin asset locator
- `importFile` — import a raw ESM file without registering a descriptor
- `importPlugin` — import a `PluginDescriptor` bundle and register it
- `registerPlugin` — add descriptor to the global plugin registry
- `registerComponents` — add widgets to the global component registry

Registration details:

- plugin descriptors are deduplicated by `PluginDescriptor.id`;
- widgets are deduplicated independently by widget id;
- relative `scripts` / `stylesheets` resolve beside the imported bundle;
- locales augment Studio translations;
- imported bundles are cached by the widget host's generated file URL.

Alternate registration paths also exist:

- **Non-React widgets** may export `{ main({ craftercms, element, configuration }) }` instead of a React component; `NonReactWidget` mounts them into a host element.
- **UMD/AMD-style plugins** can register through `craftercms.define(...)`, which ultimately calls the same `registerPlugin` path. Relative scripts/stylesheets are harder to resolve when the original file locator is not tracked.

### 2.3 FE control/DS plugin

Legacy FE plugins do **not** use the modern `PluginDescriptor`/widget registry. Their `<plugin>` record is an asset locator embedded in the TB catalog and later copied into `form-definition.xml`:

```xml
<plugin>
  <pluginId>org.example.plugin</pluginId>
  <type>control|datasource</type>
  <name>extension-name</name>
  <filename>main.js</filename>
</plugin>
```

That locator identifies one implementation file through `/studio/1/plugin/file`.

**FE2** loads the same locator through `importPlugin` and expects a `PluginDescriptor`. Control contributions live on `descriptor.controls` (keyed by `field.type`); DS contributions on `descriptor.dataSources` (keyed by `record.type`). The host registers everything — plugins do not self-register.

## 3. Plugin identities are not one thing

Keep these identities explicit; examples do not always use the same value:

| Identity                                           | Purpose                                              |
| -------------------------------------------------- | ---------------------------------------------------- |
| `craftercms-plugin.yaml` `plugin.id`               | installable package / marketplace identity           |
| plugin file locator (`id`, `type`, `name`, `file`) | physical asset location in the installed project     |
| `PluginDescriptor.id`                              | runtime descriptor registration/deduplication        |
| widget id                                          | component lookup and UI placement                    |
| FE control/DS `name`                               | legacy module prefix and type identity               |
| content-type field/DS `type`                       | persisted runtime selection in `form-definition.xml` |

Do not infer one from another without an explicit mapping.

Naming differences also exist:

- `ui.xml` widget locator uses attribute `file`;
- legacy FE XML uses child `filename`;
- `PluginFileBuilder` uses property `file`;
- `plugin.ts` sends query parameter `filename`;
- current public docs illustrate the low-level URL with query parameter `file`.

Before consolidating loaders, confirm which query names the backend accepts and normalize at one boundary.

## 4. Local example repository

Repository:

`/Users/rart/Workspace/authoring-ui-plugin-examples`

Structure:

```
craftercms-plugin.yaml        # package descriptor + auto-wiring
examples/                     # source workspaces
  component-library/          # representative modern PluginDescriptor bundle
  forms-engine/               # FE extension experiment/skeleton
  ...
authoring/                    # generated installable output
  static-assets/plugins/
    org/craftercms/examples/
      library/index.js
      forms-engine/index.js
```

The Yarn root declares `examples/*` as workspaces. Individual examples build with Rollup and copy `dist/index.js` into `authoring/...`, making `authoring` the payload installed into a Studio site.

Two build outputs matter for the Rollup packages:

- `build/` — TypeScript emit that still imports `@craftercms/studio-ui` packages; useful for local/npm consumption (for example the CRA workspace).
- `dist/` — Studio runtime bundle with host externals rewritten to `craftercms.*`; this is what gets copied under `authoring/`.

### 4.1 `component-library`: authoritative modern bundle pattern

Source: `examples/component-library/src/index.tsx`.

It default-exports a `PluginDescriptor` containing:

- several widget ids mapped to React components;
- `en` / `es` locales;
- optional additional scripts and stylesheets.

Its Rollup build:

- outputs an ES module;
- treats React, React DOM, React Intl, Redux, RxJS, MUI, and `@craftercms/studio-ui` as Studio-provided externals;
- rewrites package imports to host globals such as `craftercms.libs.*`, `craftercms.components`, and `craftercms.services.*`;
- copies the result to `authoring/static-assets/plugins/org/craftercms/examples/library/index.js`.

This host-externalization is important: plugins should share Studio's React/MUI/Redux instances instead of bundling duplicate runtimes.

The root `craftercms-plugin.yaml` auto-wires selected component-library widgets into `ui.xml`. The `Widget` host later imports the one library bundle; registering it makes every exported widget available, including widgets not directly referenced by the first declaration.

Only two widgets are auto-installed (`viewProjectsPanelButton`, `vanilla`). The remaining widgets in the same bundle require manual `ui.xml` wiring.

### 4.2 `forms-engine`: useful direction, not current FE wiring

`examples/forms-engine` builds a modern `PluginDescriptor` whose `widgets` contain `ExampleControl` and `ExampleDataSource`.

However:

- those components are placeholder React views, not complete FE contracts;
- the root package descriptor does not auto-wire this bundle;
- current FE resolves control/DS implementations from `PluginDescriptor.controls` / `.dataSources`, not from the global widget registry;
- putting FE controls only under `widgets` does not make them available to Forms Engine.

Treat this example as an experiment illustrating a registry-based direction; use `samples/fe2-control-plugin.example.mjs` / `samples/fe2-datasource-plugin.example.mjs` for the current FE2 contribution contract.

### 4.3 Other examples in the same repo

The monorepo also demonstrates **Plugin Host apps**, which are full pages/apps loaded via Studio's plugin host rather than FE control/DS contracts:

- `app-vanilla` — zero-build IIFE that consumes `window.craftercms`
- `cra` — Create React App that can import the component-library `build/` output during local development
- `app-external-sources` — Vite app (`awes`) that can serve assets externally or embed them under `authoring/`

Useful for Studio chrome/app plugins; not the primary contract for TB/FE field extensions.

## 5. Official FE plugin documentation describes FE1

The current public “Form Engine Control” and “Form Engine Data Source” examples still document the legacy YUI architecture.

### Control contract

- file location: `authoring/static-assets/plugins/{pluginId}/control/{name}/{file}.js`
- constructor receives `(id, form, owner, properties, constraints, readonly)`
- extends `CStudioForms.CStudioFormField`
- declares label/name/properties/constraints
- owns imperative DOM rendering and value/model updates
- registers with `CStudioAuthoring.Module.moduleLoaded(controlName, ControlClass)`

### Data-source contract

- file location: `authoring/static-assets/plugins/{pluginId}/datasource/{name}/{file}.js`
- constructor receives `(id, form, properties, constraints)`
- extends `CStudioForms.CStudioFormDatasource`
- declares `getInterface`, `getName`, `getSupportedProperties`
- exposes operational methods such as `getList(callback)`, `add`, browse, create, edit, etc.
- registers with `moduleLoaded(dataSourceName, DataSourceClass)`

The docs explicitly state the desired separation: controls manage capture/selection UI and delegate retrieval/actions to swappable data sources.

These FE1 implementations are not source-compatible with FE2 React controls. New FE already reports this incompatibility when a legacy control file is loaded as a React module.

## 6. Current FE2/TB2 plugin status

### FE2 controls: functional (single plugin model)

For a field with `field.properties.plugin`, `ControlWrapper` (`controlHelpers.tsx`):

1. creates a plugin locator from `type`, `name`, `filename`, `pluginId`;
2. loads via `controlPluginLoader` → `importPlugin` → `descriptor.controls[field.type]`;
3. renders the registered React component;
4. uses `dataSourceBindings` from the descriptor control entry (registered for `field.type`);
5. resolves `ControlProps.dataSources` before render;
6. isolates load/render errors.

Plugin control export:

```js
export default {
	id: 'org.example.my-controls',
	controls: {
		'my-custom-picker': {
			Component: MyPicker,
			dataSourceBindings: [{ propertyName: 'itemManager', interfaces: ['item'], selection: 'multi' }]
		}
	}
};
```

Eager alternative for UMD loaders: `craftercms.formsEngine.controls.registerDataSourceBindings(type, bindings)` (bindings only; prefer `descriptor.controls` for the component).

Example: `samples/fe2-control-plugin.example.mjs`.

Missing for a complete extension contract:

- plugin-supplied value retriever;
- serializer;
- validators;
- additional XML fields/attributes;
- migrations/versioning;
- optional descriptor for TB property editing (should mirror `dataSourceBindings` for the DS property UI);
- explicit lifecycle beyond React render/unmount.

### TB2 controls: plugin coordinates on insert

TB2 reads control entries/descriptors from the `ContentTypeManagement` widget in `ui.xml`. When inserting a field or data source from a catalog entry that includes `<plugin>`, `EditTypeView` copies coordinates onto `field.properties.plugin` or `DataSource.plugin` (mapping `id`→`pluginId`, `fileName`→`filename`).

Remaining gaps:

- existing package installers may still wire `form-control` into legacy `site-config-tools.xml`;
- descriptor merge/precedence remains inconsistent across some edit/serialize helpers;
- a general `PluginDescriptor.widgets` control is not connected to FE's control resolver.

### FE2 data sources: runtime + built-in modules

FE2 ships the platform and built-in modules under `components/FormsEngine/dataSources/`:

- `DataSourceModule` is a versioned factory registered by DS type;
- a form-definition `DataSource` is a configured instance record, not executable UI;
- modules advertise interfaces/capabilities and create instances with actions plus optional `list`/`edit`/`refreshItem`;
- controls receive ordered, resolved records/actions through `ControlProps.dataSources`;
- built-in controls declare bindings in `controlDataSourceBindings`; **plugin controls declare bindings on `descriptor.controls[type].dataSourceBindings`** (or register via `craftercms.formsEngine.controls`);
- built-ins register into `dataSourceModuleRegistry` at platform init;
- **plugin DS types** are contributed on `PluginDescriptor.dataSources`; `importPlugin` → `registerPlugin` installs them (same path as widgets). `loadDataSourceModule` only demand-loads the locator then looks up by `record.type` — it is not a parallel plugin system;
- **plugin control types** are contributed on `PluginDescriptor.controls`; same `importPlugin` → `registerPlugin` path. `controlPluginLoader` demand-loads then looks up by `field.type`;
- host registry surface: `window.craftercms.formsEngine.dataSources` / `.controls` — for built-ins/tests/UMD; plugin authors export a descriptor;
- platform ops for modules: `ctx.services` = `DataSourceServices` (browse/search/upload/createContent) — closed host API;
- examples: `samples/fe2-datasource-plugin.example.mjs`, `samples/fe2-control-plugin.example.mjs`.

Most modules return actions whose `run(ctx, { target? })` calls shared services. The host groups standard actions by binding + intent, but every concrete `DataSourceActionChoice` retains its resolved owning action. One choice runs immediately; multiple choices open a picker. Custom React `MenuItem`/`Dialog` actions remain standalone instead of being flattened into standard groups.

Action ids must be unique within a configured datasource instance. Resolution stamps the stable cross-instance key `dataSourceId::actionId`. Create actions may expose multiple typed targets; `createContent` resolves after nested-form save/cancel so the selected action returns a semantic item selection.

The runtime retains the source datasource on the resolved action/choice. It does not currently persist FE1's node-selector `datasource` XML attribute; FE2/XB provenance round-tripping is intentionally deferred.

### Form controllers

`form-controller.js` is a content-type-local extension, not the same mechanism as either a UI `PluginDescriptor` or a control/DS file plugin.

A project plugin can deliver a content type and its controller file, but FE still needs an explicit form-controller runtime contract. FE2 currently has none. A future design should decide whether form controllers:

- remain type-local modules loaded directly;
- are resolved through the same plugin asset service;
- or register hooks through a broader FE extension descriptor.

Whichever path is chosen must define lifecycle, access to form state/services, field relevance/visibility, pre-save veto/transformation, async behavior, error isolation, and version compatibility.

## 6.1 FE1 → FE2 data-source migration notes

Legacy YUI data sources (`CStudioForms.Datasources.*`) are **not** loadable as FE2 modules. Migrate by rewriting behavior as a `DataSourceModule`:

| FE1 concern                | FE2 equivalent                                                               |
| -------------------------- | ---------------------------------------------------------------------------- |
| `getInterface` / `getName` | `module.interfaces` / `module.type`                                          |
| `getSupportedProperties`   | TB descriptor (code or `ui.xml`)                                             |
| `add(control)` menu DOM    | `instance.getActions(ctx)` → control renders menu                            |
| `insertImage/VideoAction`  | owner-bound choice → `action.run(ctx, { target? })` → `DataSourceSelection`  |
| `getList(callback)`        | `instance.list(ctx)`                                                         |
| `edit(key)`                | `instance.edit(selection, ctx)` only when real                               |
| Studio Operations dialogs  | `ctx.services.browseFiles/search/upload/createContent`                       |
| Script `moduleLoaded`      | `registerPlugin` → `descriptor.dataSources` (demand-load via `importPlugin`) |

Control plugins that bind DS must declare `dataSourceBindings` on the control contribution (or call `craftercms.formsEngine.controls.registerDataSourceBindings`). Do not `switch (ds.type)` inside controls.

Remote S3/WebDAV modules that lack platform services throw visibly via `unsupportedRemoteError` rather than silently omitting menu entries.

## 7. Design requirements derived from the plugin ecosystem

1. **Installation and runtime must agree.** Update plugin auto-wiring targets when TB catalog configuration moves from `site-config-tools.xml` to `ui.xml`, with upgrade compatibility.
2. **Keep package, asset, runtime, and type identities explicit.** Persist a normalized locator rather than relying on naming coincidence.
3. **Use one modern plugin format.** Every authoring extension (widgets, libs, FE controls, FE data sources) is a `PluginDescriptor` bundle loaded through `importPlugin` / `registerPlugin`. Do not invent a parallel “DS module file” or “control component file” packaging model; contributions are fields on the descriptor (see §9).
4. **Preserve Studio host externals.** Publish the supported host API surface and avoid bundling duplicate React/MUI/Redux.
5. **Make DS behavior pluggable.** Model capabilities independently from concrete DS ids and let plugins register `DataSourceModule`s through the descriptor.
6. **Pair TB descriptors with FE implementations.** A plugin should be able to supply catalog metadata, property editor schema/defaults, runtime code, and serialization hooks coherently.
7. **Round-trip locators losslessly.** Control and DS plugin records must survive parse → edit → serialize unchanged.
8. **Version contracts.** Declare FE extension API version and compatibility separately from the package's CrafterCMS version range.
9. **Failure isolation and cache invalidation.** Plugins need load/runtime error boundaries and a development-time way to refresh cached modules.
10. **Security.** Plugin code executes with Studio privileges; installation permissions, asset origin, CSP, auth, and trust boundaries are architectural concerns.
11. **Migration.** Existing FE1 control/DS packages and `site-config-tools.xml` auto-wiring need an explicit compatibility or conversion story.
12. **Support lib-style plugins.** Bundles that contribute `utils` / shared runtime APIs must load and publish without requiring a rendered widget (see §9).

## 8. Key source paths

Studio:

- `ui/app/src/services/plugin.ts`
- `ui/app/src/components/Widget/Widget.tsx`
- `ui/app/src/models/PluginDescriptor.ts`
- `ui/app/src/models/PluginFileBuilder.ts`
- `ui/app/src/components/FormsEngine/lib/controlHelpers.tsx`
- `ui/app/src/components/FormsEngine/dataSources/*`
- `ui/app/src/components/FormsEngine/dataSourceHooks/*`
- `ui/app/src/components/FormsEngine/fe-control-plugin.js` — local FE1 control/DS examples and catalog XML snippets
- `ui/app/src/components/ContentTypeManagement/components/EditTypeView.tsx`
- `ui/app/src/components/ContentTypeManagement/proposal.xml`
- `static-assets/components/cstudio-common/common-api.js`
- `static-assets/components/cstudio-forms/forms-engine.js`

Examples:

- `/Users/rart/Workspace/authoring-ui-plugin-examples/craftercms-plugin.yaml`
- `/Users/rart/Workspace/authoring-ui-plugin-examples/examples/component-library/`
- `/Users/rart/Workspace/authoring-ui-plugin-examples/examples/forms-engine/`
- `/Users/rart/Workspace/authoring-ui-plugin-examples/authoring/`
- `samples/fe2-datasource-plugin.example.mjs` — `PluginDescriptor` + `dataSources` example
- `samples/fe2-control-plugin.example.mjs` — `PluginDescriptor` + `controls` example
- `docs/fe2-control-plugin-single-model-implementation.md` — control convergence handoff (implemented)

## 9. Design: single plugin model, lib plugins, FE contributions

**Status:** DS + control contribution paths implemented (2026-07-31). Eager lib-only load + `craftercms.plugins.utils` publish remain open.

### 9.1 Decision: one plugin model

Do **not** introduce a second kind of “FE module plugin” packaged or loaded differently from Studio UI plugins.

| Concept                                           | Role                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Project plugin package (`craftercms-plugin.yaml`) | Install/copy assets + XML auto-wire                                                                   |
| `PluginDescriptor` bundle                         | **The** runtime unit: widgets, utils, FE data sources, FE controls                                    |
| `DataSourceModule`                                | Behavior factory registered **by** a plugin (or by Studio for built-ins) — not a separate load format |
| `DataSourceServices` (`ctx.services`)             | Closed **host** Studio ops — not where plugins publish underscore-style helpers                       |

Form-definition `<plugin>` locators keep pointing at a JS file URL. That file’s default/`plugin` export must be a `PluginDescriptor`. FE resolves DS behavior by `record.type` after the descriptor has been registered — same as widgets resolve by widget id after registration.

Plugins **export** contributions; they do **not** call `register` / `registerPlugin` themselves. The host (`importPlugin` → `registerPlugin`) owns registration so developers cannot forget a side-effect call and so double-registration cannot depend on load order.

### 9.2 Scenario: underscore-style shared lib

**Plugin A** exports helpers many other plugins need. **Plugins B/C** are DS (or control) bundles that call those helpers.

Target flow:

1. A is installed as a normal project plugin and declared for **eager** (or on-demand) load in site config — **no widget required**.
2. `importPlugin(A)` → `registerPlugin` stores `A.utils` on the descriptor (already); expose via a host map when needed.
3. B/C load as `PluginDescriptor`s; their factories/`create`/`run` read A via the host map (or, later, AMD/`define` deps once plugin ids are resolvable there).
4. B/C’s `dataSources` entries register into `dataSourceModuleRegistry` like built-ins (**done**).

What does **not** happen: A does not extend `DataSourceServices`; B does not `import()` a bare `DataSourceModule` file that bypasses the descriptor.

### 9.3 `PluginDescriptor` contributions

```ts
interface PluginDescriptor {
	id: string;
	locales?: Record<string, object>;
	widgets?: Record<string, WidgetRecord>; // optional — Studio shell widgets
	scripts?: Array<string | object>;
	stylesheets?: Array<string | object>;
	utils?: Record<string, unknown>; // stored on register; host publish/eager-load TBD
	dataSources?: Record<string, DataSourceModule>; // key = DS type id — installed by registerPlugin ✓
	controls?: Record<string, ControlPluginContribution>; // key = control type id (= field.type) — installed by registerPlugin ✓
}

interface ControlPluginContribution {
	Component: ComponentType<ControlProps>;
	dataSourceBindings?: DataSourceBinding | readonly DataSourceBinding[];
}
```

`registerPlugin` (current):

1. Validates and installs `dataSources` into `dataSourceModuleRegistry` (before committing the plugin id).
2. Validates and installs `controls` into the control contribution registry + binding registry.
3. Stores the descriptor (including `utils`) in the plugins map.
4. Registers widgets, locales, scripts/stylesheets as before.
5. `widgets` may be omitted (lib / FE-only bundles).

### 9.4 Load lifecycle

| Trigger                    | When                                                              | Status                                                                            |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Demand (DS)**            | FE needs `record.type` not in registry and `record.plugin` is set | **Done** — `loadDataSourceModule` → `importPlugin` → type lookup                  |
| **Demand (control)**       | Field has `properties.plugin`                                     | **Done** — `controlPluginLoader` → `importPlugin` → `controls[field.type]` lookup |
| **Demand (widget)**        | `<Widget plugin={…}>` missing from `components`                   | **Done** (existing)                                                               |
| **Eager / site libraries** | Studio boot or site switch                                        | **Open** — needed for lib-only plugins without dummy widgets                      |

### 9.5 FE DS resolution

```
record.type → registry.get(type)
  if miss && record.plugin → importPlugin(locator) → registerPlugin → registry.get(type)
  if still miss → error (plugin loaded but type not in descriptor.dataSources)
```

Built-ins call `registerDataSourceModule` at platform init. Externally authored DS types always arrive through a descriptor.

### 9.6 FE control resolution

```
field.type → getRegisteredControlContribution(type)
  if miss && field.properties.plugin → importPlugin(locator) → registerPlugin → lookup again
  if still miss → error (plugin loaded but type not in descriptor.controls)
```

Implemented in `controlPluginLoader.ts`, mirroring `loadDataSourceModule`. Plugins export a `PluginDescriptor`; there is no bare default React component export for control plugins.

**Key invariant:** `PluginDescriptor.controls` map keys **must equal** `field.type` for fields that reference the plugin locator.

Handoff (historical): [`fe2-control-plugin-single-model-implementation.md`](fe2-control-plugin-single-model-implementation.md).

### 9.7 Non-goals / trust

- Plugins do not inject into `DataSourceServices`.
- No `eval` of util strings; utils are JS exports from the trusted plugin origin.
- Eager lib lists (when added) are site admin configuration (same trust class as `ui.xml` widgets).

### 9.8 Remaining implementation

1. ~~Control plugins on descriptor~~ — **done** (2026-07-31).
2. Eager library declarations in `ui.xml` (or equivalent) and boot-time `importPlugin`.
3. Publish `utils` on a stable host path (e.g. `craftercms.plugins[id]`).
4. Optional AMD resolution of `plugin:<id>` deps.
