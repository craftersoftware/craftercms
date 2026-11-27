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

import java.util.concurrent.CompletionException;
import java.util.function.Consumer;

import org.junit.Test;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;

public class AwsUtilsTest {
	@Test
	public void testBothBaseKeyAndPathEmpty() {
		String baseKey = "";
		String path = "";
		String expected = "";
		String result = AwsUtils.s3KeyFromPath(baseKey, path);
		assertEquals(expected, result);
	}

	@Test
	public void testBaseKeyEmptyPathNonEmpty() {
		String baseKey = "";
		String path = "path/to/object";
		String expected = "path/to/object";
		String result = AwsUtils.s3KeyFromPath(baseKey, path);
		assertEquals(expected, result);
	}

	@Test
	public void testBaseKeyNonEmptyPathEmpty() {
		String baseKey = "base/key/";
		String path = "";
		String expected = "base/key/";
		String result = AwsUtils.s3KeyFromPath(baseKey, path);
		assertEquals(expected, result);
	}

	@Test
	public void testBothBaseKeyAndPathNonEmpty() {
		String baseKey = "base/key";
		String path = "path/to/object";
		String expected = "base/key/path/to/object";
		String result = AwsUtils.s3KeyFromPath(baseKey, path);
		assertEquals(expected, result);
	}

	@Test
	public void testBothBaseKeyAndPathWithDelimiters() {
		String baseKey = "base/key/";
		String path = "/path/to/object";
		String expected = "base/key/path/to/object";
		String result = AwsUtils.s3KeyFromPath(baseKey, path);
		assertEquals(expected, result);
	}

	@Test
	public void testBaseKeyAndPathWithLeadingTrailingSpaces() {
		String baseKey = " base/key/ ";
		String path = " /path/to/object ";
		String expected = "base/key/path/to/object";
		String result = AwsUtils.s3KeyFromPath(baseKey.trim(), path.trim());
		assertEquals(expected, result);
	}

	@Test
	public void testBaseKeyEndsWithDelimiterPathStartsWithDelimiter() {
		String baseKey = "base/key/";
		String path = "/path/to/object";
		String expected = "base/key/path/to/object";
		String result = AwsUtils.s3KeyFromPath(baseKey, path);
		assertEquals(expected, result);
	}

	@Test
	public void ignoreMissingObjectIgnoresUnwrappedNoSuchKeyException() {
		AwsUtils.ignoreMissingObject().accept(NoSuchKeyException.builder().message("missing").build());
	}

	@Test
	public void ignoreMissingObjectIgnoresNoSuchKeyExceptionWrappedInCompletionException() {
		AwsUtils.ignoreMissingObject().accept(new CompletionException(NoSuchKeyException.builder().message("missing").build()));
	}

	@Test
	public void ignoreMissingObjectRethrowsOtherErrors() {
		Consumer<Throwable> handler = AwsUtils.ignoreMissingObject();
		RuntimeException error = new IllegalStateException("copy failed");
		CompletionException thrown = assertThrows(CompletionException.class, () -> handler.accept(error));
		assertSame(error, thrown.getCause());

		CompletionException wrapped = new CompletionException(error);
		CompletionException thrownWrapped = assertThrows(CompletionException.class, () -> handler.accept(wrapped));
		assertSame(wrapped, thrownWrapped.getCause());
	}
}
