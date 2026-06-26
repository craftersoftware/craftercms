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
FROM alpine:3.21 AS main

# Add default variables. Default cron runs the logrotate every hour.
ENV CRON_SCHEDULE='0 * * * *' \
    LOGROTATE_PATTERN='/opt/crafter/logs/*/*.log /opt/crafter/logs/*/*.txt /opt/crafter/logs/*/*.csv' \
    LOGROTATE_COPIES='10' \
    LOGROTATE_SIZE='100M' \
    LOGROTATE_DATE_FORMAT='-%Y%m%d_%H%M%S'
# Update & Upgrade existing packages
RUN apk update && apk upgrade

# Install dependencies
RUN apk add --no-cache bash shadow logrotate tini gettext libintl nano

# Add the Crafter user
RUN addgroup -S -g 1000 crafter && adduser -S -D -u 1000 -G crafter crafter;

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Copy logrotate template conf
COPY logrotate.tpl.conf .

# Entrypoint and command
# tini will reap zombie processes
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["/usr/sbin/crond", "-f", "-L", "/dev/stdout"]
