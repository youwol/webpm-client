// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import { CdnMessageEvent, install, LoadingScreenView, monitoring } from '../lib'
import { cleanDocument, installPackages$ } from './common'
import './mock-requests'
import { render } from '@youwol/flux-view'

beforeAll((done) => {
    installPackages$([
        './.packages/root.zip',
        './.packages/a.zip',
        './.packages/b.zip',
        './.packages/c.zip',
        './.packages/d.zip',
    ]).subscribe(() => {
        done()
    })
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
