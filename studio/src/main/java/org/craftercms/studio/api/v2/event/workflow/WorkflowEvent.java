/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.api.v2.event.workflow;

import org.craftercms.studio.api.v2.event.SiteAwareEvent;
import org.craftercms.studio.api.v2.event.SiteBroadcastEvent;
import org.springframework.security.core.Authentication;

import static java.lang.String.format;

/**
 * Event triggered when items go through the different workflow states
 *
 * <p><b>Note:</b>For now this is triggered for any state change</p>
 *
 * @author joseross
 * @since 4.0.0
 */
public class WorkflowEvent extends SiteAwareEvent implements SiteBroadcastEvent {

	private final WorkFlowEventType eventType;
	private final long packageId;

	public WorkflowEvent(Authentication authentication, final String siteId, final long packageId, final WorkFlowEventType eventType) {
		super(authentication, siteId);
		this.eventType = eventType;
		this.packageId = packageId;
	}

	public WorkflowEvent(final String siteId, final long packageId, final WorkFlowEventType eventType) {
		this(null, siteId, packageId, eventType);
	}

	@Override
	public String getEventType() {
		return format("WORKFLOW_EVENT_%s", eventType.name());
	}

	public WorkFlowEventType getWorkflowEventType() {
		return eventType;
	}

	public long getPackageId() {
		return packageId;
	}

	@Override
	public String toString() {
		return "WorkflowEvent{" +
			"siteId='" + siteId + '\'' +
			", timestamp=" + timestamp +
			", user=" + user +
			", type=" + eventType +
			", packageId=" + packageId +
			'}';
	}

	/**
	 * The different types of workflow events
	 */
	public enum WorkFlowEventType {
		SUBMIT, // When an item is submitted requesting for approval
		DIRECT_PUBLISH, // When an item is directly published/scheduled by an user with the right permissions
		APPROVE, // When an item is approved
		REJECT, // When an item is rejected
		CANCEL, // When an item is canceled
		UPDATE, // When a published package is updated
	}

}
