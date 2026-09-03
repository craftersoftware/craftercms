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

package org.craftercms.studio.model.rest;

import org.craftercms.commons.validation.annotations.param.EsapiValidatedParam;
import org.craftercms.commons.validation.annotations.param.ValidConfigurationPath;
import org.craftercms.studio.model.validation.annotations.ConfigurableMax;

import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.ALPHANUMERIC;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MAX_CONFIGURATION_LENGTH;

public class WriteConfigurationRequest {

	@EsapiValidatedParam(type = ALPHANUMERIC)
	private String module;
	@ValidConfigurationPath
	private String path;
	@EsapiValidatedParam(type = ALPHANUMERIC)
	private String environment;
	@ConfigurableMax(CONFIGURATION_MAX_CONFIGURATION_LENGTH)
	private String content;

	public String getModule() {
		return module;
	}

	public void setModule(String module) {
		this.module = module;
	}

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	public String getEnvironment() {
		return environment;
	}

	public void setEnvironment(String environment) {
		this.environment = environment;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}
}
