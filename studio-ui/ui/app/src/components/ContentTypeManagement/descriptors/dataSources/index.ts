/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { LookupTable } from '../../../../models';
import componentsDescriptor from './components';
import pagesDescriptor from './pages';
import audioBrowseRepoDescriptor from './audioBrowseRepo';
import audioDesktopUploadDescriptor from './audioDesktopUpload';
import configuredListDescriptor from './configuredList';
import embeddedContentDescriptor from './embeddedContent';
import fileBrowseRepoDescriptor from './fileBrowseRepo';
import fileDesktopUploadDescriptor from './fileDesktopUpload';
import flashDesktopUploadDescriptor from './flashDesktopUpload';
import imgDesktopUploadDescriptor from './imgDesktopUpload';
import imgRepositoryUploadDescriptor from './imgRepositoryUpload';
import imgS3RepoDescriptor from './imgS3Repo';
import imgS3UploadDescriptor from './imgS3Upload';
import imgWebDavRepoDescriptor from './imgWebDavRepo';
import imgWebdavUploadDescriptor from './imgWebDavUpload';
import keyValueListDescriptor from './keyValueList';
import s3RepoDescriptor from './s3Repo';
import s3UploadDescriptor from './s3Upload';
import sharedContentDescriptor from './sharedContent';
import simpleTaxonomyDescriptor from './simpleTaxonomy';
import videoBrowseRepoDescriptor from './videoBrowseRepo';
import videoDesktopUploadDescriptor from './videoDesktopUpload';
import videoS3RepoDescriptor from './videoS3Repo';
import videoS3TranscodingDescriptor from './videoS3Transcoding';
import videoS3UploadDescriptor from './videoS3Upload';
import videoWebDavRepoDescriptor from './videoWebDavRepo';
import videoWebDavUploadDescriptor from './videoWebDavUpload';
import webDavRepoDescriptor from './webDavRepo';
import webDavUploadDescriptor from './webDavUpload';
import { DescriptorContentType, DescriptorField } from '../../utils';
import { defineMessage } from 'react-intl';

export const commonDataSourceDescriptors: LookupTable<DescriptorField> = {
	title: {
		id: 'title',
		type: 'string',
		name: defineMessage({ defaultMessage: 'Title' }),
		defaultValue: undefined,
		validations: {
			required: { id: 'required', level: 'required', value: true }
		}
	},
	id: {
		id: 'id',
		type: 'variable',
		name: defineMessage({ id: 'words.id', defaultMessage: 'Id' }),
		defaultValue: undefined,
		validations: {
			required: { id: 'required', level: 'required', value: true }
		}
	}
};

export type BuiltInDataSourceType =
	| 'components'
	| 'pages'
	| 'audio-browse-repo'
	| 'audio-desktop-upload'
	| 'configured-list'
	| 'embedded-content'
	| 'file-browse-repo'
	| 'file-desktop-upload'
	| 'flash-desktop-upload'
	| 'img-desktop-upload'
	| 'img-repository-upload'
	| 'img-S3-repo'
	| 'img-S3-upload'
	| 'img-WebDAV-repo'
	| 'img-WebDAV-upload'
	| 'key-value-list'
	| 'S3-repo'
	| 'S3-upload'
	| 'shared-content'
	| 'simpleTaxonomy'
	| 'video-browse-repo'
	| 'video-desktop-upload'
	| 'video-S3-repo'
	| 'video-S3-transcoding'
	| 'video-S3-upload'
	| 'video-WebDAV-repo'
	| 'video-WebDAV-upload'
	| 'WebDAV-repo'
	| 'WebDAV-upload';

export const dataSourceDescriptors: Record<BuiltInDataSourceType, DescriptorContentType> = {
	components: componentsDescriptor,
	pages: pagesDescriptor,
	'audio-browse-repo': audioBrowseRepoDescriptor,
	'audio-desktop-upload': audioDesktopUploadDescriptor,
	'configured-list': configuredListDescriptor,
	'embedded-content': embeddedContentDescriptor,
	'file-browse-repo': fileBrowseRepoDescriptor,
	'file-desktop-upload': fileDesktopUploadDescriptor,
	'flash-desktop-upload': flashDesktopUploadDescriptor,
	'img-desktop-upload': imgDesktopUploadDescriptor,
	'img-repository-upload': imgRepositoryUploadDescriptor,
	'img-S3-repo': imgS3RepoDescriptor,
	'img-S3-upload': imgS3UploadDescriptor,
	'img-WebDAV-repo': imgWebDavRepoDescriptor,
	'img-WebDAV-upload': imgWebdavUploadDescriptor,
	'key-value-list': keyValueListDescriptor,
	'S3-repo': s3RepoDescriptor,
	'S3-upload': s3UploadDescriptor,
	'shared-content': sharedContentDescriptor,
	simpleTaxonomy: simpleTaxonomyDescriptor,
	'video-browse-repo': videoBrowseRepoDescriptor,
	'video-desktop-upload': videoDesktopUploadDescriptor,
	'video-S3-repo': videoS3RepoDescriptor,
	'video-S3-transcoding': videoS3TranscodingDescriptor,
	'video-S3-upload': videoS3UploadDescriptor,
	'video-WebDAV-repo': videoWebDavRepoDescriptor,
	'video-WebDAV-upload': videoWebDavUploadDescriptor,
	'WebDAV-repo': webDavRepoDescriptor,
	'WebDAV-upload': webDavUploadDescriptor
};

export default dataSourceDescriptors;
