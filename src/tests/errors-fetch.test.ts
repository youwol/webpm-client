import { AssetsGateway } from '@youwol/http-clients'
import { readFileSync } from 'fs'
import path from 'path'
import { mergeMap, take } from 'rxjs/operators'
import {
    FetchErrors,
    install,
    ParseErrorEvent,
    SourceParsingFailed,
    UnauthorizedEvent,
} from '../lib'
import { cleanDocument, installPackages$, saveScreen } from './common'
import './mock-requests'
import { LocalYouwol, raiseHTTPErrors } from '@youwol/http-primitives'
import { StateImplementation } from '../lib/state'
import { lastValueFrom } from 'rxjs'

jest.setTimeout(10000)
beforeAll(async () => {
    const assetsGtw = new AssetsGateway.AssetsGatewayClient()
    const setup$ = installPackages$([
        './.packages/root.zip',
        './.packages/a.zip',
        './.packages/b.zip',
        './.packages/c.zip',
        './.packages/d.zip',
        './.packages/e.zip',
    ]).pipe(
        mergeMap(() => {
            const client = new LocalYouwol.Client()
            return client.admin.environment.login$({
                body: {
                    authId: 'int_tests_yw-users_bis@test-user',
                    envId: 'prod',
                },
            })
        }),
        mergeMap(() => assetsGtw.explorer.getDefaultUserDrive$()),
        raiseHTTPErrors(),
        mergeMap(({ homeFolderId }) => {
            const zip = './.packages/e.zip'
            const buffer = readFileSync(path.resolve(__dirname, zip))
            const arraybuffer = Uint8Array.from(buffer).buffer

            return assetsGtw.cdn
                .upload$({
                    queryParameters: { folderId: homeFolderId },
                    body: { fileName: zip, blob: new Blob([arraybuffer]) },
                })
                .pipe(take(1))
        }),
    )
    await lastValueFrom(setup$)
})

beforeEach(() => {
    cleanDocument()
    StateImplementation.clear()
})

test('install unauthorized', async () => {
    const events = []
    const expectToThrow = async () => {
        await install({
            modules: ['a'],
            displayLoadingScreen: true,
            onEvent: (ev) => {
                if (ev instanceof UnauthorizedEvent) {
                    events.push(ev)
                }
            },
        })
    }
    await expect(expectToThrow).rejects.toThrow(FetchErrors)
    expect(events).toHaveLength(2)
    saveScreen('loading-view-unauthorized.html')
    // I don't know how to assert on the thrown error 'expect(error.detail.errors).toHaveLength(2)'
})

test('install script error', async () => {
    const events = []
    console.error = () => {
        /*no op*/
    }
    const expectToThrow = async () => {
        await install({
            modules: ['e'],
            displayLoadingScreen: true,
            onEvent: (ev) => {
                if (ev instanceof ParseErrorEvent) {
                    events.push(ev)
                }
            },
        })
    }
    await expect(expectToThrow).rejects.toThrow(SourceParsingFailed)
    expect(events).toHaveLength(1)
    saveScreen('loading-view-parse-error.html')
})
