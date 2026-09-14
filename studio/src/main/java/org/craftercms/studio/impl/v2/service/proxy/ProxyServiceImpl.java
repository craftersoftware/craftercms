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

package org.craftercms.studio.impl.v2.service.proxy;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.service.proxy.ProxyService;
import org.craftercms.studio.permissions.StudioPermissionsConstants;
import org.springframework.http.ResponseEntity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.beans.ConstructorProperties;
import java.net.URISyntaxException;

/**
 * Default implementation for {@link ProxyService}.
 */
public class ProxyServiceImpl implements ProxyService {

	protected final ProxyService proxyServiceInternal;

	@ConstructorProperties({"proxyServiceInternal"})
	public ProxyServiceImpl(final ProxyService proxyServiceInternal) {
		this.proxyServiceInternal = proxyServiceInternal;
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = StudioPermissionsConstants.PERMISSION_VIEW_LOGS)
	public ResponseEntity<Object> getSiteLogEvents(final String body,
						       @SiteId final String siteId,
						       final HttpServletRequest request) throws URISyntaxException, SiteNotFoundException {
		return proxyEngine(body, siteId, request);
	}

	@Override
	@Valid
	@RequireSiteReady
	public ResponseEntity<Object> proxyEngine(final String body, @NotEmpty @SiteId final String siteId,
						  final HttpServletRequest request) throws URISyntaxException, SiteNotFoundException {
		return proxyServiceInternal.proxyEngine(body, siteId, request);
	}
}
