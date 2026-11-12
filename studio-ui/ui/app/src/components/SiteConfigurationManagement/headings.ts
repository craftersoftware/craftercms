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

/**
 * Heading elements for the selected configuration file's toolbar.
 *
 * On the Project Tools page the view's own toolbar holds the h1, so the file title is an h2 with its
 * description as an h3. Embedded (in the Preview tools dialog), the dialog title is an h2 under the page
 * h1, so the file title is an h3 and the description is plain text. Neither adds a second h1.
 */
export function getConfigFileHeadings(embedded?: boolean) {
	return embedded
		? ({ titleComponent: 'h3', subtitleComponent: 'p' } as const)
		: ({ titleComponent: 'h2', subtitleComponent: 'h3' } as const);
}
