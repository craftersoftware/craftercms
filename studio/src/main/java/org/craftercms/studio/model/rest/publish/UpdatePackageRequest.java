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

package org.craftercms.studio.model.rest.publish;

import static org.craftercms.studio.api.v2.service.publish.PublishService.PACKAGE_COMMENT_MAX_LENGTH;
import static org.craftercms.studio.api.v2.service.publish.PublishService.PACKAGE_TITLE_MAX_LENGTH;

import java.time.Instant;

import jakarta.validation.constraints.Size;

/**
 * Request to update a publish package
 */
public class UpdatePackageRequest {
	private Instant schedule;
	private boolean updateSchedule;
	@Size(max = PACKAGE_COMMENT_MAX_LENGTH)
	private String comment;
	@Size(max = PACKAGE_TITLE_MAX_LENGTH)
	private String title;
	private boolean requestApproval;

	public Instant getSchedule() {
		return schedule;
	}

	public void setSchedule(Instant schedule) {
		this.schedule = schedule;
	}

	public boolean isUpdateSchedule() {
		return updateSchedule;
	}

	public void setUpdateSchedule(boolean updateSchedule) {
		this.updateSchedule = updateSchedule;
	}

	public String getComment() {
		return comment;
	}

	public void setComment(String comment) {
		this.comment = comment;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public boolean isRequestApproval() {
		return requestApproval;
	}

	public void setRequestApproval(boolean requestApproval) {
		this.requestApproval = requestApproval;
	}
}
