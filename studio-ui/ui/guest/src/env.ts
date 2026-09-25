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

// `ace` and `node` only contribute global types (AceAjax, process), so nothing imports them.
// TypeScript 7 doesn't auto-include `@types` packages hoisted to the workspace root, so reference them explicitly.
/// <reference types="ace" />
/// <reference types="node" />

import React from 'react';
import { TinyMCE } from 'tinymce';

declare global {
	interface Window {
		tinymce: TinyMCE;
		ace: AceAjax.Ace;
	}
	type CrafterCMSCustomElementProps = React.DetailedHTMLProps<
		Omit<React.HTMLAttributes<HTMLDivElement>, 'className'> & { class?: string },
		HTMLDivElement
	>;
	namespace JSX {
		interface IntrinsicElements {
			'craftercms-zone-marker': CrafterCMSCustomElementProps;
			'craftercms-asset-uploader-mask-container': CrafterCMSCustomElementProps;
			'craftercms-asset-uploader-mask': CrafterCMSCustomElementProps;
			'craftercms-field-instance-switcher': CrafterCMSCustomElementProps;
		}
	}
}
