import { AssetsGateway, ExplorerBackend } from '@youwol/http-clients'
import {
    LocalYouwol,
    raiseHTTPErrors,
    RootRouter,
} from '@youwol/http-primitives'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { from } from 'rxjs'
import { mergeMap, reduce, take } from 'rxjs/operators'
import {
    CdnEvent,
    Client,
    LoadingScreenView,
    SourceLoadedEvent,
    SourceLoadingEvent,
    SourceParsedEvent,
    StartEvent,
    DefaultLoadingScreenOptions,
} from '../lib'
import { backendConfiguration } from '../lib/backend-configuration'
import { ContextTrait } from '../lib/workers-pool'

RootRouter.HostName = getPyYouwolBasePath()
RootRouter.Headers = { 'py-youwol-local-only': 'true' }
Client.Headers = RootRouter.Headers
Client.BackendConfiguration = backendConfiguration({
    pathLoadingGraph: '/api/assets-gateway/cdn-backend/queries/loading-graph',
    pathRawPackage: '/api/assets-gateway/raw/package',
})

/**
 *
 * @param packages path (string) from 'tests' directory (e.g. './packages/root.zip')
 */
export function installPackages$(packages: string[]) {
    const assetsGtw = new AssetsGateway.AssetsGatewayClient()
    const pyYouwol = new LocalYouwol.Client()
    return resetPyYouwolDbs$().pipe(
        mergeMap(() => {
            return pyYouwol.admin.environment.login$({
                body: {
                    authId: 'int_tests_yw-users@test-user',
                    envId: 'prod',
                },
            })
        }),
        mergeMap(() => assetsGtw.explorer.getDefaultUserDrive$()),
        raiseHTTPErrors(),
        mergeMap((resp: ExplorerBackend.GetDefaultDriveResponse) => {
            return from(
                packages.map((zipPath) => ({
                    folderId: resp.homeFolderId,
                    zip: zipPath,
                })),
            )
        }),
        mergeMap(({ folderId, zip }) => {
            const buffer = readFileSync(path.resolve(__dirname, zip))
            const arraybuffer = Uint8Array.from(buffer).buffer

            return assetsGtw.cdn
                .upload$({
                    queryParameters: { folderId },
                    body: { fileName: zip, blob: new Blob([arraybuffer]) },
                })
                .pipe(take(1))
        }),
        reduce((acc, e) => [...acc, e], []),
    )
}

export function getPyYouwolBasePath() {
    const url = globalThis.youwolJestPresetGlobals.integrationUrl
    if (globalThis.youwolJestPresetGlobals.debug) {
        console.log('URL in common.ts : ', url)
    }
    return url
}

export function resetPyYouwolDbs$() {
    return new LocalYouwol.Client().admin.customCommands.doGet$({
        name: 'reset',
    })
}

export function cleanDocument() {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    LoadingScreenView.DefaultOptions = {
        ...new DefaultLoadingScreenOptions(),
        fadingTimeout: 0,
    }
}

export function saveScreen(filename: string) {
    expect(document.getElementById('loading-screen')).toBeTruthy()
    writeFileSync(
        `${__dirname}/.html-outputs/${filename}`,
        document.documentElement.innerHTML,
    )
}

export function expectEvents(events: CdnEvent[], names: string[]) {
    expect(
        events
            .filter((e) => e instanceof StartEvent)
            .map((e: StartEvent) => e.targetName)
            .sort(),
    ).toEqual(names)
    expect(
        new Set(
            events
                .filter((e) => e instanceof SourceLoadingEvent)
                .map((e: SourceLoadingEvent) => e.targetName)
                .sort(),
        ),
    ).toEqual(new Set(names))
    expect(
        events
            .filter((e) => e instanceof SourceLoadedEvent)
            .map((e: SourceLoadedEvent) => e.targetName)
            .sort(),
    ).toEqual(names)
    expect(
        events
            .filter((e) => e instanceof SourceParsedEvent)
            .map((e: SourceParsedEvent) => e.targetName)
            .sort(),
    ).toEqual(names)
}

export class TestContext implements ContextTrait {
    public readonly prefix = ''
    public readonly indent = 0
    public readonly t0: number

    constructor(params: { prefix?: string; t0?: number } = {}) {
        Object.assign(this, params)
        this.t0 = params.t0 || Date.now()
    }

    withChild<T>(name: string, cb: (ctx: ContextTrait) => T): T {
        const context = new TestContext({
            prefix: `\t${this.prefix}.${name}`,
            t0: this.t0,
        })
        context.info('>Start')
        return cb(context)
    }

    info(text: string) {
        const delta = (Date.now() - this.t0) / 1000
        console['ensureLog'](`${delta}: ${this.prefix}: ${text}`)
    }
}
