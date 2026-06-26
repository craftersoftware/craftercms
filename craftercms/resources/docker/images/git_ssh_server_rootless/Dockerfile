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

ENV SSHD_HOME='/home/crafter/sshd'

# Update & Upgrade existing packages
RUN apk update && apk upgrade

# Install dependencies
RUN apk add --no-cache bash shadow openssh git su-exec nano; \
    apk add --no-cache tini;

# Create folders for crafter user
RUN mkdir -p /opt/crafter/data

# Create volumes
VOLUME [ "/opt/crafter/data" ]

# - Add the Crafter user
# - Make git-shell the default shell of the crafter user
# - Remove root default shell access
# - Enable public key auth and disable other type of auth. Also set the host key algorithms to just RSA to avoid issues
#   with JGit/JSch
RUN addgroup -S -g 1000 crafter && adduser -S -D -u 1000 -G crafter crafter; \
    usermod -p '*' crafter; \
    chown -R crafter:crafter /opt/crafter/data; \
    mkdir $SSHD_HOME; \
    chown -R crafter:crafter $SSHD_HOME; \
    usermod -s $(command -v git-shell) crafter; \
    usermod -s /sbin/nologin root; \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/g' /etc/ssh/sshd_config; \
    sed -i 's/#ChallengeResponseAuthentication yes/ChallengeResponseAuthentication no/g' /etc/ssh/sshd_config; \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config; \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/g' /etc/ssh/sshd_config; \
    echo '' >> /etc/ssh/sshd_config; \
    echo 'HostKeyAlgorithms ssh-rsa' >> /etc/ssh/sshd_config; \
    echo '' >> /etc/ssh/sshd_config; \
    echo "HostKey $SSHD_HOME/ssh_host_rsa_key" >> /etc/ssh/sshd_config; \
    echo "HostKey $SSHD_HOME/ssh_host_dsa_key" >> /etc/ssh/sshd_config; \
    echo "HostKey $SSHD_HOME/ssh_host_ecdsa_key" >> /etc/ssh/sshd_config; \
    echo "HostKey $SSHD_HOME/ssh_host_ed25519_key" >> /etc/ssh/sshd_config;

# Copy no-interactive-login file to the crafter's user home and make it executable
COPY --chown=crafter:crafter no-interactive-login /home/crafter/git-shell-commands/no-interactive-login
RUN chmod +x /home/crafter/git-shell-commands/no-interactive-login

# Copy entrypoint script and make it executable
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Run the application as crafter user
USER crafter

# Expose port
EXPOSE 22

# Entrypoint and command (run by default)
# tini will reap zombie processes
ENTRYPOINT [ "/sbin/tini", "--", "./docker-entrypoint.sh" ]
CMD [ "run" ]
