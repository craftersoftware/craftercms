# CrafterCMS

CrafterCMS is a modern content management platform for building digital experience applications including:

* Single Page Applications (SPAs) using frameworks like React, Vue, and Angular
* Native mobile apps and headless applications (IOT, digital signage, wearables, etc.)
* HTML5 websites using Bootstrap or other HTML frameworks
* e-commerce front-ends
* OTT video experiences on AWS Elemental Media Services
* AR/VR applications using A-Frame

You can learn more about CrafterCMS here: https://craftercms.org.

Try CrafterCMS using a pre-built AMI (use the `authoring` AMI): https://aws.amazon.com/marketplace/seller-profile?id=6d75ffca-9630-44bd-90b4-ac0e99058995

Download a pre-built binary archive here: https://craftercms.org/downloads.

Read the docs here: https://craftercms.com/docs/current

This repository is for developers interested in contributing to CrafterCMS, customizing their own release, or building the latest. This parent project helps you build the following:

1. Deployable CrafterCMS binaries
2. Docker images
3. Developer's environment so you can compile and contribute to CrafterCMS

**WARNING:** CrafterCMS source code development and building is
_only_ supported on Unix based systems. If you want to use CrafterCMS in Windows, use [Docker](https://craftercms.com/docs/current/by-role/system-admin/installation.html#docker) or install Windows Subsystem for Linux (WSL) by following the instructions [here](https://docs.microsoft.com/en-us/windows/wsl/install) then use the WSL 2 terminal for all the commands below.

# 1. Initial Setup
Please make sure your system meets the prerequisites:
https://craftercms.com/docs/current/by-role/system-admin/installation.html#requirements

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

For more information on CrafterCMS Git Workflow, please review: https://github.com/craftercms/craftercms/blob/master/GIT_WORKFLOW.md


# 2. Summary of Commands and Options
## 2.1 Commands

* `download` Download dependencies
* `clone` Clone CrafterCMS modules
* `selfUpdate` Update the parent project (`craftercms`)
* `update` Update modules
* `clean` Clean modules
* `build` Build modules
* `deploy` Deploy modules
* `upgrade` Upgrade modules (same as `update`, `clean`, `build`, `deploy`)
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
* `deleteDockerArtifacts` Delete all Docker artifacts (CrafterCMS and non-CrafterCMS, including containers, images, and volumes)

## 2.2 Options

* `overwriteChangedFiles`: Update and overwrite the deployed environment (authoring or delivery) files (binaries, configuration, etc.), default `true`
* `refreshEnv`: Update the deployed environment (authoring or delivery) with any changes to the scripts, default `false`
* `overwriteArtifact`: Update and overwrite the downloaded artifacts (example: OpenSearch, Tomcat, ...) that's cached in the downloads folder by downloading it again, default `false`
* `gitRemote`: Git remote name to use in cloned modules, default `origin`
* `gitBranch`: Git branch to use when cloning modules, default `develop` (for develop branch)
* `gitUrl`: Which Git URL to use, default `https://github.com/craftercms/`
* `socialRequired`: Include Social in the build, default `false`
* `profileRequired`: Include Profile in the build, default `false`
* `startSearch` or `withSearch`: start OpenSearch, default `true`
* `startMongoDB`: start MongoDB, default `false` unless Profile or Social are enabled. This is automatic.
* `unitTest`: Run unit tests during build, default `false`
* `shallowClone`: Clone only the latest commits and not the entire history (faster, but you lose history), default `false`
* `bundlesDir`: Where to deposit binaries, default `./bundles`
* `downloadGrapes`: Download Grapes ahead of time (useful when no public Internet is available), default `false`
* `downloadDir`: Where to store downloads, default `./downloads`
* `authoringEnvDir`: Where to store the authoring environment, default `./crafter-authoring`
* `deliveryEnvDir`: Where to store the delivery environment, default `./crafter-delivery`
* `currentPlatform`: What platform to build to (`linux` or `darwin`), default is the build machine's OS
* `currentArch`: What arch to build to (`aarch64` or `x86_64`), default is the build machine's arch
* `pushDockerImages`: Push the Docker images to DockerHub (if you have the right permissions), default `false`
* `tagDockerImages`: Tag the Docker images with the tag provided (if you have the right permissions), default is not to tag
* `rootlessDockerImages`: Docker images without using root at runtime, default `false`
* `dockerTag`: Tag used to build a Docker image, typically the version number, e.g. `4.2.0`
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

> **_NOTE:_**
When using a tag-based build, you're essentially cloning a point in time to build that specific version of CrafterCMS. That implies that you won't be able to update/nor push changes back.

# 4. Build a Developer's Environment
CrafterCMS comprises a number of headless API-first (GraphQL, REST, in-process)  modules that work together to provide the final solution. In this section, we'll start with the simple case of _build everything_/_run everything_, and then move on to building/hacking individual modules.


## 4.1. Build, Start and Stop All
### 4.1.1. Build All
Build all CrafterCMS modules

```bash
    ./gradlew build deploy
```

### 4.1.2. Start All
Start CrafterCMS,

 ```bash
    ./gradlew start
```

You can now point your browser to [http://localhost:8080/studio](http://localhost:8080/studio) and start using CrafterCMS. To get started with your first CrafterCMS experience, you can follow this guide: [Your First Templated Project](https://craftercms.com/docs/current/getting-started/your-first-project/templated.html) or [Your First Headless Project](https://craftercms.com/docs/current/getting-started/your-first-project/headless.html).

> **_NOTE:_**
    * The authoring environment runs on port `8080`, a great place to start, while the delivery environment runs on port `9080`.

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
* [`engine`](https://craftercms.com/docs/current/reference/modules/engine/index.html)
* [`studio`](https://craftercms.com/docs/current/reference/modules/studio/index.html)
* [`profile`](https://craftercms.com/docs/current/reference/modules/profile/index.html)
* [`social`](https://craftercms.com/docs/current/reference/modules/social/index.html)
* [`deployer`](https://craftercms.com/docs/current/reference/modules/deployer/index.html)

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

> **_NOTE:_**
    * If you don't specify the `env` parameter, it means all environments (where applicable).
    * In the current version of CrafterCMS, some services run in the same Web container, and that implies the stopping/starting of one of these services will cause other services to stop/start as well.

# 5. Advanced Topics
For more detailed information and advanced topic, please visit the [detailed documentation](https://docs.craftercms.org/current/by-role/developer/index.html).

CrafterCMS has two environments, the Authoring Environment and the Delivery Environment.

The authoring environment provides all the content management services, enabling authoring, managing and publishing of all content.  It provides a comprehensive set of user-friendly features for managing and optimizing your experiences.

The delivery environment provides content delivery services.  It consumes content published from your authoring environment and provides developers with the foundation for quickly building high-performance, flexible experiences.

In this section we will be discussing the scripts for the authoring and delivery environments.

## 5.1 Authoring and Delivery Environment Scripts

The CrafterCMS Authoring and Delivery scripts will help you on the basic startup and shutdown of the services needed to run a healthy *Authoring environment* and *Delivery environment* with the following scripts:

| **Script**|``crafter.sh``|
|-----------|--------------|
|**Description**|Main Script to start and stop all needed Services to have a functional CrafterCMS *Authoring/Delivery Environment* <br>To log the output of the script to a file, set the environment variable CRAFTER_SCRIPT_LOG to point to a log file|
|**Synopsis**|``crafter.sh start``\|``stop``\|``debug``\|``help``|
|**Arguments**|``start [withMongoDB] [skipSearch] [skipMongoDB] [tailTomcat]``<br>Starts all CrafterCMS services in this order: Crafter Deployer, OpenSearch, Apache Tomcat<br>&nbsp;&nbsp;&nbsp;&nbsp;If `withMongoDB` is specified MongoDB will be started.<br>&nbsp;&nbsp;&nbsp;&nbsp;If `skipSearch` is specified OpenSearch will not be started.<br>&nbsp;&nbsp;&nbsp;&nbsp;If `skipMongoDB` is specified MongoDB will not be started even if the Crafter Profile war is present.<br>&nbsp;&nbsp;&nbsp;&nbsp;If `tailTomcat` is specified, Tomcat will be tailed and Crafter will shutdown when the script terminates.<br><br>``stop``  Stops all CrafterCMS services in the same order as they start.<br><br>``debug [withMongoDB] [skipSearch] [skipMongoDB]``<br>Starts all CrafterCMS services with the JAVA remote debug port 5000 for Crafter Deployer, and 8000 for Apache Tomcat for the *Authoring Environment*<br>Starts all CrafterCMS services with the JAVA remote debug port 5001 for Crafter Deployer, and 9000 for Apache Tomcat for the *Delivery Environment*<br>&nbsp;&nbsp;&nbsp;&nbsp;If `withMongoDB` is specified MongoDB will be started.<br>&nbsp;&nbsp;&nbsp;&nbsp;If `skipSearch` is specified OpenSearch will not be started.<br>&nbsp;&nbsp;&nbsp;&nbsp;If `skipMongoDB` is specified MongoDB will not be started even if the Crafter Profile war is present.<br><br>``start_deployer``  Starts Deployer<br><br>``stop_deployer``  Stops Deployer<br><br>    ``debug_deployer``  Starts Deployer in debug mode<br><br>``restart_deployer``  Restarts Deployer<br><br>``start_search``  Starts OpenSearch<br><br>``stop_search``  Stops OpenSearch<br><br>``debug_search``  Starts OpenSearch in debug mode<br><br>``restart_search``  Restarts OpenSearch<br><br>``start_tomcat``  Starts Apache Tomcat<br><br>``stop_tomcat``  Stops Apache Tomcat<br><br>``debug_tomcat``  Starts Apache Tomcat in debug mode<br><br>``restart_tomcat`` Restarts Apache Tomcat<br><br>``restart_debug_tomcat``  Restarts Apache Tomcat in debug mode<br><br>``start_mongodb``  Starts MongoDB<br><br>``stop_mongodb``  Stops MongoDB<br><br>``restart_mongodb``  Restarts MongoDB<br><br>``status``  Prints the status of all CrafterCMS subsystems<br><br>``status_engine``  Prints the status of Crafter Engine<br><br>``status_studio``  Prints the status of Crafter Studio<br><br>``status_profile``  Prints the status of Crafter Profile<br><br>``status_social``  Prints the status of Crafter Social<br><br>``status_deployer``  Prints the status of Crafter Deployer<br><br>``status_search``  Prints the status of OpenSearch<br><br>``status_mariadb``  Prints the status of MariaDb<br><br>``status_mongodb``  Prints the status of MongoDB<br><br>``backup <name>``  Perform a backup of all data<br><br>``restore <file>``  Perform a restore of all data<br><br>``upgradedb``  Perform database upgrade (mariadb-upgrade)|

| **Synopsis**| ``startup.sh``|
|-----|-----|
|**Description**| Starts all needed Services to have a functional CrafterCMS *Authoring/Delivery Environment*|

|**Synopsis**|``shutdown.sh``|
|-----|-----|
|**Description**| Stops all needed Services to have a functional CrafterCMS *Authoring/Delivery Environment*|

|**Synopsis**| ``debug.sh`` |
|-----|-----|
|**Description**| Starts all needed Services to have a functional CrafterCMS *Authoring/Delivery Environment* with the JAVA remote debug ports open and listening port 5000/5001 for Crafter Deployer, and 8000/9000 for Apache Tomcat |

|**Script**|``deployer.sh``|
|-----|------|
|**Description**|Script located in *$CRAFTER_HOME/bin/crafter-deployer* which will start,stop Crafter Deployer for the *Authoring/Delivery* environment|
|**Synopsis**|``deployer.sh start``\|``stop``\|``debug``\|``help`` |
|**Arguments**|``start`` Starts all CrafterCMS services in this order Crafter Deployer OpenSearch, Apache Tomcat<br><br>``stop``  Stops all CrafterCMS services in the same order as they start.<br><br>``debug`` Start all CrafterCMS services with the JAVA remote debug port 5000 for Crafter Deployer, and 8000 for Apache Tomcat for the *Authoring Environment* <br>Starts all CrafterCMS services with the JAVA remote debug port 5001 for Crafter Deployer, and 9000 for Apache Tomcat for the *Delivery Environment*<br><br>``help``  Prints script help|

<br><br>
For more information on environment variables used by ``crafter.sh``, see [CrafterCMS Environment Variables](https://docs.craftercms.org/current/by-role/system-admin/configuration.html#environment-variables)
<br><br>
Let's look at an example on how to start an authoring environment using the scripts we discussed above.  To start the authoring environment, go to your CrafterCMS install folder then run the following:

```bash
   cd crafter-authoring
   ./startup.sh
```

What the above does is go to your authoring environment folder, then run the startup script.

To stop the authoring environment:

```bash
   ./shutdown.sh
```

### 5.1.1 Other Scripts

For more information about Apache Tomcat, and OpenSearch please refer to the following:

 * [Tomcat Script documentation](https://tomcat.apache.org/tomcat-10.0-doc/RUNNING.txt)
 * [OpenSearch documentation](https://opensearch.org/docs/latest/)


## 5.2 Gradle Authoring and Delivery Environment Scripts

As we have seen in the getting started section above, to run a gradle task, we run the following from the root of the project:

```bash
   ./gradlew command [-Penv={env}] [-Pmodules={module}]
```


Here's a list of commands (Gradle tasks) available:

| Command<br>``command`` | Description | Env Options<br>``env`` | Module Options<br>``module`` |
|-----|-----|-----|-----|
| clone | Clones CrafterCMS | <ul><li>None</li></ul> | <ul><li>None</li></ul> |
| build | Build module/s or an entire environment<br>`Note:: build will clone if needed` | authoring<hr> delivery | <ul><li>None</li><li>studio</li><li>deployer</li><li>engine</li><li>search</li><li>social</li><li>profile</li><li>core</li><li>commons</li><li>studio-ui</li><li>groovy-sandbox</li><li>script-security-plugin</li><li>cli</li></ul>|
| deploy | Deploy module/s or an entire environment | authoring<hr>delivery | <ul><li>None</li><li>studio</li><li>deployer</li><li>engine</li><li>search</li><li>social</li><li>social-admin</li><li>profile</li><li>profile-admin</li><li>commons</li><li>core</li><li>studio-ui</li><li>groovy-sandbox</li><li>script-security-plugin</li><li>cli</li></ul> |
| bundle | Build deployable and distributable binaries | authoring <hr> delivery | <ul><li>None</li></ul> |
| start | Start CrafterCMS | authoring <hr> delivery | <ul><li>None</li></ul> |
| stop | Stop CrafterCMS | authoring <hr> delivery | <ul><li>None</li></ul> |
| update | Update a module or modules | <ul><li>None</li></ul> | <ul><li>None</li><li>studio</li><li>deployer</li><li>engine</li><li>search</li><li>social</li><li>profile</li><li>core</li><li>commons</li><li>studio-ui</li><li>groovy-sandbox</li><li>script-security-plugin</li><li>cli</li></ul> |
| upgrade | Upgrades the installed Tomcat version, etc, without deleting your data then builds and deploys | <ul><li>None</li></ul> | <ul><li>None</li></ul> |
| selfupdate | Updates the CrafterCMS project (gradle) | <ul><li>None</li></ul> | <ul><li>None</li></ul> |
| clean | Delete all compiled objects | <ul><li>None</li></ul> | <ul><li>None</li></ul> |

> **_NOTE:_**
    * If you don't specify the ``env`` parameter, it means all environments (where applicable).
    * In the current version of CrafterCMS, some services run in the same Web container, and that implies the stopping/starting of one of these services will cause other services to stop/start as well.
    * The Gradle task property ``modules`` accepts one or multiple module/s, separated by commas like this: ``./gradlew build -Pmodules=search,studio``
    * The ``clean`` command does not delete previously built environment folders ``crafter-authoring`` and ``crafter-delivery``. To build a fresh copy of these two, backup your custom data and delete both folders manually.

<br><br>
Let's see some examples of running Gradle tasks here.

### 5.2.1 BUILD

To build the authoring and delivery environments, run the following:

```bash
   ./gradlew build
```

The Gradle task above will:

1. Download the dependencies
2. Build all CrafterCMS modules from the source (check the [section](#git) on how to update the source)

    - ``crafter-authoring``
    - ``crafter-delivery``

To build a module (all module options for task ``build`` are listed in the table above), run the following (we'll build the module *studio* in the example below):

```bash
   ./gradlew build -Pmodules=studio
```

To build an environment, run the following (we'll build the authoring environment in the example below:

```bash
   ./gradlew build -Penv=authoring
```

### 5.2.2 START

To start an environment, run the following:

```bash
   ./gradlew start [-Penv={env}]
```

For an alternative to start an environment, run the following:

```bash
   cd crafter-{env}
   ./startup.sh
```

The options above will:

For the *Authoring Environment*:

* The above will start the authoring environment with the default port 8080

For the *Delivery Environment*:

* The above will start the delivery environment with the default port 9080

Here's an example starting a delivery environment:

```bash
   ./gradlew start -Penv=delivery
```

### 5.2.3 STOP

To stop an environment, run the following:

```bash
   ./gradlew stop [-Penv={env}]
```

For an alternative to stop an environment, run the following:

```bash
   cd crafter-{env}
   ./shutdown.sh
```

### 5.2.4 BUNDLE

The Gradle task ``bundle`` will build deployable and distributable binaries of CrafterCMS for the authoring and/or delivery environments.  This will generate tar files ready to be unarchived and run.

```bash
   ./gradlew bundle [-Penv={env}]
```

Binaries will be saved as ``crafter-cms-authoring-VERSION.tar.gz`` for the *Authoring Environment* and ``crafter-cms-delivery-VERSION.tar.gz`` for the *Delivery Environment* in the ``bundles`` folder

Using the common task property ``env`` lets you select what environment (authoring or delivery) will be generated.

Let's look at an example using the task property mentioned above:

```bash
    ./gradlew bundle -Penv=authoring
```

The command above will generate an authoring binary archive in the bundles folder named ``crafter-cms-authoring-VERSION.tar.gz``.

