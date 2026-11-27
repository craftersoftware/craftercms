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

package org.craftercms.studio.controller.rest.v2;

import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.workflow.WorkflowService;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.PaginatedResultList;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class WorkflowControllerTest {

	private static final String SITE_ID = "editorial";
	private static final String PATH = "/site/website/.*";

	@Mock
	private WorkflowService workflowService;
	@Mock
	private PublishService publishService;

	private WorkflowController controller;

	@Before
	public void setUp() {
		controller = new WorkflowController(workflowService, publishService);
	}

	@Test
	public void nullPathReturnsAllItemStates() throws Exception {
		when(workflowService.getItemStatesTotal(SITE_ID, (Long) null)).thenReturn(2);
		when(workflowService.getItemsByStates(SITE_ID, (Long) null, 0, 10)).thenReturn(List.of(new ContentItem()));

		PaginatedResultList<ContentItem> result = controller.getItemStates(SITE_ID, null, null, 0, 10);

		assertSame(ApiResponse.OK, result.getResponse());
		assertEquals(2L, result.getTotal());
		assertEquals(1, result.getLimit());
		verify(workflowService).getItemStatesTotal(SITE_ID, (Long) null);
		verify(workflowService).getItemsByStates(SITE_ID, (Long) null, 0, 10);
	}

	@Test
	public void emptyPathIsRejected() {
		assertThrows(InvalidParametersException.class, () -> controller.getItemStates(SITE_ID, "", null, 0, 10));

		verifyNoInteractions(workflowService);
	}

	@Test
	public void blankPathIsRejected() {
		assertThrows(InvalidParametersException.class, () -> controller.getItemStates(SITE_ID, "  ", null, 0, 10));

		verifyNoInteractions(workflowService);
	}

	@Test
	public void invalidPathRegexIsRejected() {
		assertThrows(InvalidParametersException.class, () -> controller.getItemStates(SITE_ID, "[", null, 0, 10));

		verifyNoInteractions(workflowService);
	}

	@Test
	public void validPathIsQueried() throws Exception {
		when(workflowService.getItemStatesTotal(SITE_ID, PATH, null)).thenReturn(2);
		when(workflowService.getItemsByStates(SITE_ID, PATH, null, 0, 10)).thenReturn(List.of(new ContentItem()));

		PaginatedResultList<ContentItem> result = controller.getItemStates(SITE_ID, PATH, null, 0, 10);

		assertSame(ApiResponse.OK, result.getResponse());
		assertEquals(2L, result.getTotal());
		assertEquals(1, result.getLimit());
		verify(workflowService).getItemStatesTotal(SITE_ID, PATH, null);
		verify(workflowService).getItemsByStates(SITE_ID, PATH, null, 0, 10);
	}
}
