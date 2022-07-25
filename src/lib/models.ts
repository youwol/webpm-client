/**
 * A ScriptLocationString is a string that specifies location in the files structure of a module using the format:
 * `{moduleName}#{version}~{rest-of-path}`
 *
 * Where:
 * *  `moduleName` is the name of the module containing the script
 * *  `version` is the version of the module
 * *  `rest-of-path` is the path of the script from the root module directory
 *
 * > For the time being, `version` defines a specific fixed version (not a semver query).
 *
 * E.g.: `codemirror#5.52.0~mode/javascript.min.js`
 *
 */
export type FileLocationString = string

/**
 * A LightLibraryQueryString is a string that defines query of a library using format:
 * `{moduleName}#{semver}`
 *
 * Where:
 * *  `moduleName` is the name of the module
 * *  `semver` any valid [semantic versioning specifiers](https://devhints.io/semver), not all
 * strings are however meaningful, **read below**
 *
 * E.g.: `codemirror#^5.52`
 *
 *  > When resolving the library query, there are two cases:
 *  > *  the query defines a fixed version: this particular version will be used
 *  > *  the query defines a range: only the major define in `semver` is relevant, the actual library
 *  > fetched is always the latest of the provided major.
 */
export type LightLibraryQueryString = string

/**
 * A FullLibraryQueryString is a string that defines query of a library using format:
 * `{moduleName}#{semver}`
 *
 * Where:
 * *  `moduleName` is the name of the module
 * *  `semver` any valid [semantic versioning specifiers](https://devhints.io/semver)
 */
export type FullLibraryQueryString = string

/**
 * Deprecated version, use LightModuleQueryString
 *
 * @deprecated
 * @category Deprecated
 */
export interface ModuleQueryDeprecated {
    name: string
    version: string
    sideEffects?: (Window) => void
}

/**
 * Specification of a module.
 */
export type ModuleInput =
    | {
          name: string
          version: string
          sideEffects?: (Window) => void
      }
    | string

/**
 * specification of a CSS resource, either:
 * *  the reference to a location
 * *  an object with
 *     *  'location': reference of the location
 *     *  'sideEffects': the sideEffects to execute after the HTMLLinkElement has been loaded,
 *     see [[CssSideEffectCallback]]
 *
 */
export type CssInput =
    | FileLocationString
    | { location: FileLocationString; sideEffects?: CssSideEffectCallback }

/**
 * specification of a Script resource, either:
 * *  the reference to a location
 * *  an object with
 *     *  'location': reference of the location
 *     *  'sideEffects': the sideEffects to execute after the HTMLScriptElement has been loaded,
 *     see [[ScriptSideEffectCallback]]
 *
 */
export type ScriptInput =
    | FileLocationString
    | { location: FileLocationString; sideEffects: ScriptSideEffectCallback }

/**
 * Inputs for the method [[Client.installStyleSheets]]
 *
 * Resource are like: {libraryName}#{version}~{rest-of-path}
 *
 * @category Client's method inputs
 */
export interface InstallStyleSheetsInputs {
    /**
     * See [[InstallInputs.css]]
     */
    css: CssInput[]

    /**
     * Window global in which css elements are added. If not provided, `window` is used.
     */
    renderingWindow?: Window
}

/**
 * Deprecated, use [[InstallStyleSheetInputs]]
 *
 * @category Client's method inputs
 * @deprecated
 */
export interface InstallStyleSheetInputsDeprecated {
    css: { resource: string }[]
    renderingWindow?: Window
}

/**
 * Inputs for the method [[Client.installLoadingGraph]]
 *
 * @category Client's method inputs
 */
export interface InstallLoadingGraphInputs {
    /**
     * Specification of the loading graph (e.g. retrieved using [[queryLoadingGraph]]).
     */
    loadingGraph: LoadingGraph

    /**
     * See [[InstallInputs.modulesSideEffects]]
     */
    modulesSideEffects?: { [key: string]: ModuleSideEffectCallback }

    /**
     * Window global in which scripts elements are added. If not provided, `window` is used.
     */
    executingWindow?: Window

    /**
     * If provided, any [[CdnFetchEvent]] emitted are forwarded to this callback.
     *
     * @param event event emitted
     */
    onEvent?: (event: CdnFetchEvent) => void
}

/**
 * Inputs for the method [[Client.install]]
 *
 * @category Client's method inputs
 */
export interface InstallInputs {
    /**
     * List of modules to install, see [[LightLibraryQueryString]] for specification.
     *
     * A typical example:
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * await install({
     *     modules: ['rxjs#6.x', 'lodash#*']
     * })
     * ```
     */
    modules?: (LightLibraryQueryString | ModuleQueryDeprecated)[]

    /**
     * Override the 'natural' version used for some libraries coming from the dependency graph when resolving
     * the installation. Items are provided in the form [[LightLibraryQueryString]].
     *
     * Whenever a library is required in the dependency graph, the version(s) will be replaced by the (only) one
     * coming from the relevant element (if any).
     * This in turn disable multiple versions installation for the provided library
     *
     * Here is a fictive example of installing a module `@youwol/flux-view` with 2 versions `0.x` & `1.x`:
     * *  the version `0.x` linked to `rxjs#6.x`
     * *  the version `1.x` linked to `rxjs#7.x`
     *
     * When executed, the snippet override the actual versions resolution of rxjs and always use `rxjs#6.5.5`
     * (which will probably break at installation of `@youwol/flux-view#1.x` as the two versions of RxJS are not
     * compatible).
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * await install({
     *     modules: [`@youwol/flux-view#0.x`, `@youwol/flux-view#1.x`],
     *     usingDependencies: ['rxjs#6.5.5']
     * })
     * ```
     */
    usingDependencies?: LightLibraryQueryString[]

    /**
     * Specify side effects to execute when modules are installed.
     *
     * The key is in the form `{libraryName}#{semver}` (see [[FullLibraryQueryString]]):
     * any module installed matching some keys will trigger execution
     * of associated side effects.
     *
     * Here is a fictive example of installing a module `@youwol/flux-view` with 2 versions `0.x` & `1.x`,
     * the version `0.x` linked to `rxjs#6.x`, and the version `1.x` linked to `rxjs#7.x`
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * await install({
     *     modules: [`@youwol/flux-view#0.x`, `@youwol/flux-view#1.x`],
     *     modulesSideEffects: {
     *         'rxjs#6.x': () => { console.log("Rxjs 6 installed")},
     *         'rxjs#7.x': () => { console.log("Rxjs 7 installed")},
     *         'rxjs#*': () => { console.log("A version of Rxjs has been  installed")}
     *     }
     * })
     * ```
     */
    modulesSideEffects?: {
        [key: string]: ModuleSideEffectCallback
    }

    /**
     * Specify a list of scripts to install, by opposition to module, a script is installed as a standalone element:
     * there are no direct or indirect dependencies' installation triggered.
     *
     * Installation of the script elements always happen after all provided [[InstallInputs.modules]]
     * have been installed.
     *
     * See [[ScriptInput]] for format specification.
     *
     * E.g.:
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * await install({
     *     modules: ['codemirror#5'],
     *     scripts: [
     *         {
     *             location: 'codemirror#5.52.0~mode/javascript.min.js',
     *             sideEffects: ({origin, htmlScriptElement}) => {
     *                 htmlScriptElement.id = origin.name
     *             }
     *         },
     *         'codemirror#5.52.0~addons/lint/lint.js',
     *     ]
     *  })
     *  ```
     */
    scripts?: ScriptInput[]

    /**
     *
     * Specify a list of stylesheets to install.
     *
     * Installation of the stylesheets elements always happen after both [[InstallInputs.modules]], and
     * [[InstallInputs.scripts]] have been installed.
     *
     * See [[CssInput]] for format specification.
     * E.g.:
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * await install({
     *     modules: ['codemirror#5'],
     *     css: [
     *          {
     *          location:'codemirror#5.52.0~codemirror.min.css',
     *          sideEffects: ({origin, htmlLinkElement}) => {
     *              htmlLinkElement.id = `${origin.moduleName}_${origin.version}`
     *          },
     *         'codemirror#5.52.0~theme/blackboard.min.css',
     *         'codemirror#5.52.0~addons/lint/lint.css',
     *     ]
     *  })
     *```
     */
    css?: CssInput[]

    /**
     * Provide aliases to exported symbols name of module.
     *
     * e.g.:
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * const {fluxView} = await install({
     *     modules: ['@youwol/flux-view#0.x'],
     *     aliases: {
     *         fluxView:'@youwol/flux-view'// '@youwol/flux-view' is the actual symbol defined in the library
     *     }
     * })
     * ```
     *
     * In case multiple versions of a lib are installed, it is possible to suffix by the major of the version.
     * > In any case, when a module is installed, two symbols are exported:
     * > *  the original symbol name suffixed by `#{major-version}`: it is immutable and corresponds to the latest
     * > version provided `major-version`
     * > *  the original symbol name: it is mutable and corresponds to the latest version of the module installed
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * let {fluxView0, fluxViewLatest} = await install({
     *     modules: ['@youwol/flux-view#0.x'],
     *     aliases: {
     *         fluxView0:'@youwol/flux-view#0',
     *         fluxViewLatest:'@youwol/flux-view'
     *     }
     * })
     * // fluxView0 === fluxViewLatest
     * let {fluxView1, fluxViewLatest} = await install({
     *     modules: ['@youwol/flux-view#1.x'],
     *     aliases: {
     *         fluxView1:'@youwol/flux-view#1',
     *         fluxViewLatest:'@youwol/flux-view'
     *     }
     * })
     * // fluxView1 !== fluxView0
     * // fluxView1 === fluxViewLatest (the latest version available)
     * ```
     *
     */
    aliases?: { [key: string]: string | ((Window) => unknown) }

    /**
     * Window global in which installation occurs. If not provided, `window` is used.
     */
    executingWindow?: Window

    /**
     * If provided, any [[CdnEvent]] emitted are forwarded to this callback.
     *
     * @param event event emitted
     */
    onEvent?: (event: CdnEvent) => void

    /**
     * If `true`: loading screen is displayed and cover the all screen
     *
     * For a granular control of the loading screen display see [[LoadingScreenView]]
     */
    displayLoadingScreen?: boolean
}

/**
 * Inputs for the method [[Client.fetchScript]]
 *
 * @category Client's method inputs
 */
export interface FetchScriptInputs {
    /**
     * url of the script, see [[getUrlBase]].
     */
    url: string

    /**
     * Preferred displayed name when referencing the script (exposed in [[CdnFetchEvent]])
     */
    name?: string

    /**
     * If provided, any [[CdnFetchEvent]] emitted are forwarded to this callback.
     *
     * @param event event emitted
     */
    onEvent?: (event: CdnFetchEvent) => void

    /**
     * If provided, the callback is called right after the HTMLScriptElement has been installed.
     */
    sideEffects?: ScriptSideEffectCallback
}

/**
 * Inputs for the method [[Client.installModules]]
 *
 * @category Client's method inputs
 */
export interface InstallModulesInputs {
    /**
     * See [[InstallInputs.modules]]
     */
    modules: (LightLibraryQueryString | ModuleQueryDeprecated)[]

    /**
     * See [[InstallInputs.modulesSideEffects]]
     */
    modulesSideEffects?: { [_key: string]: ModuleSideEffectCallback }

    /**
     * See [[InstallInputs.usingDependencies]]
     */
    usingDependencies?: LightLibraryQueryString[]

    /**
     * See [[InstallInputs.executingWindow]]
     */
    executingWindow?: Window

    /**
     * See [[InstallInputs.onEvent]]
     */
    onEvent?: (event: CdnEvent) => void
}

/**
 * Inputs for the method [[Client.installScripts]]
 *
 * @category Client's method inputs
 */
export interface InstallScriptsInputs {
    /**
     * See [[InstallInputs.scripts]]
     */
    scripts: ScriptInput[]
    /**
     * See [[InstallInputs.executingWindow]]
     */
    executingWindow?: Window
    /**
     * See [[InstallInputs.onEvent]]
     */
    onEvent?: (CdnEvent) => void
}

/**
 * Argument type for [[ModuleSideEffectCallback]]
 */
export interface ModuleSideEffectCallbackArgument {
    /**
     * The installed module
     */
    module: any
    /**
     * Origin of the module
     */
    origin: FetchedScript
    /**
     * HTML script element added
     */
    htmlScriptElement: HTMLScriptElement
    /**
     * Window instance in which the HTML script element has been added
     */
    executingWindow: Window
}
/**
 * Type definition of a module installation side effects:
 * a callback taking an instance of [[ModuleSideEffectCallbackArgument]] as argument.
 */
export type ModuleSideEffectCallback = (
    argument: ModuleSideEffectCallbackArgument,
) => void | Promise<void>

/**
 * Argument type for [[CssSideEffectCallback]]
 */
export interface CssSideEffectCallbackArgument {
    /**
     * Origin of the style-sheet
     */
    origin: {
        moduleName: string
        version: string
        assetId: string
        url: string
    }

    /**
     * HTML script element added
     */
    htmlLinkElement: HTMLLinkElement
    /**
     * Window instance in which the HTML link element has been added
     */
    renderingWindow: Window
}

/**
 * Type definition of a css installation side effects:
 * a callback taking an instance of [[CssSideEffectCallbackArgument]] as argument.
 */
export type CssSideEffectCallback = (
    argument: CssSideEffectCallbackArgument,
) => void | Promise<void>

/**
 * Argument type for [[CssSideEffectCallback]]
 */
export interface ScriptSideEffectCallbackArgument {
    /**
     * Origin of the style-sheet
     */
    origin: FetchedScript

    /**
     * HTML script element added
     */
    htmlScriptElement: HTMLScriptElement

    /**
     * Window instance in which the HTML script element has been added
     */
    executingWindow: Window
}

/**
 * Type definition of a script installation side effects:
 * a callback taking an instance of [[ScriptSideEffectCallbackArgument]] as argument.
 */
export type ScriptSideEffectCallback = (
    argument: ScriptSideEffectCallbackArgument,
) => void | Promise<void>

/**
 * Inputs for the method [[Client.queryLoadingGraph]]
 *
 * @category Client's method inputs
 */
export interface QueryLoadingGraphInputs {
    /**
     * See [[InstallInputs.modules]]
     */
    modules: (LightLibraryQueryString | ModuleQueryDeprecated)[]

    /**
     * See [[InstallInputs.usingDependencies]]
     */
    usingDependencies?: LightLibraryQueryString[]
}

/**
 * Base class of Errors.
 *
 * @category Errors
 */
export class CdnError extends Error {}

/**
 * Base class of errors related to loading graph resolution. See also [[CdnLoadingGraphErrorEvent]].
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
 * Error related to 401 response. See also [[UnauthorizedEvent]].
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
 * Error related to 404 response. See also [[UrlNotFoundEvent]].
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
 * Error happening while fetching a source file. See also [[FetchErrorEvent]].
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
 * Error occurring while parsing a source content of a script. See also [[ParseErrorEvent]].
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
 * See also [[CdnLoadingGraphErrorEvent]].
 *
 * @category Errors
 */
export class DependenciesError extends LoadingGraphError {
    static exceptionType = 'DependenciesError'

    constructor(
        public readonly detail: {
            context: string
            errors: { key: string; paths: string[]; detail: string }[]
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
 * See also [[CdnLoadingGraphErrorEvent]].
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

/**
 * Base class of events.
 *
 * @category Events
 */
export class CdnEvent {}

/**
 * A message has been emitted.
 *
 * @category Events
 */
export class CdnMessageEvent extends CdnEvent {
    constructor(public readonly id: string, public readonly text: string) {
        super()
    }
}

/**
 * Base class for CDN's HTTP request event
 *
 * @category Events
 */
export class CdnFetchEvent extends CdnEvent {
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        super()
    }
}

/**
 * Event emitted when an error while fetching a script occurred.
 *
 * @category Events
 */
export class FetchErrorEvent extends CdnFetchEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Event emitted when starting to fetch a script.
 *
 * @category Events
 */
export class StartEvent extends CdnFetchEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Event emitted when a script's content is transferring over HTTP network.
 *
 * @category Events
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
 * Event emitted when a script's content transfer over HTTP network has completed.
 *
 * @category Events
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
 * Event emitted when a script's content has been parsed (installed).
 *
 * @category Events
 */
export class SourceParsedEvent extends CdnFetchEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Event emitted when an [[Unauthorized]] error occurred.
 *
 * @category Events
 */
export class UnauthorizedEvent extends FetchErrorEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Event emitted when an [[UrlNotFound]] error occurred.
 *
 * @category Events
 */
export class UrlNotFoundEvent extends FetchErrorEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Event emitted when an [[SourceParsingFailed]] error occurred.
 *
 * @category Events
 */
export class ParseErrorEvent extends FetchErrorEvent {
    constructor(targetName: string, assetId: string, url: string) {
        super(targetName, assetId, url)
    }
}

/**
 * Event emitted when an [[LoadingGraphError]] error occurred.
 *
 * @category Events
 */
export class CdnLoadingGraphErrorEvent extends CdnEvent {
    constructor(public readonly error: LoadingGraphError) {
        super()
    }
}

/**
 * Event emitted when an installation is done, see [[install]] & [[Client.install]].
 *
 * @category Events
 */
export class InstallDoneEvent extends CdnEvent {
    constructor() {
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
    definition: [string, string][][]

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

/**
 * Output when a script has been fetched, see e.g. [[Client.fetchScript]] & [[fetchScript]]
 */
export interface FetchedScript {
    /**
     * name: module name if the script correspond to a module,
     * can be defined by the user when using [[Client.fetchScript]] & [[fetchScript]]
     */
    name: string

    /**
     * Version of the module used
     */
    version?: string

    /**
     * asset id
     */
    assetId: string

    /**
     * full URL of the script element
     */
    url: string

    /**
     * content of the script element
     */
    content: string

    /**
     * Completed progress event
     */
    progressEvent: ProgressEvent
}
