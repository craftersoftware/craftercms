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

import { PREVIEW_URL_PATH } from './constants';
import { ReplaySubject } from 'rxjs';
import { take } from 'rxjs/operators';
import Monaco from '../models/Monaco';
import { ProjectToolsRoutes } from '../env/routes';
import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import { pushDialog } from '../state/actions/dialogStack';
import type { FormsEngineProps } from '../components/FormsEngine/FormsEngine';
import { getHostToGuestBus } from './subjects';
import { reloadRequest } from '../state/actions/preview';
import { Context, useContext } from 'react';
import type { LegacyFormDialogProps } from '../components/LegacyFormDialog/utils';
import { nanoid } from 'nanoid';
import { DialogStackItem } from '../models';
import type { ConfirmDialogProps } from '../components/ConfirmDialog';
import type { ErrorDialogProps } from '../components/ErrorDialog';
import { getPathFromPreviewURL, getPreviewURLFromPath, isPagePath } from './path';

export type SystemLinkId =
	| 'preview'
	| 'siteTools'
	| 'siteSearch'
	| 'siteDashboard'
	| 'siteToolsDialog'
	| 'siteSearchDialog'
	| 'siteDashboardDialog';

export function getSystemLink({
	systemLinkId,
	authoringBase,
	site,
	page = '/'
}: {
	systemLinkId: SystemLinkId;
	authoringBase: string;
	site: string;
	page?: string;
}) {
	return {
		preview: `${authoringBase}${PREVIEW_URL_PATH}#/?page=${encodeURIComponent(page)}&site=${site}`,
		siteTools: `${authoringBase}${ProjectToolsRoutes.ProjectTools}`,
		siteSearch: `${authoringBase}${ProjectToolsRoutes.Search}`,
		siteDashboard: `${authoringBase}${ProjectToolsRoutes.SiteDashboard}`
	}[systemLinkId];
}

export function copyToClipboard(textToCopy: string): Promise<void> {
	// Clipboard is only available on user-initiated callbacks over non-secure contexts (e.g. not https).
	return (
		navigator.clipboard?.writeText(textToCopy) ??
		new Promise((resolve, reject) =>
			reject('Copying to clipboard is only available in secure contexts or user-initiated callbacks.')
		)
	);
}

let monaco$: ReplaySubject<Monaco>;
export function withMonaco(onReady: (api: Monaco) => void): void {
	if (!monaco$) {
		monaco$ = new ReplaySubject(1);
		const script = document.createElement('script');
		script.src = '/studio/static-assets/libs/monaco/monaco.0.54.0.js';
		script.onload = () => {
			// @ts-ignore
			monaco$.next(window.monaco);
		};
		script.onerror = () => {
			console.error('Monaco editor could not be loaded');
		};
		document.head.appendChild(script);
	}
	monaco$.asObservable().pipe(take(1)).subscribe(onReady);
}

export function isPreviewAppUrl(pathname = window.location.pathname): boolean {
	return pathname.includes(`/preview`);
}

export function isDashboardAppUrl(pathname = window.location.pathname): boolean {
	return pathname.includes(ProjectToolsRoutes.SiteDashboard);
}

export function isProjectToolsAppUrl(pathname = window.location.pathname): boolean {
	return pathname.includes(ProjectToolsRoutes.ProjectTools);
}

export function consolidateSx(...sxs: SxProps<Theme>[]): SxProps<Theme> {
	return sxs.flatMap((item) => item ?? []);
}

export function pickShowContentFormAction(oldProps: LegacyFormDialogProps) {
	const useLegacy = window.localStorage.getItem('useLegacyFormEngine') === 'true';
	const dialogId = nanoid();
	return useLegacy
		? pushDialog({
				id: dialogId,
				component: createComponentId('LegacyFormDialog'),
				allowFullScreen: true,
				allowMinimize: true,
				props: { ...oldProps, dialogId }
			})
		: pushDialog({
				component: createComponentId('FormsEngineDialog'),
				allowFullScreen: true,
				allowMinimize: true,
				props: {
					formProps: {
						...(oldProps.isNewContent
							? { create: { path: oldProps.path, contentTypeId: oldProps.contentTypeId } }
							: { update: { path: oldProps.path, changeTypeId: oldProps.changeTemplate } }),
						readonly: oldProps.readonly ?? false,
						fieldToScroll: oldProps.selectedFields?.[0] ?? undefined,
						onSave(result) {
							if (isPreviewAppUrl()) {
								const params = new URLSearchParams(window.location.hash.replace(/^#\/?\?/, ''));
								const previewURL = params.get('page');
								if (
									previewURL &&
									result.path &&
									isPagePath(oldProps.path) &&
									getPathFromPreviewURL(previewURL) === oldProps.path &&
									oldProps.path !== result.path
								) {
									// oldProps.path is a page and the same as the preview page path, but the new path is different,
									// which means there was a rename of the page currently being previewed. Then we need to update the
									// preview URL to reflect the new page path.
									window.location.href = getSystemLink({
										page: getPreviewURLFromPath(result.path),
										systemLinkId: 'preview',
										site: oldProps.site,
										authoringBase: oldProps.authoringBase
									});
								} else {
									getHostToGuestBus().next(reloadRequest());
								}
							}
							// FE2 TODO: handling oldProps.onSaveSuccess required?
						}
					} as FormsEngineProps
				}
			});
}

export function createUseContextHook<T>(name: string, context: Context<T>): () => T;
export function createUseContextHook<T, K extends keyof T>(
	name: string,
	context: Context<T>,
	selector: (instance: T) => T[K]
): () => T[K];
export function createUseContextHook<T, K extends keyof T>(
	name: string,
	context: Context<T>,
	selector?: (instance: T) => T[K]
): () => T | T[K] {
	const contextName = context.displayName ?? name.replace('use', '');
	return () => {
		const instance = useContext(context);
		if (instance === undefined) {
			throw new Error(`${name} must be used within a ${contextName}`);
		}
		return selector?.(instance) ?? instance;
	};
}

export function createComponentId(componentName: string) {
	return `craftercms.components.${componentName}`;
}

type confirmDialogStackItemProps = Partial<DialogStackItem<Partial<ConfirmDialogProps>>>;
export function pushConfirmDialog(props: Omit<confirmDialogStackItemProps, 'component'>) {
	return pushDialog({
		component: createComponentId('ConfirmDialog'),
		...props
	});
}

type errorDialogStackItemProps = Partial<DialogStackItem<Partial<ErrorDialogProps>>>;
export function pushErrorDialog(props: Omit<errorDialogStackItemProps, 'component'>) {
	return pushDialog({
		component: createComponentId('ErrorDialog'),
		...props
	});
}

let aceAssetsLoadStarted = false;
export function loadAceEditorAssets() {
	const aceScriptSrc = '/studio/static-assets/libs/ace/ace.js';
	const aceCssHref = '/studio/static-assets/styles/tinymce-ace.css';
	const hasAceScript = Boolean(document.querySelector(`script[src="${aceScriptSrc}"]`));
	if (!window.ace && !aceAssetsLoadStarted && !hasAceScript) {
		aceAssetsLoadStarted = true;
		const script = document.createElement('script');
		script.src = aceScriptSrc;
		script.onload = () => {
			aceAssetsLoadStarted = false;
		};
		script.onerror = () => {
			aceAssetsLoadStarted = false;
		};
		document.head.appendChild(script);
	}
	const hasAceCss = Boolean(document.querySelector(`link[rel="stylesheet"][href="${aceCssHref}"]`));
	if (!hasAceCss) {
		const styleSheet = document.createElement('link');
		styleSheet.rel = 'stylesheet';
		styleSheet.href = aceCssHref;
		document.head.appendChild(styleSheet);
	}
}
