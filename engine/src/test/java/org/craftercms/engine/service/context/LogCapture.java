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

package org.craftercms.engine.service.context;

import org.apache.commons.lang3.exception.ExceptionUtils;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.config.LoggerConfig;
import org.apache.logging.log4j.core.config.Property;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Captures the log events of one logger while open. The logger's configuration is restored on close.
 */
class LogCapture extends AbstractAppender implements AutoCloseable {

	private static final AtomicInteger INSTANCES = new AtomicInteger();

	private final LoggerContext context;
	private final String loggerName;
	private final LoggerConfig loggerConfig;
	private final boolean createdLoggerConfig;
	private final Level previousLevel;
	private final List<String> events = new CopyOnWriteArrayList<>();
	private final List<String> thrown = new CopyOnWriteArrayList<>();

	LogCapture(Class<?> type, Level level) {
		super("LogCapture-" + type.getSimpleName() + "-" + INSTANCES.incrementAndGet(), null, null, true,
			Property.EMPTY_ARRAY);
		this.context = LoggerContext.getContext(false);
		this.loggerName = type.getName();
		Configuration config = context.getConfiguration();
		LoggerConfig existing = config.getLoggers().get(loggerName);
		this.createdLoggerConfig = existing == null;
		if (createdLoggerConfig) {
			this.loggerConfig = new LoggerConfig(loggerName, level, true);
			this.previousLevel = null;
			config.addLogger(loggerName, loggerConfig);
		} else {
			this.loggerConfig = existing;
			this.previousLevel = existing.getLevel();
			existing.setLevel(level);
		}
		start();
		loggerConfig.addAppender(this, null, null);
		context.updateLoggers();
	}

	@Override
	public void append(LogEvent event) {
		events.add(event.getLevel() + " " + event.getMessage().getFormattedMessage());
		if (event.getThrown() != null) {
			thrown.add(ExceptionUtils.getStackTrace(event.getThrown()));
		}
	}

	/**
	 * Returns each event as {@code LEVEL message}.
	 */
	List<String> events() {
		return List.copyOf(events);
	}

	/**
	 * Returns every captured message plus the stack traces of logged exceptions.
	 */
	String allText() {
		return String.join("\n", events) + "\n" + String.join("\n", thrown);
	}

	@Override
	public void close() {
		loggerConfig.removeAppender(getName());
		if (createdLoggerConfig) {
			context.getConfiguration().removeLogger(loggerName);
		} else {
			loggerConfig.setLevel(previousLevel);
		}
		context.updateLoggers();
		stop();
	}

}
