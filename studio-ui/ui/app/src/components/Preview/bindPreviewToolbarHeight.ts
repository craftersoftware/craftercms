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

import { PREVIEW_TOOLBAR_HEIGHT_PROPERTY, previewToolbarHeightCss } from './previewReflow';

/**
 * Publish the toolbar's border-box height on its parent (the preview shell) so drawers can offset by it.
 * ResizeObserver supplies the size, so later updates do not read layout themselves.
 */
export function bindPreviewToolbarHeight(toolbar: HTMLElement): () => void {
	const host = toolbar.parentElement;
	if (!host) {
		return () => undefined;
	}
	const publish = (height: number) => {
		const next = previewToolbarHeightCss(height);
		if (next && host.style.getPropertyValue(PREVIEW_TOOLBAR_HEIGHT_PROPERTY) !== next) {
			host.style.setProperty(PREVIEW_TOOLBAR_HEIGHT_PROPERTY, next);
		}
	};
	publish(toolbar.offsetHeight);
	const observer = new ResizeObserver((entries) => {
		const entry = entries[entries.length - 1];
		const blockSize = entry?.borderBoxSize?.[0]?.blockSize;
		publish(blockSize || entry?.contentRect.height || 0);
	});
	observer.observe(toolbar);
	return () => {
		observer.disconnect();
		host.style.removeProperty(PREVIEW_TOOLBAR_HEIGHT_PROPERTY);
	};
}
