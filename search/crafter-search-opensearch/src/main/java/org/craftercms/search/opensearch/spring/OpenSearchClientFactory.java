/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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
import org.apache.commons.lang3.StringUtils;
import org.apache.hc.client5.http.auth.AuthScope;
import org.apache.hc.client5.http.auth.UsernamePasswordCredentials;
import org.apache.hc.client5.http.impl.auth.BasicCredentialsProvider;
import org.apache.hc.core5.http.HttpHost;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;
import org.opensearch.client.json.jackson.JacksonJsonpMapper;
import org.opensearch.client.opensearch.OpenSearchClient;
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.config.AbstractFactoryBean;

import java.beans.ConstructorProperties;
import java.net.URISyntaxException;

import static org.apache.hc.core5.util.Timeout.ofMilliseconds;
import static org.craftercms.search.opensearch.spring.ClientFactoryUtils.*;


/**
 * Implementation of {@link AbstractFactoryBean} to create instances of {@link OpenSearchClient}
 *
 * @author joseross
 * @since 4.0.0
 */
public class OpenSearchClientFactory extends AbstractFactoryBean<OpenSearchClient> {

    private static final Logger logger = LoggerFactory.getLogger(OpenSearchClientFactory.class);

    /**
     * List of OpenSearch urls
     */
    protected final String[] serverUrls;

    /**
     * The username for OpenSearch
     */
    protected String username;

    /**
     * The password for OpenSearch
     */
    protected String password;

    /**
     * The connection timeout in milliseconds
     */
    protected int connectTimeout = -1;

    /**
     * The socket timeout in milliseconds
     */
    protected int socketTimeout = -1;

    /**
     * The number of threads to use
     */
    protected int threadCount = -1;

    /**
     * Indicates if socket keep alive should be enabled
     */
    protected boolean socketKeepAlive = false;
    /**
     * The maximum number of connections
     */
    protected int maxTotalConnections = -1;
    /**
     * The maximum number of connections per route
     */
    protected int maxConnectionsPerRoute = -1;

    @ConstructorProperties({"serverUrls"})
    public OpenSearchClientFactory(final String[] serverUrls) {
        this.serverUrls = serverUrls;
    }

    @SuppressWarnings("unused")
    public void setUsername(final String username) {
        this.username = username;
    }

    @SuppressWarnings("unused")
    public void setPassword(final String password) {
        this.password = password;
    }

    @SuppressWarnings("unused")
    public void setConnectTimeout(int connectTimeout) {
        this.connectTimeout = connectTimeout;
    }

    @SuppressWarnings("unused")
    public void setSocketTimeout(int socketTimeout) {
        this.socketTimeout = socketTimeout;
    }

    @SuppressWarnings("unused")
    public void setThreadCount(int threadCount) {
        this.threadCount = threadCount;
    }

    @SuppressWarnings("unused")
    public void setSocketKeepAlive(boolean socketKeepAlive) {
        this.socketKeepAlive = socketKeepAlive;
    }

    @SuppressWarnings("unused")
    public void setMaxConnectionsPerRoute(int maxConnectionsPerRoute) {
        this.maxConnectionsPerRoute = maxConnectionsPerRoute;
    }

    @SuppressWarnings("unused")
    public void setMaxTotalConnections(int maxTotalConnections) {
        this.maxTotalConnections = maxTotalConnections;
    }

    /**
     * Creates an {@link OpenSearchClient} instance
     *
     * @param serverUrls             array of OpenSearch server URLs
     * @param username               the username
     * @param password               the password
     * @param connectTimeout         connection timeout
     * @param socketTimeout          socket timeout
     * @param threadCount            number of threads
     * @param socketKeepAlive        indicates if socket keep alive should be enabled
     * @param maxTotalConnections    maximum total connections
     * @param maxConnectionsPerRoute maximum connections per route
     * @return the {@link OpenSearchClient} instance
     */
    public static OpenSearchClient createClient(String[] serverUrls, String username, String password,
                                                int connectTimeout, int socketTimeout, int threadCount,
                                                boolean socketKeepAlive, int maxTotalConnections, int maxConnectionsPerRoute) throws URISyntaxException {
        logger.debug("Building client for urls: {}", (Object) serverUrls);
        HttpHost[] hosts = new HttpHost[serverUrls.length];
        for (int i = 0; i < serverUrls.length; i++) {
            hosts[i] = HttpHost.create(serverUrls[i]);
        }
        ApacheHttpClient5TransportBuilder.RequestConfigCallback requestConfigCallback = builder -> {
            if (connectTimeout >= 0) {
                logger.debug("Using custom connect timeout: {}", connectTimeout);
                builder.setConnectionRequestTimeout(ofMilliseconds(connectTimeout));
            } else {
                logger.debug("Using default connect timeout");
            }
            if (socketTimeout >= 0) {
                logger.debug("Using custom socket timeout: {}", socketTimeout);
                builder.setResponseTimeout(ofMilliseconds(socketTimeout));
            } else {
                logger.debug("Using default socket timeout");
            }
            return builder;
        };
        ApacheHttpClient5TransportBuilder.HttpClientConfigCallback httpClientConfigCallback = builder -> {
			// Disable compression since httpclient5 v5.6 has a different way of handling it
			// that causes issues with OpenSearch. See https://issues.apache.org/jira/browse/HTTPCLIENT-2409
			builder.disableContentCompression();
            if (StringUtils.isNoneEmpty(username, password)) {
                logger.debug("Using basic auth with user: {}", username);
                BasicCredentialsProvider credentialsProvider = new BasicCredentialsProvider();
                credentialsProvider.setCredentials(new AuthScope(null, -1), new UsernamePasswordCredentials(username, password.toCharArray()));
                builder.setDefaultCredentialsProvider(credentialsProvider);
            } else {
                logger.debug("No credentials provided");
            }

                builder.setConnectionManager(
                    createConnectionManager(connectTimeout, maxTotalConnections, maxConnectionsPerRoute));
            builder.setIOReactorConfig(createIOReactorConfig(socketTimeout, threadCount, socketKeepAlive));
            builder.setIoReactorExceptionCallback(createIOReactorExceptionCallback());

            builder.addExecInterceptorFirst(OpenSearchRequestLoggingInterceptor.NAME,
                    new OpenSearchRequestLoggingInterceptor());

            return builder;
        };
        ObjectMapper mapper = new ObjectMapper()
                .findAndRegisterModules()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        ApacheHttpClient5Transport transport = ApacheHttpClient5TransportBuilder
                .builder(hosts)
                .setRequestConfigCallback(requestConfigCallback)
                .setMapper(new JacksonJsonpMapper(mapper))
                .setHttpClientConfigCallback(httpClientConfigCallback)
                .build();
        return new OpenSearchClient(transport);
    }

    @Override
    public Class<?> getObjectType() {
        return OpenSearchClient.class;
    }

    @Override
    @NonNull
    protected OpenSearchClient createInstance() throws URISyntaxException {
        return createClient(serverUrls, username, password, connectTimeout, socketTimeout, threadCount,
                socketKeepAlive, maxTotalConnections, maxConnectionsPerRoute);
    }

    @Override
    protected void destroyInstance(@Nullable OpenSearchClient instance) throws Exception {
        if (instance != null) {
            instance._transport().close();
        }
    }

}
