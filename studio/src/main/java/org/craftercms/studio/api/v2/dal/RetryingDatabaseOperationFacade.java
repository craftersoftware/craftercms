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

package org.craftercms.studio.api.v2.dal;

import java.util.function.Supplier;

@SuppressWarnings("rawtypes")
public interface RetryingDatabaseOperationFacade {

	/**
	 * Retries the database operation {@code op} up to the configured maximum retries.
	 * See {@link org.craftercms.studio.api.v2.annotation.retrying.RetryingDatabaseOperationAnnotationHandler}
	 *
	 * @param op operation to execute
	 */
	void retry(Runnable op);

	/**
	 * Retries the database operation {@code op} up to the configured maximum retries.
	 * See {@link org.craftercms.studio.api.v2.annotation.retrying.RetryingDatabaseOperationAnnotationHandler}
	 *
	 * @param op operation to execute
	 */
	<T> T retry(Supplier<T> op);

}
