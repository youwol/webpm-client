import {
    attr$,
    children$,
    VirtualDOM,
    childrenFromStore$,
} from '@youwol/flux-view'
import { CdnEvent } from '..'
import { distinctUntilChanged, map, scan } from 'rxjs/operators'
import { CdnEventWorker, WorkersPool } from './workers-factory'
import { ReplaySubject } from 'rxjs'

function isWorkerEvent(event: CdnEvent): event is CdnEventWorker {
    return event['workerId'] != undefined
}

export class WorkersPoolState {
    /**
     * @group States
     */
    public readonly workersPool: WorkersPool
    /**
     * @group Observables
     */
    public readonly cdnEvents$ = new ReplaySubject<CdnEvent[]>(1)

    constructor(params: { workersPool: WorkersPool }) {
        Object.assign(this, params)
        this.workersPool.cdnEvent$
            .pipe(scan((acc, e) => [...acc, e], []))
            .subscribe((d) => this.cdnEvents$.next(d))
    }
}
/**
 * @category View
 */
export class WorkersPoolView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public class = 'w-100 h-100 d-flex flex-column'

    /**
     * @group States
     */
    public readonly workersPoolState: WorkersPoolState

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { workersPool: WorkersPool }) {
        this.workersPoolState = new WorkersPoolState({
            workersPool: params.workersPool,
        })
        const eqSet = (xs, ys) =>
            xs.size === ys.size && [...xs].every((x) => ys.has(x))

        const workerIds$ = this.workersPoolState.cdnEvents$.pipe(
            map(
                (events) =>
                    new Set(
                        events
                            .filter((event) => isWorkerEvent(event))
                            .map((e: CdnEventWorker) => e.workerId),
                    ),
            ),
            distinctUntilChanged(eqSet),
        )

        this.children = [
            {
                class: 'w-100 d-flex flex-grow-1 p-2 flex-wrap overflow-auto',
                children: children$(workerIds$, (workerIds) => {
                    return [...workerIds].map((workerId) => {
                        return new WorkerCard({
                            workerId,
                            workersPoolState: this.workersPoolState,
                        })
                    })
                }),
            },
        ]
    }
}

/**
 * @category View
 */
export class WorkerCard implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'p-2 m-2 rounded border'

    /**
     * @group Immutable DOM Constants
     */
    public readonly style = {
        height: 'fit-content',
        width: 'fit-content',
    }

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable Constants
     */
    public readonly workerId: string

    /**
     * @group States
     */
    public readonly workersPoolState: WorkersPoolState

    constructor(params: {
        workerId: string
        workersPoolState: WorkersPoolState
    }) {
        Object.assign(this, params)
        this.children = [
            new WorkerCardTitleView(params),
            {
                class: 'p-2',
                children: childrenFromStore$(
                    this.workersPoolState.cdnEvents$.pipe(
                        map((cdnEvents: CdnEvent[]) => {
                            return cdnEvents.filter((event) =>
                                isWorkerEvent(event),
                            )
                        }),
                        map((cdnWorkerEvents: CdnEventWorker[]) => {
                            const filtered = cdnWorkerEvents.filter(
                                (cdnEvent) =>
                                    cdnEvent.workerId == this.workerId,
                            )
                            const ids = new Set(filtered.map((f) => f.id))
                            const reversed = filtered.reverse()
                            return [...ids].map((id) =>
                                reversed.find((event) => event.id == id),
                            )
                        }),
                    ),
                    (cdnEvent: CdnEventWorker) => {
                        return {
                            innerText: cdnEvent.text,
                        }
                    },
                ),
            },
        ]
    }
}

/**
 * @category View
 */
export class WorkerCardTitleView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex align-items-center'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable Constants
     */
    public readonly workerId: string

    /**
     * @group States
     */
    public readonly workersPoolState: WorkersPoolState

    constructor(params: {
        workerId: string
        workersPoolState: WorkersPoolState
    }) {
        Object.assign(this, params)
        this.children = [
            {
                tag: 'h3',
                innerText: `Worker ${this.workerId}`,
            },
            {
                class: attr$(
                    this.workersPoolState.workersPool.busyWorkers$,
                    (busyWorkers) =>
                        busyWorkers.includes(this.workerId)
                            ? 'fas fa-play fv-text-success fv-blink mx-2'
                            : '',
                ),
            },
        ]
    }
}
