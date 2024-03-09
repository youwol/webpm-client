import { LoadingGraph } from './inputs.models'
import { LocalYouwolRequired } from './errors.models'
import { StateImplementation } from './state'
import { Client, install } from './client'

export type BackendInstallResponse = {
    clientBundle: string
    name: string
    version: string
    exportedClientSymbol: string
}

export type BackendsGraphInstallResponse = {
    backends: BackendInstallResponse[]
}

export type YwCookie = {
    type: 'local'
    wsDataUrl: string
    port: number
}

export function getLocalYouwolCookie(): YwCookie | undefined {
    const name = 'youwol'
    const regex = new RegExp(`(^| )${name}=([^;]+)`)
    const match = document.cookie.match(regex)
    if (match) {
        try {
            return JSON.parse(decodeURIComponent(match[2]))
        } catch (error) {
            console.error('Can not retrieved local youwol cookie', error)
            return undefined
        }
    }
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
    webpmClient,
    executingWindow,
}: {
    graph: LoadingGraph
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

    await fetch('/admin/system/backends/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graph),
    })
        .then((resp) => {
            return resp.json()
        })
        .then(async ({ backends }: BackendsGraphInstallResponse) => {
            await Promise.all(
                backends.map(async (backend) => {
                    return new Function(backend.clientBundle)()({
                        window: executingWindow,
                        webpmClient,
                        wsData$,
                    })
                }),
            )
            StateImplementation.registerImportedModules(
                backends,
                executingWindow,
            )
        })
}
