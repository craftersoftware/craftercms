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

package org.craftercms.studio.impl.v2.repository.blob;

import java.util.List;

import org.craftercms.studio.api.v1.constant.GitRepositories;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStore;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStoreResolver;
import org.craftercms.studio.impl.v2.repository.GitContentRepositoryImpl;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class CopyBlobsTest {

	private static final String SITE_ID = "site1";
	private static final String POINTER_PATH = "/static-assets/test.txt.blob";
	private static final String ASSET_PATH = "/static-assets/test.txt";

	@Mock
	private GitContentRepositoryImpl localRepository;

	@Mock
	private StudioBlobStoreResolver blobStoreResolver;

	@Mock
	private StudioBlobStore blobStore;

	@InjectMocks
	private BlobAwareContentRepository repository;

	@Before
	public void setUp() throws Exception {
		repository.setFileExtension("blob");
		when(blobStoreResolver.getAll(SITE_ID)).thenReturn(List.of(blobStore));
		when(blobStoreResolver.getByPaths(SITE_ID, ASSET_PATH)).thenReturn(blobStore);
	}

	@Test
	public void copyBlobsListsPathsAtRevisionAndReadsBytesFromSourceEnvironment() throws Exception {
		when(localRepository.getItemPaths(SITE_ID, GitRepositories.PUBLISHED, "staging")).thenReturn(List.of(POINTER_PATH));

		repository.copyBlobs(SITE_ID, "live", "staging", "staging");

		verify(localRepository).getItemPaths(SITE_ID, GitRepositories.PUBLISHED, "staging");
		verify(blobStore).copyBlobs(blobStore, "live", "staging", List.of(ASSET_PATH));
	}
}
