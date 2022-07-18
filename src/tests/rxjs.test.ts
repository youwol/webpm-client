import { getUrlBase, install, Client } from '../lib'
import { cleanDocument, expectEvents, installPackages$ } from './common'

import './mock-requests'

beforeAll((done) => {
    installPackages$([
        './.packages-test/rxjs-test#6/cdn.zip',
        './.packages-test/rxjs-test#7/cdn.zip',
    ]).subscribe(() => {
        done()
    })
})
beforeEach(() => {
    cleanDocument()
    Client.resetCache()
})
test('install rxjs-test#latest', async () => {
    const events = []
    const packageName = 'rxjs-test'
    const { rxjs, rxjs7 } = (await install(
        {
            modules: ['rxjs-test'],
            aliases: {
                rxjs: 'rxjs-test',
                rxjs7: 'rxjs-test#7',
            },
        },
        {
            onEvent: (event) => {
                events.push(event)
            },
        },
    )) as any

    expect(document.scripts).toHaveLength(1)
    expect(rxjs).toBeTruthy()
    expect(rxjs7).toBeTruthy()
    expect(rxjs).toEqual(rxjs7)
    const s0 = document.scripts.item(0)
    const target = getUrlBase(packageName, '7.5.5') + `/dist/${packageName}.js`
    expect(s0.id).toBe(target)
    expectEvents(events, [packageName])
})

test('install rxjs-test#6.5.5 + side-effects', async () => {
    const events = []
    const packageName = 'rxjs-test'
    let sideEffects: string[] = []
    const { rxjs, rxjs6 } = (await install(
        {
            modules: [
                {
                    name: 'rxjs-test',
                    version: '6.5.5',
                    sideEffects: () => {
                        sideEffects.push('rxjs-test#6.5.5')
                    },
                },
            ],
            aliases: {
                rxjs: 'rxjs-test',
                rxjs6: 'rxjs-test#6',
            },
        },
        {
            onEvent: (event) => {
                events.push(event)
            },
        },
    )) as any

    expect(document.scripts).toHaveLength(1)
    expect(sideEffects).toHaveLength(1)
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(rxjs).toEqual(rxjs6)
    const s0 = document.scripts.item(0)
    const target = getUrlBase(packageName, '6.5.5') + `/dist/${packageName}.js`
    expect(s0.id).toBe(target)
    expectEvents(events, [packageName])
})

test('install rxjs-test#6 & rxjs-test#7', async () => {
    const events = []
    const packageName = 'rxjs-test'
    let sideEffects: string[] = []
    const { rxjs, rxjs6, rxjs7 } = (await install(
        {
            modules: [
                {
                    name: 'rxjs-test',
                    version: '6.5.5',
                    sideEffects: () => sideEffects.push('rxjs-test#6.5.5'),
                },
                {
                    name: 'rxjs-test',
                    version: '7.5.5',
                    sideEffects: () => sideEffects.push('rxjs-test#7.5.5'),
                },
            ],
            aliases: {
                rxjs: 'rxjs-test',
                rxjs6: 'rxjs-test#6',
                rxjs7: 'rxjs-test#7',
            },
        },
        {
            onEvent: (event) => {
                events.push(event)
            },
        },
    )) as any

    expect(document.scripts).toHaveLength(2)
    expect(sideEffects).toHaveLength(2)
    expect(sideEffects.includes('rxjs-test#6.5.5')).toBeTruthy()
    expect(sideEffects.includes('rxjs-test#7.5.5')).toBeTruthy()
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(rxjs7).toBeTruthy()
    expect(rxjs).toEqual(rxjs7)
})
