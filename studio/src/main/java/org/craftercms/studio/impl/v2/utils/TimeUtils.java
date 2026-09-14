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

package org.craftercms.studio.impl.v2.utils;

import org.craftercms.studio.api.v2.utils.function.ThrowingRunnable;
import org.slf4j.Logger;
import org.slf4j.event.Level;
import org.slf4j.spi.LoggingEventBuilder;
import org.springframework.util.function.ThrowingSupplier;

public class TimeUtils {
	/**
	 * High order function to inject execution time if the given logger level is enabled.
	 * Instead of this method, use {@link org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime} annotation when possible
	 *
	 * @param supplier     method to calculate the execution time
	 * @param methodLogger logger of the method
	 * @param message      a message to flag the execution method
	 * @param level        the log level
	 * @param <T>          generic type of the method return value
	 * @return the result of the method
	 */
	public static <T> T logExecutionTimeThrowing(ThrowingSupplier<T> supplier, Logger methodLogger, String message, Level level) throws Exception {
		long startTime = 0;
		if (methodLogger.isEnabledForLevel(level)) {
			startTime = System.currentTimeMillis();
		}
		T result = supplier.getWithException();
		if (methodLogger.isEnabledForLevel(level)) {
			LoggingEventBuilder loggingEventBuilder = methodLogger.atLevel(level);
			loggingEventBuilder.log("{} executed in '{}' milliseconds", message, System.currentTimeMillis() - startTime);
		}
		return result;
	}

	/**
	 * High order function to inject execution time if the given logger level is enabled.
	 * Instead of this method, use {@link org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime} annotation when possible
	 *
	 * @param action       method to calculate the execution time
	 * @param methodLogger logger of the method
	 * @param message      a message to flag the execution method
	 * @param level        the log level
	 */
	public static void logExecutionTimeThrowing(ThrowingRunnable action, Logger methodLogger, String message, Level level) throws Exception {
		logExecutionTimeThrowing(() -> {
			action.run();
			return null;
		}, methodLogger, message, level);
	}

	/**
	 * High order function to inject execution time if the given logger level is enabled.
	 * Instead of this method, use {@link org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime} annotation when possible
	 *
	 * @param action       method to calculate the execution time
	 * @param methodLogger logger of the method
	 * @param message      a message to flag the execution method
	 */
	public static void logExecutionTime(ThrowingRunnable action, Logger methodLogger, String message, Level level) {
		logExecutionTime(() -> {
			action.run();
			return null;
		}, methodLogger, message, level);
	}

	/**
	 * High order function to inject execution time if the given logger level is enabled.
	 * Instead of this method, use {@link org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime} annotation when possible
	 *
	 * @param supplier     method to calculate the execution time for
	 * @param methodLogger logger of the method
	 * @param message      a message to flag the execution method
	 * @param level        the log level
	 */
	public static <T> T logExecutionTime(ThrowingSupplier<T> supplier, Logger methodLogger, String message, Level level) {
		try {
			return logExecutionTimeThrowing(supplier, methodLogger, message, level);
		} catch (RuntimeException e) {
			throw e;
		} catch (Exception e) {
			throw new RuntimeException(e.getMessage(), e);
		}
	}

	/**
	 * High order function to inject execution time if the logger is enabled trace.
	 * Instead of this method, use {@link org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime} annotation when possible
	 *
	 * @param supplier method to calculate the execution time for
	 * @param logger   logger of the method
	 * @param message  a message to flag the execution method
	 */
	public static <T> T logExecutionTime(ThrowingSupplier<T> supplier, Logger logger, String message) {
		return logExecutionTime(supplier, logger, message, Level.TRACE);
	}

	/**
	 * High order function to inject execution time if the logger is enabled trace.
	 * Instead of this method, use {@link org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime} annotation when possible
	 *
	 * @param action  method to calculate the execution time for
	 * @param logger  logger of the method
	 * @param message a message to flag the execution method
	 */
	public static void logExecutionTime(ThrowingRunnable action, Logger logger, String message) {
		logExecutionTime(() -> {
			action.run();
			return null;
		}, logger, message, Level.TRACE);
	}

	/**
	 * High order function to inject execution time if the logger is enabled trace.
	 * Instead of this method, use {@link org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime} annotation when possible
	 *
	 * @param action       method to calculate the execution time
	 * @param methodLogger logger of the method
	 * @param message      a message to flag the execution method
	 * @throws Exception if the action throws an exception
	 */
	public static void logExecutionTimeThrowing(ThrowingRunnable action, Logger methodLogger, String message) throws Exception {
		logExecutionTimeThrowing(() -> {
			action.run();
			return null;
		}, methodLogger, message, Level.TRACE);
	}
}
