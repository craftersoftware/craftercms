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

package org.craftercms.studio.model.rest.workflow;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class ItemStatesPostRequestBody {

	@NotEmpty
	private List<@NotBlank @ValidExistingContentPath String> items;

	@NotNull
	@JsonUnwrapped
	private ItemStatesUpdate update;

	public List<String> getItems() {
		return items;
	}

	public void setItems(List<String> items) {
		this.items = items;
	}

	public ItemStatesUpdate getUpdate() {
		return update;
	}

	public void setUpdate(ItemStatesUpdate update) {
		this.update = update;
	}
}
