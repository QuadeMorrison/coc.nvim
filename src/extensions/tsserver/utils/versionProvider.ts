/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from 'fs'
import path from 'path'
import { getParentDirs } from '../../../util/fs'
import { globalResolve } from '../../../util/resolve'
import workspace from '../../../workspace'
import API from './api'
import { TypeScriptServiceConfiguration } from './configuration'
const logger = require('../../../util/logger')('tsserver-versionProvider')

export class TypeScriptVersion {
  private _api: API | null | undefined
  constructor(
    public readonly path: string,
    private readonly _pathLabel?: string
  ) {
    this._api = null
  }

  public get tsServerPath(): string {
    return path.join(this.path, 'tsserver.js')
  }

  public get pathLabel(): string {
    return typeof this._pathLabel === 'undefined' ? this.path : this._pathLabel
  }

  public get isValid(): boolean {
    return this.version != null
  }

  public get version(): API | null {
    if (this._api) return this._api
    let api = this._api = this.getTypeScriptVersion(this.tsServerPath)
    return api
  }

  public get versionString(): string | null {
    const version = this.version
    return version ? version.versionString : null

  }

  private getTypeScriptVersion(serverPath: string): API | undefined {
    if (!fs.existsSync(serverPath)) {
      return undefined
    }

    const p = serverPath.split(path.sep)
    if (p.length <= 2) {
      return undefined
    }
    const p2 = p.slice(0, -2)
    const modulePath = p2.join(path.sep)
    let fileName = path.join(modulePath, 'package.json')
    if (!fs.existsSync(fileName)) {
      // Special case for ts dev versions
      if (path.basename(modulePath) === 'built') {
        fileName = path.join(modulePath, '..', 'package.json')
      }
    }
    if (!fs.existsSync(fileName)) {
      return undefined
    }

    const contents = fs.readFileSync(fileName).toString()
    let desc: any = null
    try {
      desc = JSON.parse(contents)
    } catch (err) {
      return undefined
    }
    if (!desc || !desc.version) {
      return undefined
    }
    return desc.version ? API.fromVersionString(desc.version) : undefined
  }
}

export class TypeScriptVersionProvider {

  public constructor(private configuration: TypeScriptServiceConfiguration) { }

  public updateConfiguration(
    configuration: TypeScriptServiceConfiguration
  ): void {
    this.configuration = configuration
  }

  public async getDefaultVersion(): Promise<TypeScriptVersion> {
    // tsdk from configuration
    let { globalTsdk } = this.configuration
    if (globalTsdk) return new TypeScriptVersion(globalTsdk)
    // resolve global module
    let modulePath = await globalResolve('typescript')
    if (modulePath) {
      let p = path.join(modulePath, 'lib')
      return new TypeScriptVersion(p)
    }
    // use bundled
    return this.bundledVersion
  }

  public get globalVersion(): TypeScriptVersion | undefined {
    let { globalTsdk } = this.configuration
    if (globalTsdk) return new TypeScriptVersion(globalTsdk)
    return undefined
  }

  public getLocalVersion(root): TypeScriptVersion | undefined {
    let paths = getParentDirs(root)
    paths.unshift(root)
    for (let p of paths) {
      if (fs.existsSync(path.join(p, 'node_modules'))) {
        let lib = path.join(p, 'node_modules/typescript/lib')
        return new TypeScriptVersion(lib)
      }
    }
    return null
  }

  public get bundledVersion(): TypeScriptVersion | null {
    let file = path.join(workspace.pluginRoot, 'node_modules/typescript/lib/tsserver.js')
    if (!fs.existsSync(file)) return null
    try {
      const bundledVersion = new TypeScriptVersion(
        path.dirname(file),
        ''
      )
      return bundledVersion
    } catch (e) {
      // noop
    }
    return null
  }
}
