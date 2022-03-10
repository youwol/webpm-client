import {
    CdnEvent,
    CdnFetchEvent,
    errorFactory,
    LoadingGraph,
    SourceLoadedEvent,
    SourceLoadingEvent,
    StartEvent,
    Unauthorized,
    UnauthorizedEvent,
    UrlNotFound,
    UrlNotFoundEvent,
} from './models'
import { CssInput, install, ModulesInput, ScriptsInput } from './loader'

export type Origin = {
    name: string
    version?: string
    assetId: string
    url: string
    content: string
    progressEvent: ProgressEvent
}

export class Client {
    static Headers: { [key: string]: string } = {}
    static HostName = '' // By default, relative resolution is used. Otherwise, protocol + hostname

    static importedBundles = {}
    static fetchedLoadingGraph = new Map<string, Promise<LoadingGraph>>()
    static importedLoadingGraphs = new Map<string, Promise<Window>>()
    static importedScripts = new Map<string, Promise<Origin>>()

    static resetCache() {
        Client.importedBundles = {}
        Client.importedLoadingGraphs = new Map<string, Promise<Window>>()
        Client.importedScripts = new Map<string, Promise<Origin>>()
    }

    async getLoadingGraph(body): Promise<LoadingGraph> {
        const key = JSON.stringify(body)
        const finalize = async () => {
            const content = await Client.fetchedLoadingGraph[key]
            if (content.lock) {
                return content
            }
            throw errorFactory(content)
        }
        if (Client.fetchedLoadingGraph[key]) {
            return finalize()
        }
        const url = `${Client.HostName}/api/assets-gateway/cdn/queries/loading-graph`
        const request = new Request(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { ...Client.Headers, 'content-type': 'application/json' },
        })
        Client.fetchedLoadingGraph[key] = fetch(request).then((resp) =>
            resp.json(),
        )
        return finalize()
    }

    async fetchSource({
        name,
        url,
        onEvent,
    }: {
        url: string
        name?: string
        onEvent?: (event: CdnFetchEvent) => void
    }): Promise<Origin> {
        if (!url.startsWith('/api/assets-gateway/raw/package')) {
            url = url.startsWith('/') ? url : `/${url}`
            url = `/api/assets-gateway/raw/package${url}`
        }

        const parts = url.split('/')
        const assetId = parts[5]
        const version = parts[6]
        name = name || parts[parts.length - 1]

        if (Client.importedScripts[url]) {
            const { progressEvent } = await Client.importedScripts[url]
            onEvent &&
                onEvent(
                    new SourceLoadedEvent(name, assetId, url, progressEvent),
                )
            return Client.importedScripts[url]
        }
        Client.importedScripts[url] = new Promise((resolve, reject) => {
            const req = new XMLHttpRequest()
            // report progress events
            req.addEventListener(
                'progress',
                function (event) {
                    onEvent &&
                        onEvent(
                            new SourceLoadingEvent(name, assetId, url, event),
                        )
                },
                false,
            )

            req.addEventListener(
                'load',
                function (event: ProgressEvent<XMLHttpRequestEventTarget>) {
                    onHttpRequestLoad(
                        req,
                        event,
                        resolve,
                        reject,
                        { url, name, assetId, version },
                        onEvent,
                    )
                },
                false,
            )
            req.open('GET', url)
            req.responseType = 'text' // Client.responseParser ? 'blob' : 'text'
            req.send()
            onEvent && onEvent(new StartEvent(name, assetId, url))
        })
        return Client.importedScripts[url]
    }

    install(
        resources: {
            modules?: ModulesInput
            scripts?: ScriptsInput
            css?: CssInput
            aliases?: { [key: string]: string | ((Window) => unknown) }
        },
        options: {
            executingWindow?: Window
            onEvent?: (event: CdnEvent) => void
            displayLoadingScreen?: boolean
        } = {},
    ): Promise<Window> {
        return install(resources, options)
    }
}

function onHttpRequestLoad(
    req: XMLHttpRequest,
    event: ProgressEvent<XMLHttpRequestEventTarget>,
    resolve,
    reject,
    { url, name, assetId, version },
    onEvent?,
) {
    if (req.status == 200) {
        const content =
            req.responseText +
            `\n//# sourceURL=${url.split('/').slice(0, -1).join('/')}/`

        onEvent && onEvent(new SourceLoadedEvent(name, assetId, url, event))
        resolve({
            name,
            version,
            assetId,
            url,
            content, //content as any,
            progressEvent: event,
        })
    }
    if (req.status == 401) {
        const unauthorized = new UnauthorizedEvent(name, assetId, url)
        onEvent && onEvent(unauthorized)
        reject(new Unauthorized({ assetId, name, url }))
    }
    if (req.status == 404) {
        const urlNotFound = new UrlNotFoundEvent(name, assetId, url)
        onEvent && onEvent(urlNotFound)
        reject(new UrlNotFound({ assetId, name, url }))
    }
}
