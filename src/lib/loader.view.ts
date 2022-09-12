import {
    CdnEvent,
    CdnFetchEvent,
    CdnLoadingGraphErrorEvent,
    CdnMessageEvent,
} from './models'
import {
    insertLoadingGraphError,
    sanitizeCssId,
    updateLibStatusView,
    youwolSvgLogo,
} from './utils.view'

/**
 * Specify loading screen options, see [[LoadingScreenView]].
 *
 * @category Loading screen
 */
export interface LoadingScreenOptions {
    /**
     * container in which the loading screen's HTMLDivElement is appended (when calling [[LoadingScreenView.render]]).
     */
    container?: HTMLElement

    /**
     * id of the loading screen's HTMLDivElement wrapper
     */
    id?: string

    /**
     * innerHTML definition of the logo
     */
    logo?: string

    /**
     * style to apply on the loading screen's HTMLDivElement wrapper
     */
    wrapperStyle?: { [_k: string]: string }

    /**
     * fading timeout
     */
    fadingTimeout?: number
}

/**
 * Default values of [[LoadingScreenOptions]].
 *
 * @category Loading screen
 */
export class DefaultLoadingScreenOptions implements LoadingScreenOptions {
    /**
     * Default [[LoadingScreenOptions.id]]
     */
    public readonly id: string = 'loading-screen'

    /**
     * Default [[LoadingScreenOptions.logo]], see [[youwolSvgLogo]].
     */
    public readonly logo: string = youwolSvgLogo()

    /**
     * Default [[LoadingScreenOptions.fadingTimeout]].
     */
    public readonly fadingTimeout: number = 500

    /**
     * Default [[LoadingScreenOptions.container]]
     */
    public readonly container: HTMLElement = document.body

    /**
     * Default [[LoadingScreenOptions.wrapperStyle]]:
     * ```
     * {
     *    position: 'absolute',
     *    top: '0',
     *    left: '0',
     *    width: '100vw',
     *    height: '100vh',
     *    padding: 'inherit',
     *    'font-weight': 'bolder'
     * }
     * ```
     */
    public readonly wrapperStyle: { [_k: string]: string } = {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        padding: 'inherit',
        'font-weight': 'bolder',
    }
}

/**
 * Class providing granular controls on how loading screen is displayed when using [[Client.install]]
 * or [[install]].
 *
 * Here is an example:
 * ```
 * import {LoadingScreenView, install} from '@youwol/cdn-client'
 *
 * const loadingScreen = new LoadingScreenView({
 *     container: this,
 *     logo: `<div style='font-size:xxx-large'>🐍</div>`,
 *     wrapperStyle: {
 *         position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', 'font-weight': 'bolder',
 *     },
 * })
 * loadingScreen.render()
 * await install({
 *     modules: ['rxjs#7'],
 *     onEvent: (ev) => {
 *         // event forwarding to loading screen
 *         loadingScreen.next(ev)
 *     },
 * })
 * // loadingScreen.next(...) can be used latter in the code
 * // At some point remove the loading screen
 * loadingScreen.done()
 * ```
 *
 * Default values of the display options are defined in [[DefaultLoadingScreenOptions]], it can be controlled by e.g.:
 * ```
 * import {LoadingScreenView, DefaultLoadingScreenOptions} from '@youwol/cdn-client'
 * // for all LoadingScreenView instances:
 * LoadingScreenView.DefaultOptions = {
 *     ...new DefaultLoadingScreenOptions(),
 *     fadingTimeout: 0,
 * }
 * // for one LoadingScreenView instance (includes previously set 'fadingTimeout' to 0):
 * new cdnClient.LoadingScreenView({
 *     logo: `<div style='font-size:xxx-large'>🐍</div>`,
 * })
 * ```
 *
 * > For default display, setting [[InstallInputs.displayLoadingScreen]] to `true` is enough:
 * > creation and management of [[LoadingScreenView]] will be automatic.
 *
 * @category Loading screen
 */
export class LoadingScreenView {
    /**
     * Can be used to control default display options for all [[LoadingScreenView]] instances
     */
    static DefaultOptions = new DefaultLoadingScreenOptions()

    /**
     * The actual display options used by the class.
     */
    public readonly options: LoadingScreenOptions

    /**
     * expose the wrapperDiv HTMLDivElement
     */
    public readonly wrapperDiv: HTMLDivElement
    /**
     * expose the loadingDiv HTMLDivElement
     */
    public readonly loadingDiv: HTMLDivElement
    /**
     * expose the contentDiv HTMLDivElement
     */
    public contentDiv: HTMLDivElement

    /**
     *
     * @param options see [[LoadingScreenOptions]], final display options object is obtained by merging
     * `options` with [[DefaultLoadingScreenOptions]] : `Object.assign(LoadingScreenView.DefaultOptions, options)`
     */
    constructor(options: LoadingScreenOptions = {}) {
        this.options = Object.assign(LoadingScreenView.DefaultOptions, options)
        this.options.container = this.options.container || document.body
        const wrapperStyle = {
            ...this.options.wrapperStyle,
            ...(options.wrapperStyle || {}),
        }
        this.wrapperDiv = document.createElement('div')
        Object.entries(wrapperStyle).forEach(([k, v]) => {
            this.wrapperDiv.style.setProperty(k, v)
        })
        this.wrapperDiv.innerHTML = `
        <div id='${this.options.id}' style='display: flex;justify-content: space-around; background-color: darkgrey;
        color: green; font-family: monospace;font-size:small; width:100%; height:100%; opacity:1;
        transition: opacity 1s;'>
            <div style='margin-top: auto;margin-bottom: auto; padding:40px;
            background-color: black; border-radius: 25px;min-width: 50%; max-height:75%; overflow: auto;
            display: flex;'
            >
                <div  style='display: flex;justify-content: space-around;' >
                    <div id='logo' style='white-space: pre-wrap; margin-top: auto; margin-bottom: auto; /*animation: spin 3s linear infinite*/'> 
                        ${this.options.logo}
                    </div>   
                </div> 
                <div  style='width: 50px; '>
    
                </div>
                <div  class='screen-messages-container' style='margin-top: auto;margin-bottom: auto; '>
    
                </div>
            </div>
        </div>
        `
    }

    /**
     * Actualize the view given a new [[CdnEvent]] (provided that [[LoadingScreenView.render]] has been called before).
     *
     * @param event event to account for
     */
    next(event: CdnEvent) {
        if (event instanceof CdnLoadingGraphErrorEvent) {
            insertLoadingGraphError(this.contentDiv, event)
        }
        if (event instanceof CdnMessageEvent) {
            let divLib: HTMLDivElement = this.wrapperDiv.querySelector(
                `#${event.id}`,
            )
            if (divLib) {
                divLib.textContent = '> ' + event.text
            }
            if (!divLib) {
                divLib = document.createElement('div')
                divLib.id = sanitizeCssId(event.id)
                divLib.textContent = '> ' + event.text
                this.contentDiv.appendChild(divLib)
            }
        }
        if (event instanceof CdnFetchEvent) {
            const libraryName = event.targetName
            const cssId = sanitizeCssId(libraryName)
            let divLib: HTMLDivElement = this.wrapperDiv.querySelector(
                `#${cssId}`,
            )
            if (!divLib) {
                divLib = document.createElement('div')
                divLib.id = cssId
                this.contentDiv.appendChild(divLib)
            }
            updateLibStatusView(libraryName, divLib, event)
        }
    }

    /**
     * Render the loading screen view, should be called before any call to [[LoadingScreenView.next]]
     * to actually see the updates.
     */
    render() {
        this.options.container.appendChild(this.wrapperDiv)
        this.contentDiv = this.wrapperDiv.querySelector(
            '.screen-messages-container',
        )
    }

    /**
     * Remove the loading screen (see [[LoadingScreenOptions.fadingTimeout]])
     */
    done() {
        this.wrapperDiv.style.setProperty(
            'transition',
            `opacity ${this.options.fadingTimeout}ms`,
        )
        this.wrapperDiv.style.setProperty('opacity', '0')
        setTimeout(() => this.wrapperDiv.remove(), this.options.fadingTimeout)
    }
}
