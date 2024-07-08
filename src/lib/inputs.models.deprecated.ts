import { CdnEvent } from './events.models'
import {
    BackendInputs,
    CssInput,
    InstallInputs,
    LightLibraryQueryString,
    LightLibraryWithAliasQueryString,
    ModuleSideEffectCallback,
    PyModule,
    PyodideInputs,
    ScriptInput,
} from './inputs.models'

/**
 * Deprecated.
 */
export type CustomInstaller = {
    /**
     * module name of the custom installer
     */
    module: string

    /**
     * Inputs forwarded to 'async function install(inputs)'.
     */
    installInputs: { [k: string]: unknown } & {
        onEvent?: (cdnEvent: CdnEvent) => void
    }
}

/**
 * Deprectated. See {@link InstallInputs}
 */
export type InstallInputsDeprecated = {
    /**
     * List of modules to install, see {@link LightLibraryWithAliasQueryString} for specification.
     *
     */
    modules?: LightLibraryWithAliasQueryString[]

    /**
     * List of backends to install, see {@link LightLibraryWithAliasQueryString} for specification.
     *
     */
    backends?: LightLibraryWithAliasQueryString[] | BackendInputs

    /**
     * Specification of pyodide installer, see {@link PyodideInstaller} for specification.
     */
    pyodide?: PyodideInputs

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
     * import {install} from `@youwol/webpm-client`
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

export function isDeprecatedInputs(
    inputs: InstallInputs | InstallInputsDeprecated,
): inputs is InstallInputsDeprecated {
    const newInputs = inputs as InstallInputs
    if (newInputs.esm || newInputs.pyodide || newInputs.backends) {
        return false
    }
    return true
}

export function upgradeInstallInputs(
    deprecated: InstallInputsDeprecated,
): InstallInputs {
    let pyodide = deprecated.pyodide
    if (!pyodide && deprecated.customInstallers?.length == 1) {
        pyodide = {
            modules: deprecated.customInstallers[0].installInputs
                .modules as PyModule[],
            pyodideAlias: deprecated.customInstallers[0].installInputs
                .exportedPyodideInstanceName as string,
        }
    }

    return {
        esm: {
            modules: deprecated.modules || [],
            scripts: deprecated.scripts || [],
            usingDependencies: deprecated.usingDependencies || [],
            modulesSideEffects: deprecated.modulesSideEffects || {},
            aliases: deprecated.aliases || {},
        },
        backends: deprecated.backends || [],
        pyodide,
        css: deprecated.css || [],
        executingWindow: deprecated.executingWindow,
        onEvent: deprecated.onEvent,
        displayLoadingScreen: deprecated.displayLoadingScreen,
    }
}
