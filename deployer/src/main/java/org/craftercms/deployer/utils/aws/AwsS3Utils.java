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
package org.craftercms.deployer.utils.aws;

import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.http.HttpUtils;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Uri;
import software.amazon.awssdk.services.s3.S3Utilities;

import java.net.URI;

/**
 * Provides utility aws-related functionality.
 */
public final class AwsS3Utils {

    static final String MACRO_SITENAME = "{siteName}";
    public static final int MAX_DELETE_KEYS_PER_REQUEST = 1000;
    static final String DELIMITER = "/";

    /**
     * Used only to parse S3 URLs. The region is required by the builder, but it isn't used to parse
     * {@code s3://} URLs, and URLs with a regional host carry their own region.
     */
    private static final S3Utilities S3_UTILITIES = S3Utilities.builder().region(Region.US_EAST_1).build();

    /**
     * Parses an S3 URL like {@code s3://bucket/sites/{siteName}}. Macros like {@code {siteName}} are encoded
     * first so the URL is valid, and a trailing {@code /} is added so the key is treated as a folder. Use
     * {@link #getBucket(S3Uri, String)} and {@link #getS3BaseKey(S3Uri, String)} to read the parts with the
     * macros resolved.
     *
     * @param url the S3 URL
     * @return the parsed URL
     */
    public static S3Uri parseS3Url(String url) {
        String uri = HttpUtils.encodeUrlMacro(StringUtils.appendIfMissing(url, DELIMITER));
        return S3_UTILITIES.parseUri(URI.create(uri));
    }

    /**
     * Builds the S3 object key for a file under the given base key. The result never starts with {@code /}.
     *
     * @param baseKey the base key, as returned by {@link #getS3BaseKey(S3Uri, String)}
     * @param file    the path of the file, with or without a leading {@code /}
     * @return the S3 object key
     */
    public static String getS3Key(String baseKey, String file) {
        String path = StringUtils.appendIfMissing(baseKey, DELIMITER) + StringUtils.stripStart(file, DELIMITER);
        // S3 key should not start with a delimiter
        return StringUtils.stripStart(path, DELIMITER);
    }

    /**
     * Returns the base key from the S3 URL, making sure to replace the {@code {siteName}} macro instances
     *
     * @param s3Url    the S3 URL
     * @param siteName the site name
     */
    public static String getS3BaseKey(S3Uri s3Url, String siteName) {
        String baseKey = s3Url.key().orElse(StringUtils.EMPTY);
        return baseKey.replace(MACRO_SITENAME, siteName);
    }

    /**
     * Returns the bucket from the S3 URL, making sure to replace the {@code {siteName}} macro instances
     *
     * @param s3Url    the S3 URL
     * @param siteName the site name
     */
    public static String getBucket(S3Uri s3Url, String siteName) {
        String bucket = s3Url.bucket().orElse(StringUtils.EMPTY);
        return bucket.replace(MACRO_SITENAME, siteName);
    }
}
