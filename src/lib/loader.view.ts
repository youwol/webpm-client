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

export type Mode = 'svg' | 'matrix'

export interface LoadingScreenOptions {
    container?: HTMLElement
    id?: string
    logo?: string
    wrapperStyle?: { [_k: string]: string }
    fadingTimeout?: number
}

export class LoadingScreenView {
    static DefaultFadingTimeout = 500
    public readonly id: string = 'loading-screen'
    public readonly logo: string = youwolSvgLogo()
    public readonly fadingTimeout = LoadingScreenView.DefaultFadingTimeout
    public readonly container: HTMLElement = document.body
    public readonly wrapperStyle: { [_k: string]: string } = {
        position: 'absolute',
        top: '0',
        width: '100vw',
        height: '100vh',
    }
    public readonly wrapperDiv: HTMLDivElement
    public readonly loadingDiv: HTMLDivElement
    public contentDiv: HTMLDivElement

    constructor(options: LoadingScreenOptions = {}) {
        Object.assign(this, options)

        this.wrapperDiv = document.createElement('div')
        Object.entries(this.wrapperStyle).forEach(([k, v]) => {
            this.wrapperDiv.style.setProperty(k, v)
        })
        this.wrapperDiv.innerHTML = `
        <div id='${this.id}' style='display: flex;justify-content: space-around; background-color: darkgrey;
        color: green; font-family: monospace;font-size:small; width:100%; height:100%; opacity:1;
        transition: opacity 1s;'>
            <div style='margin-top: auto;margin-bottom: auto; padding:40px;
            background-color: black; border-radius: 25px;min-width: 50%; max-height:75%; overflow: auto;
            display: flex;'
            >
                <div  style='display: flex;justify-content: space-around;' >
                    <div id='logo' style='white-space: pre-wrap; margin-top: auto; margin-bottom: auto; /*animation: spin 3s linear infinite*/'> 
                        ${this.logo}
                    </div>   
                </div> 
                <div  style='width: 50px; '>
    
                </div>
                <div  id='screen-content' style='margin-top: auto;margin-bottom: auto; '>
    
                </div>
                <div  id='content-error'>
    
                </div>
            </div>
        </div>
        `
    }

    next(event: CdnEvent) {
        if (event instanceof CdnLoadingGraphErrorEvent) {
            insertLoadingGraphError(this.contentDiv, event)
        }
        if (event instanceof CdnMessageEvent) {
            let divLib: HTMLDivElement = document.querySelector(`#${event.id}`)
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
            let divLib: HTMLDivElement = document.querySelector(`#${cssId}`)
            if (!divLib) {
                divLib = document.createElement('div')
                divLib.id = cssId
                this.contentDiv.appendChild(divLib)
            }
            updateLibStatusView(libraryName, divLib, event)
        }
    }

    render() {
        this.container.appendChild(this.wrapperDiv)
        this.contentDiv = document.getElementById(
            'screen-content',
        ) as HTMLDivElement
    }

    done() {
        this.wrapperDiv.style.setProperty(
            'transition',
            `opacity ${this.fadingTimeout}ms`,
        )
        this.wrapperDiv.style.setProperty('opacity', '0')
        setTimeout(() => this.wrapperDiv.remove(), this.fadingTimeout)
    }
}
