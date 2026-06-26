#!/bin/bash

# Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
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

chown_dir() {
  local dir="$1"
  owner=$(stat -c "%U:%G" "$dir")
  if [ "$owner" != "crafter:crafter" ]; then
    echo "The owner of $dir is $owner. Changing to crafter:crafter"
    chown -R crafter:crafter "$dir"
  fi
}

# Generate host keys (if not mounted)
ssh-keygen -t rsa -f $SSHD_HOME/ssh_host_rsa_key
ssh-keygen -t dsa -f $SSHD_HOME/ssh_host_dsa_key
ssh-keygen -t ecdsa -f $SSHD_HOME/ssh_host_ecdsa_key
ssh-keygen -t ed25519 -f $SSHD_HOME/ssh_host_ed25519_key

# Fix for ssh key permissions
MOUNTED_SSH_DIR=/opt/crafter/.ssh
USER_HOME_SSH_DIR=/home/crafter/.ssh

if [ -d $MOUNTED_SSH_DIR ]; then
    mkdir -p $USER_HOME_SSH_DIR
    cp -L $MOUNTED_SSH_DIR/* $USER_HOME_SSH_DIR

    chown_dir "$USER_HOME_SSH_DIR"
    chmod 700 $USER_HOME_SSH_DIR
    chmod 600 $USER_HOME_SSH_DIR/*
    chmod 644 $USER_HOME_SSH_DIR/*.pub
fi

if [ "$1" = 'run' ]; then
    # Do not detach, run in foreground (-D)
    exec /usr/sbin/sshd -D
else
    exec "$@"
fi