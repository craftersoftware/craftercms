#!/bin/bash

set -euo pipefail

mkdir -p target

mapfile -t bom_files < <(find . \
	\( -path './.git' -o \
	   -path './node_modules' -o \
	   -path './.gradle' -o \
	   -path './downloads' -o \
	   -path './bundles' -o \
	   -path './crafter-authoring' -o \
	   -path './crafter-delivery' -o \
	   -path './build' \
	\) -prune -o \
	\( -path '*/build/bom.json' -o -path '*/target/bom.json' \) -print)

if [ ${#bom_files[@]} -eq 0 ]; then
	echo "No bom.json files found."
	exit 1
fi

if command -v cyclonedx-cli &> /dev/null; then
	cyclonedx-cli merge --output-file target/bom.json --input-format json --output-format json --input-files "${bom_files[@]}"
elif command -v cyclonedx &> /dev/null; then
	cyclonedx merge --output-file target/bom.json --input-format json --output-format json --input-files "${bom_files[@]}"
else
	echo "CycloneDX CLI is not installed."
fi
