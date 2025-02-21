![build status](https://travis-ci.com/craftercms/craftercms.svg?branch=develop)

# CrafterCMS

CrafterCMS is a modern content management platform for building digital experience applications including:

* Single Page Applications (SPAs) using frameworks like React, Vue, and Angular
* Native mobile apps and headless applications (IOT, digital signage, wearables, etc.)
* HTML5 websites using Bootstrap or other HTML frameworks
* e-commerce front-ends
* OTT video experiences on AWS Elemental Media Services
* AR/VR applications using A-Frame

You can learn more about CrafterCMS here: https://craftercms.com

Try CrafterCMS using a pre-built AMI (use the `authoring` AMI): https://aws.amazon.com/marketplace/seller-profile?id=6d75ffca-9630-44bd-90b4-ac0e99058995

Download a pre-built binary archive here: https://craftercms.com/download

Read the docs here: https://craftercms.com/docs/4.0/index.html

This repository is for developers interested in contributing to CrafterCMS, customizing their own release, or building the latest. This parent project helps you build the following:

1. Deployable CrafterCMS binaries
2. Docker images
3. Developer's environment so you can compile and contribute to CrafterCMS

**WARNING:** CrafterCMS source code development and building is
_only_ supported on Unix based systems. If you want to use CrafterCMS in Windows, install Windows Subsystem for Linux (WSL) by following the instructions [here](https://docs.microsoft.com/en-us/windows/wsl/install) then use the WSL 2 terminal for all the commands below.  Please refer to the documentation
in [Installing CrafterCMS on WSL 2](https://docs.craftercms.org/current/system-administrators/activities/installing-craftercms-on-wsl2.html).

# 1. Initial Setup
Please make sure your system meets the prerequisites:
https://docs.craftercms.org/current/system-administrators/requirements-supported-platforms.html

Let's begin :)

If you're building deployable CrafterCMS binaries, we'll clone the master branch:

```bash
git clone -b master https://github.com/craftercms/craftercms.git
```

OR

If you would like to contribute to CrafterCMS, to build a developer's environment, we'll need to clone the develop branch (default):

```bash
git clone -b develop https://github.com/craftercms/craftercms.git
```

# 2. Summary of Commands and Options
## 2.1 Commands

* `download` Download dependencies
* `clone` Clone CrafterCMS modules
* `selfUpdate` Update the parent project (`craftercms`)
* `update` Update modules
* `clean` Clean modules
* `build` Build modules
* `deploy` Deploy modules
* `upgrade` Upgrade modules (same as `update`, `build`, `deploy`)
* `start` Start CrafterCMS
* `stop` Stop CrafterCMS
* `status` Report status on running environments if any
* `bundle` Create deployable binaries
* `buildAuthoringTomcat` Build an authoring Docker image
* `buildDeliveryTomcat` Build a delivery Docker image
* `buildDeployer` Build a deployer Docker image
* `buildGitSshServer` Build a Git SSH server Docker image
* `buildGitHttpServer` Build a Git HTTP server Docker image
* `buildLogRotate` Build a LogRotate Docker image
* `buildMainImages` Build the main Docker images
* `buildAllImages` Build all the Docker images

## 2.2 Options

* `overwriteChangedFiles`: Update and overwrite the deployed environment (authoring or delivery) files (binaries, configuration, etc.), default `true`
* `refreshEnv`: Update the deployed environment (authoring or delivery) with any changes to the scripts, default `false`
* `overwriteArtifact`: Update and overwrite the downloaded artifacts (example: Elasticsearch, Tomcat, ...) that's cached in the downloads folder by downloading it again, default `false`
* `gitRemote`: Git remote name to use in cloned modules, default `origin`
* `gitBranch`: Git branch to use when cloning modules, default `develop` (for develop branch)
* `gitUrl`: Which Git URL to use, default `https://github.com/craftercms/`
* `socialRequired` or `crafter.social`: Include Social in the build, default `false`
* `profileRequired` or `crafter.profile`: Include Profile in the build, default `false`
* `startElasticsearch` or `withElasticsearch`: start Elasticsearch, default `true`
* `startMongoDB`: start MongoDB, default `false` unless Profile or Social are enabled. This is automatic.
* `unitTest`: Run unit tests during build, default `false`
* `shallowClone`: Clone only the latest commits and not the entire history (faster, but you lose history), default `false`
* `bundlesDir`: Where to deposit binaries, default `./bundles`
* `downloadGrapes`: Download Grapes ahead of time (useful when no public Internet is available), default `false`
* `downloadDir`: Where to store downloads, default `./downloads`
* `authoringEnvDir`: Where to store the authoring environment, default `./crafter-authoring`
* `deliveryEnvDir`: Where to store the delivery environment, default `./crafter-delivery`
* `currentPlatform`: What platform to build to (`linux` or `darwin`), default is the build machine's OS
* `pushDockerImages`: Push the Docker images to DockerHub (if you have the right permissions), default `false`
* `tagDockerImages`: Tag the Docker images with the tag provided (if you have the right permissions), default is not to tag
* `dockerTag`: Tag used to build a Docker image, typically the version number, e.g. `4.2.0`
* `dockerEnterprise`: Set to `true` to build Enterprise Edition Docker images
* `dockerAuthoringBundle`: Use to point to an external authoring bundle from which to build the Docker images. This can be a remote URL, a local `.tar.gz` file path, or an expanded bundle path.
* `dockerDeliveryBundle`: Use to point to an external delivery bundle from which to build the Docker images. This can be a remote URL, a local `.tar.gz` file path, or an expanded bundle path.

# 3. Build Deployable Binaries

To build deployable and distributable binaries of CrafterCMS, use the Gradle task `bundle`. This task will generate `.tar.gz` files ready to be deployed to any system.

Before using `bundle` task make sure that the environment has been created and deployed using gradle tasks `build` and `deploy`

Archives will be named `crafter-cms-${environment}-VERSION.tar.gz` and can be found in the `bundles` folder.

```bash
./gradlew build deploy bundle
```

To run CrafterCMS from the binary archive, unzip and follow the instructions in the binary archive's `README.txt`.

## 3.1. Build Environment Specific Binaries
CrafterCMS is a decoupled CMS, and that means you have an `authoring` environment that caters to content creators, and a different environment, `delivery`, that handles the end-users that use the experience created by the former.

To build a binary archive for a specific environment:

```bash
    ./gradlew bundle -Penv=authoring
```
Archive will be named `crafter-cms-authoring-${version}.tar.gz` and can be found in the `bundles` folder.

For the `delivery` environment, simply substitute the `env=authoring` with `env=delivery`.

## 3.2 Update, Build and Bundle from a Tag/Branch

To download, build and generate a binary archive from a given tag or branch of the source code,

1. Clone the branch/tag of craftercms that you want to work with
```bash
    git clone -b <tag or branch> https://github.com/craftercms/craftercms/
```
2. Download, build and bundle the tag/branch that you want to work with
```bash
    ./gradlew build deploy bundle
```

**Note**:
When using a tag-based build, you're essentially cloning a point in time to build that specific version of CrafterCMS. That implies that you won't be able to update/nor push changes back.

# 4. Build a Developer's Environment
CrafterCMS comprises a number of headless API-first (GraphQL, REST, in-process)  modules that work together to provide the final solution. In this section, we'll start with the simple case of _build everything_/_run everything_, and then move on to building/hacking individual modules.


## 4.1. Build, Start and Stop All
### 4.1.1. Build All
Build all CrafterCMS modules

```bash
    ./gradlew build deploy
```

### 3.1.2. Start All
Start CrafterCMS,

 ```bash
    ./gradlew start
```

You can now point your browser to [http://localhost:8080/studio](http://localhost:8080/studio) and start using CrafterCMS. To get started with your first CrafterCMS experience, you can follow this guide: [https://docs.craftercms.org/current/content-authors/index.html](https://docs.craftercms.org/current/content-authors/index.html).

##### Note
* The authoring environment runs on port `8080`, a great place to start, while the delivery environment runs on port
`9080`.

### 4.1.3. Stop All
Stop CrafterCMS,

```bash
    ./gradlew stop
```

### 4.2. Two Environments: Authoring vs Delivery
You might have noticed that you essentially have two environments built and running: `authoring` and `delivery`. CrafterCMS is a decoupled CMS, and that means you have an `authoring` environment that caters to content creators, and a different environment, `delivery`, that handles the end-users that use the experience created by the former.

As a developer, you can use an `authoring` environment for most tasks without the need to run a `delivery` environment. It's important to note that `delivery` essentially runs the same software that's in `authoring` except Crafter Studio (the authoring tools).
By default, this project will build both environments unless instructed otherwise. The `authoring` environment runs at [http://localhost:8080/studio](http://localhost:8080/studio), whereas the `delivery` environment runs at [http://localhost:9080/](http://localhost:9080/).

### 4.2.1. Build, Start, and Stop a Specific Environment
To build, start and stop one of the two environments is similar to building/starting/stopping All.

#### Authoring
```bash
    ./gradlew build deploy -Penv=authoring
    ./gradlew start -Penv=authoring
    ./gradlew stop -Penv=authoring
```

#### Delivery
```bash
    ./gradlew build deploy -Penv=delivery
    ./gradlew start -Penv=delivery
    ./gradlew stop -Penv=delivery
```

### 4.3. Crafter Modules
The mechanics for working with a single module are similar to working with _all_, with one exception: You can deploy a module to one or both environments (`authoring`/`delivery`).

CrafterCMS comprises the following modules:
* [`core`](https://docs.craftercms.org/current/developers/projects/core/index.html)
* [`commons`](https://docs.craftercms.org/current/developers/projects/commons/index.html)
* [`engine`](https://docs.craftercms.org/current/developers/projects/engine/index.html)
* [`studio`](https://docs.craftercms.org/current/developers/projects/studio/index.html)
* [`search`](https://docs.craftercms.org/current/developers/projects/search/index.html)
* [`profile`](https://docs.craftercms.org/current/developers/projects/profile/index.html)
* [`social`](https://docs.craftercms.org/current/developers/projects/social/index.html)
* [`deployer`](https://docs.craftercms.org/current/developers/projects/deployer/index.html)

You'll find these projects checked out and ready for you to contribute to in the folder `src/{modules}`.

### 4.3.1. Forking a Module
Start by forking the module you want to work on. You can follow the [GitHub instructions](https://help.github.com/articles/fork-a-repo/).
The next step is to switch the origin url location to be the one just forked, to do so you can use [these GitHub instructions](https://help.github.com/articles/changing-a-remote-s-url/).
The last step will be to add an upstream repository from the main `craftercms` repo to your own. Follow [these steps](https://help.github.com/articles/fork-a-repo/#step-3-configure-git-to-sync-your-fork-with-the-original-spoon-knife-repository)
to make it happen.
You can now work in your local system, and build/deploy and ultimately push to your fork. We welcome code contributions, so please do send us pull-requests.

To update your project with the latest:

```bash
    ./gradlew update
```

### 4.3.2. Update, Build, Deploy, Start, and Stop a Module
You can update, build, deploy, start or stop a module by:

```bash
    ./gradlew update -Pmodules=studio
    ./gradlew build -Pmodules=studio
    ./gradlew deploy -Pmodules=studio -Penv=authoring
    ./gradlew start -Pmodules=studio -Penv=authoring
    ./gradlew stop -Pmodules=studio -Penv=authoring
```

##### Note
* If you don't specify the `env` parameter, it means all environments (where applicable).
* In the current version of CrafterCMS, some services run in the same Web container, and that implies the stopping/starting of one of these services will cause other services to stop/start as well.

# 5. Advanced Topics
For more detailed information and advanced topic, please visit the [detailed documentation](https://docs.craftercms.org/current/developers/projects/craftercms/index.html).
