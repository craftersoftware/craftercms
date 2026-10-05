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
package org.craftercms.engine.exception;

/**
 * Interface to be implemented by exceptions that want to expose an HTTP status
 * code to the response.
 * This is kept even if now exists in core to avoid breaking changes.
 *
 * @author Alfonso Vásquez
 * @deprecated since 4.2.3. Use org.craftercms.core.exception.HttpStatusCodeAwareException instead.
 */
@Deprecated
public interface HttpStatusCodeAwareException extends org.craftercms.core.exception.HttpStatusCodeAwareException {

	int getStatusCode();

}
