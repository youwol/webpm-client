// Below is minimal mock-up of required rx-vdom types.

export type ChildrenLike = unknown
export type VirtualDOM<_T> = {
    tag: _T
    children?: ChildrenLike
    class?: string
}
export type RxVDom = {
    render: (vdom: VirtualDOM<unknown>) => HTMLElement
}
