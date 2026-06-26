#!/bin/bash

# Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as published by
# the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

# -------------------- Locations variables --------------------
export CRAFTER_LOGS_DIR=${CRAFTER_LOGS_DIR:="$CRAFTER_HOME/logs"}
export CRAFTER_DATA_DIR=${CRAFTER_DATA_DIR:="$CRAFTER_HOME/data"}
export CRAFTER_TEMP_DIR=${CRAFTER_TEMP_DIR:="$CRAFTER_HOME/temp"}
export CRAFTER_BACKUPS_DIR=${CRAFTER_BACKUPS_DIR:="$CRAFTER_HOME/backups"}

# Support old ES env variables
export SEARCH_INDEXES_DIR=${SEARCH_INDEXES_DIR:=$ES_INDEXES_DIR}
export SEARCH_LOGS_DIR=${SEARCH_LOGS_DIR:=$ES_LOGS_DIR}
export SEARCH_PID=${SEARCH_PID:=$ES_PID}
export SEARCH_USERNAME=${SEARCH_USERNAME:=$ES_USERNAME}
export SEARCH_PASSWORD=${SEARCH_PASSWORD:=$ES_PASSWORD}
export SEARCH_HOST=${SEARCH_HOST:=$ES_HOST}
export SEARCH_PORT=${SEARCH_PORT:=$ES_PORT}
export SEARCH_URL=${SEARCH_URL:=$ES_URL}
# These are read by opensearch itself, so we cannot rename to SEARCH_XXX
export OPENSEARCH_JAVA_HOME=${OPENSEARCH_JAVA_HOME:=$ES_JAVA_HOME}
export OPENSEARCH_JAVA_OPTS=${OPENSEARCH_JAVA_OPTS:=$ES_JAVA_OPTS}
export OPENSEARCH_HOME=${OPENSEARCH_HOME:=$ES_HOME}

# -------------------- Hosts and ports --------------------
export MAIL_HOST=${MAIL_HOST:="localhost"}
export MAIL_PORT=${MAIL_PORT:="@SMTP_PORT@"}
export SEARCH_HOST=${SEARCH_HOST:="localhost"}
export SEARCH_PORT=${SEARCH_PORT:="@SEARCH_PORT@"}
export DEPLOYER_HOST=${DEPLOYER_HOST:="localhost"}
export DEPLOYER_PORT=${DEPLOYER_PORT:="@DEPLOYER_PORT@"}
export MONGODB_HOST=${MONGODB_HOST:="localhost"}
export MONGODB_PORT=${MONGODB_PORT:="@MONGODB_PORT@"}
export TOMCAT_HOST=${TOMCAT_HOST:="localhost"}
export TOMCAT_HTTP_PORT=${TOMCAT_HTTP_PORT:="@TOMCAT_HTTP_PORT@"}
export TOMCAT_HTTPS_PORT=${TOMCAT_HTTPS_PORT:="@TOMCAT_HTTPS_PORT@"}
export TOMCAT_AJP_PORT=${TOMCAT_AJP_PORT:="@TOMCAT_AJP_PORT@"}
export TOMCAT_SHUTDOWN_PORT=${TOMCAT_SHUTDOWN_PORT:="@TOMCAT_SHUTDOWN_PORT@"}
export TOMCAT_DEBUG_PORT=${TOMCAT_DEBUG_PORT:="@TOMCAT_DEBUG_PORT@"}

# -------------------- URLs --------------------
export SEARCH_URL=${SEARCH_URL:="http://$SEARCH_HOST:$SEARCH_PORT"}
export DEPLOYER_URL=${DEPLOYER_URL:="http://$DEPLOYER_HOST:$DEPLOYER_PORT"}
export ENGINE_URL=${ENGINE_URL:="http://$TOMCAT_HOST:$TOMCAT_HTTP_PORT"}
export PROFILE_URL=${PROFILE_URL:="http://$TOMCAT_HOST:$TOMCAT_HTTP_PORT/crafter-profile"}
export SOCIAL_URL=${SOCIAL_URL:="http://$TOMCAT_HOST:$TOMCAT_HTTP_PORT/crafter-social"}

# -------------------- Java opts --------------------
export OPENSEARCH_JAVA_OPTS=${OPENSEARCH_JAVA_OPTS:="-server -Xss1024K -Xms1G -Xmx1G -Dlog4j2.formatMsgNoLookups=true"}
export DEPLOYER_JAVA_OPTS=${DEPLOYER_JAVA_OPTS:="-server -Xss1024K -Xmx1G -Dlog4j2.formatMsgNoLookups=true"}
export CATALINA_OPTS=${CATALINA_OPTS:="-server -Xss1024K -Xms1G -Xmx2G -Dlog4j2.formatMsgNoLookups=true"}

# -------------------- OpenSearch variables --------------------
export OPENSEARCH_JAVA_HOME=${OPENSEARCH_JAVA_HOME:=$JAVA_HOME}
export OPENSEARCH_HOME=${OPENSEARCH_HOME:="$CRAFTER_BIN_DIR/opensearch"}
export SEARCH_INDEXES_DIR=${SEARCH_INDEXES_DIR:="$CRAFTER_DATA_DIR/indexes"}
export SEARCH_LOGS_DIR=${SEARCH_LOGS_DIR:="$CRAFTER_LOGS_DIR/search"}
export SEARCH_PID=${SEARCH_PID:="$OPENSEARCH_HOME/bin/opensearch.pid"}
export SEARCH_USERNAME=${SEARCH_USERNAME:=""}
export SEARCH_PASSWORD=${SEARCH_PASSWORD:=""}
export SEARCH_DOCKER_NAME=${SEARCH_DOCKER_NAME:="delivery-search"}

# -------------------- Deployer variables --------------------
export DEPLOYER_HOME=${DEPLOYER_HOME:="$CRAFTER_BIN_DIR/crafter-deployer"}
export DEPLOYER_DATA_DIR=${DEPLOYER_DATA_DIR:="$CRAFTER_DATA_DIR/deployer"}
export DEPLOYER_LOGS_DIR=${DEPLOYER_LOGS_DIR:="$CRAFTER_LOGS_DIR/deployer"}
export DEPLOYER_DEPLOYMENTS_DIR=${DEPLOYER_DEPLOYMENTS_DIR:="$CRAFTER_DATA_DIR/repos/sites"}
export DEPLOYER_SDOUT=${DEPLOYER_SDOUT:="$DEPLOYER_LOGS_DIR/crafter-deployer.out"}
export DEPLOYER_PID=${DEPLOYER_PID:="$DEPLOYER_HOME/crafter-deployer.pid"}

# -------------------- MongoDB variables --------------------
export MONGODB_HOME=${MONGODB_HOME:="$CRAFTER_BIN_DIR/mongodb"}
export MONGODB_DATA_DIR=${MONGODB_DATA_DIR:="$CRAFTER_DATA_DIR/mongodb"}
export MONGODB_LOGS_DIR=${MONGODB_LOGS_DIR:="$CRAFTER_LOGS_DIR/mongodb"}
export MONGODB_PID=${MONGODB_PID:="$MONGODB_HOME/mongod.lock"}

# -------------------- Tomcat variables --------------------
export CATALINA_HOME=${CATALINA_HOME:="$CRAFTER_BIN_DIR/apache-tomcat"}
export CATALINA_PID=${CATALINA_PID:="$CATALINA_HOME/tomcat.pid"}
export CATALINA_LOGS_DIR=${CATALINA_LOGS_DIR:="$CRAFTER_LOGS_DIR/tomcat"}
export CATALINA_OUT=${CATALINA_OUT:="$CATALINA_LOGS_DIR/catalina.out"}
export CATALINA_TMPDIR=${CATALINA_TMPDIR:="$CRAFTER_TEMP_DIR/tomcat"}

# -------------------- Git variables --------------------
export GIT_CONFIG_NOSYSTEM=${GIT_CONFIG_NOSYSTEM:="true"}

# -------------------- Management tokens ----------------
# Please update this per installation and provide these tokens to the status monitors.
export ENGINE_MANAGEMENT_TOKEN=${ENGINE_MANAGEMENT_TOKEN:="defaultManagementToken"}
export DEPLOYER_MANAGEMENT_TOKEN=${DEPLOYER_MANAGEMENT_TOKEN:="defaultManagementToken"}
export PROFILE_MANAGEMENT_TOKEN=${PROFILE_MANAGEMENT_TOKEN:="defaultManagementToken"}
export SOCIAL_MANAGEMENT_TOKEN=${SOCIAL_MANAGEMENT_TOKEN:="defaultManagementToken"}

# -------------------- Encryption variables --------------------
export CRAFTER_ENCRYPTION_KEY=${CRAFTER_ENCRYPTION_KEY:="zEtRii1jWUuUUB0W"}
export CRAFTER_ENCRYPTION_SALT=${CRAFTER_ENCRYPTION_SALT:="DgGN9xhq3GOn6zxg"}

# -------------------- Configuration variables --------------------
export CRAFTER_ENVIRONMENT=${CRAFTER_ENVIRONMENT:=default}

# -------------------- Serverless variables --------------------
export AWS_S3_ENDPOINT=${AWS_S3_ENDPOINT:=""}
export AWS_S3_PATH_STYLE_ACCESS=${AWS_S3_PATH_STYLE_ACCESS:="false"}

export SERVERLESS_NAMESPACE=${SERVERLESS_NAMESPACE:=cloud-sites}

export PREVIEW_BUCKET_NAME_PATTERN=${PREVIEW_BUCKET_NAME_PATTERN:="${SERVERLESS_NAMESPACE}-blobs-\${siteName}"}
export PREVIEW_BUCKET_PREFIX_PATTERN=${PREVIEW_BUCKET_PREFIX_PATTERN:=""}

export STAGING_BUCKET_NAME_PATTERN=${STAGING_BUCKET_NAME_PATTERN:="${SERVERLESS_NAMESPACE}-site-\${siteName}-staging"}
export STAGING_BUCKET_PREFIX_PATTERN=${STAGING_BUCKET_PREFIX_PATTERN:=""}

export LIVE_BUCKET_NAME_PATTERN=${LIVE_BUCKET_NAME_PATTERN:="${SERVERLESS_NAMESPACE}-site-\${siteName}"}
export LIVE_BUCKET_PREFIX_PATTERN=${LIVE_BUCKET_PREFIX_PATTERN:=""}

# -------------------- SSH variables --------------------
# The path of the folder used for the SSH configuration
export CRAFTER_SSH_CONFIG=${CRAFTER_SSH_CONFIG:="$CRAFTER_DATA_DIR/ssh"}
