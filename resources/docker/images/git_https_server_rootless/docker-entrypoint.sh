#!/bin/bash

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

if [ ! -f "$SSL_CERT_FILE_PATH" ]; then
    echo "Please provide the server's SSL certificate at $SSL_CERT_FILE_PATH"
    exit 1
fi

if [ ! -f "$SSL_PRIV_KEY_FILE_PATH" ]; then
    echo "Please provide the server's SSL private key at $SSL_PRIV_KEY_FILE_PATH"
    exit 1
fi

# Generate the password file only if the file doesn't exist yet (for example to avoid overwriting a mounted file)
if [ ! -f "$PASSWD_FILE_PATH" ]; then
    if [ -z "$GIT_USERNAME" ]; then
        echo "Please set GIT_USERNAME env variable when no file $PASSWD_FILE_PATH is provided"
        exit 1
    fi

    if [ -z "$GIT_PASSWORD" ]; then
        echo "Please set GIT_PASSWORD env variable when no file $PASSWD_FILE_PATH is provided"
        exit 1
    fi

    htpasswd -cb "$PASSWD_FILE_PATH" "$GIT_USERNAME" "$GIT_PASSWORD"
fi

# Start the Apache server
exec httpd-foreground