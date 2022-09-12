# @youwol/cdn-client

Library for dynamic npm's libraries installation from YouWol's CDN.

This library is part of the hybrid cloud/local ecosystem 
[YouWol](https://platform.youwol.com/applications/@youwol/platform/latest).

## Links

[Online user-guide](https://l.youwol.com/doc/@youwol/cdn-client)

[Developers documentation](https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/cdn-client)

[Package on npm](https://www.npmjs.com/package/@youwol/cdn-client)

[Source on GitHub](https://github.com/youwol/cdn-client)

# Installation, Build, Test

To install the required dependencies:

```shell
yarn
```
---
To build for development:

```shell
yarn build:dev
```

To build for production:

```shell
yarn build:prod
```
---
Tests require [py-youwol](https://l.youwol.com/doc/py-youwol) to run on port 2001 using the configuration defined [here](https://github.com/youwol/integration-tests-conf).

To run tests:
```shell
yarn test
```

Coverage can be evaluated using:
```shell
yarn test-coverage
```
---

To generate code's documentation:

```shell
yarn doc
```
