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
package org.craftercms.engine.store.s3;

import org.craftercms.core.exception.StoreException;
import org.craftercms.core.store.ContentStoreIndex;
import org.craftercms.core.store.ContentStoreManifest;
import org.craftercms.core.store.impl.File;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Uri;
import software.amazon.awssdk.services.s3.S3Utilities;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.GZIPOutputStream;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests that a loaded content store manifest answers folder lookups without listing S3.
 */
@RunWith(MockitoJUnitRunner.class)
public class S3ContentStoreAdapterManifestTest {

	@Mock
	private S3Client client;

	private S3ContentStoreAdapter adapter;
	private S3Context context;

	@Before
	public void setUp() throws Exception {
		adapter = new S3ContentStoreAdapter(null, ".xml", ".meta.xml", null, null, 1024, new String[0]);
		adapter.client = client;

		S3Utilities utilities = S3Utilities.builder().region(Region.US_EAST_1).build();
		S3Uri uri = utilities.parseUri(URI.create("s3://test-bucket/sites/acme"));
		context = new S3Context("id", adapter, "s3://test-bucket/sites/acme", false, true, 1000,
			true, uri, null);
	}

	@Test
	public void testToS3KeyJoinsRootAndStorePathWhenSuffixMatches() {
		assertEquals("sites/acme", context.getKey());
		assertEquals("sites/acme/acme", adapter.toS3Key(context, "/acme"));
	}

	@Test
	public void testManifestAnswersFolderAndChildrenWithoutListing() {
		context.setContentStoreIndex(ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of(
			"/site/website/index.xml",
			"/site/website/crafter-level-descriptor.level.xml",
			"/site/website/products/index.xml",
			"/site/website/.hidden.txt"
		))));

		File folder = adapter.doFindFile(context, "/site/website");
		File missing = adapter.doFindFile(context, "/site/missing");
		List<File> children = adapter.doGetChildren(context, folder);

		assertNotNull(folder);
		assertTrue(folder.isDirectory());
		assertNull(missing);
		assertEquals(List.of("crafter-level-descriptor.level.xml", "index.xml", "products"),
			children.stream().map(File::getName).toList());
		assertTrue(adapter.validate(context));
		verify(client, never()).listObjectsV2(any(ListObjectsV2Request.class));
		verify(client, never()).listObjectsV2Paginator(any(ListObjectsV2Request.class));
	}

	@Test
	public void testManifestMissDoesNotList() {
		context.setContentStoreIndex(ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml"))));
		when(client.getObject(any(GetObjectRequest.class))).thenThrow(NoSuchKeyException.builder().message("missing").build());

		assertNull(adapter.doFindFile(context, "/site/website/index.xml"));
		verify(client, never()).listObjectsV2(any(ListObjectsV2Request.class));
	}

	@Test
	public void testDeploymentEventsFileIsReadFromS3WhenMissingFromIndex() {
		context.setContentStoreIndex(ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml"))));
		when(client.getObject(any(GetObjectRequest.class))).thenThrow(NoSuchKeyException.builder().message("missing").build());

		assertNull(adapter.doFindFile(context, "/deployment-events.properties"));

		verify(client).getObject(argThat((GetObjectRequest request) ->
			"test-bucket".equals(request.bucket()) && "sites/acme/deployment-events.properties".equals(request.key())));
		verify(client, never()).listObjectsV2(any(ListObjectsV2Request.class));
	}

	@Test
	public void testConfiguredDeploymentEventsFileIsReadFromS3() {
		adapter.setDeploymentEventsFileUrl("signals/events.properties");
		context.setContentStoreIndex(ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml"))));
		when(client.getObject(any(GetObjectRequest.class))).thenThrow(NoSuchKeyException.builder().message("missing").build());

		assertNull(adapter.doFindFile(context, "/other.properties"));
		verify(client, never()).getObject(any(GetObjectRequest.class));

		assertNull(adapter.doFindFile(context, "/signals/events.properties"));
		verify(client).getObject(argThat((GetObjectRequest request) ->
			"sites/acme/signals/events.properties".equals(request.key())));
	}

	@Test
	public void testMissingManifestFallsBackToList() {
		when(client.getObject(any(GetObjectRequest.class))).thenThrow(NoSuchKeyException.builder().message("missing").build());
		when(client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
			.contents(software.amazon.awssdk.services.s3.model.S3Object.builder().key("sites/acme/site/").build())
			.build());

		adapter.reloadContentStoreManifest(context);
		File folder = adapter.doFindFile(context, "/site");

		assertNotNull(folder);
		assertTrue(folder.isDirectory());
		verify(client).listObjectsV2(any(ListObjectsV2Request.class));
	}

	@Test
	public void testManifestLoadFailureClearsIndexAndRethrows() {
		context.setContentStoreIndex(ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml"))),
			"\"manifest-1\"");
		when(client.getObject(any(GetObjectRequest.class)))
			.thenThrow(S3Exception.builder().statusCode(500).message("unavailable").build());
		when(client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
			.contents(software.amazon.awssdk.services.s3.model.S3Object.builder().key("sites/acme/site/").build())
			.build());

		try {
			adapter.reloadContentStoreManifest(context);
			fail("Expected StoreException");
		} catch (StoreException expected) {
			assertNull(context.getContentStoreIndex());
			assertNull(context.getContentStoreManifestETag());
			assertTrue(context.isContentStoreIndexResolved());
			assertTrue(context.isContentStoreManifestLoadFailed());
			assertTrue(S3ContentStoreAdapter.isContentStoreManifestLoadFailed(context));
		}

		File folder = adapter.doFindFile(context, "/site");
		assertNotNull(folder);
		assertTrue(folder.isDirectory());
		verify(client).listObjectsV2(any(ListObjectsV2Request.class));

		when(client.getObject(any(GetObjectRequest.class))).thenThrow(NoSuchKeyException.builder().message("missing").build());
		adapter.reloadContentStoreManifest(context);
		assertNull(context.getContentStoreIndex());
		assertFalse(context.isContentStoreManifestLoadFailed());
	}

	@Test
	public void testCreateContextFallsBackWhenManifestGetIsForbidden() {
		when(client.getObject(any(GetObjectRequest.class)))
			.thenThrow(S3Exception.builder().statusCode(403).message("denied").build());

		assertCreateContextListsS3();
	}

	@Test
	public void testCreateContextFallsBackWhenManifestGetFails() {
		when(client.getObject(any(GetObjectRequest.class)))
			.thenThrow(S3Exception.builder().statusCode(500).message("unavailable").build());

		assertCreateContextListsS3();
	}

	@Test
	public void testCreateContextFallsBackWhenManifestGzipIsCorrupt() {
		when(client.getObject(any(GetObjectRequest.class)))
			.thenReturn(objectWithBytes(new byte[] {1, 2, 3, 4}));

		assertCreateContextListsS3();
	}

	@Test
	public void testCreateContextIgnoresUnknownManifestProperties() throws Exception {
		String json = "{\"schemaVersion\":2,\"files\":[{\"path\":\"/site/website/index.xml\",\"type\":\"file\",\"size\":12}]}";
		when(client.utilities()).thenReturn(S3Utilities.builder().region(Region.US_EAST_1).build());
		when(client.getObject(any(GetObjectRequest.class))).thenReturn(objectWithBytes(gzip(json)));

		S3Context created = createSiteContext();

		assertNotNull(created.getContentStoreIndex());
		assertEquals(ContentStoreIndex.TYPE_FILE, created.getContentStoreIndex().typeOf("/site/website/index.xml"));
		assertFalse(created.isContentStoreManifestLoadFailed());
		assertNull(created.getContentStoreManifestETag());
		File folder = adapter.doFindFile(created, "/site/website");
		assertNotNull(folder);
		assertTrue(folder.isDirectory());
		verify(client, never()).listObjectsV2(any(ListObjectsV2Request.class));
	}

	@Test
	public void testCreateContextStoresManifestETag() throws Exception {
		String json = "{\"files\":[{\"path\":\"/site/website/index.xml\"}]}";
		when(client.utilities()).thenReturn(S3Utilities.builder().region(Region.US_EAST_1).build());
		when(client.getObject(any(GetObjectRequest.class))).thenReturn(objectWithETag(gzip(json), "\"manifest-1\""));

		S3Context created = createSiteContext();

		assertEquals("\"manifest-1\"", created.getContentStoreManifestETag());
		assertNotNull(created.getContentStoreIndex());
		verify(client).getObject(argThat((GetObjectRequest request) ->
			request.ifNoneMatch() == null && "sites/acme/content-store-manifest.json.gz".equals(request.key())));
	}

	@Test
	public void testReloadKeepsIndexWhenManifestIsUnchanged() {
		ContentStoreIndex original = ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml")));
		context.setContentStoreIndex(original, "\"manifest-1\"");
		when(client.getObject(any(GetObjectRequest.class)))
			.thenThrow(S3Exception.builder().statusCode(304).message("not modified").build());

		adapter.reloadContentStoreManifest(context);

		assertSame(original, context.getContentStoreIndex());
		assertEquals("\"manifest-1\"", context.getContentStoreManifestETag());
		assertFalse(context.isContentStoreManifestLoadFailed());
		verify(client).getObject(argThat((GetObjectRequest request) ->
			"\"manifest-1\"".equals(request.ifNoneMatch())
				&& "sites/acme/content-store-manifest.json.gz".equals(request.key())));
	}

	@Test
	public void testReloadReplacesIndexWhenManifestChanges() throws Exception {
		context.setContentStoreIndex(ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml"))),
			"\"manifest-1\"");
		String json = "{\"files\":[{\"path\":\"/site/website/about.xml\"}]}";
		when(client.getObject(any(GetObjectRequest.class))).thenReturn(objectWithETag(gzip(json), "\"manifest-2\""));

		adapter.reloadContentStoreManifest(context);

		assertEquals("\"manifest-2\"", context.getContentStoreManifestETag());
		assertEquals(ContentStoreIndex.TYPE_FILE, context.getContentStoreIndex().typeOf("/site/website/about.xml"));
		assertNull(context.getContentStoreIndex().typeOf("/site/website/index.xml"));
		assertFalse(context.isContentStoreManifestLoadFailed());
		verify(client).getObject(argThat((GetObjectRequest request) -> "\"manifest-1\"".equals(request.ifNoneMatch())));
	}

	@Test
	public void testMissingManifestClearsStoredETag() {
		context.setContentStoreIndex(ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml"))),
			"\"manifest-1\"");
		when(client.getObject(any(GetObjectRequest.class))).thenThrow(NoSuchKeyException.builder().message("missing").build());
		when(client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
			.contents(software.amazon.awssdk.services.s3.model.S3Object.builder().key("sites/acme/site/").build())
			.build());

		adapter.reloadContentStoreManifest(context);

		assertNull(context.getContentStoreIndex());
		assertNull(context.getContentStoreManifestETag());
		assertFalse(context.isContentStoreManifestLoadFailed());
		File folder = adapter.doFindFile(context, "/site");
		assertNotNull(folder);
		assertTrue(folder.isDirectory());
	}

	private void assertCreateContextListsS3() {
		when(client.utilities()).thenReturn(S3Utilities.builder().region(Region.US_EAST_1).build());
		when(client.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder()
			.contents(software.amazon.awssdk.services.s3.model.S3Object.builder().key("sites/acme/site/").build())
			.build());

		S3Context created = createSiteContext();

		assertNull(created.getContentStoreIndex());
		assertNull(created.getContentStoreManifestETag());
		assertTrue(created.isContentStoreIndexResolved());
		assertTrue(created.isContentStoreManifestLoadFailed());
		assertTrue(S3ContentStoreAdapter.isContentStoreManifestLoadFailed(created));
		File folder = adapter.doFindFile(created, "/site");
		assertNotNull(folder);
		assertTrue(folder.isDirectory());
		verify(client, atLeastOnce()).listObjectsV2(any(ListObjectsV2Request.class));
	}

	private S3Context createSiteContext() {
		return (S3Context) adapter.createContext("id", "s3://test-bucket/sites/acme", false, true, 1000, true, null);
	}

	private static ResponseInputStream<GetObjectResponse> objectWithBytes(byte[] bytes) {
		return objectWithETag(bytes, null);
	}

	private static ResponseInputStream<GetObjectResponse> objectWithETag(byte[] bytes, String eTag) {
		return new ResponseInputStream<>(GetObjectResponse.builder().eTag(eTag).build(), new ByteArrayInputStream(bytes));
	}

	private static byte[] gzip(String json) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (GZIPOutputStream gzip = new GZIPOutputStream(out)) {
			gzip.write(json.getBytes(StandardCharsets.UTF_8));
		}
		return out.toByteArray();
	}

}
