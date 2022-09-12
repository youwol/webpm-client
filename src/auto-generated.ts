const runTimeDependencies = {
    load: {
        semver: '^7.3.4',
    },
    differed: {},
    includedInBundle: ['semver'],
}
const externals = {}
export const setup = {
    name: '@youwol/cdn-client',
    assetId: 'QHlvdXdvbC9jZG4tY2xpZW50',
    version: '1.0.1',
    shortDescription:
        "Library for dynamic npm's libraries installation from YouWol's CDN.",
    developerDocumentation:
        'https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/cdn-client',
    npmPackage: 'https://www.npmjs.com/package/@youwol/cdn-client',
    sourceGithub: 'https://github.com/youwol/cdn-client',
    userGuide: 'https://l.youwol.com/doc/@youwol/cdn-client',
    apiVersion: '1',
    runTimeDependencies,
    externals,
}
