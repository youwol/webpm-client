export interface BackendConfiguration {
    readonly origin: string
    readonly urlLoadingGraph: string
    readonly urlRawPackage: string
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

export function backendConfiguration({
    pathLoadingGraph,
    pathRawPackage,
    origin,
}: {
    pathLoadingGraph: string
    pathRawPackage: string
    origin?: { secure?: boolean; hostname?: string; port?: number } | string
}): BackendConfiguration {
    if (typeof origin !== 'string') {
        origin = computeOrigin(origin)
    }
    return {
        origin,
        urlLoadingGraph: `${origin}${pathLoadingGraph}`,
        urlRawPackage: `${origin}${pathRawPackage}`,
    }
}
