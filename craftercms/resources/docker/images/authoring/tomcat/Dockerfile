# Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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
FROM eclipse-temurin:21-jdk-alpine AS main

############# INSTALL NATIVE TOMCAT #############
ENV CATALINA_HOME=/usr/local/tomcat \
    TOMCAT_MAJOR="11" \
    TOMCAT_VERSION="11.0.20"

# Download Tomcat, and then Build tc-native
RUN apk add --no-cache --virtual .my-build-deps apr-dev openssl-dev make g++ && \
    cd /tmp && \
    wget -O apache-tomcat.tar.gz http://archive.apache.org/dist/tomcat/tomcat-${TOMCAT_MAJOR}/v${TOMCAT_VERSION}/bin/apache-tomcat-${TOMCAT_VERSION}.tar.gz && \
    tar -C /opt -xf apache-tomcat.tar.gz && \
    ln -s /opt/apache-tomcat-$TOMCAT_VERSION $CATALINA_HOME && \
    cd $CATALINA_HOME/bin && \
    tar -xf tomcat-native.tar.gz && \
    rm -f tomcat-native.tar.gz && \
    cd tomcat-native-*-src/native && \
    ./configure --with-java-home=$JAVA_HOME --prefix=$CATALINA_HOME && \
    make && \
    make install && \
    make clean && \
    rm -rf /tmp/* && \
    # Remove added packages
    apk del --purge .my-build-deps && \
    rm -rf /var/cache/apk/* && \
    # fix permissions (especially for running as non-root)
    # https://github.com/docker-library/tomcat/issues/35
    chmod -R +rx $CATALINA_HOME/ && \
    chmod 1777 $CATALINA_HOME/logs $CATALINA_HOME/temp $CATALINA_HOME/work

#################################################

# Install dependencies
RUN set -eux; \
    apk update; \
    apk upgrade; \
    apk add --no-cache bash; \
    apk add --no-cache curl; \
    apk add --no-cache lsof; \
    apk add --no-cache openssh-client; \
    apk add --no-cache git; \
    apk add --no-cache rsync; \
    apk add --no-cache iproute2; \
    apk add --no-cache procps; \
#    apk add --no-cache vim; \
    apk add --no-cache nano; \
    apk add --no-cache tini;

# Install MariaDB depdendencies
RUN apk add --update --no-cache -t .mariadb-run-deps \
        libaio \
        libstdc++ \
        libxml2 \
        linux-pam \
        make \
        pcre \
        pwgen \
        sudo \
        tzdata \
        xz-libs \
        zlib;

# Create folders and make CRAFTER_HOME the workdir
RUN mkdir -p /opt/crafter; \
    mkdir /opt/crafter/bin; \
    mkdir /opt/crafter/backups; \
    mkdir /opt/crafter/data; \
    mkdir /opt/crafter/logs; \
    mkdir /opt/crafter/temp

WORKDIR /opt/crafter

# Create volumes
VOLUME [ "/opt/crafter/data", "/opt/crafter/logs", "/opt/crafter/temp" ]

# Add the Crafter user and the default Git user
RUN addgroup -g 1000 crafter && adduser -D -u 1000 -G crafter crafter; \
    chown -R crafter:crafter .; \
    chown -R crafter:crafter /usr/local/tomcat/; \
    su crafter -c "git config --global user.email 'evalgit@example.com'"; \
    su crafter -c "git config --global user.name 'git_repo_user'"

# Copy bin folder
COPY --chown=crafter:crafter ./bin ./bin/

# Make the Grapes dir a volume
VOLUME /opt/crafter/bin/grapes

# Delete the bin/dbms dir
# Delete the apache tomcat folder, we're going to link to the image's own Tomcat
# Delete the conf and webapps
RUN rm -rf ./bin/dbms; \
    rm -rf ./bin/apache-tomcat; \
    su crafter -c "ln -s /usr/local/tomcat ./bin/apache-tomcat"; \
    rm -rf ./bin/apache-tomcat/conf/* && rm -rf ./bin/apache-tomcat/webapps/*

# Copy Tomcat setenv.sh, config, shared and webapps
COPY --chown=crafter:crafter ./bin/apache-tomcat/bin/setenv.sh ./bin/apache-tomcat/bin/
COPY --chown=crafter:crafter ./bin/apache-tomcat/conf ./bin/apache-tomcat/conf/
COPY --chown=crafter:crafter ./bin/apache-tomcat/webapps ./bin/apache-tomcat/webapps/
COPY --chown=crafter:crafter ./bin/apache-tomcat/shared ./bin/apache-tomcat/shared/

# Remove CATALINA_HOME from crafter-setenv.sh
# Replace ports for default ones
RUN sed -i '/export CATALINA_HOME=$CRAFTER_BIN_DIR\/apache-tomcat/d' ./bin/crafter-setenv.sh; \
    sed -i 's/8694/8983/g' ./bin/crafter-setenv.sh; \
    sed -i 's/9201/9200/g' ./bin/crafter-setenv.sh; \
    sed -i 's/27020/27017/g' ./bin/crafter-setenv.sh; \
    sed -i 's/33306/3306/g' ./bin/crafter-setenv.sh;

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Run the application as following user
USER root

# Expose debug port
EXPOSE 8000

# Entrypoint and command (run by default)
# tini will reap zombie processes
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD [ "run" ]

FROM main AS enterprise

# Expose MariaDB cluster ports
EXPOSE 3306
# Expose Hazelcast port
EXPOSE 5701

FROM enterprise AS imagemagick

RUN set -eux; \
    apk update; \
    apk add --no-cache imagemagick;
