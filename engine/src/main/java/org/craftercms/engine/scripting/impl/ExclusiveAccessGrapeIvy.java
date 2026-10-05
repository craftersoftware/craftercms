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
package org.craftercms.engine.scripting.impl;

import groovy.grape.Grape;
import groovy.grape.ivy.GrapeIvy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Field;
import java.util.Map;

/**
 * {@link GrapeIvy} extension that synchronizes the grab method to allow access to a single thread at a time.
 * Exclusive access is meant to prevent race conditions when multiple threads try to grab the same dependencies at the same time.
 * That happens during site context creation when multiple sites that have the same dependencies in Grab annotations are
 * being created concurrently.
 */
public class ExclusiveAccessGrapeIvy extends GrapeIvy {

	Logger logger = LoggerFactory.getLogger(ExclusiveAccessGrapeIvy.class);

	@SuppressWarnings("unused")
	public void register() throws NoSuchFieldException, IllegalAccessException {
		Field instanceField = Grape.class.getDeclaredField("instance");
		instanceField.setAccessible(true);
		instanceField.set(null, this);
	}

	@Override
	public synchronized Object grab(Map args, Map... dependencies) {
		logger.debug("Grabbing {} dependencies", dependencies == null ? 0 : dependencies.length);
		return super.grab(args, dependencies);
	}
}
