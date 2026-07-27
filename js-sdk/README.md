# js-sdk
CrafterCMS SDK for JavaScript in the browser and NodeJS

## Project Structure

The `packages` directory contains the different SDK packages and their respective sources (TypeScript for the most part)

Please go into the distinct packages to see the docs.

- [classes](./packages/classes)
- [content](./packages/content)
- [ice](./packages/ice)
- [models](./packages/models)
- [redux](./packages/redux)
- [search](./packages/search)
- [utils](./packages/utils)

## Building & Testing

You never need to build unless you're interested in collaborating on the development of this library. See the [packages](./packages) you're interested in for usage instructions if you just want to consume the SDK.

### Building

- `yarn` will fetch all dependencies for development
- `./build.sh` will use Webpack to generate a production ES5 bundle under `dist` folder

### Testing

Run `yarn test` on each of the packages to execute all tests.

# Community
## Contributors
https://github.com/craftersoftware/craftercms/blob/develop/CONTRIBUTORS.md

## Code of Conduct
https://github.com/craftersoftware/craftercms/blob/develop/CODE_OF_CONDUCT.md

## Contributing
https://github.com/craftersoftware/craftercms/blob/develop/CONTRIBUTING.md

## Git Workflow
https://github.com/craftersoftware/craftercms/blob/develop/GIT_WORKFLOW.md
