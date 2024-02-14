import { cleanDocument, installPackages$, testBackendConfig } from './common'
import { StateImplementation } from '../lib/state'
import { Client, LoadingGraphError, queryLoadingGraph } from '../lib'
import { lastValueFrom } from 'rxjs'

async function encodeExtraIndex(
    extraIndex: {
        library_name: string
        version: string
        bundle: string
        fingerprint: string
        type: 'js/wasm' | 'backend'
        dependencies: string[]
        aliases: string[]
    }[],
) {
    return fetch(
        'http://localhost:2001/admin/custom-commands/encode-extra-index',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(extraIndex),
        },
    ).then((resp) => resp.text())
}

beforeAll(async () => {
    Client.BackendConfiguration = testBackendConfig
    await lastValueFrom(
        installPackages$([
            './.packages-test/rxjs#6.5.5/cdn.zip',
            './.packages-test/rxjs#7.5.6/cdn.zip',
            './.packages-test/rx-tree-views#0.3.1/cdn.zip',
        ]),
    )
})

test('loading graph coupled - error', async () => {
    cleanDocument()
    StateImplementation.resetCache()

    const expectToThrow = async () => {
        await queryLoadingGraph({
            modules: ['@youwol/rx-tree-views#latest'],
        })
    }
    await expect(expectToThrow).rejects.toThrow(LoadingGraphError)
})

test('loading graph coupled - 1', async () => {
    cleanDocument()
    StateImplementation.resetCache()

    const extraIndex = [
        {
            library_name: '@youwol/rx-vdom',
            version: '1.0.1',
            aliases: [],
            dependencies: [],
            bundle: 'dist/@youwol/rx-vdom.js',
            fingerprint: '9bb534b31cc287963fbb39a03c3016d5',
            type: 'js/wasm' as const,
        },
    ]

    const encoded = await encodeExtraIndex(extraIndex)

    const resp = await queryLoadingGraph({
        modules: ['@youwol/rx-tree-views#latest'],
        extraIndex: encoded,
    })
    const target = {
        graphType: 'sequential-v2',
        lock: [
            {
                name: '@youwol/rx-tree-views',
                version: '0.3.1',
                id: 'QHlvdXdvbC9yeC10cmVlLXZpZXdz',
                namespace: 'youwol',
                type: 'js/wasm',
                fingerprint: 'fea277a0660fea584103a9cae56bfdb9',
                exportedSymbol: '@youwol/rx-tree-views',
                aliases: [],
                apiKey: '03',
            },
            {
                name: 'rxjs',
                version: '7.5.6',
                id: 'cnhqcw==',
                namespace: '',
                type: 'js/wasm',
                fingerprint: '346a2238d49d9ae171c72317ac6780bd',
                exportedSymbol: 'rxjs',
                aliases: ['aliasRxjs7'],
                apiKey: '7',
            },
            {
                name: '@youwol/rx-vdom',
                version: '1.0.1',
                id: 'QHlvdXdvbC9yeC12ZG9t',
                namespace: '@youwol',
                type: 'js/wasm',
                fingerprint: '9bb534b31cc287963fbb39a03c3016d5',
                exportedSymbol: '@youwol/rx-vdom',
                aliases: [],
                apiKey: '1',
            },
        ],
        definition: [
            [
                ['cnhqcw==', 'cnhqcw==/7.5.6/dist/rxjs.js'],
                [
                    'QHlvdXdvbC9yeC12ZG9t',
                    'QHlvdXdvbC9yeC12ZG9t/1.0.1/dist/@youwol/rx-vdom.js',
                ],
            ],
            [
                [
                    'QHlvdXdvbC9yeC10cmVlLXZpZXdz',
                    'QHlvdXdvbC9yeC10cmVlLXZpZXdz/0.3.1/dist/@youwol/rx-tree-views.js',
                ],
            ],
        ],
    }
    expect(resp).toEqual(target)
})

test('loading graph coupled - 2', async () => {
    cleanDocument()
    StateImplementation.resetCache()

    const extraIndex = [
        {
            library_name: '@youwol/rx-vdom',
            version: '1.0.1',
            aliases: [],
            dependencies: [],
            bundle: 'dist/@youwol/rx-vdom.js',
            fingerprint: '9bb534b31cc287963fbb39a03c3016d5',
            type: 'js/wasm' as const,
        },
        {
            library_name: 'rxjs',
            version: '7.8.1',
            aliases: [],
            dependencies: [],
            bundle: 'dist/rxjs.js',
            fingerprint: '5935b636004a5e07e898b6d7e1260a01',
            type: 'js/wasm' as const,
        },
    ]

    const encoded = await encodeExtraIndex(extraIndex)

    const resp = await queryLoadingGraph({
        modules: ['@youwol/rx-tree-views#latest'],
        extraIndex: encoded,
    })
    const target = {
        graphType: 'sequential-v2',
        lock: [
            {
                name: '@youwol/rx-tree-views',
                version: '0.3.1',
                id: 'QHlvdXdvbC9yeC10cmVlLXZpZXdz',
                namespace: 'youwol',
                type: 'js/wasm',
                fingerprint: 'fea277a0660fea584103a9cae56bfdb9',
                exportedSymbol: '@youwol/rx-tree-views',
                aliases: [],
                apiKey: '03',
            },
            {
                name: 'rxjs',
                version: '7.8.1',
                id: 'cnhqcw==',
                namespace: 'rxjs',
                type: 'js/wasm',
                fingerprint: '5935b636004a5e07e898b6d7e1260a01',
                exportedSymbol: 'rxjs',
                aliases: [],
                apiKey: '7',
            },
            {
                name: '@youwol/rx-vdom',
                version: '1.0.1',
                id: 'QHlvdXdvbC9yeC12ZG9t',
                namespace: '@youwol',
                type: 'js/wasm',
                fingerprint: '9bb534b31cc287963fbb39a03c3016d5',
                exportedSymbol: '@youwol/rx-vdom',
                aliases: [],
                apiKey: '1',
            },
        ],
        definition: [
            [
                ['cnhqcw==', 'cnhqcw==/7.8.1/dist/rxjs.js'],
                [
                    'QHlvdXdvbC9yeC12ZG9t',
                    'QHlvdXdvbC9yeC12ZG9t/1.0.1/dist/@youwol/rx-vdom.js',
                ],
            ],
            [
                [
                    'QHlvdXdvbC9yeC10cmVlLXZpZXdz',
                    'QHlvdXdvbC9yeC10cmVlLXZpZXdz/0.3.1/dist/@youwol/rx-tree-views.js',
                ],
            ],
        ],
    }
    expect(resp).toEqual(target)
})

test('loading graph coupled - 3', async () => {
    cleanDocument()
    StateImplementation.resetCache()

    const extraIndex = [
        {
            library_name: '@youwol/rx-tree-views',
            version: '0.3.999',
            aliases: [],
            dependencies: ['rxjs#^7.5.6', '@youwol/rx-vdom#^1.0.1'],
            bundle: 'dist/@youwol/rx-tree-views.js',
            fingerprint: 'fea277a0660fea584103a9cae56bfdb9',
            type: 'js/wasm' as const,
        },
        {
            library_name: '@youwol/rx-vdom',
            version: '1.0.1',
            aliases: [],
            dependencies: [],
            bundle: 'dist/@youwol/rx-vdom.js',
            fingerprint: '9bb534b31cc287963fbb39a03c3016d5',
            type: 'js/wasm' as const,
        },
    ]

    const encoded = await encodeExtraIndex(extraIndex)

    const resp = await queryLoadingGraph({
        modules: ['@youwol/rx-tree-views#latest'],
        extraIndex: encoded,
    })
    const target = {
        graphType: 'sequential-v2',
        lock: [
            {
                name: '@youwol/rx-tree-views',
                version: '0.3.999',
                id: 'QHlvdXdvbC9yeC10cmVlLXZpZXdz',
                namespace: '@youwol',
                type: 'js/wasm',
                fingerprint: 'fea277a0660fea584103a9cae56bfdb9',
                exportedSymbol: '@youwol/rx-tree-views',
                aliases: [],
                apiKey: '03',
            },
            {
                name: 'rxjs',
                version: '7.5.6',
                id: 'cnhqcw==',
                namespace: '',
                type: 'js/wasm',
                fingerprint: '346a2238d49d9ae171c72317ac6780bd',
                exportedSymbol: 'rxjs',
                aliases: ['aliasRxjs7'],
                apiKey: '7',
            },
            {
                name: '@youwol/rx-vdom',
                version: '1.0.1',
                id: 'QHlvdXdvbC9yeC12ZG9t',
                namespace: '@youwol',
                type: 'js/wasm',
                fingerprint: '9bb534b31cc287963fbb39a03c3016d5',
                exportedSymbol: '@youwol/rx-vdom',
                aliases: [],
                apiKey: '1',
            },
        ],
        definition: [
            [
                ['cnhqcw==', 'cnhqcw==/7.5.6/dist/rxjs.js'],
                [
                    'QHlvdXdvbC9yeC12ZG9t',
                    'QHlvdXdvbC9yeC12ZG9t/1.0.1/dist/@youwol/rx-vdom.js',
                ],
            ],
            [
                [
                    'QHlvdXdvbC9yeC10cmVlLXZpZXdz',
                    'QHlvdXdvbC9yeC10cmVlLXZpZXdz/0.3.999/dist/@youwol/rx-tree-views.js',
                ],
            ],
        ],
    }
    expect(resp).toEqual(target)
})
