export class CdnError extends Error {}

export class LoadingGraphError extends CdnError {
    constructor() {
        super('Failed to retrieve the loading graph') // (1)
        this.name = 'LoadingGraphError' // (2)
    }
}

export class PackagesNotFound extends LoadingGraphError {
    static exceptionType = 'PackagesNotFound'

    constructor(
        public readonly detail: { context: string; packages: string[] },
    ) {
        super()
    }

    static isInstance(resp): resp is PackagesNotFound {
        return resp.exceptionType == PackagesNotFound.exceptionType
    }
}

export class IndirectPackagesNotFound extends LoadingGraphError {
    static exceptionType = 'IndirectPackagesNotFound'

    constructor(
        public readonly detail: {
            context: string
            paths: { [_key: string]: string[] }
        },
    ) {
        super()
    }

    static isInstance(resp): resp is IndirectPackagesNotFound {
        return resp.exceptionType == IndirectPackagesNotFound.exceptionType
    }
}

export class CircularDependencies extends LoadingGraphError {
    static exceptionType = 'CircularDependencies'

    constructor(
        public readonly detail: {
            context: string
            packages: { [key: string]: string[] }
        },
    ) {
        super()
    }

    static isInstance(resp): resp is CircularDependencies {
        return resp.exceptionType == CircularDependencies.exceptionType
    }
}

export function loadingGraphErrorFactory(error) {
    if (PackagesNotFound.isInstance(error)) {
        return new PackagesNotFound(error.detail)
    }
    if (CircularDependencies.isInstance(error)) {
        return new CircularDependencies(error.detail)
    }
    if (IndirectPackagesNotFound.isInstance(error)) {
        return new IndirectPackagesNotFound(error.detail)
    }
}

export class CdnEvent {}

/**
 * Base class for CDN's HTTP request event
 */
export class CdnFetchEvent {
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {}
}

/**
 * Request just sent
 */
export class StartEvent extends CdnFetchEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Request loading content
 */
export class SourceLoadingEvent extends CdnFetchEvent {
    constructor(
        targetName: string,
        assetId: string,
        url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>,
    ) {
        super(targetName, assetId, url)
    }
}

/**
 * Request's content loaded
 */
export class SourceLoadedEvent extends CdnFetchEvent {
    constructor(
        targetName: string,
        assetId: string,
        url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>,
    ) {
        super(targetName, assetId, url)
    }
}

/**
 * Request's content parsed
 */
export class SourceParsedEvent extends CdnFetchEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

export class ErrorEvent extends CdnFetchEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Unauthorized to fetch resource
 */
export class UnauthorizedEvent extends ErrorEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

export class CdnLoadingGraphErrorEvent extends CdnEvent {
    constructor(public readonly error: LoadingGraphError) {
        super()
    }
}

export interface Library {
    /**
     * id of the library in the asset store
     */
    id: string

    /**
     * name of the library, e.g. @youwol/cdn-client
     */
    name: string

    /**
     * Version of the library, e.g. 0.0.0
     */
    version: string

    /**
     * Type of the library, e.g. '*library*, *flux-pack*
     */
    type: string
}

/**
 * Define a structure that allows to resolve dependencies fetching in the correct order.
 * This structure is defined by the CDN service, it is associated to *graphType=='sequential-v1'*.
 *
 * See also:
 * -    [[getLoadingGraph]]: return the loading graph from a list of package's name and version.
 * -    [[fetchBundles]]: directly fetch dependenceis from a list of package's name and version
 */
export interface LoadingGraph {
    /**
     *
     * List of javascript libraries to fetch by batch:
     * -    *definition[i]* defines a batch of libraries that can be fetched in any order (or at the same time), provided
     * that all the libraries for the batches j<i have already be fetched
     * -    *definition[i][j]* defines the j'th library for the batch i:
     * a tuple of [*id*, *cdn-url*] where *id* is the asset id and *cdn-url* the CDN's URL
     */
    definition: Array<Array<[string, string]>>

    /**
     *
     * Describes the libraries included in the loading graph
     */
    lock: Array<Library>

    /**
     * Type of the graph (versioning to be able to change the fetching mecanism)
     */
    graphType: string
}
