/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.deployer.utils.opensearch.legacy;

import org.craftercms.commons.config.ConfigurationException;
import org.opensearch.client.RestHighLevelClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.BeanNameAware;
import org.springframework.beans.factory.config.AbstractFactoryBean;

import java.util.ArrayList;

/**
 * Base implementation for factories capable of build single or multi-cluster OpenSearch services
 *
 * @author joseross
 * @since 3.1.5
 */
public abstract class AbstractOpenSearchFactory<T extends AutoCloseable> extends AbstractFactoryBean<T>
    implements BeanNameAware {

    private static final Logger logger = LoggerFactory.getLogger(AbstractOpenSearchFactory.class);

    /**
     * The name of the bean
     */
    protected String name;

    /**
     * The OpenSearch configuration
     */
    protected OpenSearchConfig config;

    public AbstractOpenSearchFactory(final OpenSearchConfig config) {
        this.config = config;
    }

    @Override
    public void setBeanName(final String name) {
        this.name = name;
    }

    @Override
    protected T createInstance() throws ConfigurationException {
        logger.debug("Creating instance for '{}'", name);
        if (config.useSingleCluster()) {
            logger.debug("Using a single cluster configuration for '{}'", name);
            return doCreateSingleInstance(config.globalCluster.buildClient());
        }

        logger.debug("Using a multi-cluster configuration for '{}'", name);
        ArrayList<RestHighLevelClient> writeClientList = new ArrayList<>(config.writeClusters.size());
        try {
            for (OpenSearchClusterConfig writeCluster : config.writeClusters) {
                writeClientList.add(writeCluster.buildClient());
            }
            RestHighLevelClient readClient = config.readCluster.buildClient();
            return doCreateMultiInstance(readClient, writeClientList.toArray(new RestHighLevelClient[0]));
        } catch (ConfigurationException e) {
            closeClients(writeClientList);
            throw e;
        }
    }

    /**
     * Silently closes all clients in the given list
     * @param writeClientList the clients to close
     */
    private void closeClients(ArrayList<RestHighLevelClient> writeClientList) {
        for (RestHighLevelClient client : writeClientList) {
            try {
                client.close();
            } catch (Exception ex) {
                logger.warn("Could not close OpenSearch client for '{}'", name, ex);
            }
        }
    }

    /**
     * Creates a service instance for a single cluster
     *
     * @param client the OpenSearch client
     * @return the service instance
     */
    protected abstract T doCreateSingleInstance(RestHighLevelClient client);

    /**
     * Creates a service instance for a multiple cluster
     * @param readClient the OpenSearch client for read-related operations
     * @param writeClients the OpenSearch clients for write-related operations
     * @return the service instance
     */
    protected abstract T doCreateMultiInstance(RestHighLevelClient readClient, RestHighLevelClient[] writeClients);

    @Override
    protected void destroyInstance(final T instance) throws Exception {
        logger.debug("Closing all clients for '{}'", name);
        instance.close();
    }

}
