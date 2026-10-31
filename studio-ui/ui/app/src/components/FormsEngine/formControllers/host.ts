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

/**
 * Public runtime surface for form controllers.
 * Authors do not need it; FE2 loads controllers during form bootstrap.
 * `__internal` holds load/cache helpers for tests and console debugging. It is undocumented and not a contract:
 * it can change or go away without an API version change.
 */
export const formsEngineFormControllersHost = {
	__internal: {
		load: loadFormController,
		getCached: getCachedFormController,
		clearCache: clearFormControllerCache
	}
};
