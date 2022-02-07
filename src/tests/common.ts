/** @format */

import {
    AssetsGateway,
    PyYouwol,
    raiseHTTPErrors,
    RootRouter,
} from '@youwol/http-clients'
import { Client } from '../lib/client'
import zlib from 'zlib'
import { mergeMap, reduce, take } from 'rxjs/operators'
import { from } from 'rxjs'
import { readFileSync } from 'fs'
import path from 'path'

RootRouter.HostName = getPyYouwolBasePath()
RootRouter.Headers = { 'py-youwol-local-only': 'true' }
Client.HostName = RootRouter.HostName
Client.Headers = RootRouter.Headers

Client.responseParser = (req: XMLHttpRequest) => {
    const contentEncoding = req.getResponseHeader('content-encoding')
    if (contentEncoding == 'br') {
        return new Promise((resolve) => {
            const blob = req.response
            const fileReader = new FileReader()
            fileReader.onload = function (event) {
                const decoded = zlib
                    .brotliDecompressSync(event.target.result)
                    .toString('utf8')
                resolve(decoded)
            }
            fileReader.readAsArrayBuffer(blob)
        })
    }
    if (contentEncoding == 'identity') {
        return Promise.resolve(req.responseText)
    }
    throw Error("Only 'br' or 'identity' content encoding supported")
}

export function installPackages$() {
    const assetsGtw = new AssetsGateway.AssetsGatewayClient()

    return resetPyYouwolDbs$().pipe(
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
