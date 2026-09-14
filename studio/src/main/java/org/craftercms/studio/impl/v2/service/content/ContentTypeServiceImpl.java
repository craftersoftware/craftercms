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
package org.craftercms.studio.impl.v2.service.content;

import org.apache.commons.lang3.tuple.ImmutablePair;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPath;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.QuickCreateItem;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.model.contentType.ContentType;
import org.craftercms.studio.model.contentType.ContentTypeUsage;
import org.springframework.core.io.Resource;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.List;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.*;

/**
 * Default implementation for {@link ContentTypeService}
 *
 * @author joseross
 * @since 4.0
 */
public class ContentTypeServiceImpl implements ContentTypeService {

	protected final ContentTypeService contentTypeServiceInternal;

	@ConstructorProperties({"contentTypeServiceInternal"})
	public ContentTypeServiceImpl(ContentTypeService contentTypeServiceInternal) {
		this.contentTypeServiceInternal = contentTypeServiceInternal;
	}

	/**
	 * Finds all items related to a given content-type
	 *
	 * @param siteId      the id of the site
	 * @param contentType the id of the content-type
	 * @return the usage
	 * @throws ServiceLayerException if there is any error finding the items
	 */
	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public ContentTypeUsage getContentTypeUsage(@SiteId String siteId, String contentType) throws ServiceLayerException {
		return contentTypeServiceInternal.getContentTypeUsage(siteId, contentType);
	}

	/**
	 * Finds the preview image for a given content-type
	 *
	 * @param siteId        the id of the site
	 * @param contentTypeId the id of the content-type
	 * @return the preview image file as a pair of path and resource
	 * @throws ServiceLayerException if there is any error finding the items
	 */
	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public ImmutablePair<String, Resource> getContentTypePreviewImage(@SiteId String siteId, String contentTypeId) throws ServiceLayerException {
		return contentTypeServiceInternal.getContentTypePreviewImage(siteId, contentTypeId);
	}

	/**
	 * Deletes all files related to a given content-type
	 *
	 * @param siteId             the id of the site
	 * @param contentType        the id of the content-type
	 * @param deleteDependencies indicates if all dependencies should be deleted
	 * @throws ServiceLayerException   if there is any error deleting the files
	 * @throws AuthenticationException if there is any error authenticating the user
	 */
	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_WRITE_CONFIGURATION)
	public void deleteContentType(@SiteId String siteId, String contentType, boolean deleteDependencies)
		throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		contentTypeServiceInternal.deleteContentType(siteId, contentType, deleteDependencies);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public ImmutablePair<String, Resource> getContentTypeFormController(@SiteId String siteId, String contentTypeId) throws ServiceLayerException {
		return contentTypeServiceInternal.getContentTypeFormController(siteId, contentTypeId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	public Collection<String> getAllModelDefinitions(@SiteId final String site) throws ServiceLayerException {
		return contentTypeServiceInternal.getAllModelDefinitions(site);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<QuickCreateItem> getQuickCreatableContentTypes(@SiteId String siteId) throws ServiceLayerException {
		return contentTypeServiceInternal.getQuickCreatableContentTypes(siteId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Collection<ContentType> getAllContentTypes(@SiteId String siteId) throws ServiceLayerException {
		return contentTypeServiceInternal.getAllContentTypes(siteId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public ContentType getContentType(@SiteId String siteId, String contentTypeId) throws ServiceLayerException {
		return contentTypeServiceInternal.getContentType(siteId, contentTypeId);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Collection<String> getAllowedContentTypes(@SiteId String siteId, @ContentPath String path) throws ServiceLayerException {
		return contentTypeServiceInternal.getAllowedContentTypes(siteId, path);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public boolean isContentTypeAllowed(@SiteId String siteId, @ContentPath String path, String contentTypeId) throws ServiceLayerException {
		return contentTypeServiceInternal.isContentTypeAllowed(siteId, path, contentTypeId);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_READ_CONFIGURATION)
	public String getContentTypeControllerPath(String contentTypeId) {
		return contentTypeServiceInternal.getContentTypeControllerPath(contentTypeId);
	}

	@Override
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public String getContentTypeTemplatePath(@SiteId String siteId, String contentTypeId) throws ServiceLayerException {
		return contentTypeServiceInternal.getContentTypeTemplatePath(siteId, contentTypeId);
	}
}
