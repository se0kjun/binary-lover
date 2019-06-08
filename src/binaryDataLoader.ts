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

    public static createBinaryPanel(meta : loader.MetaInfoLoader) {
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
			}
        );
        
        BinaryDataLoader.binaryDataLoader = new BinaryDataLoader(panel, meta);
    }

    private constructor (panel : vscode.WebviewPanel, meta : loader.MetaInfoLoader) {
        this.metaInfo = meta;
        this._panel = panel;

        bfileLoader.BinaryFileLoader.binaryFileLoad(this.metaInfo);

        this.metaInfo.applyBinaryInfo();

        this._update();
        this._panel.webview.onDidReceiveMessage(
            e => this._handleEvent,
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
                    aa += `<div>${tmp.binaryStartPos} 
                    || ${tmp.binaryEndPos} 
                    || ${bfileLoader.BinaryFileLoader.instance.openedFile.toString('hex', tmp.binaryStartPos, tmp.binaryEndPos)}
                    || ${item.fieldDescription} </div>`;
                }
            }
        );

        return `<html><body>${aa}</body></html>`;
    }

    private _update() {
        this._panel.webview.html = this._buildHTML();
    }

    private _handleEvent(e : any) {
    }
}
