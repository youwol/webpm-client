import { VirtualDOM, ChildrenLike } from '@youwol/rx-vdom'
import { EventStatus } from '..'
import { filter, map } from 'rxjs/operators'
import {
    CdnEventWorker,
    implementEventWithWorkerTrait,
    WorkersPool,
} from './workers-factory'
import { BehaviorSubject, combineLatest, of } from 'rxjs'

/**
 * @category View
 */
export type EventData = {
    id: string
    text: string
    status: EventStatus
}

/**
 * Presents the data (mostly in terms of observables) to be used by the views.
 *
 * @category View
 */
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

    private add(event: CdnEventWorker) {
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
 * Root component of the {@link WorkersPool} view.
 *
 * @category View
 */
export class WorkersPoolView implements VirtualDOM<'div'> {
    static Class = 'WorkersPoolView'

    /**
     * @group Immutable DOM Constants
     */
    public readonly tag = 'div'
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
    public readonly children: ChildrenLike

    constructor(params: { workersPool: WorkersPool }) {
        this.workersPoolState = new WorkersPoolViewState({
            workersPool: params.workersPool,
        })
        this.children = [
            {
                tag: 'div',
                class: 'w-100 d-flex flex-grow-1 p-2 flex-wrap overflow-auto',
                children: {
                    policy: 'replace',
                    source$: this.workersPoolState.workersPool.startedWorkers$,
                    vdomMap: (workerIds: string[]) => {
                        return [...workerIds].map((workerId) => {
                            return new WorkerCard({
                                workerId,
                                workersPoolState: this.workersPoolState,
                            })
                        })
                    },
                },
            },
        ]
    }
}

/**
 * Component representing a particular worker.
 *
 * @category View
 */
export class WorkerCard implements VirtualDOM<'div'> {
    static Class = 'WorkerCard'
    /**
     * @group Immutable DOM Constants
     */
    public readonly tag = 'div'
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
    public readonly children: ChildrenLike

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
                tag: 'div',
                class: 'p-2',
                children: {
                    policy: 'sync',
                    source$:
                        this.workersPoolState.cdnEvents$[this.workerId] ||
                        of([]),
                    vdomMap: (eventData: EventData) => {
                        return new CdnEventView(eventData)
                    },
                },
            },
        ]
    }
}
/**
 * Component representing a {@link CdnEventWorker}.
 *
 * @category View
 */
export class CdnEventView implements VirtualDOM<'div'> {
    static Class = 'CdnEventView'
    /**
     * @group Immutable DOM Constants
     */
    public readonly tag: 'div'
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = `${CdnEventView.Class} d-flex align-items-center`
    /**
     * @group Immutable DOM Constants
     */
    public readonly children: ChildrenLike

    constructor(event: EventData) {
        const icons: Record<EventStatus, string> = {
            Succeeded: 'fas fa-check fv-text-success',
            Failed: 'fas fa-times fv-text-error',
            Pending: 'fas fa-spinner fa-spin',
            None: '',
        }

        this.children = [
            { tag: 'div', class: icons[event.status] },
            { tag: 'div', class: 'mx-1' },
            { tag: 'div', innerText: event.text },
        ]
    }
}

type WorkerStatus = 'Pending' | 'Created' | 'Busy'
/**
 * Component representing the title of a {@link WorkerCard}.
 *
 * @category View
 */
export class WorkerCardTitleView implements VirtualDOM<'div'> {
    static Class = 'WorkerCardTitleView'
    /**
     * @group Immutable DOM Constants
     */
    public readonly tag = 'div'
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = `${WorkerCardTitleView.Class} d-flex align-items-center`

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: ChildrenLike

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
        const wp = this.workersPoolState.workersPool
        const classes: Record<WorkerStatus, string> = {
            Pending: 'fa-cloud-download-alt',
            Created: '',
            Busy: 'fa-play',
        }
        const statusWorker$ = combineLatest([
            wp.workers$.pipe(map((workers) => Object.keys(workers))),
            wp.busyWorkers$,
        ]).pipe(
            map(([ready, busy]) => {
                return busy.includes(this.workerId)
                    ? 'Busy'
                    : ready.includes(this.workerId)
                      ? 'Created'
                      : 'Pending'
            }),
        )
        this.children = [
            {
                tag: 'h3',
                innerText: `Worker ${this.workerId}`,
            },
            {
                tag: 'div',
                class: {
                    source$: statusWorker$,
                    vdomMap: (status: WorkerStatus): string => classes[status],
                    wrapper: (d) => `fas ${d} fv-text-success fv-blink mx-2`,
                },
            },
        ]
    }
}
