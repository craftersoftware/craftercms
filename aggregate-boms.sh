#!/bin/bash

mkdir -p target

if command -v cyclonedx-cli &> /dev/null; then
  cyclonedx-cli merge --output-file target/bom.json --input-format json --output-format json --input-files $(find craftercms/src -name 'bom.json')
elif command -v cyclonedx &> /dev/null; then
  cyclonedx merge --output-file target/bom.json --input-format json --output-format json --input-files $(find craftercms/src -name 'bom.json')
else
  echo "CycloneDX CLI is not installed."
fi
