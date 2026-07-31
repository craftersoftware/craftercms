/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import React, { useContext, useEffect, useRef, useState } from 'react';
import { FormsEngineField } from '../components/FormsEngineField';
import { ControlProps } from '../types';
import useRTEConfig from '../../../hooks/useRTEConfig';
import { initRichTextEditorConfig } from '../../../state/actions/preview';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import useSiteUIConfig from '../../../hooks/useSiteUIConfig';
import { useDispatch } from 'react-redux';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { Editor } from '@tinymce/tinymce-react';
import { TinyMCE } from 'tinymce';
import { getTinymce } from '@tinymce/tinymce-react/lib/es2015/main/ts/TinyMCE';
import { getPropertyValue } from '../lib/formUtils';
import { loadAceEditorAssets } from '../../../utils/system';
import { FormsEngineDialogContext } from '../lib/formsEngineContext';
import { getTinyMceInitOptions, type OpenRteDataSourcePicker } from '../lib/rteUtils';
import { getCurrentLocale } from '../../../utils/i18n';
import Dialog from '@mui/material/Dialog';
import MenuList from '@mui/material/MenuList';
import { DialogHeader } from '../../DialogHeader';
import { DialogBody } from '../../DialogBody';
import GroupedDataSourceActionMenuItems from '../components/GroupedDataSourceActionMenuItems';
import type { DataSourceFieldContext, DataSourceSelection, ResolvedDataSourceAction } from '../dataSources/types';
import { FormattedMessage } from 'react-intl';

export interface RichTextEditorProps extends ControlProps {
	value: string;
	defaultInitOptions?: Editor['props']['init'];
}

const tinymceScriptSrc = '/studio/static-assets/libs/tinymce/tinymce.min.js';

declare global {
	interface Window {
		tinymce: TinyMCE;
	}
}

export function RichTextEditor(props: RichTextEditorProps) {
	const { field, value, setValue, readonly, defaultInitOptions, dataSources } = props;
	const locale = getCurrentLocale();
	const rteConfig = useRTEConfig();
	const editorRef = useRef<Editor>(undefined);
	const hasReceivedFocusRef = useRef(false);
	const [dataSourcePicker, setDataSourcePicker] = useState<{
		actions: readonly ResolvedDataSourceAction[];
		context: DataSourceFieldContext;
		onResult(selection: DataSourceSelection | DataSourceSelection[] | null): void;
	} | null>(null);
	const openDataSourcePicker: OpenRteDataSourcePicker = (actions, context, onResult) => {
		setDataSourcePicker({ actions, context, onResult });
	};
	const maxLength = getPropertyValue(field.properties, 'maxlength') as number;
	const dialogContext = useContext(FormsEngineDialogContext);
	const setDisableEnforceFocus = dialogContext?.setDisableEnforceFocus;

	// region Initialize RTE config FE2 TODO: Move elsewhere
	const uiConfig = useSiteUIConfig();
	const dispatch = useDispatch();
	const siteId = useActiveSiteId();
	useEffect(() => {
		if (uiConfig.xml && !rteConfig) {
			dispatch(initRichTextEditorConfig({ configXml: uiConfig.xml, siteId }));
		}
	}, [uiConfig.xml, siteId, rteConfig, dispatch]);
	const [scriptLoaded, setScriptLoaded] = useState(!!getTinymce(window));
	useEffect(() => {
		if (!getTinymce(window)) {
			const script = document.createElement('script');
			script.src = tinymceScriptSrc;
			script.onload = () => {
				setScriptLoaded(true);
			};
			script.onerror = () => {
				console.error('TinyMCE editor could not be loaded');
			};
			document.head.appendChild(script);
		}
		loadAceEditorAssets();
	}, []);
	// endregion

	const [currentLength, setCurrentLength] = useState(0);
	const handleChange: Editor['props']['onEditorChange'] = (newValue, editor) => {
		if (!hasReceivedFocusRef.current) {
			// When the editor initializes, it may trigger a change event with virtually the
			// same content, after it does its internal HTML cleansing. This causes the form to
			// think the content was changed and warn about losing changes if trying to close
			// the form without any user input. We'll ignore this event until the editor
			// has received focus at least once.
			return;
		}
		setCurrentLength(editor.getContent({ format: 'text' }).length);
		setValue(newValue);
	};
	if (!rteConfig || !scriptLoaded) {
		return <FormsEngineField field={field} max={maxLength} length={value.length} children={<ControlSkeleton />} />;
	}
	return (
		<FormsEngineField
			field={field}
			max={maxLength}
			length={currentLength}
			sx={{
				minHeight: 400,
				// FE2 TODO: creating skin stylesheets would be beneficial to customise colours according to our
				//       theme and to include dynamic darkmode support transitioning
				'.tox-tinymce': {
					borderRadius: 1,
					borderWidth: 1,
					borderColor: 'divider'
				},
				'.tox-editor-header': {},
				'.tox .tox-edit-area::before': {
					borderRadius: 0
				},
				'.tox.tox-edit-focus .tox-edit-area::before': {
					borderWidth: 2,
					borderColor: 'primary.main'
				},
				'.tox .tox-statusbar': {
					borderTopColor: 'divider'
				}
			}}
		>
			<Editor
				licenseKey="gpl"
				init={getTinyMceInitOptions(
					field,
					rteConfig,
					locale,
					defaultInitOptions,
					dataSources,
					openDataSourcePicker,
					(editor) => {
						editor.on('OpenWindow', () => {
							setDisableEnforceFocus?.(true);
						});
						editor.on('CloseWindow', () => {
							setDisableEnforceFocus?.(false);
						});
					}
				)}
				tinymceScriptSrc={tinymceScriptSrc}
				onEditorChange={handleChange}
				value={value}
				ref={editorRef}
				onInit={(event, editor) => {
					setCurrentLength(editor.getContent({ format: 'text' }).length);
					editor.once('focus', () => {
						hasReceivedFocusRef.current = true;
					});
				}}
				disabled={readonly}
			/>
			<Dialog open={Boolean(dataSourcePicker)} onClose={() => setDataSourcePicker(null)} fullWidth maxWidth="xs">
				<DialogHeader
					title={<FormattedMessage defaultMessage="Choose how to add media" />}
					onCloseButtonClick={() => setDataSourcePicker(null)}
				/>
				<DialogBody>
					{dataSourcePicker && (
						<MenuList>
							<GroupedDataSourceActionMenuItems
								actions={dataSourcePicker.actions}
								context={dataSourcePicker.context}
								disabled={readonly}
								onResult={(selection) => {
									dataSourcePicker.onResult(selection);
									setDataSourcePicker(null);
								}}
								onError={(error) => {
									console.error('Unable to select rich-text media.', error);
									setDataSourcePicker(null);
								}}
							/>
						</MenuList>
					)}
				</DialogBody>
			</Dialog>
		</FormsEngineField>
	);
}

function ControlSkeleton() {
	return (
		<Box
			sx={{
				borderWidth: 1,
				borderStyle: 'solid',
				borderColor: 'divider',
				borderRadius: 1
			}}
		>
			<Box display="flex" mx={2} my={1} sx={{ gap: 1 }}>
				<Skeleton width={60} />
				<Skeleton width={60} />
				<Skeleton width={60} />
				<Skeleton width={60} />
				<Skeleton width={60} />
			</Box>
			<Box display="flex" mx={2} my={1} sx={{ gap: 1 }}>
				<Skeleton width={24} height={24} variant="circular" />
				<Skeleton width={24} height={24} variant="circular" sx={{ mr: 2 }} />
				<Skeleton width={80} height={24} variant="rounded" sx={{ mr: 2 }} />
				<Skeleton width={24} height={24} variant="circular" />
				<Skeleton width={24} height={24} variant="circular" />
				<Skeleton width={24} height={24} variant="circular" />
			</Box>
			<Divider />
			<Box height={350} />
		</Box>
	);
}

export default RichTextEditor;
