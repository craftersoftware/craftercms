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

import java.util.Set;

import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.commons.validation.annotations.param.ValidateSecurePathParam;
import static org.craftercms.studio.api.v2.service.publish.PublishService.PACKAGE_COMMENT_MAX_LENGTH;
import static org.craftercms.studio.api.v2.service.publish.PublishService.PACKAGE_TITLE_MAX_LENGTH;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Request body for deleting content items.
 */
public class DeleteRequestBody {

	@NotEmpty
	private Set<@NotEmpty @ValidExistingContentPath @ValidateSecurePathParam String> items;

	// title and comment are used to create a publish package for the delete
	@NotEmpty
	@Size(max = PACKAGE_TITLE_MAX_LENGTH)
	private String title;
	@Size(max = PACKAGE_COMMENT_MAX_LENGTH)
	private String comment;

	public Set<String> getItems() {
		return items;
	}

	public void setItems(Set<String> items) {
		this.items = items;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(final String title) {
		this.title = title;
	}

	public String getComment() {
		return comment;
	}

	public void setComment(String comment) {
		this.comment = comment;
	}
}
