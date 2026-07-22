#!/usr/bin/env bash
#
# Sync monorepo modules from the legacy per-repo develop branches.
#
# For each module, fetches https://github.com/craftercms/<module> (develop)
# and copies the tree into ./<module>, skipping Maven/CI/IDE metadata that
# the monorepo manages at the root (or via Gradle): pom.xml, checkstyle,
# travis, .mvn, .gitignore, coderabbit, .vscode, .idea, .github, editorconfig,
# distribution.xml, and studio/src/ui.
#
# Usage:
#   ./sync-from-legacy-repos.sh                  # all modules
#   ./sync-from-legacy-repos.sh engine studio    # selected modules
#   ./sync-from-legacy-repos.sh --dry-run        # preview only
#   ./sync-from-legacy-repos.sh --branch support/4.x engine
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

GIT_URL_PREFIX="${GIT_URL_PREFIX:-https://github.com/craftercms/}"
BRANCH="${BRANCH:-develop}"
CACHE_DIR="${CACHE_DIR:-${SCRIPT_DIR}/.legacy-sync-cache}"
DRY_RUN=0

# Default set mirrors modules.gradle ext.allModules
ALL_MODULES=(
	groovy-sandbox
	script-security-plugin
	commons
	core
	search
	profile
	engine
	deployer
	studio-ui
	studio
	social
	cli
	js-sdk
)

# Paths/files from the legacy repos that must not overwrite monorepo config
RSYNC_EXCLUDES=(
	--exclude='.git/'
	--exclude='.github/'
	--exclude='.vscode/'
	--exclude='.idea/'
	--exclude='.mvn/'
	--exclude='**/.mvn/'
	--exclude='.gitignore'
	--exclude='.gitattributes'
	--exclude='.editorconfig'
	--exclude='.coderabbit.yaml'
	--exclude='*travis*'
	--exclude='**/*travis*'
	--exclude='checkstyle.xml'
	--exclude='**/checkstyle.xml'
	--exclude='pom.xml'
	--exclude='**/pom.xml'
	--exclude='distribution.xml'
	--exclude='**/distribution.xml'
	# Legacy studio UI app
	--exclude='src/ui/'
	# Build / IDE noise from either side
	--exclude='target/'
	--exclude='**/target/'
	--exclude='build/'
	--exclude='**/build/'
	--exclude='bin/'
	--exclude='**/bin/'
	--exclude='node_modules/'
	--exclude='**/node_modules/'
	--exclude='.gradle/'
	--exclude='**/.gradle/'
)

# Keep monorepo-only files when using --delete (legacy repos are Maven)
RSYNC_PROTECT=(
	--filter='P build.gradle'
	--filter='P **/build.gradle'
	--filter='P settings.gradle'
	--filter='P **/settings.gradle'
	--filter='P gradle.properties'
	--filter='P **/gradle.properties'
	--filter='P distribution.xml'
	--filter='P **/distribution.xml'
	--filter='P src/ui/'
	--filter='P .yarn/'
	--filter='P **/.yarn/'
	--filter='P .yarnrc.yml'
	--filter='P **/.yarnrc.yml'
)

usage() {
	cat <<EOF
Usage: $(basename "$0") [options] [module ...]

Options:
  -h, --help              Show this help
  -n, --dry-run           Show what would change (rsync --dry-run)
  -b, --branch <name>     Branch to sync (default: develop)
  -c, --cache-dir <path>  Clone cache directory (default: .legacy-sync-cache)
  --git-url-prefix <url>  Org/base URL (default: https://github.com/craftercms/)

Environment overrides: BRANCH, CACHE_DIR, GIT_URL_PREFIX

If no modules are listed, syncs: ${ALL_MODULES[*]}
EOF
}

MODULES=()
while [[ $# -gt 0 ]]; do
	case "$1" in
		-h|--help)
			usage
			exit 0
			;;
		-n|--dry-run)
			DRY_RUN=1
			shift
			;;
		-b|--branch)
			BRANCH="$2"
			shift 2
			;;
		-c|--cache-dir)
			CACHE_DIR="$2"
			shift 2
			;;
		--git-url-prefix)
			GIT_URL_PREFIX="$2"
			shift 2
			;;
		--)
			shift
			MODULES+=("$@")
			break
			;;
		-*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 1
			;;
		*)
			MODULES+=("$1")
			shift
			;;
	esac
done

if [[ ${#MODULES[@]} -eq 0 ]]; then
	MODULES=("${ALL_MODULES[@]}")
fi

if ! command -v rsync >/dev/null 2>&1; then
	echo "rsync is required but not installed." >&2
	exit 1
fi

mkdir -p "${CACHE_DIR}"

RSYNC_FLAGS=(-a --delete --itemize-changes)
if [[ "${DRY_RUN}" -eq 1 ]]; then
	RSYNC_FLAGS+=(--dry-run)
	echo "==> DRY RUN (no files will be written)"
fi

echo "==> Branch: ${BRANCH}"
echo "==> Cache:  ${CACHE_DIR}"
echo "==> Modules: ${MODULES[*]}"
echo

sync_module() {
	local module="$1"
	local dest="${SCRIPT_DIR}/${module}"
	local repo_url="${GIT_URL_PREFIX}${module}.git"
	local clone_dir="${CACHE_DIR}/${module}"

	if [[ ! -d "${dest}" ]]; then
		echo "SKIP ${module}: destination directory missing (${dest})"
		return 1
	fi

	echo "---- ${module} ----"
	echo "  repo: ${repo_url}"

	if [[ -d "${clone_dir}/.git" ]]; then
		echo "  updating cache..."
		git -C "${clone_dir}" fetch --depth 1 origin "${BRANCH}"
		git -C "${clone_dir}" checkout -q -B "${BRANCH}" "FETCH_HEAD"
		git -C "${clone_dir}" reset --hard -q "FETCH_HEAD"
		git -C "${clone_dir}" clean -fdx -q
	else
		echo "  cloning into cache..."
		rm -rf "${clone_dir}"
		git clone --depth 1 --branch "${BRANCH}" "${repo_url}" "${clone_dir}"
	fi

	local short_sha
	short_sha="$(git -C "${clone_dir}" rev-parse --short HEAD)"
	echo "  at: ${BRANCH} @ ${short_sha}"

	echo "  syncing into ${dest}/ ..."
	rsync "${RSYNC_FLAGS[@]}" \
		"${RSYNC_EXCLUDES[@]}" \
		"${RSYNC_PROTECT[@]}" \
		"${clone_dir}/" \
		"${dest}/"

	echo "  done."
	echo
}

FAILED=()
for module in "${MODULES[@]}"; do
	if ! sync_module "${module}"; then
		FAILED+=("${module}")
	fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
	echo "Finished with failures: ${FAILED[*]}" >&2
	exit 1
fi

echo "==> Sync complete."
if [[ "${DRY_RUN}" -eq 0 ]]; then
	echo "Review with: git status && git diff"
fi
