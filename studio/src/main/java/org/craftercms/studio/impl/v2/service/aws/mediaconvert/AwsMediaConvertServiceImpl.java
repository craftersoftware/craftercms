/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.impl.v2.service.aws.mediaconvert;

import java.io.InputStream;
import java.net.URI;
import java.util.LinkedList;
import java.util.List;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.config.profiles.ConfigurationProfileNotFoundException;
import org.craftercms.commons.file.stores.S3Utils;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.validation.annotations.param.ValidateStringParam;
import org.craftercms.studio.api.v1.aws.mediaconvert.MediaConvertProfile;
import org.craftercms.studio.api.v1.exception.AwsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.impl.v1.util.config.profiles.SiteAwareConfigProfileLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.craftercms.studio.api.v1.service.aws.AbstractAwsService;
import org.craftercms.studio.api.v2.service.aws.mediaconvert.AwsMediaConvertService;
import org.craftercms.studio.impl.v1.service.aws.AwsUtils;
import org.craftercms.studio.model.aws.mediaconvert.MediaConvertResult;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.mediaconvert.MediaConvertClient;
import software.amazon.awssdk.services.mediaconvert.model.*;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Uri;

import static java.lang.String.format;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_S3_WRITE;

/**
 * Default implementation of {@link AwsMediaConvertService}
 *
 * @author joseross
 * @since 3.1.1
 */
public class AwsMediaConvertServiceImpl extends AbstractAwsService<MediaConvertProfile>
	implements AwsMediaConvertService {

	private static final Logger logger = LoggerFactory.getLogger(AwsMediaConvertServiceImpl.class);

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

	/**
	 * The extension used by Apple HLS files
	 */
	protected String hlsExtension;

	/**
	 * The extension used by DASH ISO files
	 */
	protected String dashExtension;

	/**
	 * The extension used by MS Smooth files
	 */
	protected String smoothExtension;

	public AwsMediaConvertServiceImpl(SiteAwareConfigProfileLoader<MediaConvertProfile> profileLoader,
					  final String delimiter, final String urlPattern, final String hlsExtension,
					  final String dashExtension, final String smoothExtension) {
		super(profileLoader);
		this.delimiter = delimiter;
		this.urlPattern = urlPattern;
		this.hlsExtension = hlsExtension;
		this.dashExtension = dashExtension;
		this.smoothExtension = smoothExtension;
	}

	public void setPartSize(final int partSize) {
		this.partSize = partSize;
	}

	/**
	 * Creates an instance of {@link S3Client} to upload the files.
	 *
	 * @param profile AWS profile
	 * @return an S3 client
	 */
	protected S3Client getS3Client(MediaConvertProfile profile) {
		return S3Utils.createClient(profile, false, S3Client.builder(), S3ClientBuilder::build);
	}

	/**
	 * Creates an instance of {@link MediaConvertClient} to start the transcoding jobs.
	 *
	 * @param profile AWS profile
	 * @return a MediaConvert client
	 */
	protected MediaConvertClient getMediaConvertClient(MediaConvertProfile profile) {
		return MediaConvertClient.builder()
			.credentialsProvider(profile.getCredentialsProvider())
			.region(Region.of(profile.getRegion()))
			.endpointOverride(URI.create(profile.getEndpoint()))
			.build();
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_S3_WRITE)
	public MediaConvertResult uploadVideo(@SiteId final String site,
					      @ValidateStringParam final String inputProfileId,
					      @ValidateStringParam final String outputProfileId,
					      @ValidateStringParam final String filename,
					      final InputStream content) throws AwsException, ConfigurationProfileNotFoundException, SiteNotFoundException {
		MediaConvertProfile profile = getProfile(site, inputProfileId);
		S3Client s3Client = getS3Client(profile);
		MediaConvertClient mediaConvertClient = getMediaConvertClient(profile);

		String[] pathTokens = profile.getInputPath().split("/", 2);
		String inputBucket = pathTokens[0];
		String inputKey = pathTokens.length == 2 ? (pathTokens[1] + "/" + filename) : filename;

		logger.debug("Upload file '{}' to site '{}'", filename, site);
		AwsUtils.uploadStream(inputBucket, inputKey, s3Client, partSize, filename, content);
		logger.debug("Completed upload of file '{}' to site '{}'", filename, site);

		String originalName = FilenameUtils.getBaseName(filename);

		GetJobTemplateResponse getJobTemplateResponse = mediaConvertClient.getJobTemplate(
			GetJobTemplateRequest.builder()
				.name(profile.getTemplate())
				.build());

		JobSettings jobSettings = JobSettings.builder()
			.inputs(Input.builder()
				.fileInput(AwsUtils.getS3Url(profile.getInputPath(), filename))
				.build())
			.build();

		CreateJobRequest createJobRequest = CreateJobRequest.builder()
			.jobTemplate(profile.getTemplate())
			.settings(jobSettings)
			.role(profile.getRole())
			.queue(profile.getQueue())
			.build();

		logger.info("Transcode file '{}' in site '{}'", filename, site);
		CreateJobResponse createJobResponse = mediaConvertClient.createJob(createJobRequest);
		logger.debug("Transcode job '{}' in site '{}' started successfully",
			createJobResponse.job().arn(), site);

		return buildResult(s3Client, getJobTemplateResponse.jobTemplate(), createJobResponse, outputProfileId, originalName);
	}

	protected MediaConvertResult buildResult(S3Client s3Client, JobTemplate jobTemplate, CreateJobResponse createJobResponse,
						 String outputProfileId, String originalName) {
		List<String> urls = new LinkedList<>();
		jobTemplate.settings().outputGroups().forEach(outputGroup -> {
			logger.debug("Add the URLs from group '{}'", outputGroup.name());
			OutputGroupType type = outputGroup.outputGroupSettings().type();
			switch (type) {
				case FILE_GROUP_SETTINGS:
					FileGroupSettings fileSettings = outputGroup.outputGroupSettings().fileGroupSettings();
					outputGroup.outputs().forEach(output -> {
						addUrl(s3Client, urls, outputProfileId, fileSettings.destination(), originalName,
							output.nameModifier(), output.extension());
					});
					break;
				case HLS_GROUP_SETTINGS:
					HlsGroupSettings hlsSettings = outputGroup.outputGroupSettings().hlsGroupSettings();
					addUrl(s3Client, urls, outputProfileId, hlsSettings.destination(), originalName,
						StringUtils.EMPTY, hlsExtension);
					break;
				case DASH_ISO_GROUP_SETTINGS:
					DashIsoGroupSettings dashSettings = outputGroup.outputGroupSettings().dashIsoGroupSettings();
					addUrl(s3Client, urls, outputProfileId, dashSettings.destination(), originalName,
						StringUtils.EMPTY, dashExtension);
					break;
				case MS_SMOOTH_GROUP_SETTINGS:
					MsSmoothGroupSettings smoothSettings = outputGroup.outputGroupSettings().msSmoothGroupSettings();
					addUrl(s3Client, urls, outputProfileId, smoothSettings.destination(), originalName,
						StringUtils.EMPTY, smoothExtension);
					break;
				case CMAF_GROUP_SETTINGS:
					CmafGroupSettings cmafSettings = outputGroup.outputGroupSettings().cmafGroupSettings();
					addUrl(s3Client, urls, outputProfileId, cmafSettings.destination(), originalName,
						StringUtils.EMPTY, hlsExtension);
					addUrl(s3Client, urls, outputProfileId, cmafSettings.destination(), originalName,
						StringUtils.EMPTY, dashExtension);
					break;
				default:
					// unknown settings ... do nothing
			}
		});

		MediaConvertResult result = new MediaConvertResult();
		result.setJobId(createJobResponse.job().id());
		result.setJobArn(createJobResponse.job().arn());
		result.setUrls(urls);

		return result;
	}

	protected void addUrl(S3Client s3Client, List<String> urls, String outputProfileId, String destination, String originalName,
			      String modifier, String extension) {
		String url = StringUtils.appendIfMissing(destination, delimiter) + originalName + modifier + "." + extension;
		url = createUrl(s3Client, outputProfileId, url);
		logger.debug("Add the URL '{}'", url);
		urls.add(url);
	}

	/**
	 * Builds a remote-asset url using the given profile and S3 URI
	 */
	protected String createUrl(S3Client s3Client, String profileId, String fullUri) {
		S3Uri uri = s3Client.utilities().parseUri(URI.create(fullUri));
		return format(urlPattern, profileId, uri.key().orElse(""));
	}

}
