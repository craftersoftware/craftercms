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
FROM httpd:2.4-alpine3.21

# Update & Upgrade existing packages
RUN apk update && apk upgrade

# Install dependencies
RUN apk add --no-cache bash shadow git git-daemon su-exec nano \
    tini apache2-utils;

# Create folders for crafter user
RUN mkdir -p /opt/crafter/data

# Create volumes
VOLUME [ "/opt/crafter/data" ]

# Add the Crafter user
RUN addgroup -S -g 1000 crafter && adduser -s /bin/bash -D -u 1000 -G crafter crafter;

# Set default values for env variables
ENV GIT_REPOS_ROOT=/opt/crafter/data/repos
ENV PASSWD_FILE_PATH="/usr/local/apache2/.htpasswd"
ENV SSL_CERT_FILE_PATH="/usr/local/apache2/conf/server.crt"
ENV SSL_PRIV_KEY_FILE_PATH="/usr/local/apache2/conf/server.key"

# Copy configuration
COPY ./conf ./conf/

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Expose HTTPS port
EXPOSE 443

# Entrypoint
# tini will reap zombie processes
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
