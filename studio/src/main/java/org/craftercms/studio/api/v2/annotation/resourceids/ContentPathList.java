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

package org.craftercms.studio.api.v2.annotation.resourceids;

import org.craftercms.commons.security.permissions.annotations.ProtectedResourceId;

import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.ANNOTATION_TYPE;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.RetentionPolicy.RUNTIME;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PATH_LIST_RESOURCE_ID;

/**
 * Annotation to mark the parameter containing the value of the list of paths
 */
@Inherited
@Target({PARAMETER, ANNOTATION_TYPE})
@Retention(RUNTIME)
@ProtectedResourceId(PATH_LIST_RESOURCE_ID)
public @interface ContentPathList {
}
