/** @format */
import './mock-requests'

// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */
import { installPackages$ } from './common'
import { install } from '../lib/loader'
import { LoadingScreenView } from '../lib/loader.view'
import { writeFileSync } from 'fs'
import {
    SourceLoadedEvent,
    SourceLoadingEvent,
    SourceParsedEvent,
    StartEvent,
} from '../lib/models'
import { ScreenView } from '../lib/utils.view'

beforeAll((done) => {
    installPackages$().subscribe(() => {
        done()
    })
})

test('install a with add-on', async (done) => {
    ScreenView.fadingTimeout = 0
    const loadingScreen = new LoadingScreenView({
        container: document.body,
        mode: 'svg',
    })
    loadingScreen.render()

    const events = []
    await install(
        {
            modules: ['a'],
            scripts: ['a#1.0.0~folder/add-on.js'],
        },
        {
            onEvent: (event) => {
                loadingScreen.next(event)
                events.push(event)
            },
        },
    )
    expect(
        events
            .filter((e) => e instanceof StartEvent)
            .map((e) => e.targetName)
            .sort(),
    ).toEqual(['a', 'root'])
    expect(
        events
            .filter((e) => e instanceof SourceLoadingEvent)
            .map((e) => e.targetName)
            .sort(),
    ).toEqual(['a', 'root'])
    expect(
        events
            .filter((e) => e instanceof SourceLoadedEvent)
            .map((e) => e.targetName)
            .sort(),
    ).toEqual(['a', 'root'])
    expect(
        events
            .filter((e) => e instanceof SourceParsedEvent)
            .map((e) => e.targetName)
            .sort(),
    ).toEqual(['a', 'root'])
    expect(document.scripts).toHaveLength(3)
    expect(window['a']).toEqual({
        name: 'a',
        rootName: 'root',
        addOn: ['add-on'],
    })
    expect(document.getElementById('loading-screen')).toBeTruthy()
    writeFileSync(
        `${__dirname}/html-outputs/loading-view.html`,
        document.documentElement.innerHTML,
    )
    expect(
        document.getElementById('root').textContent.includes('> root'),
    ).toBeTruthy()
    expect(
        document.getElementById('a').textContent.includes('> a'),
    ).toBeTruthy()
    loadingScreen.done()
    const div = document.getElementById('loading-screen').parentElement
    expect(div.style.getPropertyValue('opacity')).toBe('0')

    setTimeout(() => {
        expect(document.getElementById('loading-screen')).toBeFalsy()
        done()
    }, 0)
})
