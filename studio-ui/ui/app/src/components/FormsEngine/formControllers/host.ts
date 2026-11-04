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

import { clearFormControllerCache, getCachedFormController, loadFormController } from './loader';
import { FORM_CONTROLLER_API_VERSION } from './types';

/**
 * Public runtime surface for form controllers.
 * `apiVersion` is the contract integer (`FORM_CONTROLLER_API_VERSION`).
 * Authors do not need the rest; FE2 loads controllers during form bootstrap.
 * `__internal` holds load/cache helpers for tests and console debugging. It is undocumented and not a contract:
 * it can change or go away without an API version change.
 */
export const formsEngineFormControllersHost = Object.freeze({
	apiVersion: FORM_CONTROLLER_API_VERSION,
	__internal: Object.freeze({
		load: loadFormController,
		getCached: getCachedFormController,
		clearCache: clearFormControllerCache
	})
});
