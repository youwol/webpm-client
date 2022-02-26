/** @format */

import {
    AssetsGateway,
    PyYouwol,
    raiseHTTPErrors,
    RootRouter,
} from '@youwol/http-clients'
import { Client, LoadingScreenView } from '../lib'
import { mergeMap, reduce, take } from 'rxjs/operators'
import { from } from 'rxjs'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

RootRouter.HostName = getPyYouwolBasePath()
RootRouter.Headers = { 'py-youwol-local-only': 'true' }
Client.HostName = RootRouter.HostName
Client.Headers = RootRouter.Headers

export function installPackages$() {
    const assetsGtw = new AssetsGateway.AssetsGatewayClient()
    const pyYouwol = new PyYouwol.PyYouwolClient()
    return resetPyYouwolDbs$().pipe(
        mergeMap(() => {
            return pyYouwol.admin.environment.login$({
                email: 'int_tests_yw-users@test-user',
            })
        }),
        mergeMap(() => assetsGtw.explorer.getDefaultUserDrive$()),
        raiseHTTPErrors(),
        mergeMap((resp: AssetsGateway.DefaultDriveResponse) => {
            return from([
                { folderId: resp.homeFolderId, zip: './packages/root.zip' },
                {
                    folderId: resp.homeFolderId,
                    zip: './packages/a.zip',
                },
                {
                    folderId: resp.homeFolderId,
                    zip: './packages/b.zip',
                },
                {
                    folderId: resp.homeFolderId,
                    zip: './packages/c.zip',
                },
                {
                    folderId: resp.homeFolderId,
                    zip: './packages/d.zip',
                },
            ])
        }),
        mergeMap(({ folderId, zip }) => {
            const buffer = readFileSync(path.resolve(__dirname, zip))
            const arraybuffer = Uint8Array.from(buffer).buffer

            return assetsGtw.assets.package
                .upload$(folderId, zip, new Blob([arraybuffer]))
                .pipe(take(1))
        }),
        reduce((acc, e) => [...acc, e], []),
    )
}

export function getPyYouwolBasePath() {
    return 'http://localhost:2001'
}

export function resetPyYouwolDbs$() {
    return new PyYouwol.PyYouwolClient().admin.customCommands.doGet$('reset')
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
        `${__dirname}/html-outputs/${filename}`,
        document.documentElement.innerHTML,
    )
}
