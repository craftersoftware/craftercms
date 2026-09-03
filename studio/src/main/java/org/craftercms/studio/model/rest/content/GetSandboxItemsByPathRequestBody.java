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
package org.craftercms.studio.model.rest.content;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Holds data for the getContentItemsByPath request
 *
 * @author joseross
 * @since 4.0
 */
@JsonIgnoreProperties
public class GetSandboxItemsByPathRequestBody {

	@NotEmpty
	private List<@ValidExistingContentPath @NotEmpty String> paths;
	private boolean preferContent;

	public List<String> getPaths() {
		return paths;
	}

	public void setPaths(List<String> paths) {
		this.paths = paths;
	}

	public boolean isPreferContent() {
		return preferContent;
	}

	public void setPreferContent(boolean preferContent) {
		this.preferContent = preferContent;
	}
}
