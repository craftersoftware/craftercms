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

package org.craftercms.studio.model.rest.marketplace;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.craftercms.commons.plugin.model.Version;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Collections;
import java.util.Map;

/**
 * Holds the information needed to install a plugin from the Marketplace
 *
 * @author joseross
 * @since 4.0.0
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class InstallPluginRequest {

	@NotBlank
	private String pluginId;

	@Valid
	@NotNull
	private Version pluginVersion;

	private Map<String, String> parameters = Collections.emptyMap();

	public String getPluginId() {
		return pluginId;
	}

	public void setPluginId(final String pluginId) {
		this.pluginId = pluginId;
	}

	public Version getPluginVersion() {
		return pluginVersion;
	}

	public void setPluginVersion(final Version pluginVersion) {
		this.pluginVersion = pluginVersion;
	}

	public Map<String, String> getParameters() {
		return parameters;
	}

	public void setParameters(Map<String, String> parameters) {
		this.parameters = parameters;
	}

}
