import { getUrlBase, install, SourceParsingFailed } from '../lib'
import { cleanDocument, expectEvents, installPackages$ } from './common'
import './mock-requests'
import {
    of,
    from,
    ReplaySubject,
    combineLatest,
    lastValueFrom,
    firstValueFrom,
} from 'rxjs'
import { tap, mergeMap } from 'rxjs/operators'
import { StateImplementation } from '../lib/state'

beforeAll(async () => {
    await lastValueFrom(
        installPackages$([
            './.packages-test/rxjs#6.5.5/cdn.zip',
            './.packages-test/rxjs#7.5.6/cdn.zip',
            './.packages-test/flux-view#0.1.1/cdn.zip',
            './.packages-test/flux-view#0.1.2/cdn.zip',
            './.packages-test/flux-view#1.1.0/cdn.zip',
        ]),
    )
})

beforeEach(() => {
    cleanDocument()
    StateImplementation.clear()
})

function attr$ToSubject(fv, data, mapper) {
    const subj = new ReplaySubject(1)
    fv.attr$(of(data), (d) => mapper(d)).subscribe((d) => {
        subj.next(d)
    })
    return subj
}

test('install flux-view-test#0', async () => {
    const events = []
    const packageName = '@youwol/flux-view'
    const test$ = from(
        install({
            modules: [`${packageName}#0.x`], // ['@youwol/flux-view-test#0'],
            aliases: {
                rxjs6: 'rxjs_APIv6',
                rxjs: 'rxjs',
                fv0: '@youwol/flux-view_APIv01',
                fv: '@youwol/flux-view',
            },
            onEvent: (event) => {
                events.push(event)
            },
        }) as Promise<unknown>,
    ).pipe(
        tap(({ rxjs, rxjs6, fv0, fv }) => {
            expect(document.scripts).toHaveLength(2)
            const scriptRxjs6 = document.scripts.item(0)
            expect(scriptRxjs6.id).toBe(
                getUrlBase('rxjs', '6.5.5') + `/dist/rxjs.js`,
            )
            const scriptFv0 = document.scripts.item(1)
            expect(scriptFv0.id).toBe(
                getUrlBase(packageName, '0.1.2') + `/dist/${packageName}.js`,
            )

            expect(rxjs6).toBeTruthy()
            expect(rxjs).toBeTruthy()
            expect(rxjs).toEqual(rxjs6)

            expect(fv0).toBeTruthy()
            expect(fv).toBeTruthy()
            expect(fv).toEqual(fv0)

            expectEvents(events, [packageName, 'rxjs'])
        }),
        mergeMap(({ fv }) => {
            return attr$ToSubject(fv, 'test-data', (data) => `value is ${data}`)
        }),
        tap((value) => {
            expect(value).toBe('value is test-data')
        }),
    )
    await firstValueFrom(test$)
})

test('install flux-view#1', async () => {
    const events = []
    const packageName = '@youwol/flux-view'
    const test$ = from(
        install({
            modules: [`${packageName}#1.x`],
            aliases: {
                rxjs7: 'rxjs_APIv7',
                rxjs: 'rxjs',
                fv1: '@youwol/flux-view_APIv1',
                fv: '@youwol/flux-view',
            },
            onEvent: (event) => {
                events.push(event)
            },
        }) as Promise<unknown>,
    ).pipe(
        tap(({ rxjs, rxjs7, fv1, fv }) => {
            expect(document.scripts).toHaveLength(2)
            expect(document.scripts.item(0).id).toBe(
                getUrlBase('rxjs', '7.5.6') + `/dist/rxjs.js`,
            )
            expect(document.scripts.item(1).id).toBe(
                getUrlBase(packageName, '1.1.0') + `/dist/${packageName}.js`,
            )

            expect(rxjs7).toBeTruthy()
            expect(rxjs).toBeTruthy()
            expect(rxjs).toEqual(rxjs7)

            expect(fv1).toBeTruthy()
            expect(fv).toBeTruthy()
            expect(fv).toEqual(fv1)

            expectEvents(events, [packageName, 'rxjs'])
        }),
        mergeMap(({ fv }) => {
            return attr$ToSubject(fv, 'test-data', (data) => `value is ${data}`)
        }),
        tap((value) => {
            expect(value).toBe('value is test-data')
        }),
    )
    await firstValueFrom(test$)
})

test('install flux-view#0 & flux-view#1', async () => {
    const events = []
    const packageName = '@youwol/flux-view'
    const test$ = from(
        install({
            modules: [`${packageName}#1.x`, `${packageName}#0.x`],
            aliases: {
                rxjs6: 'rxjs_APIv6',
                rxjs7: 'rxjs_APIv7',
                rxjs: 'rxjs',
                fv0: '@youwol/flux-view_APIv01',
                fv1: '@youwol/flux-view_APIv1',
                fv: '@youwol/flux-view',
            },
            modulesSideEffects: {
                'rxjs#*': ({ module, origin, htmlScriptElement }) => {
                    module['sideEffects-rxjs#*'] = true
                    htmlScriptElement.classList.add(
                        `sideEffects-rxjs#*:${origin.name}`,
                    )
                },
                'rxjs#6.x': async ({ module, origin, htmlScriptElement }) => {
                    module['sideEffects-rxjs#6.x'] = true
                    htmlScriptElement.classList.add(
                        `sideEffects-rxjs#6.x:${origin.name}`,
                    )
                },
            },
            onEvent: (event) => {
                events.push(event)
            },
        }) as Promise<unknown>,
    ).pipe(
        tap(({ rxjs, rxjs6, rxjs7, fv0, fv1, fv }) => {
            expect(document.scripts).toHaveLength(4)
            const scriptRxjs7 = document.scripts.item(0)
            expect(scriptRxjs7.id).toBe(
                getUrlBase('rxjs', '7.5.6') + `/dist/rxjs.js`,
            )
            expect(
                scriptRxjs7.classList.contains(`sideEffects-rxjs#*:rxjs`),
            ).toBeTruthy()
            expect(
                scriptRxjs7.classList.contains(`sideEffects-rxjs#6.x:rxjs`),
            ).toBeFalsy()

            const scriptRxjs6 = document.scripts.item(1)
            expect(scriptRxjs6.id).toBe(
                getUrlBase('rxjs', '6.5.5') + `/dist/rxjs.js`,
            )
            expect(
                scriptRxjs6.classList.contains(`sideEffects-rxjs#*:rxjs`),
            ).toBeTruthy()
            expect(
                scriptRxjs6.classList.contains(`sideEffects-rxjs#6.x:rxjs`),
            ).toBeTruthy()

            expect(document.scripts.item(2).id).toBe(
                getUrlBase(packageName, '1.1.0') + `/dist/${packageName}.js`,
            )
            expect(document.scripts.item(3).id).toBe(
                getUrlBase(packageName, '0.1.2') + `/dist/${packageName}.js`,
            )

            expect(rxjs7).toBeTruthy()
            expect(rxjs7['sideEffects-rxjs#*']).toBeTruthy()
            expect(rxjs7['sideEffects-rxjs#6.x']).toBeFalsy()
            expect(rxjs6).toBeTruthy()
            expect(rxjs6['sideEffects-rxjs#*']).toBeTruthy()
            expect(rxjs6['sideEffects-rxjs#6.x']).toBeTruthy()
            expect(rxjs).toBeTruthy()
            expect(rxjs['sideEffects-rxjs#*']).toBeTruthy()

            expect(rxjs).toEqual(rxjs7)
            expect(rxjs6 === rxjs7).toBeFalsy()

            expect(fv1).toBeTruthy()
            expect(fv0).toBeTruthy()
            expect(fv).toBeTruthy()
            expect(fv).toEqual(fv1)

            expect(fv1 === fv0).toBeFalsy()
            expectEvents(events, [packageName, packageName, 'rxjs', 'rxjs'])
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
    await firstValueFrom(test$)
})

test('install flux-view#1 using rxjs#6.5.5 (failure expected)', async () => {
    const events = []
    const packageName = '@youwol/flux-view'
    const expectToThrow = async () => {
        await install({
            modules: [`${packageName}#1.x`],
            usingDependencies: ['rxjs#6.5.5'],
            aliases: {
                fv1: '@youwol/flux-view_APIv1',
            },
            onEvent: (event) => {
                events.push(event)
            },
        })
    }
    await expect(expectToThrow).rejects.toThrow(SourceParsingFailed)
    // from(
    //     install({
    //         modules: [`${packageName}#1.x`],
    //         usingDependencies: ['rxjs#6.5.5'],
    //         aliases: {
    //             fv1: '@youwol/flux-view_APIv1',
    //         },
    //         onEvent: (event) => {
    //             events.push(event)
    //         },
    //     }) as Promise<unknown>,
    // )
    //     .pipe(
    //         map(({ fv1 }) => {
    //             try {
    //                 fv1.attr$(
    //                     of('whatever: it should fail'),
    //                     (d) => d,
    //                 ).subscribe()
    //                 return false
    //             } catch (e) {
    //                 return e
    //             }
    //         }),
    //         tap((error) => {
    //             expect(error).toBeTruthy()
    //         }),
    //     )
    //     .subscribe(() => done())
    // done()
})

test('Sequential installation with version upgrade', async () => {
    const packageName = '@youwol/flux-view'

    const test$ = from(
        install({
            modules: [`${packageName}#0.x`],
            usingDependencies: ['@youwol/flux-view#0.1.1'],
            aliases: {
                fv0: '@youwol/flux-view_APIv01',
            },
        }) as Promise<unknown>,
    ).pipe(
        tap(({ fv0 }) => {
            expect(document.scripts).toHaveLength(2)
            const [rxjsScript, fvScript] = [
                document.scripts.item(0),
                document.scripts.item(1),
            ]
            expect(rxjsScript.id).toBe(
                getUrlBase('rxjs', '6.5.5') + `/dist/rxjs.js`,
            )
            expect(fvScript.id).toBe(
                getUrlBase(packageName, '0.1.1') + `/dist/${packageName}.js`,
            )

            expect(fv0).toBeTruthy()
        }),
        mergeMap(() => {
            return from(
                install({
                    modules: [`${packageName}#0.x`],
                    aliases: {
                        fv0: '@youwol/flux-view#01',
                    },
                }) as Promise<unknown>,
            )
        }),
        tap(({ fv0 }) => {
            expect(document.scripts).toHaveLength(3)
            const fvScript = document.scripts.item(2)
            expect(fvScript.id).toBe(
                getUrlBase(packageName, '0.1.2') + `/dist/${packageName}.js`,
            )
            expect(fv0).toBeTruthy()
            expect(fv0['__yw_set_from_version__']).toBe('0.1.2')
        }),
    )
    await firstValueFrom(test$)
})

test('Sequential installation with version downgrade', async () => {
    const packageName = '@youwol/flux-view'

    const test$ = from(
        install({
            modules: [`${packageName}#0.x`],
            aliases: {
                fv0: '@youwol/flux-view_APIv01',
            },
        }) as Promise<unknown>,
    ).pipe(
        tap(({ fv0 }) => {
            expect(document.scripts).toHaveLength(2)
            const [rxjsScript, fvScript] = [
                document.scripts.item(0),
                document.scripts.item(1),
            ]
            expect(rxjsScript.id).toBe(
                getUrlBase('rxjs', '6.5.5') + `/dist/rxjs.js`,
            )
            expect(fvScript.id).toBe(
                getUrlBase(packageName, '0.1.2') + `/dist/${packageName}.js`,
            )

            expect(fv0).toBeTruthy()
        }),
        mergeMap(() => {
            return from(
                install({
                    modules: [`${packageName}#0.x`],
                    usingDependencies: ['@youwol/flux-view#0.1.1'],
                    aliases: {
                        fv0: '@youwol/flux-view#01',
                    },
                }) as Promise<unknown>,
            )
        }),
        tap(({ fv0 }) => {
            expect(document.scripts).toHaveLength(2)
            const fvScript = document.scripts.item(1)
            expect(fvScript.id).toBe(
                getUrlBase(packageName, '0.1.2') + `/dist/${packageName}.js`,
            )
            expect(fv0).toBeTruthy()
            expect(fv0['__yw_set_from_version__']).toBe('0.1.2')
        }),
    )
    await firstValueFrom(test$)
})
