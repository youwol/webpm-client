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
    const { rxjs, rxjs6, aliasRxjs6 } = (await install({
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
    })) as unknown as { rxjs: unknown; rxjs6: unknown; aliasRxjs6: unknown }

    expect(document.scripts).toHaveLength(1)
    expect(sideEffects).toHaveLength(1)
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(aliasRxjs6).toBeTruthy()
    expect(rxjs).toEqual(rxjs6)
    expect(rxjs).toEqual(aliasRxjs6)
    const s0 = document.scripts.item(0)
    const target = getUrlBase(packageName, '6.5.5') + `/dist/${packageName}.js`
    expect(s0.id).toBe(target)
    expectEvents(events, [packageName])
})

test('install rxjs#6 & rxjs#7', async () => {
    const events = []
    const sideEffects: string[] = []
    const { rxjs, rxjs6, rxjs7, aliasRxjs6, aliasRxjs7 } = (await install({
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
    })) as unknown as {
        rxjs: unknown
        rxjs6: unknown
        rxjs7: unknown
        aliasRxjs6: unknown
        aliasRxjs7: unknown
    }

    expect(document.scripts).toHaveLength(2)
    expect(sideEffects).toHaveLength(2)
    expect(sideEffects.includes('rxjs#6.5.5')).toBeTruthy()
    expect(sideEffects.includes('rxjs#7.5.6')).toBeTruthy()
    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    // Aliases are only available for latest version of a module
    expect(aliasRxjs6).toBeFalsy()
    expect(rxjs7).toBeTruthy()
    expect(aliasRxjs7).toBeTruthy()
    expect(rxjs).toEqual(rxjs7)
    expect(rxjs).toEqual(aliasRxjs7)
})

test('install rxjs with inlined aliases', async () => {
    const { rxjs7 } = (await install({
        modules: ['rxjs as rxjs7'],
    })) as unknown as {
        rxjs7: { __yw_set_from_version__: string }
    }

    expect(rxjs7).toBeTruthy()
    expect(rxjs7.__yw_set_from_version__).toBe('7.5.6')
    expect(window['rxjs']).toBe(rxjs7)
})

test('install rxjs#x with inlined aliases', async () => {
    const { rxjs7 } = (await install({
        modules: ['rxjs#x as rxjs7'],
    })) as unknown as {
        rxjs7: { __yw_set_from_version__: string }
    }

    expect(rxjs7).toBeTruthy()
    expect(rxjs7.__yw_set_from_version__).toBe('7.5.6')
    expect(window['rxjs']).toBe(rxjs7)
})

test('install rxjs#^6.0.0 with inlined aliases', async () => {
    const { rxjs6 } = (await install({
        modules: ['rxjs#^6.0.0 as rxjs6'],
    })) as unknown as {
        rxjs6: { __yw_set_from_version__: string }
    }

    expect(rxjs6).toBeTruthy()
    expect(rxjs6.__yw_set_from_version__).toBe('6.5.5')
    expect(window['rxjs']).toBe(rxjs6)
})

test('install rxjs#^6.0.0 & rxjs#^7.0.0 with inlined aliases', async () => {
    const { rxjs6, rxjs7 } = (await install({
        modules: ['rxjs#^6.0.0 as rxjs6', 'rxjs#^7.0.0 as rxjs7'],
    })) as unknown as {
        rxjs7: { __yw_set_from_version__: string }
        rxjs6: { __yw_set_from_version__: string }
    }

    expect(rxjs6).toBeTruthy()
    expect(rxjs6.__yw_set_from_version__).toBe('6.5.5')
    expect(rxjs7).toBeTruthy()
    expect(rxjs7.__yw_set_from_version__).toBe('7.5.6')
    expect(window['rxjs']).toBe(rxjs7)
})

test('install rxjs#6 then rxjs#7', async () => {
    const { rxjs, rxjs6, aliasRxjs6 } = (await install({
        modules: ['rxjs#6.5.5'],
        aliases: {
            rxjs: 'rxjs',
            rxjs6: 'rxjs_APIv6',
        },
    })) as unknown as {
        rxjs: unknown
        rxjs6: unknown
        aliasRxjs6: unknown
    }

    expect(document.scripts).toHaveLength(1)

    expect(rxjs).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(rxjs).toEqual(rxjs6)
    expect(aliasRxjs6).toEqual(rxjs6)

    const { rxjs7, aliasRxjs7 } = (await install({
        modules: ['rxjs#7.5.6'],
        aliases: {
            rxjs: 'rxjs',
            rxjs7: 'rxjs_APIv7',
        },
    })) as unknown as {
        rxjs7: unknown
        aliasRxjs7: unknown
    }
    expect(globalThis['rxjs']).toBeTruthy()
    expect(rxjs6).toBeTruthy()
    expect(globalThis['rxjs']).toEqual(rxjs7)
    expect(aliasRxjs7).toEqual(rxjs7)
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
