#!/usr/bin/env bash

#
# Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
#

libsDirectory=../../static-assets/libs

# ace build
rm -rf "$libsDirectory/ace"
rsync -ar --delete ../../node_modules/ace-builds/src-min-noconflict/ "$libsDirectory/ace/"
cp src/ace/mode-yaml/* "$libsDirectory/ace"
echo "Ace build complete"

# js-yaml build
rm -rf "$libsDirectory/js-yaml"
mkdir "$libsDirectory/js-yaml"
rsync -ar --delete ../../node_modules/js-yaml/dist/browser/js-yaml.umd.min.js "$libsDirectory/js-yaml/js-yaml.min.js"
echo "Copied js-yaml assets"

# bootstrap build
rm -rf "$libsDirectory/bootstrap"
mkdir "$libsDirectory/bootstrap"
rsync -ar --delete ../../node_modules/bootstrap/scss/ "$libsDirectory/bootstrap/scss"
rsync -ar --delete ../../node_modules/bootstrap/dist/js/bootstrap.min.js "$libsDirectory/bootstrap/bootstrap.min.js"
rsync -ar --delete ../../node_modules/@popperjs/core/dist/umd/popper.min.js "$libsDirectory/bootstrap/popper.min.js"
echo "Copied Bootstrap assets"

# jquery-ui build
echo "Building custom jQuery (events)..."
rm -rf "$libsDirectory/jquery-ui"
rsync -ar --delete ../../node_modules/jquery-ui/dist/ "$libsDirectory/jquery-ui"
rsync -ar --delete ../../node_modules/jquery-ui-css/jquery-ui.min.css "$libsDirectory/jquery-ui/jquery-ui.min.css"

if [[ "$OSTYPE" == "darwin"* ]]; then
  # Mac OS sed command needs a prefix for the backup file, if '' (empty) it won't create a backup file
  sed -i '' 's/typeof define\&\&define.amd?define/typeof crafterDefine\&\&crafterDefine.amd?crafterDefine/' ../../static-assets/libs/jquery-ui/jquery-ui.min.js
else
  sed -i 's/typeof define\&\&define.amd?define/typeof crafterDefine\&\&crafterDefine.amd?crafterDefine/' ../../static-assets/libs/jquery-ui/jquery-ui.min.js
fi

echo "jQuery UI build complete"

# tinymce build
rm -rf "$libsDirectory/tinymce"
cp -r ../../node_modules/tinymce "$libsDirectory/tinymce"
rsync -ar --delete ./src/tinymce/langs "$libsDirectory/tinymce"

echo "Copied TinyMCE"

# Monaco
echo "Building Monaco editor..."
yarn build:monaco
echo "Monaco editor build complete"

echo "Building jQuery..."
# jQuery - Custom build for XB
npmContentBuildDirectory=./build
guestBuildDirectory=../guest/src/
# clean/create npm build directories
rm -rf $npmContentBuildDirectory
mkdir $npmContentBuildDirectory
mkdir "$npmContentBuildDirectory/jquery"
# clean/create guest build directory
rm -rf "$guestBuildDirectory/jquery"
mkdir "$guestBuildDirectory/jquery"
git clone --quiet -c advice.detachedHead=false --branch 3.7.1 https://github.com/jquery/jquery jquery-src
rm -rf jquery-src/.git
npm --prefix ./jquery-src install -s ./jquery-src
yarn build:jquery
# Copy build files to npm build directory
rsync -ar --delete ./src/jquery/index.d.ts "$npmContentBuildDirectory/jquery/index.d.ts"
rsync -ar --delete ./jquery-src/dist/jquery.js "$npmContentBuildDirectory/jquery/index.js"
# Copy build files to guest
rsync -ar --delete ./src/jquery/index.d.ts "$guestBuildDirectory/jquery/index.d.ts"
rsync -ar --delete ./jquery-src/dist/jquery.js "$guestBuildDirectory/jquery/index.js"
rm -rf jquery-src

# jquery - legacy
rm -rf "$libsDirectory/jquery"
mkdir "$libsDirectory/jquery"
rsync -ar --delete ../../node_modules/jquery/dist/jquery.min.js "$libsDirectory/jquery/jquery.min.js"
if [[ "$OSTYPE" == "darwin"* ]]; then
  # Mac OS sed command needs a prefix for the backup file, if '' (empty) it won't create a backup file
  sed -i '' 's/typeof define\&\&define.amd\&\&define/typeof crafterDefine\&\&crafterDefine.amd\&\&crafterDefine/' ../../static-assets/libs/jquery/jquery.min.js
else
  sed -i 's/typeof define\&\&define.amd\&\&define/typeof crafterDefine\&\&crafterDefine.amd\&\&crafterDefine/' ../../static-assets/libs/jquery/jquery.min.js
fi

echo "jQuery build complete"
