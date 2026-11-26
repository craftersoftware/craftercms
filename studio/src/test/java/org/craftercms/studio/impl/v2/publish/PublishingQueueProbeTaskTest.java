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

import java.util.Map;

import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.junit.Test;

import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class PublishingQueueProbeTaskTest {

	@Test
	public void schedulerStartResetsProcessingPackages() {
		PublishDAO publishDAO = mock(PublishDAO.class);
		PublishingQueueProbeTask task = task(publishDAO);

		task.doExecute();

		verify(publishDAO).resetProcessingPackages(READY.value, PROCESSING.value);
	}

	@Test
	public void resetProcessingPackagesRunsOnlyOnce() {
		PublishDAO publishDAO = mock(PublishDAO.class);
		PublishingQueueProbeTask task = task(publishDAO);

		task.doExecute();
		task.doExecute();

		verify(publishDAO, times(1)).resetProcessingPackages(READY.value, PROCESSING.value);
	}

	private static PublishingQueueProbeTask task(PublishDAO publishDAO) {
		when(publishDAO.getNextPublishPackages()).thenReturn(Map.of());
		RetryingDatabaseOperationFacade retryingDatabaseOperationFacade = mock(RetryingDatabaseOperationFacade.class);
		doAnswer(invocation -> {
			invocation.getArgument(0, Runnable.class).run();
			return null;
		}).when(retryingDatabaseOperationFacade).retry(any(Runnable.class));
		return new PublishingQueueProbeTask(publishDAO, 1, retryingDatabaseOperationFacade);
	}
}
