import {
    attr$,
    children$,
    VirtualDOM,
    childrenFromStore$,
} from '@youwol/flux-view'
import { CdnEventStatus } from '..'
import { filter } from 'rxjs/operators'
import {
    CdnEventWorker,
    implementEventWithWorkerTrait,
    WorkersPool,
} from './workers-factory'
import { BehaviorSubject, of } from 'rxjs'

type EventData = {
    id: string
    text: string
    status: CdnEventStatus
}

export class WorkersPoolViewState {
    /**
     * @group States
     */
    public readonly workersPool: WorkersPool
    /**
     * @group Observables
     */
    public readonly cdnEvents$: { [k: string]: BehaviorSubject<EventData[]> } =
        {}

    constructor(params: { workersPool: WorkersPool }) {
        Object.assign(this, params)
        this.workersPool.startedWorkers$.subscribe((ids) => {
            ids.forEach((workerId) => {
                if (!this.cdnEvents$[workerId]) {
                    this.cdnEvents$[workerId] = new BehaviorSubject<
                        EventData[]
                    >([])
                }
            })
        })
        this.workersPool.cdnEvent$
            .pipe(filter((event) => implementEventWithWorkerTrait(event)))
            .subscribe((event) => {
                this.add(event)
            })
    }

    add(event: CdnEventWorker) {
        const workerId = event['workerId']
        const elem = {
            id: event.id,
            status: event.status,
            timeStamp: Date.now(),
            text: event.text,
        }
        const values = this.cdnEvents$[workerId].value.filter(
            (d) => d.id != elem.id,
        )
        this.cdnEvents$[workerId].next([...values, elem])
    }
}
/**
 * @category View
 */
export class WorkersPoolView implements VirtualDOM {
    static Class = 'WorkersPoolView'

    /**
     * @group Immutable DOM Constants
     */
    public class = `${WorkersPoolView.Class} w-100 h-100 d-flex flex-column`

    /**
     * @group States
     */
    public readonly workersPoolState: WorkersPoolViewState

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { workersPool: WorkersPool }) {
        this.workersPoolState = new WorkersPoolViewState({
            workersPool: params.workersPool,
        })
        this.children = [
            {
                class: 'w-100 d-flex flex-grow-1 p-2 flex-wrap overflow-auto',
                children: children$(
                    this.workersPoolState.workersPool.startedWorkers$,
                    (workerIds) => {
                        return [...workerIds].map((workerId) => {
                            return new WorkerCard({
                                workerId,
                                workersPoolState: this.workersPoolState,
                            })
                        })
                    },
                ),
            },
        ]
    }
}

/**
 * @category View
 */
export class WorkerCard implements VirtualDOM {
    static Class = 'WorkerCard'

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = `${WorkerCard.Class} p-2 m-2 rounded border`

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
    public readonly workersPoolState: WorkersPoolViewState

    constructor(params: {
        workerId: string
        workersPoolState: WorkersPoolViewState
    }) {
        Object.assign(this, params)
        this.children = [
            new WorkerCardTitleView(params),
            {
                class: 'p-2',
                children: childrenFromStore$(
                    this.workersPoolState.cdnEvents$[this.workerId] || of([]),
                    (eventData: EventData) => {
                        return new CdnEventView(eventData)
                    },
                ),
            },
        ]
    }
}
/**
 * @category View
 */
export class CdnEventView implements VirtualDOM {
    static Class = 'CdnEventView'
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = `${CdnEventView.Class} d-flex align-items-center`
    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(event: EventData) {
        const icons: Record<CdnEventStatus, string> = {
            Succeeded: 'fas fa-check fv-text-success',
            Failed: 'fas fa-times fv-text-error',
            Pending: 'fas fa-spinner fa-spin',
            None: '',
        }

        this.children = [
            { class: icons[event.status] },
            { class: 'mx-1' },
            { innerText: event.text },
        ]
    }
}
/**
 * @category View
 */
export class WorkerCardTitleView implements VirtualDOM {
    static Class = 'WorkerCardTitleView'

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = `${WorkerCardTitleView.Class} d-flex align-items-center`

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
    public readonly workersPoolState: WorkersPoolViewState

    constructor(params: {
        workerId: string
        workersPoolState: WorkersPoolViewState
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
