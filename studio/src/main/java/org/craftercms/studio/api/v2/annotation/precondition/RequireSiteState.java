/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.api.v2.annotation.precondition;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;

import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * Indicates that the annotated method requires the site state to match
 * the state specified in the annotation value.
 * Annotated method should take a String parameter annotated with {@link SiteId} annotation.
 * If the site is not ready, {@link org.craftercms.studio.api.v2.exception.InvalidSiteStateException} will be thrown.
 */
@Inherited
@Retention(RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface RequireSiteState {

	/**
	 * The required site state
	 */
	String value();
}
