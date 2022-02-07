import {
    CdnFetchEvent,
    SourceLoadedEvent,
    SourceLoadingEvent,
    StartEvent,
    UnauthorizedEvent,
} from './models'
import { ScreenView } from './utils.view'

export type Mode = 'svg' | 'matrix'

export class LoadingScreenView extends ScreenView {
    public readonly container: HTMLElement
    public readonly loadingDiv: HTMLDivElement
    public readonly mode: Mode

    public contentDiv: HTMLDivElement

    constructor({ container, mode }: { container: HTMLElement; mode: Mode }) {
        super({
            container,
            id: 'loading-screen',
            logo:
                mode == 'svg'
                    ? LoadingScreenView.svgLogo()
                    : LoadingScreenView.matrixLogo(),
        })
    }

    static svgLogo() {
        return `<svg id='logo2bis' xmlns='http://www.w3.org/2000/svg' style='transform:translate(0px,-12px);' viewBox='0 0 109.58 121.1'>
        <defs><style>.cls-1{fill:#008000;}</style></defs>
        <title>logo_YouWol_white</title>
        <polygon class='cls-1' points='109.58 94.68 109.58 84.14 91.39 73.64 109.58 63.14 109.58 42.06 63.95 68.41 63.94 68.41 63.94 121.1 82.2 110.56 82.2 89.41 100.52 99.99 109.58 94.76 109.58 94.68'/>
        <polygon class='cls-1' points='54.8 52.69 9.17 26.35 27.42 15.81 45.61 26.31 45.61 5.31 54.73 0.04 54.8 0 63.86 5.23 63.86 26.39 82.18 15.81 100.43 26.35 54.8 52.7 54.8 52.69'/>
        <polygon class='cls-1' points='0.07 94.72 9.2 99.99 27.38 89.49 27.38 110.56 45.64 121.1 45.64 68.41 45.64 68.41 0.01 42.06 0.01 63.14 18.33 73.64 0 84.22 0 94.68 0.07 94.72'/>
        </svg>
        `
    }

    static matrixLogo() {
        return `<div style="transform:translate(0px,-12px);">
                    *@@@@@@,         
                    *@@@@@@,                
          /@@@@@@%  *@@@@@@,  %@@@@@@(      
        ,&@@@@@@@@@@@@@@@@@@@@@@@@@@@@&*    
             %@@@@@@@@@@@@@@@@@@@@%         
    (            /@@@@@@@@@@@@/            /
    @@@@#.           ,&@@&*           .#@@@@
    @@@@@@@@@.                    .@@@@@@@@@
    #@@@@@@@@@@@@(            (@@@@@@@@@@@@#
        /@@@@@@@@@@@#      #@@@@@@@@@@@(    
        *@@@@@@@@@@@#      #@@@@@@@@@@@/    
    (@@@@@@@@@@@@@@@#      #@@@@@@@@@@@@@@@#
    @@@@@@@@@*&@@@@@#      #@@@@@&,@@@@@@@@@
     .#@%.    &@@@@@#      #@@@@@&    .#@%. 
              &@@@@@#      #@@@@@&          
              ,@@@@@#      #@@@@@,          
                  .##      ##.
        </div>`
    }

    next(event: CdnFetchEvent) {
        const libraryName = event.targetName
        const cssId = libraryName.replace('/', '-').replace('@', '')
        let divLib: HTMLDivElement = document.querySelector(`#${cssId}`)
        if (!divLib) {
            divLib = document.createElement('div')
            divLib.id = cssId
            this.contentDiv.appendChild(divLib)
        }
        if (event instanceof StartEvent) {
            divLib.style.setProperty('color', 'lightgray')
            divLib.textContent = `> ${libraryName} ... loading: 0 kB`
        }
        if (event instanceof SourceLoadingEvent) {
            divLib.style.setProperty('color', 'lightgray')
            divLib.textContent = `> ${libraryName} ... loading: ${
                event.progress.loaded / 1000
            } kB`
        }
        if (event instanceof SourceLoadedEvent) {
            divLib.style.setProperty('color', 'green')
            divLib.textContent = `> ${libraryName} ${
                event.progress.loaded / 1000
            } kB`
        }
        if (event instanceof UnauthorizedEvent) {
            divLib.style.setProperty('color', 'red')
            divLib.style.setProperty('font-size', 'small')
            divLib.textContent = `> ${libraryName} : You don't have permission to access this resource.`
        }
    }
}
