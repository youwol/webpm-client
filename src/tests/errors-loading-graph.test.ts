/** @format */

// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment Find a good way to work with rxjs in jest */

import './mock-requests'
import { writeFileSync } from 'fs'
import { installPackages$ } from './common'
import { install } from '../lib/loader'
import { LoadingGraphError } from '../lib/models'

beforeAll((done) => {
    installPackages$().subscribe(() => {
        done()
    })
})

test('indirect dependencies not found', async () => {
    const events = []
    const error = await install(
        {
            modules: ['b'],
        },
        {
            onEvent: (ev) => {
                events.push(ev)
            },
        },
    )

    expect(error).toBeInstanceOf(LoadingGraphError)
    expect(error['detail'].paths).toEqual({
        unknown: ['b > c > unknown'],
    })
    const innerHtml = document.documentElement.innerHTML
    writeFileSync(
        `${__dirname}/html-outputs/indirect_not_found.html`,
        innerHtml,
    )
})

test('packages not found', async () => {
    const events = []
    document.body.innerHTML = ''
    const error = await install(
        {
            modules: ['unknown'],
        },
        {
            onEvent: (ev) => {
                events.push(ev)
            },
        },
    )

    expect(error).toBeInstanceOf(LoadingGraphError)
    expect(error['detail'].packages).toEqual(['unknown#latest'])
    writeFileSync(
        `${__dirname}/html-outputs/packages_not_found.html`,
        document.documentElement.innerHTML,
    )
})

test('cyclic dependencies', async () => {
    const events = []
    document.body.innerHTML = ''
    const error = await install(
        {
            modules: ['d'],
        },
        {
            onEvent: (ev) => {
                events.push(ev)
            },
        },
    )

    expect(error).toBeInstanceOf(LoadingGraphError)
    expect(error['detail'].context).toBe('Loading graph resolution stuck')
    expect(error['detail'].packages).toEqual({ d: ['d#^1.0.0'] })
    const innerHtml = document.documentElement.innerHTML
    writeFileSync(
        `${__dirname}/html-outputs/circular_dependencies.html`,
        innerHtml,
    )
})
