#!/bin/bash

# Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

# Function to run commands as 'crafter' if the current user is not 'crafter'
run_as() {
    if [ "$(id -u)" != "$(id -u crafter)" ]; then
        exec su crafter -c "$*"
    else
        exec "$@"
    fi
}

chown_dir() {
  local dir="$1"
  owner=$(stat -c "%U:%G" "$dir")
  if [ "$owner" != "crafter:crafter" ]; then
    echo "The owner of $dir is $owner. Changing to crafter:crafter"
    chown -R crafter:crafter "$dir"
  fi
}

export CRAFTER_HOME=$(cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd)
export CRAFTER_BIN_DIR=$CRAFTER_HOME/bin

. "$CRAFTER_BIN_DIR/crafter-setenv.sh"

chown_dir "$CRAFTER_LOGS_DIR"
chown_dir "$CRAFTER_TEMP_DIR"

if [ ! -d $CATALINA_LOGS_DIR ]; then
    mkdir -p $CATALINA_LOGS_DIR
    chown_dir "$CATALINA_LOGS_DIR"
fi
if [ ! -d $CATALINA_TMPDIR ]; then
    mkdir -p $CATALINA_TMPDIR
    chown_dir "$CATALINA_TMPDIR"
fi

# Export the crafter HOME dir
export HOME=/home/crafter

if [ "$1" = 'run' ]; then
    run_as $CRAFTER_BIN_DIR/apache-tomcat/bin/catalina.sh run
elif [ "$1" = 'debug' ]; then
    run_as $CRAFTER_BIN_DIR/apache-tomcat/bin/catalina.sh jpda run
else
    exec "$@"
fi