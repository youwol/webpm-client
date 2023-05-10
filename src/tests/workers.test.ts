// eslint-disable jest/no-conditional-expect
// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import { installWorkersPoolModule } from '../lib'
import { cleanDocument, installPackages$ } from './common'
import './mock-requests'
import {
    CdnEventView,
    CdnEventWorker,
    entryPointWorker,
    WorkerCard,
    WorkersPool,
    IWWorkerProxy,
    WWorkerTrait,
} from '../lib/workers-pool'
import { delay, last, mergeMap, takeWhile, tap } from 'rxjs/operators'
import { from, Subject } from 'rxjs'
import * as cdnClient from '../../src/lib'
import { render } from '@youwol/flux-view'
import { StateImplementation } from '../lib/state'
jest.setTimeout(20 * 1000)

console['ensureLog'] = console.log
console.log = () => {
    /*no-op*/
}

class WebWorkerJest implements WWorkerTrait {
    public readonly uid: string
    public readonly messages = []
    onMessageWorker: (message) => unknown
    onMessageMain: (message) => unknown

    constructor(params: {
        uid: string
        onMessageWorker: (message) => unknown
        onMessageMain: (message) => unknown
    }) {
        Object.assign(this, params)
    }

    execute({ taskId, entryPoint, args }: { taskId; entryPoint; args }) {
        const message = {
            type: 'Execute',
            data: {
                taskId,
                workerId: this.uid,
                args,
                entryPoint,
            },
        }
        setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- testing workaround
            // @ts-ignore
            entryPointWorker({ data: message })
        }, 0)
    }

    sendBackToMain(message) {
        this.messages.push(message)
        this.onMessageMain({ data: message })
    }
    terminate() {
        /*no op*/
    }
}

class WebWorkersJest implements IWWorkerProxy {
    static workers = {}

    constructor() {
        globalThis['importScripts'] = () => {
            // this is only called when 'installing' cdnClient in worker
            window['@youwol/cdn-client'] = cdnClient
        }

        globalThis['postMessage'] = (message) => {
            //setTimeout because in worker 'postMessage' let the eventLoop to process the next task
            setTimeout(() => {
                const workerId = message.data.workerId
                const worker = WebWorkersJest.workers[workerId]
                worker.sendBackToMain(message)
            }, 0)
        }
    }
    createWorker({
        onMessageWorker,
        onMessageMain,
    }: {
        onMessageWorker: (message) => unknown
        onMessageMain: (message) => unknown
    }) {
        const worker = new WebWorkerJest({
            uid: `w${Math.floor(Math.random() * 1e6)}`,
            onMessageWorker,
            onMessageMain,
        })
        WebWorkersJest.workers[worker.uid] = worker
        return worker
    }
}

WorkersPool.webWorkersProxy = new WebWorkersJest()

beforeAll((done) => {
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
    window['@youwol/cdn-client'] = undefined
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

// function scheduleFunctionSync({ args, workerScope }) {
//     if (!workerScope.rxjs) {
//         throw Error('rxjs should be here')
//     }
//     return 2 * args.value
// }
function scheduleFunctionAsync({ args, workerScope }) {
    if (!workerScope.rxjs) {
        throw Error('rxjs should be here')
    }
    return new Promise((resolve) => {
        setTimeout(() => resolve(2 * args.value), 1000)
    })
}

test('schedule', (done) => {
    console['ensureLog']('Start test schedule')
    const pool = new WorkersPool({
        install: {
            modules: ['rxjs#^6.5.5'],
        },
    })
    const workers = pool.workers$.value
    expect(Object.keys(workers)).toHaveLength(0)

    console['ensureLog']('Trigger schedule')
    pool.schedule({
        title: 'test',
        entryPoint: scheduleFunctionAsync,
        args: { value: 21 },
    })
        .pipe(
            tap((d) => console['ensureLog']('Got message from schedule', d)),
            takeWhile((m) => m.type != 'Exit', true),
            last(),
            // let the time to subscription (busy$ in particular) to be handled
            delay(1),
            tap((m) => {
                console['ensureLog']('Ensure expectations')
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
