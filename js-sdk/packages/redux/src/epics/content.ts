/*
 * Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import { Observable, of } from 'rxjs';
import { AnyAction } from 'redux';
import { mergeMap, map, catchError } from 'rxjs/operators';
import { ofType } from 'redux-observable';

import { ContentStoreService, NavigationService } from '@craftercms/content';
import {
	getItem,
	getItemComplete,
	getChildren,
	getChildrenComplete,
	getTree,
	getTreeComplete,
	getNavComplete,
	getNavBreadcrumbComplete
} from '../actions/content';
import { Item, NavigationItem } from '@craftercms/models';
import { internal_getNav, internal_getNavBreadcrumb } from '../actions/content_internal';

export const getItemEpic = (action$: Observable<AnyAction>) =>
	action$.pipe(
		ofType(getItem.type),
		mergeMap(({ payload }) =>
			ContentStoreService.getItem(payload.url, payload.config).pipe(
				map((item: Item) =>
					getItemComplete({
						item,
						url: payload.url
					})
				),
				catchError(() =>
					of(
						getItemComplete({
							url: payload.url
						})
					)
				)
			)
		)
	);

export const getChildrenEpic = (action$: Observable<AnyAction>) =>
	action$.pipe(
		ofType(getChildren.type),
		mergeMap(({ payload }) =>
			ContentStoreService.getChildren(payload).pipe(
				map((children: Item[]) =>
					getChildrenComplete({
						children,
						url: payload
					})
				),
				catchError(() =>
					of(
						getChildrenComplete({
							url: payload
						})
					)
				)
			)
		)
	);

export const getTreeEpic = (action$: Observable<AnyAction>) =>
	action$.pipe(
		ofType(getTree.type),
		mergeMap(({ payload }) =>
			ContentStoreService.getTree(payload.url, payload.depth).pipe(
				map((tree: Item) =>
					getTreeComplete({
						tree,
						url: payload.url
					})
				),
				catchError(() =>
					of(
						getTreeComplete({
							url: payload.url
						})
					)
				)
			)
		)
	);

export const getNavEpic = (action$: Observable<AnyAction>) =>
	action$.pipe(
		ofType(internal_getNav.type),
		mergeMap(({ payload }) =>
			NavigationService.getNavTree(payload.url, payload.depth, payload.currentPageUrl).pipe(
				map((nav: NavigationItem) =>
					getNavComplete({
						nav,
						url: payload.url
					})
				),
				catchError(() =>
					of(
						getNavComplete({
							url: payload.url
						})
					)
				)
			)
		)
	);

export const getNavBreadcrumbEpic = (action$: Observable<AnyAction>) =>
	action$.pipe(
		ofType(internal_getNavBreadcrumb.type),
		mergeMap(({ payload }) =>
			NavigationService.getNavBreadcrumb(payload.url, payload.root).pipe(
				map((breadcrumb: NavigationItem[]) =>
					getNavBreadcrumbComplete({
						breadcrumb,
						url: payload.url
					})
				),
				catchError(() =>
					of(
						getNavBreadcrumbComplete({
							url: payload.url
						})
					)
				)
			)
		)
	);

export const allContentEpics = [getItemEpic, getChildrenEpic, getTreeEpic, getNavEpic, getNavBreadcrumbEpic];
