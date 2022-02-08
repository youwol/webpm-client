import {
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

export class Client {
    static Headers: { [key: string]: string } = {}
    static HostName = '' // By default, relative resolution is used. Otherwise, protocol + hostname

    static importedBundles = {}

    async getLoadingGraph(body): Promise<LoadingGraph> {
        const url = `${Client.HostName}/api/assets-gateway/cdn/queries/loading-graph`
        const request = new Request(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { ...Client.Headers, 'content-type': 'application/json' },
        })
        const resp = await fetch(request)
        const content = await resp.json()
        if (resp.ok) {
            return content
        }
        throw errorFactory(content)
    }

    async fetchSource({
        name,
        assetId,
        url,
        version,
        onEvent,
    }: {
        name: string
        assetId: string
        url: string
        version?: string
        onEvent?: (event: CdnFetchEvent) => void
    }): Promise<{
        name: string
        version?: string
        assetId: string
        url: string
        content: string
    }> {
        return new Promise((resolve, reject) => {
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
                    if (req.status == 200) {
                        const content =
                            req.responseText +
                            `\n//# sourceURL=${url
                                .split('/')
                                .slice(0, -1)
                                .join('/')}/`

                        onEvent &&
                            onEvent(
                                new SourceLoadedEvent(
                                    name,
                                    assetId,
                                    url,
                                    event,
                                ),
                            )
                        resolve({
                            name,
                            version,
                            assetId,
                            url,
                            content, //content as any,
                        })
                    }
                    if (req.status == 401) {
                        const unauthorized = new UnauthorizedEvent(
                            name,
                            assetId,
                            url,
                        )
                        onEvent && onEvent(unauthorized)
                        reject(new Unauthorized({ assetId, name, url }))
                    }
                    if (req.status == 404) {
                        const urlNotFound = new UrlNotFoundEvent(
                            name,
                            assetId,
                            url,
                        )
                        onEvent && onEvent(urlNotFound)
                        reject(new UrlNotFound({ assetId, name, url }))
                    }
                },
                false,
            )
            req.open('GET', url)
            req.responseType = 'text' // Client.responseParser ? 'blob' : 'text'
            req.send()
            onEvent && onEvent(new StartEvent(name, assetId, url))
        })
    }
}
