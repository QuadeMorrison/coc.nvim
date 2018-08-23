/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TextDocument } from 'vscode-languageserver-protocol'
import { WorkspaceConfiguration } from '../../../types'
import workspace from '../../../workspace'
import * as Proto from '../protocol'
import { ITypeScriptServiceClient } from '../typescriptService'
import API from '../utils/api'
import * as languageIds from '../utils/languageModeIds'
const logger = require('../../../util/logger')('tsserver-fileConfigurationManager')

function objAreEqual<T>(a: T, b: T): boolean {
  let keys = Object.keys(a)
  for (let i = 0; i < keys.length; i++) { // tslint:disable-line
    let key = keys[i]
    if ((a as any)[key] !== (b as any)[key]) {
      return false
    }
  }
  return true
}

interface FormatOptions {
  tabSize: number
  insertSpaces: boolean
}

interface FileConfiguration {
  formatOptions: Proto.FormatCodeSettings
  preferences: Proto.UserPreferences
}

export interface CompletionOptions {
  readonly commaAfterImport: boolean
  readonly useCodeSnippetsOnMethodSuggest: boolean
  readonly nameSuggestions: boolean
  readonly autoImportSuggestions: boolean
}

export default class FileConfigurationManager {
  private cachedOption = null
  private requesting = false

  public constructor(private readonly client: ITypeScriptServiceClient) {
  }

  public async ensureConfigurationOptions(languageId: string, insertSpaces: boolean, tabSize: number): Promise<void> {
    let { requesting } = this
    let options: FormatOptions = {
      tabSize,
      insertSpaces
    }
    if (requesting || (this.cachedOption && objAreEqual(this.cachedOption, options))) return
    const currentOptions = this.getFileOptions(options, languageId)
    this.requesting = true
    const args = {
      hostInfo: 'nvim-coc',
      ...currentOptions
    } as Proto.ConfigureRequestArguments
    await this.client.execute('configure', args)
    this.cachedOption = options
    this.requesting = false
  }

  public async ensureConfigurationForDocument(document: TextDocument): Promise<void> {
    let opts = await workspace.getFormatOptions(document.uri)
    return this.ensureConfigurationOptions(document.languageId, opts.insertSpaces, opts.tabSize)
  }

  public reset(): void {
    this.cachedOption = null
  }

  public getLanguageConfiguration(languageId: string): WorkspaceConfiguration {
    return workspace.getConfiguration(languageId)
  }

  public isTypeScriptDocument(languageId: string): boolean {
    return languageId === languageIds.typescript || languageId === languageIds.typescriptreact || 
      languageId === languageIds.typescripttsx || languageId === languageIds.typescriptjsx
  }

  public enableJavascript(): boolean {
    const config = workspace.getConfiguration('tsserver')
    return !!config.get<boolean>('enableJavascript')
  }

  private getFileOptions(options: FormatOptions, languageId: string): FileConfiguration {
    const lang = this.isTypeScriptDocument(languageId) ? 'typescript' : 'javascript'
    return {
      formatOptions: this.getFormatOptions(options, lang),
      preferences: this.getPreferences(lang)
    }
  }

  private getFormatOptions(options: FormatOptions, language: string): Proto.FormatCodeSettings {
    const config = workspace.getConfiguration(`${language}.format`)

    return {
      tabSize: options.tabSize,
      indentSize: options.tabSize,
      convertTabsToSpaces: options.insertSpaces,
      // We can use \n here since the editor normalizes later on to its line endings.
      newLineCharacter: '\n',
      insertSpaceAfterCommaDelimiter: config.get<boolean>('insertSpaceAfterCommaDelimiter'),
      insertSpaceAfterConstructor: config.get<boolean>('insertSpaceAfterConstructor'),
      insertSpaceAfterSemicolonInForStatements: config.get<boolean>('insertSpaceAfterSemicolonInForStatements'),
      insertSpaceBeforeAndAfterBinaryOperators: config.get<boolean>('insertSpaceBeforeAndAfterBinaryOperators'),
      insertSpaceAfterKeywordsInControlFlowStatements: config.get<boolean>('insertSpaceAfterKeywordsInControlFlowStatements'),
      insertSpaceAfterFunctionKeywordForAnonymousFunctions: config.get<boolean>('insertSpaceAfterFunctionKeywordForAnonymousFunctions'),
      insertSpaceBeforeFunctionParenthesis: config.get<boolean>('insertSpaceBeforeFunctionParenthesis'),
      insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: config.get<boolean>('insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis'),
      insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: config.get<boolean>('insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets'),
      insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: config.get<boolean>('insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces'),
      insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: config.get<boolean>('insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces'),
      insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: config.get<boolean>('insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces'),
      insertSpaceAfterTypeAssertion: config.get<boolean>('insertSpaceAfterTypeAssertion'),
      placeOpenBraceOnNewLineForFunctions: config.get<boolean>('placeOpenBraceOnNewLineForFunctions'),
      placeOpenBraceOnNewLineForControlBlocks: config.get<boolean>('placeOpenBraceOnNewLineForControlBlocks')
    }
  }

  public getCompleteOptions(languageId: string): CompletionOptions {
    const lang = this.isTypeScriptDocument(languageId) ? 'typescript' : 'javascript'
    const config = workspace.getConfiguration(`${lang}.preferences.completion`)
    return {
      useCodeSnippetsOnMethodSuggest: config.get<boolean>('useCodeSnippetsOnMethodSuggest', true),
      commaAfterImport: config.get<boolean>('commaAfterImport', true),
      nameSuggestions: config.get<boolean>('nameSuggestions', true),
      autoImportSuggestions: config.get<boolean>('autoImportSuggestions', true)
    }
  }

  public getPreferences(language: string): Proto.UserPreferences {
    if (!this.client.apiVersion.gte(API.v290)) {
      return {}
    }
    const config = workspace.getConfiguration(`${language}.preferences`)
    return {
      importModuleSpecifierPreference: getImportModuleSpecifier(config) as any,
      disableSuggestions: !config.get<boolean>('suggestionActions.enabled', true),
      quotePreference: getQuoteType(config),
      includeCompletionsForModuleExports: config.get<boolean>('completion.moduleExports', true),
      includeCompletionsWithInsertText: true,
      allowTextChangesInNewFiles: false,
    }
  }
}

type ModuleImportType = 'relative' | 'non-relative' | 'auto'
type QuoteType = 'single' | 'double'

function getImportModuleSpecifier(config): ModuleImportType {
  let val = config.get('importModuleSpecifier')
  switch (val) {
    case 'relative':
      return 'relative'
    case 'non-relative':
      return 'non-relative'
    default:
      return 'auto'
  }
}

function getQuoteType(config): QuoteType {
  let val = config.get('quoteStyle')
  switch (val) {
    case 'single':
      return 'single'
    case 'double':
      return 'double'
    default:
      return 'single'
  }
}
