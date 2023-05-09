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
 * @category Entry Points
 */
export type InstallStyleSheetsInputs = {
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
 * Inputs for the method [[Client.installLoadingGraph]]
 *
 * @category Entry Points
 */
export type InstallLoadingGraphInputs = {
    /**
     * Specification of the loading graph (e.g. retrieved using [[queryLoadingGraph]]).
     */
    loadingGraph: LoadingGraph

    /**
     * Install resources using 'custom installers'.
     *
     */
    customInstallers?: CustomInstaller[]

    /**
     * See [[InstallInputs.modulesSideEffects]]
     */
    modulesSideEffects?: { [key: string]: ModuleSideEffectCallback }

    /**
     * Window global in which scripts elements are added. If not provided, `window` is used.
     */
    executingWindow?: Window

    /**
     * See [[InstallInputs.aliases]]
     */
    aliases?: { [key: string]: string | ((Window) => unknown) }

    /**
     * If provided, any [[CdnFetchEvent]] emitted are forwarded to this callback.
     *
     * @param event event emitted
     */
    onEvent?: (event: CdnFetchEvent) => void
}

/**
 *
 * A custom installer is a module exporting a function 'async function install(inputs)'.
 *
 */
export type CustomInstaller = {
    /**
     * module name of the custom installer
     */
    module: string

    /**
     * Inputs forwarded to 'async function install(inputs)'.
     */
    installInputs: unknown
}

/**
 * Inputs for the method {@link Client.install}, here is a somewhat complete example:
 *
 * <iframe id="iFrameExampleModules" src="" width="100%" height="600px"></iframe>
 * <script>
 *      const src = `return async ({cdnClient}) => {
 *      const {FV, rx, rx6, rx7} = await cdnClient.install({
 *          modules:['@youwol/flux-view#^1.1.0', 'rxjs#^7.5.6', 'lodash#*'],
 *          modulesSideEffects: {
 *              'rxjs#6.x': (d) => console.log("Rxjs 6 installed", d),
 *              'rxjs#7.x': (d) => console.log("Rxjs 7 installed", d),
 *              'rxjs#*': (d) => console.log("A version of Rxjs has been  installed", d)
 *          },
 *          aliases: {
 *              // no API version -> implicitly latest installed
 *              FV: '@youwol/flux-view',
 *              // no API version -> implicitly latest installed (7.x)
 *              rx: 'rxjs',
 *              rx6: 'rxjs_APIv6',
 *              rx7: 'rxjs_APIv7'
 *          },
 *          scripts: [
 *              'codemirror#5.52.0~addons/lint/lint.js',
 *              {
 *                  location: 'codemirror#5.52.0~mode/python.min.js',
 *                  sideEffects: ({origin, htmlScriptElement}) => {
 *                      console.log("CodeMirror's python mode loaded")
 *                  }
 *              }
 *          ],
 *          css: [
 *              'bootstrap#4.4.1~bootstrap.min.css',
 *              {
 *                  location: 'fontawesome#5.12.1~css/all.min.css',
 *                  sideEffects: (d) => console.log("FontAwesome CSS imported", d)
 *              }
 *          ],
 *          onEvent: (ev) => console.log("CDN event", ev)
 *      })
 *      console.log('🎉 installation done', {FV, rx, rx6, rx7})
 *      return {
 *          class:'fv-text-primary',
 *          children:[
 *              cdnClient.State.view()
 *          ]
 *      }
 * }
 * `
 *     const url = '/applications/@youwol/js-playground/latest?content='+encodeURIComponent(src)
 *     document.getElementById('iFrameExampleModules').setAttribute("src",url);
 * </script>
 *
 * @category Entry Points
 */
export type InstallInputs = {
    /**
     * List of modules to install, see {@link LightLibraryQueryString} for specification.
     *
     */
    modules?: LightLibraryQueryString[]

    /**
     * Override the 'natural' version used for some libraries coming from the dependency graph when resolving
     * the installation. Items are provided in the form {@link LightLibraryQueryString}.
     *
     * Whenever a library is required in the dependency graph, the version(s) will be replaced by the (only) one
     * coming from the relevant element (if any).
     * This in turn disable multiple versions installation for the provided library
     *
     * Here is a fictive example of installing a module `@youwol/fictive-package` with 2 versions `0.x` & `1.x`:
     * *  the version `0.x` linked to `rxjs#6.x`
     * *  the version `1.x` linked to `rxjs#7.x`
     *
     * When executed, the following snippet override the actual versions resolution of rxjs and always use `rxjs#6.5.5`
     * (which will probably break at installation of `@youwol/flux-view#1.x` as the two versions of RxJS are not
     * compatible).
     * ```
     * import {install} from `@youwol/cdn-client`
     *
     * await install({
     *     modules: [`@youwol/fictive-package#0.x`, `@youwol/fictive-package#1.x`],
     *     usingDependencies: ['rxjs#6.5.5']
     * })
     * ```
     */
    usingDependencies?: LightLibraryQueryString[]

    /**
     * Specify side effects to execute when modules are installed.
     *
     * The key is in the form `{libraryName}#{semver}` (see {@link FullLibraryQueryString}):
     * any module installed matching some keys will trigger execution
     * of associated side effects.
     *
     */
    modulesSideEffects?: {
        [key: string]: ModuleSideEffectCallback
    }

    /**
     * Specify a list of scripts to install.
     * By opposition to module, a script is installed as a standalone element:
     * there are no direct or indirect dependencies' installation triggered.
     *
     * Installation of the script elements always happen after all provided {@link InstallInputs.modules}
     * have been installed.
     *
     * See {@link ScriptInput} for format specification.
     *
     */
    scripts?: ScriptInput[]

    /**
     *
     * Specify a list of stylesheets to install.
     *
     * See {@link CssInput} for format specification.
     *
     */
    css?: CssInput[]

    /**
     * Provide aliases to exported symbols name of module.
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
     * For a granular control of the loading screen display see {@link LoadingScreenView}
     */
    displayLoadingScreen?: boolean

    /**
     * Install resources using 'custom installers'.
     *
     */
    customInstallers?: CustomInstaller[]
}

/**
 * Inputs for the method {@link Client.fetchScript}
 *
 * @category Entry Points
 */
export type FetchScriptInputs = {
    /**
     * url of the script, see {@link getUrlBase}.
     */
    url: string

    /**
     * Preferred displayed name when referencing the script (exposed in {@link CdnFetchEvent})
     */
    name?: string

    /**
     * If provided, any {@link CdnFetchEvent} emitted are forwarded to this callback.
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
 * @category Entry Points
 */
export type InstallModulesInputs = {
    /**
     * See [[InstallInputs.modules]]
     */
    modules: LightLibraryQueryString[]

    /**
     * See [[InstallInputs.modulesSideEffects]]
     */
    modulesSideEffects?: { [_key: string]: ModuleSideEffectCallback }

    /**
     * See [[InstallInputs.usingDependencies]]
     */
    usingDependencies?: LightLibraryQueryString[]

    /**
     * See [[InstallInputs.aliases]]
     */
    aliases?: { [key: string]: string | ((Window) => unknown) }

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
 * Inputs for the method [[Client.installPythonModules]]
 *
 * @category Entry Points
 */
export type InstallPythonModulesInputs = {
    /**
     * See [[InstallInputs.modules]]
     */
    pythonModules: LightLibraryQueryString[]

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
 * @category Entry Points
 */
export type InstallScriptsInputs = {
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

    /**
     * See [[InstallInputs.aliases]]
     */
    aliases?: { [key: string]: string | ((Window) => unknown) }
}

/**
 * Argument type for [[ModuleSideEffectCallback]]
 */
export type ModuleSideEffectCallbackArgument = {
    /**
     * The installed module
     */
    module: unknown
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
export type CssSideEffectCallbackArgument = {
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
export type ScriptSideEffectCallbackArgument = {
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
 * @category Entry Points
 */
export type QueryLoadingGraphInputs = {
    /**
     * See [[InstallInputs.modules]]
     */
    modules: LightLibraryQueryString[]

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
 * @category Events
 */
export type EventType =
    | 'CdnMessageEvent'
    | 'StartEvent'
    | 'SourceLoadingEvent'
    | 'SourceLoadedEvent'
    | 'SourceParsedEvent'
    | 'InstallDoneEvent'
    | 'UnauthorizedEvent'
    | 'UrlNotFoundEvent'
    | 'ParseErrorEvent'
    | 'CdnLoadingGraphErrorEvent'

/**
 * @category Events
 */
export type EventStatus = 'Pending' | 'Succeeded' | 'Failed' | 'None'
/**
 * Base class of events.
 *
 * @category Events
 */
export type CdnEvent = {
    step: EventType
    id: string
    text: string
    status: EventStatus
}

/**
 * @category Events
 */
export function isCdnEvent(event: unknown): event is CdnEvent {
    const types: EventType[] = [
        'CdnMessageEvent',
        'StartEvent',
        'SourceLoadingEvent',
        'SourceLoadedEvent',
        'SourceParsedEvent',
        'InstallDoneEvent',
        'UnauthorizedEvent',
        'UrlNotFoundEvent',
        'ParseErrorEvent',
        'CdnLoadingGraphErrorEvent',
    ]
    return types.includes((event as CdnEvent).step)
}

/**
 * Generic custom CDN event.
 *
 * @category Events
 */
export class CdnMessageEvent implements CdnEvent {
    public readonly step = 'CdnMessageEvent'
    constructor(
        public readonly id: string,
        public readonly text: string,
        public readonly status: EventStatus = 'None',
    ) {}
}

/**
 * Base class for CDN's HTTP request event
 *
 * @category Events
 */
export type CdnFetchEvent = CdnEvent & {
    id: string
    assetId: string
    url: string
}

/**
 * Event emitted when starting to fetch a script.
 *
 * @category Events
 */
export class StartEvent implements CdnFetchEvent {
    public readonly step = 'StartEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Pending'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: start importing`
    }
}

/**
 * Event emitted when a script's content is transferring over HTTP network.
 *
 * @category Events
 */
export class SourceLoadingEvent implements CdnFetchEvent {
    public readonly step = 'SourceLoadingEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Pending'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>,
    ) {
        this.id = targetName
        this.text = `${targetName}: fetching over HTTP`
    }
}

/**
 * Event emitted when a script's content transfer over HTTP network has completed.
 *
 * @category Events
 */
export class SourceLoadedEvent implements CdnFetchEvent {
    public readonly step = 'SourceLoadedEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Pending'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
        public readonly progress: ProgressEvent<XMLHttpRequestEventTarget>,
    ) {
        this.id = targetName
        this.text = `${targetName}: source fetched`
    }
}

/**
 * Event emitted when a script's content has been parsed (installed).
 *
 * @category Events
 */
export class SourceParsedEvent implements CdnFetchEvent {
    public readonly step = 'SourceParsedEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Succeeded'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: module/script imported`
    }
}

/**
 * Event emitted when an [[Unauthorized]] error occurred.
 *
 * @category Events
 */
export class UnauthorizedEvent implements CdnFetchEvent {
    public readonly step = 'UnauthorizedEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Failed'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: unauthorized to access the resource`
    }
}

/**
 * Event emitted when an [[UrlNotFound]] error occurred.
 *
 * @category Events
 */
export class UrlNotFoundEvent implements CdnFetchEvent {
    public readonly step = 'UrlNotFoundEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Failed'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: resource not found at ${url}`
    }
}

/**
 * Event emitted when an [[SourceParsingFailed]] error occurred.
 *
 * @category Events
 */
export class ParseErrorEvent implements CdnFetchEvent {
    public readonly step = 'UrlNotFoundEvent'
    public readonly id: string
    public readonly text: string
    public readonly status = 'Failed'
    constructor(
        public readonly targetName: string,
        public readonly assetId: string,
        public readonly url: string,
    ) {
        this.id = targetName
        this.text = `${targetName}: parsing the module/script failed`
    }
}

/**
 * Event emitted when an [[LoadingGraphError]] error occurred.
 *
 * @category Events
 */
export class CdnLoadingGraphErrorEvent implements CdnEvent {
    public readonly id = 'loading-graph'
    public readonly step = 'CdnLoadingGraphErrorEvent'
    public readonly text = 'Failed to retrieve the loading graph'
    public readonly status = 'Failed'
    constructor(public readonly error: LoadingGraphError) {}
}

/**
 * Event emitted when an installation is done, see [[install]] & [[Client.install]].
 *
 * @category Events
 */
export class InstallDoneEvent implements CdnEvent {
    public readonly id = 'InstallDoneEvent'
    public readonly step = 'InstallDoneEvent'
    public readonly text = 'Installation successful'
    public readonly status = 'Succeeded'
}

export type Library = {
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

    /**
     * Name of the exported symbol
     */
    exportedSymbol: string

    /**
     * Uid of the API version
     */
    apiKey: string
}

/**
 * Provides necessary information to correctly install & link a set of resources.
 * It serves a purpose similar to the usual [lockFiles](https://developerexperience.io/articles/lockfile)
 * found in packages managers.
 *
 * Loading graphs can be:
 *  *  retrieved ({@link queryLoadingGraph})
 *  *  used to import runtimes ({@link installLoadingGraph})
 *
 *
 * The structure is defined by the backend service - and mostly an implementation details here for the consumer.
 * It will likely change in future release, but backward compatibility will be preserved.
 *
 */
export type LoadingGraph = {
    /**
     *
     * List of javascript libraries to fetch by batch:
     * -    `definition[i]` defines a batch of libraries that can be fetched in any order (or at the same time), provided
     * that all the libraries for the batches `j<i` have already be fetched
     * -    `definition[i][j]` defines the j'th library for the batch i:
     * a tuple of [`id`, `cdn-url`] where `id` is the asset id and `cdn-url` the associated URL
     */
    definition: [string, string][][]

    /**
     *
     * Describes the libraries included in the loading graph
     */
    lock: Array<Library>

    /**
     * Type of the graph (versioning to be able to change the fetching mechanism)
     */
    graphType: string
}

/**
 * Output when a script has been fetched, see e.g. [[Client.fetchScript]] & [[fetchScript]]
 */
export type FetchedScript = {
    /**
     * name: module name if the script correspond to a module,
     * can be defined by the user when using [[Client.fetchScript]] & [[fetchScript]]
     */
    name: string

    /**
     * Version of the module used
     */
    version: string

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
