#!/usr/bin/env bash

promptForCrafterHome() {
  echo ""
  echo "A settings_local.sh with your CRAFTER_HOME is required. Let's create one 😎"
  echo "What's your CrafterCMS build home? (the directory that container crafter-authoring, crafter-delivery, etc)"
  read -r crafterHome
  if [[ ! -d "$crafterHome" ]]; then
    echo "Oops. That directory doesn't exist. Please check and re-run this script. Bye."
    echo ""
    exit 1
  fi
  if [[ ! -d "$crafterHome/crafter-authoring" ]]; then
    echo ""
    echo "Oops. That directory doesn't appear to be a CrafterCMS. Here's what's on '$crafterHome':"
    ls -1 "$crafterHome"
    echo "Please check and re-run this script. Bye."
    echo ""
    exit 1
  fi
  echo "CRAFTER_HOME=$crafterHome" > "$localSettingsFilePath"
  echo "Sweet. Settings file was created for you @ '$currentDir/settings_local.sh'."
  echo "Moving on..."
}

singleSlash="/"
doubleSlash="//"
localSettingsFilePath="./scripts/settings_local.sh"

readonly currentDir=$(
  cd "$(dirname "$0")" || exit 1
  pwd
)

cd "$currentDir/../" || exit 1

if [[ ! -f "$localSettingsFilePath" ]]; then
  promptForCrafterHome
fi

if [[ ! -f "$localSettingsFilePath" ]]; then
  echo "Can't find the settings_local.sh file. Something went wrong. 🤔"
  exit 1
fi

# shellcheck source=/dev/null
source $localSettingsFilePath
if [[ -z "${CRAFTER_HOME}" ]]; then
  promptForCrafterHome
fi

DEFAULT_SITE=$CRAFTER_HOME/crafter-authoring/bin/apache-tomcat/webapps/studio/default-site
DEFAULT_SITE="${DEFAULT_SITE/$doubleSlash/$singleSlash}"
STATIC_ASSETS=${DEFAULT_SITE}/static-assets
TEMPLATES=${DEFAULT_SITE}/templates

SRC=$(pwd)

DO_LINK=true
DO_REMOVE=false
DO_RESTORE=false
DO_SYNC=false
DO_BACKUP=false
DO_APP=false

for ARG in "$@"; do
  case "$ARG" in
  --link)
    DO_LINK=true
    DO_REMOVE=true
    DO_RESTORE=false
    DO_SYNC=false
    DO_BACKUP=false
    ;;
  --remove)
    DO_LINK=false
    DO_REMOVE=true
    DO_RESTORE=false
    DO_SYNC=false
    DO_BACKUP=false
    ;;
  --restore)
    DO_LINK=false
    DO_REMOVE=true
    DO_RESTORE=true
    DO_SYNC=false
    DO_BACKUP=false
    ;;
  --sync)
    DO_LINK=false
    DO_REMOVE=false
    DO_RESTORE=false
    DO_SYNC=true
    DO_BACKUP=false
    ;;
  --backup)
    DO_LINK=false
    DO_REMOVE=false
    DO_RESTORE=false
    DO_SYNC=false
    DO_BACKUP=true
    ;;
  --app)
    DO_LINK=false
    DO_REMOVE=false
    DO_RESTORE=false
    DO_SYNC=false
    DO_BACKUP=false
    DO_APP=true
    ;;
  *)
    echo "Unknown option $ARG."
    exit 1
    ;;
  esac
done

echo ""

# region Backup
if [[ $DO_BACKUP == true ]]; then
  echo "Backup directories"
  mkdir "$DEFAULT_SITE/link-backup"
  cp -r "$STATIC_ASSETS/app" "$DEFAULT_SITE/link-backup/app"
  cp -r "$STATIC_ASSETS/scripts" "$DEFAULT_SITE/link-backup/scripts"
  cp -r "$STATIC_ASSETS/styles" "$DEFAULT_SITE/link-backup/styles"
  cp -r "$TEMPLATES" "$DEFAULT_SITE/link-backup/templates"
  cp -r "$STATIC_ASSETS/themes" "$DEFAULT_SITE/link-backup/themes"
  cp -r "$STATIC_ASSETS/libs" "$DEFAULT_SITE/link-backup/libs"
  cp -r "$STATIC_ASSETS/images" "$DEFAULT_SITE/link-backup/images"
  cp -r "$DEFAULT_SITE/site" "$DEFAULT_SITE/link-backup/site"
  cp -r "$STATIC_ASSETS/js" "$DEFAULT_SITE/link-backup/js"
fi
# endregion

# region Remove
if [[ $DO_REMOVE == true ]]; then
  echo "Removing directories"
  rm -rf "$STATIC_ASSETS/app"
  rm -rf "$STATIC_ASSETS/scripts"
  rm -rf "$STATIC_ASSETS/styles"
  rm -rf "$TEMPLATES"
  rm -rf "$STATIC_ASSETS/themes"
  rm -rf "$STATIC_ASSETS/libs"
  rm -rf "$STATIC_ASSETS/images"
  rm -rf "$DEFAULT_SITE/site"
  rm -rf "$STATIC_ASSETS/js"
fi
# endregion

# region Restore
if [[ $DO_RESTORE == true ]]; then
  echo "Restoring directories"
  cp -r "$DEFAULT_SITE/link-backup/app" "$STATIC_ASSETS/app"
  cp -r "$DEFAULT_SITE/link-backup/scripts" "$STATIC_ASSETS/scripts"
  cp -r "$DEFAULT_SITE/link-backup/styles" "$STATIC_ASSETS/styles"
  cp -r "$DEFAULT_SITE/link-backup/templates" "$TEMPLATES"
  cp -r "$DEFAULT_SITE/link-backup/themes" "$STATIC_ASSETS/themes"
  cp -r "$DEFAULT_SITE/link-backup/libs" "$STATIC_ASSETS/libs"
  cp -r "$DEFAULT_SITE/link-backup/images" "$STATIC_ASSETS/images"
  cp -r "$DEFAULT_SITE/link-backup/site" "$DEFAULT_SITE/site"
  cp -r "$DEFAULT_SITE/link-backup/js" "$STATIC_ASSETS/js"
fi
# endregion

# region Link
if [[ $DO_LINK == true ]]; then
  echo "Linking directories"
  ln -s "$SRC/static-assets/app" "$STATIC_ASSETS"
  ln -s "$SRC/static-assets/scripts" "$STATIC_ASSETS"
  ln -s "$SRC/static-assets/styles" "$STATIC_ASSETS"
  ln -s "$SRC/templates" "$DEFAULT_SITE"
  ln -s "$SRC/static-assets/themes" "$STATIC_ASSETS/themes"
  ln -s "$SRC/static-assets/libs" "$STATIC_ASSETS/libs"
  ln -s "$SRC/static-assets/images" "$STATIC_ASSETS/images"
  ln -s "$SRC/site" "$DEFAULT_SITE/site"
  ln -s "$SRC/static-assets/js" "$STATIC_ASSETS/js"
fi
# endregion

# region Sync
if [[ $DO_SYNC == true ]]; then
  echo "Synchronizing directories"
  cp -r "$SRC/static-assets/app" "$STATIC_ASSETS"
  cp -r "$SRC/static-assets/scripts" "$STATIC_ASSETS"
  cp -r "$SRC/static-assets/styles" "$STATIC_ASSETS"
  cp -r "$SRC/templates" "$DEFAULT_SITE"
  cp -r "$SRC/static-assets/themes" "$STATIC_ASSETS"
  cp -r "$SRC/static-assets/libs" "$STATIC_ASSETS"
  cp -r "$SRC/static-assets/images" "$STATIC_ASSETS"
  cp -r "$SRC/site" "$DEFAULT_SITE"
  cp -r "$SRC/static-assets/js" "$STATIC_ASSETS"
fi
# endregion

# region App
if [[ $DO_APP == true ]]; then
  echo "Copying App"
  cp -r "$SRC/static-assets/app" "$STATIC_ASSETS"
fi
# endregion

cd "$currentDir" || exit 1

echo "Process completed. Arrivederci!"
echo ""
