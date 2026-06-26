#!/bin/bash
CRAFTER_STOP_HOME=${CRAFTER_STOP_HOME:=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )}

if [[ -s  "$CRAFTER_STOP_HOME/crafter.sh" ]]; then
      $CRAFTER_STOP_HOME/crafter.sh stop $1
      exit 0
else
      echo -e "\033[38;5;196m"
      echo "crafter.sh was not found in $CRAFTER_STOP_HOME"
      echo -e "\033[0m"
      exit -1
fi
