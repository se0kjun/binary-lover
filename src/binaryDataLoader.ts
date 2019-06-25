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

    public static goToParticularOffset(offset : number) {
        if (BinaryDataLoader.binaryDataLoader) {
            BinaryDataLoader.binaryDataLoader._panel.webview.postMessage({
                command : 'gotoOffset',
                offset : offset
            });
        }
    }

    private _initMetaViewer() : string {
        const scriptUri = vscode.Uri.file(
            path.join(this._extensionPath, 'media', 'main.js')).with({ scheme: 'vscode-resource' });
        const styleUri = vscode.Uri.file(
            path.join(this._extensionPath, 'media', 'main.css')).with({ scheme: 'vscode-resource'});

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src vscode-resource:; style-src vscode-resource:;">
            <title>Binary viewer</title>
        </head>
        <body>
            <div id="header">
                ${this._buildHeaderHTML()}
            </div>
            <div id="container">
                ${this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += this._lazyLoadSize)}
            </div>
            <script src="${scriptUri}"></script>
            <link rel="stylesheet" href="${styleUri}"/>
        </body>
        </html>`;
    }

    private _initDefaultViewer() : string {
        const scriptUri = vscode.Uri.file(
            path.join(this._extensionPath, 'media', 'main.js')).with({ scheme: 'vscode-resource' });
        const styleUri = vscode.Uri.file(
            path.join(this._extensionPath, 'media', 'main.css')).with({ scheme: 'vscode-resource'});

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src vscode-resource:; style-src vscode-resource:;">
            <title>Binary viewer</title>
        </head>
        <body>
            <div id="container">
                ${this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += this._lazyLoadSize)}
            </div>
            <script src="${scriptUri}"></script>
            <link rel="stylesheet" href="${styleUri}"/>
        </body>
        </html>`;
    }

    private _lazyLoadHTML(start : number, end : number) : string {
        let numberOfBin : any = vscode.workspace.getConfiguration("conf.resource").get("numberOfBinaryInLine");
        if (end - start < numberOfBin) {
            numberOfBin = end - start;
        }

        return bfileLoader.BinaryFileLoader.instance.openedFile.slice(start, end)
            .reduce((data : { output : string, lineBuf : Buffer, bufOffset : number }, val : number, currIdx : number) => {
                if (data.bufOffset == 0) {
                    // line feed
                    data.output += `<div><span class="offset">0x${(start + currIdx).toString(16).padStart(8, '0').toUpperCase()}</span> || `;
                    data.lineBuf = Buffer.allocUnsafe(numberOfBin);
                }

                data.output += `<span class="hex_data" data-tooltip-dec="${val}" offset="${currIdx}"> ${val.toString(16).padStart(2, '0').toUpperCase()} </span>`;
                data.lineBuf.writeUInt8(val, data.bufOffset);
                data.bufOffset++;

                if (data.bufOffset == numberOfBin || (end - start == data.bufOffset)) {
                    data.output += ` || <span class="char_data">${data.lineBuf.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}</span></div>`;
                    data.bufOffset = 0;
                }

                return data;
            }, { output : "", lineBuf : Buffer.allocUnsafe(numberOfBin), bufOffset : 0}).output;
    }

    private _buildHeaderHTML() : string {
        const numberOfBin : any = vscode.workspace.getConfiguration("conf.resource").get("numberOfBinaryInLine");

        if (this.metaInfo) {
            return this.metaInfo.fileMeta.reduce((output, item) => {
                if (item.fieldType != loader.FieldType.ARRAY && item.rawValue) {
                    let pos = item.rawValue;
                    output += `<div> ${item.fieldDescription} </div>
                    ${this._lazyLoadHTML(pos.binaryStartPos, pos.binaryEndPos)}`;
                }
                else if (item.rawValue){
                    output += `<div> ${item.fieldDescription} </div>
                    ${this._buildArrayTypeHTML(item)}`;
                }

                return output;
            }, "");
        }

        return "";
    }

    private _buildArrayTypeHTML(item : loader.MetaField) : string {
        let arrLen = item.arrayLength;
        let arrSize = item.arraySize;
        let output = "";

        if (arrLen && arrSize && item.rawValue) {
            let tmp = item.rawValue;
            Array.from({length : arrLen}, (x, i) => {
                let arrItem = item.rawEntryValue(i);
                if (arrItem) {
                    arrItem.forEach((entry, idx) => {
                        let fieldOfarrItem = item.arrayEntryField[idx];
                        output += `<div> ${fieldOfarrItem.fieldDescription} </div>
                        ${this._lazyLoadHTML(entry.binaryStartPos, entry.binaryEndPos)}`;
                    })
                }
                else if (arrSize) {
                    output += `<div> ${item.fieldDescription} </div>
                    ${this._lazyLoadHTML(tmp.binaryStartPos + i * arrSize,
                        tmp.binaryEndPos + ((i + 1) * arrSize))}`;
                }
            });
        }

        return output;
    }

    private _update() {
        if (this._binaryFormat != "default") {
            this._panel.webview.html = this._initMetaViewer();
            this._panel.webview.html += this._initDefaultViewer();
        }
        else {
            this._panel.webview.html = this._initDefaultViewer();
        }
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
}
