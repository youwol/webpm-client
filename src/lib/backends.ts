import { BackendConfig, LoadingGraph } from './inputs.models'
import { BackendException, LocalYouwolRequired } from './errors.models'
import { StateImplementation } from './state'
import { Client, install } from './client'
import { setup } from '../auto-generated'
import {
    BackendErrorEvent,
    BackendEvent,
    CdnEvent,
    DownloadBackendEvent,
    InstallBackendEvent,
    StartBackendEvent,
} from './events.models'
import type * as rxjsModuleType from 'rxjs'
import type { LocalYouwol } from '@youwol/http-primitives'
import { getLocalYouwolCookie } from './backend-configuration'
import { type Observable } from 'rxjs'

export type BackendInstallResponse = {
    clientBundle: string
    name: string
    version: string
    exportedClientSymbol: string
}

export type BackendsGraphInstallResponse = {
    backends: BackendInstallResponse[]
}

type Install = {
    http: { WebSocketClient: (d: unknown) => void }
}
export async function installBackendClientDeps(): Promise<Install> {
    const { http } = (await install({
        modules: ['@youwol/http-primitives#^0.2.3 as http'],
    })) as unknown as Install
    return { http }
}

export async function installBackends({
    graph,
    backendsConfig,
    backendsPartitionId,
    onEvent,
    webpmClient,
    executingWindow,
}: {
    graph: LoadingGraph
    backendsConfig: { [k: string]: BackendConfig }
    backendsPartitionId: string
    onEvent: (event: CdnEvent) => void
    webpmClient: Client
    executingWindow: WindowOrWorkerGlobalScope
}) {
    const isEmpty =
        graph.definition.filter((layer) => layer.length > 0).length == 0
    if (isEmpty) {
        return
    }
    const ywLocalCookie = getLocalYouwolCookie()
    if (!ywLocalCookie || ywLocalCookie.type != 'local') {
        throw new LocalYouwolRequired(
            'Backends installation requires the local youwol server',
        )
    }
    const wsUrl = `ws://localhost:${ywLocalCookie.port}/${ywLocalCookie.wsDataUrl}`
    const wsData$ = await StateImplementation.getWebSocket(wsUrl)

    const installId = `${Math.floor(Math.random() * 1e9)}`
    const installKey = `${setup.name}-${setup.version}:installId`
    let error: BackendErrorEvent

    const rxjs: typeof rxjsModuleType = window['rxjs']
    type Message = {
        name: string
        version: string
        event: string
    }

    const all$ = wsData$.pipe(
        rxjs.filter((m) => m.attributes?.[installKey] === installId),
        rxjs.map((m) => m as LocalYouwol.ContextMessage<Message>),
        rxjs.shareReplay({ bufferSize: 1, refCount: true }),
    )
    type EventKind =
        | 'DownloadBackendEvent'
        | 'InstallBackendEvent'
        | 'StartBackendEvent'

    const factory: Record<
        EventKind,
        { constructor: new (m: Message) => BackendEvent; topic: string }
    > = {
        DownloadBackendEvent: {
            constructor: DownloadBackendEvent,
            topic: 'downloading',
        },
        InstallBackendEvent: {
            constructor: InstallBackendEvent,
            topic: 'installing',
        },
        StartBackendEvent: {
            constructor: StartBackendEvent,
            topic: 'starting',
        },
    }

    const isDone = (m: LocalYouwol.ContextMessage<Message>) =>
        (m.labels?.includes('StartBackendEvent') &&
            m.data.event === 'listening') ||
        m.attributes?.event === 'failed'

    const filterEvent = (kind: EventKind) =>
        all$.pipe(
            rxjs.filter((m) => m.labels?.includes(kind)),
            rxjs.tap((m) => {
                if (m.data.event === 'failed') {
                    const event = new BackendErrorEvent({
                        ...m.data,
                        detail: `error while ${factory[kind].topic}`,
                    })
                    error = event
                    onEvent(event)
                }
                if (!error) {
                    onEvent(new factory[kind].constructor(m.data))
                }
            }),
        )

    const download$ = filterEvent('DownloadBackendEvent')
    const install$ = filterEvent('InstallBackendEvent')
    const start$ = filterEvent('StartBackendEvent')

    rxjs.merge(download$, install$, start$)
        .pipe(rxjs.takeWhile((m) => !isDone(m)))
        .subscribe()

    const body = {
        ...graph,
        backendsConfig,
        partitionId: backendsPartitionId,
    }
    return await fetch('/admin/system/backends/install', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-trace-attributes': `{"${installKey}": "${installId}"}`,
        },
        body: JSON.stringify(body),
    })
        .then((resp) => {
            return resp.json()
        })
        .then(async ({ backends }: BackendsGraphInstallResponse) => {
            if (error) {
                console.error(
                    'An error occurred while preparing the backends',
                    error,
                )
                throw new BackendException(error)
            }
            return Promise.all(
                backends.map((backend) => {
                    return new Function(backend.clientBundle)()({
                        window: executingWindow,
                        webpmClient,
                        wsData$,
                    })
                }),
            )
        })
        .then((backends) => {
            StateImplementation.registerImportedModules(
                backends,
                executingWindow,
            )
        })
}

/**
 * Backend client.
 */
export type BackendClient = {
    /**
     * Base URL of the service.
     */
    urlBase: string

    /**
     * Version of the service
     */
    version: string

    /**
     * Configuration.
     */
    config: {
        // Build configuration (command line options).
        build: { [k: string]: string }
    }

    /**
     * The name of the symbol in the global scope pointing to the client.
     */
    exportedSymbol: string

    /**
     * Encapsulating partition Id.
     */
    partitionId: string

    /**
     * Proxy the standard <a target='_blank' href="https://developer.mozilla.org/en-US/docs/Web/API/fetch"> fetch </a>
     * function.
     *
     * @param endPoint Target end-point.
     * @param fetchOptions <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/RequestInit">
     * Fetch options </a>.
     */
    fetch(endPoint: string, fetchOptions: RequestInit): Promise<Response>

    /**
     * Same as `fetch` with an additional call to `.then((resp) => resp.json())`.
     *
     * @param endPoint Target end-point.
     * @param fetchOptions <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/RequestInit">
     * Fetch options </a>.
     */
    fetchJson(endPoint: string, fetchOptions: RequestInit): Promise<JSON>

    /**
     * Same as `fetch` with an additional call to `.then((resp) => resp.text())`.
     *
     * @param endPoint Target end-point.
     * @param fetchOptions <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/RequestInit">
     * Fetch options </a>.
     */
    fetchText(endPoint: string, fetchOptions: RequestInit): Promise<string>

    /**
     * Same as `fetch` but returning an RxJS Observable.
     *
     * @param endPoint Target end-point.
     * @param fetchOptions <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/RequestInit">
     * Fetch options </a>.
     */
    fromFetch(endPoint: string, fetchOptions: RequestInit): Observable<Response>

    /**
     * Same as `fetchJson` but returning an RxJS Observable.
     *
     * @param endPoint Target end-point.
     * @param fetchOptions <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/RequestInit">
     * Fetch options </a>.
     */
    fromFetchJson(endPoint: string, fetchOptions: RequestInit): Observable<JSON>

    /**
     * Same as `fetchText` but returning an RxJS Observable.
     *
     * @param endPoint Target end-point.
     * @param fetchOptions <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/RequestInit">
     * Fetch options </a>.
     */
    fromFetchText(
        endPoint: string,
        fetchOptions: RequestInit,
    ): Observable<string>
}
