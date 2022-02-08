# cdn-client

<p>
    <a href="https://github.com/kefranabg/readme-md-generator/graphs/commit-activity" target="_blank">
        <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
    </a>
    <a href="https://github.com/kefranabg/readme-md-generator/blob/master/LICENSE" target="_blank">
        <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
    </a>
</p>

Javascript library for dynamic dependencies fetching from YouWol's CDN


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

Tests require py-youwol to run on port 2001 using the configuration defined in the test directory.

```shell
yarn test
```

To generate code documentation:

```shell
yarn doc
```

## Usage

This library is used to dynamically fetch dependencies from YouWol's CDN in a front-end application, e.g.:

```typescript
await cdn.install(
    {
        modules: [ 'd3',  {name:'@youwol/fv-tree', version:"latest"}],
        css:[
            'bootstrap#4.4.1~bootstrap.min.css'
        ]
    })
```
Missing dependencies from the provided mapping will be fetched using their latest version.

> This client is only dealing with packages stored in the YouWol's CDN: the dependencies 
> requested, as well as their direct and indirect dependencies, must exist in there.

The library can also be used to install stylesheets or javascript addons, see the developer documentation.