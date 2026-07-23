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

package org.craftercms.deployer.impl.target.event;

import org.craftercms.deployer.api.Deployment;
import org.craftercms.deployer.api.Target;
import org.craftercms.deployer.api.target.event.AbstractTargetEvent;

/**
 * Event to be triggered when a deployment has been running for longer
 * than the configured threshold for the target
 */
public class DeploymentRuntimeWarningEvent extends AbstractTargetEvent<Deployment> {

	private final long runtime;

	/**
	 * Constructor for the event.
	 *
	 * @param target  the target where the event is being triggered
	 * @param payload the deployment that is running longer than expected
	 * @param runtime the runtime in milliseconds
	 */
	public DeploymentRuntimeWarningEvent(Target target, Deployment payload, long runtime) {
		super(target, payload);
		this.runtime = runtime;
	}

	@Override
	public String eventType() {
		return "deploymentRuntimeWarning";
	}

	public long getRuntime() {
		return runtime;
	}
}
