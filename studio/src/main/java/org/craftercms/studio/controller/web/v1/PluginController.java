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

package org.craftercms.studio.controller.web.v1;

import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.commons.validation.annotations.param.ValidateSecurePathParam;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import java.beans.ConstructorProperties;

/**
 * Controller that provides the UI with plugin related files
 *
 * @author joseross
 * @since 4.0
 */
@RestController
@RequestMapping("/1/plugin")
public class PluginController {

	/**
	 * The configuration service
	 */
	protected final ConfigurationService configurationService;

	@ConstructorProperties({"configurationService"})
	public PluginController(ConfigurationService configurationService) {
		this.configurationService = configurationService;
	}

	/**
	 * Returns a single file for a given plugin
	 */
	@Valid
	@GetMapping("/{siteId}/file")
	public ResponseEntity<Resource> getPluginFile(@ValidSiteId @PathVariable String siteId,
						      @ValidExistingContentPath @ValidateSecurePathParam @RequestParam String type,
						      @ValidExistingContentPath @ValidateSecurePathParam @RequestParam String name,
						      @ValidExistingContentPath @ValidateSecurePathParam @RequestParam(required = false) String filename,
						      @ValidExistingContentPath @ValidateSecurePathParam String pluginId)
		throws ContentNotFoundException, SiteNotFoundException {
		Resource resource = configurationService.getPluginFile(siteId, pluginId, type, name, filename);

		String contentType = StudioUtils.getMimeType(filename);

		return ResponseEntity
			.ok()
			.header(HttpHeaders.CONTENT_TYPE, contentType)
			.body(resource);
	}

}
