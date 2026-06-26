#!/bin/bash
CRAFTER_START_HOME=${CRAFTER_START_HOME:=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )}

if [[ -s  "$CRAFTER_START_HOME/crafter.sh" ]]; then
      $CRAFTER_START_HOME/crafter.sh start $@
      echo "Happy Crafting"
      exit 0
else
      echo -e "\033[38;5;196m"
      echo "crafter.sh was not found in $CRAFTER_START_HOME"
      echo -e "\033[0m"
      exit -1
fi
