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
import org.craftercms.deployer.api.ProcessorExecution;
import org.craftercms.deployer.api.Target;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringReader;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
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

	@Test
	public void doesNotFollowRedirectWhenHeadersAreConfigured() throws Exception {
		RedirectFixture redirect = new RedirectFixture();
		try {
			String yaml = """
				url: http://127.0.0.1:%d/start
				method: GET
				alwaysRun: true
				headers:
				  - name: %s
				    value: %s
				""".formatted(redirect.port(), ManagementToken.HEADER_NAME, SECRET);
			Deployment deployment = execute(yaml);

			assertEquals(1, redirect.sourceHits.get());
			assertEquals(SECRET, redirect.sourceToken.get());
			assertEquals(0, redirect.sinkHits.get());
			assertNull(redirect.sinkToken.get());
			ProcessorExecution execution = deployment.getProcessorExecutions().get(0);
			assertEquals(Deployment.Status.FAILURE, execution.getStatus());
			assertTrue(execution.getStatusDetails().toString().contains("status = 302"));
		} finally {
			redirect.stop();
		}
	}

	@Test
	public void followsRedirectWhenNoHeadersAreConfigured() throws Exception {
		RedirectFixture redirect = new RedirectFixture();
		try {
			String yaml = """
				url: http://127.0.0.1:%d/start
				method: GET
				alwaysRun: true
				""".formatted(redirect.port());
			Deployment deployment = execute(yaml);

			assertEquals(1, redirect.sourceHits.get());
			assertNull(redirect.sourceToken.get());
			assertEquals(1, redirect.sinkHits.get());
			ProcessorExecution execution = deployment.getProcessorExecutions().get(0);
			assertEquals(Deployment.Status.SUCCESS, execution.getStatus());
			assertTrue(execution.getStatusDetails().toString().contains("status = 200"));
		} finally {
			redirect.stop();
		}
	}

	private Deployment execute(String yaml) throws Exception {
		YamlConfiguration config = new YamlConfiguration();
		config.read(new StringReader(yaml));

		HttpMethodCallProcessor processor = new HttpMethodCallProcessor();
		processor.setBeanName("httpMethodCall");
		processor.setTargetId("editorial");
		processor.init(config);

		Deployment deployment = new Deployment(mock(Target.class));
		deployment.start();
		processor.execute(deployment);
		return deployment;
	}

	/**
	 * {@code /start} answers 302 to {@code /sink}. The default client copies request headers onto that
	 * redirect, so a configured header must keep the client from following it.
	 */
	private static final class RedirectFixture {

		private final HttpServer server;
		private final AtomicInteger sourceHits = new AtomicInteger();
		private final AtomicInteger sinkHits = new AtomicInteger();
		private final AtomicReference<String> sourceToken = new AtomicReference<>();
		private final AtomicReference<String> sinkToken = new AtomicReference<>();

		private RedirectFixture() throws IOException {
			server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			server.createContext("/sink", exchange -> {
				sinkHits.incrementAndGet();
				sinkToken.set(exchange.getRequestHeaders().getFirst(ManagementToken.HEADER_NAME));
				byte[] body = "ok".getBytes(StandardCharsets.UTF_8);
				exchange.sendResponseHeaders(200, body.length);
				exchange.getResponseBody().write(body);
				exchange.close();
			});
			server.createContext("/start", exchange -> {
				sourceHits.incrementAndGet();
				sourceToken.set(exchange.getRequestHeaders().getFirst(ManagementToken.HEADER_NAME));
				String location = "http://127.0.0.1:" + server.getAddress().getPort() + "/sink";
				exchange.getResponseHeaders().set("Location", location);
				exchange.sendResponseHeaders(302, -1);
				exchange.close();
			});
			server.start();
		}

		private int port() {
			return server.getAddress().getPort();
		}

		private void stop() {
			server.stop(0);
		}

	}

}
