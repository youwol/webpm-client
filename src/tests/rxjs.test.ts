// eslint-disable jest/no-conditional-expect
// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import { getUrlBase, install, State } from '../lib'
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
    State.clear()
})
test('install rxjs-test#latest', async () => {
    const events = []
    const packageName = 'rxjs-test'
    const { rxjs, rxjs7 } = (await install({
        modules: ['rxjs-test'],
        aliases: {
            rxjs: 'rxjs-test',
            rxjs7: 'rxjs-test#7',
        },
        onEvent: (event) => {
            events.push(event)
        },
    })) as unknown as { rxjs: unknown; rxjs7: unknown }

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
    const sideEffects: string[] = []
    const { rxjs, rxjs6 } = (await install({
        modules: [`rxjs-test#6.5.5`],
        modulesSideEffects: {
            'rxjs-test#*': () => {
                sideEffects.push('rxjs-test#6.5.5')
            },
        },
        aliases: {
            rxjs: 'rxjs-test',
            rxjs6: 'rxjs-test#6',
        },
        onEvent: (event) => {
            events.push(event)
        },
    })) as unknown as { rxjs: unknown; rxjs6: unknown }

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
    const sideEffects: string[] = []
    const { rxjs, rxjs6, rxjs7 } = (await install({
        modules: ['rxjs-test#6.5.5', 'rxjs-test#7.5.5'],
        modulesSideEffects: {
            'rxjs-test#6.x': () => {
                sideEffects.push('rxjs-test#6.5.5')
            },
            'rxjs-test#7.x': () => {
                sideEffects.push('rxjs-test#7.5.5')
            },
        },
        aliases: {
            rxjs: 'rxjs-test',
            rxjs6: 'rxjs-test#6',
            rxjs7: 'rxjs-test#7',
        },
        onEvent: (event) => {
            events.push(event)
        },
    })) as unknown as { rxjs: unknown; rxjs6: unknown; rxjs7: unknown }

    expect(document.scripts).toHaveLength(2)
    expect(sideEffects).toHaveLength(2)
    expect(sideEffects.includes('rxjs-test#6.5.5')).toBeTruthy()
    expect(sideEffects.includes('rxjs-test#7.5.5')).toBeTruthy()
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(rxjs7).toBeTruthy()
    expect(rxjs).toEqual(rxjs7)
})

test('install rxjs-test#7 with pined dependencies @#6', async () => {
    State.pinDependencies(['rxjs-test#6.5.5'])
    const { rxjs, rxjs6, rxjs7 } = (await install({
        modules: ['rxjs-test#7.5.5'],
        aliases: {
            rxjs: 'rxjs-test',
            rxjs6: 'rxjs-test#6',
            rxjs7: 'rxjs-test#7',
        },
    })) as unknown as { rxjs: unknown; rxjs6: unknown; rxjs7: unknown }

    expect(document.scripts).toHaveLength(1)
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(rxjs7).toBeFalsy()
    expect(rxjs).toEqual(rxjs6)
})

test('install rxjs-test#7 with patched url', async () => {
    const oldWarn = console.warn
    console.warn = () => {
        console.warn('A warning has been generated')
    }
    State.registerUrlPatcher(({ url }) => {
        return url.replace('7.5.5', '6.5.5')
    })
    await install({
        modules: ['rxjs-test#7.5.5'],
    })

    expect(window['rxjs-test_APIv6']).toBeTruthy()
    expect(window['rxjs-test_APIv7']).toBeFalsy()
    console.warn = oldWarn
})
