/** @format */

// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import './mock-requests'

import { cleanDocument, installPackages$ } from './common'
import {
    CdnEvent,
    Client,
    fetchSource,
    getLoadingGraph,
    getUrlBase,
    install,
    InstallDoneEvent,
    SourceLoadedEvent,
    SourceLoadingEvent,
    SourceParsedEvent,
    StartEvent,
} from '../lib'
import { writeFileSync } from 'fs'

beforeAll((done) => {
    installPackages$().subscribe(() => {
        done()
    })
})

beforeEach(() => {
    cleanDocument()
    Client.resetCache()
})

function expectEvents(events: CdnEvent[], names: string[]) {
    expect(
        events
            .filter((e) => e instanceof StartEvent)
            .map((e: StartEvent) => e.targetName)
            .sort(),
    ).toEqual(names)
    expect(
        events
            .filter((e) => e instanceof SourceLoadingEvent)
            .map((e: SourceLoadingEvent) => e.targetName)
            .sort(),
    ).toEqual(names)
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

test('install root', async () => {
    const events = []

    await install(
        {
            modules: ['root'],
        },
        {
            onEvent: (event) => {
                events.push(event)
            },
        },
    )
    expect(document.scripts).toHaveLength(1)
    const s0 = document.scripts.item(0)
    const target = getUrlBase('root', '1.0.0') + '/root.js'
    expect(s0.id).toBe(target)
    expect(window['root'].name).toBe('root')
    expectEvents(events, ['root'])
})

test('loading graph a', async () => {
    const resp = await getLoadingGraph({
        libraries: { a: 'latest' },
    })
    expect(resp).toEqual({
        graphType: 'sequential-v1',
        lock: [
            {
                name: 'a',
                version: '1.0.0',
                id: 'YQ==',
                namespace: '',
                type: 'library',
            },
            {
                name: 'root',
                version: '1.0.0',
                id: 'cm9vdA==',
                namespace: '',
                type: 'library',
            },
        ],
        definition: [
            [['cm9vdA==', 'cm9vdA==/1.0.0/root.js']],
            [['YQ==', 'YQ==/1.0.0/a.js']],
        ],
    })
    const src = await fetchSource('a', 'YQ==', 'YQ==/1.0.0/a.js')
    expect(src.content).toBe(`window.a = {
    rootName: window['root'].name,
    name: 'a',
    addOn: [],
}

//# sourceURL=/api/assets-gateway/raw/package/YQ==/1.0.0/`)
})

test('install a', async (done) => {
    const events = []
    await install(
        {
            modules: ['a'],
        },
        {
            displayLoadingScreen: true,
            onEvent: (event) => {
                events.push(event)
                if (event instanceof InstallDoneEvent) {
                    // eslint-disable-next-line jest/no-conditional-expect -- some comment
                    expect(
                        document.getElementById('loading-screen'),
                    ).toBeTruthy()
                    writeFileSync(
                        `${__dirname}/html-outputs/loading-view.html`,
                        document.documentElement.innerHTML,
                    )
                }
            },
        },
    )
    expect(document.scripts).toHaveLength(2)
    expect(window['a']).toEqual({
        name: 'a',
        rootName: 'root',
        addOn: [],
    })

    expectEvents(events, ['a', 'root'])
    expect(events.filter((e) => e instanceof InstallDoneEvent)).toHaveLength(1)
    setTimeout(() => {
        expect(document.getElementById('loading-screen')).toBeFalsy()
        done()
    }, 0)
})

test('install a with add-on', async () => {
    await install({
        modules: ['a'],
        scripts: ['a#1.0.0~folder/add-on.js'],
    })
    expect(document.scripts).toHaveLength(3)
    expect(window['a']).toEqual({
        name: 'a',
        rootName: 'root',
        addOn: ['add-on'],
    })
})

test('double install a with add-on', async () => {
    const events1 = []
    const events2 = []
    await install(
        {
            modules: ['a'],
            scripts: ['a#1.0.0~folder/add-on.js'],
        },
        {
            onEvent: (event) => events1.push(event),
        },
    )
    await install(
        {
            modules: ['a'],
            scripts: ['a#1.0.0~folder/add-on.js'],
        },
        {
            onEvent: (event) => events2.push(event),
        },
    )
    expect(events1).toHaveLength(9)
    expect(events2).toHaveLength(1)
    const scripts = Array.from(document.scripts).map((s) => s.id)
    expect(scripts).toHaveLength(3)
    expect(window['a']).toEqual({
        name: 'a',
        rootName: 'root',
        addOn: ['add-on'],
    })
    expect(events2[0]).toBeInstanceOf(InstallDoneEvent)
})

// eslint-disable-next-line jest/no-commented-out-tests -- want to keep it
// test('install a with add-on & css', async () => {
//     await install({
//         modules: ['a'],
//         scripts: ['a#1.0.0~folder/add-on.js'],
//         css: ['a#1.0.0~style.css'],
//     })
//     expect(document.scripts).toHaveLength(3)
//     expect(window['a']).toEqual({
//         name: 'a',
//         rootName: 'root',
//         addOn: ['add-on'],
//     })
//     const div = document.createElement('div')
//     div.classList.add('package-a')
//     document.body.appendChild(div)
//     const style = window.getComputedStyle(div)
//     expect(style.getPropertyValue('background-color')).toBe('blue')
// })
