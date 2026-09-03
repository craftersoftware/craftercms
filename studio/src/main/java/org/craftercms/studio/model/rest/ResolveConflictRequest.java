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

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.studio.api.v2.service.repository.ConflictResolution;

public class ResolveConflictRequest {

	@NotEmpty
	@ValidExistingContentPath
	private String path;
	@NotNull
	private ConflictResolution resolution;

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	public ConflictResolution getResolution() {
		return resolution;
	}

	public void setResolution(ConflictResolution resolution) {
		this.resolution = resolution;
	}
}
