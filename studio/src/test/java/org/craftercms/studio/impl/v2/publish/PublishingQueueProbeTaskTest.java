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

import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.junit.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

public class PublishingQueueProbeTaskTest {

	@Test
	public void schedulerStartResetsProcessingPackages() {
		Publisher publisher = mock(Publisher.class);
		PublishingQueueProbeTask task = new PublishingQueueProbeTask(mock(PublishDAO.class), 1);
		task.setPublisher(publisher);

		task.onSchedulerStart();

		verify(publisher).resetProcessingPackages();
	}
}
