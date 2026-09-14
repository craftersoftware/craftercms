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

import { dataSourceModuleRegistry, registerDataSourceModule } from '../registry';
import type { DataSourceModule } from '../types';

import components from './components';
import pages from './pages';
import sharedContent from './sharedContent';
import embeddedContent from './embeddedContent';
import fileBrowseRepo from './fileBrowseRepo';
import fileDesktopUpload from './fileDesktopUpload';
import imgRepositoryUpload from './imgRepositoryUpload';
import imgDesktopUpload from './imgDesktopUpload';
import imgS3Repo from './imgS3Repo';
import imgS3Upload from './imgS3Upload';
import imgWebDAVRepo from './imgWebDAVRepo';
import imgWebDAVUpload from './imgWebDAVUpload';
import videoBrowseRepo from './videoBrowseRepo';
import videoDesktopUpload from './videoDesktopUpload';
import videoS3Repo from './videoS3Repo';
import videoS3Upload from './videoS3Upload';
import videoWebDAVRepo from './videoWebDAVRepo';
import videoWebDAVUpload from './videoWebDAVUpload';
import videoS3Transcoding from './videoS3Transcoding';
import audioBrowseRepo from './audioBrowseRepo';
import audioDesktopUpload from './audioDesktopUpload';
import keyValueList from './keyValueList';
import simpleTaxonomy from './simpleTaxonomy';
import configuredList from './configuredList';
import s3Repo from './s3Repo';
import s3Upload from './s3Upload';
import webDavRepo from './webDavRepo';
import webDavUpload from './webDavUpload';
import flashDesktopUpload from './flashDesktopUpload';

export const builtInDataSourceModules: readonly DataSourceModule[] = [
	components,
	pages,
	sharedContent,
	embeddedContent,
	fileBrowseRepo,
	fileDesktopUpload,
	imgRepositoryUpload,
	imgDesktopUpload,
	imgS3Repo,
	imgS3Upload,
	imgWebDAVRepo,
	imgWebDAVUpload,
	videoBrowseRepo,
	videoDesktopUpload,
	videoS3Repo,
	videoS3Upload,
	videoWebDAVRepo,
	videoWebDAVUpload,
	videoS3Transcoding,
	audioBrowseRepo,
	audioDesktopUpload,
	keyValueList,
	simpleTaxonomy,
	configuredList,
	s3Repo,
	s3Upload,
	webDavRepo,
	webDavUpload,
	flashDesktopUpload
];

/**
 * Registers every built-in DataSourceModule. Safe to call more than once —
 * already-registered types are skipped.
 */
export function registerBuiltInDataSourceModules(): void {
	builtInDataSourceModules.forEach((module) => {
		if (dataSourceModuleRegistry.has(module.type)) return;
		try {
			registerDataSourceModule(module);
		} catch (error) {
			// Concurrent import / HMR may race; ignore duplicate registration.
			if (!(error instanceof Error) || !/already registered/i.test(error.message)) {
				throw error;
			}
		}
	});
}

export {
	components,
	pages,
	sharedContent,
	embeddedContent,
	fileBrowseRepo,
	fileDesktopUpload,
	imgRepositoryUpload,
	imgDesktopUpload,
	imgS3Repo,
	imgS3Upload,
	imgWebDAVRepo,
	imgWebDAVUpload,
	videoBrowseRepo,
	videoDesktopUpload,
	videoS3Repo,
	videoS3Upload,
	videoWebDAVRepo,
	videoWebDAVUpload,
	videoS3Transcoding,
	audioBrowseRepo,
	audioDesktopUpload,
	keyValueList,
	simpleTaxonomy,
	configuredList,
	s3Repo,
	s3Upload,
	webDavRepo,
	webDavUpload,
	flashDesktopUpload
};
