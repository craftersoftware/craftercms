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

import { get, post, postJSON } from '../utils/ajax';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FileDiff, Remote, Repository, RepositoryStatus } from '../models/Repository';

const repositoryEndpointUrl = '/studio/api/2/repository';

export function fetchRepositories(siteId: string): Observable<Repository[]> {
	return get(`${repositoryEndpointUrl}/${siteId}/list_remotes`).pipe(
		map((response) => response?.response?.remotes)
	);
}

export function addRemote({ siteId, ...remote }: Remote): Observable<true> {
	return postJSON(`${repositoryEndpointUrl}/${siteId}/add_remote`, remote).pipe(map(() => true));
}

export function deleteRemote(siteId: string, remoteName: string): Observable<true> {
	return postJSON(`${repositoryEndpointUrl}/${siteId}/remove_remote`, { remoteName }).pipe(map(() => true));
}

export interface PullResponse {
	commitsMerged: number;
	mergeCommitId: string;
}

export function pull({ siteId, ...remote }: Partial<Remote>): Observable<PullResponse> {
	return postJSON(`${repositoryEndpointUrl}/${siteId}/pull_from_remote`, remote).pipe(
		map((response) => response?.response?.result)
	);
}

export function push(siteId: string, remoteName: string, remoteBranch: string, force: boolean): Observable<true> {
	return postJSON(`${repositoryEndpointUrl}/${siteId}/push_to_remote`, { remoteName, remoteBranch, force }).pipe(
		map(() => true)
	);
}

export function fetchStatus(siteId: string): Observable<RepositoryStatus> {
	return get(`${repositoryEndpointUrl}/${siteId}/status`).pipe(
		map((response) => response?.response?.repositoryStatus)
	);
}

export function resolveConflict(siteId: string, path: string, resolution: string): Observable<RepositoryStatus> {
	return postJSON(`${repositoryEndpointUrl}/${siteId}/resolve_conflict`, { path, resolution }).pipe(
		map((response) => response?.response?.repositoryStatus)
	);
}

export function bulkResolveConflict(siteId: string, paths: string[], resolution: string): Observable<RepositoryStatus> {
	// Return only the status where there are no more conflicts
	return forkJoin(paths.map((path) => resolveConflict(siteId, path, resolution))).pipe(
		map((statuses) => statuses.filter((status) => status.conflicting.length === 0)[0])
	);
}

export function diffConflictedFile(siteId: string, path: string): Observable<FileDiff> {
	return get(`${repositoryEndpointUrl}/${siteId}/diff_conflicted_file?path=${path}`).pipe(
		map((response) => response?.response?.diff)
	);
}

export function commitResolution(siteId: string, commitMessage: string): Observable<RepositoryStatus> {
	return postJSON(`${repositoryEndpointUrl}/${siteId}/commit_resolution`, { commitMessage }).pipe(
		map((response) => response?.response?.repositoryStatus)
	);
}

export function cancelFailedPull(siteId: string): Observable<RepositoryStatus> {
	return post(`${repositoryEndpointUrl}/${siteId}/cancel_failed_pull`).pipe(
		map((response) => response?.response?.repositoryStatus)
	);
}
