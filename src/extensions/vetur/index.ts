import path from 'path'
import { LanguageService } from '../../language-client'
import { LanguageClientOptions } from '../../language-client/main'
import { WorkspaceConfiguration } from '../../types'
import workspace from '../../workspace'

const logger = require('../../util/logger')('extension-vetur')
const sections = ['vetur', 'emmet', 'html', 'javascript', 'typescript', 'prettier', 'stylusSupremacy']
const file = 'dist/vueServerMain.js'

function getConfig(config: WorkspaceConfiguration): any {
  let res = {}
  for (let section of sections) {
    let o = config.get<any>(section)
    res[section] = o || {}
  }
  return res
}

export default class VeturService extends LanguageService {
  constructor() {
    let c = workspace.getConfiguration()
    const config = c.get('vetur') as any
    super('vetur', 'Vetur Language Server', {
      module: () => {
        return new Promise(resolve => {
          workspace.resolveModule('vue-language-server', 'vetur').then(folder => {
            if (!folder) return
            resolve(folder ? path.join(folder, file) : null)
          }, err => {
            logger.error(err)
            resolve(null)
          })
        })
      },
      execArgv: config.execArgv || [],
      filetypes: config.filetypes || ['vue'],
      initializationOptions: {
        config: getConfig(c)
      },
      enable: config.enable !== false
    })
  }

  protected resolveClientOptions(clientOptions: LanguageClientOptions): LanguageClientOptions {
    Object.assign(clientOptions, {
      synchronize: {
        configurationSection: sections,
        fileEvents: workspace.createFileSystemWatcher('**/*.[tj]s', true, false, true)
      }
    })
    return clientOptions
  }
}
