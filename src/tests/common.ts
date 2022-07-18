import {
    AssetsGateway,
    PyYouwol,
    ExplorerBackend,
    raiseHTTPErrors,
    RootRouter,
} from '@youwol/http-clients'
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
} from '../lib'

RootRouter.HostName = getPyYouwolBasePath()
RootRouter.Headers = { 'py-youwol-local-only': 'true' }
Client.HostName = RootRouter.HostName
Client.Headers = RootRouter.Headers

/**
 *
 * @param packages path (string) from 'tests' directory (e.g. './packages/root.zip')
 */
export function installPackages$(packages: string[]) {
    const assetsGtw = new AssetsGateway.AssetsGatewayClient()
    const pyYouwol = new PyYouwol.PyYouwolClient()
    return resetPyYouwolDbs$().pipe(
        mergeMap(() => {
            return pyYouwol.admin.environment.login$({
                body: {
                    email: 'int_tests_yw-users@test-user',
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
    return 'http://localhost:2001'
}

export function resetPyYouwolDbs$() {
    return new PyYouwol.PyYouwolClient().admin.customCommands.doGet$({
        name: 'reset',
    })
}

export function cleanDocument() {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    Client.importedBundles = {}
    LoadingScreenView.DefaultFadingTimeout = 0
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
