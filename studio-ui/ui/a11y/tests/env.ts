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

export const username = process.env.STUDIO_USERNAME ?? 'admin';
export const password = process.env.STUDIO_PASSWORD ?? 'admin';
/** Project (site) id used for every project-scoped screen. Must already exist (e.g. created from the Website Editorial blueprint). */
export const project = process.env.STUDIO_PROJECT ?? 'editorial';
/** Preview URL path of a page the user is allowed to edit and publish. */
export const previewPage = process.env.STUDIO_PREVIEW_PAGE ?? '/';
