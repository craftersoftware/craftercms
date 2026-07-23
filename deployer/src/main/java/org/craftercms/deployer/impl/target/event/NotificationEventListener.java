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

import org.apache.commons.configuration2.Configuration;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.commons.notification.NotificationSender;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.craftercms.deployer.api.target.event.TargetEvent;
import org.craftercms.deployer.api.target.event.TargetEventListener;
import org.springframework.context.ApplicationContext;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Map;

import static org.craftercms.commons.config.ConfigUtils.getRequiredStringProperty;
import static org.craftercms.commons.config.ConfigUtils.getStringProperty;
import static org.craftercms.deployer.impl.DeploymentConstants.*;

/**
 * Abstract base class for {@link TargetEventListener} that send notifications
 */
public class NotificationEventListener implements TargetEventListener {

	public static final String EVENT_MODEL_KEY = "event";
	public static final String TARGET_MODEL_KEY = "target";

	private NotificationSender<?> notificationSender;

	// Config properties (populated on init)
	protected String templateName;
	protected String serverName;

	@Override
	public void init(Configuration config, ApplicationContext applicationContext) throws ConfigurationException, DeployerException {
		templateName = getRequiredStringProperty(config, TARGET_EVENT_LISTENER_TEMPLATE_NAME);

		if (StringUtils.isEmpty(templateName)) {
			throw new ConfigurationException("The '" + TARGET_EVENT_LISTENER_TEMPLATE_NAME + "' property is required for NotificationEventListener");
		}

		serverName = getStringProperty(config, SERVER_NAME_CONFIG_KEY);
		if (StringUtils.isEmpty(serverName)) {
			try {
				serverName = InetAddress.getLocalHost().getHostName();
			} catch (UnknownHostException e) {
				throw new DeployerException("Unable to retrieve localhost address", e);
			}
		}

		String senderName = getRequiredStringProperty(config, TARGET_EVENT_LISTENER_SENDER);
		notificationSender = applicationContext.getBean(senderName, NotificationSender.class);
		notificationSender.init(config);
	}

	@Override
	public void handle(TargetEvent<?> event) throws DeployerException {
		Map<String, Object> model = Map.of(
				EVENT_MODEL_KEY, event,
				TARGET_MODEL_KEY, event.target()
		);
		try {
			notificationSender.sendMessage(templateName, event.payload(), model);
		} catch (Exception e) {
			throw new DeployerException("Error sending notification for event: " + event, e);
		}
	}
}
