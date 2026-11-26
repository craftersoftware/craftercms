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
package org.craftercms.studio.impl.v2.publish;

import java.util.List;
import java.util.Map;

import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackageId;
import org.craftercms.studio.api.v2.event.publish.RequestPublishEvent;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class PublishingQueueProbeTaskTest {

	private static final String SITE_ID = "site";

	@Test
	public void probeRequestsQueuedPackages() {
		PublishDAO publishDAO = mock(PublishDAO.class);
		ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
		when(publishDAO.getNextPublishPackages())
				.thenReturn(Map.of(SITE_ID, List.of(new PublishPackageId(SITE_ID, 1L), new PublishPackageId(SITE_ID, 2L))));

		task(publishDAO, eventPublisher).doExecute();

		ArgumentCaptor<RequestPublishEvent> captor = ArgumentCaptor.forClass(RequestPublishEvent.class);
		verify(eventPublisher).publishEvent(captor.capture());
		assertEquals(SITE_ID, captor.getValue().getSiteId());
		assertEquals(List.of(1L, 2L), List.copyOf(captor.getValue().getPackageIds()));
	}

	private static PublishingQueueProbeTask task(PublishDAO publishDAO, ApplicationEventPublisher eventPublisher) {
		PublishingQueueProbeTask task = new PublishingQueueProbeTask(publishDAO, 1);
		task.setApplicationEventPublisher(eventPublisher);
		return task;
	}
}
