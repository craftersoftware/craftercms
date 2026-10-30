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
package org.craftercms.deployer.impl.processors.aws;

import org.craftercms.deployer.api.ChangeSet;
import org.craftercms.deployer.api.Deployment;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.eclipse.jgit.lib.ObjectId;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.MockitoJUnitRunner;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Utilities;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.MetadataDirective;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.eclipse.jgit.lib.Constants.DOT_GIT;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.craftercms.deployer.impl.DeploymentConstants.LATEST_COMMIT_ID_PARAM_NAME;
import static org.craftercms.deployer.impl.DeploymentConstants.PREVIOUS_COMMIT_ID_PARAM_NAME;

/**
 * Tests for {@link S3ContentStoreManifestProcessor}.
 */
@RunWith(MockitoJUnitRunner.class)
public class S3ContentStoreManifestProcessorTest {

	private static final String MANIFEST_KEY = "sites/acme/content-store-manifest.json.gz";
	private static final String MANIFEST_COMMIT_ID_METADATA = "crafter-manifest-commit-id";
	private static final ObjectId PREVIOUS_COMMIT_ID = ObjectId.fromString("0123456789012345678901234567890123456789");
	private static final ObjectId LATEST_COMMIT_ID = ObjectId.fromString("9876543210987654321098765432109876543210");

	@Mock
	private S3Client client;

	private Path repo;

	@Before
	public void setUp() throws IOException {
		repo = Files.createTempDirectory("manifest-repo");
		Files.createDirectories(repo.resolve("site/website"));
		Files.writeString(repo.resolve("site/website/index.xml"), "<page/>");
	}

	@After
	public void tearDown() throws IOException {
		if (repo == null || Files.notExists(repo)) {
			return;
		}
		deleteRecursively(repo);
	}

	@Test
	public void testListPublishedFilesSkipsGitAndIncludesBlobs() throws Exception {
		Files.createDirectories(repo.resolve(".git"));
		Files.writeString(repo.resolve(".git/config"), "git");
		Files.writeString(repo.resolve("site/website/crafter-level-descriptor.level.xml"), "<level/>");
		Files.writeString(repo.resolve("site/website/hero.png.blob"), "blob");

		List<String> paths = processor().listPublishedFiles(repo);

		assertTrue(paths.contains("/site/website/index.xml"));
		assertTrue(paths.contains("/site/website/crafter-level-descriptor.level.xml"));
		assertTrue(paths.contains("/site/website/hero.png.blob"));
		assertFalse(paths.contains("/.git/config"));
	}

	@Test
	public void testListPublishedFilesDoesNotEnterGit() throws Exception {
		Path gitObjects = repo.resolve(".git/objects");
		Path nestedGitObjects = repo.resolve("site/.git/objects");
		Files.createDirectories(gitObjects);
		Files.writeString(repo.resolve(".git/config"), "git");
		Files.writeString(gitObjects.resolve("pack"), "pack");
		Files.createDirectories(nestedGitObjects);
		Files.writeString(nestedGitObjects.resolve("pack"), "nested");

		// The walker opens a directory before preVisitDirectory. Failing opens of descendants
		// proves .git was skipped. Mode 000 is ignored by root and is unavailable on Windows.
		try (MockedStatic<Files> files = mockStatic(Files.class, CALLS_REAL_METHODS)) {
			files.when(() -> Files.newDirectoryStream(any(Path.class))).thenAnswer(invocation -> {
				Path directory = invocation.getArgument(0);
				if (isInsideGit(directory)) {
					throw new IOException("refusing to enter " + directory);
				}
				return invocation.callRealMethod();
			});

			List<String> paths = processor().listPublishedFiles(repo);

			assertTrue(paths.contains("/site/website/index.xml"));
			assertFalse(paths.stream().anyMatch(path -> path.contains("/.git")));
		}
	}

	@Test
	public void testUpdateOnlyPublishSkipsExistingManifest() throws Exception {
		when(client.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder()
			.contentType("application/gzip")
			.metadata(Map.of(MANIFEST_COMMIT_ID_METADATA, PREVIOUS_COMMIT_ID.name())).build());
		S3ContentStoreManifestProcessor processor = processor(Path.of("/tmp/missing-manifest-repo"));

		ChangeSet updates = new ChangeSet(List.of(), List.of("/site/website/index.xml"), List.of());
		assertNull(processor.doMainProcess(deployment(PREVIOUS_COMMIT_ID, LATEST_COMMIT_ID), null, updates, null));

		verify(client).headObject(argThat((HeadObjectRequest request) ->
			"test-bucket".equals(request.bucket()) && MANIFEST_KEY.equals(request.key())));
		verify(client).copyObject(argThat((CopyObjectRequest request) ->
			"test-bucket".equals(request.sourceBucket()) && MANIFEST_KEY.equals(request.sourceKey())
				&& "test-bucket".equals(request.destinationBucket()) && MANIFEST_KEY.equals(request.destinationKey())
				&& request.metadataDirective() == MetadataDirective.REPLACE
				&& "application/gzip".equals(request.contentType())
				&& LATEST_COMMIT_ID.name().equals(request.metadata().get(MANIFEST_COMMIT_ID_METADATA))));
		verify(client, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
	}

	@Test
	public void testUpdateOnlyPublishLeavesMetadataWhenCommitIsUnchanged() throws Exception {
		when(client.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder()
			.metadata(Map.of(MANIFEST_COMMIT_ID_METADATA, PREVIOUS_COMMIT_ID.name())).build());
		S3ContentStoreManifestProcessor processor = processor(Path.of("/tmp/missing-manifest-repo"));

		ChangeSet updates = new ChangeSet(List.of(), List.of("/site/website/index.xml"), List.of());
		assertNull(processor.doMainProcess(deployment(PREVIOUS_COMMIT_ID, PREVIOUS_COMMIT_ID), null, updates, null));

		verify(client, never()).copyObject(any(CopyObjectRequest.class));
		verify(client, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
	}

	@Test
	public void testUpdateOnlyPublishRebuildsMissingManifest() throws Exception {
		when(client.headObject(any(HeadObjectRequest.class)))
			.thenThrow(S3Exception.builder().statusCode(404).message("missing").build());

		ChangeSet updates = new ChangeSet(List.of(), List.of("/site/website/index.xml"), List.of());
		assertNull(processor().doMainProcess(deployment(PREVIOUS_COMMIT_ID, LATEST_COMMIT_ID), null, updates, null));

		verify(client).putObject(manifestPut(), any(RequestBody.class));
	}

	@Test
	public void testUpdateOnlyPublishRebuildsWhenManifestCheckFails() throws Exception {
		when(client.headObject(any(HeadObjectRequest.class)))
			.thenThrow(S3Exception.builder().statusCode(500).message("unavailable").build());

		ChangeSet updates = new ChangeSet(List.of(), List.of("/site/website/index.xml"), List.of());
		assertNull(processor().doMainProcess(deployment(PREVIOUS_COMMIT_ID, LATEST_COMMIT_ID), null, updates, null));

		verify(client).putObject(manifestPut(), any(RequestBody.class));
	}

	@Test
	public void testUpdateOnlyPublishRebuildsManifestFromDifferentCommit() throws Exception {
		when(client.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder()
			.metadata(Map.of(MANIFEST_COMMIT_ID_METADATA, LATEST_COMMIT_ID.name())).build());

		ChangeSet updates = new ChangeSet(List.of(), List.of("/site/website/index.xml"), List.of());
		assertNull(processor().doMainProcess(deployment(PREVIOUS_COMMIT_ID, LATEST_COMMIT_ID), null, updates, null));

		verify(client).putObject(argThat((PutObjectRequest request) ->
			LATEST_COMMIT_ID.name().equals(request.metadata().get(MANIFEST_COMMIT_ID_METADATA))), any(RequestBody.class));
		verify(client, never()).copyObject(any(CopyObjectRequest.class));
	}

	@Test
	public void testCreatedFileRebuildsWithoutCheckingManifest() throws Exception {
		ChangeSet created = new ChangeSet(List.of("/site/website/about.xml"), List.of(), List.of());
		assertNull(processor().doMainProcess(null, null, created, null));

		verify(client, never()).headObject(any(HeadObjectRequest.class));
		verify(client).putObject(manifestPut(), any(RequestBody.class));
	}

	@Test
	public void testDeletedFileRebuildsWithoutCheckingManifest() throws Exception {
		ChangeSet deleted = new ChangeSet(List.of(), List.of(), List.of("/site/website/index.xml"));
		assertNull(processor().doMainProcess(null, null, deleted, null));

		verify(client, never()).headObject(any(HeadObjectRequest.class));
		verify(client).putObject(manifestPut(), any(RequestBody.class));
	}

	@Test
	public void testMissingChangeSetRebuilds() {
		S3ContentStoreManifestProcessor processor = processor(Path.of("/tmp/missing-manifest-repo"));

		try {
			processor.doMainProcess(null, null, null, null);
			fail("Expected DeployerException");
		} catch (DeployerException expected) {
			assertTrue(expected.getMessage().contains("Local repository does not exist"));
		}
		verify(client, never()).headObject(any(HeadObjectRequest.class));
		verify(client, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
	}

	private S3ContentStoreManifestProcessor processor() {
		return processor(repo);
	}

	private S3ContentStoreManifestProcessor processor(Path repoRoot) {
		return new S3ContentStoreManifestProcessor(null, repoRoot.toString()) {
			{
				siteName = "acme";
				s3Url = S3Utilities.builder().region(Region.US_EAST_1).build()
					.parseUri(URI.create("s3://test-bucket/sites/acme/"));
			}

			@Override
			protected S3Client buildClient() {
				return client;
			}
		};
	}

	private static PutObjectRequest manifestPut() {
		return argThat((PutObjectRequest request) ->
			"test-bucket".equals(request.bucket()) && MANIFEST_KEY.equals(request.key()));
	}

	private static Deployment deployment(ObjectId previousCommitId, ObjectId latestCommitId) {
		Deployment deployment = new Deployment(null);
		deployment.addParam(PREVIOUS_COMMIT_ID_PARAM_NAME, previousCommitId);
		deployment.addParam(LATEST_COMMIT_ID_PARAM_NAME, latestCommitId);
		return deployment;
	}

	private static boolean isInsideGit(Path directory) {
		for (Path parent = directory.getParent(); parent != null; parent = parent.getParent()) {
			Path name = parent.getFileName();
			if (name != null && DOT_GIT.equals(name.toString())) {
				return true;
			}
		}
		return false;
	}

	private static void deleteRecursively(Path root) throws IOException {
		try (var walk = Files.walk(root)) {
			walk.sorted((left, right) -> right.getNameCount() - left.getNameCount())
				.forEach(path -> {
					try {
						Files.deleteIfExists(path);
					} catch (IOException e) {
						throw new IllegalStateException(e);
					}
				});
		}
	}

}
