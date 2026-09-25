/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import React, { useEffect, useRef, useState } from 'react';
import { useMount } from '../../hooks/useMount';
import { useTheme } from '@mui/material/styles';
import { useEnhancedDialogContext } from '../EnhancedDialog/useEnhancedDialogContext';
import MutableRef from '../../models/MutableRef';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';
import { SystemStyleObject } from '@mui/system/styleFunctionSx';
import { Theme } from '@mui/material';

// @see https://github.com/ajaxorg/ace/wiki/Configuring-Ace
export interface AceOptions {
	// - - - - - - - -
	// region editor options
	// - - - - - - - -
	selectionStyle: 'line' | 'text';
	highlightActiveLine: boolean;
	highlightSelectedWord: boolean;
	readOnly: boolean;
	cursorStyle: 'ace' | 'slim' | 'smooth' | 'wide';
	mergeUndoDeltas: false | true | 'always';
	behavioursEnabled: boolean;
	wrapBehavioursEnabled: boolean;
	// this is needed if editor is inside scrollable page
	autoScrollEditorIntoView: boolean; // (defaults to false)
	// copy/cut the full line if selection is empty, defaults to false
	copyWithEmptySelection: boolean;
	useSoftTabs: boolean; // (defaults to false)
	navigateWithinSoftTabs: boolean; // (defaults to false)
	enableMultiselect: boolean; // # on by default
	// endregion
	// - - - - - - - -
	// region renderer options
	// - - - - - - - -
	hScrollBarAlwaysVisible: boolean;
	vScrollBarAlwaysVisible: boolean;
	highlightGutterLine: boolean;
	animatedScroll: boolean;
	showInvisibles: boolean;
	showPrintMargin: boolean;
	printMarginColumn: number; // (defaults to 80)
	// shortcut for showPrintMargin and printMarginColumn
	printMargin: false | number;
	fadeFoldWidgets: boolean;
	showFoldWidgets: boolean; // (defaults to true)
	showLineNumbers: boolean; // (defaults to true)
	showGutter: boolean; // (defaults to true)
	displayIndentGuides: boolean; // (defaults to true)
	fontSize: number | string; // or css font-size string
	fontFamily: string; // css font-family value
	// resize editor based on the contents of the editor until the number of lines reaches maxLines
	maxLines: number;
	minLines: number;
	// number of page sizes to scroll after document end (typical values are 0, 0.5, and 1)
	scrollPastEnd: number | boolean;
	fixedWidthGutter: boolean; // (defaults to false)
	theme: string; // path to a theme e.g "ace/theme/textmate"
	// endregion
	// - - - - - - - -
	// region mouseHandler options
	// - - - - - - - -
	scrollSpeed: number;
	dragDelay: number;
	dragEnabled: boolean; // (defaults to true)
	focusTimout: number;
	tooltipFollowsMouse: boolean;
	// endregion
	// - - - - - - - -
	// region session options
	// - - - - - - - -
	firstLineNumber: number; // defaults to 1
	overwrite: boolean;
	newLineMode: 'auto' | 'unix' | 'windows';
	useWorker: boolean;
	// useSoftTabs: boolean; - declared above in "editor options"
	tabSize: number;
	wrap: boolean | number;
	foldStyle: 'markbegin' | 'markbeginend' | 'manual';
	mode: string; // path to a mode e.g "ace/mode/text"
	// endregion
	// - - - - - - - -
	// region editor options defined by extensions
	// - - - - - - - -
	// following options require ext-language_tools.js
	enableBasicAutocompletion: boolean;
	enableLiveAutocompletion: boolean;
	enableSnippets: boolean;
	// the following option requires ext-emmet.js and the emmet library
	enableEmmet: boolean;
	// the following option requires ext-elastic_tabstops_lite.js
	useElasticTabstops: boolean;
	// endregion
}

export type AceEditorClassKey = 'root' | 'editorRoot';

export interface AceEditorProps extends Partial<AceOptions> {
	value?: any;
	autoFocus?: boolean;
	classes?: Partial<Record<AceEditorClassKey, string>>;
	sxs?: PartialSxRecord<AceEditorClassKey>;
	extensions?: string[];
	onChange?(e: any): void;
	onInit?(editor: AceAjax.Editor): void;
}

declare global {
	interface Window {
		ace: AceAjax.Ace;
	}
}

const aceOptions: Array<keyof AceOptions> = [
	'selectionStyle',
	'highlightActiveLine',
	'highlightSelectedWord',
	'readOnly',
	'cursorStyle',
	'mergeUndoDeltas',
	'behavioursEnabled',
	'wrapBehavioursEnabled',
	'autoScrollEditorIntoView',
	'copyWithEmptySelection',
	'useSoftTabs',
	'navigateWithinSoftTabs',
	'enableMultiselect',
	'hScrollBarAlwaysVisible',
	'vScrollBarAlwaysVisible',
	'highlightGutterLine',
	'animatedScroll',
	'showInvisibles',
	'showPrintMargin',
	'printMarginColumn',
	'printMargin',
	'fadeFoldWidgets',
	'showFoldWidgets',
	'showLineNumbers',
	'showGutter',
	'displayIndentGuides',
	'fontSize',
	'fontFamily',
	'maxLines',
	'minLines',
	'scrollPastEnd',
	'fixedWidthGutter',
	'theme',
	'scrollSpeed',
	'dragDelay',
	'dragEnabled',
	'focusTimout',
	'tooltipFollowsMouse',
	'firstLineNumber',
	'overwrite',
	'newLineMode',
	'useWorker',
	'tabSize',
	'wrap',
	'foldStyle',
	'mode',
	'enableBasicAutocompletion',
	'enableLiveAutocompletion',
	'enableSnippets',
	'enableEmmet',
	'useElasticTabstops'
];

// const aceModes = [];
// const aceThemes = [];

function AceEditorComp(props: AceEditorProps, ref: MutableRef<AceAjax.Editor>) {
	const {
		value = '',
		classes: propClasses,
		autoFocus = false,
		extensions = [],
		onChange,
		onInit,
		sxs,
		...options
	} = props;
	const editorRootClasses = propClasses?.editorRoot;
	const refs = useRef({
		ace: null,
		elem: null,
		pre: null,
		onChange: null,
		options: null
	});
	const [initialized, setInitialized] = useState(false);

	const {
		palette: { mode }
	} = useTheme();

	options.theme = options.theme ?? `ace/theme/${mode === 'light' ? 'chrome' : 'tomorrow_night'}`;

	refs.current.onChange = onChange;
	refs.current.options = options;

	useMount(() => {
		let unmounted = false;
		let initialized = false;
		let aceEditor: AceAjax.Editor;
		let deps = { ace: false, emmet: false, languageTools: false };
		const init = () => {
			deps.ace &&
				deps.emmet &&
				deps.languageTools &&
				// @ts-ignore - Ace types are incorrect; the require function takes a callback
				window.ace.require(['ace/ace', 'ace/ext/language_tools', 'ace/ext/emmet', ...extensions], (ace) => {
					if (!unmounted) {
						const pre = document.createElement('pre');
						pre.className = editorRootClasses;
						refs.current.pre = pre;
						refs.current.elem.appendChild(pre);
						// @ts-ignore - Ace types are incorrect; they don't implement the constructor that receives options.
						aceEditor = ace.edit(pre, refs.current.options);
						aceEditor.setOptions({
							fontSize: '15px',
							fontFamily: "'Monaco', 'Menlo', 'Consolas', 'Source Code Pro', 'source-code-pro', monospace"
						});
						autoFocus && aceEditor.focus();
						if (refs.current.options.readOnly) {
							// This setting of the cursor to not display is unnecessary as the
							// options.readOnly effect takes care of doing so. Nevertheless, this
							// eliminates the delay in hiding the cursor if left up to the effect only.
							// @ts-ignore - $cursorLayer.element typings are missing
							aceEditor.renderer.$cursorLayer.element.style.display = 'none';
						}
						refs.current.ace = aceEditor;
						onInit?.(aceEditor);
						if (ref) {
							typeof ref === 'function' ? ref(aceEditor) : (ref.current = aceEditor);
						}
						setInitialized((initialized = true));
					}
				});
		};
		// TODO: Loading mechanisms very rudimentary. Must research better ways.
		if (!window.ace) {
			const aceScript = document.createElement('script');
			aceScript.src = '/studio/static-assets/libs/ace/ace.js';
			aceScript.onload = () => {
				deps.ace = true;
				// Language tools
				const languageToolsScript = document.createElement('script');
				languageToolsScript.src = '/studio/static-assets/libs/ace/ext-language_tools.js';
				languageToolsScript.onload = () => {
					deps.emmet = true;
					init();
				};
				document.head.appendChild(languageToolsScript);
				// Emmet
				const emmetScript = document.createElement('script');
				emmetScript.src = '/studio/static-assets/libs/ace/ext-emmet.js';
				emmetScript.onload = () => {
					deps.languageTools = true;
					init();
				};
				document.head.appendChild(emmetScript);
			};
			document.head.appendChild(aceScript);
		} else {
			deps.ace = true;
			deps.emmet = true;
			deps.languageTools = true;
			init();
		}
		return () => {
			unmounted = true;
			if (initialized) {
				aceEditor.destroy();
			}
		};
	});

	useEffect(
		() => {
			if (initialized) {
				refs.current.ace.setOptions(options);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			initialized,
			// eslint-disable-next-line react-hooks/exhaustive-deps
			...aceOptions.map((o) => options[o])
		]
	);

	useEffect(() => {
		if (initialized) {
			const editor = refs.current.ace;
			editor.renderer.$cursorLayer.element.style.display = options?.readOnly ? 'none' : '';
		}
	}, [initialized, options?.readOnly]);

	// If the Editor is inside a dialog, resize when fullscreen changes
	const isFullScreen = useEnhancedDialogContext()?.isFullScreen;
	useEffect(() => {
		refs.current.ace?.resize();
	}, [isFullScreen]);

	useEffect(() => {
		if (initialized) {
			const ace = refs.current.ace;
			const onChange = (e) => {
				refs.current.onChange?.(e);
			};
			ace.setValue(value, -1);
			ace.session.getUndoManager().reset();
			ace.getSession().on('change', onChange);
			return () => {
				ace.getSession().off('change', onChange);
			};
		}
	}, [initialized, value]);

	useEffect(() => {
		if (refs.current.pre) {
			refs.current.pre.className = `${[...refs.current.pre.classList]
				.filter((value) => !/craftercms-|makeStyles-/.test(value))
				.join(' ')} ${editorRootClasses}`;
		}
	}, [editorRootClasses]);

	return (
		<Box
			ref={(e) => {
				if (e) {
					refs.current.elem = e;
				}
			}}
			className={props.classes?.root}
			sx={{
				position: 'relative',
				display: 'contents',
				...sxs?.root,
				'& pre': {
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					margin: 0,
					width: '100%',
					height: '100%',
					...(sxs?.editorRoot as SystemStyleObject<Theme>)
				}
			}}
		/>
	);
}

export const AceEditor = React.forwardRef<AceAjax.Editor, AceEditorProps>(AceEditorComp);

export default AceEditor;
