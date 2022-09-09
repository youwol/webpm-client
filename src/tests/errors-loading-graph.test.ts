// eslint-disable jest/no-conditional-expect
// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import { CdnLoadingGraphErrorEvent, install, LoadingGraphError } from '../lib'
import { cleanDocument, installPackages$, saveScreen } from './common'
import './mock-requests'

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

test('indirect dependencies not found', async () => {
    try {
        await install(
            {
                modules: ['b'],
            },
            {
                displayLoadingScreen: true,
                onEvent: (event) => {
                    expect(event).toBeInstanceOf(CdnLoadingGraphErrorEvent)
                    const castedEvent = event as CdnLoadingGraphErrorEvent
                    expect(castedEvent.error).toBeInstanceOf(LoadingGraphError)
                    saveScreen('indirect_not_found.html')
                },
            },
        )
    } catch (error) {
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error).toBeInstanceOf(LoadingGraphError)
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error['detail'].errors).toHaveLength(1)
        expect(error['detail'].errors[0].query).toBe('unknown#^1.0.0')
        expect(error['detail'].errors[0].fromPackage.name).toBe('c')
        expect(error['detail'].errors[0].fromPackage.version).toBe('1.0.0')
    }
})

test('packages not found', async () => {
    try {
        await install(
            {
                modules: ['unknown'],
            },
            {
                displayLoadingScreen: true,
                onEvent: () => saveScreen('packages_not_found.html'),
            },
        )
        expect(true).toBeFalsy()
    } catch (error) {
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error).toBeInstanceOf(LoadingGraphError)
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error['detail'].errors[0].query).toBe('unknown#latest')
    }
})

test('cyclic dependencies', async () => {
    try {
        await install(
            {
                modules: ['d'],
            },
            {
                displayLoadingScreen: true,
                onEvent: () => saveScreen('circular_dependencies.html'),
            },
        )
    } catch (error) {
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error).toBeInstanceOf(LoadingGraphError)
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error['detail'].context).toBe('Loading graph resolution stuck')
        // eslint-disable-next-line jest/no-conditional-expect -- more convenient that expect(fct).toThrow
        expect(error['detail'].packages).toEqual({
            'd#1.0.0': [{ name: 'd', version: '^1.0.0' }],
        })
    }
})
