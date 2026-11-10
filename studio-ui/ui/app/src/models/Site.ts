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

import { MarketplacePlugin } from './MarketplacePlugin';
import { ReactNode } from 'react';

interface View {
	title: ReactNode;
	subtitle?: ReactNode;
	btnText?: ReactNode;
}

export interface Views {
	[key: number]: View;
}

export interface SiteBaseState {
	siteId: string;
	siteName: string;
	siteIdExist: boolean;
	siteNameExist: boolean;
	invalidSiteId: boolean;
	description: string;
	submitted: boolean;
	selectedView: number;
	gitBranch: string;
	singleBranch: boolean;
	enableStaging: boolean;
}

export interface SiteState extends SiteBaseState {
	blueprint: MarketplacePlugin;
	useRemote: boolean;
	createAsOrphan: boolean;
	repoUrl: string;
	repoAuthentication: 'none' | 'basic' | 'token' | 'private_key';
	repoRemoteBranch: string;
	sandboxBranch: string;
	repoRemoteName: string;
	repoPassword: string;
	repoUsername: string;
	repoToken: string;
	repoKey: string;
	details: { blueprint: MarketplacePlugin; index: number };
	blueprintFields?: {
		[key: string]: string;
	};
	expanded: {
		basic: boolean;
		token: boolean;
		private_key: boolean;
	};
	showIncompatible: boolean;

	[key: string]: string | boolean | MarketplacePlugin | number | object;
}

export interface DuplicateSiteState extends SiteBaseState {
	sourceSiteId: string;
	readOnlyBlobStores?: boolean;
}

export interface CreateSiteMeta {
	siteId: string;
	name?: string;
	description?: string;
	singleBranch?: boolean;
	blueprintId?: string;
	remoteUrl?: string;
	remoteName?: string;
	remoteBranch?: string;
	sandboxBranch?: string;
	siteParams?: {
		[key: string]: string;
	};
	createAsOrphan: boolean;
	enableStaging?: boolean;
	sourceType: 'blueprint' | 'remote';
	authentication: {
		type: SiteState['repoAuthentication'];
		username?: string;
		password?: string;
		token?: string;
		privateKey?: string;
	};
}

export interface DuplicateSiteMeta extends Pick<
	CreateSiteMeta,
	'siteId' | 'description' | 'sandboxBranch' | 'enableStaging'
> {
	siteName: string;
	sourceSiteId: string;
}

export interface MarketplaceSite {
	siteId: string;
	name?: string;
	blueprintId: string;
	blueprintVersion: {
		major: number;
		minor: number;
		patch: number;
	};
	siteParams?: {
		[key: string]: string;
	};
	sandboxBranch?: string;
	description: string;
	enableStaging?: boolean;
}

export interface Site {
	id: string;
	uuid: string;
	name: string;
	description: string;
	state?: 'INITIALIZING' | 'READY' | 'DELETING' | 'DELETED';
	stagingEnabled?: boolean;
}

export interface BackendSite {
	siteId: string;
	uuid: string;
	name: string;
	desc: string;
	state: 'INITIALIZING' | 'READY' | 'DELETING' | 'DELETED';
	stagingEnabled?: boolean;
}

export interface DetailedSite {
	siteId: string;
	siteUuid: string;
	name: string;
	description: string;
	liveUrl: string;
	lastCommitId: string;
	publishingEnabled: boolean;
	publishingStatus: string;
	sandboxBranch: string;
	publishedRepoCreated: boolean;
	stagingEnabled: boolean;
	state: 'INITIALIZING' | 'READY' | 'DELETING' | 'DELETED';
	blobStores: {
		id: string;
		readOnly: boolean;
	}[];
}

export interface Action {
	type: 'CREATE' | 'RENAME' | 'MOVE' | 'COPY';
	source?: string;
	target: string;
	recursive?: boolean;
	contentMetadata?: {
		fileSize?: number;
		contentType?: string;
	};
}

export interface ContentValidationResult {
	type: string;
	target: string;
	allowed: boolean;
	modifiedValue: string;
	message: string;
}
