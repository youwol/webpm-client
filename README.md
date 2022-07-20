# cdn-client

<p>
    <a href="https://github.com/kefranabg/readme-md-generator/graphs/commit-activity" target="_blank">
        <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
    </a>
    <a href="https://github.com/kefranabg/readme-md-generator/blob/master/LICENSE" target="_blank">
        <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
    </a>
</p>

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
this includes the installation of the required indirect dependencies using appropriates version.

> This client is only dealing with packages stored in the YouWol's CDN: the dependencies
> requested, as well as their direct and indirect dependencies, must exist in there.

## Documentation
Documentation of the library can be found [here](https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/cdn-client).

