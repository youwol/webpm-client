/**
 * Base class of Errors.
 *
 * @category Errors
 */
export class CdnError extends Error {}

/**
 * Error related to the usage of features requiring the local youwol server while it is not detected.
 *
 * @category Errors
 */
export class LocalYouwolRequired extends CdnError {
    constructor(public readonly detail: string) {
        super()
    }
}

/**
 * Base class of errors related to loading graph resolution. See also {@link CdnLoadingGraphErrorEvent}.
 *
 * @category Errors
 */
export class LoadingGraphError extends CdnError {
    constructor() {
        super('Failed to retrieve the loading graph') // (1)
        this.name = 'LoadingGraphError' // (2)
    }
}

/**
 * Error related to 401 response. See also {@link UnauthorizedEvent}.
 *
 * @category Errors
 */
export class Unauthorized extends CdnError {
    static exceptionType = 'Unauthorized'

    constructor(public readonly detail: { assetId; name; url }) {
        super()
    }

    static isInstance(resp): resp is Unauthorized {
        return resp.exceptionType == Unauthorized.exceptionType
    }
}

/**
 * Error related to 404 response. See also {@link UrlNotFoundEvent}.
 *
 * @category Errors
 */
export class UrlNotFound extends CdnError {
    static exceptionType = 'UrlNotFound'

    constructor(public readonly detail: { assetId; name; url }) {
        super()
    }

    static isInstance(resp): resp is UrlNotFound {
        return resp.exceptionType == UrlNotFound.exceptionType
    }
}

/**
 * Error happening while fetching a source file.
 *
 * @category Errors
 */
export class FetchErrors extends CdnError {
    static exceptionType = 'FetchErrors'

    constructor(public readonly detail: { errors }) {
        super()
    }

    static isInstance(resp): resp is FetchErrors {
        return resp.exceptionType == FetchErrors.exceptionType
    }
}

/**
 * Error occurring while parsing a source content of a script. See also {@link ParseErrorEvent}.
 *
 * @category Errors
 */
export class SourceParsingFailed extends CdnError {
    static exceptionType = 'SourceParsingFailed'

    constructor(public readonly detail: { assetId; name; url; message }) {
        super()
    }

    static isInstance(resp): resp is SourceParsingFailed {
        return resp.exceptionType == SourceParsingFailed.exceptionType
    }
}

/**
 * Error occurred trying to resolve a direct or indirect dependency while resolving a loading graph.
 * See also {@link CdnLoadingGraphErrorEvent}.
 *
 * @category Errors
 */
export class DependenciesError extends LoadingGraphError {
    static exceptionType = 'DependenciesError'

    constructor(
        public readonly detail: {
            context: string
            errors: {
                query: string
                fromPackage: { name: string; version: string }
                detail: string
            }[]
        },
    ) {
        super()
    }

    static isInstance(resp): resp is DependenciesError {
        return resp.exceptionType == DependenciesError.exceptionType
    }
}

/**
 * Dependencies resolution while resolving a loading graph lead to a circular dependency problem.
 * See also {@link CdnLoadingGraphErrorEvent}.
 *
 * @category Errors
 */
export class CircularDependencies extends LoadingGraphError {
    static exceptionType = 'CircularDependencies'

    constructor(
        public readonly detail: {
            context: string
            packages: { [key: string]: { name: string; version: string }[] }
        },
    ) {
        super()
    }

    static isInstance(resp): resp is CircularDependencies {
        return resp.exceptionType == CircularDependencies.exceptionType
    }
}

/**
 * Errors related to backends installation (download, install or start).
 *
 * @category Errors
 */
export class BackendException extends CdnError {
    static exceptionType = 'DownloadBackendFailed'
    public readonly name: string
    public readonly version: string
    public readonly detail: string
    constructor(params: { name: string; version: string; detail: string }) {
        super()
        Object.assign(this, params)
    }
}

/**
 * Errors factory.
 *
 * @category Errors
 */
export function errorFactory(error) {
    if (CircularDependencies.isInstance(error)) {
        return new CircularDependencies(error.detail)
    }
    if (DependenciesError.isInstance(error)) {
        return new DependenciesError(error.detail)
    }
    if (Unauthorized.isInstance(error)) {
        return new Unauthorized(error.detail)
    }
    if (error.exceptionType === 'UpstreamResponseException') {
        return errorFactory(error.detail)
    }
}
