#!/bin/bash

# Script to create the Deployer target for a delivery environment.

if [ "$(whoami)" == "root" ]; then
	echo -e "\033[38;5;196m"
	echo -e "CrafterCMS cowardly refuses to run as root."
	echo -e "Running as root is dangerous and is not supported."
	echo -e "\033[0m"
	exit 1
fi

export DELIVERY_HOME=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

. "$DELIVERY_HOME/crafter-setenv.sh"

# Execute Groovy script
"$DELIVERY_HOME/groovy/bin/groovy" -cp "$DELIVERY_HOME" -Dgrape.root="$DELIVERY_HOME" "$DELIVERY_HOME/init-site.groovy" "$@"
