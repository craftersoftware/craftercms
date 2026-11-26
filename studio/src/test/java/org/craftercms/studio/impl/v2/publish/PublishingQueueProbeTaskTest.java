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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class PublishingQueueProbeTaskTest {

	private static final String SITE_ID = "site";

	@Test
	public void probeDoesNothingBeforeTheResetIsAttempted() {
		PublishDAO publishDAO = mock(PublishDAO.class);
		ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
		ProcessingPackagesReset reset = mock(ProcessingPackagesReset.class);
		when(reset.isResetAttempted()).thenReturn(false);

		task(publishDAO, reset, eventPublisher).doExecute();

		verifyNoInteractions(publishDAO);
		verifyNoInteractions(eventPublisher);
	}

	@Test
	public void probeRequestsQueuedPackagesOnceTheResetIsAttempted() {
		PublishDAO publishDAO = mock(PublishDAO.class);
		ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
		ProcessingPackagesReset reset = mock(ProcessingPackagesReset.class);
		when(reset.isResetAttempted()).thenReturn(true);
		when(publishDAO.getNextPublishPackages())
				.thenReturn(Map.of(SITE_ID, List.of(new PublishPackageId(SITE_ID, 1L), new PublishPackageId(SITE_ID, 2L))));

		task(publishDAO, reset, eventPublisher).doExecute();

		ArgumentCaptor<RequestPublishEvent> captor = ArgumentCaptor.forClass(RequestPublishEvent.class);
		verify(eventPublisher).publishEvent(captor.capture());
		assertEquals(SITE_ID, captor.getValue().getSiteId());
		assertEquals(List.of(1L, 2L), List.copyOf(captor.getValue().getPackageIds()));
	}

	@Test
	public void probeNeverResetsPackages() {
		PublishDAO publishDAO = mock(PublishDAO.class);
		ProcessingPackagesReset reset = mock(ProcessingPackagesReset.class);
		when(reset.isResetAttempted()).thenReturn(true);
		when(publishDAO.getNextPublishPackages()).thenReturn(Map.of());
		PublishingQueueProbeTask task = task(publishDAO, reset, mock(ApplicationEventPublisher.class));

		task.doExecute();
		task.doExecute();

		verify(publishDAO, never()).resetProcessingPackages(anyLong(), anyLong());
		verify(reset, never()).resetProcessingPackages();
	}

	private static PublishingQueueProbeTask task(PublishDAO publishDAO, ProcessingPackagesReset reset,
												 ApplicationEventPublisher eventPublisher) {
		PublishingQueueProbeTask task = new PublishingQueueProbeTask(publishDAO, 1, reset);
		task.setApplicationEventPublisher(eventPublisher);
		return task;
	}
}
