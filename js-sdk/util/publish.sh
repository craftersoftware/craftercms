#!/usr/bin/env bash

readonly utilsDir=$(
  cd $(dirname $0)
  pwd
)

cd ${utilsDir}/../dist/packages-dist

PACKAGES=(classes
  content
  ice
  models
  redux
  search
  utils)

# PACKAGES=()

# npm login

for P in ${PACKAGES[@]}; do
  cd $P
  echo ""
  echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
  echo "Publishing '$P' package"
  echo "--------------------------------------------"
  echo "Running command: 'npm publish --access public'"
  npm publish --access public
  echo "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
  echo ""
  cd ../
done
