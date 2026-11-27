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
package org.craftercms.deployer.utils.aws;

import org.junit.Test;
import software.amazon.awssdk.services.s3.S3Uri;

import static org.junit.Assert.assertEquals;

/**
 * Unit tests for {@link AwsS3Utils}.
 */
public class AwsS3UtilsTest {

    private static final String SITE_NAME = "acme";

    @Test
    public void testParseUrlWithSiteNameMacro() {
        S3Uri s3Url = AwsS3Utils.parseS3Url("s3://bkt/sites/{siteName}");

        assertEquals("bkt", AwsS3Utils.getBucket(s3Url, SITE_NAME));
        assertEquals("sites/acme/", AwsS3Utils.getS3BaseKey(s3Url, SITE_NAME));
    }

    @Test
    public void testParseUrlWithTrailingDelimiter() {
        S3Uri s3Url = AwsS3Utils.parseS3Url("s3://bkt/sites/{siteName}/");

        assertEquals("bkt", AwsS3Utils.getBucket(s3Url, SITE_NAME));
        assertEquals("sites/acme/", AwsS3Utils.getS3BaseKey(s3Url, SITE_NAME));
    }

    @Test
    public void testParseBucketOnlyUrl() {
        for (String url : new String[] {"s3://bkt/", "s3://bkt"}) {
            S3Uri s3Url = AwsS3Utils.parseS3Url(url);

            assertEquals(url, "bkt", AwsS3Utils.getBucket(s3Url, SITE_NAME));
            assertEquals(url, "", AwsS3Utils.getS3BaseKey(s3Url, SITE_NAME));
        }
    }

    @Test
    public void testGetS3KeyWithBaseKey() {
        String baseKey = AwsS3Utils.getS3BaseKey(AwsS3Utils.parseS3Url("s3://bkt/sites/{siteName}"), SITE_NAME);

        assertEquals("sites/acme/site/x.xml", AwsS3Utils.getS3Key(baseKey, "/site/x.xml"));
        assertEquals("sites/acme/site/x.xml", AwsS3Utils.getS3Key(baseKey, "site/x.xml"));
        assertEquals("sites/acme/site/x.xml", AwsS3Utils.getS3Key("sites/acme", "/site/x.xml"));
    }

    @Test
    public void testGetS3KeyWithoutBaseKey() {
        for (String url : new String[] {"s3://bkt/", "s3://bkt"}) {
            String baseKey = AwsS3Utils.getS3BaseKey(AwsS3Utils.parseS3Url(url), SITE_NAME);

            assertEquals(url, "site/x.xml", AwsS3Utils.getS3Key(baseKey, "/site/x.xml"));
            assertEquals(url, "site/x.xml", AwsS3Utils.getS3Key(baseKey, "site/x.xml"));
        }
    }

}
