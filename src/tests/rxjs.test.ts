// eslint-disable jest/no-conditional-expect
// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import { getUrlBase, install, State } from '../lib'
import { cleanDocument, expectEvents, installPackages$ } from './common'

import './mock-requests'
import { StateImplementation } from '../lib/state'

beforeAll((done) => {
    installPackages$([
        './.packages-test/rxjs#6.5.5/cdn.zip',
        './.packages-test/rxjs#7.5.6/cdn.zip',
    ]).subscribe(() => {
        done()
    })
})
beforeEach(() => {
    cleanDocument()
    StateImplementation.clear()
})
test('install rxjs#latest', async () => {
    const events = []
    const packageName = 'rxjs'
    const { rxjs, rxjs7 } = (await install({
        modules: ['rxjs'],
        aliases: {
            rxjs: 'rxjs',
            rxjs7: 'rxjs_APIv7',
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
    const target = getUrlBase(packageName, '7.5.6') + `/dist/${packageName}.js`
    expect(s0.id).toBe(target)
    expectEvents(events, [packageName])
})

test('install rxjs#6.5.5 + side-effects', async () => {
    const events = []
    const packageName = 'rxjs'
    const sideEffects: string[] = []
    const { rxjs, rxjs6 } = (await install({
        modules: [`rxjs#6.5.5`],
        modulesSideEffects: {
            'rxjs#*': () => {
                sideEffects.push('rxjs#6.5.5')
            },
        },
        aliases: {
            rxjs: 'rxjs',
            rxjs6: 'rxjs_APIv6',
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

test('install rxjs#6 & rxjs#7', async () => {
    const events = []
    const sideEffects: string[] = []
    const { rxjs, rxjs6, rxjs7 } = (await install({
        modules: ['rxjs#6.5.5', 'rxjs#7.5.6'],
        modulesSideEffects: {
            'rxjs#6.x': () => {
                sideEffects.push('rxjs#6.5.5')
            },
            'rxjs#7.x': () => {
                sideEffects.push('rxjs#7.5.6')
            },
        },
        aliases: {
            rxjs: 'rxjs',
            rxjs6: 'rxjs_APIv6',
            rxjs7: 'rxjs_APIv7',
        },
        onEvent: (event) => {
            events.push(event)
        },
    })) as unknown as { rxjs: unknown; rxjs6: unknown; rxjs7: unknown }

    expect(document.scripts).toHaveLength(2)
    expect(sideEffects).toHaveLength(2)
    expect(sideEffects.includes('rxjs#6.5.5')).toBeTruthy()
    expect(sideEffects.includes('rxjs#7.5.6')).toBeTruthy()
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(rxjs7).toBeTruthy()
    expect(rxjs).toEqual(rxjs7)
})

test('install rxjs#7 with pined dependencies #6', async () => {
    StateImplementation.pinDependencies(['rxjs#6.5.5'])
    const { rxjs, rxjs6, rxjs7 } = (await install({
        modules: ['rxjs#7.5.5'],
        aliases: {
            rxjs: 'rxjs',
            rxjs6: 'rxjs_APIv6',
            rxjs7: 'rxjs_APIv7',
        },
    })) as unknown as { rxjs: unknown; rxjs6: unknown; rxjs7: unknown }

    expect(document.scripts).toHaveLength(1)
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(rxjs7).toBeFalsy()
    expect(rxjs).toEqual(rxjs6)
})

test('install rxjs#7 with patched url', async () => {
    State.registerUrlPatcher(({ url }) => {
        return url.replace('7.5.6', '6.5.5')
    })
    await install({
        modules: ['rxjs#7.5.6'],
    })

    expect(window['rxjs_APIv6']).toBeTruthy()
    expect(window['rxjs_APIv7']).toBeFalsy()
})
