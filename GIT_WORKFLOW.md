# CrafterCMS Git Workflow

CrafterCMS uses a Git workflow that's based on Gitflow: http://nvie.com/posts/a-successful-git-branching-model

## High-level

For every CrafterCMS repository, there's a long-running branch:

* `develop`: this is where development activities happen, and this branch is not meant to be stable

There's also long-running branches for every supported version of CrafterCMS:

* `support/{VERSION}`

For example, CrafterCMS has a long-running branch for version 4.x, called `support/4.x`

There are several other branches that are created and deleted over time, these include:

* feature/bug branches: branches created to develop a features, perform a task or fix a bug as part of regular development
* hotfix branches: branches created to deal with a critical bug
* release branches: branches created to prepare for a release, these are branched off `develop` and have 0 new feature additions, only bug fixes/hotfixes while the branch is tested and stabilized. Once stable, these are merged to `support/{VERSION}` for release and to `develop` to keep that updated.

A good video illustrating the flow is here: https://vimeo.com/16018419

## Tooling

This workflow is documented for `git-flow` CLI (https://github.com/nvie/gitflow) and plain `git` CLI. You can also use any other tool that supports Git Flow.

In addition, consider using:

* Zsh http://www.zsh.org/
* `oh-my-zsh` https://github.com/robbyrussell/oh-my-zsh
* `git-flow-completion` https://github.com/bobthecow/git-flow-completion

GitFlow is configured as follows:

```
gitflow.branch.master=master
gitflow.branch.develop=develop
gitflow.prefix.feature=feature/
gitflow.prefix.release=release/
gitflow.prefix.hotfix=hotfix/
gitflow.prefix.support=support/
gitflow.prefix.versiontag=v
```

Note that CrafterCMS does not use the `master` branch and instead just uses the develop and support branches.

## Workflow

### Day-to-Day Development

Day-to-day development is based on the `develop` branch, and the developer must create a feature/bugfix branch that's based on develop for the feature/bugfix before sending a PR. These features/bugfixes go back to `develop` and are not automatically merged to other branches.

#### Working on a new feature

```
git flow feature start {TICKET}
... work work work ...
git add {FILES}
git commit -m "{Descriptive comment on what it is you're committing}"
git checkout develop
git pull
git checkout feature/{TICKET}
git flow feature rebase
git flow feature publish {TICKET}
```

Where {TICKET} is the ticket number for this feature, if there is no ticket for this feature (unusual), you may enter a meaningful name for the branch.

Note the command `git flow feature rebase` before finishing the feature. This ensures that your code is merged with the latest from `develop` before finishing the feature and pushing the code upstream.

With the feature published to your remote git repo, you can send pull-requests (PRs) to `develop` or other branches as required.

With the PR in, you now wait for the code review process to complete and your PR to be accepted. Once accepted, you can now finish the feature using git flow which deletes the local branch after merging to `develop` and then push upstream.

```
git flow feature finish {TICKET}
git push
```

#### Fixing a bug

Fixing a bug is identical to working on a feature except it uses a different git flow commands `git flow bugfix start {TICKET}` and `git flow bugfix finish {TICKET}`.

### Hotfixes and Urgent Updates

Unlike features/bugfixes, hotfixes are urgent and must be applied to `master` and `develop` simultaneously. The workflow for hotfixes is identical to feature except it uses a different git flow commands `git flow hotfix start {TICKET}` and `git flow hotfix finish {TICKET}`. Git flow will make sure the hotfix is merged to `master` and `develop` and that `master` is tagged indicating a release with that hotfix.

### Release Management

In order to release the software, a temporary branch will be created that's based off of `develop` and it will not accept any new features/tasks, only bug fixes and hotfixes.

To start a new release:

```
git flow release start {X.Y.Z}
... work work work ...
git flow release finish {X.Y.Z}
```

Where:

* X is the major release number
* Y is the minor release number
* Z is the patch release number

Releases are automatically merged with `support/{VERSION}` and tagged as `v{X.Y.Z}` and then with `develop`.

Bugfixes that are relevant to the release must be merged into the release by hand as needed.
