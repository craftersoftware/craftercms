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

package org.craftercms.commons.http;

import org.craftercms.commons.rest.RestServiceException;
import org.junit.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class HttpUtilsTest {
	public static final String INPUT_URI_WITH_MACRO = "s3://sample-uri/with/{siteName}";
	public static final String EXPECT_OUTPUT_URI_ENCODED_MACRO = "s3://sample-uri/with/%7BsiteName%7D";

	@Test
	public void testEncodeUrlMacro() {
		String output = HttpUtils.encodeUrlMacro(INPUT_URI_WITH_MACRO);
		assertEquals(output, EXPECT_OUTPUT_URI_ENCODED_MACRO);
		assertEquals(HttpUtils.encodeUrlMacro(""), "");
	}

	@Test
	public void testHasStatusReadsRestServiceException() {
		RestServiceException notFound = new RestServiceException(HttpStatus.NOT_FOUND, "missing");

		assertTrue(HttpUtils.isNotFound(notFound));
		assertFalse(HttpUtils.isConflict(notFound));
	}

	@Test
	public void testHasStatusReadsHttpStatusCodeException() {
		HttpClientErrorException conflict = HttpClientErrorException.create(HttpStatus.CONFLICT, "exists",
			HttpHeaders.EMPTY, new byte[0], null);

		assertTrue(HttpUtils.isConflict(conflict));
		assertFalse(HttpUtils.isNotFound(conflict));
	}

	@Test
	public void testHasStatusIgnoresExceptionsWithoutStatus() {
		assertFalse(HttpUtils.hasStatus(new RestClientException("down"), HttpStatus.NOT_FOUND));
	}
}
