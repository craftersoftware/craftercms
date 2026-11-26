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

package org.craftercms.engine.service.context;

import org.junit.Test;

import java.net.ConnectException;
import java.nio.channels.UnresolvedAddressException;

import static org.junit.Assert.assertEquals;

public class SiteListErrorsTest {

	@Test
	public void messageIsUsedWhenPresent() {
		assertEquals("Connection refused",
			SiteListErrors.describe(new ConnectException("Connection refused")));
	}

	@Test
	public void nullMessageUsesClassAndRootCause() {
		ConnectException error = new ConnectException();
		error.initCause(new IllegalStateException(null, new UnresolvedAddressException()));

		assertEquals("ConnectException: UnresolvedAddressException", SiteListErrors.describe(error));
	}

	@Test
	public void blankMessageUsesRootCauseMessage() {
		ConnectException error = new ConnectException(" ");
		error.initCause(new ConnectException("Connection refused"));

		assertEquals("ConnectException: Connection refused", SiteListErrors.describe(error));
	}

	@Test
	public void nullMessageWithoutCauseUsesClass() {
		assertEquals("RuntimeException", SiteListErrors.describe(new RuntimeException()));
	}

	@Test
	public void selfReferencingCauseUsesClass() {
		CyclicException first = new CyclicException();
		CyclicException second = new CyclicException();
		first.cause = second;
		second.cause = first;

		String description = SiteListErrors.describe(first);

		assertEquals("CyclicException: CyclicException", description);
	}

	@Test
	public void anonymousClassUsesFullName() {
		RuntimeException error = new RuntimeException() { };

		assertEquals(error.getClass().getName(), SiteListErrors.describe(error));
	}

	@Test
	public void nullErrorIsDescribed() {
		assertEquals("unknown error", SiteListErrors.describe(null));
	}

	private static class CyclicException extends RuntimeException {

		private Throwable cause;

		@Override
		public synchronized Throwable getCause() {
			return cause;
		}

	}

}
