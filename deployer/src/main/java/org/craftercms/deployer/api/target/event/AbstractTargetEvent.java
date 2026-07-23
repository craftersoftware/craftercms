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
 * Abstract base class for target events that carry a payload.
 *
 * @param <T> the type of the payload
 */
public abstract class AbstractTargetEvent<T> implements TargetEvent<T> {

	private final T payload;
	private final Target target;

	/**
	 * Constructor for creating an event with a target and a payload.
	 *
	 * @param target  the target associated with the event
	 * @param payload the payload of the event, which can be any type. The payload
	 *                is typically used to carry additional data relevant to the event.
	 */
	public AbstractTargetEvent(Target target, T payload) {
		this.target = target;
		this.payload = payload;
	}

	public T payload() {
		return payload;
	}

	@Override
	public Target target() {
		return target;
	}
}
