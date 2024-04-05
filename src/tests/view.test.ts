import { CdnMessageEvent, install, LoadingScreenView, monitoring } from '../lib'
import {
    cleanDocument,
    installLightErrorsWarnings,
    installPackages$,
} from './common'
import './mock-requests'
import { lastValueFrom } from 'rxjs'
import { RxVDom } from '../lib/rx-vdom.types'

installLightErrorsWarnings()

beforeAll(async () => {
    await lastValueFrom(
        installPackages$([
            './.packages/root.zip',
            './.packages-test/rx-vdom#1.0.1/cdn.zip',
        ]),
    )
})

beforeEach(() => {
    cleanDocument()
})

test('install success & custom message', async () => {
    const loadingScreen = new LoadingScreenView()
    loadingScreen.render()

    await install({
        modules: ['root'],
        onEvent: (ev) => loadingScreen.next(ev),
    })
    loadingScreen.next(
        new CdnMessageEvent('custom-message', 'A custom message'),
    )
    const elem = document.getElementById('cdn-client_custom-message')
    expect(elem).toBeTruthy()
    expect(elem.textContent).toBe('> A custom message')
})

test('state.view()', async () => {
    const { rxVdom } = (await install({
        modules: ['@youwol/rx-vdom#^1.0.1 as rxVdom'],
    })) as unknown as { rxVdom: RxVDom }

    document.body.append(rxVdom.render(monitoring().view))
    const elem = document.querySelector('.StateView')
    expect(elem).toBeTruthy()
})
