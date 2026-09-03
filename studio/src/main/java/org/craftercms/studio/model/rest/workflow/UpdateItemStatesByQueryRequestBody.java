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

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.craftercms.commons.validation.annotations.param.ValidateNoTagsParam;
import org.craftercms.commons.validation.annotations.param.ValidateSecurePathParam;

public class UpdateItemStatesByQueryRequestBody {

	@Valid
	@NotNull
	private Query query;
	@Valid
	@NotNull
	private ItemStatesUpdate update;

	public Query getQuery() {
		return query;
	}

	public void setQuery(Query query) {
		this.query = query;
	}

	public ItemStatesUpdate getUpdate() {
		return update;
	}

	public void setUpdate(ItemStatesUpdate update) {
		this.update = update;
	}

	public static class Query {
		/**
		 * Content path regex
		 */
		@ValidateSecurePathParam
		@ValidateNoTagsParam
		private String path;

		private Long states;

		public String getPath() {
			return path;
		}

		public void setPath(String path) {
			this.path = path;
		}

		public Long getStates() {
			return states;
		}

		public void setStates(Long states) {
			this.states = states;
		}
	}
}
