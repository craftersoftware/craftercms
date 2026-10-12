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
package org.craftercms.search.opensearch.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.apache.hc.client5.http.async.AsyncExecCallback;
import org.apache.hc.client5.http.async.AsyncExecChain;
import org.apache.hc.client5.http.async.AsyncExecChainHandler;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpException;
import org.apache.hc.core5.http.HttpRequest;
import org.apache.hc.core5.http.nio.AsyncEntityProducer;
import org.apache.hc.core5.http.nio.DataStreamChannel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

/**
 * Logs OpenSearch HTTP requests, including a pretty-printed JSON body, when
 * {@value #LOGGER_NAME} is at trace.
 */
public class OpenSearchRequestLoggingInterceptor implements AsyncExecChainHandler {

    static final String NAME = "opensearch-request-log";

    private static final String LOGGER_NAME = "org.craftercms.search.opensearch.http.request";
    private static final Logger httpLogger = LoggerFactory.getLogger(LOGGER_NAME);
    private static final ObjectMapper PRETTY_MAPPER = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);
    private static final int MAX_LOGGED_BODY_BYTES = 64 * 1024;

    @Override
    public void execute(HttpRequest request, AsyncEntityProducer entityProducer, AsyncExecChain.Scope scope,
                        AsyncExecChain chain, AsyncExecCallback callback) throws HttpException, IOException {
        if (!httpLogger.isTraceEnabled() || entityProducer == null) {
            if (httpLogger.isTraceEnabled()) {
                httpLogger.trace("--> {} {}", request.getMethod(), request.getRequestUri());
            }
            chain.proceed(request, entityProducer, scope, callback);
            return;
        }
        chain.proceed(request, new LoggingEntityProducer(request, entityProducer), scope, callback);
    }

    private static final class LoggingEntityProducer implements AsyncEntityProducer {

        private final HttpRequest request;
        private final AsyncEntityProducer delegate;
        private final ByteArrayOutputStream body = new ByteArrayOutputStream();
        private boolean truncated;
        private boolean logged;

        private LoggingEntityProducer(HttpRequest request, AsyncEntityProducer delegate) {
            this.request = request;
            this.delegate = delegate;
        }

        @Override
        public void produce(DataStreamChannel channel) throws IOException {
            delegate.produce(new DataStreamChannel() {
                @Override
                public void requestOutput() {
                    channel.requestOutput();
                }

                @Override
                public int write(ByteBuffer src) throws IOException {
                    ByteBuffer view = src.duplicate();
                    int written = channel.write(src);
                    if (written > 0) {
                        int toCapture = Math.min(written, MAX_LOGGED_BODY_BYTES - body.size());
                        if (toCapture > 0) {
                            byte[] bytes = new byte[toCapture];
                            view.get(bytes);
                            body.write(bytes);
                        }
                        if (toCapture < written) {
                            truncated = true;
                        }
                    }
                    return written;
                }

                @Override
                public void endStream() throws IOException {
                    logRequest();
                    channel.endStream();
                }

                @Override
                public void endStream(List<? extends Header> trailers) throws IOException {
                    logRequest();
                    channel.endStream(trailers);
                }
            });
        }

        @Override
        public int available() {
            return delegate.available();
        }

        @Override
        public void failed(Exception cause) {
            try {
                if (!logged) {
                    logged = true;
                    httpLogger.trace("--> {} {} (request body generation failed: {})",
                            request.getMethod(), request.getRequestUri(), cause.toString());
                    if (body.size() > 0) {
                        httpLogger.trace("Body (incomplete, {} bytes captured):\n{}...",
                                body.size(), body.toString(StandardCharsets.UTF_8));
                    }
                }
            } finally {
                delegate.failed(cause);
            }
        }

        @Override
        public void releaseResources() {
            body.reset();
            truncated = false;
            logged = false;
            delegate.releaseResources();
        }

        @Override
        public boolean isRepeatable() {
            return delegate.isRepeatable();
        }

        @Override
        public long getContentLength() {
            return delegate.getContentLength();
        }

        @Override
        public String getContentType() {
            return delegate.getContentType();
        }

        @Override
        public String getContentEncoding() {
            return delegate.getContentEncoding();
        }

        @Override
        public boolean isChunked() {
            return delegate.isChunked();
        }

        @Override
        public Set<String> getTrailerNames() {
            return delegate.getTrailerNames();
        }

        private void logRequest() {
            logged = true;
            httpLogger.trace("--> {} {}", request.getMethod(), request.getRequestUri());
            String rawJson = body.toString(StandardCharsets.UTF_8);
            if (rawJson.isEmpty()) {
                return;
            }
            if (truncated) {
                httpLogger.trace("Body (truncated to {} bytes):\n{}...", MAX_LOGGED_BODY_BYTES, rawJson);
                return;
            }
            try {
                Object jsonObject = PRETTY_MAPPER.readValue(rawJson, Object.class);
                httpLogger.trace("Body:\n{}", PRETTY_MAPPER.writeValueAsString(jsonObject));
            } catch (Exception e) {
                httpLogger.trace("Body:\n{}", rawJson);
            }
        }
    }

}
