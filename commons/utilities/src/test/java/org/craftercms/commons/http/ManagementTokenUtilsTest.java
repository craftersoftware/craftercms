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
package org.craftercms.commons.http;

import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.rest.ManagementToken;
import org.junit.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class ManagementTokenUtilsTest {

	private static final String CONFIGURED_TOKEN = "configured-token";

	@Test
	public void headerMatchIsAccepted() throws InvalidManagementTokenException {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.addHeader(ManagementToken.HEADER_NAME, CONFIGURED_TOKEN);

		ManagementTokenUtils.validateToken(request, CONFIGURED_TOKEN);
	}

	@Test
	public void queryMatchIsAcceptedWhenHeaderIsAbsent() throws InvalidManagementTokenException {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setParameter(ManagementToken.QUERY_PARAMETER, CONFIGURED_TOKEN);

		ManagementTokenUtils.validateToken(request, CONFIGURED_TOKEN);
	}

	@Test
	public void blankHeaderDoesNotFallBackToQuery() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.addHeader(ManagementToken.HEADER_NAME, "");
		request.setParameter(ManagementToken.QUERY_PARAMETER, CONFIGURED_TOKEN);

		InvalidManagementTokenException exception = assertThrows(InvalidManagementTokenException.class,
			() -> ManagementTokenUtils.validateToken(request, CONFIGURED_TOKEN));
		assertEquals(ManagementTokenUtils.INVALID_MANAGEMENT_TOKEN_MESSAGE, exception.getMessage());
	}

	@Test
	public void wrongTokenIsRejected() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.addHeader(ManagementToken.HEADER_NAME, "wrong");

		assertThrows(InvalidManagementTokenException.class,
			() -> ManagementTokenUtils.validateToken(request, CONFIGURED_TOKEN));
	}

	@Test
	public void missingTokenIsRejected() {
		assertThrows(InvalidManagementTokenException.class,
			() -> ManagementTokenUtils.validateToken(new MockHttpServletRequest(), CONFIGURED_TOKEN));
		assertThrows(InvalidManagementTokenException.class,
			() -> ManagementTokenUtils.validateToken((String) null, CONFIGURED_TOKEN));
		assertThrows(InvalidManagementTokenException.class,
			() -> ManagementTokenUtils.validateToken("", CONFIGURED_TOKEN));
	}

	@Test
	public void suppliedTokenMustMatch() throws InvalidManagementTokenException {
		ManagementTokenUtils.validateToken(CONFIGURED_TOKEN, CONFIGURED_TOKEN);
		assertThrows(InvalidManagementTokenException.class,
			() -> ManagementTokenUtils.validateToken("other", CONFIGURED_TOKEN));
	}

}
