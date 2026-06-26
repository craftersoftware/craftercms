#!/usr/bin/env bash
DEPLOYER_START_HOME=${DEPLOYER_START_HOME:=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )}
cd $DEPLOYER_START_HOME/..
if [[ -s  "crafter.sh" ]]; then
      ./crafter.sh stop_deployer
      echo "Happy Crafting"
      cd -
      exit 0
else
      echo -e "\033[38;5;196m"
      echo "deployer.sh was not found in $DEPLOYER_START_HOME"
      echo -e "\033[0m"
      cd -
      exit -1
fi
