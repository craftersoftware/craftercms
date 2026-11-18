/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import { ControlProps } from '../types';
import type { SxProps, Theme } from '@mui/material/styles';
import { countLimitValue } from '../../../utils/countLimits';
import Alert from '@mui/material/Alert';
import { FormattedMessage } from 'react-intl';
import { ElementType, memo, Suspense, useCallback, useContext, useId, useMemo } from 'react';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { Atom, useAtom } from 'jotai';
import { controlMap } from './controlMap';
import { UnknownControl } from '../components/UnknownControl';
import ErrorBoundary from '../../ErrorBoundary';
import { ControlSkeleton } from '../components/ControlSkeleton';
import { ContentTypeField } from '../../../models';
import ContentType from '../../../models/ContentType';
import FormsEngineField from '../components/FormsEngineField';
import { FormsEngineAtoms, StableFormContext, StableGlobalContext } from './formsEngineContext';
import { useControlPluginModule } from './controlPluginLoader';
import { getControlDataSourceBindings } from '../dataSources/bindings';
import { createDataSourceServices } from '../dataSources/services';
import { useFieldDataSources } from '../dataSources/useFieldDataSources';
import useContentTypes from '../../../hooks/useContentTypes';
import { useDispatch } from 'react-redux';
import { processPathMacros } from '../../../utils/path';

export interface ControlWrapperProps {
	field: ContentTypeField;
	autoFocus: boolean;
	readonly: boolean;
	contentType: ContentType;
	atom: Atom<unknown>;
	customControlMap?: Record<string, ElementType>;
}

export const ControlWrapper = memo(function (props: ControlWrapperProps) {
	const siteId = useActiveSiteId();
	const { field, atom, customControlMap } = props;
	const [value, setValue] = useAtom(atom);
	const plugin = field.properties?.plugin;
	return (
		<ErrorBoundary key={field.id}>
			<Suspense fallback={<ControlSkeleton label={field.name} />}>
				{plugin ? (
					<PluginControlRenderer {...props} value={value} setValue={setValue} siteId={siteId} plugin={plugin} />
				) : (
					<ResolvedControlRenderer
						{...props}
						value={value}
						setValue={setValue}
						Control={customControlMap?.[field.type] ?? controlMap[field.type] ?? UnknownControl}
					/>
				)}
			</Suspense>
		</ErrorBoundary>
	);
});

function PluginControlRenderer({
	siteId,
	plugin,
	...props
}: ControlWrapperProps & {
	value: unknown;
	setValue: (value: unknown) => void;
	siteId: string;
	plugin: NonNullable<ContentTypeField['properties']['plugin']>;
}) {
	const loaded = useControlPluginModule(siteId, plugin, props.field.type, ControlPluginError);
	return (
		<ResolvedControlRenderer
			{...props}
			Control={loaded.Component}
			// A control that declares none uses what `registerDataSourceBindings` registered for the type.
			bindings={loaded.bindings.length ? loaded.bindings : getControlDataSourceBindings(props.field.type)}
			fieldChrome={loaded.fieldChrome}
			fieldSx={loaded.fieldSx}
		/>
	);
}

export function ResolvedControlRenderer({
	field,
	autoFocus,
	readonly,
	contentType,
	value,
	setValue,
	Control,
	bindings = getControlDataSourceBindings(field.type),
	fieldChrome = false,
	fieldSx
}: Omit<ControlWrapperProps, 'atom' | 'customControlMap'> & {
	value: unknown;
	setValue: (value: unknown) => void;
	Control: ElementType<ControlProps>;
	bindings?: ReturnType<typeof getControlDataSourceBindings>;
	/**
	 * Wrap the control in `FormsEngineField`, labelled by the generated ids. Built-in controls and Type Builder
	 * controls wrap themselves, so this is `false` unless a plugin control asks for the default wrapper.
	 */
	fieldChrome?: boolean;
	fieldSx?: SxProps<Theme>;
}) {
	const id = useId();
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const contentTypes = useContentTypes();
	const stableForm = useContext(StableFormContext);
	const stableGlobal = useContext(StableGlobalContext);
	// Forms build these once; the fallback only serves a form context that doesn't provide them.
	const fallbackServices = useMemo(
		() =>
			stableForm?.dataSourceServices
				? undefined
				: createDataSourceServices({
						dispatch,
						siteId,
						formsApi: stableGlobal?.api ?? { pushForm: () => undefined }
					}),
		[dispatch, siteId, stableGlobal, stableForm]
	);
	const services = stableForm?.dataSourceServices ?? fallbackServices;
	// The item and its meta are read when a macro is expanded, not subscribed to, so an item update (lock, workflow
	// refetch, socket event) doesn't give every field a new `expandPath` and re-render it.
	const expandPath = useCallback(
		(path: string) => {
			const item = stableForm?.getItem();
			const itemMeta = stableForm?.itemMeta;
			return processPathMacros({
				path,
				objectId: itemMeta?.id,
				fullParentPath: item?.path ?? itemMeta?.pathInSite
			});
		},
		[stableForm]
	);
	// A max of 0 is unlimited for every control. See utils/countLimits.ts.
	const maxCount = countLimitValue(field.validations?.maxCount?.value);
	const remainingCapacity =
		typeof maxCount === 'number' && Array.isArray(value) ? Math.max(0, maxCount - value.length) : undefined;
	const dataSources = useFieldDataSources({
		siteId,
		contentType,
		field,
		bindings,
		value,
		readonly,
		remainingCapacity,
		services,
		expandPath,
		contentTypes
	});
	const inputId = `${id}-input`;
	const labelId = `${id}-label`;
	const control = (
		<Control
			autoFocus={autoFocus && !readonly}
			value={value}
			setValue={setValue}
			field={field}
			contentType={contentType}
			readonly={readonly}
			inputId={inputId}
			labelId={labelId}
			dataSources={dataSources}
		/>
	);
	return fieldChrome ? (
		<FormsEngineField field={field} htmlFor={inputId} labelId={labelId} sx={fieldSx}>
			{control}
		</FormsEngineField>
	) : (
		control
	);
}

function ControlPluginError({ field }: ControlProps) {
	return (
		<FormsEngineField field={field} menu={false}>
			<Alert
				severity="error"
				variant="standard"
				sx={(theme) => ({ border: 'none', strong: { fontWeight: theme.typography.fontWeightMedium } })}
			>
				<FormattedMessage
					defaultMessage="Unable to load the {name} ({id}) control. The control may be absent or contain errors in the code. Check the browser console for error details."
					values={{
						name: field.name,
						id: field.id
					}}
				/>
			</Alert>
		</FormsEngineField>
	);
}

export function renderFieldControl(
	field: ContentTypeField,
	atoms: FormsEngineAtoms['valueByFieldId'],
	autoFocus: boolean,
	readonly: boolean,
	contentType: ContentType,
	customControlsMap?: ControlWrapperProps['customControlMap']
) {
	const fieldId = field.id;
	return (
		<ControlWrapper
			key={fieldId}
			field={field}
			atom={atoms[fieldId]}
			readonly={readonly}
			autoFocus={autoFocus}
			contentType={contentType}
			customControlMap={customControlsMap}
		/>
	);
}
