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

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.Logger;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Captures the log events of one logger while open.
 */
class LogCapture extends AbstractAppender implements AutoCloseable {

	private final Logger logger;
	private final Level previousLevel;
	private final List<String> events = new CopyOnWriteArrayList<>();

	LogCapture(Class<?> type, Level level) {
		super("LogCapture-" + type.getSimpleName(), null, null, true, Property.EMPTY_ARRAY);
		this.logger = (Logger) LogManager.getLogger(type);
		this.previousLevel = logger.getLevel();
		start();
		logger.addAppender(this);
		logger.setLevel(level);
	}

	@Override
	public void append(LogEvent event) {
		events.add(event.getLevel() + " " + event.getMessage().getFormattedMessage());
	}

	List<String> events() {
		return List.copyOf(events);
	}

	@Override
	public void close() {
		logger.removeAppender(this);
		logger.setLevel(previousLevel);
		stop();
	}

}
