import { getUrlBase, install, State } from '../lib'
import { cleanDocument, expectEvents, installPackages$ } from './common'
import './mock-requests'
import { of, from, ReplaySubject, combineLatest } from 'rxjs'
import { tap, map, mergeMap } from 'rxjs/operators'

// eslint-disable-next-line eslint-comments/disable-enable-pair -- eslint-comment It is required because
/* eslint-disable jest/no-done-callback -- eslint-comment 'done' useful with rxjs  */

beforeAll((done) => {
    installPackages$([
        './.packages-test/rxjs-test#6/cdn.zip',
        './.packages-test/rxjs-test#7/cdn.zip',
        './.packages-test/flux-view-test#0.1.1/cdn.zip',
        './.packages-test/flux-view-test#0.1.2/cdn.zip',
        './.packages-test/flux-view-test#1/cdn.zip',
    ]).subscribe(() => {
        done()
    })
})

beforeEach(() => {
    cleanDocument()
    State.clear()
})

function attr$ToSubject(fv, data, mapper) {
    const subj = new ReplaySubject(1)
    fv.attr$(of(data), (d) => mapper(d)).subscribe((d) => {
        subj.next(d)
    })
    return subj
}

test('install flux-view-test#0', (done) => {
    const events = []
    const packageName = '@youwol/flux-view-test'
    from(
        install({
            modules: [{ name: packageName, version: '0.x' }], // ['@youwol/flux-view-test#0'],
            aliases: {
                rxjs6: 'rxjs-test#6',
                rxjs: 'rxjs-test',
                fv0: '@youwol/flux-view-test#01',
                fv: '@youwol/flux-view-test',
            },
            onEvent: (event) => {
                events.push(event)
            },
        }) as Promise<unknown>,
    )
        .pipe(
            tap(({ rxjs, rxjs6, fv0, fv }) => {
                expect(document.scripts).toHaveLength(2)
                const scriptRxjs6 = document.scripts.item(0)
                expect(scriptRxjs6.id).toBe(
                    getUrlBase('rxjs-test', '6.5.5') + `/dist/rxjs-test.js`,
                )
                const scriptFv0 = document.scripts.item(1)
                expect(scriptFv0.id).toBe(
                    getUrlBase(packageName, '0.1.2') +
                        `/dist/${packageName}.js`,
                )

                expect(rxjs6).toBeTruthy()
                expect(rxjs).toBeTruthy()
                expect(rxjs).toEqual(rxjs6)

                expect(fv0).toBeTruthy()
                expect(fv).toBeTruthy()
                expect(fv).toEqual(fv0)

                expectEvents(events, [packageName, 'rxjs-test'])
            }),
            mergeMap(({ fv }) => {
                return attr$ToSubject(
                    fv,
                    'test-data',
                    (data) => `value is ${data}`,
                )
            }),
            tap((value) => {
                expect(value).toBe('value is test-data')
            }),
        )
        .subscribe(() => done())
})

test('install flux-view-test#1', (done) => {
    const events = []
    const packageName = '@youwol/flux-view-test'
    from(
        install({
            modules: [{ name: packageName, version: '1.x' }],
            aliases: {
                rxjs7: 'rxjs-test#7',
                rxjs: 'rxjs-test',
                fv1: '@youwol/flux-view-test#1',
                fv: '@youwol/flux-view-test',
            },
            onEvent: (event) => {
                events.push(event)
            },
        }) as Promise<unknown>,
    )
        .pipe(
            tap(({ rxjs, rxjs7, fv1, fv }) => {
                expect(document.scripts).toHaveLength(2)
                expect(document.scripts.item(0).id).toBe(
                    getUrlBase('rxjs-test', '7.5.5') + `/dist/rxjs-test.js`,
                )
                expect(document.scripts.item(1).id).toBe(
                    getUrlBase(packageName, '1.0.0') +
                        `/dist/${packageName}.js`,
                )

                expect(rxjs7).toBeTruthy()
                expect(rxjs).toBeTruthy()
                expect(rxjs).toEqual(rxjs7)

                expect(fv1).toBeTruthy()
                expect(fv).toBeTruthy()
                expect(fv).toEqual(fv1)

                expectEvents(events, [packageName, 'rxjs-test'])
            }),
            mergeMap(({ fv }) => {
                return attr$ToSubject(
                    fv,
                    'test-data',
                    (data) => `value is ${data}`,
                )
            }),
            tap((value) => {
                expect(value).toBe('value is test-data')
            }),
        )
        .subscribe(() => done())
})

test('install flux-view-test#0 & flux-view-test#1', (done) => {
    const events = []
    const packageName = '@youwol/flux-view-test'
    from(
        install({
            modules: [`${packageName}#1.x`, `${packageName}#0.x`],
            aliases: {
                rxjs6: 'rxjs-test#6',
                rxjs7: 'rxjs-test#7',
                rxjs: 'rxjs-test',
                fv0: '@youwol/flux-view-test#01',
                fv1: '@youwol/flux-view-test#1',
                fv: '@youwol/flux-view-test',
            },
            modulesSideEffects: {
                'rxjs-test#*': ({ module, origin, htmlScriptElement }) => {
                    module['sideEffects-rxjs-test#*'] = true
                    htmlScriptElement.classList.add(
                        `sideEffects-rxjs-test#*:${origin.name}`,
                    )
                },
                'rxjs-test#6.x': async ({
                    module,
                    origin,
                    htmlScriptElement,
                }) => {
                    module['sideEffects-rxjs-test#6.x'] = true
                    htmlScriptElement.classList.add(
                        `sideEffects-rxjs-test#6.x:${origin.name}`,
                    )
                },
            },
            onEvent: (event) => {
                events.push(event)
            },
        }) as Promise<unknown>,
    )
        .pipe(
            tap(({ rxjs, rxjs6, rxjs7, fv0, fv1, fv }) => {
                expect(document.scripts).toHaveLength(4)
                const scriptRxjs7 = document.scripts.item(0)
                expect(scriptRxjs7.id).toBe(
                    getUrlBase('rxjs-test', '7.5.5') + `/dist/rxjs-test.js`,
                )
                expect(
                    scriptRxjs7.classList.contains(
                        `sideEffects-rxjs-test#*:rxjs-test`,
                    ),
                ).toBeTruthy()
                expect(
                    scriptRxjs7.classList.contains(
                        `sideEffects-rxjs-test#6.x:rxjs-test`,
                    ),
                ).toBeFalsy()

                const scriptRxjs6 = document.scripts.item(1)
                expect(scriptRxjs6.id).toBe(
                    getUrlBase('rxjs-test', '6.5.5') + `/dist/rxjs-test.js`,
                )
                expect(
                    scriptRxjs6.classList.contains(
                        `sideEffects-rxjs-test#*:rxjs-test`,
                    ),
                ).toBeTruthy()
                expect(
                    scriptRxjs6.classList.contains(
                        `sideEffects-rxjs-test#6.x:rxjs-test`,
                    ),
                ).toBeTruthy()

                expect(document.scripts.item(2).id).toBe(
                    getUrlBase(packageName, '1.0.0') +
                        `/dist/${packageName}.js`,
                )
                expect(document.scripts.item(3).id).toBe(
                    getUrlBase(packageName, '0.1.2') +
                        `/dist/${packageName}.js`,
                )

                expect(rxjs7).toBeTruthy()
                expect(rxjs7['sideEffects-rxjs-test#*']).toBeTruthy()
                expect(rxjs7['sideEffects-rxjs-test#6.x']).toBeFalsy()
                expect(rxjs6).toBeTruthy()
                expect(rxjs6['sideEffects-rxjs-test#*']).toBeTruthy()
                expect(rxjs6['sideEffects-rxjs-test#6.x']).toBeTruthy()
                expect(rxjs).toBeTruthy()
                expect(rxjs['sideEffects-rxjs-test#*']).toBeTruthy()

                expect(rxjs).toEqual(rxjs7)
                expect(rxjs6 === rxjs7).toBeFalsy()

                expect(fv1).toBeTruthy()
                expect(fv0).toBeTruthy()
                expect(fv).toBeTruthy()
                expect(fv).toEqual(fv1)

                expect(fv1 === fv0).toBeFalsy()
                expectEvents(events, [
                    packageName,
                    packageName,
                    'rxjs-test',
                    'rxjs-test',
                ])
            }),
            mergeMap(({ fv0, fv1 }) => {
                return combineLatest([
                    attr$ToSubject(
                        fv0,
                        'test-data #0',
                        (data) => `value is ${data}`,
                    ),
                    attr$ToSubject(
                        fv1,
                        'test-data #1',
                        (data) => `value is ${data}`,
                    ),
                ])
            }),
            tap((value) => {
                expect(value).toStrictEqual([
                    'value is test-data #0',
                    'value is test-data #1',
                ])
            }),
        )
        .subscribe(() => done())
})

test('install flux-view-test#1 using rxjs#6.5.5 (failure expected)', (done) => {
    const events = []
    const packageName = '@youwol/flux-view-test'
    from(
        install({
            modules: [{ name: packageName, version: '1.x' }],
            usingDependencies: ['rxjs-test#6.5.5'],
            aliases: {
                fv1: '@youwol/flux-view-test#1',
            },
            onEvent: (event) => {
                events.push(event)
            },
        }) as Promise<unknown>,
    )
        .pipe(
            map(({ fv1 }) => {
                try {
                    fv1.attr$(
                        of('whatever: it should fail'),
                        (d) => d,
                    ).subscribe()
                    return false
                } catch (e) {
                    return e
                }
            }),
            tap((error) => {
                expect(error.message).toBe(
                    "Cannot read properties of undefined (reading 'map')",
                )
            }),
        )
        .subscribe(() => done())
})

test('Sequential installation with version upgrade', (done) => {
    const packageName = '@youwol/flux-view-test'

    from(
        install({
            modules: [{ name: packageName, version: '0.x' }],
            usingDependencies: ['@youwol/flux-view-test#0.1.1'],
            aliases: {
                fv0: '@youwol/flux-view-test#01',
            },
        }) as Promise<unknown>,
    )
        .pipe(
            tap(({ fv0 }) => {
                expect(document.scripts).toHaveLength(2)
                const [rxjsScript, fvScript] = [
                    document.scripts.item(0),
                    document.scripts.item(1),
                ]
                expect(rxjsScript.id).toBe(
                    getUrlBase('rxjs-test', '6.5.5') + `/dist/rxjs-test.js`,
                )
                expect(fvScript.id).toBe(
                    getUrlBase(packageName, '0.1.1') +
                        `/dist/${packageName}.js`,
                )

                expect(fv0).toBeTruthy()
            }),
            mergeMap(() => {
                return from(
                    install({
                        modules: [{ name: packageName, version: '0.x' }],
                        aliases: {
                            fv0: '@youwol/flux-view-test#01',
                        },
                    }) as Promise<unknown>,
                )
            }),
            tap(({ fv0 }) => {
                expect(document.scripts).toHaveLength(3)
                const fvScript = document.scripts.item(2)
                expect(fvScript.id).toBe(
                    getUrlBase(packageName, '0.1.2') +
                        `/dist/${packageName}.js`,
                )
                expect(fv0).toBeTruthy()
                expect(fv0['__yw_set_from_version__']).toBe('0.1.2')
            }),
        )
        .subscribe(() => done())
})

test('Sequential installation with version downgrade', (done) => {
    const packageName = '@youwol/flux-view-test'

    from(
        install({
            modules: [{ name: packageName, version: '0.x' }],
            aliases: {
                fv0: '@youwol/flux-view-test#01',
            },
        }) as Promise<unknown>,
    )
        .pipe(
            tap(({ fv0 }) => {
                expect(document.scripts).toHaveLength(2)
                const [rxjsScript, fvScript] = [
                    document.scripts.item(0),
                    document.scripts.item(1),
                ]
                expect(rxjsScript.id).toBe(
                    getUrlBase('rxjs-test', '6.5.5') + `/dist/rxjs-test.js`,
                )
                expect(fvScript.id).toBe(
                    getUrlBase(packageName, '0.1.2') +
                        `/dist/${packageName}.js`,
                )

                expect(fv0).toBeTruthy()
            }),
            mergeMap(() => {
                return from(
                    install({
                        modules: [{ name: packageName, version: '0.x' }],
                        usingDependencies: ['@youwol/flux-view-test#0.1.1'],
                        aliases: {
                            fv0: '@youwol/flux-view-test#01',
                        },
                    }) as Promise<unknown>,
                )
            }),
            tap(({ fv0 }) => {
                expect(document.scripts).toHaveLength(2)
                const fvScript = document.scripts.item(1)
                expect(fvScript.id).toBe(
                    getUrlBase(packageName, '0.1.2') +
                        `/dist/${packageName}.js`,
                )
                expect(fv0).toBeTruthy()
                expect(fv0['__yw_set_from_version__']).toBe('0.1.2')
            }),
        )
        .subscribe(() => done())
})
