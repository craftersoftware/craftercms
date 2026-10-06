/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.craftercms.core.controller.rest;

import java.util.Map;

import org.craftercms.core.exception.AuthenticationException;
import org.craftercms.core.exception.PathNotFoundException;
import org.junit.Before;
import org.junit.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.ServletWebRequest;

import static org.craftercms.core.controller.rest.RestControllerBase.MESSAGE_MODEL_ATTRIBUTE_NAME;
import static org.junit.Assert.assertEquals;

/**
 * Tests for {@link ExceptionHandlers}
 *
 * @author joseross
 */
public class ExceptionHandlersTest {

	private ExceptionHandlers exceptionHandler;

	private MockHttpServletRequest request;

	private MockHttpServletResponse response;

	private ServletWebRequest webRequest;

	@Before
	public void setUp() throws Exception {
		setUpTestExceptionHandler();
		setUpTestRequest();
		setUpTestResponse();
		setUpTestWebRequest();
	}

	private void setUpTestExceptionHandler() {
		exceptionHandler = new ExceptionHandlers();
	}

	private void setUpTestRequest() {
		request = new MockHttpServletRequest();
		request.setMethod("GET");
	}

	private void setUpTestResponse() {
		response = new MockHttpServletResponse();
	}

	private void setUpTestWebRequest() {
		webRequest = new ServletWebRequest(request, response);
	}

	@Test
	public void testHandleAuthenticationException() {
		AuthenticationException ex = new AuthenticationException("This is a test");

        Map<String, Object> model = exceptionHandler.handleAuthenticationException(request, response, ex);
        assertEquals(ex.getMessage(), model.get(MESSAGE_MODEL_ATTRIBUTE_NAME));
    }

	@Test
	public void testHandlePathNotFoundException() {
		PathNotFoundException ex = new PathNotFoundException("This is a test");

        Map<String, Object> model = exceptionHandler.handlePathNotFoundException(request, response, ex);
        assertEquals(ex.getMessage(), model.get(MESSAGE_MODEL_ATTRIBUTE_NAME));
    }

	@Test
	public void testHandleException() {
		Exception ex = new Exception("This is a test");

        Map<String, Object> model = exceptionHandler.handleException(request, response, ex);
        assertEquals(ex.getMessage(), model.get(MESSAGE_MODEL_ATTRIBUTE_NAME));
    }

}
