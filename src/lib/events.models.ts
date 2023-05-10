/**
 * @category Events
 */
import { LoadingGraphError } from './errors.models'

export type EventType =
    | 'CdnMessageEvent'
    | 'StartEvent'
    | 'SourceLoadingEvent'
    | 'SourceLoadedEvent'
    | 'SourceParsedEvent'
    | 'InstallDoneEvent'
    | 'UnauthorizedEvent'
    | 'UrlNotFoundEvent'
    | 'ParseErrorEvent'
    | 'CdnLoadingGraphErrorEvent'

/**
 * @category Events
 */
export type EventStatus = 'Pending' | 'Succeeded' | 'Failed' | 'None'
/**
 * Base class of events.
 *
 * @category Events
 */
export type CdnEvent = {
    step: EventType
    id: string
    text: string
    status: EventStatus
}

/**
 * @category Events
 */
export function isCdnEvent(event: unknown): event is CdnEvent {
    const types: EventType[] = [
        'CdnMessageEvent',
        'StartEvent',
        'SourceLoadingEvent',
        'SourceLoadedEvent',
        'SourceParsedEvent',
        'InstallDoneEvent',
        'UnauthorizedEvent',
        'UrlNotFoundEvent',
        'ParseErrorEvent',
        'CdnLoadingGraphErrorEvent',
    ]
    return types.includes((event as CdnEvent).step)
}

/**
 * Generic custom CDN event.
 *
 * @category Events
 */
export class CdnMessageEvent implements CdnEvent {
    public readonly step = 'CdnMessageEvent'
    constructor(
        public readonly id: string,
        public readonly text: string,
        public readonly status: EventStatus = 'None',
    ) {}
}

/**
 * Base class for CDN's HTTP request event
 *
 * @category Events
 */
export type CdnFetchEvent = CdnEvent & {
    id: string
    assetId: string
    url: string
}

/**
 * Event emitted when starting to fetch a script.
 *
 * @category Events
 */
export class StartEvent implements CdnFetchEvent {
    public readonly step = 'StartEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Pending'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: start importing`
    }
}

/**
 * Event emitted when a script's content is transferring over HTTP network.
 *
 * @category Events
 */
export class SourceLoadingEvent implements CdnFetchEvent {
    public readonly step = 'SourceLoadingEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Pending'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>,
    ) {
        this.id = targetName
        this.text = `${targetName}: fetching over HTTP`
    }
}

/**
 * Event emitted when a script's content transfer over HTTP network has completed.
 *
 * @category Events
 */
export class SourceLoadedEvent implements CdnFetchEvent {
    public readonly step = 'SourceLoadedEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Pending'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>,
    ) {
        this.id = targetName
        this.text = `${targetName}: source fetched`
    }
}

/**
 * Event emitted when a script's content has been parsed (installed).
 *
 * @category Events
 */
export class SourceParsedEvent implements CdnFetchEvent {
    public readonly step = 'SourceParsedEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Succeeded'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: module/script imported`
    }
}

/**
 * Event emitted when an {@link Unauthorized} error occurred.
 *
 * @category Events
 */
export class UnauthorizedEvent implements CdnFetchEvent {
    public readonly step = 'UnauthorizedEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Failed'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: unauthorized to access the resource`
    }
}

/**
 * Event emitted when an {@link UrlNotFound} error occurred.
 *
 * @category Events
 */
export class UrlNotFoundEvent implements CdnFetchEvent {
    public readonly step = 'UrlNotFoundEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Failed'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: resource not found at ${url}`
    }
}

/**
 * Event emitted when an {@link SourceParsingFailed} error occurred.
 *
 * @category Events
 */
export class ParseErrorEvent implements CdnFetchEvent {
    public readonly step = 'ParseErrorEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Failed'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: parsing the module/script failed`
    }
}

/**
 * Event emitted when an {@link LoadingGraphError} error occurred.
 *
 * @category Events
 */
export class CdnLoadingGraphErrorEvent implements CdnEvent {
    public readonly id = 'loading-graph'
    public readonly step = 'CdnLoadingGraphErrorEvent'
    public readonly text = 'Failed to retrieve the loading graph'
    public readonly status = 'Failed'
    constructor(public readonly error: LoadingGraphError) {}
}

/**
 * Event emitted when an installation is done ({@link install}, {@link Client.install}).
 *
 * @category Events
 */
export class InstallDoneEvent implements CdnEvent {
    public readonly id = 'InstallDoneEvent'
    public readonly step = 'InstallDoneEvent'
    public readonly text = 'Installation successful'
    public readonly status = 'Succeeded'
}
