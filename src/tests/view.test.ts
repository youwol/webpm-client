import { CdnMessageEvent, install, LoadingScreenView, monitoring } from '../lib'
import { cleanDocument, installPackages$ } from './common'
import './mock-requests'
import { render } from '@youwol/rx-vdom'
import { lastValueFrom } from 'rxjs'

beforeAll(async () => {
    await lastValueFrom(
        installPackages$([
            './.packages/root.zip',
            './.packages/a.zip',
            './.packages/b.zip',
            './.packages/c.zip',
            './.packages/d.zip',
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
    await install({
        modules: ['root'],
    })
    document.body.append(render(monitoring().view))
    const elem = document.querySelector('.StateView')
    expect(elem).toBeTruthy()
})
