'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

import * as loader from './metaInfoLoader';
import * as bfileLoader from './binaryFileLoader';

export class BinaryDataLoader {
    private static binaryDataLoader : BinaryDataLoader | undefined; 
    private metaInfo : loader.MetaInfoLoader;

    private _panel : vscode.WebviewPanel;
    private _activeDoc? : vscode.TextEditor;
    private binaryFileBuffer! : Buffer;
    private readonly _extensionPath : string;

    private lazyLoadCnt : number;

    public static createBinaryPanel(extensionPath : string) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
            : undefined;
        const filePath : vscode.Uri = vscode.Uri.file(path.join(extensionPath, 'src', 'resources'));
        const meta = new loader.MetaInfoLoader("elf", filePath);

        // Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			"binary data",
			"binary data",
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
                enableScripts: true,
				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))]
			}
        );

        BinaryDataLoader.binaryDataLoader = new BinaryDataLoader(panel, meta, extensionPath);
    }

    private constructor (panel : vscode.WebviewPanel, meta : loader.MetaInfoLoader, extPath : string) {
        this.metaInfo = meta;
        this._panel = panel;
        this._extensionPath = extPath;
        this.lazyLoadCnt = 0;

        bfileLoader.BinaryFileLoader.binaryFileLoad(this.metaInfo);

        this.metaInfo.applyBinaryInfo();

        this._update();
        this._panel.webview.onDidReceiveMessage(
            e => this._handleEvent(e),
            null,
            undefined
        );

        vscode.window.onDidChangeActiveTextEditor(
            e => this._update,
            null,
            undefined
        );
    }

    set MetaInfo(meta : loader.MetaInfoLoader) {
        this.metaInfo = meta;
        this._update();
    }

    public goToParticularField(fieldName : string) {
        this._panel.webview.postMessage({});
    }

    private _buildHTML() : string {
        let aa = "";
        this.metaInfo.fileMeta.forEach(
            item => {
                let tmp = item.rawValue;
                if (tmp != undefined) {
                    if (item.fieldType == loader.FieldType.ARRAY) {
                        let len = item.arrayLength;
                        let size = item.arraySize;
                        if (len) {
                            Array.from({length : len}, (x, i) => {
                                if (tmp && size) {
                                    let value = item.rawEntryValue(i);
                                    if (value) {
                                        value.forEach((entry, idx) => {
                                            let mttmp = item.arrayEntryField[idx];
                                            aa += `<div> &gt&gt&gt ${entry.binaryStartPos}
                                            || ${entry.binaryEndPos}
                                            || ${bfileLoader.BinaryFileLoader.instance.openedFile.toString('hex', entry.binaryStartPos, entry.binaryEndPos)}
                                            || ${mttmp.fieldDescription} </div>`;
                                        });
                                    }
                                    else {
                                        aa += `<div>${tmp.binaryStartPos + i*size}
                                        || ${tmp.binaryEndPos + i*size}
                                        || ${bfileLoader.BinaryFileLoader.instance.openedFile.toString('hex', tmp.binaryStartPos + i*size, tmp.binaryStartPos + i*size + size)}
                                        || ${item.fieldDescription} </div>`;
                                    }
                                    aa += "<div>======</div>";
                                }
                            });
                        }
                    }
                    else {
                        aa += `<div>${tmp.binaryStartPos} 
                        || ${tmp.binaryEndPos} 
                        || ${bfileLoader.BinaryFileLoader.instance.openedFile.toString('hex', tmp.binaryStartPos, tmp.binaryEndPos)}
                        || ${item.fieldDescription} </div>`;
                    }
                }
            }
        );

        return `<html><body>${aa}</body></html>`;
    }

    private _initDefaultViewer() : string {
        const sizeoOfLazyLoading : any = vscode.workspace.getConfiguration("conf.resource").get("lazyLoadingSize");
        const scriptPath = vscode.Uri.file(
            path.join(this._extensionPath, 'media', 'main.js'));
        const scriptUri = scriptPath.with({ scheme: 'vscode-resource' });
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}';">
            <title>Binary viewer</title>
        </head>
        <body>
            <div id="container">
                ${this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += sizeoOfLazyLoading)}
            </div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private _lazyLoadHTML(start : number, end : number) : string {
        const numberOfBin : any = vscode.workspace.getConfiguration("conf.resource").get("numberOfBinaryInLine");

        return bfileLoader.BinaryFileLoader.instance.openedFile.slice(start, end)
            .reduce((data : { output : string, lineBuf : Buffer, bufOffset : number }, val : number, currIdx : number) => {
                if (currIdx == 0) {
                    data.output += `<div>0x${(start + currIdx).toString(16).padStart(8, '0').toUpperCase()} || `;
                }
                else if (currIdx % numberOfBin == 0) {
                    // line feed
                    data.output += `
                    || ${data.lineBuf.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}</div>
                    <div>0x${(start + currIdx).toString(16).padStart(8, '0').toUpperCase()} || `;
                    data.lineBuf = Buffer.allocUnsafe(numberOfBin);
                    data.bufOffset = 0;
                }

                data.output += `<span class="test"> ${val.toString(16).padStart(2, '0').toUpperCase()} </span>`;
                data.lineBuf.writeUInt8(val, data.bufOffset);
                data.bufOffset++;

                return data;
            }, { output : "", lineBuf : Buffer.allocUnsafe(numberOfBin), bufOffset : 0}).output;
    }

    private _update() {
        this._panel.webview.html = this._initDefaultViewer();;
    }

    private _handleEvent(event : any) {
        switch (event.command) {
            case 'lazyLoad':
                const sizeoOfLazyLoading : any = vscode.workspace.getConfiguration("conf.resource").get("lazyLoadingSize");
                this._panel.webview.postMessage({
                    command : 'onload',
                    lazyHTML : this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += sizeoOfLazyLoading),
                    response : ''
                });
                break;
        }
    }

    private _getNonce() : string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
