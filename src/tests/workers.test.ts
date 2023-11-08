// eslint-disable jest/no-conditional-expect
// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import {
    Client,
    installTestWorkersPoolModule,
    installWorkersPoolModule,
} from '../lib'
import { cleanDocument, installPackages$, testBackendConfig } from './common'
import './mock-requests'
import {
    CdnEventView,
    CdnEventWorker,
    WorkerCard,
    WorkersPool,
    NoContext,
    entryPointWorker,
    MessageExit,
    MessagePostError,
} from '../lib/workers-pool'
import { delay, last, map, mergeMap, takeWhile, tap } from 'rxjs/operators'
import { from, Subject } from 'rxjs'
import { render } from '@youwol/flux-view'
import { StateImplementation } from '../lib/state'
import {
    isInstanceOfWebWorkersJest,
    NotCloneableData,
    WebWorkersJest,
} from '../lib/test-utils'
import * as cdnClient from '..'
jest.setTimeout(20 * 1000)

console['ensureLog'] = console.log
console.log = () => {
    /*no-op*/
}

WorkersPool.webWorkersProxy = new WebWorkersJest({
    globalEntryPoint: entryPointWorker,
    cdnClient,
})

beforeAll((done) => {
    WorkersPool.BackendConfiguration = testBackendConfig
    Client.BackendConfiguration = testBackendConfig
    installPackages$([
        './.packages-test/rxjs#7.5.6/cdn.zip',
        './.packages-test/rxjs#6.5.5/cdn.zip',
        './.packages-test/flux-view#1.1.0/cdn.zip',
        // to fetch the module 'WorkersPool' the current version of cdn is needed
        './.packages-test/cdn-client/cdn.zip',
    ]).subscribe(() => {
        done()
    })
})
beforeEach(() => {
    cleanDocument()
    window['@youwol/webpm-client:worker-install-done'] = false
    StateImplementation.clear()
})

test('installWorkersPoolModule', async () => {
    const workerPoolModule = await installWorkersPoolModule()
    expect(workerPoolModule).toBeTruthy()
    const pool = new workerPoolModule.WorkersPool({})
    expect(pool).toBeTruthy()
})

test('ready', async () => {
    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
        pool: {
            startAt: 1,
        },
    })
    await pool.ready()
    const workers = Object.values(pool.workers$.value)
    expect(workers).toHaveLength(1)

    const messages = workers[0].worker['messages']

    expect(messages.filter((m) => m.type == 'Start')).toHaveLength(1)
    expect(messages.filter((m) => m.type == 'Exit')).toHaveLength(1)
    expect(
        messages.filter((m) => m.type == 'Data' && m.data.type != 'CdnEvent'),
    ).toHaveLength(1)
    const events = messages.filter(
        (m) => m.type == 'Data' && m.data.type == 'CdnEvent',
    )
    // The number of 'SourceLoadingEvents' is not deterministic (depends on progress events emitted).
    expect(events.length).toBeGreaterThan(5)
})

test('ready with variables, function, & postInstall tasks', async () => {
    const cdnEvent$ = new Subject<CdnEventWorker>()
    const events = []
    cdnEvent$.subscribe((d) => {
        events.push(d)
    })
    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
        pool: {
            startAt: 1,
        },
        globals: {
            foo: 42,
            bar: () => 42,
        },
        postInstallTasks: [
            {
                title: 'baz',
                entryPoint: ({ args }: { args: number }) => {
                    return new Promise<void>((resolve) => {
                        window['baz'] = 2 * args
                        resolve()
                    })
                },
                args: 21,
            },
        ],
        cdnEvent$,
    })
    await pool.ready()
    expect(window['foo']).toBe(42)
    expect(window['bar']()).toBe(42)
    expect(window['baz']).toBe(42)
    expect(events.length).toBeGreaterThan(0)
})

function scheduleFunctionSync({ args, workerScope }) {
    if (!workerScope.rxjs) {
        throw Error('rxjs should be here')
    }
    return 2 * args.value
}
function scheduleFunctionAsync({ args, workerScope }) {
    if (!workerScope.rxjs) {
        throw Error('rxjs should be here')
    }
    return new Promise((resolve) => {
        setTimeout(() => resolve(2 * args.value), 1000)
    })
}

test('schedule', (done) => {
    const context = new NoContext()
    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
    })
    const workers = pool.workers$.value
    expect(Object.keys(workers)).toHaveLength(0)

    context.info('Trigger schedule')

    pool.schedule(
        {
            title: 'test',
            entryPoint: scheduleFunctionSync,
            args: { value: 21 },
        },
        context,
    )
        .pipe(
            tap((d) => context.info(`Got message ${d.type} from schedule`)),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            tap((m) => {
                context.info('Ensure expectations')
                const workers = pool.workers$.value
                const busy = pool.busyWorkers$.value
                expect(Object.keys(workers)).toHaveLength(1)
                expect(busy).toHaveLength(0)
                expect(m.data['result']).toBe(42)
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('schedule async with ready', (done) => {
    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
        pool: {
            startAt: 1,
        },
    })
    from(pool.ready())
        .pipe(
            tap(() => {
                const workers = pool.workers$.value
                expect(Object.keys(workers)).toHaveLength(1)
            }),
            mergeMap(() => {
                return pool.schedule({
                    title: 'test',
                    entryPoint: scheduleFunctionAsync,
                    args: { value: 21 },
                })
            }),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            tap((m) => {
                const workers = Object.values(pool.workers$.value)
                const busy = pool.busyWorkers$.value
                expect(workers).toHaveLength(1)
                expect(busy).toHaveLength(0)
                const messages = workers[0].worker['messages']

                expect(messages.filter((m) => m.type == 'Start')).toHaveLength(
                    2,
                )
                expect(messages.filter((m) => m.type == 'Exit')).toHaveLength(2)
                expect(m.data['result']).toBe(42)
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('schedule async with ready on particular worker', (done) => {
    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
        pool: {
            startAt: 1,
        },
    })
    let workerId
    from(pool.ready())
        .pipe(
            tap(() => {
                const workers = Object.values(pool.workers$.value)
                workerId = workers[0].worker.uid
            }),
            mergeMap(() => {
                return pool.schedule({
                    title: 'test',
                    entryPoint: scheduleFunctionAsync,
                    args: { value: 21 },
                    targetWorkerId: workerId,
                })
            }),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            tap((m) => {
                const workers = Object.values(pool.workers$.value)
                expect(workers).toHaveLength(1)
                expect(workers[0].worker.uid).toBe(workerId)
                expect(m.data['result']).toBe(42)
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('schedule with error', (done) => {
    const errorMessage = 'Expected error in test'
    function scheduleFunctionWithError() {
        throw Error(errorMessage)
    }

    const pool = new WorkersPool({
        install: {},
        pool: {
            startAt: 1,
        },
    })
    from(pool.ready())
        .pipe(
            mergeMap(() => {
                return pool.schedule({
                    title: 'test',
                    entryPoint: scheduleFunctionWithError,
                    args: {},
                })
            }),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            map((m) => m.data as unknown as MessageExit),
            tap((m: MessageExit) => {
                expect(m.error).toBeTruthy()
                expect(m.result['stack']).toBeTruthy()
                expect(m.result['message']).toBe(errorMessage)
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('schedule & send message', (done) => {
    const result = 42
    function scheduleFunction({ context }) {
        return new Promise((resolve) => {
            context.onData = async (data: number) => {
                resolve(data)
            }
        })
    }

    const pool = new WorkersPool({
        install: {},
        pool: {
            startAt: 1,
        },
    })
    from(pool.ready())
        .pipe(
            mergeMap(() => {
                return pool.schedule({
                    title: 'test',
                    entryPoint: scheduleFunction,
                    args: {},
                })
            }),
            tap((m) => {
                pool.sendData({ taskId: m.data.taskId, data: result })
            }),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            map((m) => m.data as unknown as MessageExit),
            tap((m: MessageExit) => {
                expect(m.error).toBeFalsy()
                expect(m.result).toBe(result)
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('send not cloneable data', (done) => {
    function scheduleFunction({ args, context }) {
        context.sendData(new NotCloneableData())
        return new Promise((resolve) => {
            resolve(args)
        })
    }

    const pool = new WorkersPool({
        install: {},
        pool: {
            startAt: 1,
        },
    })
    from(pool.ready())
        .pipe(
            mergeMap(() => {
                return pool.schedule({
                    title: 'test',
                    entryPoint: scheduleFunction,
                    args: {},
                })
            }),
            takeWhile((m) => m.type != 'PostError', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            map((m) => m.data as unknown as MessagePostError),
            tap((m: MessagePostError) => {
                expect(m.error.message).toBeTruthy()
                expect(m.error.stack).toBeTruthy()
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('return not cloneable data', (done) => {
    function scheduleFunction() {
        return new Promise((resolve) => {
            resolve(new NotCloneableData())
        })
    }

    const pool = new WorkersPool({
        install: {},
        pool: {
            startAt: 1,
        },
    })
    from(pool.ready())
        .pipe(
            mergeMap(() => {
                return pool.schedule({
                    title: 'test',
                    entryPoint: scheduleFunction,
                    args: {},
                })
            }),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            map((m) => m.data as unknown as MessageExit),
            tap((m: MessageExit) => {
                expect(m.error).toBeTruthy()
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('view', (done) => {
    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
        pool: {
            startAt: 1,
        },
    })
    window.document.body.append(render(pool.view()))
    let workerId
    from(pool.ready())
        .pipe(
            tap(() => {
                const workers = Object.values(pool.workers$.value)
                workerId = workers[0].worker.uid
            }),
            mergeMap(() => {
                return pool.schedule({
                    title: 'test',
                    entryPoint: scheduleFunctionAsync,
                    args: { value: 21 },
                    targetWorkerId: workerId,
                })
            }),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            tap(() => {
                const elems = Array.from(
                    document.querySelectorAll(`.${WorkerCard.Class}`),
                )
                expect(elems).toHaveLength(1)
                const view = elems[0] as unknown as WorkerCard & HTMLDivElement
                expect(view.workerId).toBe(workerId)
                const cdnEvents = Array.from(
                    view.querySelectorAll(`.${CdnEventView.Class}`),
                )
                // rxjs imported + install done
                expect(cdnEvents).toHaveLength(2)
            }),
        )
        .subscribe(() => {
            done()
        })
})

test('before/after install callback', async () => {
    let beforeDone = false
    let afterDone = false
    WorkersPool.webWorkersProxy = new WebWorkersJest({
        globalEntryPoint: entryPointWorker,
        cdnClient,
        onBeforeWorkerInstall: () => (beforeDone = true),
        onAfterWorkerInstall: () => (afterDone = true),
    })

    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
        pool: {
            startAt: 1,
        },
    })
    await pool.ready()
    expect(beforeDone).toBeTruthy()
    expect(afterDone).toBeTruthy()
})

test('installTestWorkersPoolModule', async () => {
    const workerPoolModule = await installTestWorkersPoolModule()
    expect(workerPoolModule).toBeTruthy()
    const pool = new workerPoolModule.WorkersPool({})
    expect(pool).toBeTruthy()
    const proxy = pool.getWebWorkersProxy()
    expect(isInstanceOfWebWorkersJest(proxy)).toBeTruthy()
})
