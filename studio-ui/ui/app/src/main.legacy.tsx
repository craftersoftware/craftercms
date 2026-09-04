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

import { registerComponents } from './env/registerComponents';
import { createCodebaseBridge } from './env/codebase-bridge';
import { publishCrafterGlobal } from './env/craftercms';
import { setRequestForgeryToken } from './utils/auth';
import { applyUiBootstrapSideEffects, fetchUiBootstrap } from './services/environment';

const eventCodebaseBridgeReady = new Event('CrafterCMS.CodebaseBridgeReady');
fetchUiBootstrap().subscribe({
	next: (bootstrap) => {
		applyUiBootstrapSideEffects(bootstrap);
		publishCrafterGlobal();
		registerComponents();
		createCodebaseBridge();
		document.dispatchEvent(eventCodebaseBridgeReady);
	},
	error: () => {
		setRequestForgeryToken();
		publishCrafterGlobal();
		registerComponents();
		createCodebaseBridge();
		document.dispatchEvent(eventCodebaseBridgeReady);
	}
});
