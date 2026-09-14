/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.impl.v2.service.clipboard;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireContentExists;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPath;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.service.clipboard.ClipboardService;
import org.craftercms.studio.model.clipboard.Operation;

import java.beans.ConstructorProperties;
import java.util.List;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_WRITE;

/**
 * Default implementation of {@link ClipboardService}
 *
 * @author joseross
 * @since 3.2
 */
public class ClipboardServiceImpl implements ClipboardService {

	protected final ClipboardService clipboardServiceInternal;

	@ConstructorProperties({"clipboardServiceInternal"})
	public ClipboardServiceImpl(ClipboardService clipboardServiceInternal) {
		this.clipboardServiceInternal = clipboardServiceInternal;
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_WRITE)
	public List<String> pasteItems(@SiteId String siteId, Operation operation,
								   @ContentPath String targetPath, String sourcePath, boolean includeChildren)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		return clipboardServiceInternal.pasteItems(siteId, operation, targetPath, sourcePath, includeChildren);
	}

	@Override
	@RequireSiteReady
	@RequireContentExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_WRITE)
	public String duplicateItem(@SiteId String siteId,
				    @ContentPath String path)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		return clipboardServiceInternal.duplicateItem(siteId, path);
	}
}
