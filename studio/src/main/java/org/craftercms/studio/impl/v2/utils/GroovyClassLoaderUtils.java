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
package org.craftercms.studio.impl.v2.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import groovy.lang.GroovyClassLoader;

/**
 * Helpers for releasing {@link GroovyClassLoader} resources.
 */
public abstract class GroovyClassLoaderUtils {

	private static final Logger logger = LoggerFactory.getLogger(GroovyClassLoaderUtils.class);

	/**
	 * Clear and close this classloader and any {@link GroovyClassLoader}
	 * parents.
	 *
	 * @param classLoader the classloader to close (may be null)
	 */
	public static void closeQuietly(ClassLoader classLoader) {
		closeQuietly(classLoader, null);
	}

	/**
	 * Clear and close this classloader and {@link GroovyClassLoader} parents,
	 * stopping before {@code stopAt}.
	 *
	 * @param classLoader the classloader to close (may be null)
	 * @param stopAt parent to leave open; closing stops when this loader is
	 * reached (exclusive). If null, stops at the first
	 * non-{@link GroovyClassLoader} parent.
	 */
	public static void closeQuietly(ClassLoader classLoader, ClassLoader stopAt) {
		while (classLoader instanceof GroovyClassLoader groovyClassLoader) {
			if (classLoader == stopAt) {
				break;
			}
			try {
				groovyClassLoader.close();
			} catch (Exception e) {
				logger.warn("Failed to close Groovy class loader", e);
			}
			classLoader = classLoader.getParent();
		}
	}

}
