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

import org.craftercms.deployer.api.exceptions.DeployerException;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Utilities;
import software.amazon.awssdk.transfer.s3.S3TransferManager;
import software.amazon.awssdk.transfer.s3.model.CompletedFileUpload;
import software.amazon.awssdk.transfer.s3.model.FileUpload;
import software.amazon.awssdk.transfer.s3.model.UploadFileRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link S3SyncProcessor} uploads of regular files and blob pointers.
 */
@RunWith(MockitoJUnitRunner.class)
public class S3SyncProcessorTest {

	private static final String PAGE = "/static-assets/index.xml";

	private static final String IMAGE = "/static-assets/hero.png";

	@Mock
	private S3TransferManager transferManager;

	@Mock
	private FileUpload fileUpload;

	private ThreadPoolTaskExecutor executor;

	private Path repo;

	@Before
	public void setUp() throws IOException {
		repo = Files.createTempDirectory("s3-sync");
		Files.createDirectories(repo.resolve("static-assets"));
		executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(1);
		executor.initialize();
		CompletableFuture<CompletedFileUpload> completed = CompletableFuture.completedFuture(null);
		when(fileUpload.completionFuture()).thenReturn(completed);
		when(transferManager.uploadFile(any(UploadFileRequest.class))).thenReturn(fileUpload);
	}

	@After
	public void tearDown() throws IOException {
		if (executor != null) {
			executor.shutdown();
		}
		if (repo != null) {
			deleteRecursively(repo);
		}
	}

	@Test
	public void testUploadsRegularFileAndSkipsPointerWhenBlobsAreIgnored() throws Exception {
		Files.writeString(repo.resolve("static-assets/index.xml"), "<page/>");
		Files.writeString(repo.resolve("static-assets/hero.png.blob"), "pointer");

		processor(true).uploadFiles(null, List.of(PAGE, IMAGE));

		UploadFileRequest request = uploadedRequests(1).get(0);
		assertEquals("test-bucket", request.putObjectRequest().bucket());
		assertEquals("sites/acme/static-assets/index.xml", request.putObjectRequest().key());
		assertEquals(repo.resolve("static-assets/index.xml").normalize(), request.source().normalize());
	}

	@Test
	public void testUploadsPointerKeyWhenBlobsAreNotIgnored() throws Exception {
		Files.writeString(repo.resolve("static-assets/index.xml"), "<page/>");
		Files.writeString(repo.resolve("static-assets/hero.png.blob"), "pointer");

		processor(false).uploadFiles(null, List.of(PAGE, IMAGE));

		List<UploadFileRequest> requests = uploadedRequests(2);
		Set<String> keys = requests.stream()
			.map(request -> request.putObjectRequest().key())
			.collect(Collectors.toSet());
		assertEquals(Set.of(
			"sites/acme/static-assets/index.xml",
			"sites/acme/static-assets/hero.png.blob"), keys);

		UploadFileRequest pointer = requests.stream()
			.filter(request -> request.putObjectRequest().key().endsWith(".blob"))
			.findFirst()
			.orElseThrow();
		assertEquals(repo.resolve("static-assets/hero.png.blob").normalize(), pointer.source().normalize());
	}

	@Test
	public void testRegularFileWinsWhenPointerAlsoExists() throws Exception {
		Files.writeString(repo.resolve("static-assets/hero.png"), "bytes");
		Files.writeString(repo.resolve("static-assets/hero.png.blob"), "pointer");

		processor(false).uploadFiles(null, List.of(IMAGE));

		UploadFileRequest request = uploadedRequests(1).get(0);
		assertEquals("sites/acme/static-assets/hero.png", request.putObjectRequest().key());
		assertEquals(repo.resolve("static-assets/hero.png").normalize(), request.source().normalize());
	}

	@Test
	public void testFailedUploadFailsTheBatch() throws Exception {
		Files.writeString(repo.resolve("static-assets/index.xml"), "<page/>");
		when(fileUpload.completionFuture())
			.thenReturn(CompletableFuture.failedFuture(new RuntimeException("upload failed")));

		try {
			processor(true).uploadFiles(null, List.of(PAGE));
			fail("Expected DeployerException");
		} catch (DeployerException expected) {
			assertTrue(expected.getMessage().contains(PAGE));
			assertTrue(causedByMessage(expected, "upload failed"));
		}
	}

	@Test
	public void testMissingFileFails() throws Exception {
		try {
			processor(false).uploadFiles(null, List.of(IMAGE));
			fail("Expected DeployerException");
		} catch (DeployerException expected) {
			assertTrue(expected.getMessage().contains(IMAGE));
		}
		verify(transferManager, never()).uploadFile(any(UploadFileRequest.class));
	}

	private List<UploadFileRequest> uploadedRequests(int count) {
		ArgumentCaptor<UploadFileRequest> captor = ArgumentCaptor.forClass(UploadFileRequest.class);
		verify(transferManager, times(count)).uploadFile(captor.capture());
		return captor.getAllValues();
	}

	private S3SyncProcessor processor(boolean ignoreBlobFiles) {
		return new S3SyncProcessor(executor, repo.toString(), ".blob") {
			{
				ignoreBlobs = ignoreBlobFiles;
				siteName = "acme";
				s3Url = S3Utilities.builder().region(Region.US_EAST_1).build()
					.parseUri(URI.create("s3://test-bucket/sites/acme/"));
			}

			@Override
			protected S3TransferManager buildTransferManager(software.amazon.awssdk.services.s3.S3AsyncClient client) {
				return transferManager;
			}
		};
	}

	private static boolean causedByMessage(Throwable error, String message) {
		Throwable cause = error;
		while (cause != null) {
			if (cause.getMessage() != null && cause.getMessage().contains(message)) {
				return true;
			}
			cause = cause.getCause();
		}
		return false;
	}

	private static void deleteRecursively(Path root) throws IOException {
		if (Files.notExists(root)) {
			return;
		}
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
