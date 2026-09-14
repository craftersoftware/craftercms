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

package org.craftercms.studio.impl.v2.service.aws.s3;

import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.aws.S3ClientCachingFactory;
import org.craftercms.commons.config.profiles.ConfigurationProfileNotFoundException;
import org.craftercms.commons.config.profiles.aws.S3Profile;
import org.craftercms.commons.lang.UrlUtils;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.validation.annotations.param.ValidateStringParam;
import org.craftercms.studio.api.v1.exception.AwsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.aws.AbstractAwsService;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.service.aws.s3.AwsS3Service;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.craftercms.studio.impl.v1.service.aws.AwsUtils;
import org.craftercms.studio.impl.v1.util.config.profiles.SiteAwareConfigProfileLoader;
import org.craftercms.studio.model.aws.s3.S3Item;
import org.springframework.util.MimeType;
import org.springframework.util.MimeTypeUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.paginators.ListObjectsV2Iterable;

import java.io.InputStream;
import java.nio.file.Paths;
import java.util.LinkedList;
import java.util.List;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.appendIfMissing;
import static org.apache.commons.lang3.StringUtils.stripStart;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_S3_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_S3_WRITE;

/**
 * Default implementation of {@link AwsS3Service}.
 *
 * @author joseross
 */
public class AwsS3ServiceImpl extends AbstractAwsService<S3Profile> implements AwsS3Service {

	public static final String ITEM_FILTER = "item";

	/**
	 * The S3 client factory.
	 */
	protected S3ClientCachingFactory clientFactory;

	/**
	 * The part size used for S3 uploads
	 */
	protected int partSize = AwsUtils.MIN_PART_SIZE;

	/**
	 * The delimiter for S3 paths
	 */
	protected String delimiter;

	/**
	 * The URL pattern for the generated files
	 */
	protected String urlPattern;

	public AwsS3ServiceImpl(SiteAwareConfigProfileLoader<S3Profile> profileLoader, S3ClientCachingFactory clientFactory,
				final String delimiter, final String urlPattern) {
		super(profileLoader);
		this.clientFactory = clientFactory;
		this.delimiter = delimiter;
		this.urlPattern = urlPattern;
	}

	public void setPartSize(final int partSize) {
		this.partSize = partSize;
	}

	protected S3Client getS3Client(S3Profile profile) {
		return clientFactory.getClient(profile);
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_S3_WRITE)
	public S3Item uploadItem(@SiteId String siteId,
				 @ValidateStringParam String profileId,
				 @ValidateStringParam String path,
				 @ValidateStringParam String filename,
				 InputStream content) throws AwsException,
		SiteNotFoundException, ConfigurationProfileNotFoundException {
		S3Profile profile = getProfile(siteId, profileId);
		S3Client s3Client = getS3Client(profile);
		String inputBucket = profile.getBucketName();
		String relativeKey = UrlUtils.concat(path, filename);
		String fullKey = UrlUtils.concat(profile.getPrefix(), relativeKey);

		AwsUtils.uploadStream(inputBucket, fullKey, s3Client, partSize, filename, content);

		return new S3Item(filename, createUrl(profileId, relativeKey), false, inputBucket, profile.getPrefix());
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_S3_READ)
	public List<S3Item> listItems(@SiteId String siteId,
				      @ValidateStringParam String profileId,
				      @ValidateStringParam String path,
				      @ValidateStringParam String type,
				      int maxKeys) throws AwsException,
		SiteNotFoundException, ConfigurationProfileNotFoundException {
		S3Profile profile = getProfile(siteId, profileId);
		S3Client client = getS3Client(profile);
		List<S3Item> items = new LinkedList<>();

		MimeType filterType =
			StringUtils.isEmpty(type) || StringUtils.equals(type, ITEM_FILTER) ? MimeTypeUtils.ALL : new MimeType(type);
		String fullPrefix = normalizePrefix(UrlUtils.concat(profile.getPrefix(), path));

		ListObjectsV2Request request = ListObjectsV2Request.builder()
			.bucket(profile.getBucketName())
			.prefix(fullPrefix)
			.delimiter(delimiter)
			.build();

		ListObjectsV2Iterable response = client.listObjectsV2Paginator(request);
		int contentsCount = 0;
		// fetch all prefixes and fetch content key up to maxKeys
		for (ListObjectsV2Response page : response) {
			items.addAll(processPrefixes(page, profile));
			if (contentsCount < maxKeys) {
				List<S3Item> contents = processContentKeys(page, profile, fullPrefix, filterType, maxKeys - contentsCount);
				items.addAll(contents);
				contentsCount += contents.size();
			}
		}

		return items;
	}

	/**
	 * Process S3 prefix
	 *
	 * @param page    S3 response object
	 * @param profile S3 profile
	 * @return list of {@link S3Item}
	 */
	private List<S3Item> processPrefixes(ListObjectsV2Response page, S3Profile profile) {
		return page.commonPrefixes().stream()
			.map(p -> {
				String relativeKey = StringUtils.removeStart(p.prefix(), profile.getPrefix());
				return new S3Item(StringUtils.removeEnd(relativeKey, delimiter), relativeKey, true, profile.getBucketName(), profile.getPrefix());
			})
			.toList();
	}

	/**
	 * Process content keys
	 *
	 * @param page       S3 response object
	 * @param profile    S3 profile
	 * @param fullPrefix full prefix
	 * @param filterType filter type
	 * @param maxKeys    max keys
	 * @return list of {@link S3Item} up to max keys
	 */
	private List<S3Item> processContentKeys(ListObjectsV2Response page, S3Profile profile, String fullPrefix, MimeType filterType, int maxKeys) {
		return page.contents().stream()
			.filter(o -> !StringUtils.equals(o.key(), fullPrefix) &&
				MimeType.valueOf(StudioUtils.getMimeType(o.key())).isCompatibleWith(filterType))
			.map(o -> {
				String relativeKey = StringUtils.removeStart(o.key(), profile.getPrefix());
				return new S3Item(relativeKey, createUrl(profile.getProfileId(), relativeKey), false, profile.getBucketName(), profile.getPrefix());
			})
			.limit(maxKeys)
			.toList();
	}

	protected String createUrl(String profileId, String key) {
		return Paths.get(format(urlPattern, profileId, key)).normalize().toString();
	}

	protected String normalizePrefix(String prefix) {
		if (StringUtils.isEmpty(prefix)) {
			return prefix;
		} else {
			return stripStart(appendIfMissing(prefix, delimiter), delimiter);
		}
	}

}
