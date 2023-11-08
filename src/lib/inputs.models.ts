import { CdnEvent, CdnFetchEvent } from './events.models'
/**
 * A FileLocationString is a string that specifies location in the files structure of a module using the format:
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
 *     see {@link CssSideEffectCallback}
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
 *     see {@link ScriptSideEffectCallback}
 *
 */
export type ScriptInput =
    | FileLocationString
    | { location: FileLocationString; sideEffects: ScriptSideEffectCallback }

export type InstallStyleSheetsInputs = {
    /**
     * See {@link InstallInputs.css}
     */
    css: CssInput[]

    /**
     * Window global in which css elements are added. If not provided, `window` is used.
     */
    renderingWindow?: Window
}

/**
 * Inputs for the method {@link Client.installLoadingGraph}.
 *
 * <iframe id="iFrameExample" src="" width="100%" height="600px"></iframe>
 * <script>
 *   const src = `<!--<!DOCTYPE html>
 * <html lang="en">
 *   <head><script src="https://webpm.org/^2.1.2/cdn-client.js"></script></head>
 *
 *   <body id="content"></body>
 *
 *   <script type="module">
 *      const cdnClient = window['@youwol/cdn-client']
 *      // get a loading graph, this data could have been saved at some point in time
 *      const loadingGraph = await cdnClient.queryLoadingGraph({
 *          modules:['@youwol/flux-view#^1.1.0', 'rxjs#^7.5.6', 'lodash#*'],
 *      })
 *      // install the loading graph with custom aliases
 *      await cdnClient.installLoadingGraph({
 *          loadingGraph,
 *          aliases: { FV: '@youwol/flux-view' }
 *      })
 *      // To get the correct display of the next view.
 *      await cdnClient.install({css:[
 *          'bootstrap#^5.3.0~bootstrap.min.css',
 *          'fontawesome#5.12.1~css/all.min.css'
 *      ]})
 *      const vDOM = {
 *          class:'fv-text-primary p-2',
 *          children:[
 *              cdnClient.monitoring().view
 *          ]
 *      };
 *      document.getElementById('content').appendChild(FV.render(vDOM));
 *   </script>
 * </html>
 * -->`
 *     const url = '/applications/@youwol/js-playground/latest?content='+encodeURIComponent(src.substring(4,src.length-4))
 *     document.getElementById('iFrameExample').setAttribute("src",url);
 * </script>
 */
export type InstallLoadingGraphInputs = {
    /**
     * Specification of the loading graph, usually retrieved from {@link queryLoadingGraph}.
     */
    loadingGraph: LoadingGraph

    /**
     * See `customInstallers` of {@link InstallInputs}.
     */
    customInstallers?: CustomInstaller[]

    /**
     * See `modulesSideEffects` of {@link InstallInputs}
     */
    modulesSideEffects?: { [key: string]: ModuleSideEffectCallback }

    /**
     * See `executingWindow` from {@link InstallInputs}
     */
    executingWindow?: WindowOrWorkerGlobalScope

    /**
     * See `aliases` from {@link InstallInputs}
     */
    aliases?: {
        [key: string]: string | ((WindowOrWorkerGlobalScope) => unknown)
    }

    /**
     * See `onEvent` from {@link InstallInputs}
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
 *    const src = `<!--<!DOCTYPE html>
 * <html lang="en">
 *   <head><script src="https://webpm.org/^2.1.2/cdn-client.js"></script></head>
 *
 *   <body id="content"></body>
 *
 *   <script type="module">
 *      const cdnClient = window['@youwol/cdn-client']
 *      const {FV, rx, rx6, rx7} = await cdnClient.install({
 *          modules:['@youwol/flux-view#^1.1.0 as FV', 'rxjs#^7.5.6 as rx7', 'lodash#*'],
 *          modulesSideEffects: {
 *              'rxjs#6.x': (d) => console.log("Rxjs 6 installed", d),
 *              'rxjs#7.x': (d) => console.log("Rxjs 7 installed", d),
 *              'rxjs#*': (d) => console.log("A version of Rxjs has been  installed", d)
 *          },
 *          aliases: {
 *              // no API version on value -> implicitly latest installed (^7.5.6)
 *              rx: 'rxjs',
 *              // rxjs#6 is installed as dependency of @youwol/flux-view
 *              rx6: 'rxjs_APIv6'
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
 *          onEvent: (ev) => console.log("CDN event", ev),
 *          displayLoadingScreen: true
 *      })
 *      console.log('🎉 installation done', {FV, rx, rx6, rx7})
 *      const vDOM = {
 *          class:'fv-text-primary p-2',
 *          children:[
 *              cdnClient.monitoring().view
 *          ]
 *      }
 *      document.getElementById('content').appendChild(FV.render(vDOM));
 *  </script>
 * </html>
 * -->`
 *     const url = '/applications/@youwol/js-playground/latest?content='+encodeURIComponent(src.substring(4,src.length-4))
 *     document.getElementById('iFrameExampleModules').setAttribute("src",url);
 * </script>
 *
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
     * Installation of the script elements always happen after all modules have been installed.
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
    executingWindow?: WindowOrWorkerGlobalScope

    /**
     * If provided, any {@link CdnEvent} emitted are forwarded to this callback.
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
}

export type InstallModulesInputs = {
    /**
     * See {@link InstallInputs.modules}
     */
    modules?: LightLibraryQueryString[]

    /**
     * See {@link InstallInputs.modulesSideEffects}
     */
    modulesSideEffects?: { [_key: string]: ModuleSideEffectCallback }

    /**
     * See {@link InstallInputs.usingDependencies}
     */
    usingDependencies?: LightLibraryQueryString[]

    /**
     * See {@link InstallInputs.aliases}
     */
    aliases?: { [key: string]: string | ((Window) => unknown) }

    /**
     * See {@link InstallInputs.executingWindow}
     */
    executingWindow?: WindowOrWorkerGlobalScope

    /**
     * See {@link InstallInputs.onEvent}
     */
    onEvent?: (event: CdnEvent) => void
}

export type InstallScriptsInputs = {
    /**
     * See {@link InstallInputs.scripts}
     */
    scripts: ScriptInput[]
    /**
     * See {@link InstallInputs.executingWindow}
     */
    executingWindow?: WindowOrWorkerGlobalScope
    /**
     * See {@link InstallInputs.onEvent}
     */
    onEvent?: (CdnEvent) => void

    /**
     * See {@link InstallInputs.aliases}
     */
    aliases?: {
        [key: string]: string | ((WindowOrWorkerGlobalScope) => unknown)
    }
}

/**
 * Argument type for {@link ModuleSideEffectCallback}
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
    executingWindow: WindowOrWorkerGlobalScope
}
/**
 * Type definition of a module installation side effects:
 * a callback taking an instance of {@link ModuleSideEffectCallbackArgument} as argument.
 */
export type ModuleSideEffectCallback = (
    argument: ModuleSideEffectCallbackArgument,
) => void | Promise<void>

/**
 * Argument type for {@link CssSideEffectCallback}
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
 * a callback taking an instance of {@link CssSideEffectCallbackArgument} as argument.
 */
export type CssSideEffectCallback = (
    argument: CssSideEffectCallbackArgument,
) => void | Promise<void>

/**
 * Argument type for {@link CssSideEffectCallback}
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
    executingWindow: WindowOrWorkerGlobalScope
}

/**
 * Type definition of a script installation side effects:
 * a callback taking an instance of {@link ScriptSideEffectCallbackArgument} as argument.
 */
export type ScriptSideEffectCallback = (
    argument: ScriptSideEffectCallbackArgument,
) => void | Promise<void>

/**
 * Inputs for the method {@link Client.queryLoadingGraph}.
 *
 * <iframe id="iFrameExampleModules" src="" width="100%" height="600px"></iframe>
 * <script>
 *      const src = `return async ({cdnClient}) => {
 *      const response = await cdnClient.queryLoadingGraph({
 *          modules:['@youwol/flux-view#^1.1.0', 'rxjs#^7.5.6', 'lodash#*'],
 *      })
 *      return {
 *          tag: 'pre',
 *          class:'fv-text-primary',
 *          innerText: JSON.stringify(response, null, 4)
 *      }
 * }
 * `
 *     const url = '/applications/@youwol/js-playground/latest?content='+encodeURIComponent(src)
 *     document.getElementById('iFrameExampleModules').setAttribute("src",url);
 * </script>
 */
export type QueryLoadingGraphInputs = {
    /**
     * See `modules` of {@link InstallInputs}
     */
    modules: LightLibraryQueryString[]

    /**
     * See `usingDependencies` of {@link InstallInputs}
     */
    usingDependencies?: LightLibraryQueryString[]
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

    /**
     * List of aliases
     */
    aliases: string[]
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
 * Output when a script has been fetched, see e.g. {@link Client.fetchScript}.
 */
export type FetchedScript = {
    /**
     * name: module name if the script correspond to a module,
     * can be defined by the user when using {@link Client.fetchScript}.
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
