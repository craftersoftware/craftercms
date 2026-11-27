/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.deployer.impl.processors.aws;

import org.apache.commons.configuration2.Configuration;
import org.craftercms.commons.aws.AwsUtils;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.craftercms.deployer.impl.processors.AbstractMainDeploymentProcessor;
import org.craftercms.deployer.utils.aws.AwsS3ClientBuilderConfigurer;
import org.craftercms.deployer.utils.aws.AwsS3Utils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.transfer.s3.S3TransferManager;

import static org.craftercms.commons.config.ConfigUtils.getRequiredStringProperty;

/**
 * Base implementation of {@link AbstractMainDeploymentProcessor} for processors that use AWS S3.
 * Can be configured with the following YAML properties:
 *
 * <ul>
 *     <li><strong>url:</strong> AWS S3 bucket URL to upload files</li>
 * </ul>
 *
 * @author joseross
 * @since 3.1.8
 */
public abstract class AbstractS3Processor extends AbstractMainDeploymentProcessor {

    protected static final String CONFIG_KEY_URL = "url";

    protected static final String DELIMITER = "/";

    protected Logger logger = LoggerFactory.getLogger(getClass());

    /**
     * Helper class the configures credentials and other properties for a {@link S3Client} client.
     */
    protected AwsS3ClientBuilderConfigurer builderConfigurer;

    /**
     * AWS S3 bucket URL
     */
    protected S3Uri s3Url;

    /**
     * Thread pool to use for {@link S3TransferManager} instances
     */
    protected ThreadPoolTaskExecutor threadPoolTaskExecutor;

    public AbstractS3Processor(ThreadPoolTaskExecutor threadPoolTaskExecutor) {
        this.threadPoolTaskExecutor = threadPoolTaskExecutor;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void doInit(final Configuration config) throws ConfigurationException {
        builderConfigurer = new AwsS3ClientBuilderConfigurer(config);
        s3Url = AwsS3Utils.parseS3Url(getRequiredStringProperty(config, CONFIG_KEY_URL));
        // use true as default for backward compatibility
        failDeploymentOnFailure = config.getBoolean(FAIL_DEPLOYMENT_CONFIG_KEY, true);
    }

    /**
     * Returns the base key from the S3 URL, making sure to replace the {@code {siteName}} macro instances
     */
    protected String getS3BaseKey() {
        return AwsS3Utils.getS3BaseKey(s3Url, siteName);
    }

    /*
     * Returns the bucket from the S3 URL, making sure to replace the {@code {siteName}} macro instances
     */
    protected String getBucket() {
        return AwsS3Utils.getBucket(s3Url, siteName);
    }

    /**
     * Builds the AWS S3 key for the given file
     * @param file relative path of the file
     * @return the full S3 key
     */
    protected String getS3Key(String file) {
        return AwsS3Utils.getS3Key(getS3BaseKey(), file);
    }

    /**
     * Builds the {@link S3Client} client.
     */
    protected S3Client buildClient() {
        S3ClientBuilder builder = S3Client.builder();
        builderConfigurer.configureClientBuilder(builder);

        return builder.build();
    }

    /**
     * Build the {@link S3AsyncClient}
     * @return
     */
    protected S3AsyncClient buildAsyncClient() {
        S3AsyncClientBuilder builder = S3AsyncClient.builder();
        builderConfigurer.configureClientBuilder(builder);

        return builder.build();
    }

    /**
     * Builds the {@link S3TransferManager}
     */
    protected S3TransferManager buildTransferManager(S3AsyncClient client) {
        return AwsUtils.buildTransferManager(client);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    protected void doDestroy() throws DeployerException {
        // Do nothing
    }

}
