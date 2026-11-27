/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.commons.aws;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.transfer.s3.S3TransferManager;
import software.amazon.awssdk.transfer.s3.model.Copy;
import software.amazon.awssdk.transfer.s3.model.CopyRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.function.Consumer;

/**
 * Provides utility methods for AWS services
 */
public final class AwsUtils {

	private static final Logger logger = LoggerFactory.getLogger(AwsUtils.class);

	public static final String DELIMITER = "/";

	/**
	 * Builds the {@link S3TransferManager} using the shared {@link ExecutorService}
	 */
	@SuppressWarnings("unused")
	public static S3TransferManager buildTransferManager(S3AsyncClient client) {
		return S3TransferManager.builder()
			.s3Client(client)
			.build();
	}

	/**
	 * Builds the {@link S3TransferManager} using the provided {@link ThreadPoolExecutor}
	 *
	 * @param client             the {@link S3AsyncClient} client
	 * @param threadPoolExecutor the thread pool executor
	 */
	public static S3TransferManager buildTransferManager(final S3AsyncClient client, final ThreadPoolExecutor threadPoolExecutor) {
		return S3TransferManager.builder()
			.s3Client(client)
			.executor(threadPoolExecutor)
			.build();
	}

	/**
	 * Copy a list of objects from a source bucket to a target bucket
	 *
	 * @param client             The {@link S3AsyncClient} client
	 * @param threadPoolExecutor The thread pool executor
	 * @param sourceBucket       The source bucket
	 * @param sourceBaseKey      The base key in the source bucket (i.e. prefix for all paths)
	 * @param targetBucket       The target bucket
	 * @param targetBaseKey      The base key in the target bucket (i.e. prefix for all paths)
	 * @param paths              The list of paths to copy
	 * @param errorHandler       The error handler to be called on copy errors. This handler will receive the cause exception and can return
	 *                           a CompletionException to propagate the error or handle it in any other way
	 */
	@SuppressWarnings("unused")
	public static void copyObjects(S3AsyncClient client, ThreadPoolExecutor threadPoolExecutor, String sourceBucket, String sourceBaseKey,
				       String targetBucket, String targetBaseKey, List<String> paths, final Consumer<Throwable> errorHandler) {
		List<CopyPathRequest> copyPaths = paths.stream()
			.map(s -> buildCopyPathRequest(s, errorHandler))
			.toList();
		copyObjectsResultAware(client, threadPoolExecutor, sourceBucket, sourceBaseKey, targetBucket, targetBaseKey, copyPaths);
	}

	private static CopyPathRequest buildCopyPathRequest(final String path, final Consumer<Throwable> errorHandler) {
		return new CopyPathRequest() {
			@Override
			public String getPath() {
				return path;
			}

			@Override
			public void fail(Throwable throwable) {
				errorHandler.accept(throwable);
			}
		};
	}

	public static void copyObjectsResultAware(S3AsyncClient client, ThreadPoolExecutor threadPoolExecutor, String sourceBucket, String sourceBaseKey,
						  String targetBucket, String targetBaseKey, List<CopyPathRequest> copyPaths) {
		try (S3TransferManager transferManager = buildTransferManager(client, threadPoolExecutor)) {
			logger.debug("Copying {} objects from '{}' to '{}'", copyPaths.size(), sourceBucket, targetBucket);
			List<CompletableFuture<Void>> futures = new ArrayList<>();
			for (CopyPathRequest copyPath : copyPaths) {
				futures.add(copyObject(sourceBucket, sourceBaseKey, targetBucket, targetBaseKey, copyPath, transferManager));
			}
			CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
			logger.debug("Finished copying {} objects from '{}' to '{}'", copyPaths.size(), sourceBucket, targetBucket);
		}
	}

	/**
	 * Convenience handler to ignore NoSuchKeyException. It will throw a CompletionException for any other exception type.
	 * The error may be wrapped in a CompletionException (as it is when received from a CompletableFuture), so the cause
	 * is checked in that case.
	 *
	 * @return handler that ignores NoSuchKeyException
	 */
	@SuppressWarnings("unused")
	public static Consumer<Throwable> ignoreMissingObject() {
		return e -> {
			Throwable cause = (e instanceof CompletionException && e.getCause() != null) ? e.getCause() : e;
			if (!(cause instanceof NoSuchKeyException)) {
				throw new CompletionException(e);
			}
		};
	}

	private static CompletableFuture<Void> copyObject(final String sourceBucket, final String sourceBaseKey,
							  final String targetBucket, final String targetBaseKey,
							  final CopyPathRequest copyPath, final S3TransferManager transferManager) {
		String path = copyPath.getPath();
		logger.debug("Copying '{}' from '{}' to '{}'", path, sourceBucket, targetBucket);
		String sourceKey = s3KeyFromPath(sourceBaseKey, path);
		String targetKey = s3KeyFromPath(targetBaseKey, path);
		CopyObjectRequest copyObjectRequest = CopyObjectRequest.builder()
			.sourceBucket(sourceBucket)
			.sourceKey(sourceKey)
			.destinationBucket(targetBucket)
			.destinationKey(targetKey)
			.build();
		CopyRequest copyRequest = CopyRequest.builder()
			.copyObjectRequest(copyObjectRequest)
			.build();
		Copy copy = transferManager.copy(copyRequest);
		return copy.completionFuture()
			.thenAcceptAsync(completedCopy -> {
				logger.debug("Finished copying '{}' from '{}' to '{}' with result '{}'", path, sourceBucket, targetBucket,
					completedCopy.response().copyObjectResult());
				copyPath.complete();
			}).exceptionallyAsync(throwable -> {
				logger.error("Failed to copy '{}' from '{}' to '{}'", path, sourceBucket, targetBucket, throwable);
				copyPath.fail(throwable);
				return null;
			});

	}

	/**
	 * Form a S3 key from a base key and a path
	 *
	 * @param baseKey the base key
	 * @param path    the path
	 * @return s3 key format
	 */
	public static String s3KeyFromPath(String baseKey, String path) {
		String s3Key = StringUtils.appendIfMissing(baseKey, DELIMITER) + StringUtils.stripStart(path, DELIMITER);
		return StringUtils.stripStart(s3Key, DELIMITER);
	}

	/**
	 * Represent a request to copy a path between S3 buckets, providing fail() and complete() methods
	 * to notify about the result of the operation
	 * Notice that bucket and path prefix are not part of this object
	 */
	public interface CopyPathRequest {
		String getPath();

		default void fail(Throwable throwable) {
		}

		default void complete() {
		}
	}

}
