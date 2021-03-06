import { CancellationToken, Disposable, DocumentSelector, FormattingOptions, Range, TextDocument, TextEdit } from 'vscode-languageserver-protocol'
import { DocumentRangeFormattingEditProvider } from './index'
import Manager, { ProviderItem } from './manager'
import uuid = require('uuid/v4')

export default class FormatRangeManager extends Manager<DocumentRangeFormattingEditProvider> implements Disposable {

  public register(selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable {
    let item: ProviderItem<DocumentRangeFormattingEditProvider> = {
      id: uuid(),
      selector,
      provider
    }
    this.providers.add(item)
    return Disposable.create(() => {
      this.providers.delete(item)
    })
  }

  public async provideDocumentRangeFormattingEdits(
    document: TextDocument,
    range: Range,
    options: FormattingOptions,
    token: CancellationToken
  ): Promise<TextEdit[]> {
    let item = this.getProvider(document)
    if (!item) return null
    let { provider } = item
    return await Promise.resolve(provider.provideDocumentRangeFormattingEdits(document, range, options, token))
  }

  public dispose(): void {
    this.providers = new Set()
  }
}
