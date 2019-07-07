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
            <div id="nav-header">
            <div id="bin-save">SaveAs</div>
            </div>
            <div id="meta-header">
                ${this._buildHeaderHTML()}
            </div>
            <div id="container">
                ${this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += this._lazyLoadSize)}
            </div>
            <div id="loadOffset" data-load-size="${this._lazyLoadSize}" data-load-offset="${this.lazyLoadCnt}"></div>
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
            <div id="nav-header">
            <div id="bin-save">SaveAs</div>
            </div>
            <div id="container">
                ${this._lazyLoadHTML(this.lazyLoadCnt, this.lazyLoadCnt += this._lazyLoadSize)}
            </div>
            <div id="loadOffset" data-load-size="${this._lazyLoadSize}" data-load-offset="${this.lazyLoadCnt}"></div>
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
                    data.output += `<div class="bin-wrapper">
                    <div class="offset-col">
                    <span class="offset">0x${(start + currIdx).toString(16).padStart(8, '0').toUpperCase()}</span>
                    </div><div class="hex-data-col"> || `;
                    data.lineBuf = Buffer.allocUnsafe(numberOfBin);
                }

                data.output += `<span class="hex_data" data-tooltip-dec="${val}" offset="${start + currIdx}"> ${val.toString(16).padStart(2, '0').toUpperCase()} </span>`;
                data.lineBuf.writeUInt8(val, data.bufOffset);
                data.bufOffset++;

                if (data.bufOffset == numberOfBin || (end - start == data.bufOffset)) {
                    data.output += `</div>
                    <div class="char-data-col"> || 
                    <span class="char_data">${data.lineBuf.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}</span>
                    </div>
                    </div>`;
                    data.bufOffset = 0;
                }

                return data;
            }, { output : "", lineBuf : Buffer.allocUnsafe(numberOfBin), bufOffset : 0}).output;
    }

    private _buildHeaderHTML() : string {
        const numberOfBin : any = vscode.workspace.getConfiguration("conf.resource").get("numberOfBinaryInLine");

        if (this.metaInfo) {
            return this.metaInfo.fileMeta.reduce((output, item) => {
                if (item.rawValue) {
                    if (item.fieldType == loader.FieldType.PLAIN) {
                        let pos = item.rawValue;
                        output += `<div class="header-info" id="${item.fieldId}">
                        <a class="field-description">${item.fieldDescription}</a>
                        <div class="field-item collapse">${this._lazyLoadHTML(pos.binaryStartPos, pos.binaryEndPos)}</div>
                        </div>`;
                    } else if (item.fieldType == loader.FieldType.ARRAY) {
                        let arrayHTMLOutput = this._buildArrayTypeHTML(item);
                        output += `<div class="header-info" id="${item.fieldId}">
                        <a class="field-description">${item.fieldDescription} (${arrayHTMLOutput.length})</a>
                        <div class="field-item array-items collapse">${arrayHTMLOutput.output}</div>
                        </div>`;
                    }
                }

                return output;
            }, "");
        }

        return "";
    }

    private _buildArrayTypeHTML(item : loader.MetaField) : { length : number, output : string } {
        let arrLen = item.arrayLength;
        let arrSize = item.arraySize;
        let ret : { length : number, output : string } = {
            'length' : 0,
            'output' : ""
        };

        if (arrLen && arrSize && item.rawValue) {
            let tmp = item.rawValue;
            ret.length = arrLen;

            Array.from({length : arrLen}, (x, i) => {
                let arrItem = item.rawEntryValue(i);
                if (arrItem) {
                    ret.output += `<div class="array-items-description">${item.fieldDescription} (${i+1})</div>`
                    arrItem.forEach((entry, idx) => {
                        let fieldOfarrItem = item.arrayEntryField[idx];
                        ret.output += `<div class="array-item-description"> ${fieldOfarrItem.fieldDescription} </div>
                        <div class="field-item array-item">${this._lazyLoadHTML(entry.binaryStartPos, entry.binaryEndPos)}</div>`;
                    })
                }
                else if (arrSize) {
                    ret.output += `<div class="array-items-description">${item.fieldDescription} (${i+1})</div>
                    <div class="array-item-description"> ${item.fieldDescription} </div>
                    <div class="field-item array-item">${this._lazyLoadHTML(tmp.binaryStartPos + i * arrSize,
                        tmp.binaryEndPos + ((i + 1) * arrSize))} </div>`;
                }
            });

            return ret;
        }

        return ret;
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
                let requestSpecificEnd = event.loadEnd;
                let requestLoadEnd = this.lazyLoadCnt + this._lazyLoadSize;
                let command = 'onload';
                let gotoOffset = 0;

                if (requestSpecificEnd != undefined) {
                    requestLoadEnd = this.lazyLoadCnt + requestSpecificEnd;
                    command = 'gotoOffsetAfterLoad';
                    gotoOffset = event.gotoOffset;
                }

                this._panel.webview.postMessage({
                    command : command,
                    lazyHTML : this._lazyLoadHTML(this.lazyLoadCnt, requestLoadEnd),
                    loadedOffset : requestLoadEnd,
                    gotoOffset : gotoOffset,
                    response : '',
                });

                this.lazyLoadCnt = requestLoadEnd;
                break;
        }
    }
}
