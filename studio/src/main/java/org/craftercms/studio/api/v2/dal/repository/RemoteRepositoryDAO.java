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

package org.craftercms.studio.api.v2.dal.repository;

import org.apache.ibatis.annotations.Param;

import java.util.Map;

import static org.craftercms.studio.api.v2.dal.QueryParameterNames.REPOSITORY;
import static org.craftercms.studio.api.v2.dal.QueryParameterNames.SITE_ID;

public interface RemoteRepositoryDAO {

	RemoteRepository getRemoteRepository(Map params);

	/**
	 * Inserts a new remote repository.
	 *
	 * @param siteId     the site ID
	 * @param repository the remote repository to insert
	 */
	void insertRemoteRepository(@Param(SITE_ID) String siteId, @Param(REPOSITORY) RemoteRepository repository);

	void deleteRemoteRepository(Map params);
}
