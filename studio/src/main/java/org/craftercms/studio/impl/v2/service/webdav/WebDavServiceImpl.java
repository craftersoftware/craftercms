/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.impl.v2.service.webdav;

import com.github.sardine.DavResource;
import com.github.sardine.Sardine;
import org.apache.commons.lang3.RegExUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.commons.config.profiles.ConfigurationProfileNotFoundException;
import org.craftercms.commons.config.profiles.webdav.WebDavProfile;
import org.craftercms.commons.lang.UrlUtils;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.validation.annotations.param.ValidateStringParam;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.WebDavException;
import org.craftercms.studio.api.v1.webdav.WebDavItem;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.service.webdav.WebDavService;
import org.craftercms.studio.impl.v1.util.config.profiles.SiteAwareConfigProfileLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.MimeType;
import org.springframework.web.util.UriUtils;

import jakarta.validation.Valid;

import java.io.InputStream;
import java.net.URI;
import java.nio.charset.Charset;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import static java.lang.String.format;
import static org.craftercms.commons.file.stores.WebDavUtils.createClient;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_WEBDAV_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_WEBDAV_WRITE;
import static org.springframework.util.MimeTypeUtils.ALL_VALUE;

/**
 * Default implementation of {@link WebDavService}.
 *
 * @author joseross
 * @since 3.1.4
 */
public class WebDavServiceImpl implements WebDavService {

	private static final Logger logger = LoggerFactory.getLogger(WebDavServiceImpl.class);

	public static final String FILTER_ALL_ITEMS = "item";

	protected String urlPattern;

	/**
	 * Instance of {@link SiteAwareConfigProfileLoader} used to load the configuration file.
	 */
	protected SiteAwareConfigProfileLoader<WebDavProfile> profileLoader;

	/**
	 * Charset used to encode paths in URLs.
	 */
	protected Charset charset = Charset.defaultCharset();

	protected WebDavProfile getProfile(String site, String profileId) throws WebDavException, ConfigurationProfileNotFoundException {
		try {
			return profileLoader.loadProfile(site, profileId);
		} catch (ConfigurationException e) {
			throw new WebDavException("Unable to load WebDav profile", e);
		}
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	@Valid
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WEBDAV_READ)
	public List<WebDavItem> list(@ValidateStringParam
				     @SiteId final String siteId,
				     @ValidateStringParam final String profileId,
				     @ValidateStringParam final String path,
				     @ValidateStringParam final String type) throws WebDavException, SiteNotFoundException, ConfigurationProfileNotFoundException {
		WebDavProfile profile = getProfile(siteId, profileId);
		StringBuilder listPath = new StringBuilder(StringUtils.appendIfMissing(profile.getBaseUrl(), "/"));
		MimeType filterType;
		try {
			Sardine sardine = createClient(profile);
			if (StringUtils.isEmpty(type) || type.equals(FILTER_ALL_ITEMS)) {
				filterType = MimeType.valueOf(ALL_VALUE);
			} else {
				filterType = new MimeType(type);
			}

			if (StringUtils.isNotEmpty(path)) {
				String[] tokens = StringUtils.split(path, "/");
				for (String token : tokens) {
					if (StringUtils.isNotEmpty(token)) {
						listPath.append(StringUtils.appendIfMissing(UriUtils.encode(token, charset.name()), "/"));
					}
				}
			}

			if (!sardine.exists(listPath.toString())) {
				logger.debug("Folder doesn't exist at site '{}' path '{}'", siteId, listPath.toString());
				return Collections.emptyList();
			}
			logger.debug("List resources at site '{}' path '{}'", siteId, listPath.toString());
			List<DavResource> resources = sardine.list(listPath.toString(), 1, true);
			logger.debug("Found '{}' resources at site '{}' path '{}'", resources.size(), siteId, listPath.toString());
			return resources.stream()
				.skip(1) // to avoid repeating the folder being listed
				.filter(r -> r.isDirectory() || filterType.includes(MimeType.valueOf(r.getContentType())))
				.map(r -> new WebDavItem(getName(r), getUrl(r, profileId, profile), r.isDirectory()))
				.collect(Collectors.toList());
		} catch (Exception e) {
			throw new WebDavException(format("Error listing resources at site '%s' path '%s'", siteId, listPath.toString()), e);
		}
	}

	protected String getUrl(DavResource resource, String profileId, WebDavProfile profile) {
		String relativePath = RegExUtils.removeFirst(resource.getPath(), URI.create(profile.getBaseUrl()).getPath());
		if (resource.isDirectory()) {
			return relativePath;
		} else {
			return getRemoteAssetUrl(profileId, relativePath);
		}
	}

	protected String getRemoteAssetUrl(String profileId, String fullPath) {
		return format(urlPattern, profileId, StringUtils.removeStart(fullPath, "/"));
	}

	protected String getRemoteAssetUrl(String profileId, String path, String filename) {
		String fullPath = UrlUtils.concat(path, filename);
		return getRemoteAssetUrl(profileId, fullPath);
	}

	protected String getName(DavResource resource) {
		if (StringUtils.isNotEmpty(resource.getDisplayName())) {
			return resource.getDisplayName();
		} else {
			String path = resource.getPath();
			if (resource.isDirectory()) {
				path = StringUtils.removeEnd(path, "/");
			}
			return StringUtils.substringAfterLast(path, "/");
		}
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	@Valid
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WEBDAV_WRITE)
	public WebDavItem upload(@SiteId final String siteId,
				 @ValidateStringParam final String profileId,
				 @ValidateStringParam final String path,
				 @ValidateStringParam final String filename,
				 final InputStream content)
		throws WebDavException, SiteNotFoundException, ConfigurationProfileNotFoundException {
		WebDavProfile profile = getProfile(siteId, profileId);
		String uploadUrl = StringUtils.appendIfMissing(profile.getBaseUrl(), "/");
		try {
			Sardine sardine = createClient(profile);

			if (StringUtils.isNotEmpty(path)) {
				String[] folders = StringUtils.split(path, "/");

				for (String folder : folders) {
					uploadUrl += StringUtils.appendIfMissing(folder, "/");

					logger.trace("Check folder in site '{}' URL '{}'", siteId, uploadUrl);
					if (!sardine.exists(uploadUrl)) {
						logger.trace("Create folder in site '{}' URL '{}'", siteId, uploadUrl);
						sardine.createDirectory(uploadUrl);
						logger.trace("Successfully created folder in site '{}' URL '{}'", siteId, uploadUrl);
					} else {
						logger.trace("Folder in site '{}' URL '{}' already exists", siteId, uploadUrl);
					}
				}
			}

			uploadUrl = StringUtils.appendIfMissing(uploadUrl, "/");
			String fileUrl = uploadUrl + UriUtils.encode(filename, charset.name());

			logger.debug("Upload the file '{}' to the URL '{}' in site '{}'", filename, fileUrl, siteId);
			sardine.put(fileUrl, content);
			logger.debug("Successfully uploaded the file '{}' to URL '{}' in site '{}'", filename, fileUrl, siteId);


			return new WebDavItem(filename, getRemoteAssetUrl(profileId, path, filename), false);
		} catch (Exception e) {
			logger.error("Failed to upload file '{}' in site '{}'", filename, siteId, e);
			throw new WebDavException(format("Failed to upload file '%s' in site '%s'", filename, siteId), e);
		}
	}

	public void setUrlPattern(String urlPattern) {
		this.urlPattern = urlPattern;
	}

	public void setProfileLoader(SiteAwareConfigProfileLoader<WebDavProfile> profileLoader) {
		this.profileLoader = profileLoader;
	}
}
