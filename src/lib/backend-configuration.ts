/**
 * Defines the target backend used by {@link Client}.
 *
 * Should be constructed using {@link backendConfiguration}.
 */
export interface BackendConfiguration {
    /**
     * Origin of the backend, use empty string for relative resolution
     */
    readonly origin: string
    /**
     * Backend's URL to resolve the loading graph
     */
    readonly urlLoadingGraph: string
    /**
     * Backend's URL used to fetch the raw content of a package
     */
    readonly urlResource: string
    /**
     * Backend's URL to resolve pypi python modules. If not provided, fallback to
     * `https://pypi.org/`.
     */
    readonly urlPypi?: string
    /**
     * Backend's URL to resolve pyodide python modules. If not provided, fallback to
     * `https://cdn.jsdelivr.net/pyodide/v$VERSION/full` where $VERSION is the pyodide target version.
     */
    readonly urlPyodide?: string

    /**
     * id of the configuration
     */
    readonly id?: string
}

function computeOrigin(
    origin:
        | {
              secure?: boolean
              hostname?: string
              port?: number
          }
        | undefined,
) {
    if (origin === undefined) {
        return ''
    }

    const secure = origin.secure ?? 'hostname' in origin

    const hostname = origin.hostname ?? 'localhost'

    const port = origin.port ?? ('hostname' in origin ? '' : 8080)

    return `http${secure ? 's' : ''}://${hostname}${port ? ':' : ''}${port}`
}

export type YwCookie = {
    type: 'local'
    wsDataUrl: string
    port: number
    origin: string
    webpm: {
        pathLoadingGraph: string
        pathResource: string
        pathPyodide: string
        pathPypi: string
    }
}

export function getLocalYouwolCookie(): YwCookie | undefined {
    const name = 'youwol'
    const regex = new RegExp(`(^| )${name}=([^;]+)`)
    const match = document.cookie.match(regex)
    if (match) {
        try {
            const decoded = decodeURIComponent(match[2]).slice(1, -1)
            return JSON.parse(decoded)
        } catch (error) {
            console.error('Can not retrieved local youwol cookie', error)
            return undefined
        }
    }
}
/**
 * Construct a backend configuration.
 *
 * @param pathLoadingGraph path of the end-point to query the loading graph
 * @param pathRawPackage path of the end-point to fetch the bundle of a package
 * @param origin origin of the backend
 * @param id id associated to the configuration
 */
export function backendConfiguration({
    pathLoadingGraph,
    pathResource,
    origin,
    id,
    pathPypi,
    pathPyodide,
}: {
    id?: string
    pathLoadingGraph: string
    pathResource: string
    origin?: { secure?: boolean; hostname?: string; port?: number } | string
    pathPypi?: string
    pathPyodide?: string
}): BackendConfiguration {
    if (typeof origin !== 'string') {
        origin = computeOrigin(origin)
    }
    return {
        id,
        origin,
        urlLoadingGraph: `${origin}${pathLoadingGraph}`,
        urlResource: `${origin}${pathResource}`,
        urlPypi: pathPypi ? `${origin}${pathPypi}` : 'https://pypi.org/',
        urlPyodide: pathPyodide
            ? `${origin}${pathPyodide}/$VERSION`
            : `https://cdn.jsdelivr.net/pyodide/v$VERSION/full`,
    }
}
