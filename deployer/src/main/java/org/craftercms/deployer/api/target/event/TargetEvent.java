/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.deployer.api.target.event;

import org.craftercms.deployer.api.Target;

/**
 * Interface for events related to a target.
 *
 * @param <T> the type of the payload associated with the event
 */
public interface TargetEvent<T> {

	/**
	 * The target associated with this event.
	 *
	 * @return the target
	 */
	Target target();

	/**
	 * The payload of the event. This is the data that is associated with the event,
	 * to be processed by event listeners.
	 *
	 * @return the payload of the event
	 */
	T payload();

	/**
	 * The type of event. This identifies the specific event that occurred
	 *
	 * @return the event type as a string
	 */
	String eventType();
}
