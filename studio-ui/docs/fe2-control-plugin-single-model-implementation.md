# FE2 control plugins — single `PluginDescriptor` model (implementation handoff)

> **Task:** Converge FE2 control plugin loading onto the same `PluginDescriptor` + `importPlugin` / `registerPlugin` path already used for data sources. Remove the parallel raw-`import()` control loader.
>
> **Read first:** [`type-builder-forms-engine.md`](type-builder-forms-engine.md), [`type-builder-forms-engine-plugins.md`](type-builder-forms-engine-plugins.md) (§9), [`.cursor/rules/type-builder-forms-engine.mdc`](../.cursor/rules/type-builder-forms-engine.mdc).
>
> **Out of scope for this task:** eager lib-only plugin boot, `craftercms.plugins.utils` host publish, TB descriptor changes, validators/serializers on plugins.

---

## 1. Problem

Today there are **two plugin load paths** for Forms Engine extensions:

| Concern      | Current path                                                                                                           | Status               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Data sources | `loadDataSourceModule` → `importPlugin` → `registerPlugin` installs `descriptor.dataSources` → lookup by `record.type` | **Done**             |
| Controls     | `controlPluginLoader` → raw `import(url)` → `default` = React component + optional named `dataSourceBindings`          | **Parallel / wrong** |

The control path bypasses `PluginDescriptor`, cannot share `utils` / `dataSources` from the same bundle, and duplicates caching/registration logic.

---

## 2. Target architecture

Mirror the DS pattern exactly:

```
field.properties.plugin (locator)
  → importPlugin(locator)
  → registerPlugin(descriptor)
      → installs descriptor.controls[field.type] into control registry
      → installs bindings via registerControlDataSourceBindings
  → lookup control contribution by field.type
  → render Component + resolve ControlProps.dataSources
```

**Rules (non‑negotiable):**

- Plugin files **export** a `PluginDescriptor`; they do **not** self-register.
- Host owns all registration via `registerPlugin`.
- No bare React component as `default` export for control plugins (descriptor-only).
- Control lookup key = **`field.type`** (the control type id in `form-definition.xml`, e.g. `my-custom-picker`), **not** widget id.

---

## 3. Reference implementation (data sources — copy this pattern)

### 3.1 Descriptor field

```ts
// ui/app/src/models/PluginDescriptor.ts
dataSources?: Record<string, DataSourceModule>; // key = DS type id
```

### 3.2 Registration (`registerPlugin`)

`ui/app/src/services/plugin.ts` → `registerPluginDataSources()`:

- Validates each module (`validateDataSourceModule`)
- Ensures map key === `module.type`
- Rejects duplicate type from a _different_ module instance
- Registers into `dataSourceModuleRegistry`

### 3.3 Demand load (`loadDataSourceModule`)

`ui/app/src/components/FormsEngine/dataSources/loader.ts`:

1. `registry.get(record.type)` — hit cache
2. If miss && `record.plugin` → `importPlugin(builder)`
3. `registry.get(record.type)` again — error if still missing

### 3.4 Sample

`samples/fe2-datasource-plugin.example.mjs` — exports `{ id, utils?, dataSources: { [type]: module } }`.

---

## 4. Control implementation spec

### 4.1 New types

Add to `ui/app/src/models/PluginDescriptor.ts` (or a small `ControlPluginContribution.ts` if you prefer separation):

```ts
import type { ComponentType } from 'react';
import type { ControlProps } from '../components/FormsEngine/types';
import type { DataSourceBinding } from '../components/FormsEngine/dataSources/types';

export interface ControlPluginContribution {
	/** React control component; must accept ControlProps. */
	Component: ComponentType<ControlProps>;
	/** Optional; same shapes as today’s plugin module exports. */
	dataSourceBindings?: DataSourceBinding | readonly DataSourceBinding[];
}

export interface PluginDescriptor {
	// ...existing fields...
	controls?: Record<string, ControlPluginContribution>; // key = control type id (= field.type)
}
```

### 4.2 Control registry

Add `ui/app/src/components/FormsEngine/controls/registry.ts` (or colocate in `bindings.ts` if minimal):

```ts
export interface RegisteredControlContribution {
	Component: ComponentType<ControlProps>;
	bindings: readonly DataSourceBinding[];
	pluginId: string;
}

const registeredControls = new Map<string, RegisteredControlContribution>();

export function registerControlContribution(controlType: string, contribution: RegisteredControlContribution): void;

export function getRegisteredControlContribution(controlType: string): RegisteredControlContribution | undefined;

export function hasRegisteredControl(controlType: string): boolean;
```

Duplicate control type from a _different_ component reference → throw (same policy as DS modules).

### 4.3 `registerPluginControls(plugin)`

In `ui/app/src/services/plugin.ts`, add sibling to `registerPluginDataSources`:

1. If no `plugin.controls`, return.
2. For each `[typeKey, entry]`:
   - Validate `entry.Component` is a valid React component (`isValidElementType` from `react-is`).
   - Normalize bindings via existing `normalizeDataSourceBindings(entry.dataSourceBindings ?? [])`.
   - If `registeredControls.has(typeKey)` and existing component !== entry.Component → throw.
   - Store `{ Component, bindings, pluginId: plugin.id }`.
   - Call `registerControlDataSourceBindings(typeKey, bindings)` (keeps `getControlDataSourceBindings(field.type)` working).
3. Run **before** committing plugin id to `plugins` map (same ordering as DS validation).

Call from `registerPlugin` before `plugins.set(...)`.

### 4.4 Rewrite `controlPluginLoader.ts`

Replace raw `import(url)` with plugin-system load:

```ts
export function loadControlPluginModule(
	siteId: string,
	plugin: FormDefinitionPlugin, // from field.properties.plugin
	controlType: string,
	errorComponent: ComponentType<ControlProps>
): Promise<LoadedControlPlugin>;
```

Flow:

1. Build locator: `{ site, type: plugin.type, name: plugin.name, file: plugin.filename, id: plugin.pluginId }`.
2. Cache by **plugin file URL** (same as today) or plugin id — pick one and document; URL cache is fine.
3. `await importPlugin(builder)`.
4. `const contribution = getRegisteredControlContribution(controlType)`.
5. If missing → return `errorComponent` with console error:
   `Plugin "${descriptor.id}" loaded from "${url}" does not contribute control type "${controlType}". Add it to PluginDescriptor.controls.`
6. Return `{ Component: contribution.Component, bindings: contribution.bindings, url }`.

**Remove:** `getPluginModuleExport`, raw `import(/* @vite-ignore */ url)`, legacy `ControlPluginModule` type, `ControlPluginNoDefaultExportError` (or repurpose as “control type not in descriptor”).

### 4.5 Update `controlHelpers.tsx`

`PluginControlRenderer` currently calls:

```ts
useControlPluginModule(buildControlPluginUrl(siteId, plugin), field.type, ...)
```

Change to pass `siteId`, `plugin` locator, and `field.type` into the rewritten loader (stop passing bare URL if loader builds locator internally — either is fine; prefer passing locator object like DS loader).

Keep `ResolvedControlRenderer` unchanged: it already uses `bindings` + `useFieldDataSources`.

### 4.6 Tighten `importPlugin` (if not already)

Align with DS expectations:

```ts
const plugin: PluginDescriptor = module.plugin ?? module.default;
if (!plugin?.id) {
	throw new Error(`Plugin file at "${url}" must export a PluginDescriptor with a string id.`);
}
```

Verify this exists; add if missing.

### 4.7 Host surface (optional but recommended)

Extend `formsEngineControlsHost` in `dataSources/host.ts`:

```ts
getControl: getRegisteredControlContribution,
// keep registerDataSourceBindings / getDataSourceBindings for UMD eager registration
```

Document that plugin authors should prefer `descriptor.controls` over manual binding registration.

### 4.8 Sample plugin

Add `samples/fe2-control-plugin.example.mjs`:

```js
const plugin = {
	id: 'org.example.my-control',
	controls: {
		'example-custom-input': {
			Component: function ExampleCustomInput(props) {
				/* use props.dataSources */
			},
			dataSourceBindings: [{ propertyName: 'datasource', interfaces: ['options'], selection: 'single' }]
		}
	},
	// optional same-bundle DS/utils:
	dataSources: {
		/* ... */
	},
	utils: {
		/* ... */
	}
};
export default plugin;
```

### 4.9 Docs updates (required before finishing)

- [`type-builder-forms-engine-plugins.md`](type-builder-forms-engine-plugins.md) §6 + §9.6: mark controls **done**, document `controls` shape and load flow.
- [`type-builder-forms-engine.md`](type-builder-forms-engine.md) §5.5: replace “default React component export” with descriptor.controls.
- Progress log entry with date.
- Open decision: mark control convergence done; leave lib-style plugins open.

---

## 5. Key files

| File                                                           | Action                                           |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `ui/app/src/models/PluginDescriptor.ts`                        | Add `ControlPluginContribution`, `controls?`     |
| `ui/app/src/services/plugin.ts`                                | `registerPluginControls`, tighten `importPlugin` |
| `ui/app/src/components/FormsEngine/controls/registry.ts`       | **New** control contribution registry            |
| `ui/app/src/components/FormsEngine/lib/controlPluginLoader.ts` | Rewrite to `importPlugin` + registry lookup      |
| `ui/app/src/components/FormsEngine/lib/controlHelpers.tsx`     | Adjust loader call signature                     |
| `ui/app/src/components/FormsEngine/dataSources/host.ts`        | Optional `getControl` on host                    |
| `ui/app/src/components/FormsEngine/dataSources/bindings.ts`    | Reuse; no behavioral change expected             |
| `ui/app/src/components/FormsEngine/dataSources/loader.ts`      | **Reference only** — do not duplicate logic      |
| `samples/fe2-control-plugin.example.mjs`                       | **New** example                                  |
| `docs/type-builder-forms-engine*.md`                           | Update                                           |

---

## 6. TB / form-definition contract (unchanged)

- TB inserts plugin coordinates onto `field.properties.plugin` via `EditTypeView` (`type`, `name`, `filename`, `pluginId`).
- Field also has `field.type` = control type id from catalog.
- **`PluginDescriptor.controls` keys must match `field.type`** for that field to resolve.

No TB code changes required for this task unless you discover a mismatch during testing.

---

## 7. Testing plan

1. **`yarn compile`** in `ui/app/` — must pass.
2. **`yarn prettier --write`** on edited files (per `AGENTS.md`).
3. **Manual (if dev server available):**
   - Authoring instance: `/Users/rart/Workspace/craftercms/develop-2026.07.29.11.28`
   - Site sandbox: `.../sites/editorial/sandbox` (not repo `samples/` or `ContentTypeManagement/form-definition.xml`)
   - Install or reference a test control plugin with descriptor.controls
   - Open a content type field that has `properties.plugin` set; confirm control renders and `dataSources` resolve
4. **Error paths:**
   - Plugin loads but `controls[field.type]` missing → field-level error UI, not white screen
   - Invalid bindings in descriptor → fail at register time with clear message
   - Duplicate control type from two plugins → throw at register time

---

## 8. Explicit non-goals

- Do **not** wire `PluginDescriptor.widgets` to FE control resolution (widgets remain Studio shell UI).
- Do **not** implement eager `<libraries>` boot (separate task).
- Do **not** add plugin validators/serializers/retrievers.
- Do **not** refactor built-in controls off `controlMap` / `controlDataSourceBindings`.
- Do **not** commit unrelated prettier churn.

---

## 9. Acceptance criteria

- [x] `controlPluginLoader` uses `importPlugin` only (no parallel `importFile` for controls).
- [x] `PluginDescriptor.controls` registered in `registerPlugin`.
- [x] Control resolved by `field.type` after plugin load.
- [x] Bindings from descriptor entry registered and used by `useFieldDataSources`.
- [x] Sample + docs updated; §9.6 no longer “open”.
- [x] `yarn compile` clean.

---

## 10. Context from prior session (2026-07-30)

- DS single-model convergence is implemented (`loader.ts` + `registerPlugin.dataSources`).
- NodeSelector Create fix for `shared-content` with empty Default Type (`allowedCreatePaths`).
- `useFieldDataSources` reactivity fix for wildcard `contentTypes: '*'`.
- Plugin self-register side effects removed from samples — host registers everything.
