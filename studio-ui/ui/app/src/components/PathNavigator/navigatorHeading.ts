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

import { createContext, useContext } from 'react';

/** Heading element for a path navigator title. h2 sits under the page h1. */
export type NavigatorTitleComponent = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/**
 * Set by a parent whose own title is already an h2 (a tools-panel page, a widgets accordion),
 * so a navigator rendered inside it is a subsection rather than a peer.
 */
export const NavigatorTitleComponentContext = createContext<NavigatorTitleComponent | undefined>(undefined);

/** An explicit prop wins, then the parent context, then h2. */
export function useNavigatorTitleComponent(titleComponent?: NavigatorTitleComponent): NavigatorTitleComponent {
	const fromContext = useContext(NavigatorTitleComponentContext);
	return titleComponent ?? fromContext ?? 'h2';
}

const levels: NavigatorTitleComponent[] = ['h2', 'h3', 'h4', 'h5', 'h6'];

/**
 * The heading one level below a navigator title, for content that has its own title inside the navigator
 * (an error state). It stops at h6, the last level HTML has.
 */
export function getNestedHeadingComponent(titleComponent: NavigatorTitleComponent): NavigatorTitleComponent {
	return levels[Math.min(levels.indexOf(titleComponent) + 1, levels.length - 1)];
}
