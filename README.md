# cdn-client

Javascript library for dynamic installation of YouWol's CDN libraries.

## Installation, Build & Test

To install the required dependencies:

```shell
yarn
```

To build for development:

```shell
yarn build:dev
```

To build for production:

```shell
yarn build:prod
```

Tests require py-youwol to run on port 2001 using the configuration defined [here](https://github.com/youwol/integration-tests-conf).

```shell
yarn test
```

To generate code documentation:

```shell
yarn doc
```

## Quick start

```
import {install} from '@youwol/cdn-client'
await install({
     modules: ['d3', '@youwol/fv-tree'],
     css: ['bootstrap#4.4.1~bootstrap.min.css'],
})
```
This code snippet trigger the installation of the modules 'd3' and '@youwol/fv-tree' using their latest version,
this includes the installation of the required direct/indirect dependencies using compatible versions.

> This client is only dealing with packages stored in the YouWol's CDN: the dependencies
> requested, as well as their direct and indirect dependencies, must have been published in it.
> More information on packages publication [here](https://platform.youwol.com/documentation/py-youwol/publish-package).

## Documentation

Documentation of the library can be found [here](https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/cdn-client).

