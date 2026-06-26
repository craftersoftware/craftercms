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

# Install dependencies
RUN set -eux; \
    apk update; \
    apk upgrade; \
    apk add --no-cache bash; \
    apk --no-cache add curl; \
    apk add --no-cache openssh-client; \
    apk add --no-cache git; \
#    apk add --no-cache vim; \
    apk add --no-cache nano; \
    apk add --no-cache tini;

# Create folders and make CRAFTER_HOME the workdir
RUN mkdir -p /opt/crafter; \
    mkdir /opt/crafter/bin; \
    mkdir /opt/crafter/data; \
    mkdir /opt/crafter/logs

WORKDIR /opt/crafter

# Create volumes
VOLUME [ "/opt/crafter/data", "/opt/crafter/logs"]

# Add the Crafter user
RUN addgroup -g 1000 crafter && adduser -D -u 1000 -G crafter crafter; \
    chown -R crafter:crafter .

# Copy bin folder
COPY --chown=crafter:crafter ./bin ./bin/

# Replace ports for default ones
RUN sed -i 's/8695/8983/g' ./bin/crafter-setenv.sh; \
    sed -i 's/9202/9200/g' ./bin/crafter-setenv.sh; \
    sed -i 's/9192/9191/g' ./bin/crafter-setenv.sh; \
    sed -i 's/28020/27017/g' ./bin/crafter-setenv.sh; \
    sed -i 's/9080/8080/g' ./bin/crafter-setenv.sh; \
    sed -i 's/9443/8443/g' ./bin/crafter-setenv.sh; \
    sed -i 's/9009/8009/g' ./bin/crafter-setenv.sh; \
    sed -i 's/9005/8005/g' ./bin/crafter-setenv.sh;

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Run the application as following user
USER root

# Expose port
EXPOSE 9191

# Entrypoint and command (run by default)
# tini will reap zombie processes
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD [ "run" ]
