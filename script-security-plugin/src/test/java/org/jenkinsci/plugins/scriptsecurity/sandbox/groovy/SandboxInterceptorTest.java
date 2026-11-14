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
package org.jenkinsci.plugins.scriptsecurity.sandbox.groovy;

import groovy.lang.Binding;
import groovy.lang.GroovyShell;
import org.codehaus.groovy.control.CompilerConfiguration;
import org.jenkinsci.plugins.scriptsecurity.sandbox.whitelists.StaticWhitelist;
import org.junit.Test;
import org.kohsuke.groovy.sandbox.SandboxTransformer;

import java.io.IOException;
import java.io.StringReader;

import static org.junit.Assert.assertEquals;

public class SandboxInterceptorTest {

	@Test
	public void testRemainderOperator() throws IOException {
		// number operators need no whitelist entries, and since Groovy 5 % calls remainder() instead of mod()
		assertEquals(1, evaluate("7 % 3"));
		assertEquals(-1, evaluate("def x = -7; x % 3"));
		assertEquals(2, evaluate("x = 5; x %= 3; x"));
	}

	private Object evaluate(String script) throws IOException {
		CompilerConfiguration config = new CompilerConfiguration();
		config.addCompilationCustomizers(new SandboxTransformer());
		GroovyShell shell = new GroovyShell(new Binding(), config);

		SandboxInterceptor interceptor = new SandboxInterceptor(new StaticWhitelist(new StringReader("")));
		interceptor.register();
		try {
			return shell.evaluate(script);
		} finally {
			interceptor.unregister();
		}
	}
}
