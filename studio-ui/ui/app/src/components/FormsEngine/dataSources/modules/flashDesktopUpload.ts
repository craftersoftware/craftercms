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

import { DATA_SOURCE_API_VERSION, type DataSourceModule } from '../types';
import { createInstanceFromRecord, defineDataSourceModule } from '../defineModule';

/** Dead legacy type retained so unknown-type errors are not thrown for old form-definitions. */
export const flashDesktopUploadDataSourceModule: DataSourceModule = defineDataSourceModule({
	apiVersion: DATA_SOURCE_API_VERSION,
	type: 'flash-desktop-upload',
	interfaces: ['item'],
	capabilities: [],
	create({ record }) {
		return createInstanceFromRecord(record, flashDesktopUploadDataSourceModule, {
			capabilities: [],
			getActions: () => []
		});
	}
});

export default flashDesktopUploadDataSourceModule;
