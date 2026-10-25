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

/** 400% zoom on a 1280px window. WCAG 2.2 SC 1.4.10 reflow width. */
export const PREVIEW_REFLOW_NARROW_QUERY = '@media (max-width: 320px)';

/**
 * At 320px wide the wrapped toolbar is about 190px tall. Pinning it on a 256px tall viewport (400% zoom of
 * a 1280x1024 window) would leave almost no room for the page, so it only sticks on taller viewports.
 */
export const PREVIEW_REFLOW_STICKY_QUERY = '@media (max-width: 320px) and (min-height: 600px)';

/**
 * The toolbar already runs out of room before 320px: logo, two overflow bars, three navigation buttons and
 * the address field no longer fit on one line below roughly 480px, so it wraps from there.
 */
export const PREVIEW_TOOLBAR_WRAP_QUERY = '@media (max-width: 480px)';
