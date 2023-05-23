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
    readonly urlRawPackage: string
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
    pathRawPackage,
    origin,
    id,
}: {
    id?: string
    pathLoadingGraph: string
    pathRawPackage: string
    origin?: { secure?: boolean; hostname?: string; port?: number } | string
}): BackendConfiguration {
    if (typeof origin !== 'string') {
        origin = computeOrigin(origin)
    }
    return {
        id,
        origin,
        urlLoadingGraph: `${origin}${pathLoadingGraph}`,
        urlRawPackage: `${origin}${pathRawPackage}`,
    }
}
