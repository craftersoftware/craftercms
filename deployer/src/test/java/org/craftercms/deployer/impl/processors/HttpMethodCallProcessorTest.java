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
package org.craftercms.deployer.impl.processors;

import com.sun.net.httpserver.HttpServer;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.Appender;
import org.apache.logging.log4j.core.Logger;
import org.apache.logging.log4j.core.appender.OutputStreamAppender;
import org.apache.logging.log4j.core.layout.PatternLayout;
import org.craftercms.commons.config.YamlConfiguration;
import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.deployer.api.Deployment;
import org.craftercms.deployer.api.Target;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.StringReader;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.mockito.Mockito.mock;

public class HttpMethodCallProcessorTest {

	private static final String SECRET = "processor-header-secret";

	@Test
	public void sendsConfiguredHeadersAndDoesNotLogValues() throws Exception {
		AtomicReference<String> received = new AtomicReference<>();
		HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/clear", exchange -> {
			received.set(exchange.getRequestHeaders().getFirst(ManagementToken.HEADER_NAME));
			byte[] body = "ok".getBytes(StandardCharsets.UTF_8);
			exchange.sendResponseHeaders(200, body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		server.start();
		ByteArrayOutputStream log = new ByteArrayOutputStream();
		Logger logger = (Logger) LogManager.getLogger(HttpMethodCallProcessor.class);
		Appender appender = OutputStreamAppender.newBuilder()
			.setName("http-method-call-test")
			.setTarget(log)
			.setLayout(PatternLayout.newBuilder().withPattern("%m%n").build())
			.build();
		appender.start();
		Level previous = logger.getLevel();
		logger.addAppender(appender);
		logger.setLevel(Level.INFO);
		try {
			int port = server.getAddress().getPort();
			String yaml = """
				url: http://127.0.0.1:%d/clear?crafterSite=editorial
				method: GET
				alwaysRun: true
				headers:
				  - name: %s
				    value: %s
				""".formatted(port, ManagementToken.HEADER_NAME, SECRET);
			YamlConfiguration config = new YamlConfiguration();
			config.read(new StringReader(yaml));

			HttpMethodCallProcessor processor = new HttpMethodCallProcessor();
			processor.setBeanName("httpMethodCall");
			processor.setTargetId("editorial");
			processor.init(config);

			Deployment deployment = new Deployment(mock(Target.class));
			deployment.start();
			processor.execute(deployment);

			assertEquals(SECRET, received.get());
			String logged = log.toString(StandardCharsets.UTF_8);
			assertFalse(logged.contains(SECRET));
			assertFalse(logged.isEmpty());
		} finally {
			logger.removeAppender(appender);
			logger.setLevel(previous);
			appender.stop();
			server.stop(0);
		}
	}

}
