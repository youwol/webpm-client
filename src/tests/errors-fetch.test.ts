// eslint-disable jest/no-conditional-expect
// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import { AssetsGateway, PyYouwol, raiseHTTPErrors } from '@youwol/http-clients'
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

beforeAll((done) => {
    const assetsGtw = new AssetsGateway.AssetsGatewayClient()
    installPackages$()
        .pipe(
            mergeMap(() => {
                const client = new PyYouwol.PyYouwolClient()
                return client.admin.environment.login$({
                    email: 'int_tests_yw-users_bis@test-user',
                })
            }),
            mergeMap(() => assetsGtw.explorer.getDefaultUserDrive$()),
            raiseHTTPErrors(),
            mergeMap(({ homeFolderId }) => {
                const zip = './packages/e.zip'
                const buffer = readFileSync(path.resolve(__dirname, zip))
                const arraybuffer = Uint8Array.from(buffer).buffer

                return assetsGtw.assets.package
                    .upload$(homeFolderId, zip, new Blob([arraybuffer]))
                    .pipe(take(1))
            }),
        )
        .subscribe(() => {
            done()
        })
})

beforeEach(() => {
    cleanDocument()
})

test('install unauthorized', async () => {
    const events = []
    try {
        await install(
            {
                modules: ['a'],
            },
            {
                displayLoadingScreen: true,
                onEvent: (ev) => {
                    if (ev instanceof UnauthorizedEvent) {
                        events.push(ev)
                    }
                },
            },
        )
    } catch (error) {
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(events).toHaveLength(2)
        saveScreen('loading-view-unauthorized.html')
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error).toBeInstanceOf(FetchErrors)
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error.detail.errors).toHaveLength(2)
    }
})

test('install script error', async () => {
    const events = []
    console.error = () => {
        /*no op*/
    }
    try {
        await install(
            {
                modules: ['e'],
            },
            {
                displayLoadingScreen: true,
                onEvent: (ev) => {
                    if (ev instanceof ParseErrorEvent) {
                        events.push(ev)
                    }
                },
            },
        )
    } catch (error) {
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(events).toHaveLength(1)
        saveScreen('loading-view-parse-error.html')
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error).toBeInstanceOf(SourceParsingFailed)
    }
})
