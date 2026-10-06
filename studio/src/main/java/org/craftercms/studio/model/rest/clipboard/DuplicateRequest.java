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
package org.craftercms.studio.model.rest.clipboard;

import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;

import jakarta.validation.constraints.NotEmpty;

/**
 * Holds all the data needed to duplicate an item
 *
 * @author joseross
 * @since 3.2
 */
public class DuplicateRequest {

	/**
	 * The path of the item
	 */
	@NotEmpty
	@ValidExistingContentPath
	protected String path;

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

}
