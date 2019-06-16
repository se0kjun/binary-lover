'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

import * as loader from './metaInfoLoader';
import * as bfileLoader from './binaryFileLoader';

export class BinaryDataLoader {
    private static binaryDataLoader : BinaryDataLoader | undefined; 
    private metaInfo : loader.MetaInfoLoader | undefined;

    private _panel : vscode.WebviewPanel;
    private _activeDoc? : vscode.TextEditor;
    private binaryFileBuffer! : Buffer;
    private readonly _extensionPath : string;
    private readonly _binaryFormat : string;
    private readonly _lazyLoadSize : number;

    private lazyLoadCnt : number;

    public static createBinaryPanel(extensionPath : string, binaryFormat : string) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
            : undefined;

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

        BinaryDataLoader.binaryDataLoader = new BinaryDataLoader(panel, binaryFormat, extensionPath);
    }

    private constructor (panel : vscode.WebviewPanel, binFormat : string, extPath : string) {
        const sizeOfLazyLoading : any = vscode.workspace.getConfiguration("conf.resource").get("lazyLoadingSize");
        const numberOfBin : any = vscode.workspace.getConfiguration("conf.resource").get("numberOfBinaryInLine");

        this._panel = panel;
        this._extensionPath = extPath;
        this._binaryFormat = binFormat;
        this._lazyLoadSize = sizeOfLazyLoading + sizeOfLazyLoading % numberOfBin;
        this.lazyLoadCnt = 0;

        const filePath : vscode.Uri = vscode.Uri.file(path.join(this._extensionPath, 'src', 'resources'));
        if (this._binaryFormat != "default") {
            this.metaInfo = new loader.MetaInfoLoader(this._binaryFormat, filePath);

            bfileLoader.BinaryFileLoader.binaryFileLoadByMeta(this.metaInfo);
            this.metaInfo.applyBinaryInfo();
        } else {
            bfileLoader.BinaryFileLoader.binaryFileLoad();
        }

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
        if (this.metaInfo)
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
        const scriptUri = vscode.Uri.file(
            path.join(this._extensionPath, 'media', 'main.js')).with({ scheme: 'vscode-resource' });
        const styleUri = vscode.Uri.file(
            path.join(this._extensionPath, 'media', 'main.css')).with({ scheme: 'vscode-resource'});
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}'; style-src vscode-resource:;">
            <title>Binary viewer</title>
        </head>
        <body>
            <div id="container">
                ${this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += this._lazyLoadSize)}
            </div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
            <link rel="stylesheet" href="${styleUri}"/>
        </body>
        </html>`;
    }

    private _lazyLoadHTML(start : number, end : number) : string {
        const numberOfBin : any = vscode.workspace.getConfiguration("conf.resource").get("numberOfBinaryInLine");

        return bfileLoader.BinaryFileLoader.instance.openedFile.slice(start, end)
            .reduce((data : { output : string, lineBuf : Buffer, bufOffset : number }, val : number, currIdx : number) => {
                if (data.bufOffset == 0) {
                    // line feed
                    data.output += `<div><span class="offset">0x${(start + currIdx).toString(16).padStart(8, '0').toUpperCase()}</span> || `;
                    data.lineBuf = Buffer.allocUnsafe(numberOfBin);
                }

                data.output += `<span class="hex_data"> ${val.toString(16).padStart(2, '0').toUpperCase()} </span>`;
                data.lineBuf.writeUInt8(val, data.bufOffset);
                data.bufOffset++;

                if (data.bufOffset == numberOfBin) {
                    data.output += ` || ${data.lineBuf.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}</div>`;
                    data.bufOffset = 0;
                }

                return data;
            }, { output : "", lineBuf : Buffer.allocUnsafe(numberOfBin), bufOffset : 0}).output;
    }

    private _update() {
        this._panel.webview.html = this._initDefaultViewer();;
    }

    private _handleEvent(event : any) {
        switch (event.command) {
            case 'lazyLoad':
                this._panel.webview.postMessage({
                    command : 'onload',
                    lazyHTML : this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += this._lazyLoadSize),
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
