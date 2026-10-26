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

package org.craftercms.studio.model;

public class Site {

	private final String siteId;
	private final String uuid;
	private final String name;
	private final String desc;
	private final String state;
	private final boolean stagingEnabled;

	public Site(org.craftercms.studio.api.v2.dal.Site site) {
		siteId = site.getSiteId();
		uuid = site.getSiteUuid();
		name = site.getName();
		desc = site.getDescription();
		state = site.getState();
		stagingEnabled = site.isStagingEnabled();
	}

	public String getDesc() {
		return desc;
	}

	public String getName() {
		return name;
	}

	public String getSiteId() {
		return siteId;
	}

	public String getState() {
		return state;
	}

	public String getUuid() {
		return uuid;
	}

	public boolean isStagingEnabled() {
		return stagingEnabled;
	}
}
