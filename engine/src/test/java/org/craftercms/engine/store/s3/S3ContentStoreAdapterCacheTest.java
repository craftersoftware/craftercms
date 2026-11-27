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

import org.junit.Before;
import org.junit.Test;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Uri;
import software.amazon.awssdk.services.s3.S3Utilities;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Instant;
import java.util.Arrays;
import java.util.Properties;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests which S3 objects {@link S3ContentStoreAdapter} caches in memory, with the shipped default allowed paths.
 */
public class S3ContentStoreAdapterCacheTest {

	private static final String SERVER_CONFIG = "crafter/engine/mode/serverless/s3/server-config.properties";
	private static final String ALLOWED_PATHS_PROPERTY = "crafter.engine.store.s3.cache.allowedPaths";
	private static final int CONTENT_MAX_LENGTH = 1024;

	private S3ContentStoreAdapter adapter;
	private S3Client client;
	private long objectLength;

	@Before
	public void setUp() throws Exception {
		adapter = new S3ContentStoreAdapter(null, ".xml", ".meta.xml", null, null, CONTENT_MAX_LENGTH,
			getDefaultAllowedPaths());
		client = mock(S3Client.class);
		adapter.client = client;
		objectLength = 10;
		when(client.getObject(any(GetObjectRequest.class))).thenAnswer(invocation -> new ResponseInputStream<>(
			GetObjectResponse.builder().lastModified(Instant.now()).contentLength(objectLength).build(),
			AbortableInputStream.create(new ByteArrayInputStream(new byte[(int) objectLength]))));
	}

	@Test
	public void testShouldCacheWithBaseKey() {
		// Shared bucket: s3://bkt/sites/{siteName}, with the site name resolved
		assertShouldCache(createContext("s3://bkt/sites/acme"), "sites/acme/");
	}

	@Test
	public void testShouldCacheWithoutBaseKey() {
		// One site per bucket (cloudformed)
		assertShouldCache(createContext("s3://ns-site-acme"), "");
	}

	private void assertShouldCache(S3Context context, String baseKey) {
		for (String path : new String[] {"config/studio/site-config.xml", "site/website/index.xml",
			"scripts/rest/test.get.groovy", "templates/web/page.ftl", "static-assets/css/main.css",
			"static-assets/js/main.js", "static-assets/fonts/font.woff", "static-assets/app/app.js",
			"static-assets/seo/robots.txt"}) {
			assertTrue(path, isCachedInMemory(context, baseKey + path));
		}
		for (String path : new String[] {"static-assets/images/logo.png", "deployment-events.properties",
			"sources/app.js"}) {
			assertFalse(path, isCachedInMemory(context, baseKey + path));
		}
		objectLength = CONTENT_MAX_LENGTH + 1;
		assertFalse("larger than contentMaxLength", isCachedInMemory(context, baseKey + "site/website/index.xml"));
	}

	private boolean isCachedInMemory(S3Context context, String key) {
		S3Object object = adapter.getObject(context, client, context.getBucket(), key);
		assertNotNull(key, object);
		return object instanceof S3CachedObject;
	}

	private S3Context createContext(String siteUrl) {
		S3Uri uri = S3Utilities.builder().region(Region.US_EAST_1).build().parseUri(URI.create(siteUrl));
		return new S3Context("id", adapter, siteUrl, false, true, 1000, false, uri, null);
	}

	/**
	 * Returns the default value of the allowed paths, split like Spring does for a {@code String[]} argument
	 */
	private static String[] getDefaultAllowedPaths() throws IOException {
		Properties properties = new Properties();
		try (InputStream in = S3ContentStoreAdapterCacheTest.class.getClassLoader().getResourceAsStream(SERVER_CONFIG)) {
			assertNotNull(SERVER_CONFIG, in);
			properties.load(in);
		}
		String value = properties.getProperty(ALLOWED_PATHS_PROPERTY);
		assertNotNull(ALLOWED_PATHS_PROPERTY, value);
		return Arrays.stream(value.split(",")).map(String::trim).toArray(String[]::new);
	}

}
