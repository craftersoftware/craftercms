/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.engine.service.context;

import java.util.Collection;

/**
 * Resolves the entire list of sites.
 *
 * @author avasquez
 */
public interface SiteListResolver {

	/**
	 * Returns the entire list of sites.
	 * <p>
	 * An empty collection means there are no sites. {@code null} means this resolver is not configured.
	 * An actual failure is thrown.
	 *
	 * @return the site names, or {@code null} when this resolver is not configured
	 */
	Collection<String> getSiteList();

}
